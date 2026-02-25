// 牌面花色
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// 牌面点数
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

// 牌型
export enum HandType {
  SINGLE = 'single',          // 单牌
  PAIR = 'pair',              // 对子
  STRAIGHT = 'straight',      // 顺子（链链）
  SISTER_PAIR = 'sister_pair', // 姐妹对
  BOMB = 'bomb',              // 炸弹（3张同点）
  THUNDER = 'thunder',        // 轰雷（4张同点）
  MULTI = 'multi',            // 多张同点（5张及以上）
}

// 牌张
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;  // 比较用的数值
  isRedHeart3: boolean;
}

// 牌型组合
export interface Hand {
  type: HandType;
  cards: Card[];
  count: number;
  rank: Rank;
  isQiZi: boolean;  // 是否为"起子"状态
}

// 玩家信息
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  handCount: number;
  isConnected: boolean;
}

// 游戏配置
export interface GameConfig {
  deckCount: number;  // 牌副数（1-10）
  minStraight: number;
  minSisterPair: number;
}

// 游戏状态
export enum GameState {
  LOBBY = 'lobby',        // 大厅等待中
  DEALING = 'dealing',    // 发牌中
  PLAYING = 'playing',    // 游戏进行中
  ENDED = 'ended',        // 游戏结束
}

// 游戏消息类型
export enum MessageType {
  // 房间管理
  CREATE_ROOM = 'create_room',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
  
  // 游戏控制
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  NEXT_ROUND = 'next_round',
  
  // 游戏操作
  PLAY_HAND = 'play_hand',
  PASS = 'pass',
  
  // 状态同步
  STATE_SYNC = 'state_sync',
  ERROR = 'error',
}

// 游戏消息
export interface GameMessage {
  type: MessageType;
  timestamp: number;
  senderId: string;
  payload: any;
}

// 游戏上下文
export interface GameContext {
  state: GameState;
  config: GameConfig;
  players: Player[];
  currentPlayerIndex: number;
  lastHand: Hand | null;
  lastPlayerId: string | null;
  consecutivePasses: number;
  seed: string;
}

// 牌型判定结果
export interface HandValidation {
  valid: boolean;
  type?: HandType;
  isQiZi?: boolean;
  error?: string;
}

// 比较结果
export enum ComparisonResult {
  WIN = 'win',
  LOSE = 'lose',
  INVALID = 'invalid',
}