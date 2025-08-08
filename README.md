# BTC Network Visualizer (Three.js)

Interactive prototype that visualizes a Bitcoin-like peer graph using Three.js. It ships with a placeholder graph and is ready to be wired to live data sources (e.g., mempool.space websockets, Bitcoin Core ZMQ, or public APIs).

## Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Build for production
- `npm run preview`: Preview the production build

## Local Development

1. Install deps: `npm install`
2. Run dev server: `npm run dev`
3. Open the printed local URL

## Deployment (GitHub Pages)

This repo includes a workflow that builds and publishes `dist` to GitHub Pages on every push to `main`. The Vite `base` is set to `/btc-network-visualizer-threejs/`.

If you rename the repo, update `vite.config.js` accordingly.

## Roadmap

- Replace placeholder graph with live Bitcoin network data
- Add clustering, link weighting, and node metrics
- Add data source controls (local node / public API)
- Add perf controls and level-of-detail

## License

MIT

