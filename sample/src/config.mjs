import { MINIPLAYER_ENVIRONMENTS } from '@saooti/radio-sdk/renderer';

export const SAMPLE_ORIGIN = 'sample://radio-sdk-sample';

const IMA_SCRIPT_SOURCES = [
  'https://imasdk.googleapis.com/js/sdkloader/ima3.js',
  'https://s0.2mdn.net/instream/video/client.js',
  'https://pagead2.googlesyndication.com/omsdk/releases/live/omweb-v1.js'
];
// IMA includes its version and locale in the bridge filename.
const IMA_BRIDGE_SOURCE = 'https://imasdk.googleapis.com/js/core/';

export function launchConfig(args = [], env = process.env) {
  const value = (key, fallback) => args.find(argument => argument.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
  const radioId = value('--radio', env.SAOOTI_RADIO_ID);
  const platform = value('--platform', env.SAOOTI_RADIO_PLATFORM ?? 'prod');
  const locale = value('--locale', env.SAOOTI_RADIO_LOCALE ?? 'auto');
  const urlParams = value('--url-params', env.SAOOTI_RADIO_URL_PARAMS ?? '');
  const cip = value('--cip', env.SAOOTI_RADIO_CIP)?.trim() || undefined;
  const queryCip = new URLSearchParams(urlParams).get('cip')?.trim();
  const logLevel = value('--log-level', env.SAOOTI_RADIO_LOG_LEVEL);
  if (logLevel !== undefined && !['off', 'error', 'warn', 'info', 'debug'].includes(logLevel)) throw new Error('Niveau de journalisation invalide.');
  if (!radioId && !cip && !queryCip) {
    throw new Error('Définir SAOOTI_RADIO_CIP / --cip ou SAOOTI_RADIO_ID / --radio.');
  }
  if (!cip && !queryCip && !/^[A-Za-z0-9_-]{1,128}$/.test(radioId)) throw new Error('Identifiant radio invalide.');
  if (!Object.hasOwn(MINIPLAYER_ENVIRONMENTS, platform)) throw new Error('Plateforme du lecteur invalide.');
  const username = env.SAOOTI_RADIO_USERNAME;
  const password = env.SAOOTI_RADIO_PASSWORD;
  if (!username?.trim() || !password) {
    throw new Error('Les variables SAOOTI_RADIO_USERNAME et SAOOTI_RADIO_PASSWORD sont obligatoires.');
  }
  const apiBaseUrl = env.SAOOTI_RADIO_API_BASE_URL;
  return { radioId, cip, platform, locale, urlParams,
    ...(apiBaseUrl ? { radioResolution: { apiBaseUrls: { [platform]: apiBaseUrl } } } : {}),
    ...(logLevel === undefined ? {} : { logLevel }), authentication: { username, password } };
}

export function rendererUrl(config) {
  const url = new URL(SAMPLE_ORIGIN + '/index.html');
  if (config.radioId) url.searchParams.set('radio', config.radioId);
  if (config.cip) url.searchParams.set('cip', config.cip);
  url.searchParams.set('platform', config.platform);
  if (config.locale) url.searchParams.set('locale', config.locale);
  if (config.urlParams) url.searchParams.set('urlParams', config.urlParams);
  return url.href;
}

export function contentSecurityPolicy(platform) {
  const origin = MINIPLAYER_ENVIRONMENTS[platform];
  if (!origin) throw new Error('Plateforme du lecteur invalide.');
  return [
    "default-src 'none'",
    `script-src 'self' blob: ${origin} ${IMA_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'self' 'unsafe-inline' https: ${origin}`,
    `connect-src 'self' https: wss: ${origin}`, `img-src https: data: ${origin}`, `font-src https: data: ${origin}`,
    `media-src https: blob: data: ${origin}`, "worker-src 'self' blob:", "base-uri 'none'", "form-action 'none'",
    `frame-src ${IMA_BRIDGE_SOURCE}`
  ].join('; ');
}

export function isTrustedContents(contents, window, expectedUrl) {
  return contents === window.webContents && !contents.isDestroyed() && contents.getURL() === expectedUrl;
}

export function isTrustedSender(event, window, expectedUrl) {
  return isTrustedContents(event.sender, window, expectedUrl) && event.senderFrame === window.webContents.mainFrame;
}

export function assetName(requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'sample:' || url.host !== 'radio-sdk-sample' || url.username || url.password) return null;
  const allowed = new Set(['/index.html', '/renderer.js', '/renderer.js.map', '/renderer.css', '/renderer.css.map', '/styles.css']);
  return allowed.has(url.pathname) ? url.pathname.slice(1) : null;
}
