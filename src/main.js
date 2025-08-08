import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { connectUnconfirmedTxs } from './data/blockchainInfoWS.js';
import { subscribeTip, computeSubsidy } from './data/blockInfo.js';
import { generateSampleNodes, computeCountryBackdrops } from './geo/sampleNodes.js';
import { COUNTRIES } from './geo/countries.js';
import { CONTINENT_INFO } from './geo/continents.js';

const canvas = document.getElementById('scene');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
function isMobile() { return window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window; }
function getMaxPixelRatio() { return isMobile() ? 1.25 : 1.75; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, getMaxPixelRatio()));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy?.() || 4;

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
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

// DOM elements (queried early so animation loop can reference them)
const elConn = document.getElementById('conn');
const elStats = document.getElementById('stats');
const elLegend = document.getElementById('legend');
const elNow = document.getElementById('metrics-now');
const el5m = document.getElementById('metrics-5m');
const elMiningUI = document.getElementById('mining-ui');
const elTabNetwork = document.getElementById('tab-network');
const elTabMining = document.getElementById('tab-mining');
const elReward = document.getElementById('mining-reward');
const elHeight = document.getElementById('mining-height');
const elSince = document.getElementById('mining-since');
const elEta = document.getElementById('mining-eta');
const elAttempts = document.getElementById('mining-attempts');
const elElapsed = document.getElementById('mining-elapsed');
const elProgress = document.getElementById('mining-progress');
const elWinner = document.getElementById('mining-winner');
// Header compact stats (declare early to avoid TDZ)
var elHdrHeight = document.getElementById('hdr-height');
var elHdrSince = document.getElementById('hdr-since');
var elHdrEta = document.getElementById('hdr-eta');
var elHdrSubsidy = document.getElementById('hdr-subsidy');

// Mining state placeholder to avoid TDZ if referenced before initialization
var mining = null;

// Geo-clustered node distribution
const nodeData = generateSampleNodes();
const nodes = [];

const nodeGeom = new THREE.SphereGeometry(1.25, 24, 24);
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
  tex.anisotropy = MAX_ANISO;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
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
  tex.anisotropy = MAX_ANISO;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
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

