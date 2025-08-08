// Minimal set of country centroids (lat, lon in degrees)
// Extend as needed.
export const COUNTRIES = {
  US: { name: 'United States', lat: 39.8283, lon: -98.5795 },
  CA: { name: 'Canada', lat: 56.1304, lon: -106.3468 },
  BR: { name: 'Brazil', lat: -14.2350, lon: -51.9253 },
  GB: { name: 'United Kingdom', lat: 54.0, lon: -2.0 },
  DE: { name: 'Germany', lat: 51.1657, lon: 10.4515 },
  NL: { name: 'Netherlands', lat: 52.1326, lon: 5.2913 },
  FR: { name: 'France', lat: 46.2276, lon: 2.2137 },
  ES: { name: 'Spain', lat: 40.4637, lon: -3.7492 },
  IT: { name: 'Italy', lat: 41.8719, lon: 12.5674 },
  UA: { name: 'Ukraine', lat: 48.3794, lon: 31.1656 },
  RU: { name: 'Russia', lat: 61.5240, lon: 105.3188 },
  IN: { name: 'India', lat: 20.5937, lon: 78.9629 },
  CN: { name: 'China', lat: 35.8617, lon: 104.1954 },
  JP: { name: 'Japan', lat: 36.2048, lon: 138.2529 },
  KR: { name: 'South Korea', lat: 36.5, lon: 127.8 },
  SG: { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  AU: { name: 'Australia', lat: -25.2744, lon: 133.7751 },
  NZ: { name: 'New Zealand', lat: -40.9006, lon: 174.8860 },
  ZA: { name: 'South Africa', lat: -30.5595, lon: 22.9375 },
};

export function getCountry(code) {
  return COUNTRIES[code] || null;
}

