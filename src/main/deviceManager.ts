import { ipcMain } from 'electron'
import { getDiskInfo } from 'node-disk-info'
import fs from 'fs'
import path from 'path'

const CONFIG_FILE = 'maxpad_config.json'
export const DEFAULT_BOOT_PYTHON_CODE = `import usb_cdc

usb_cdc.enable(console=True, data=True)
`

type Profile = {
  name: string
  keys: string[]
  encoder: string[]
}

type MaxPadConfig = {
  profiles: Profile[]
}

function normalizeConfig(input: unknown): MaxPadConfig {
  const obj = input as Record<string, unknown> | null | undefined
  const rawProfiles = Array.isArray(obj?.profiles)
    ? obj.profiles
    : Array.isArray(obj?.layers)
      ? obj.layers
      : null

  if (!rawProfiles || rawProfiles.length === 0) {
    return {
      profiles: [
        { name: 'Default', keys: new Array(12).fill('KC.NO'), encoder: ['KC.NO', 'KC.NO', 'KC.NO'] }
      ]
    }
  }

  const profiles: Profile[] = rawProfiles.map((p: Record<string, unknown>, index: number) => {
    const keys = Array.isArray(p?.keys) ? p.keys.slice(0, 12) : []
    while (keys.length < 12) keys.push('KC.NO')
    const encoder = Array.isArray(p?.encoder) ? p.encoder.slice(0, 3) : []
    while (encoder.length < 3) encoder.push('KC.NO')

    return {
      name: typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : `Profile ${index + 1}`,
      keys,
      encoder
    }
  })

  return { profiles }
}