const edgeGeomSeg = new LineSegmentsGeometry();
edgeGeomSeg.setPositions(edgePositions);
const edgeMat2 = new LineMaterial({ color: 0xaec2d8, linewidth: isMobile() ? 1.6 : 1.2, transparent: true, opacity: 0.85, depthWrite: false });
edgeMat2.resolution.set(window.innerWidth, window.innerHeight);
const edges = new LineSegments2(edgeGeomSeg, edgeMat2);
scene.add(edges);
// Soft additive glow overlay
const edgeGlowMat2 = new LineMaterial({ color: 0x8fb2d0, linewidth: isMobile() ? 3.8 : 3.0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
edgeGlowMat2.resolution.set(window.innerWidth, window.innerHeight);
const edgesGlow = new LineSegments2(edgeGeomSeg, edgeGlowMat2);
edgesGlow.position.y = 0.01;
scene.add(edgesGlow);

// Postprocessing: FXAA to reduce shimmering on thin lines
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const fxaaPass = new ShaderPass(FXAAShader);
{
  const pr = renderer.getPixelRatio();
  fxaaPass.material.uniforms['resolution'].value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
}
composer.addPass(fxaaPass);

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
  pulseTexture.anisotropy = MAX_ANISO;
  pulseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  pulseTexture.magFilter = THREE.LinearFilter;
  pulseTexture.needsUpdate = true;
  return pulseTexture;
}

function addPulse(a, b, color = 0xffa34d) {
  const tex = getPulseTexture();
  const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, opacity: 0.9 });
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
const mapMat = new THREE.MeshBasicMaterial({ color: 0x8898a6, transparent: true, opacity: 0.35, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const worldMap = new THREE.Mesh(mapGeo, mapMat);
worldMap.position.set(0, -5, 0);
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

// Resolve public/ assets respecting Vite base path
function assetUrl(p) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${p.replace(/^\/+/, '')}`;
}

// Prefer local assets under /public/maps, fallback to remote
tryLoadInOrder(
  [
    assetUrl('maps/world-dark-4096.jpg'),
    assetUrl('maps/world-dark-2048.jpg'),
    assetUrl('maps/world-dark-2048.png')
  ],
  (tex) => {
    tex.anisotropy = MAX_ANISO;
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

// Procedural graticule (lat/lon lines) for realism
(function addGraticule() {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.strokeStyle = 'rgba(180,200,220,0.12)';
  ctx.lineWidth = 1;
  // every 10 degrees with stronger every 30
  for (let lon = -180; lon <= 180; lon += 10) {
    const x = ((lon + 180) / 360) * size + 0.5;
    ctx.globalAlpha = (lon % 30 === 0) ? 0.35 : 0.18;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 10) {
    const y = ((90 - lat) / 180) * size + 0.5;
    ctx.globalAlpha = (lat % 30 === 0) ? 0.35 : 0.18;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = MAX_ANISO;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const grid = new THREE.Mesh(mapGeo.clone(), mat);
  grid.position.set(0, -4.6, 0);
  grid.rotation.x = -Math.PI / 2;
  grid.renderOrder = -0.25;
  scene.add(grid);
})();

// Optional boundaries overlay plane if local asset exists (loaded opportunistically)
const boundaryMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const boundaryPlane = new THREE.Mesh(mapGeo.clone(), boundaryMat);
boundaryPlane.position.set(0, -4.8, 0);
boundaryPlane.rotation.x = -Math.PI / 2;
boundaryPlane.renderOrder = -0.5;
scene.add(boundaryPlane);

tryLoadInOrder(
  [
    assetUrl('maps/world-admin0-boundaries-4096.png'),
    assetUrl('maps/world-admin0-boundaries-2048.png'),
    assetUrl('maps/world-coastlines-2048.png')
  ],
  (tex) => {
    tex.anisotropy = MAX_ANISO;
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

  // Mining updates
  updateMining(performance.now());
  // Header stats update for both tabs
  updateHeaderStats();

  controls.update();
  composer.render();
}
animate();

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getMaxPixelRatio()));
  composer.setSize(window.innerWidth, window.innerHeight);
  // update FXAA resolution (1 / pixel)
  const pr = renderer.getPixelRatio();
  fxaaPass.material.uniforms['resolution'].value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
  // update wide line materials
  edgeMat2.resolution.set(window.innerWidth, window.innerHeight);
  edgeGlowMat2.resolution.set(window.innerWidth, window.innerHeight);
  // adjust line widths for device
  edgeMat2.linewidth = isMobile() ? 1.6 : 1.2;
  edgeGlowMat2.linewidth = isMobile() ? 3.8 : 3.0;
});

// HUD toggle for mobile
const hudEl = document.querySelector('#overlay .hud');
const hudToggle = document.getElementById('hud-toggle');
if (hudEl && hudToggle) {
  const setCollapsed = (collapsed) => {
    hudEl.classList.toggle('collapsed', collapsed);
  };
  // auto-collapse on mobile on load
  setCollapsed(isMobile());
  hudToggle.addEventListener('click', () => {
    const isColl = hudEl.classList.contains('collapsed');
    setCollapsed(!isColl);
  });
}

// TODO: Replace mock graph with live Bitcoin network data.
// Potential sources: mempool.space websocket, Bitcoin Core ZMQ, or public APIs.

// Live data: Blockchain.info WS unconfirmed txs -> pulses between random nodes
let txCountWindow = [];
let txCountWindow5m = [];
let txByContMinute = new Map();
let totalPulseCount = 0;
const nodesByCont = (() => {
  const m = new Map();
  nodeGroup.children.forEach((mesh) => {
    const k = mesh.userData.continent || 'NA';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
})();

function renderLegend() {
  if (!elLegend) return;
  elLegend.innerHTML = '';
  Object.entries(CONTINENT_INFO).forEach(([code, info]) => {
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = `#${info.color.toString(16).padStart(6, '0')}`;
    const name = document.createElement('span');
    name.textContent = `${info.name} (${nodesByCont.get(code) || 0})`;
    li.appendChild(sw); li.appendChild(name);
    elLegend.appendChild(li);
  });
}
renderLegend();
let lastStatsUpdate = 0;

