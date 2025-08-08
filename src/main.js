import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { connectUnconfirmedTxs } from './data/blockchainInfoWS.js';
import { generateSampleNodes, computeCountryBackdrops } from './geo/sampleNodes.js';
import { COUNTRIES } from './geo/countries.js';

const canvas = document.getElementById('scene');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 140, 420);
scene.add(camera);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.75);
dir.position.set(50, 100, 50);
scene.add(dir);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 20;
controls.maxDistance = 400;

// Geo-clustered node distribution
const nodeData = generateSampleNodes();
const nodes = [];

const nodeGeom = new THREE.SphereGeometry(1.1, 16, 16);
const nodeMat = new THREE.MeshStandardMaterial({ color: 0xf7931a, emissive: 0x2a1200, metalness: 0.2, roughness: 0.4 });
const nodeGroup = new THREE.Group();

for (const n of nodeData) {
  const mesh = new THREE.Mesh(nodeGeom, nodeMat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.userData.country = n.country;
  nodes.push(mesh.position.clone());
  nodeGroup.add(mesh);
}
scene.add(nodeGroup);

// Country backdrops under clusters (canvas textures with country codes)
const backdropGroup = new THREE.Group();
function makeBackdropTexture(code, sizePx = 256) {
  const c = document.createElement('canvas');
  c.width = sizePx;
  c.height = sizePx;
  const ctx = c.getContext('2d');
  // background color per country hash
  const h = Array.from(code).reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const hue = h % 360;
  ctx.fillStyle = `hsla(${hue},70%,20%,0.5)`;
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.strokeStyle = `hsla(${hue},80%,60%,0.8)`;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, sizePx - 10, sizePx - 10);
  ctx.fillStyle = 'white';
  ctx.font = `${Math.floor(sizePx * 0.28)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = COUNTRIES[code]?.name || code;
  ctx.fillText(code, sizePx / 2, sizePx * 0.42);
  ctx.font = `${Math.floor(sizePx * 0.10)}px sans-serif`;
  ctx.fillText(name, sizePx / 2, sizePx * 0.7);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const backdrops = computeCountryBackdrops(nodeData);
for (const b of backdrops) {
  const tex = makeBackdropTexture(b.country);
  const geo = new THREE.PlaneGeometry(b.size, b.size);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(b.x, -2.5, b.z);
  plane.rotation.x = -Math.PI / 2; // lay flat on XZ
  plane.renderOrder = 0;
  backdropGroup.add(plane);
}
scene.add(backdropGroup);

// Edges as line segments (prefer within-country connections)
const connectionsPerNode = 2;
const edgePositions = [];
const nodeCount = nodeData.length;
for (let i = 0; i < nodeCount; i++) {
  const connected = new Set();
  const ci = nodeGroup.children[i].userData.country;
  while (connected.size < connectionsPerNode) {
    // 70% chance connect within same country
    let j;
    if (Math.random() < 0.7) {
      const same = nodeGroup.children
        .map((m, idx) => ({ idx, c: m.userData.country }))
        .filter(o => o.c === ci && o.idx !== i);
      if (same.length === 0) continue;
      j = same[Math.floor(Math.random() * same.length)].idx;
    } else {
      j = Math.floor(Math.random() * nodeCount);
      if (j === i) continue;
    }
    if (connected.has(j)) continue;
    connected.add(j);
    edgePositions.push(nodes[i].x, nodes[i].y, nodes[i].z);
    edgePositions.push(nodes[j].x, nodes[j].y, nodes[j].z);
  }
}

const edgeGeom = new THREE.BufferGeometry();
edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
const edgeMat = new THREE.LineBasicMaterial({ color: 0x425a75, transparent: true, opacity: 0.5 });
const edges = new THREE.LineSegments(edgeGeom, edgeMat);
scene.add(edges);

// Pulses for live transactions
const pulses = [];
const pulseGeom = new THREE.SphereGeometry(0.25, 12, 12);
const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffc680 });

function addPulse(a, b) {
  const mesh = new THREE.Mesh(pulseGeom, pulseMat.clone());
  mesh.position.copy(a);
  mesh.material.transparent = true;
  mesh.material.opacity = 1.0;
  const speed = 0.012 + Math.random() * 0.02; // lerp per frame
  pulses.push({ mesh, a: a.clone(), b: b.clone(), t: 0, speed });
  scene.add(mesh);
  // optional: slight scale flicker
}

// Subtle grid to ground the map
const grid = new THREE.GridHelper(460, 46, 0x2d3847, 0x1a2432);
grid.position.y = -3;
scene.add(grid);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  // light idle motion
  nodeGroup.rotation.y += 0.0002;
  edges.rotation.y += 0.0002;
  // Update pulses
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.t += p.speed;
    if (p.t >= 1) {
      scene.remove(p.mesh);
      pulses.splice(i, 1);
      continue;
    }
    const pos = new THREE.Vector3().lerpVectors(p.a, p.b, p.t);
    p.mesh.position.copy(pos);
    p.mesh.material.opacity = 1 - Math.abs(0.5 - p.t) * 2; // fade in/out
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// TODO: Replace mock graph with live Bitcoin network data.
// Potential sources: mempool.space websocket, Bitcoin Core ZMQ, or public APIs.

// Live data: Blockchain.info WS unconfirmed txs -> pulses between random nodes
const elConn = document.getElementById('conn');
const elStats = document.getElementById('stats');
let txCountWindow = [];
let lastStatsUpdate = 0;

function updateStats(now) {
  // Keep last 60s
  const cutoff = now - 60000;
  txCountWindow = txCountWindow.filter((t) => t >= cutoff);
  const perMin = txCountWindow.length;
  elStats.textContent = `TX/min: ${perMin}`;
}

let wsHandle;
try {
  wsHandle = connectUnconfirmedTxs({
    onOpen: () => {
      elConn.textContent = 'Live: connected';
      elConn.classList.remove('err');
      elConn.classList.add('ok');
    },
    onTx: () => {
      // Choose two random nodes to animate between
      if (nodes.length < 2) return;
      let i = Math.floor(Math.random() * nodes.length);
      let j = Math.floor(Math.random() * nodes.length);
      if (i === j) j = (j + 1) % nodes.length;
      addPulse(nodes[i], nodes[j]);

      const now = performance.now();
      txCountWindow.push(now);
      if (now - lastStatsUpdate > 1000) {
        updateStats(now);
        lastStatsUpdate = now;
      }
    },
    onError: () => {
      elConn.textContent = 'Live: error';
      elConn.classList.remove('ok');
      elConn.classList.add('err');
    },
    onClose: () => {
      elConn.textContent = 'Live: disconnected';
      elConn.classList.remove('ok');
      elConn.classList.add('err');
    },
  });
} catch (e) {
  elConn.textContent = 'Live: unavailable';
  elConn.classList.add('err');
}

// Clean up on hot reload
if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { wsHandle?.close(); } catch {}
  });
}
