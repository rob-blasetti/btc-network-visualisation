// Lightweight polling for current Bitcoin tip via public APIs with CORS

const MEMPOOL = 'https://mempool.space/api';
const BLOCKSTREAM = 'https://blockstream.info/api';

export async function fetchTipFromMempool() {
  const res = await fetch(`${MEMPOOL}/blocks`);
  if (!res.ok) throw new Error('mempool blocks failed');
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('mempool blocks empty');
  const tip = arr[0];
  return { height: tip.height, timestamp: tip.timestamp * 1000 };
}

export async function fetchTipFromBlockstream() {
  const [hRes, blocksRes] = await Promise.all([
    fetch(`${BLOCKSTREAM}/blocks/tip/height`),
    fetch(`${BLOCKSTREAM}/blocks`),
  ]);
  if (!hRes.ok || !blocksRes.ok) throw new Error('blockstream failed');
  const height = parseInt(await hRes.text(), 10);
  const list = await blocksRes.json();
  const match = Array.isArray(list) ? list.find(b => b.height === height) : null;
  const ts = (match?.timestamp ? match.timestamp : list?.[0]?.timestamp) * 1000;
  return { height, timestamp: ts };
}

export async function getTip() {
  try { return await fetchTipFromMempool(); }
  catch { /* noop */ }
  try { return await fetchTipFromBlockstream(); }
  catch { /* noop */ }
  throw new Error('All tip sources failed');
}

export function computeSubsidy(height) {
  // 50 BTC initially, halves every 210,000 blocks; stop after ~33 halvings
  const halvings = Math.floor(height / 210000);
  if (halvings >= 33) return 0;
  const subsidy = 50 / Math.pow(2, halvings);
  return subsidy;
}

export function subscribeTip({ intervalMs = 15000, onUpdate } = {}) {
  let timer;
  let stopped = false;
  async function tick() {
    try {
      const tip = await getTip();
      onUpdate?.(tip);
    } catch (e) {
      // ignore errors; try again later
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  }
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

