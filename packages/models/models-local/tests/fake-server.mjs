/** Minimal llama-server stand-in: /health after an optional warm-up, optional crash timer. */
import { createServer } from 'node:http'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

const port = Number(arg('--port'))
const healthDelay = Number(arg('--health-delay') ?? 0)
const crashAfter = Number(arg('--crash-after') ?? 0)
const startedAt = Date.now()

const server = createServer((req, res) => {
  if (req.url === '/health' && Date.now() - startedAt >= healthDelay) {
    res.writeHead(200)
    res.end('ok')
    return
  }
  res.writeHead(503)
  res.end()
})

server.listen(port, '127.0.0.1', () => {
  if (crashAfter > 0) setTimeout(() => process.exit(1), crashAfter)
})
