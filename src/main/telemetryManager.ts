import { BrowserWindow, ipcMain } from 'electron'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

type TelemetryPayload = {
  type?: string
  screen?: string
  pressed?: boolean[]
  active_profile?: number
  profile?: number
  ts?: number
}

let activePort: SerialPort | null = null
let activePortPath: string | null = null
let activeParser: ReadlineParser | null = null
let hasSeenTelemetry = false
let lastObservedActiveProfile: number | null = null

let pendingProfileAck:
  | {
      profile: number
      resolve: () => void
      reject: (err: Error) => void
      timer: NodeJS.Timeout
    }
  | null = null

const senderDirtyState = new Map<number, boolean>()
const closePending = new Set<number>()

function cleanupActivePort() {
  if (pendingProfileAck) {
    clearTimeout(pendingProfileAck.timer)
    pendingProfileAck.reject(new Error('Serial connection closed before profile switch ACK'))
    pendingProfileAck = null
  }

  try {
    if (activeParser) {
      activeParser.removeAllListeners('data')
      activeParser = null
    }
    if (activePort) {
      activePort.removeAllListeners()
      if (activePort.isOpen) {
        activePort.close()
      }
      activePort = null
    }
    activePortPath = null
    hasSeenTelemetry = false
  } catch {
    // ignore close errors
  }
}

function handleIncomingPayload(payload: TelemetryPayload) {
  if (Number.isInteger(payload.active_profile)) {
    lastObservedActiveProfile = payload.active_profile as number
  }

  if (
    pendingProfileAck &&
    ((payload.type === 'active_profile_set' &&
      Number.isInteger(payload.profile) &&
      payload.profile === pendingProfileAck.profile) ||
      (Number.isInteger(payload.active_profile) && payload.active_profile === pendingProfileAck.profile))
  ) {
    clearTimeout(pendingProfileAck.timer)
    pendingProfileAck.resolve()
    pendingProfileAck = null
  }

  if (
    payload &&
    (payload.type === 'telemetry' ||
      payload.type === 'pong' ||
      payload.type === 'active_profile_set' ||
      Array.isArray(payload.pressed) ||
      typeof payload.screen === 'string')
  ) {
    hasSeenTelemetry = true
    forwardTelemetry(payload)
  }
}

function waitForProfileAck(profile: number, timeoutMs: number) {
  if (lastObservedActiveProfile === profile) {
    return Promise.resolve()
  }

  if (pendingProfileAck) {
    clearTimeout(pendingProfileAck.timer)
    pendingProfileAck.reject(new Error('Superseded by another profile switch request'))
    pendingProfileAck = null
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingProfileAck && pendingProfileAck.profile === profile) {
        pendingProfileAck = null
      }
      reject(new Error('No ACK from MaxPad for profile switch'))
    }, timeoutMs)

    pendingProfileAck = { profile, resolve, reject, timer }
  })
}

function sendSerialCommandAsync(payload: Record<string, unknown>) {
  if (!activePort || !activePort.isOpen) {
    return Promise.reject(new Error('Telemetry serial port is not connected'))
  }

  return new Promise<void>((resolve, reject) => {
    activePort!.write(`${JSON.stringify(payload)}\n`, (err) => {
      if (err) {
        reject(err)
        return
      }

      activePort!.drain((drainErr) => {
        if (drainErr) {
          reject(drainErr)
          return
        }
        resolve()
      })
    })
  })
}

function isLikelyBoardPort(port: Awaited<ReturnType<typeof SerialPort.list>>[number]) {
  const vendorId = (port.vendorId || '').toLowerCase()
  const productId = (port.productId || '').toLowerCase()
  const text = [port.path, port.manufacturer, (port as any).friendlyName, port.pnpId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    vendorId === '2886' ||
    vendorId === '2e8a' ||
    vendorId === '239a' ||
    productId === '0042' ||
    text.includes('circuitpython') ||
    text.includes('tinyusb') ||
    text.includes('seeed') ||
    text.includes('rp2040') ||
    text.includes('usb serial')
  )
}

function forwardTelemetry(payload: TelemetryPayload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) {
        win.webContents.send('telemetry-update', payload)
      }
    } catch {
      // Window may have been destroyed between the check and send
    }
  }
}



