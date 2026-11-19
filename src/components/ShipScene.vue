<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement | null>(null)

// Ship drifts at sea (START) and berths alongside the quay (BERTH).
const START = new THREE.Vector3(-3.5, 0, 3.2)
const BERTH = new THREE.Vector3(1.6, 0, -1.2)
const START_YAW = -Math.PI / 5
const BERTH_YAW = 0
const DOCK_MS = 3800

let renderer: THREE.WebGLRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let frame = 0
let dockStart: number | null = null
let dockResolve: (() => void) | null = null

const box = (w: number, h: number, d: number, color: number) =>
  new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 }),
  )

function buildShip(): THREE.Group {
  const ship = new THREE.Group()

  // Hull: extruded side profile with a pointed bow (+x).
  const profile = new THREE.Shape()
  profile.moveTo(-3, 0)
  profile.lineTo(2.6, 0)
  profile.quadraticCurveTo(3.6, 0.5, 3.6, 1)
  profile.lineTo(-3.2, 1)
  profile.lineTo(-3, 0)
  const hullGeo = new THREE.ExtrudeGeometry(profile, { depth: 1.6, bevelEnabled: false })
  hullGeo.translate(0, -0.45, -0.8)
  const hull = new THREE.Mesh(
    hullGeo,
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 }),
  )
  ship.add(hull)

  const waterline = box(6.6, 0.12, 1.62, 0xb91c1c)
  waterline.position.set(0.2, -0.38, 0)
  ship.add(waterline)

  const deck = box(6.6, 0.06, 1.5, 0xe2e8f0)
  deck.position.set(0.2, 0.56, 0)
  ship.add(deck)

  // Bridge / superstructure at the stern.
  const bridge = box(1, 1.1, 1.3, 0xf8fafc)
  bridge.position.set(-2.4, 1.1, 0)
  ship.add(bridge)
  const windows = box(1.02, 0.18, 1.32, 0x0f172a)
  windows.position.set(-2.4, 1.45, 0)
  ship.add(windows)
  const funnel = box(0.4, 0.6, 0.4, 0xf59e0b)
  funnel.position.set(-2.6, 1.95, 0)
  ship.add(funnel)

  // Container stacks.
  const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf97316, 0x14b8a6, 0xeab308]
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 2; z++) {
      for (let y = 0; y < 1 + ((x + z) % 3); y++) {
        const c = box(0.62, 0.32, 0.6, colors[(x * 3 + z + y) % colors.length] ?? 0xef4444)
        c.position.set(-1.5 + x * 0.68, 0.76 + y * 0.34, -0.33 + z * 0.66)
        ship.add(c)
      }
    }
  }
  return ship
}

function buildQuay(): THREE.Group {
  const quay = new THREE.Group()
  const pier = box(14, 0.8, 3, 0x94a3b8)
  pier.position.set(1, 0.1, -3.6)
  quay.add(pier)
  const edge = box(14, 0.12, 0.2, 0xfacc15)
  edge.position.set(1, 0.56, -2.15)
  quay.add(edge)
  for (let i = 0; i < 6; i++) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2937 }),
    )
    bollard.position.set(-4.5 + i * 2, 0.62, -2.4)
    quay.add(bollard)
  }
  // Quay crane.
  const crane = new THREE.Group()
  const legA = box(0.15, 3, 0.15, 0xdc2626)
  legA.position.set(0, 2, -2.6)
  const legB = legA.clone()
  legB.position.z = -4.2
  const boom = box(0.18, 0.18, 5, 0xdc2626)
  boom.position.set(0, 3.5, -1.8)
  crane.add(legA, legB, boom)
  crane.position.x = 3
  quay.add(crane)
  return quay
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** Animates the ship into its berth; resolves when docked. */
function berth(): Promise<void> {
  const el = container.value
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Panel hidden (mobile) or no WebGL: nothing to watch, don't delay navigation.
  if (!renderer || !el || el.offsetParent === null || reduced) return Promise.resolve()
  return new Promise((resolve) => {
    dockStart = performance.now()
    dockResolve = resolve
  })
}

defineExpose({ berth })

onMounted(() => {
  const el = container.value
  if (!el) return
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  } catch {
    return // WebGL unavailable: leave panel without the scene.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x1e40af, 14, 30)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(3, 7, 13)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0c4a6e, 1.4))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(5, 10, 6)
  scene.add(sun)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60, 60, 60),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
      flatShading: true,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.2
  scene.add(water)
  const waterPos = water.geometry.attributes.position as THREE.BufferAttribute

  scene.add(buildQuay())
  const ship = buildShip()
  ship.position.copy(START)
  ship.rotation.y = START_YAW
  scene.add(ship)

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = el
    if (!w || !h || !renderer) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  resize()

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    const t = now / 1000

    for (let i = 0; i < waterPos.count; i++) {
      const x = waterPos.getX(i)
      const y = waterPos.getY(i)
      waterPos.setZ(i, Math.sin(x * 0.6 + t * 1.5) * 0.08 + Math.cos(y * 0.5 + t) * 0.08)
    }
    waterPos.needsUpdate = true

    // 0 = at sea, 1 = berthed.
    let p = 0
    if (dockStart !== null) {
      const raw = Math.min((now - dockStart) / DOCK_MS, 1)
      p = easeInOut(raw)
      if (raw >= 1 && dockResolve) {
        dockResolve()
        dockResolve = null
      }
    }
    ship.position.lerpVectors(START, BERTH, p)
    ship.rotation.y = START_YAW + (BERTH_YAW - START_YAW) * p
    // Bobbing calms down as the ship comes alongside.
    const swell = 1 - p * 0.7
    ship.position.y = Math.sin(t * 1.6) * 0.08 * swell
    ship.rotation.z = Math.sin(t * 1.2) * 0.04 * swell
    ship.rotation.x = Math.cos(t * 1.4) * 0.03 * swell

    renderer?.render(scene, camera)
  }
  frame = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  dockResolve?.()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" aria-hidden="true" />
</template>
