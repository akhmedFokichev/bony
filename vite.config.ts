import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

const kartchronoProxy: Record<string, string | ProxyOptions> = {
  '/kc-ws': {
    target: 'wss://kartchrono.com:9180',
    ws: true,
    changeOrigin: true,
    rewrite: () => '/',
    configure: (proxy) => {
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.setHeader('Origin', 'https://geduko.kartchrono.com')
      })
    },
  },
  '/kc': {
    target: 'https://geduko.kartchrono.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/kc/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: kartchronoProxy,
  },
  preview: {
    proxy: kartchronoProxy,
  },
})
