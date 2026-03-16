export type ActionDef = {
  code: string
  label: string
  shortLabel?: string
  description?: string
}

export type ActionCategory = {
  name: string
  actions: ActionDef[]
}

export const ACTION_CATEGORIES: ActionCategory[] = [
  {
    name: 'MaxPad',
    actions: [
      {
        code: 'KC.NEXT_PROFILE',
        label: 'Next Profile',
        shortLabel: 'NEXT PRF',
        description: 'Cycle to the next profile (wraps around)'
      },
      {
        code: 'KC.PREV_PROFILE',
        label: 'Previous Profile',
        shortLabel: 'PREV PRF',
        description: 'Cycle to the previous profile (wraps around)'
      }
    ]
  },
  {
    name: 'Media',
    actions: [
      { code: 'KC.MPLY', label: 'Play / Pause', shortLabel: 'PLAY' },
      { code: 'KC.MNXT', label: 'Next Track', shortLabel: 'NEXT' },
      { code: 'KC.MPRV', label: 'Previous Track', shortLabel: 'PREV' },
      { code: 'KC.VOLU', label: 'Volume Up', shortLabel: 'VOL+' },
      { code: 'KC.VOLD', label: 'Volume Down', shortLabel: 'VOL-' },
      { code: 'KC.MUTE', label: 'Mute', shortLabel: 'MUTE' },
      { code: 'KC.MSTP', label: 'Stop', shortLabel: 'STOP' }
    ]
  },
  {
    name: 'Common Shortcuts',
    actions: [
      { code: 'KC.LCTRL(KC.C)', label: 'Copy', shortLabel: 'COPY' },
      { code: 'KC.LCTRL(KC.V)', label: 'Paste', shortLabel: 'PASTE' },
      { code: 'KC.LCTRL(KC.X)', label: 'Cut', shortLabel: 'CUT' },
      { code: 'KC.LCTRL(KC.Z)', label: 'Undo', shortLabel: 'UNDO' },
      { code: 'KC.LCTRL(KC.Y)', label: 'Redo', shortLabel: 'REDO' },
      { code: 'KC.LCTRL(KC.A)', label: 'Select All', shortLabel: 'SEL ALL' },
      { code: 'KC.LCTRL(KC.S)', label: 'Save', shortLabel: 'SAVE' },
      { code: 'KC.LCTRL(KC.F)', label: 'Find', shortLabel: 'FIND' },
      { code: 'KC.LCTRL(KC.P)', label: 'Print', shortLabel: 'PRINT' },
      { code: 'KC.LCTRL(KC.N)', label: 'New Window', shortLabel: 'NEW' },
      { code: 'KC.LCTRL(KC.T)', label: 'New Tab', shortLabel: 'NEW TAB' },
      { code: 'KC.LCTRL(KC.W)', label: 'Close Tab', shortLabel: 'CLS TAB' },
      {
        code: 'KC.LCTRL(KC.LSFT(KC.T))',
        label: 'Reopen Closed Tab',
        shortLabel: 'REOPEN'
      },
      { code: 'KC.LALT(KC.F4)', label: 'Close Window', shortLabel: 'ALT+F4' },
      { code: 'KC.LGUI(KC.D)', label: 'Show Desktop', shortLabel: 'DESK' },
      { code: 'KC.LGUI(KC.L)', label: 'Lock Screen', shortLabel: 'LOCK' },
      { code: 'KC.LGUI(KC.E)', label: 'File Explorer', shortLabel: 'FILES' },
      { code: 'KC.LALT(KC.TAB)', label: 'Switch Window', shortLabel: 'ALT TAB' },
      { code: 'KC.LCTRL(KC.TAB)', label: 'Next Tab', shortLabel: 'NXT TAB' },
      {
        code: 'KC.LCTRL(KC.LSFT(KC.TAB))',
        label: 'Previous Tab',
        shortLabel: 'PRV TAB'
      },
      {
        code: 'KC.LCTRL(KC.LSFT(KC.ESC))',
        label: 'Task Manager',
        shortLabel: 'TSKMGR'
      },
      { code: 'KC.LGUI(KC.TAB)', label: 'Task View', shortLabel: 'TASKV' }
    ]
  },
  {
    name: 'Editing',
    actions: [
      { code: 'KC.BSPC', label: 'Backspace', shortLabel: 'BKSPC' },
      { code: 'KC.DEL', label: 'Delete', shortLabel: 'DEL' },
      { code: 'KC.ENTER', label: 'Enter', shortLabel: 'ENTER' },
      { code: 'KC.TAB', label: 'Tab', shortLabel: 'TAB' },
      { code: 'KC.ESC', label: 'Escape', shortLabel: 'ESC' },
      { code: 'KC.SPC', label: 'Space', shortLabel: 'SPACE' }
    ]
  },
  {
    name: 'Navigation',
    actions: [
      { code: 'KC.UP', label: 'Up Arrow', shortLabel: 'UP' },
      { code: 'KC.DOWN', label: 'Down Arrow', shortLabel: 'DOWN' },
      { code: 'KC.LEFT', label: 'Left Arrow', shortLabel: 'LEFT' },
      { code: 'KC.RIGHT', label: 'Right Arrow', shortLabel: 'RIGHT' },
      { code: 'KC.HOME', label: 'Home', shortLabel: 'HOME' },
      { code: 'KC.END', label: 'End', shortLabel: 'END' },
      { code: 'KC.PGUP', label: 'Page Up', shortLabel: 'PG UP' },
      { code: 'KC.PGDN', label: 'Page Down', shortLabel: 'PG DN' }
    ]
  },
  {
    name: 'Function Keys',
    actions: Array.from({ length: 12 }, (_, i) => ({
      code: `KC.F${i + 1}`,
      label: `F${i + 1}`,
      shortLabel: `F${i + 1}`
    }))
  },
  {
    name: 'Mouse',
    actions: [
      { code: 'KC.MB_LMB', label: 'Left Click', shortLabel: 'L CLK' },
      { code: 'KC.MB_RMB', label: 'Right Click', shortLabel: 'R CLK' },
      { code: 'KC.MB_MMB', label: 'Middle Click', shortLabel: 'M CLK' },
      { code: 'KC.MW_UP', label: 'Scroll Up', shortLabel: 'SCR UP' },
      { code: 'KC.MW_DN', label: 'Scroll Down', shortLabel: 'SCR DN' }
    ]
  },
  {
    name: 'System',
    actions: [
      { code: 'KC.PSCR', label: 'Print Screen', shortLabel: 'PRTSC' },
      { code: 'KC.INS', label: 'Insert', shortLabel: 'INS' },
      { code: 'KC.CAPS', label: 'Caps Lock', shortLabel: 'CAPS' },
      { code: 'KC.NLCK', label: 'Num Lock', shortLabel: 'NUMLK' },
      { code: 'KC.SLCK', label: 'Scroll Lock', shortLabel: 'SCRLK' },
      { code: 'KC.PAUS', label: 'Pause', shortLabel: 'PAUSE' }
    ]
  },
  {
    name: 'Modifiers',
    actions: [
      { code: 'KC.LCTL', label: 'Left Ctrl', shortLabel: 'L CTRL' },
      { code: 'KC.LSFT', label: 'Left Shift', shortLabel: 'L SHFT' },
      { code: 'KC.LALT', label: 'Left Alt', shortLabel: 'L ALT' },
      { code: 'KC.LGUI', label: 'Left Win', shortLabel: 'L WIN' },
      { code: 'KC.RCTL', label: 'Right Ctrl', shortLabel: 'R CTRL' },
      { code: 'KC.RSFT', label: 'Right Shift', shortLabel: 'R SHFT' },
      { code: 'KC.RALT', label: 'Right Alt', shortLabel: 'R ALT' },
      { code: 'KC.RGUI', label: 'Right Win', shortLabel: 'R WIN' }
    ]
  },
  {
    name: 'Letters',
    actions: Array.from({ length: 26 }, (_, i) => {
      const ch = String.fromCharCode(65 + i)
      return { code: `KC.${ch}`, label: ch, shortLabel: ch }
    })
  },
  {
    name: 'Numbers',
    actions: Array.from({ length: 10 }, (_, i) => ({
      code: `KC.N${i}`,
      label: `${i}`,
      shortLabel: `${i}`
    }))
  },
  {
    name: 'Disabled',
    actions: [
      { code: 'KC.NO', label: 'No Action', shortLabel: 'OFF', description: 'Key does nothing' },
      {
        code: 'KC.TRNS',
        label: 'Transparent',
        shortLabel: 'TRNS',
        description: 'Falls through to the layer below'
      }
    ]
  }
]

