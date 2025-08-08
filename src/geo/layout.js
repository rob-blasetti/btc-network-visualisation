// Simple equirectangular projection onto XZ plane
// latitude -> Z, longitude -> X
export function projectLatLon(latDeg, lonDeg, scale = 1.0) {
  const x = lonDeg * scale; // -180..180 -> -180..180
  const z = -latDeg * scale; // invert so north is -Z (towards top)
  return { x, z };
}

export function jitterAround(x, z, radius = 1.5) {
  const t = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return { x: x + Math.cos(t) * r, z: z + Math.sin(t) * r };
}

