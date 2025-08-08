// ISO country code to continent mapping (subset used by sample nodes)
export const CONTINENT_INFO = {
  AF: { name: 'Africa', color: 0x5fb37c },
  AS: { name: 'Asia', color: 0xf0a500 },
  EU: { name: 'Europe', color: 0x5aa0ff },
  NA: { name: 'North America', color: 0x9b59b6 },
  SA: { name: 'South America', color: 0xe67e22 },
  OC: { name: 'Oceania', color: 0x16a085 },
};

export const COUNTRY_TO_CONTINENT = {
  US: 'NA', CA: 'NA',
  BR: 'SA',
  GB: 'EU', DE: 'EU', NL: 'EU', FR: 'EU', ES: 'EU', IT: 'EU', UA: 'EU',
  RU: 'EU', // spanning, but we group with EU for this view
  IN: 'AS', CN: 'AS', JP: 'AS', KR: 'AS', SG: 'AS',
  AU: 'OC', NZ: 'OC',
  ZA: 'AF',
};

export function getContinent(code) {
  const k = COUNTRY_TO_CONTINENT[code];
  return k ? { code: k, ...CONTINENT_INFO[k] } : null;
}