// Build a reverse lookup: code -> ActionDef
const CODE_MAP = new Map<string, ActionDef>()
for (const cat of ACTION_CATEGORIES) {
  for (const a of cat.actions) {
    CODE_MAP.set(a.code, a)
  }
}

export function getActionByCode(code: string): ActionDef | undefined {
  return CODE_MAP.get(code)
}

/** Full friendly label for panel / UI display */
export function getActionLabel(code: string): string {
  const action = CODE_MAP.get(code)
  if (action) return action.label
  const raw = (code || '').trim()
  if (!raw || raw === 'KC.NO') return 'No Action'
  // Fallback: basic parsing for codes not in the list
  return raw
    .replace(/^KC\./, '')
    .replace(/^LCTRL\(KC\.(.+)\)$/, 'Ctrl+$1')
    .replace(/^LSFT\(KC\.(.+)\)$/, 'Shift+$1')
    .replace(/^LALT\(KC\.(.+)\)$/, 'Alt+$1')
    .replace(/^LGUI\(KC\.(.+)\)$/, 'Win+$1')
}

/** Short label for 3D key cap display */
export function getActionShortLabel(code: string, fallbackIndex?: number): string {
  const action = CODE_MAP.get(code)
  if (action?.shortLabel) return action.shortLabel
  if (action) return action.label
  const raw = (code || '').trim()
  if (!raw || raw === 'KC.NO')
    return fallbackIndex !== undefined ? `M${fallbackIndex + 1}` : 'OFF'
  return raw
    .replace(/^KC\./, '')
    .replace(/^LCTRL\(KC\.(.+)\)$/, 'C+$1')
    .replace(/^LSFT\(KC\.(.+)\)$/, 'S+$1')
    .replace(/^LALT\(KC\.(.+)\)$/, 'A+$1')
    .replace(/^LGUI\(KC\.(.+)\)$/, 'W+$1')
}

/** Encoder slot labels */
export const ENCODER_SLOT_LABELS = ['Turn Left', 'Turn Right', 'Press'] as const
