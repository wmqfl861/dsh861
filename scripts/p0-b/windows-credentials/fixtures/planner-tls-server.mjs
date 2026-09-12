/** Loopback-only synthetic TLS peer; this fixture never contacts an external host. */
import { once } from 'node:events'
import { createServer as createTcpServer } from 'node:net'
import { createServer as createTlsServer } from 'node:tls'
import { certificates } from './planner-tls-certificates.mjs'

/** @param t - test cleanup owner. @param options - synthetic peer behavior. @returns listening peer and explicit trust policy. */
export async function loopbackTls(t, options = {}) {
  const sockets = new Set()
  const stats = { connections: 0, applicationBytes: 0, servernames: [] }
  const server = options.stall ? createTcpServer() : createTlsServer({ key: certificates.key,
    cert: options.cert ?? certificates.valid, minVersion: 'TLSv1.2',
    ...(options.maxVersion ? { maxVersion: options.maxVersion } : {}) }, socket => {
    stats.servernames.push(socket.servername)
    socket.on('data', data => { stats.applicationBytes += data.length })
    socket.on('error', () => {})
  })
  server.on('tlsClientError', () => {})
  server.on('connection', socket => {
    stats.connections++
    sockets.add(socket)
    socket.on('error', () => {})
    socket.once('close', () => { sockets.delete(socket) })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  let closing
  const close = () => {
    if (!closing) closing = new Promise(resolve => {
      server.close(resolve)
      for (const socket of sockets) socket.destroy()
    })
    return closing
  }
  t.after(close)
  const baseUrl = `https://${options.hostname ?? '127.0.0.1'}:${server.address().port}/v1`
  return { baseUrl, stats, close, policy: { record: 'test/tls', baseUrl, caCertificates: [certificates.ca],
    peerSpkiSha256: null, minVersion: 'TLSv1.2', handshakeTimeoutMs: 3000, closeTimeoutMs: 500 } }
}