// Standard KMK Config we push to the board
export const DEFAULT_PYTHON_CODE = `import board
import busio
import displayio
import terminalio
import i2cdisplaybus
from adafruit_display_text import label
import adafruit_displayio_ssd1306
import json
import time
import usb_cdc

from kmk.kmk_keyboard import KMKKeyboard
from kmk.keys import KC
from kmk.scanners import DiodeOrientation
from kmk.modules.layers import Layers
from kmk.modules.encoder import EncoderHandler
from kmk.extensions.media_keys import MediaKeys
from kmk.modules.macros import Macros
from kmk.modules.mouse_keys import MouseKeys
from kmk.modules import Module

# --- Register custom profile-cycling keys ---
try:
    from kmk.keys import make_key
    make_key(names=('NEXT_PROFILE',))
    make_key(names=('PREV_PROFILE',))
except Exception:
    pass

# --- HARDWARE CONFIGURATION ---
keyboard = KMKKeyboard()
keyboard.debug_enabled = True

keyboard.col_pins = (board.D6, board.D7, board.D10)
keyboard.row_pins = (board.D0, board.D1, board.D2, board.D3)
keyboard.diode_orientation = DiodeOrientation.COL2ROW 

encoder_handler = EncoderHandler()
encoder_handler.pins = ((board.D8, board.D9, None, False),)

keyboard.modules.append(encoder_handler)
keyboard.modules.append(Layers())
keyboard.modules.append(Macros())
keyboard.modules.append(MouseKeys())
keyboard.extensions.append(MediaKeys())

# --- OLED SETUP ---
displayio.release_displays()
i2c = busio.I2C(board.D5, board.D4)
display_bus = i2cdisplaybus.I2CDisplayBus(i2c, device_address=0x3C)
display = adafruit_displayio_ssd1306.SSD1306(display_bus, width=128, height=32)

serial_data = None
try:
  serial_data = usb_cdc.data
except Exception:
  try:
    serial_data = usb_cdc.console
  except Exception:
    serial_data = None

pressed_state = [False] * 12
current_screen_text = "MAXPAD v1\\nReady..."
current_layer = 0
last_telemetry = 0.0
num_profiles = 1

def send_telemetry(force=False):
  global last_telemetry
  if serial_data is None:
    return

  now = time.monotonic()
  if not force and (now - last_telemetry) < 0.05:
    return

  payload = {
    "type": "telemetry",
    "active_profile": current_layer,
    "pressed": pressed_state,
    "screen": current_screen_text,
    "ts": now,
  }

  try:
    serial_data.write((json.dumps(payload) + "\\n").encode("utf-8"))
    last_telemetry = now
  except Exception:
    try:
      usb_cdc.console.write((json.dumps(payload) + "\\n").encode("utf-8"))
      last_telemetry = now
    except Exception:
      # Keep firmware stable even if host disconnects.
      pass

def expand_keys(keys, size=12):
    result = list(keys[:size])
    while len(result) < size:
        result.append(KC.NO)
    return result

def expand_encoder(enc):
    result = list(enc[:3])
    while len(result) < 3:
        result.append(KC.NO)
    return tuple(result)

def update_screen(text):
  global current_screen_text
  current_screen_text = text
  splash = displayio.Group()
  text_area = label.Label(terminalio.FONT, text=text, color=0xFFFFFF, x=5, y=15)
  splash.append(text_area)
  display.root_group = splash
  send_telemetry(True)

def parse_key(k_str):
    try:
        if k_str.startswith("KC."):
            return eval(k_str, {"KC": KC})
        return KC.TRNS
    except:
        return KC.TRNS

# --- THE COORDINATE MAP ---
keyboard.coord_mapping = [
    0,  1,  2,  11, 7,  
    8,  3,  4,   5, 9,  
    10, 6               
]

class ProfileCycler(Module):
  def during_bootup(self, keyboard):
    return None

  def before_matrix_scan(self, keyboard):
    return None

  def after_matrix_scan(self, keyboard):
    return None

  def process_key(self, keyboard, key, is_pressed, int_coord):
    if not is_pressed:
      return key

    if key == KC.NEXT_PROFILE:
      cur = keyboard.active_layers[0] if keyboard.active_layers else 0
      nxt = (cur + 1) % num_profiles
      keyboard.active_layers = [nxt]
      update_screen(mode_names.get(nxt, f"PROFILE {nxt} profile"))
      return KC.NO

    if key == KC.PREV_PROFILE:
      cur = keyboard.active_layers[0] if keyboard.active_layers else 0
      prv = (cur - 1) % num_profiles
      keyboard.active_layers = [prv]
      update_screen(mode_names.get(prv, f"PROFILE {prv} profile"))
      return KC.NO

    return key

  def before_hid_send(self, keyboard):
    return None

  def after_hid_send(self, keyboard):
    return None

  def on_powersave_enable(self, keyboard):
    return None

  def on_powersave_disable(self, keyboard):
    return None

  def deinit(self, keyboard):
    return None

keyboard.modules.append(ProfileCycler())

class TelemetryModule(Module):
  def during_bootup(self, keyboard):
    return None

  def before_matrix_scan(self, keyboard):
    return None

  def after_matrix_scan(self, keyboard):
    return None

  def process_key(self, keyboard, key, is_pressed, int_coord):
    if int_coord is not None:
      try:
        idx = keyboard.coord_mapping.index(int_coord)
        if 0 <= idx < len(pressed_state):
          pressed_state[idx] = bool(is_pressed)
          send_telemetry(True)
      except Exception:
        pass
    return key

  def before_hid_send(self, keyboard):
    return None

  def after_hid_send(self, keyboard):
    return None

  def on_powersave_enable(self, keyboard):
    return None

  def on_powersave_disable(self, keyboard):
    return None

  def deinit(self, keyboard):
    return None

keyboard.modules.append(TelemetryModule())

# --- LOAD CONFIG ---
mode_names = {}
try:
    with open("maxpad_config.json", "r") as f:
        config = json.load(f)
    
    keymap = []
    encoder_map = []
    
    profiles = config.get("profiles", config.get("layers", []))
    num_profiles = len(profiles)
    for i, layer in enumerate(profiles):
        mode_names[i] = (layer.get("name", f"PROFILE {i}") + " profile")
        layer_keys = [parse_key(k) for k in layer.get("keys", [])]
        keymap.append(expand_keys(layer_keys))
        
        enc = [parse_key(k) for k in layer.get("encoder", ["KC.NO", "KC.NO", "KC.NO"])]
        encoder_map.append((expand_encoder(enc),))
        
    if not keymap:
        raise ValueError("Empty config")
        
    keyboard.keymap = keymap
    encoder_handler.map = encoder_map

except Exception as e:
    # Fallback default
    mode_names = {0: "ERROR / DEFAULT profile"}
    num_profiles = 1
    keyboard.keymap = [
        expand_keys([KC.A, KC.B, KC.C, KC.D, KC.E, KC.F, KC.G, KC.H, KC.I, KC.J, KC.K, KC.L])
    ]
    encoder_handler.map = [((KC.VOLD, KC.VOLU, KC.NO),)]
    print("Error loading config:", e)

# --- MAIN LOOP ---
current_layer = -1
if __name__ == '__main__':
    update_screen("MAXPAD v1\\nReady...")
    keyboard._init()
    while True:
        new_layer = keyboard.active_layers[0] if keyboard.active_layers else 0
        if new_layer != current_layer:
            current_layer = new_layer
            update_screen(mode_names.get(current_layer, f"PROFILE {current_layer} profile"))

        keyboard._main_loop()
        send_telemetry(False)
`