function updateStats(now) {
  // Keep last 60s
  const cutoff = now - 60000;
  txCountWindow = txCountWindow.filter((t) => t >= cutoff);
  // Keep last 5m
  const cutoff5 = now - 300000;
  txCountWindow5m = txCountWindow5m.filter((t) => t >= cutoff5);
  const perMin = txCountWindow.length;
  elStats.textContent = `TX/min: ${perMin}`;
  if (elNow) {
    elNow.innerHTML = '';
    const add = (k, v) => { const li = document.createElement('li'); li.innerHTML = `<span>${k}</span><span>${v}</span>`; elNow.appendChild(li); };
    add('TX/min', perMin);
    add('Total pulses', totalPulseCount);
  }
  if (el5m) {
    el5m.innerHTML = '';
    const add = (k, v) => { const li = document.createElement('li'); li.innerHTML = `<span>${k}</span><span>${v}</span>`; el5m.appendChild(li); };
    add('TX (5 min)', txCountWindow5m.length);
    // Top continents by TX/min
    const arr = Array.from(txByContMinute.entries()).sort((a,b) => b[1]-a[1]).slice(0,3);
    arr.forEach(([code, n]) => add(`${CONTINENT_INFO[code]?.name || code} /min`, n));
  }
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
      txCountWindow5m.push(now);
      totalPulseCount++;
      // per-continent minute window
      const prev = txByContMinute.get(ccode) || 0;
      txByContMinute.set(ccode, prev + 1);
      if (now - lastStatsUpdate > 1000) {
        updateStats(now);
        lastStatsUpdate = now;
        // decay per-continent counts roughly once a second
        txByContMinute.forEach((v, k) => txByContMinute.set(k, Math.max(0, v - Math.round(v/60))));
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

// -----------------
// Mining mode setup
// -----------------
function fmt(n) { return Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n); }

mining = {
  active: false,
  block: null,
  miners: [],
  attempts: 0,
  target: 500 + Math.floor(Math.random() * 1500),
  start: 0,
  winnerIdx: -1,
  sprites: [],
  coin: null,
  rewardBTC: 3.125,
  tipHeight: 0,
  lastBlockTs: 0,
};

function makeBlockMesh() {
  const geo = new THREE.BoxGeometry(14, 8, 14);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1e2a38, metalness: 0.1, roughness: 0.7, emissive: 0x0a0f14, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 8, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function makeCoinTexture(text = `${mining.rewardBTC} BTC`) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // coin circle
  const grad = ctx.createRadialGradient(size/2, size/2, size*0.1, size/2, size/2, size*0.48);
  grad.addColorStop(0, '#ffdf7f');
  grad.addColorStop(1, '#c9971a');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(size/2, size/2, size*0.45, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 6; ctx.stroke();
  // text
  ctx.fillStyle = '#3b2c00';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = MAX_ANISO;
  return tex;
}

function spawnAttempt(from, to) {
  const size = 96;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.0, 'rgba(120,200,255,0.9)');
  g.addColorStop(0.6, 'rgba(120,200,255,0.2)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(from);
  sp.scale.set(2.4, 2.4, 1);
  const speed = 0.025 + Math.random() * 0.03;
  mining.sprites.push({ sp, a: from.clone(), b: to.clone(), t: 0, speed });
  scene.add(sp);
}

function startMining() {
  if (mining.active) return;
  mining.active = true;
  mining.attempts = 0;
  mining.target = 500 + Math.floor(Math.random() * 1500);
  mining.start = performance.now();
  mining.winnerIdx = -1;
  mining.coin && scene.remove(mining.coin);
  mining.coin = null;
  // choose subset of miners
  mining.miners = [];
  const sample = new Set();
  while (sample.size < Math.min(24, nodeGroup.children.length)) {
    sample.add(Math.floor(Math.random() * nodeGroup.children.length));
  }
  mining.miners = Array.from(sample);
  // block mesh
  mining.block = mining.block || makeBlockMesh();
  scene.add(mining.block);
  // UI
  elReward && (elReward.textContent = `${fmt(mining.rewardBTC)} BTC`);
  elWinner && (elWinner.textContent = '—');
}

function stopMining() {
  mining.active = false;
  // cleanup sprites
  for (const s of mining.sprites) scene.remove(s.sp);
  mining.sprites = [];
  if (mining.block) scene.remove(mining.block);
}

function updateMining(now) {
  if (!mining || !mining.active) return;
  // spin block
  mining.block.rotation.y += 0.01;
  // spawn attempts
  if (mining.winnerIdx < 0) {
    // bursty spawn
    const bursts = 4;
    for (let k = 0; k < bursts; k++) {
      const idx = mining.miners[Math.floor(Math.random() * mining.miners.length)];
      const from = nodeGroup.children[idx].position;
      spawnAttempt(from, mining.block.position);
      mining.attempts++;
      if (mining.attempts >= mining.target) {
        mining.winnerIdx = idx;
        break;
      }
    }
  }
  // advance attempt sprites
  for (let i = mining.sprites.length - 1; i >= 0; i--) {
    const s = mining.sprites[i]; s.t += s.speed;
    if (s.t >= 1) { scene.remove(s.sp); mining.sprites.splice(i, 1); continue; }
    const pos = new THREE.Vector3().lerpVectors(s.a, s.b, s.t);
    s.sp.position.copy(pos);
    const o = 1 - Math.abs(0.5 - s.t) * 2; s.sp.material.opacity = 0.5 + 0.5 * o;
  }
  // progress & UI
  const elapsed = Math.max(0, (now - mining.start) / 1000);
  elAttempts && (elAttempts.textContent = mining.attempts.toString());
  elElapsed && (elElapsed.textContent = `${elapsed.toFixed(1)}s`);
  const pct = Math.min(100, Math.floor((mining.attempts / mining.target) * 100));
  if (elProgress) elProgress.style.width = pct + '%';

  // Height and ETA
  if (elHeight && mining.tipHeight) elHeight.textContent = mining.tipHeight.toString();
  if (mining.lastBlockTs) {
    const sinceSec = Math.max(0, (Date.now() - mining.lastBlockTs) / 1000);
    if (elSince) elSince.textContent = `${sinceSec.toFixed(0)}s`;
    const eta = Math.max(0, 600 - sinceSec);
    if (elEta) elEta.textContent = `${eta.toFixed(0)}s`;
  }

  // winner handling: spawn coin and fly to winner
  if (mining.winnerIdx >= 0 && !mining.coin) {
    const tex = makeCoinTexture(`${mining.rewardBTC} BTC`);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const coin = new THREE.Sprite(mat);
    coin.scale.set(10, 10, 1);
    coin.position.copy(mining.block.position).add(new THREE.Vector3(0, 6, 0));
    mining.coin = coin;
    scene.add(coin);
    elWinner && (elWinner.textContent = `Miner @ node ${mining.winnerIdx}`);
  }
  if (mining.coin && mining.winnerIdx >= 0) {
    const target = nodeGroup.children[mining.winnerIdx].position.clone().add(new THREE.Vector3(0, 4, 0));
    const cur = mining.coin.position.clone();
    const to = cur.lerp(target, 0.02);
    mining.coin.position.copy(to);
    mining.coin.material.opacity = 0.9;
    // finish
    if (to.distanceTo(target) < 0.8) {
      // small pop
      mining.coin.scale.multiplyScalar(1.02);
      // restart new round after short delay
      setTimeout(() => { stopMining(); startMining(); }, 1200);
    }
  }
}

function updateHeaderStats() {
  if (!mining) return;
  if (elHdrHeight && mining.tipHeight) elHdrHeight.textContent = String(mining.tipHeight);
  if (elHdrSubsidy && mining.rewardBTC != null) elHdrSubsidy.textContent = `${fmt(mining.rewardBTC)} BTC`;
  if (mining.lastBlockTs) {
    const sinceSec = Math.max(0, (Date.now() - mining.lastBlockTs) / 1000);
    const eta = Math.max(0, 600 - sinceSec);
    if (elHdrSince) elHdrSince.textContent = `${sinceSec.toFixed(0)}s`;
    if (elHdrEta) elHdrEta.textContent = `${eta.toFixed(0)}s`;
  }
}

// Tab switching
function setModeMining(on) {
  if (on) {
    elTabMining?.classList.add('active'); elTabMining?.setAttribute('aria-pressed', 'true');
    elTabNetwork?.classList.remove('active'); elTabNetwork?.setAttribute('aria-pressed', 'false');
    elMiningUI?.classList.remove('hidden');
    startMining();
  } else {
    elTabNetwork?.classList.add('active'); elTabNetwork?.setAttribute('aria-pressed', 'true');
    elTabMining?.classList.remove('active'); elTabMining?.setAttribute('aria-pressed', 'false');
    elMiningUI?.classList.add('hidden');
    stopMining();
  }
}
elTabNetwork?.addEventListener('click', () => setModeMining(false));
elTabMining?.addEventListener('click', () => setModeMining(true));

// Live block tip subscription
let stopTip;
try {
  stopTip = subscribeTip({
    intervalMs: 15000,
    onUpdate: (tip) => {
      const h = tip?.height || 0;
      const ts = tip?.timestamp || 0;
      mining.tipHeight = h;
      mining.lastBlockTs = ts;
      mining.rewardBTC = computeSubsidy(h);
      if (elReward) elReward.textContent = `${fmt(mining.rewardBTC)} BTC`;
      if (elHeight) elHeight.textContent = `${h}`;
    },
  });
} catch {}
