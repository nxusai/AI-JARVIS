import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The Reels studio on an address of its own: http://localhost:5180 opens the
 * editor straight away, apart from Nexy's main screen on 5173. Same project,
 * same bridge; only the front door differs. Started by `npm start`, or alone
 * with `npm run estudio` while the bridge runs.
 */
const studioAtRoot = (): Plugin => ({
  name: 'estudio-en-la-raiz',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/' || req.url === '/index.html' || req.url?.startsWith('/?')) req.url = '/estudio.html'
      next()
    })
  },
})

export default defineConfig({
  plugins: [react(), studioAtRoot()],
  // The bridge accepts sockets from localhost:5173-5199, so this stays inside that range.
  server: { port: Number(process.env.ESTUDIO_PORT) || 5180, strictPort: true },
  // Only the studio's own page: the other sites in this repository are not its business.
  optimizeDeps: { entries: ['estudio.html'], exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'] },
})