export async function findDevice() {
  const normalizeRoot = (maybeRoot: string) => {
    if (!maybeRoot) return maybeRoot
    if (process.platform === 'win32') {
      // node-disk-info (and other sources) can return e.g. "D:".
      if (/^[A-Za-z]:$/.test(maybeRoot)) return `${maybeRoot}\\`
      if (/^[A-Za-z]:\\$/.test(maybeRoot)) return maybeRoot
    }
    return maybeRoot
  }

  const probeRoot = (root: string) => {
    const bootOut = path.join(root, 'boot_out.txt')
    const settings = path.join(root, 'settings.toml')
    const codePy = path.join(root, 'code.py')
    const libDir = path.join(root, 'lib')
    const kmkDir = path.join(root, 'kmk')
    return {
      root,
      hasBootOut: fs.existsSync(bootOut),
      hasSettings: fs.existsSync(settings),
      hasCodePy: fs.existsSync(codePy),
      hasLib: fs.existsSync(libDir) && fs.statSync(libDir).isDirectory(),
      hasKmk: fs.existsSync(kmkDir) && fs.statSync(kmkDir).isDirectory()
    }
  }

  // Windows: scan drive letters directly (most reliable)
  if (process.platform === 'win32') {
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const letter of letters) {
      const root = `${letter}:\\`
      try {
        const probed = probeRoot(root)
        if (
          probed.hasBootOut ||
          probed.hasSettings ||
          probed.hasCodePy ||
          (probed.hasLib && probed.hasKmk)
        ) {
          return root
        }
      } catch {
        // ignore inaccessible drives
      }
    }
  }

  try {
    const disks = await getDiskInfo()
    for (const disk of disks) {
      const mounted = normalizeRoot(disk.mounted)
      if (mounted.includes('CIRCUITPY')) {
        return mounted
      }
      try {
        if (fs.existsSync(path.join(mounted, 'boot_out.txt'))) {
          return mounted
        }
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error('Drive scan error:', e)
  }
  return null
}

async function buildScanDebug() {
  const triedRoots: string[] = []
  const candidates: Array<{
    root: string
    hasBootOut: boolean
    hasSettings: boolean
    hasCodePy: boolean
    hasLib: boolean
    hasKmk: boolean
  }> = []

  if (process.platform === 'win32') {
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const letter of letters) {
      const root = `${letter}:\\`
      triedRoots.push(root)
      try {
        const bootOut = fs.existsSync(path.join(root, 'boot_out.txt'))
        const settings = fs.existsSync(path.join(root, 'settings.toml'))
        const codePy = fs.existsSync(path.join(root, 'code.py'))
        const libDir = path.join(root, 'lib')
        const kmkDir = path.join(root, 'kmk')
        const hasLib = fs.existsSync(libDir) && fs.statSync(libDir).isDirectory()
        const hasKmk = fs.existsSync(kmkDir) && fs.statSync(kmkDir).isDirectory()
        if (bootOut || settings || codePy || (hasLib && hasKmk)) {
          candidates.push({
            root,
            hasBootOut: bootOut,
            hasSettings: settings,
            hasCodePy: codePy,
            hasLib,
            hasKmk
          })
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    platform: process.platform,
    triedRoots,
    candidates
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('scan-device', async (_, args?: { driveHint?: string }) => {
    const driveHint = args?.driveHint
    const debug = await buildScanDebug()

    const normalizeHint = (hint: string) => {
      const trimmed = hint.trim()
      if (!trimmed) return null
      if (process.platform === 'win32') {
        if (/^[A-Za-z]:$/.test(trimmed)) return `${trimmed}\\`
        if (/^[A-Za-z]:\\$/.test(trimmed)) return trimmed
      }
      return trimmed
    }

    const normalizedHint = typeof driveHint === 'string' ? normalizeHint(driveHint) : null
    let drive = normalizedHint
    if (drive) {
      try {
        if (!fs.existsSync(drive) || !fs.statSync(drive).isDirectory()) {
          drive = null
        }
      } catch {
        drive = null
      }
    }
    if (drive) {
      try {
        const bootOut = fs.existsSync(path.join(drive, 'boot_out.txt'))
        const settings = fs.existsSync(path.join(drive, 'settings.toml'))
        const codePy = fs.existsSync(path.join(drive, 'code.py'))
        const libDir = path.join(drive, 'lib')
        const kmkDir = path.join(drive, 'kmk')
        const hasLib = fs.existsSync(libDir) && fs.statSync(libDir).isDirectory()
        const hasKmk = fs.existsSync(kmkDir) && fs.statSync(kmkDir).isDirectory()
        if (!(bootOut || settings || codePy || (hasLib && hasKmk))) {
          drive = null
        }
      } catch {
        drive = null
      }
    }
    if (!drive) {
      drive = await findDevice()
    }

    if (drive) {
      console.log('[MaxPad] Found device drive:', drive)
      // Check if config exists
      const configPath = path.join(drive, CONFIG_FILE)
      let config: MaxPadConfig | null = null
      if (fs.existsSync(configPath)) {
        config = normalizeConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')))
      } else {
        // Maybe code.py exists but no config. Return empty or default.
        config = normalizeConfig(null)
      }
      return { connected: true, drive, config, debug }
    }
    console.log('[MaxPad] Device not found')
    return { connected: false, debug }
  })

  ipcMain.handle('save-config', async (_, { drive, config, initializePython }) => {
    try {
      if (initializePython) {
        fs.writeFileSync(path.join(drive, 'boot.py'), DEFAULT_BOOT_PYTHON_CODE)
        fs.writeFileSync(path.join(drive, 'code.py'), DEFAULT_PYTHON_CODE)
      }
      const normalized = normalizeConfig(config)
      fs.writeFileSync(path.join(drive, CONFIG_FILE), JSON.stringify(normalized, null, 2))
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}
