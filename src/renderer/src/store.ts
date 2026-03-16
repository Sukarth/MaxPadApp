import { create } from 'zustand'

export type MaxPadProfile = {
  name: string
  keys: string[]
  encoder: string[]
}

export type MaxPadConfig = {
  profiles: MaxPadProfile[]
}

const DEFAULT_CONFIG: MaxPadConfig = {
  profiles: [{ name: 'Default', keys: new Array(12).fill('KC.NO'), encoder: ['KC.NO', 'KC.NO', 'KC.NO'] }],
}

function normalizeConfig(input: unknown): MaxPadConfig {
  const obj = input as Record<string, unknown> | null | undefined
  const rawProfiles = Array.isArray(obj?.profiles)
    ? obj.profiles
    : Array.isArray(obj?.layers)
      ? obj.layers
      : null

  if (!rawProfiles) return structuredClone(DEFAULT_CONFIG)

  const profiles: MaxPadProfile[] = rawProfiles.map((p: Record<string, unknown>, index: number) => {
    const keys = Array.isArray(p?.keys) ? p.keys.slice(0, 12) : []
    while (keys.length < 12) keys.push('KC.NO')

    const encoder = Array.isArray(p?.encoder) ? p.encoder.slice(0, 3) : []
    while (encoder.length < 3) encoder.push('KC.NO')

    return {
      name: typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : `Profile ${index + 1}`,
      keys,
      encoder,
    }
  })

  if (!profiles.length) return structuredClone(DEFAULT_CONFIG)
  return { profiles }
}

function serializeConfig(config: MaxPadConfig) {
  return JSON.stringify(config)
}

type Store = {
  connected: boolean
  drive: string | null
  config: MaxPadConfig
  currentProfile: number
  selectedKeyIndex: number | null
  encoderSelected: boolean
  activeEncoderSlot: number
  dirty: boolean
  lastSavedConfigJson: string
  liveScreenText: string
  livePressed: boolean[]
  telemetryConnected: boolean

  setConnected: (val: boolean, drive: string | null) => void
  setConfig: (config: unknown) => void
  markSaved: () => void

  setCurrentProfile: (profile: number) => void
  setSelectedKeyIndex: (index: number | null) => void
  setEncoderSelected: () => void
  setActiveEncoderSlot: (slot: number) => void
  updateKeyMap: (keyIndex: number, kc: string) => void
  updateEncoder: (encIndex: number, kc: string) => void
  renameProfile: (index: number, name: string) => void
  addProfile: () => void
  removeProfile: (index: number) => void
  setTelemetryConnected: (connected: boolean) => void
  applyTelemetry: (payload: Record<string, unknown>) => void
  clearTelemetry: () => void
}

export const useStore = create<Store>((set) => ({
  connected: false,
  drive: null,
  config: structuredClone(DEFAULT_CONFIG),
  currentProfile: 0,
  selectedKeyIndex: null,
  encoderSelected: false,
  activeEncoderSlot: 0,
  dirty: false,
  lastSavedConfigJson: serializeConfig(DEFAULT_CONFIG),
  liveScreenText: 'MAXPAD v1\nReady...',
  livePressed: new Array(12).fill(false),
  telemetryConnected: false,

  setConnected: (connected, drive) => set({ connected, drive }),
  setConfig: (config) => set(() => {
    const normalized = normalizeConfig(config)
    const serialized = serializeConfig(normalized)
    return { config: normalized, currentProfile: 0, selectedKeyIndex: null, encoderSelected: false, dirty: false, lastSavedConfigJson: serialized }
  }),
  markSaved: () => set((state) => ({ dirty: false, lastSavedConfigJson: serializeConfig(state.config) })),

  setCurrentProfile: (currentProfile) => set({ currentProfile, selectedKeyIndex: null, encoderSelected: false }),
  setSelectedKeyIndex: (index) => set({ selectedKeyIndex: index, encoderSelected: false }),
  setEncoderSelected: () => set({ encoderSelected: true, selectedKeyIndex: null, activeEncoderSlot: 0 }),
  setActiveEncoderSlot: (slot) => set({ activeEncoderSlot: slot }),
  updateKeyMap: (index, kc) => set((state) => {
    const profiles = state.config.profiles.map((p, i) =>
      i === state.currentProfile ? { ...p, keys: p.keys.map((k, ki) => (ki === index ? kc : k)) } : p
    )
    return { config: { profiles }, dirty: true }
  }),
  updateEncoder: (encIndex, kc) => set((state) => {
    const profiles = state.config.profiles.map((p, i) =>
      i === state.currentProfile ? { ...p, encoder: p.encoder.map((e, ei) => (ei === encIndex ? kc : e)) } : p
    )
    return { config: { profiles }, dirty: true }
  }),
  renameProfile: (index, name) => set((state) => {
    const nextName = name.trim()
    if (!nextName) return state
    const profiles = state.config.profiles.map((p, i) => (i === index ? { ...p, name: nextName } : p))
    return { config: { profiles }, dirty: true }
  }),
  addProfile: () => set((state) => {
    const nextIndex = state.config.profiles.length + 1
    const profiles = state.config.profiles.concat({
      name: `Profile ${nextIndex}`,
      keys: new Array(12).fill('KC.NO'),
      encoder: ['KC.NO', 'KC.NO', 'KC.NO'],
    })
    return { config: { profiles }, currentProfile: profiles.length - 1, selectedKeyIndex: null, dirty: true }
  }),
  removeProfile: (index) => set((state) => {
    if (state.config.profiles.length <= 1) return state
    const profiles = state.config.profiles.filter((_, i) => i !== index)
    return { config: { profiles }, currentProfile: 0, selectedKeyIndex: null, dirty: true }
  }),
  setTelemetryConnected: (telemetryConnected) => set({ telemetryConnected }),
  applyTelemetry: (payload) => set((state) => {
    const nextPressed = Array.isArray(payload?.pressed) ? payload.pressed.slice(0, 12).map((v: unknown) => !!v) : state.livePressed
    while (nextPressed.length < 12) nextPressed.push(false)

    const screen = typeof payload?.screen === 'string' && payload.screen.trim() ? payload.screen : state.liveScreenText
    const rawProfile = payload?.active_profile
    const activeProfile = typeof rawProfile === 'number' && Number.isInteger(rawProfile) ? rawProfile : state.currentProfile

    return {
      livePressed: nextPressed,
      liveScreenText: screen,
      currentProfile: activeProfile >= 0 && activeProfile < state.config.profiles.length ? activeProfile : state.currentProfile,
    }
  }),
  clearTelemetry: () => set({ livePressed: new Array(12).fill(false), telemetryConnected: false })
}))
