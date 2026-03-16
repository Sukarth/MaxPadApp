import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, RoundedBox, Text, OrbitControls } from '@react-three/drei'
import { useStore } from '../store'
import { getActionShortLabel } from '../actions'
import * as THREE from 'three'
import { ZoomIn, ZoomOut, LocateFixed } from 'lucide-react'

interface KeyProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  index: number
  label?: string
}

const PAD3D_DEFAULT_VIEW_STORAGE_KEY = 'maxpad.pad3d.defaultView.v1'

type StoredPad3DView = {
  cameraPosition: [number, number, number]
  target: [number, number, number]
}

function parseStoredView(value: string | null): StoredPad3DView | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<StoredPad3DView>
    const cameraPosition = parsed.cameraPosition
    const target = parsed.target
    if (!Array.isArray(cameraPosition) || cameraPosition.length !== 3) return null
    if (!Array.isArray(target) || target.length !== 3) return null
    if (cameraPosition.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null
    if (target.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null
    return { cameraPosition: cameraPosition as StoredPad3DView['cameraPosition'], target: target as StoredPad3DView['target'] }
  } catch {
    return null
  }
}

const keyLayout: Array<{ position: [number, number, number] }> = (() => {
  const y = 0.225
  const pitchX = 1.1
  const x5 = [-2 * pitchX, -1 * pitchX, 0, 1 * pitchX, 2 * pitchX]
  const row1Z = -0.65
  const row2Z = 0.65
  const row3Z = 1.95

  // Slightly wider on the bottom pair so the knob has breathing room.
  const bottomX = 1.5

  const positions: [number, number, number][] = [
    ...x5.map((x) => [x, y, row1Z] as [number, number, number]),
    ...x5.map((x) => [x, y, row2Z] as [number, number, number]),
    [-bottomX, y, row3Z],
    [bottomX, y, row3Z]
  ]

  return positions.map((position) => ({ position }))
})()

