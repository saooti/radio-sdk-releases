import path from 'node:path';
import { getRadioResourceCopyPatterns, RADIO_RESOURCES_DIRECTORY, verifyRadioWindowsSignatures } from '@saooti/radio-sdk/electron';
import { sampleEnvironment } from './src/environment.mjs';

const env = sampleEnvironment();
const signingMode = env.WINDOWS_SIGNING_MODE?.trim() || 'none';
if (!['none', 'token'].includes(signingMode)) throw new Error('WINDOWS_SIGNING_MODE must be none or token.');
const signed = signingMode === 'token';
const publisherName = env.WINDOWS_CERTIFICATE_SUBJECT?.trim();
const certificateSha1 = env.WINDOWS_CERTIFICATE_SHA1?.replace(/\s/g, '').toUpperCase();
const timestampUrl = env.WINDOWS_TIMESTAMP_URL?.trim() || 'http://timestamp.sectigo.com';
if (signed) {
  if (!publisherName) throw new Error('Set WINDOWS_CERTIFICATE_SUBJECT to the signing certificate CN.');
  if (certificateSha1 !== undefined && !/^[A-F0-9]{40}$/.test(certificateSha1)) throw new Error('WINDOWS_CERTIFICATE_SHA1 must contain 40 hexadecimal characters.');
  if (env.CSC_LINK || env.WIN_CSC_LINK) throw new Error('Remove CSC_LINK/WIN_CSC_LINK when signing with a certificate token.');
  if (!['http:', 'https:'].includes(new URL(timestampUrl).protocol)) throw new Error('WINDOWS_TIMESTAMP_URL must be an HTTP(S) URL.');
}

export default {
  appId: 'com.saooti.radiosdksample',
  productName: 'Radio SDK Sample',
  directories: { output: 'release' },
  files: ['src/*.mjs', 'dist/**/*', 'package.json', '!node_modules/@saooti/radio-sdk/resources/**/*'],
  extraResources: getRadioResourceCopyPatterns(),
  mac: { identity: null },
  win: {
    signExecutable: signed,
    forceCodeSigning: signed,
    signExts: ['.exe', '.node'],
    ...(signed ? {
      signtoolOptions: {
        certificateSubjectName: publisherName,
        publisherName,
        ...(certificateSha1 ? { certificateSha1 } : {}),
        signingHashAlgorithms: ['sha256'],
        rfc3161TimeStampServer: timestampUrl
      }
    } : {})
  },
  async afterSign(context) {
    if (!signed || context.electronPlatformName !== 'win32') return;
    await verifyRadioWindowsSignatures({
      resourcesRoot: path.join(context.appOutDir, 'resources', RADIO_RESOURCES_DIRECTORY),
      publisherName,
      ...(certificateSha1 ? { certificateSha1 } : {})
    });
  }
};
