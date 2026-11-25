import { createElectronRadioClient, getRadioErrorMessage, resolveRadioLocale } from '@saooti/radio-sdk/renderer';
import { SDK_VERSION } from '@saooti/radio-sdk';
import { mountRadioPlayer, mountSpeakerControls } from '@saooti/radio-sdk/ui';
import '@saooti/radio-sdk/ui/speaker-controls.css';
import { getSampleMessages } from './i18n.mjs';

const query = new URLSearchParams(location.search);
const radioId = query.get('radio');
const cip = query.get('cip');
let resolvedRadioId = cip ? null : radioId;
const platform = query.get('platform');
const urlParams = query.get('urlParams') ?? '';
const requestedLocale = query.get('locale') ?? 'auto';
let locale = resolveRadioLocale(requestedLocale);
const failure = document.getElementById('failure');
const restartButton = document.getElementById('restart');
const workspace = document.getElementById('workspace');
const restartProgress = document.getElementById('restart-progress');
const versionsLabel = document.getElementById('versions');
let currentError = null;
let errorMessageKey = null;
const debugLogging = document.getElementById('debug-logging');
const exportBasic = document.getElementById('export-basic');
const exportDebug = document.getElementById('export-debug');
const devtools = document.getElementById('devtools');
let loggingMessage = null;
const diagnosticsButton = document.getElementById('diagnostics');
let diagnosticsMessage = null;
let diagnosticsPending = false;

function showError(error, messageKey = null) {
  currentError = error;
  errorMessageKey = messageKey;
  console.error(error);
  failure.hidden = false;
  updateTexts();
}

function updateTexts() {
  const messages = getSampleMessages(locale);
  document.documentElement.lang = locale;
  document.getElementById('radio').textContent = `${messages.radio} ${resolvedRadioId ?? '…'} · ${platform}`;
  restartButton.querySelector('.button-label').textContent = messages.refresh;
  restartProgress.querySelector('p').textContent = messages.restarting;
  document.getElementById('player-section').setAttribute('aria-label', messages.player);
  document.getElementById('speakers-section').setAttribute('aria-label', messages.speakers);
  versionsLabel.setAttribute('aria-label', messages.versions);
  document.querySelector('.logging-panel').setAttribute('aria-label', messages.logs);
  document.getElementById('debug-label').textContent = messages.debugLogs;
  exportBasic.querySelector('.button-label').textContent = messages.exportBasic;
  exportDebug.querySelector('.button-label').textContent = messages.exportDebug;
  document.getElementById('logging-status').textContent = loggingMessage ? messages[loggingMessage] : '';
  diagnosticsButton.querySelector('.button-label').textContent = diagnosticsPending ? messages.diagnosticsLoading : messages.diagnostics;
  document.getElementById('diagnostics-status').textContent = diagnosticsMessage ? messages[diagnosticsMessage] : '';
  if (currentError !== null) {
    failure.textContent = errorMessageKey ? messages[errorMessageKey] : getRadioErrorMessage(currentError, locale);
  }
}
updateTexts();

