# BTC Network Visualizer (Three.js)

Live demo: https://rob-blasetti.github.io/btc-network-visualisation/

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

This repo includes a workflow that builds and publishes `dist` to GitHub Pages on every push to `main`. The Vite `base` is set to `/btc-network-visualisation/`.

If you fork or rename the repo, update `base` in `vite.config.js` accordingly.

## Roadmap

- Replace placeholder graph with live Bitcoin network data
- Geographic layout by country with backdrops
- Add clustering, link weighting, and node metrics
- Add data source controls (local node / public API)
- Add perf controls and level-of-detail

## Update & Deploy

To make changes and push them live on GitHub Pages:

1. Edit code locally (e.g., files under `src/`).
2. Preview locally: `npm install` then `npm run dev` and open the URL.
3. Commit: `git add -A && git commit -m "feat: your change"`
4. Push to `main`: `git push`
5. GitHub Actions builds and deploys automatically to Pages. Wait ~1–3 minutes.

Notes for geographic layout:
- Country centroids and demo nodes live under `src/geo/`.
- To add/adjust countries, edit `src/geo/countries.js` and `src/geo/sampleNodes.js`.
- Backdrop images are generated from a canvas; replace with flag or map textures if desired.

Map overlay & controls:
- A semi-transparent equirectangular world map is rendered as a plane below nodes.
- OrbitControls: left-drag orbit, right-drag pan, wheel zoom.
- You can tweak pan/zoom speeds in `src/main.js` (look for `OrbitControls` settings).

## License

MIT
