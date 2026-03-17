import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  scanDevice: (args?: { driveHint?: string }) => ipcRenderer.invoke('scan-device', args),
  saveConfig: (args: { drive: string; config: Record<string, unknown>; initializePython?: boolean }) =>
    ipcRenderer.invoke('save-config', args),
  activateProfile: (profile: number) => ipcRenderer.invoke('telemetry-set-active-profile', { profile }),
  startTelemetry: () => ipcRenderer.invoke('telemetry-start'),
  stopTelemetry: () => ipcRenderer.invoke('telemetry-stop'),
  onTelemetry: (callback: (payload: Record<string, unknown>) => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: Record<string, unknown>) => callback(payload)
    ipcRenderer.on('telemetry-update', handler)
    return () => ipcRenderer.removeListener('telemetry-update', handler)
  },
  onRequestCloseWithUnsaved: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('request-close-with-unsaved', handler)
    return () => ipcRenderer.removeListener('request-close-with-unsaved', handler)
  },
  setDirtyState: (dirty: boolean) => ipcRenderer.send('set-dirty-state', dirty),
  respondClose: (action: 'cancel' | 'discard' | 'save') => ipcRenderer.invoke('close-response', action),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
