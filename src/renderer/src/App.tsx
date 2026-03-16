import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { Pad3D } from './components/Pad3D'
import {
  Layers,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Cpu,
  PencilLine,
  X,
  ChevronDown,
  ChevronRight,
  Search
} from 'lucide-react'
import {
  ACTION_CATEGORIES,
  ENCODER_SLOT_LABELS,
  getActionLabel,
  getActionByCode
} from './actions'

export default function App() {
  const {
    connected,
    drive,
    config,
    currentProfile,
    selectedKeyIndex,
    encoderSelected,
    activeEncoderSlot,
    dirty,
    telemetryConnected,
    liveScreenText,
    livePressed,
    setConnected,
    setConfig,
    markSaved,
    setCurrentProfile,
    setSelectedKeyIndex,
    setActiveEncoderSlot,
    updateKeyMap,
    updateEncoder,
    renameProfile,
    addProfile,
    removeProfile,
    setTelemetryConnected,
    applyTelemetry,
    clearTelemetry
  } = useStore()

  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [scanDebug, setScanDebug] = useState<{
    candidates?: { root: string; hasBootOut?: boolean; hasSettings?: boolean; hasCodePy?: boolean }[]
  } | null>(null)
  const [manualDrive, setManualDrive] = useState('D:\\')

  const [renamingIndex, setRenamingIndex] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [panelOpen, setPanelOpen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [actionSearch, setActionSearch] = useState('')

  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const pendingActionRef = useRef<null | (() => Promise<void> | void)>(null)
  const telemetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scanDrive = async (driveHint?: string) => {
    setScanning(true)
    try {
      if (!window.api || typeof window.api.scanDevice !== 'function') {
        setBridgeError('IPC bridge not available (preload not loaded).')
        setConnected(false, null)
        return
      }

      setBridgeError(null)
      const res = await window.api.scanDevice(driveHint ? { driveHint } : undefined)
      if (res?.debug) setScanDebug(res.debug)

      if (res.connected) {
        setConnected(true, res.drive)
        if (res.config) setConfig(res.config)
      } else {
        setConnected(false, null)
      }
    } catch (e: unknown) {
      setBridgeError(e instanceof Error ? e.message : String(e))
      setConnected(false, null)
    } finally {
      setScanning(false)
    }
  }

  const runWithUnsavedGuard = async (action: () => Promise<void> | void) => {
    if (!dirty) {
      await action()
      return
    }
    pendingActionRef.current = action
    setUnsavedModalOpen(true)
  }

  const saveConfig = async () => {
    if (!drive) return false

    setSaving(true)
    try {
      if (!window.api || typeof window.api.saveConfig !== 'function') {
        setBridgeError('IPC bridge not available (preload not loaded).')
        return false
      }

      setBridgeError(null)
      const res = await window.api.saveConfig({ drive, config, initializePython: true })
      if (res?.success) {
        markSaved()
        return true
      }
      return false
    } catch (e: unknown) {
      setBridgeError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    scanDrive()
  }, [])

  useEffect(() => {
    if (window.api && typeof window.api.setDirtyState === 'function') {
      window.api.setDirtyState(dirty)
    }
  }, [dirty])

  useEffect(() => {
    if (!window.api || typeof window.api.onTelemetry !== 'function') return
    const off = window.api.onTelemetry((payload) => {
      applyTelemetry(payload)
      setTelemetryConnected(true)

      if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current)
      telemetryTimeoutRef.current = setTimeout(() => {
        setTelemetryConnected(false)
      }, 3000)
    })

    return () => {
      if (telemetryTimeoutRef.current) {
        clearTimeout(telemetryTimeoutRef.current)
        telemetryTimeoutRef.current = null
      }
      off()
    }
  }, [applyTelemetry, setTelemetryConnected])

  useEffect(() => {
    if (!window.api || typeof window.api.onRequestCloseWithUnsaved !== 'function') return

    const off = window.api.onRequestCloseWithUnsaved(() => {
      pendingActionRef.current = null
      setUnsavedModalOpen(true)
    })

    return () => off()
  }, [])

  useEffect(() => {
    if (!connected) {
      clearTelemetry()
      return
    }

    if (!window.api || typeof window.api.startTelemetry !== 'function') return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const start = async () => {
      const res = await window.api.startTelemetry().catch(() => null)
      if (cancelled) return

      const success = !!res?.success
      setTelemetryConnected(success)

      if (!success) {
        retryTimer = setTimeout(start, 2500)
      }
    }

    start()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (telemetryTimeoutRef.current) {
        clearTimeout(telemetryTimeoutRef.current)
        telemetryTimeoutRef.current = null
      }
      if (window.api && typeof window.api.stopTelemetry === 'function') {
        window.api.stopTelemetry().catch(() => null)
      }
      clearTelemetry()
    }
  }, [connected, clearTelemetry, setTelemetryConnected])

  useEffect(() => {
    if ((selectedKeyIndex !== null || encoderSelected) && !panelOpen) {
      setPanelOpen(true)
    }
  }, [selectedKeyIndex, encoderSelected, panelOpen])

  const startRename = (idx: number) => {
    setRenamingIndex(idx)
    setRenameValue(config.profiles[idx]?.name || '')
  }

  const commitRename = () => {
    if (renamingIndex === null) return
    renameProfile(renamingIndex, renameValue)
    setRenamingIndex(null)
  }

  const cancelUnsavedModal = () => {
    pendingActionRef.current = null
    setUnsavedModalOpen(false)
    if (window.api?.respondClose) {
      window.api.respondClose('cancel').catch(() => null)
    }
  }

  const discardUnsavedModal = async () => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setUnsavedModalOpen(false)

    if (action) {
      await action()
      return
    }

    if (window.api?.respondClose) {
      await window.api.respondClose('discard')
    }
  }

  const saveUnsavedModal = async () => {
    const action = pendingActionRef.current
    const saved = await saveConfig()
    if (!saved) return

    pendingActionRef.current = null
    setUnsavedModalOpen(false)

    if (action) {
      await action()
      return
    }

    if (window.api?.respondClose) {
      await window.api.respondClose('save')
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {unsavedModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[520px] rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold">Unsaved changes</div>
                <div className="text-xs text-zinc-400 mt-1">
                  You have edits that are not saved to the MaxPad yet.
                </div>
              </div>
              <button
                type="button"
                onClick={cancelUnsavedModal}
                className="p-2 rounded hover:bg-zinc-800 text-zinc-300"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm"
                onClick={cancelUnsavedModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 text-sm"
                onClick={discardUnsavedModal}
              >
                Discard
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                onClick={saveUnsavedModal}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2">
            <Cpu className="text-indigo-500" /> MaxPad
          </div>
          <button
            type="button"
            onClick={() => runWithUnsavedGuard(() => scanDrive())}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
            disabled={scanning}
          >
            <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs uppercase text-zinc-500 font-bold mb-3">Status</div>

          {bridgeError && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded mb-3">
              {bridgeError}
            </div>
          )}

          {connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 p-2 rounded">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                Connected ({drive})
              </div>
              <div
                className={`flex items-center gap-2 text-xs p-2 rounded ${telemetryConnected ? 'text-cyan-300 bg-cyan-500/10' : 'text-zinc-400 bg-zinc-800/50'}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${telemetryConnected ? 'bg-cyan-300 animate-pulse' : 'bg-zinc-500'}`}
                ></div>
                {telemetryConnected ? 'Live telemetry active' : 'Waiting for live telemetry'}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    OLED Preview
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {livePressed.filter(Boolean).length} pressed
                  </div>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-950/80 p-2 font-mono text-[11px] leading-4 text-cyan-200">
                  {liveScreenText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-2 rounded">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                Not Found
              </div>

              <div className="text-xs text-zinc-400">
                If auto-detect fails, enter the CIRCUITPY drive (example:{' '}
                <span className="font-mono text-zinc-200">D:\\</span>)
              </div>

              <div className="flex gap-2">
                <input
                  value={manualDrive}
                  onChange={(e) => setManualDrive(e.target.value)}
                  className="flex-1 bg-black/40 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="D:\\"
                />
                <button
                  type="button"
                  onClick={() => runWithUnsavedGuard(() => scanDrive(manualDrive))}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold transition"
                  disabled={scanning}
                >
                  Connect
                </button>
              </div>

              {scanDebug?.candidates?.length ? (
                <div className="text-[11px] text-zinc-500 bg-zinc-950/40 border border-zinc-800 rounded p-2">
                  <div className="uppercase font-semibold text-[10px] text-zinc-400 mb-1">
                    Scan candidates
                  </div>
                  <div className="space-y-1">
                    {scanDebug.candidates.map((c) => (
                      <div key={c.root} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-zinc-300">{c.root}</span>
                        <span className="text-zinc-600">
                          {c.hasBootOut ? 'boot_out' : ''}
                          {c.hasSettings ? (c.hasBootOut ? ', settings' : 'settings') : ''}
                          {c.hasCodePy
                            ? c.hasBootOut || c.hasSettings
                              ? ', code.py'
                              : 'code.py'
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {dirty && (
            <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
              Unsaved changes
            </div>
          )}

          <div className="mt-8 mb-3 flex items-center justify-between">
            <div className="text-xs uppercase text-zinc-500 font-bold">Profiles</div>
            <button
              type="button"
              onClick={addProfile}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {config.profiles.map((profile, idx) => (
              <div
                key={`profile-${profile.name}-${idx}`}
                className={`group flex items-center justify-between p-2 rounded cursor-pointer transition ${currentProfile === idx ? 'bg-indigo-500 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
                role="button"
                tabIndex={0}
                onClick={() => setCurrentProfile(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCurrentProfile(idx)
                  }
                }}
                onDoubleClick={() => startRename(idx)}
              >
                <div className="flex items-center gap-2 text-sm truncate">
                  <Layers size={14} />
                  {renamingIndex === idx ? (
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingIndex(null)
                      }}
                      className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white font-semibold w-full"
                      autoFocus
                    />
                  ) : (
                    <span className="truncate">{profile.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(idx)
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded ${currentProfile === idx ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                    aria-label="Rename profile"
                  >
                    <PencilLine size={14} />
                  </button>
                  {config.profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeProfile(idx)
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1"
                      aria-label="Delete profile"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button
            type="button"
            disabled={!connected || saving}
            onClick={saveConfig}
            className={`w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-semibold flex items-center justify-center gap-2 transition ${dirty ? 'ring-2 ring-amber-400/40' : ''}`}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save to MaxPad'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950">
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div className="pointer-events-none">
            <h2 className="text-3xl font-black tracking-tight">
              {(config.profiles[currentProfile]?.name || 'Default') + ' profile'}
            </h2>
            <p className="text-zinc-400 text-sm mt-1">Select a key on the 3D model to configure</p>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 min-w-0 relative">
            <div className="absolute inset-0">
              <Pad3D />
            </div>
          </div>

          <div
            className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${panelOpen ? 'w-[340px]' : 'w-0'}`}
          >
            <div className="w-[340px] h-full border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase text-zinc-500 font-bold">Configure</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-1">
                    {encoderSelected
                      ? 'Rotary Encoder'
                      : selectedKeyIndex === null
                        ? 'No key selected'
                        : `Key ${selectedKeyIndex + 1}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(false)
                    setSelectedKeyIndex(null)
                  }}
                  className="p-2 rounded hover:bg-zinc-800 text-zinc-300"
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {!encoderSelected && selectedKeyIndex === null ? (
                <div className="text-sm text-zinc-400 border border-zinc-800 rounded-lg p-4 bg-black/20">
                  Click a key or the encoder on the 3D model to edit its assignment.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* === ENCODER SLOT TABS === */}
                  {encoderSelected && (
                    <div className="flex gap-1 bg-black/30 rounded-lg p-1">
                      {ENCODER_SLOT_LABELS.map((slotLabel, idx) => (
                        <button
                          type="button"
                          key={slotLabel}
                          onClick={() => setActiveEncoderSlot(idx)}
                          className={`flex-1 text-xs font-semibold py-2 rounded-md transition ${
                            activeEncoderSlot === idx
                              ? 'bg-indigo-600 text-white'
                              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {slotLabel}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* === CURRENT ACTION DISPLAY === */}
                  {(() => {
                    const currentCode = encoderSelected
                      ? config.profiles[currentProfile]?.encoder[activeEncoderSlot] || 'KC.NO'
                      : config.profiles[currentProfile]?.keys[selectedKeyIndex!] || 'KC.NO'
                    const currentAction = getActionByCode(currentCode)
                    const friendlyLabel = getActionLabel(currentCode)

                    return (
                      <div className="bg-black/30 rounded-lg border border-zinc-800/50 p-3">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5">
                          Current Action
                        </div>
                        <div className="text-sm font-semibold text-zinc-100">{friendlyLabel}</div>
                        {currentAction?.description && (
                          <div className="text-[11px] text-zinc-500 mt-1">
                            {currentAction.description}
                          </div>
                        )}

                        {/* More Info toggle */}
                        <button
                          type="button"
                          onClick={() => setShowCode((v) => !v)}
                          className="flex items-center gap-1 mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                        >
                          {showCode ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                          More Info
                        </button>
                        {showCode && (
                          <div className="mt-2 space-y-2">
                            <div className="font-mono text-[11px] text-zinc-400 bg-black/40 rounded px-2 py-1.5 select-text">
                              {currentCode}
                            </div>
                            <div>
                              <label
                                htmlFor="manual-code-input"
                                className="text-[10px] uppercase font-bold text-zinc-500 block mb-1"
                              >
                                Manual KMK Code
                              </label>
                              <input
                                id="manual-code-input"
                                type="text"
                                className="w-full bg-black/50 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                                value={currentCode}
                                onChange={(e) => {
                                  if (encoderSelected) {
                                    updateEncoder(activeEncoderSlot, e.target.value)
                                  } else {
                                    updateKeyMap(selectedKeyIndex!, e.target.value)
                                  }
                                }}
                                placeholder="e.g. KC.A, KC.LCTRL(KC.C)"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* === SEARCHABLE ACTIONS LIST === */}
                  <div>
                    <div className="relative mb-3">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                      />
                      <input
                        type="text"
                        className="w-full bg-black/40 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        placeholder="Search actions..."
                        value={actionSearch}
                        onChange={(e) => setActionSearch(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
                      {ACTION_CATEGORIES.map((cat) => {
                        const query = actionSearch.toLowerCase().trim()
                        const filtered = query
                          ? cat.actions.filter(
                              (a) =>
                                a.label.toLowerCase().includes(query) ||
                                a.code.toLowerCase().includes(query) ||
                                (a.shortLabel && a.shortLabel.toLowerCase().includes(query))
                            )
                          : cat.actions

                        if (filtered.length === 0) return null

                        const currentCode = encoderSelected
                          ? config.profiles[currentProfile]?.encoder[activeEncoderSlot] || 'KC.NO'
                          : config.profiles[currentProfile]?.keys[selectedKeyIndex!] || 'KC.NO'

                        return (
                          <div key={cat.name}>
                            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 px-1">
                              {cat.name}
                            </div>
                            <div className="grid gap-0.5">
                              {filtered.map((action) => {
                                const isActive = action.code === currentCode
                                return (
                                  <button
                                    type="button"
                                    key={action.code}
                                    className={`group flex items-center justify-between px-2 py-1.5 rounded text-left text-xs transition ${
                                      isActive
                                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                        : 'hover:bg-zinc-800 text-zinc-300 hover:text-white border border-transparent'
                                    }`}
                                    onClick={() => {
                                      if (encoderSelected) {
                                        updateEncoder(activeEncoderSlot, action.code)
                                      } else {
                                        updateKeyMap(selectedKeyIndex!, action.code)
                                      }
                                    }}
                                  >
                                    <span className="truncate">{action.label}</span>
                                    <span
                                      className={`ml-2 text-[10px] font-mono shrink-0 transition ${
                                        isActive
                                          ? 'text-indigo-400/60'
                                          : 'opacity-0 group-hover:opacity-100 text-zinc-500'
                                      }`}
                                    >
                                      {action.code.replace('KC.', '')}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
