import { contextBridge, ipcRenderer } from 'electron';
import { exposeRadioBridge } from '@saooti/radio-sdk/preload';
import { READY_CHANNEL, EXPORT_LOG_CHANNEL, DEVTOOLS_CHANNEL, DIAGNOSTICS_CHANNEL } from './channels.mjs';

exposeRadioBridge(contextBridge, ipcRenderer);
contextBridge.exposeInMainWorld('radioSample', {
  ready: () => ipcRenderer.invoke(READY_CHANNEL),
  exportLog: kind => ipcRenderer.invoke(EXPORT_LOG_CHANNEL, kind),
  openDevTools: () => ipcRenderer.invoke(DEVTOOLS_CHANNEL),
  showDiagnostics: value => ipcRenderer.invoke(DIAGNOSTICS_CHANNEL, value)
});
