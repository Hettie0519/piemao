import type { GameMessage, MessageType } from '../types/game';

// WebSocket 服务器地址
const WS_URL = 'wss://chuaipoker.kochab.ccwu.cc/ws';
// 本地开发时使用
// const WS_URL = 'ws://localhost:8787/ws';

interface ConnectionHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onReconnecting?: () => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private myId: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageHandlers = new Map<MessageType, (msg: GameMessage) => void>();
  private connectionHandlers: ConnectionHandlers = {};

  constructor() {
    this.myId = this.generateId();
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.connectionHandlers.onOpen?.();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: GameMessage = JSON.parse(event.data);
            this.messageHandlers.get(msg.type)?.(msg);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.connectionHandlers.onClose?.();
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionHandlers.onError?.(error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: Partial<GameMessage>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        senderId: this.myId,
        timestamp: Date.now(),
      }));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  onMessage(type: MessageType, handler: (msg: GameMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  onOpen(handler: () => void): void {
    this.connectionHandlers.onOpen = handler;
  }

  onClose(handler: () => void): void {
    this.connectionHandlers.onClose = handler;
  }

  onError(handler: (error: Event) => void): void {
    this.connectionHandlers.onError = handler;
  }

  onReconnecting(handler: () => void): void {
    this.connectionHandlers.onReconnecting = handler;
  }

  getMyId(): string {
    return this.myId;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
    this.connectionHandlers.onReconnecting?.();

    await new Promise(r => setTimeout(r, 1000 * this.reconnectAttempts));

    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnect failed:', error);
    }
  }

  private generateId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const wsManager = new WebSocketManager();
