// 牌面花色
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// 牌面点数
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

// 牌型
export enum HandType {
  SINGLE = 'single',
  PAIR = 'pair',
  STRAIGHT = 'straight',
  SISTER_PAIR = 'sister_pair',
  BOMB = 'bomb',
  THUNDER = 'thunder',
  MULTI = 'multi',
}

// 牌张
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
  isRedHeart3: boolean;
}

// 牌型组合
export interface Hand {
  type: HandType;
  cards: Card[];
  count: number;
  rank: Rank;
  isQiZi: boolean;
}

// 玩家状态
export enum PlayerStatus {
  PLAYING = 'playing',
  WAITING = 'waiting',
}

// 玩家信息
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  handCount: number;
  isConnected: boolean;
  status: PlayerStatus;
}

// 游戏配置
export interface GameConfig {
  deckCount: number;
  minStraight: number;
  minSisterPair: number;
}

// 游戏状态
export enum GameState {
  LOBBY = 'lobby',
  DEALING = 'dealing',
  ROCK_PAPER_SCISSORS = 'rock_paper_scissors',
  PLAYING = 'playing',
  ENDED = 'ended',
}

// 消息类型
export enum MessageType {
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
  UPDATE_PLAYER_NAME = 'update_player_name',
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  NEXT_ROUND = 'next_round',
  PLAY_HAND = 'play_hand',
  PASS = 'pass',
  RPS_CHOICE = 'rps_choice',
  CHAT_MESSAGE = 'chat_message',
  STATE_SYNC = 'state_sync',
  ERROR = 'error',
  RETURN_TO_LOBBY = 'return_to_lobby',
  WAITING_FOR_RECONNECT = 'waiting_for_reconnect',
  PLAYER_RECONNECTED = 'player_reconnected',
}

// 游戏消息
export interface GameMessage {
  type: MessageType;
  timestamp: number;
  senderId: string;
  payload: any;
}

// 石头剪子布选择
export enum RockPaperScissorsChoice {
  ROCK = 'rock',
  PAPER = 'paper',
  SCISSORS = 'scissors',
}

// 房间状态
export interface RoomState {
  players: Map<string, Player>;
  gameConfig: GameConfig;
  gameState: GameState;
  gameSeed: string;
  currentPlayerIndex: number;
  lastHand: Hand | null;
  lastPlayerId: string | null;
  consecutivePasses: number;
  rpsPlayers: number[];
  rpsChoices: Map<string, RockPaperScissorsChoice>;
  finishOrder: string[];
}
