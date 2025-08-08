// Lightweight client for Blockchain.info WebSocket API
// Docs (commonly used): wss://ws.blockchain.info/inv with { op: "unconfirmed_sub" }

export function connectUnconfirmedTxs({ onOpen, onTx, onError, onClose } = {}) {
  const url = 'wss://ws.blockchain.info/inv';
  let ws;

  try {
    ws = new WebSocket(url);
  } catch (err) {
    onError?.(err);
    return { close: () => {} };
  }

  ws.addEventListener('open', () => {
    try {
      ws.send(JSON.stringify({ op: 'unconfirmed_sub' }));
    } catch (e) {}
    onOpen?.();
  });

  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.op === 'utx' && data.x) {
        onTx?.(data.x);
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

