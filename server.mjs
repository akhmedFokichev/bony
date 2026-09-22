import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const dist = join(__dirname, 'dist')
const port = Number(process.env.PORT || 4173)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (url.pathname.startsWith('/kc/')) {
      const target = `https://geduko.kartchrono.com${url.pathname.slice(3)}${url.search}`
      const upstream = await fetch(target, {
        headers: { 'user-agent': req.headers['user-agent'] || 'GedukoAnalytics' },
      })
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'text/html; charset=utf-8',
      })
      res.end(Buffer.from(await upstream.arrayBuffer()))
      return
    }

    let path = url.pathname === '/' ? '/index.html' : url.pathname
    let file = normalize(join(dist, path))
    if (!file.startsWith(dist)) {
      res.writeHead(403)
      res.end()
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  } catch (error) {
    res.writeHead(502)
    res.end(error instanceof Error ? error.message : 'proxy error')
  }
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== '/kc-ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (client) => {
    const upstream = new WebSocket('wss://kartchrono.com:9180', {
      headers: { Origin: 'https://geduko.kartchrono.com' },
    })
    const close = () => {
      client.close()
      upstream.close()
    }
    upstream.on('open', () => {
      client.on('message', (data, isBinary) => upstream.send(data, { binary: isBinary }))
      upstream.on('message', (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary })
      })
    })
    client.on('close', close)
    upstream.on('close', close)
    client.on('error', close)
    upstream.on('error', close)
  })
})

server.listen(port, () => {
  console.log(`Geduko Analytics http://localhost:${port}`)
})
