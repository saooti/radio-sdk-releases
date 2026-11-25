import { app, BrowserWindow, dialog, ipcMain, net, powerSaveBlocker, protocol } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { configureRadioApp, createNativeRadioBackend, createRadioHost, initRadioFirewall, createRadioFileLogger, RADIO_RESOURCES_DIRECTORY } from '@saooti/radio-sdk/electron';
import { assetName, contentSecurityPolicy, isTrustedContents, isTrustedSender, launchConfig, rendererUrl } from './config.mjs';
import { READY_CHANNEL, EXPORT_LOG_CHANNEL, DEVTOOLS_CHANNEL, DIAGNOSTICS_CHANNEL } from './channels.mjs';
import { getSampleMessages } from './i18n.mjs';
import { sampleEnvironment } from './environment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let config;
try {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  config = launchConfig(args, sampleEnvironment(args));
} catch (error) {
  console.error(error.message);
  app.exit(1);
}
const expectedUrl = rendererUrl(config);
configureRadioApp(app);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{
  scheme: 'sample', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

let window;
let diagnosticsWindow;
let backend;
let host;
let firewall;
let logger;
let savingSettings = Promise.resolve();
let requestedSavedLevel;
let savingLevel = false;
let startup = Promise.resolve();
let quitting = false;

app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void (async () => {
    try {
      await startup;
      if (host) await host.dispose();
      else await backend?.dispose();
    } catch (error) {
      console.error('Arrêt des services natifs impossible :', error.message);
      process.exitCode = 1;
    } finally {
      firewall?.dispose();
      await savingSettings.catch(() => undefined);
      await logger?.dispose();
      ipcMain.removeHandler(READY_CHANNEL);
      ipcMain.removeHandler(EXPORT_LOG_CHANNEL);
      ipcMain.removeHandler(DEVTOOLS_CHANNEL);
      ipcMain.removeHandler(DIAGNOSTICS_CHANNEL);
      app.quit();
    }
  })();
});
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  const settingsPath = path.join(app.getPath('userData'), 'logging.json');
  let savedLevel;
  try { savedLevel = JSON.parse(await readFile(settingsPath, 'utf8')).level; } catch { /* First run or invalid settings. */ }
  if (quitting) return;
  if (!['off', 'error', 'warn', 'info', 'debug'].includes(savedLevel)) savedLevel = 'info';
  const files = createRadioFileLogger({ directory: path.join(app.getPath('userData'), 'logs'), level: config.logLevel ?? savedLevel });
  logger = { ...files, setLevel(level) {
    files.setLevel(level);
    requestedSavedLevel = level;
    if (savingLevel) return;
    savingLevel = true;
    savingSettings = (async () => {
      while (requestedSavedLevel !== undefined) {
        const next = requestedSavedLevel;
        requestedSavedLevel = undefined;
        try { await writeFile(settingsPath, JSON.stringify({ level: next }), { mode: 0o600 }); }
        catch { files.write('warn', 'sample', 'logging.settings_failed'); }
      }
    })().finally(() => { savingLevel = false; });
  } };
  protocol.handle('sample', async request => {
    const name = assetName(request.url);
    if (!name || request.method !== 'GET') return new Response('Not found', { status: 404 });
    const response = await net.fetch(pathToFileURL(path.join(root, 'dist', name)).href);
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', contentSecurityPolicy(config.platform));
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  });
  window = new BrowserWindow({
    title: 'Radio SDK Sample', width: 900, height: 680, minWidth: 560, minHeight: 420, show: false,
    webPreferences: {
      preload: path.join(root, 'dist/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('closed', () => { if (diagnosticsWindow && !diagnosticsWindow.isDestroyed()) diagnosticsWindow.destroy(); });
  for (const name of ['will-navigate', 'will-redirect']) {
    window.webContents.on(name, (event, url) => { if (url !== expectedUrl) event.preventDefault(); });
  }
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  ipcMain.handle(READY_CHANNEL, event => {
    if (!isTrustedSender(event, window, expectedUrl)) throw new Error('Fenêtre non autorisée.');
    return startup;
  });
  let exporting = false;
  ipcMain.handle(EXPORT_LOG_CHANNEL, async (event, kind) => {
    if (!isTrustedSender(event, window, expectedUrl) || !['basic', 'debug'].includes(kind) || exporting) return { ok: false };
    exporting = true;
    try {
      const result = await dialog.showSaveDialog(window, { defaultPath: `radio-sdk-${kind}.log`,
        filters: [{ name: 'Logs', extensions: ['log'] }] });
      if (result.canceled) return { ok: true, canceled: true };
      if (!result.filePath || !isTrustedSender(event, window, expectedUrl)) return { ok: false };
      await logger.exportLog(kind, result.filePath);
      return { ok: true };
    } catch { return { ok: false }; }
    finally { exporting = false; }
  });
  ipcMain.handle(DEVTOOLS_CHANNEL, event => {
    if (!isTrustedSender(event, window, expectedUrl)) return { ok: false };
    window.webContents.openDevTools({ mode: 'detach' });
    return { ok: true };
  });
  ipcMain.handle(DIAGNOSTICS_CHANNEL, async (event, value) => {
    if (quitting || !isTrustedSender(event, window, expectedUrl) || !value ||
        !['fr', 'en', 'it'].includes(value.locale) || typeof value.text !== 'string' || value.text.length > 1_000_000) return { ok: false };
    try {
      if (!diagnosticsWindow || diagnosticsWindow.isDestroyed()) {
        const viewer = new BrowserWindow({ parent: window, width: 800, height: 650, show: false,
          backgroundColor: '#ffffff', autoHideMenuBar: true,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false }
        });
        diagnosticsWindow = viewer;
        viewer.on('closed', () => { if (diagnosticsWindow === viewer) diagnosticsWindow = null; });
        viewer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        viewer.webContents.on('will-navigate', event => event.preventDefault());
        viewer.webContents.on('will-redirect', event => event.preventDefault());
      }
      const viewer = diagnosticsWindow;
      const title = getSampleMessages(value.locale).diagnostics;
      const text = value.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const document = `<!doctype html><html lang="${value.locale}"><meta charset="utf-8"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>${title}</title><pre>${text}</pre></html>`;
      await viewer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(document));
      if (quitting || !isTrustedSender(event, window, expectedUrl)) { viewer.destroy(); return { ok: false }; }
      viewer.show();
      viewer.focus();
      return { ok: true };
    } catch { return { ok: false }; }
  });
  startup = (async () => {
    try {
      firewall = initRadioFirewall({ programPath: process.execPath, ruleName: 'Saooti.RadioSDK.Sample', logger,
        ...(app.isPackaged ? { resourcesRoot: path.join(process.resourcesPath, RADIO_RESOURCES_DIRECTORY) } : {}) });
      backend = await createNativeRadioBackend(app.isPackaged ? { logger,
        resourcesRoot: path.join(process.resourcesPath, RADIO_RESOURCES_DIRECTORY)
      } : { logger });
      host = createRadioHost({ ipcMain, backend, logger, firewall, authentication: config.authentication,
        ...(config.radioResolution ? { radioResolution: config.radioResolution } : {}),
        diagnostics: { fetch: (url, options) => net.fetch(url, options) },
        playback: { webContents: window.webContents, powerSaveBlocker },
        isTrustedWebContents: contents => isTrustedContents(contents, window, expectedUrl) });
      return { ok: true };
    } catch (error) {
      logger.write('error', 'sample', 'startup.failed', error);
      await backend?.dispose().catch(() => undefined);
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  })();
  await window.loadURL(expectedUrl);
  window.show();
}).catch(error => {
  console.error('Démarrage impossible :', error);
  process.exitCode = 1;
  app.quit();
});