function Pad3DControlsPersistence({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree()

  useEffect(() => {
    let rafId = 0

    const apply = () => {
      const controls = controlsRef.current
      if (!controls) {
        rafId = window.requestAnimationFrame(apply)
        return
      }

      const perspectiveCamera = camera as THREE.PerspectiveCamera
      perspectiveCamera.up.set(0, 1, 0)
      perspectiveCamera.near = 0.1
      perspectiveCamera.far = 250
      perspectiveCamera.updateProjectionMatrix()

      const stored = parseStoredView(window.localStorage.getItem(PAD3D_DEFAULT_VIEW_STORAGE_KEY))
      if (stored) {
        perspectiveCamera.position.set(...stored.cameraPosition)
        controls.target.set(...stored.target)
        controls.update()
      }
    }

    apply()

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [camera, controlsRef])

  return null
}

function applyStoredOrFallbackView(controls: any, fallback: StoredPad3DView) {
  const camera = controls?.object as THREE.PerspectiveCamera | undefined
  if (!controls || !camera) return

  const stored = parseStoredView(window.localStorage.getItem(PAD3D_DEFAULT_VIEW_STORAGE_KEY))
  const view = stored || fallback

  camera.up.set(0, 1, 0)
  camera.position.set(...view.cameraPosition)
  controls.target.set(...view.target)
  camera.lookAt(controls.target)
  controls.update?.()
}

function keyLabel(value: string | undefined, index: number) {
  const raw = (value || '').trim()
  if (!raw || raw === 'KC.NO') return `M${index + 1}`
  return getActionShortLabel(raw, index)
}

function KeySwitch({ position, rotation = [0, 0, 0], index, label = '' }: KeyProps) {
  const { selectedKeyIndex, setSelectedKeyIndex, livePressed } = useStore()
  const capRef = useRef<THREE.Mesh>(null)
  const isSelected = selectedKeyIndex === index
  const isLivePressed = !!livePressed[index]

  useFrame(() => {
    if (!capRef.current) return
    const targetY = isLivePressed ? 0.39 : isSelected ? 0.44 : 0.5
    capRef.current.position.y = THREE.MathUtils.lerp(capRef.current.position.y, targetY, 0.18)
  })

  const labelText = keyLabel(label, index)

  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.94, 0.16, 0.94]} radius={0.08} smoothness={4} position={[0, 0.19, 0]}>
        <meshStandardMaterial color="#0f172a" roughness={0.92} metalness={0.15} />
      </RoundedBox>

      <RoundedBox
        ref={capRef as never}
        args={[0.86, 0.44, 0.86]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.5, 0]}
        onClick={(event) => {
          event.stopPropagation()
          setSelectedKeyIndex(index)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <meshStandardMaterial
          color={isLivePressed ? '#22c55e' : isSelected ? '#f5c84c' : '#f6f7fb'}
          emissive={isLivePressed ? '#14532d' : isSelected ? '#7c4a03' : '#000000'}
          emissiveIntensity={isLivePressed ? 0.5 : isSelected ? 0.22 : 0}
          roughness={0.18}
          metalness={0.08}
        />
      </RoundedBox>

      <Text
        position={[0, 0.77, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        maxWidth={0.7}
        lineHeight={1}
        color={isLivePressed || isSelected ? '#ffffff' : '#1f2937'}
        anchorX="center"
        anchorY="middle"
      >
        {labelText}
      </Text>
    </group>
  )
}

function EncoderKnob({ position }: { position: [number, number, number] }) {
  const { encoderSelected, setEncoderSelected } = useStore()
  const ridgeCount = 32
  const ridges = useMemo(
    () => Array.from({ length: ridgeCount }, (_, i) => (i / ridgeCount) * Math.PI * 2),
    []
  )

  const knobColor = encoderSelected ? '#f5c84c' : '#1c2333'
  const knobEmissive = encoderSelected ? '#7c4a03' : '#000000'
  const emissiveIntensity = encoderSelected ? 0.22 : 0

  return (
    <group position={position}>
      {/* Mounting base */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.44, 0.48, 0.18, 32]} />
        <meshStandardMaterial color="#0b1220" roughness={0.85} metalness={0.25} />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.2, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Knob body - clickable */}
      <mesh
        position={[0, 0.62, 0]}
        onClick={(event) => {
          event.stopPropagation()
          setEncoderSelected()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[0.52, 0.54, 0.7, 48]} />
        <meshStandardMaterial
          color={knobColor}
          roughness={0.38}
          metalness={0.65}
          emissive={knobEmissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Top cap - also clickable */}
      <mesh
        position={[0, 0.98, 0]}
        onClick={(event) => {
          event.stopPropagation()
          setEncoderSelected()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[0.48, 0.52, 0.04, 48]} />
        <meshStandardMaterial
          color={knobColor}
          roughness={0.32}
          metalness={0.68}
          emissive={knobEmissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Knurling ridges around the knob */}
      {ridges.map((angle) => (
        <mesh
          key={`ridge-${angle.toFixed(3)}`}
          position={[Math.cos(angle) * 0.555, 0.62, Math.sin(angle) * 0.555]}
          rotation={[0, -angle, 0]}
        >
          <boxGeometry args={[0.025, 0.6, 0.04]} />
          <meshStandardMaterial color="#2d3748" metalness={0.82} roughness={0.2} />
        </mesh>
      ))}

      {/* Position indicator line on top */}
      <mesh position={[0.25, 1.01, 0]}>
        <boxGeometry args={[0.18, 0.015, 0.03]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  )
}

function XiaoBoard() {
  const pins = useMemo(() => Array.from({ length: 7 }, (_, i) => -0.6 + i * 0.2), [])

  return (
    <group position={[-1.8, 0.425, -2.2]}>
      {/* PCB - vertical mount (long side along Z, USB-C toward top edge) */}
      <RoundedBox args={[0.92, 0.18, 1.62]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#10b981" roughness={0.65} metalness={0.08} />
      </RoundedBox>

      {/* USB-C connector - protruding beyond top case edge */}
      <RoundedBox args={[0.36, 0.1, 0.34]} radius={0.04} smoothness={4} position={[0, 0.01, -0.96]}>
        <meshStandardMaterial color="#9ca3af" roughness={0.2} metalness={0.85} />
      </RoundedBox>

      {/* USB-C port opening */}
      <mesh position={[0, 0.07, -1.02]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.06]} />
        <meshStandardMaterial color="#1f2937" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Main MCU chip */}
      <RoundedBox args={[0.4, 0.08, 0.4]} radius={0.03} smoothness={4} position={[0, 0.13, -0.15]}>
        <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.55} />
      </RoundedBox>

      {/* Small component */}
      <RoundedBox
        args={[0.18, 0.06, 0.14]}
        radius={0.02}
        smoothness={4}
        position={[-0.22, 0.13, 0.35]}
      >
        <meshStandardMaterial color="#1f2937" roughness={0.38} metalness={0.58} />
      </RoundedBox>

      {/* Reset button */}
      <mesh position={[0.28, 0.13, 0.5]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Pins - left side */}
      {pins.map((z) => (
        <mesh key={`left-${z}`} position={[-0.44, -0.05, z]}>
          <boxGeometry args={[0.08, 0.05, 0.08]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}

      {/* Pins - right side */}
      {pins.map((z) => (
        <mesh key={`right-${z}`} position={[0.44, -0.05, z]}>
          <boxGeometry args={[0.08, 0.05, 0.08]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}

      {/* Label */}
      <Text
        position={[0, 0.14, 0.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.09}
        color="#d1fae5"
        anchorX="center"
        anchorY="middle"
      >
        XIAO RP2040
      </Text>
    </group>
  )
}

function OledDisplay({ text }: { text: string }) {
  const lines = useMemo(() => {
    const sanitized = (text || '').replace(/\0/g, '').replace(/\r/g, '')
    return sanitized.split('\n').slice(0, 2)
  }, [text])

  return (
    <group position={[1.8, 0.415, -2.2]}>
      {/* Blue PCB board */}
      <RoundedBox args={[2.24, 0.16, 1.0]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#1d4ed8" roughness={0.6} metalness={0.1} />
      </RoundedBox>

      {/* Screen bezel */}
      <RoundedBox args={[1.9, 0.06, 0.7]} radius={0.04} smoothness={4} position={[0, 0.09, 0]}>
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.3} />
      </RoundedBox>

      {/* Screen surface with subtle blue glow */}
      <RoundedBox args={[1.78, 0.04, 0.58]} radius={0.03} smoothness={4} position={[0, 0.12, 0]}>
        <meshStandardMaterial
          color="#020617"
          roughness={0.08}
          metalness={0.75}
          emissive="#082f49"
          emissiveIntensity={0.3}
        />
      </RoundedBox>

      {/* Live text on screen */}
      <Text
        position={[0, 0.156, 0.01]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.1}
        maxWidth={1.55}
        lineHeight={1.15}
        color="#7dd3fc"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        renderOrder={10}
        material-depthTest={false}
        material-depthWrite={false}
      >
        {lines.join('\n') || 'MAXPAD'}
      </Text>

      {/* Mounting holes (4 corners of PCB) */}
      {(
        [
          [-0.98, 0.09, -0.4],
          [0.98, 0.09, -0.4],
          [-0.98, 0.09, 0.4],
          [0.98, 0.09, 0.4]
        ] as [number, number, number][]
      ).map(([hx, hy, hz]) => (
        <mesh key={`oled-${hx}-${hz}`} position={[hx, hy, hz]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.07, 12]} />
          <meshStandardMaterial color="#1e40af" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function MacropadBody({ liveScreenText, keys }: { liveScreenText: string; keys: string[] }) {
  return (
    <Float speed={0} rotationIntensity={0} floatIntensity={0}>
      <group position={[0, -0.95, 0]} rotation={[0, 0, 0]}>
        <RoundedBox args={[7.6, 0.95, 6.9]} radius={0.34} smoothness={6} position={[0, -0.18, 0]}>
          <meshStandardMaterial color="#1d4ed8" roughness={0.88} metalness={0.08} />
        </RoundedBox>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.335, 0]}>
          <ringGeometry args={[2.65, 2.92, 64]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.75} metalness={0.12} transparent />
        </mesh>

        <XiaoBoard />
        <OledDisplay text={liveScreenText} />

        <EncoderKnob position={[0, 0.065, 2.08]} />

        {keyLayout.map((item, index) => (
          <KeySwitch
            key={`${item.position.join('-')}-${index}`}
            index={index}
            position={item.position}
            label={keys[index]}
          />
        ))}
      </group>
    </Float>
  )
}

export function Pad3D() {
  const { config, currentProfile, liveScreenText } = useStore()
  const keys = config?.profiles[currentProfile]?.keys || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)

  const fallbackView = useMemo<StoredPad3DView>(
    () => ({ cameraPosition: [0, 5.2, 7.1], target: [0, -0.5, 0] }),
    []
  )

  const initialTarget = useMemo(() => new THREE.Vector3(0, -0.5, 0), [])

  const zoomIn = () => {
    const controls = controlsRef.current
    if (!controls) return
    controls.dollyIn(1.2)
    controls.update()
  }

  const zoomOut = () => {
    const controls = controlsRef.current
    if (!controls) return
    controls.dollyOut(1.2)
    controls.update()
  }

  const resetView = () => {
    const controls = controlsRef.current
    if (!controls) return
    applyStoredOrFallbackView(controls, fallbackView)
  }

  const setDefaultView = () => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera

    camera.up.set(0, 1, 0)
    camera.updateProjectionMatrix()
    controls.update()

    const payload: StoredPad3DView = {
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z]
    }

    window.localStorage.setItem(PAD3D_DEFAULT_VIEW_STORAGE_KEY, JSON.stringify(payload))
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={zoomIn}
          className="rounded border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-200 transition hover:bg-zinc-800"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="rounded border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-200 transition hover:bg-zinc-800"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-200 transition hover:bg-zinc-800"
          aria-label="Reset view"
        >
          <LocateFixed size={16} />
        </button>

        <button
          type="button"
          onClick={setDefaultView}
          className="rounded border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          aria-label="Set default view"
        >
          Set default
        </button>
      </div>

      {/*
       * === CAMERA & ZOOM SETTINGS ===
       * position: [x, y, z] - default camera position (higher y = more overhead, higher z = further back)
       * fov: field of view in degrees (lower = more zoomed in, higher = wider angle)
       */}
      <Canvas camera={{ position: [0, 5.2, 7.1], fov: 33 }}>
        <color attach="background" args={['#09090b']} />
        <fog attach="fog" args={['#09090b', 30, 90]} />
        <ambientLight intensity={0.95} />
        <hemisphereLight intensity={0.55} color="#e5e7eb" groundColor="#020617" />
        <directionalLight position={[8, 9, 6]} intensity={1.65} color="#ffffff" />
        <directionalLight position={[-5, 4, -3]} intensity={0.45} color="#93c5fd" />
        <pointLight position={[2, 2.5, -2]} intensity={0.5} color="#67e8f9" />

        <MacropadBody liveScreenText={liveScreenText} keys={keys} />

        <Pad3DControlsPersistence controlsRef={controlsRef} />

        {/*
         * === ORBIT / ZOOM / ROTATION LIMITS ===
         * minDistance / maxDistance: zoom in/out limits (scroll wheel range)
         * minPolarAngle / maxPolarAngle: vertical rotation limits (radians, 0 = top-down, PI/2 = horizon)
         * target: [x, y, z] - the point the camera orbits around
         * dampingFactor: orbit smoothness (lower = smoother)
         */}
        <OrbitControls
          ref={controlsRef as any}
          enablePan
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.75}
          zoomSpeed={0.75}
          panSpeed={0.9}
          screenSpacePanning
          minDistance={3.8}
          maxDistance={45}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={initialTarget}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.DOLLY }}
        />
      </Canvas>
    </div>
  )
}
