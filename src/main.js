import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { connectUnconfirmedTxs } from './data/blockchainInfoWS.js';
import { generateSampleNodes, computeCountryBackdrops } from './geo/sampleNodes.js';
import { COUNTRIES } from './geo/countries.js';
import { CONTINENT_INFO } from './geo/continents.js';

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
controls.enablePan = true;
controls.panSpeed = 0.6;
controls.zoomSpeed = 1.2;
controls.rotateSpeed = 0.6;
controls.minDistance = 5;
controls.maxDistance = 800;

// Geo-clustered node distribution
const nodeData = generateSampleNodes();
const nodes = [];

const nodeGeom = new THREE.SphereGeometry(1.25, 20, 20);
const nodeGroup = new THREE.Group();

for (const n of nodeData) {
  const contColor = CONTINENT_INFO[n.continent]?.color ?? 0xf7931a;
  const nodeMat = new THREE.MeshStandardMaterial({ color: contColor, emissive: contColor & 0x222222, metalness: 0.25, roughness: 0.5 });
  nodeMat.emissiveIntensity = 0.35;
  const mesh = new THREE.Mesh(nodeGeom, nodeMat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.userData.country = n.country;
  mesh.userData.continent = n.continent;
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
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.78, depthWrite: false });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(b.x, -2.5, b.z);
  plane.rotation.x = -Math.PI / 2; // lay flat on XZ
  plane.renderOrder = 0;
  backdropGroup.add(plane);
}
scene.add(backdropGroup);

// Continent outlines and labels
const continentGroup = new THREE.Group();
const byCont = new Map();
nodeGroup.children.forEach((m) => {
  const k = m.userData.continent || 'NA';
  const arr = byCont.get(k) || [];
  arr.push(m.position);
  byCont.set(k, arr);
});

function makeCircleGeom(segments = 128) {
  return new THREE.CircleGeometry(1, segments);
}

function makeLabelSprite(text, color = '#ffffff') {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0,0,size,size);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, size/2, size/2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(28, 14, 1);
  return sp;
}

