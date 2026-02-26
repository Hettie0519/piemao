import Peer from 'peerjs';
import type { GameMessage } from '../types/game';
import { MessageType } from '../types/game';

// 固定房间号（使用更独特的ID避免冲突）
const FIXED_ROOM_ID = 'hettie2026';

// 使用免费的 PeerJS 公共服务器 + STUN/TURN 服务器
const PEER_SERVER_CONFIG = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  config: {
    iceServers: [
      // Google 公共 STUN 服务器
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // 免费的公共 TURN 服务器（coturn）
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com',
      },
      // 另一个免费 TURN 服务器
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

/**
 * P2P 连接管理器
 */
export class P2PManager {
  private peer: any = null;
  private connections: Map<string, any> = new Map();
  private myId: string = '';
  private isHost: boolean = false;
  private hostId: string | null = null;
  private messageHandlers: Map<MessageType, (message: GameMessage) => void> = new Map();
  private connectionHandlers: {
    onOpen?: (peerId: string) => void;
    onClose?: (peerId: string) => void;
    onError?: (error: any) => void;
    onRoomExists?: () => void; // 新增：房间已存在回调
  } = {};

  constructor() {
    this.init();
  }

  /**
   * 初始化 PeerJS
   */
  private init(useFixedId: boolean = true): void {
    try {
      const peerId = useFixedId ? FIXED_ROOM_ID : undefined;
      console.log('P2P: Initializing peer with ID:', peerId || '(random)');
      this.peer = peerId ? new Peer(peerId, PEER_SERVER_CONFIG) : new Peer(PEER_SERVER_CONFIG);

      this.peer.on('open', (id: any) => {
        console.log('P2P: Peer opened with ID:', id);
        this.myId = id;
      });

      this.peer.on('connection', (conn: any) => {
        console.log('P2P: Incoming connection from:', conn.peer);
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (error: any) => {
        console.error('P2P: Peer error:', error);
        console.error('P2P: Error type:', error.type);
        console.error('P2P: Error message:', error.toString());
        
        // 如果是 ID 被占用的错误，说明房间已存在，通知上层
        // 或者是 WebSocket 连接失败
        if (error.type === 'peer-unavailable' || error.toString().includes('is taken') || error.toString().includes('WebSocket') || error.toString().includes('Could not connect')) {
          console.log('房间号已被占用或连接失败，可以加入现有房间');
          this.connectionHandlers.onRoomExists?.();
        }
        
        this.connectionHandlers.onError?.(error);
      });

      this.peer.on('disconnected', () => {
        console.log('P2P: Peer disconnected, reconnecting...');
        // 可以在这里实现重连逻辑
      });
    } catch (error) {
      console.error('P2P: Failed to initialize peer:', error);
      this.connectionHandlers.onError?.(error);
    }
  }

  /**
   * 重新初始化用于加入房间（不使用固定ID）
   */
  async reinitForJoin(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('P2P: Reinitializing for join...');
      
      // 销毁旧的 peer
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      // 清空连接
      this.connections.clear();
      
      // 重新初始化，不使用固定 ID
      this.init(false);
      
      // 等待 peer 打开
      const checkReady = () => {
        if (this.peer && this.myId) {
          console.log('P2P: Reinit complete, new ID:', this.myId);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      // 设置一个超时
      setTimeout(() => {
        if (!this.myId) {
          reject(new Error('Reinit timeout'));
        }
      }, 10000);
      
      checkReady();
    });
  }

  /**
   * 处理传入的连接
   */
  private handleIncomingConnection(conn: any): void {
    const peerId = conn.peer;
    
    conn.on('open', () => {
      console.log('P2P: Connection opened with:', peerId);
      this.connections.set(peerId, conn);
      this.connectionHandlers.onOpen?.(peerId);

      // 处理接收到的消息
      conn.on('data', (data: any) => {
        // 确保 senderId 正确设置
        if (data && !data.senderId) {
          data.senderId = peerId;
        }
        this.handleMessage(data);
      });

      // 处理连接关闭
      conn.on('close', () => {
        console.log('P2P: Connection closed with:', peerId);
        this.connections.delete(peerId);
        this.connectionHandlers.onClose?.(peerId);
      });

      // 处理连接错误
      conn.on('error', (error: any) => {
        console.error('P2P: Connection error with', peerId, ':', error);
        this.connectionHandlers.onError?.(error);
      });
    });
  }

  /**
   * 连接到主机
   */
  async connectToHost(hostId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }

      console.log('P2P: Connecting to host:', hostId);
      const conn = this.peer.connect(hostId, { reliable: true });

      // 连接打开时
      conn.on('open', () => {
        console.log('P2P: Connection opened with:', hostId);
        console.log('P2P: Connection open state:', conn.open);
        this.connections.set(hostId, conn);
        this.hostId = hostId;
        this.isHost = false;
        
        // 设置消息接收处理
        conn.on('data', (data: any) => {
          console.log('P2P: Received data from host:', hostId);
          // 确保 senderId 正确设置
          if (data && !data.senderId) {
            data.senderId = hostId;
          }
          this.handleMessage(data);
        });
        
        resolve(true);
      });

      // 连接错误
      conn.on('error', (error: any) => {
        console.error('P2P: Connection error:', error);
        reject(error);
      });

      // 连接关闭
      conn.on('close', () => {
        console.log('P2P: Connection closed with:', hostId);
        this.connections.delete(hostId);
      });
    });
  }

  /**
   * 等待玩家连接（仅主机）
   */
  waitForConnections(): void {
    // 连接已经在 handleIncomingConnection 中处理
    console.log('P2P: Waiting for player connections...');
  }

  /**
   * 发送消息到特定玩家
   */
  sendTo(playerId: string, message: GameMessage): boolean {
    const conn = this.connections.get(playerId);
    
    if (!conn) {
      console.error('P2P: No connection found for', playerId);
      console.log('Available connections:', Array.from(this.connections.keys()));
      return false;
    }
    
    // PeerJS DataConnection 使用 'open' 状态字符串
    // 直接尝试发送，如果失败则捕获错误
    try {
      conn.send(message);
      console.log('P2P: Message sent to', playerId, 'Type:', message.type);
      return true;
    } catch (error) {
      console.error('P2P: Failed to send message to', playerId, ':', error);
      console.log('Connection state:', conn.open ? 'open' : 'closed');
      return false;
    }
  }

  /**
   * 广播消息到所有连接的玩家
   */
  broadcast(message: GameMessage): boolean {
    let success = true;
    for (const [playerId, _conn] of this.connections.entries()) {
      if (!this.sendTo(playerId, message)) {
        success = false;
      }
    }
    return success;
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: any): void {
    try {
      const message: GameMessage = data;
      console.log('P2P: Received message:', message.type, 'from', message.senderId);

      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      } else {
        console.warn('P2P: No handler for message type:', message.type);
      }
    } catch (error) {
      console.error('P2P: Failed to handle message:', error);
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: MessageType, handler: (message: GameMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 设置房间已存在的回调
   */
  setOnRoomExists(callback: () => void): void {
    this.connectionHandlers.onRoomExists = callback;
  }

  /**
   * 注册连接事件处理器
   */
  onConnectionOpen(handler: (peerId: string) => void): void {
    this.connectionHandlers.onOpen = handler;
  }

  onConnectionClose(handler: (peerId: string) => void): void {
    this.connectionHandlers.onClose = handler;
  }

  onError(handler: (error: any) => void): void {
    this.connectionHandlers.onError = handler;
  }

  /**
   * 获取我的 ID
   */
  getMyId(): string {
    return this.myId;
  }

  /**
   * 获取所有连接的玩家 ID
   */
  getConnectedPlayers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 判断是否为主机
   */
  amIHost(): boolean {
    return this.isHost;
  }

  /**
   * 设置为主机模式
   */
  setAsHost(): void {
    this.isHost = true;
  }

  /**
   * 获取主机 ID
   */
  getHostId(): string | null {
    return this.isHost ? this.myId : this.hostId;
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    for (const [_playerId, conn] of this.connections.entries()) {
      conn.close();
    }
    this.connections.clear();
  }

  /**
   * 销毁 P2P 管理器
   */
  destroy(): void {
    this.disconnectAll();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.messageHandlers.clear();
  }
}

// 创建全局 P2P 管理器实例
export const p2pManager = new P2PManager();