// Lightweight client for mempool.space WebSocket
// Public docs: ws endpoint commonly available at wss://mempool.space/api/v1/ws
// Messages include various channels (e.g., blocks, transactions). We listen and
// surface block tips and unconfirmed transactions if present.

export function connectMempoolWS({ onOpen, onBlock, onTx, onError, onClose } = {}) {
  const url = 'wss://mempool.space/api/v1/ws';
  let ws;
  try {
    ws = new WebSocket(url);
  } catch (err) {
    onError?.(err);
    return { close: () => {} };
  }

  ws.addEventListener('open', () => {
    try {
      // Some deployments emit data without explicit subscribe; if needed, send hints
      // ws.send(JSON.stringify({ action: 'want', data: ['blocks', 'transactions'] }));
    } catch {}
    onOpen?.();
  });

  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data);
      // Heuristics: support several message shapes seen in the wild
      // Blocks
      if (data.type === 'block' || data.channel === 'blocks' || data.block) {
        const blk = data.block || data.data || data;
        const height = blk?.height ?? data.height;
        const ts = (blk?.timestamp ?? blk?.time ?? Date.now()) * (blk?.timestamp ? 1000 : 1);
        if (Number.isFinite(height)) onBlock?.({ height, timestamp: ts });
        return;
      }
      // Unconfirmed txs
      if (data.type === 'transaction' || data.channel === 'transactions' || data.tx) {
        onTx?.(data.tx || data.data || data);
        return;
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.addEventListener('error', (e) => onError?.(e));
  ws.addEventListener('close', () => onClose?.());

  return {
    close: () => {
      try { ws.close(); } catch {}
    }
  };
}

