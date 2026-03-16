import { ElectronAPI } from '@electron-toolkit/preload'

interface ScanResult {
  connected: boolean
  drive: string | null
  config?: Record<string, unknown>
  debug?: { candidates?: { root: string; hasBootOut?: boolean; hasSettings?: boolean; hasCodePy?: boolean }[] }
}

interface SaveConfigArgs {
  drive: string
  config: Record<string, unknown>
  initializePython?: boolean
}

interface SaveResult {
  success: boolean
  error?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      scanDevice: (args?: { driveHint?: string }) => Promise<ScanResult>
      saveConfig: (args: SaveConfigArgs) => Promise<SaveResult>
      startTelemetry: () => Promise<{ success: boolean }>
      stopTelemetry: () => Promise<{ success: boolean }>
      onTelemetry: (callback: (payload: Record<string, unknown>) => void) => () => void
      onRequestCloseWithUnsaved: (callback: () => void) => () => void
      setDirtyState: (dirty: boolean) => void
      respondClose: (action: 'cancel' | 'discard' | 'save') => Promise<void>
    }
  }
}
