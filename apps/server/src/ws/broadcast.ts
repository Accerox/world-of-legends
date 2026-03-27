import type { WebSocket } from 'ws'
import type { ServerMessage } from '../types.js'

/**
 * Send a message to a single WebSocket client.
 */
export function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

/**
 * Broadcast a message to all connected clients.
 */
export function broadcast(clients: Set<WebSocket>, message: ServerMessage): void {
  const data = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data)
    }
  }
}

/**
 * Broadcast a message to all connected clients except one.
 */
export function broadcastExcept(
  clients: Set<WebSocket>,
  exclude: WebSocket,
  message: ServerMessage,
): void {
  const data = JSON.stringify(message)
  for (const client of clients) {
    if (client !== exclude && client.readyState === client.OPEN) {
      client.send(data)
    }
  }
}
