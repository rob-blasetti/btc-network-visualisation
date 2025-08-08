import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('scene');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 40, 120);
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

// Galaxy-like node distribution
const nodeCount = 180;
const radius = 80;
const nodes = [];

const nodeGeom = new THREE.SphereGeometry(0.9, 16, 16);
const nodeMat = new THREE.MeshStandardMaterial({ color: 0xf7931a, emissive: 0x2a1200, metalness: 0.2, roughness: 0.4 });
const nodeGroup = new THREE.Group();

for (let i = 0; i < nodeCount; i++) {
  // Random point in a sphere with slight disc bias
  const r = radius * Math.cbrt(Math.random());
  const theta = Math.random() * Math.PI * 2;
  const phi = (Math.random() * 0.6 + 0.2) * Math.PI; // bias towards disc
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * (Math.random() * 0.15 - 0.075); // thin band
  const z = r * Math.sin(phi) * Math.sin(theta);

  const mesh = new THREE.Mesh(nodeGeom, nodeMat);
  mesh.position.set(x, y, z);
  nodes.push(mesh.position.clone());
  nodeGroup.add(mesh);
}
scene.add(nodeGroup);

// Edges as line segments
const connectionsPerNode = 2; // sparse graph to start
const edgePositions = [];

for (let i = 0; i < nodeCount; i++) {
  const connected = new Set();
  while (connected.size < connectionsPerNode) {
    const j = Math.floor(Math.random() * nodeCount);
    if (j === i || connected.has(j)) continue;
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

// Starfield background
const stars = (() => {
  const starCount = 1000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 800 * Math.cbrt(Math.random());
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(p) * Math.cos(t);
    positions[i * 3 + 1] = r * Math.cos(p);
    positions[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ size: 1, sizeAttenuation: true, color: 0xffffff, opacity: 0.85, transparent: true });
  return new THREE.Points(g, m);
})();
scene.add(stars);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  nodeGroup.rotation.y += 0.0008;
  edges.rotation.y += 0.0008;
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