let client;
let player;
let speakers;
let disposal;
let restarting = false;
let unsubscribeLocale;
diagnosticsButton.addEventListener('click', async () => {
  if (!client || disposal || restarting || diagnosticsPending) return;
  diagnosticsPending = true;
  diagnosticsButton.disabled = true;
  diagnosticsButton.setAttribute('aria-busy', 'true');
  diagnosticsMessage = null;
  updateTexts();
  try {
    const diagnostics = await client.getDiagnostics();
    if (disposal || restarting) return;
    const text = JSON.stringify({ collectedAt: new Date().toISOString(), versions: client.getVersions(), diagnostics }, null, 2);
    const result = await window.radioSample.showDiagnostics({ locale, text });
    if (!result.ok) diagnosticsMessage = 'diagnosticsError';
  } catch {
    if (!disposal && !restarting) diagnosticsMessage = 'diagnosticsError';
  } finally {
    diagnosticsPending = false;
    diagnosticsButton.disabled = Boolean(disposal || restarting);
    diagnosticsButton.removeAttribute('aria-busy');
    if (!disposal) updateTexts();
  }
});
function showLoggingMessage(key) { loggingMessage = key; updateTexts(); }
debugLogging.addEventListener('change', async () => {
  if (!client || disposal) return;
  const enabled = debugLogging.checked;
  debugLogging.disabled = true;
  try {
    await client.setLogLevel(enabled ? 'debug' : 'info');
    showLoggingMessage(null);
  } catch { debugLogging.checked = !enabled; showLoggingMessage('logError'); }
  finally { debugLogging.disabled = Boolean(disposal); }
});
for (const [button, kind] of [[exportBasic, 'basic'], [exportDebug, 'debug']]) {
  button.addEventListener('click', async () => {
    exportBasic.disabled = exportDebug.disabled = true;
    try {
      const result = await window.radioSample.exportLog(kind);
      showLoggingMessage(!result.ok ? 'logError' : result.canceled ? null : 'logSaved');
    } catch { showLoggingMessage('logError'); }
    finally { exportBasic.disabled = exportDebug.disabled = Boolean(disposal); }
  });
}
devtools.addEventListener('click', async () => {
  try {
    const result = await window.radioSample.openDevTools();
    if (!result.ok) showLoggingMessage('logError');
  } catch { showLoggingMessage('logError'); }
});
function updateVersions() {
  const versions = client?.getVersions() ?? { sdk: SDK_VERSION, miniplayer: null };
  versionsLabel.textContent = `sdk ${versions.sdk} · player ${restarting ? '—' : versions.miniplayer ?? '—'}`;
}
updateVersions();
restartButton.addEventListener('click', async () => {
  if (!client || restarting || disposal) return;
  restarting = true;
  diagnosticsButton.disabled = true;
  restartButton.disabled = true;
  restartButton.setAttribute('aria-busy', 'true');
  failure.hidden = true;
  workspace.hidden = true;
  workspace.inert = true;
  restartProgress.hidden = false;
  document.body.dataset.nativeState = 'restarting';
  updateVersions();
  try {
    await client.restart();
    failure.hidden = true;
    document.body.dataset.nativeState = 'ready';
  } catch (error) {
    document.body.dataset.nativeState = 'error';
    showError(error, 'restartError');
  } finally {
    restarting = false;
    updateVersions();
    restartProgress.hidden = true;
    workspace.hidden = false;
    workspace.inert = false;
    restartButton.removeAttribute('aria-busy');
    restartButton.disabled = Boolean(disposal);
    diagnosticsButton.disabled = Boolean(disposal || diagnosticsPending);
    if (!disposal) restartButton.focus();
  }
});
function dispose() {
  restartButton.disabled = true;
  diagnosticsButton.disabled = true;
  debugLogging.disabled = exportBasic.disabled = exportDebug.disabled = true;
  unsubscribeLocale?.();
  return disposal ??= (async () => {
    await Promise.allSettled([player?.dispose(), speakers?.dispose()]);
    await client?.dispose();
  })();
}
window.addEventListener('beforeunload', () => {
  devtools.disabled = true;
  void dispose();
}, { once: true });

try {
  const ready = await window.radioSample.ready();
  exportBasic.disabled = exportDebug.disabled = false;
  if (!ready.ok) throw new Error(ready.error);
  client = createElectronRadioClient({ locale: requestedLocale });
  unsubscribeLocale = client.subscribe(state => {
    const next = state.locale ?? client.getLocale();
    const nextRadio = state.radioId ?? null;
    if (next === locale && nextRadio === resolvedRadioId) return;
    locale = next;
    resolvedRadioId = nextRadio;
    updateTexts();
  });
  await client.connect();
  diagnosticsButton.disabled = false;
  debugLogging.checked = (await client.getLogLevel()) === 'debug';
  debugLogging.disabled = false;
  speakers = mountSpeakerControls({ target: document.getElementById('speakers'), client, onError: showError });
  document.body.dataset.nativeState = 'ready';
  player = mountRadioPlayer({ target: document.getElementById('player'), client,
    ...(radioId ? { radioId } : {}), ...(cip ? { cip } : {}), platform, urlParams, onError: showError });
  void player.ready.then(() => {
    if (!disposal) { updateVersions(); if (!restarting) restartButton.disabled = false; }
  }, () => {
    if (!disposal) { updateVersions(); restartButton.disabled = false; }
  });
} catch (error) {
  document.body.dataset.nativeState = 'error';
  showError(error, 'startupError');
  await dispose();
}
