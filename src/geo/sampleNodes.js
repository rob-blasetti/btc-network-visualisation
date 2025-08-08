import { getCountry } from './countries.js';
import { projectLatLon, jitterAround } from './layout.js';

// Generate demo nodes with country codes and approximate lat/lon clustering.
export function generateSampleNodes() {
  const countries = [
    ['US', 60],
    ['DE', 25],
    ['NL', 20],
    ['GB', 20],
    ['FR', 18],
    ['ES', 16],
    ['IT', 16],
    ['UA', 10],
    ['RU', 10],
    ['IN', 20],
    ['JP', 18],
    ['KR', 12],
    ['SG', 10],
    ['AU', 18],
    ['NZ', 8],
    ['BR', 14],
    ['CA', 14],
    ['ZA', 8],
  ];

  const scale = 1.2; // degrees -> scene units
  const nodes = [];
  for (const [code, count] of countries) {
    const c = getCountry(code);
    if (!c) continue;
    const { x, z } = projectLatLon(c.lat, c.lon, scale);
    for (let i = 0; i < count; i++) {
      const j = jitterAround(x, z, 3.5);
      nodes.push({ x: j.x, y: (Math.random() * 0.6 - 0.3), z: j.z, country: code });
    }
  }
  return nodes;
}

// Create simple backdrop descriptors per country: centroid and size based on node count
export function computeCountryBackdrops(nodes) {
  const byCountry = new Map();
  for (const n of nodes) {
    const arr = byCountry.get(n.country) || [];
    arr.push(n);
    byCountry.set(n.country, arr);
  }
  const scale = 1.2;
  const out = [];
  for (const [code, list] of byCountry) {
    const c = getCountry(code);
    if (!c) continue;
    const center = projectLatLon(c.lat, c.lon, scale);
    const size = Math.max(6, Math.min(18, Math.sqrt(list.length) * 4));
    out.push({ country: code, x: center.x, z: center.z, size });
  }
  return out;
}