for (const [code, list] of byCont) {
  if (list.length < 2) continue;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of list) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const rx = Math.max(12, (maxX - minX) * 0.7);
  const rz = Math.max(10, (maxZ - minZ) * 0.8);

  const color = CONTINENT_INFO[code]?.color ?? 0xffffff;
  const circleGeom = makeCircleGeom();
  const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false });
  const outlineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });

  const fill = new THREE.Mesh(circleGeom, fillMat);
  fill.position.set(cx, -2.9, cz);
  fill.rotation.x = -Math.PI / 2;
  fill.scale.set(rx, rz, 1);

  const outline = new THREE.LineLoop(circleGeom, outlineMat);
  outline.position.set(cx, -2.89, cz);
  outline.rotation.x = -Math.PI / 2;
  outline.scale.set(rx, rz, 1);

  const label = makeLabelSprite(CONTINENT_INFO[code]?.name ?? code, '#e6edf3');
  label.position.set(cx, 2.0, cz);

  continentGroup.add(fill);
  continentGroup.add(outline);
  continentGroup.add(label);
}
scene.add(continentGroup);

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
const edgeMat = new THREE.LineBasicMaterial({ color: 0x6b8aa8, transparent: true, opacity: 0.65 });
const edges = new THREE.LineSegments(edgeGeom, edgeMat);
scene.add(edges);
// Add a soft additive glow for edges
const edgeGlowMat = new THREE.LineBasicMaterial({ color: 0x98b7d6, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
const edgesGlow = new THREE.LineSegments(edgeGeom.clone(), edgeGlowMat);
edgesGlow.position.y = 0.01;
scene.add(edgesGlow);

// Pulses for live transactions (additive glowing sprites)
const pulses = [];
let pulseTexture;
function getPulseTexture() {
  if (pulseTexture) return pulseTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.0, 'rgba(255,220,160,1)');
  g.addColorStop(0.4, 'rgba(255,160,60,0.8)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
  ctx.fill();
  pulseTexture = new THREE.CanvasTexture(c);
  pulseTexture.anisotropy = 4;
  pulseTexture.needsUpdate = true;
  return pulseTexture;
}

function addPulse(a, b, color = 0xffa34d) {
  const tex = getPulseTexture();
  const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(a);
  sprite.scale.set(2.6, 2.6, 1);
  const speed = 0.02 + Math.random() * 0.03; // faster for visibility
  pulses.push({ mesh: sprite, a: a.clone(), b: b.clone(), t: 0, speed });
  scene.add(sprite);
}

// World map overlay (equirectangular) aligned with our lat/lon projection
// Plane size matches degrees scaled in sampleNodes (scale = 1.2)
const MAP_SCALE = 1.2;
const mapWidth = 360 * MAP_SCALE;
const mapHeight = 180 * MAP_SCALE;
const mapGeo = new THREE.PlaneGeometry(mapWidth, mapHeight, 1, 1);
const mapMat = new THREE.MeshBasicMaterial({ color: 0x8898a6, transparent: true, opacity: 0.35 });
const worldMap = new THREE.Mesh(mapGeo, mapMat);
worldMap.position.set(0, -3, 0);
worldMap.rotation.x = -Math.PI / 2; // lie on XZ
worldMap.renderOrder = -1;
scene.add(worldMap);

// Load a lightweight world map texture (Wikimedia thumbnail, permissive hotlinking)
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
function tryLoadInOrder(urls, onSuccess, onFail) {
  if (!urls.length) { onFail?.(); return; }
  const [head, ...rest] = urls;
  texLoader.load(
    head,
    (tex) => onSuccess(tex),
    undefined,
    () => tryLoadInOrder(rest, onSuccess, onFail)
  );
}

// Prefer local assets under /public/maps, fallback to remote
tryLoadInOrder(
  [
    '/maps/world-dark-4096.jpg',
    '/maps/world-dark-2048.jpg',
    '/maps/world-dark-2048.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/BlankMap-World-v2-dark-gray.svg/1024px-BlankMap-World-v2-dark-gray.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.png/1024px-World_map_-_low_resolution.png'
  ],
  (tex) => {
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    mapMat.map = tex;
    mapMat.needsUpdate = true;
  },
  () => {
    const grid = new THREE.GridHelper(mapWidth + 20, 46, 0x2d3847, 0x1a2432);
    grid.position.y = -3.1;
    scene.add(grid);
  }
);

// Optional boundaries overlay plane if local asset exists (loaded opportunistically)
const boundaryMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
const boundaryPlane = new THREE.Mesh(mapGeo.clone(), boundaryMat);
boundaryPlane.position.set(0, -2.99, 0);
boundaryPlane.rotation.x = -Math.PI / 2;
boundaryPlane.renderOrder = -0.5;
scene.add(boundaryPlane);

tryLoadInOrder(
  [
    '/maps/world-admin0-boundaries-4096.png',
    '/maps/world-admin0-boundaries-2048.png',
    '/maps/world-coastlines-2048.png'
  ],
  (tex) => {
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    boundaryMat.map = tex;
    boundaryMat.needsUpdate = true;
  },
  () => { /* silently skip if not present */ }
);

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
    const o = 1 - Math.abs(0.5 - p.t) * 2; // fade in/out
    p.mesh.material.opacity = 0.6 + 0.4 * o;
    const s = 2.0 + 3.0 * (0.5 - Math.abs(0.5 - p.t));
    p.mesh.scale.set(s, s, 1);
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
      // Color pulse by source continent color
      const ccode = nodeGroup.children[i].userData.continent;
      const col = CONTINENT_INFO[ccode]?.color ?? 0xffa34d;
      addPulse(nodes[i], nodes[j], col);

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