async function openCandidatePort(path: string) {
  return new Promise<boolean>((resolve) => {
    const port = new SerialPort({ path, baudRate: 115200, autoOpen: false })
    port.open((err) => {
      if (err) {
        resolve(false)
        return
      }

      let accepted = false
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))

      const acceptAndResolve = () => {
        if (accepted) return
        accepted = true
        activePort = port
        activePortPath = path
        activeParser = parser
        resolve(true)
      }

      parser.on('data', (raw: string) => {
        try {
          const payload = JSON.parse(raw) as TelemetryPayload
          if (!payload) return

          if (
            payload.type === 'telemetry' ||
            payload.type === 'pong' ||
            payload.type === 'active_profile_set' ||
            Array.isArray(payload.pressed) ||
            typeof payload.screen === 'string'
          ) {
            acceptAndResolve()
            handleIncomingPayload(payload)
          }
        } catch {
          // ignore non-json lines
        }
      })

      port.on('error', () => {
        if (!accepted) resolve(false)
      })

      // Ping immediately; only the correct CDC data port will respond.
      try {
        port.write(`${JSON.stringify({ type: 'ping' })}\n`)
      } catch {
        // ignore
      }

      setTimeout(() => {
        if (!accepted) {
          try {
            parser.removeAllListeners('data')
            port.removeAllListeners()
            if (port.isOpen) port.close()
          } catch {
            // ignore
          }
          resolve(false)
        }
      }, 1200)
    })
  })
}

async function startTelemetry() {
  const ports = await SerialPort.list()

  if (activePort && activePortPath && activePort.isOpen) {
    return {
      success: hasSeenTelemetry,
      port: activePortPath,
      ports: ports.map((p) => p.path),
    }
  }

  cleanupActivePort()

  const candidates = ports
    .slice()
    .sort((a, b) => Number(isLikelyBoardPort(b)) - Number(isLikelyBoardPort(a)))

  for (const candidate of candidates) {
    const ok = await openCandidatePort(candidate.path)
    if (ok) {
      return { success: true, port: candidate.path, ports: ports.map((p) => p.path) }
    }
  }

  return { success: false, ports: ports.map((p) => p.path) }
}

export function registerTelemetryIpc() {
  ipcMain.handle('telemetry-start', async () => {
    try {
      return await startTelemetry()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('telemetry-stop', async () => {
    cleanupActivePort()
    return { success: true }
  })

  ipcMain.handle('telemetry-set-active-profile', async (_, args?: { profile?: unknown }) => {
    const profile = Number(args?.profile)
    if (!Number.isInteger(profile) || profile < 0) {
      return { success: false, error: 'Invalid profile index' }
    }

    try {
      if (!activePort || !activePort.isOpen) {
        await startTelemetry()
      }

      if (!activePort || !activePort.isOpen) {
        return { success: false, error: 'MaxPad serial port not connected yet' }
      }

      const ackPromise = waitForProfileAck(profile, 3500)

      // Retry command a few times while waiting for ACK/telemetry confirmation.
      await sendSerialCommandAsync({ type: 'set_active_profile', profile })
      setTimeout(() => {
        if (pendingProfileAck?.profile === profile) {
          void sendSerialCommandAsync({ type: 'set_active_profile', profile }).catch(() => null)
        }
      }, 500)
      setTimeout(() => {
        if (pendingProfileAck?.profile === profile) {
          void sendSerialCommandAsync({ type: 'set_active_profile', profile }).catch(() => null)
        }
      }, 1200)

      await ackPromise
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: msg }
    }
  })

  ipcMain.on('set-dirty-state', (event, dirty: boolean) => {
    senderDirtyState.set(event.sender.id, !!dirty)
  })

  ipcMain.handle('close-response', (event, action: 'cancel' | 'discard' | 'save') => {
    const wc = event.sender
    const win = BrowserWindow.fromWebContents(wc)
    if (!win || win.isDestroyed()) return { success: false }

    if (action === 'cancel') {
      closePending.delete(wc.id)
      return { success: true }
    }

    closePending.delete(wc.id)
    senderDirtyState.set(wc.id, false)
    // Defer close to next tick so IPC response can be sent before window destruction
    setImmediate(() => {
      if (!win.isDestroyed()) win.close()
    })
    return { success: true }
  })
}

export function registerWindowCloseGuard(win: BrowserWindow) {
  // Capture webContents ID early - accessing win.webContents after 'closed' throws
  const wcId = win.webContents.id

  win.on('close', (event) => {
    const dirty = senderDirtyState.get(wcId) === true
    if (!dirty) return

    if (closePending.has(wcId)) {
      closePending.delete(wcId)
      senderDirtyState.set(wcId, false)
      return
    }

    event.preventDefault()
    closePending.add(wcId)
    try {
      if (!win.isDestroyed()) {
        win.webContents.send('request-close-with-unsaved')
      }
    } catch {
      // Window may have been destroyed between check and send
      closePending.delete(wcId)
    }
  })

  win.on('closed', () => {
    senderDirtyState.delete(wcId)
    closePending.delete(wcId)
  })
}

export function cleanupTelemetryOnQuit() {
  cleanupActivePort()
}
