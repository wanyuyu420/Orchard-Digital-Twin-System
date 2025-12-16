/**
 * WebSocket client for real-time data streaming with auto-reconnect.
 */

export interface WebSocketMessage {
  type: 'connection' | 'heartbeat' | 'sensor_update' | 'alert_new'
  status?: string
  data?: unknown
  timestamp: string
}

export interface SensorUpdate {
  sensor_id: number
  station_name: string
  metric: string
  value: number | null
  unit: string | null
  timestamp: string | null
}

export interface AlertMessage {
  sensor_id: number
  metric: string
  level: string
  message: string
  timestamp: string | null
}

type MessageHandler = (message: WebSocketMessage) => void

class RealtimeWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000 // Start with 1s, exponential backoff
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private handlers: Set<MessageHandler> = new Set()
  private isConnecting = false

  constructor(url?: string) {
    // Default to ws://localhost:8000/ws/realtime in development
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const defaultUrl = import.meta.env.DEV
      ? 'ws://localhost:8000/ws/realtime'
      : `${wsProtocol}//${window.location.host}/ws/realtime`
    this.url = url || defaultUrl
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.startPing()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.notifyHandlers(message)
        } catch (e) {
          // Handle pong response (plain text)
          if (event.data === 'pong') {
            return
          }
          console.error('[WebSocket] Failed to parse message:', e)
        }
      }

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected', event.code, event.reason)
        this.isConnecting = false
        this.stopPing()
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        this.isConnecting = false
      }
    } catch (e) {
      console.error('[WebSocket] Failed to create connection:', e)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.stopPing()
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnect
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Subscribe to WebSocket messages.
   */
  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Check if connected.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private notifyHandlers(message: WebSocketMessage): void {
    this.handlers.forEach((handler) => {
      try {
        handler(message)
      } catch (e) {
        console.error('[WebSocket] Handler error:', e)
      }
    })
  }

  private startPing(): void {
    this.stopPing()
    // Send ping every 25 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping')
      }
    }, 25000)
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect()
    }, delay)
  }
}

// Singleton instance
export const realtimeWs = new RealtimeWebSocket()

export default RealtimeWebSocket
