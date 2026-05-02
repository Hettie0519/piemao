import { DurableObject } from 'cloudflare:workers';
import type { GameMessage, Player, GameConfig, GameState, Hand, Card, Rank, Suit } from './types';
import { GameState, MessageType, PlayerStatus, HandType, RockPaperScissorsChoice } from './types';

// 牌值映射
const RANK_VALUES: Record<Rank, number> = {
  '2': 15, 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3,
};

// 所有花色和点数
const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const ALL_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// 房间状态
interface RoomState {
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
  justFinishedPlayer: string | null;
}

// 创建一张牌
function createCard(suit: Suit, rank: Rank, id: string): Card {
  return {
    id,
    suit,
    rank,
    value: RANK_VALUES[rank],
    isRedHeart3: suit === 'hearts' && rank === '3',
  };
}

// 生成伪随机数
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return function() {
    let t = hash += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 创建牌堆
function createDeck(deckCount: number): Card[] {
  const deck: Card[] = [];
  let cardId = 0;
  for (let d = 0; d < deckCount; d++) {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        deck.push(createCard(suit, rank, `card_${d}_${cardId++}`));
      }
    }
  }
  return deck;
}

// 洗牌
function shuffleDeck(deck: Card[], seed: string): Card[] {
  const random = seededRandom(seed);
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// 发牌
function dealGame(seed: string, deckCount: number, playerCount: number): Card[][] {
  const deck = createDeck(deckCount);
  const shuffled = shuffleDeck(deck, seed);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  shuffled.forEach((card, index) => {
    hands[index % playerCount]!.push(card);
  });
  return hands;
}

// 查找红桃3持有者
function findRedHeart3Holders(hands: Card[][]): number[] {
  return hands.reduce((acc, hand, i) => {
    if (hand.some(c => c.isRedHeart3)) acc.push(i);
    return acc;
  }, [] as number[]);
}

// 牌型验证
function validateHand(cards: Card[], minStraight: number, minSisterPair: number): { valid: boolean; type?: HandType; isQiZi?: boolean; error?: string } {
  if (cards.length === 0) return { valid: false, error: '请选择牌' };
  if (cards.length === 1) return { valid: true, type: HandType.SINGLE };

  const firstRank = cards[0]!.rank;
  const allSameRank = cards.every(c => c.rank === firstRank);

  // 对子
  if (cards.length === 2 && allSameRank) return { valid: true, type: HandType.PAIR };

  // 炸弹 (3张)
  if (cards.length === 3 && allSameRank) return { valid: true, type: HandType.BOMB };

  // 轰雷 (4张)
  if (cards.length === 4 && allSameRank) return { valid: true, type: HandType.THUNDER };

  // 多张 (5+)
  if (cards.length >= 5 && allSameRank) return { valid: true, type: HandType.MULTI };

  // 顺子
  if (cards.length >= minStraight && !cards.some(c => c.rank === '2')) {
    const sorted = [...cards].sort((a, b) => a.value - b.value);
    let isStraight = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.value - sorted[i - 1]!.value !== 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) return { valid: true, type: HandType.STRAIGHT };
  }

  // 姐妹对
  if (cards.length >= minSisterPair * 2 && cards.length % 2 === 0 && !cards.some(c => c.rank === '2')) {
    const rankGroups = new Map<Rank, Card[]>();
    cards.forEach(c => {
      if (!rankGroups.has(c.rank)) rankGroups.set(c.rank, []);
      rankGroups.get(c.rank)!.push(c);
    });
    const allPairs = Array.from(rankGroups.values()).every(g => g.length === 2);
    if (allPairs && rankGroups.size >= minSisterPair) {
      const ranks = Array.from(rankGroups.keys()).sort((a, b) => RANK_VALUES[a] - RANK_VALUES[b]);
      let consecutive = true;
      for (let i = 1; i < ranks.length; i++) {
        if (RANK_VALUES[ranks[i]!] - RANK_VALUES[ranks[i - 1]!] !== 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) return { valid: true, type: HandType.SISTER_PAIR };
    }
  }

  return { valid: false, error: '无效的牌型' };
}

// 检查起子
function isQiZi(cards: Card[], targetType: HandType, targetCount: number): boolean {
  if (!cards.every(c => c.rank === '4')) return false;
  const count = cards.length;
  if (targetType === HandType.BOMB && count === 2) return true;
  if (targetType === HandType.THUNDER && count === 3) return true;
  if (targetType === HandType.MULTI && count >= 4 && count === targetCount - 1) return true;
  return false;
}

// 比较牌型
function canBeatHand(cards: Card[], lastHand: Hand | null, minStraight: number, minSisterPair: number): { canBeat: boolean; isQiZi: boolean } {
  const validation = validateHand(cards, minStraight, minSisterPair);
  if (!validation.valid) return { canBeat: false, isQiZi: false };

  if (!lastHand) return { canBeat: true, isQiZi: false };

  // 检查起子
  if (lastHand && !lastHand.isQiZi) {
    if (isQiZi(cards, lastHand.type, lastHand.count)) {
      return { canBeat: true, isQiZi: true };
    }
  }

  const hand: Hand = {
    type: validation.type!,
    cards,
    count: cards.length,
    rank: cards[0]!.rank,
    isQiZi: false,
  };

  // 同类型比较
  if (hand.type === lastHand.type) {
    if (hand.count !== lastHand.count) return { canBeat: false, isQiZi: false };
    return { canBeat: RANK_VALUES[hand.rank] > RANK_VALUES[lastHand.rank], isQiZi: false };
  }

  // 特殊牌型层级
  const specialRank: Record<HandType, number> = {
    [HandType.BOMB]: 1, [HandType.THUNDER]: 2, [HandType.MULTI]: 3,
    [HandType.SINGLE]: 0, [HandType.PAIR]: 0, [HandType.STRAIGHT]: 0, [HandType.SISTER_PAIR]: 0,
  };

  const isHand1Special = specialRank[hand.type] > 0;
  const isHand2Special = specialRank[lastHand.type] > 0;

  if (isHand1Special && isHand2Special) {
    if (specialRank[hand.type] > specialRank[lastHand.type]) return { canBeat: true, isQiZi: false };
    return { canBeat: false, isQiZi: false };
  }

  if (isHand1Special && !isHand2Special) return { canBeat: true, isQiZi: false };

  return { canBeat: false, isQiZi: false };
}

// 石头剪子布比较
function compareRPS(c1: RockPaperScissorsChoice, c2: RockPaperScissorsChoice): number {
  if (c1 === c2) return 0;
  if (c1 === RockPaperScissorsChoice.ROCK && c2 === RockPaperScissorsChoice.SCISSORS) return 1;
  if (c1 === RockPaperScissorsChoice.SCISSORS && c2 === RockPaperScissorsChoice.PAPER) return 1;
  if (c1 === RockPaperScissorsChoice.PAPER && c2 === RockPaperScissorsChoice.ROCK) return 1;
  return -1;
}

export class Room extends DurableObject {
  private sessions = new Map<WebSocket, string>();
  private state: RoomState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.state = this.createInitialState();
    this.loadState();
  }

  private createInitialState(): RoomState {
    return {
      players: new Map(),
      gameConfig: { deckCount: 1, minStraight: 3, minSisterPair: 3 },
      gameState: GameState.LOBBY,
      gameSeed: '',
      currentPlayerIndex: 0,
      lastHand: null,
      lastPlayerId: null,
      consecutivePasses: 0,
      rpsPlayers: [],
      rpsChoices: new Map(),
      finishOrder: [],
      justFinishedPlayer: null,
    };
  }

  private async loadState() {
    const stored = await this.ctx.storage.get<RoomState>('gameState');
    if (stored) {
      this.state = {
        ...stored,
        players: new Map(Object.entries(stored.players as unknown as Record<string, Player>)),
        rpsChoices: new Map(Object.entries(stored.rpsChoices as unknown as Record<string, RockPaperScissorsChoice>)),
      };
    }
  }

  private async saveState() {
    const toStore = {
      ...this.state,
      players: Object.fromEntries(this.state.players),
      rpsChoices: Object.fromEntries(this.state.rpsChoices),
    };
    await this.ctx.storage.put('gameState', toStore);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 处理内部重置请求
    if (url.pathname === '/reset' && request.method === 'POST') {
      this.state = this.createInitialState();
      await this.ctx.storage.deleteAll();
      return new Response(JSON.stringify({ status: 'reset' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const msg: GameMessage = JSON.parse(message);
      await this.handleMessage(ws, msg);
    } catch (error) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, payload: { message: 'Invalid message' } }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    const playerId = this.sessions.get(ws);
    if (playerId) {
      const player = this.state.players.get(playerId);
      if (player) {
        // 只标记为断开，不移除玩家（支持重连）
        player.isConnected = false;
        // 广播玩家断开消息
        this.broadcast({
          type: MessageType.PLAYER_LEAVE,
          senderId: playerId,
          timestamp: Date.now(),
          payload: { playerId, disconnected: true },
        });
      }
      this.sessions.delete(ws);
      await this.saveState();
    }
  }

  private async handleMessage(ws: WebSocket, msg: GameMessage) {
    switch (msg.type) {
      case MessageType.JOIN_ROOM:
        await this.handleJoinRoom(ws, msg);
        break;
      case MessageType.UPDATE_PLAYER_NAME:
        await this.handleUpdatePlayerName(msg);
        break;
      case MessageType.GAME_START:
        await this.handleStartGame(msg);
        break;
      case MessageType.PLAY_HAND:
        await this.handlePlayHand(msg);
        break;
      case MessageType.PASS:
        await this.handlePass(msg);
        break;
      case MessageType.RPS_CHOICE:
        await this.handleRPSChoice(msg);
        break;
      case MessageType.NEXT_ROUND:
        await this.handleStartGame(msg);
        break;
    }
  }

  private async handleJoinRoom(ws: WebSocket, msg: GameMessage) {
    const { playerName } = msg.payload;
    const playerId = msg.senderId;

    this.sessions.set(ws, playerId);

    // 检查是否是重连的玩家
    const existingPlayer = this.state.players.get(playerId);
    if (existingPlayer) {
      // 重连：恢复连接状态
      existingPlayer.isConnected = true;
      if (playerName && playerName.trim()) {
        existingPlayer.name = playerName;
      }

      // 广播玩家重连
      this.broadcast({
        type: MessageType.PLAYER_JOIN,
        senderId: playerId,
        timestamp: Date.now(),
        payload: { player: existingPlayer, reconnected: true },
      }, ws);

      // 发送当前状态给重连玩家
      ws.send(JSON.stringify({
        type: MessageType.STATE_SYNC,
        payload: {
          players: Array.from(this.state.players.values()),
          gameConfig: this.state.gameConfig,
          gameState: this.state.gameState,
          currentPlayerIndex: this.state.currentPlayerIndex,
          gameSeed: this.state.gameSeed,
          lastHand: this.state.lastHand,
          lastPlayerId: this.state.lastPlayerId,
        },
      }));

      await this.saveState();
      return;
    }

    // 新玩家加入
    const isNewGame = this.state.gameState === GameState.LOBBY || this.state.players.size === 0;
    const playerStatus = isNewGame ? PlayerStatus.PLAYING : PlayerStatus.WAITING;

    const player: Player = {
      id: playerId,
      name: playerName || `玩家${this.state.players.size + 1}`,
      isHost: this.state.players.size === 0,
      handCount: 0,
      isConnected: true,
      status: playerStatus,
    };

    this.state.players.set(playerId, player);

    this.broadcast({
      type: MessageType.PLAYER_JOIN,
      senderId: playerId,
      timestamp: Date.now(),
      payload: { player },
    }, ws);

    ws.send(JSON.stringify({
      type: MessageType.STATE_SYNC,
      payload: {
        players: Array.from(this.state.players.values()),
        gameConfig: this.state.gameConfig,
        gameState: this.state.gameState,
        currentPlayerIndex: this.state.currentPlayerIndex,
      },
    }));

    await this.saveState();
  }

  private async handleUpdatePlayerName(msg: GameMessage) {
    const { playerName } = msg.payload;
    const playerId = msg.senderId;
    const player = this.state.players.get(playerId);
    if (player && playerName) {
      player.name = playerName;
      this.broadcast({ type: MessageType.UPDATE_PLAYER_NAME, senderId: playerId, payload: { playerId, playerName } });
      await this.saveState();
    }
  }

  private async handleStartGame(msg: GameMessage) {
    const { config } = msg.payload;
    if (config) this.state.gameConfig = config;

    // 更新所有等待玩家为游戏中
    this.state.players.forEach(p => {
      if (p.status === PlayerStatus.WAITING) p.status = PlayerStatus.PLAYING;
    });

    const players = Array.from(this.state.players.values()).filter(p => p.status === PlayerStatus.PLAYING);
    const playerCount = players.length;

    this.state.gameSeed = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    this.state.gameState = GameState.DEALING;

    const hands = dealGame(this.state.gameSeed, this.state.gameConfig.deckCount, playerCount);
    const redHeart3Holders = findRedHeart3Holders(hands);

    // 更新手牌数量
    players.forEach((player, index) => {
      player.handCount = hands[index]?.length || 0;
    });

    this.state.finishOrder = [];
    this.state.lastHand = null;
    this.state.lastPlayerId = null;
    this.state.consecutivePasses = 0;
    this.state.justFinishedPlayer = null;

    if (redHeart3Holders.length === 1) {
      this.state.currentPlayerIndex = redHeart3Holders[0]!;
      this.state.gameState = GameState.PLAYING;
    } else if (redHeart3Holders.length > 1) {
      this.state.rpsPlayers = redHeart3Holders;
      this.state.rpsChoices.clear();
      this.state.gameState = GameState.ROCK_PAPER_SCISSORS;
    } else {
      this.state.currentPlayerIndex = 0;
      this.state.gameState = GameState.PLAYING;
    }

    this.broadcast({
      type: MessageType.GAME_START,
      payload: {
        seed: this.state.gameSeed,
        config: this.state.gameConfig,
        playerOrder: players.map(p => p.id),
        currentPlayerIndex: this.state.currentPlayerIndex,
        players: players,
        gameState: this.state.gameState,
        rpsPlayers: this.state.rpsPlayers,
      },
    });

    await this.saveState();
  }

  private async handlePlayHand(msg: GameMessage) {
    const { cards: cardIds, cardDetails } = msg.payload;
    const playerId = msg.senderId;
    const player = this.state.players.get(playerId);
    if (!player) return;

    const cards = cardDetails || [];
    player.handCount = Math.max(0, player.handCount - cardIds.length);

    const validation = validateHand(cards, this.state.gameConfig.minStraight, this.state.gameConfig.minSisterPair);

    this.state.lastHand = {
      type: validation.type || HandType.SINGLE,
      cards,
      count: cards.length,
      rank: cards[0]?.rank || '3',
      isQiZi: msg.payload.isQiZi || false,
    };
    this.state.lastPlayerId = playerId;
    this.state.consecutivePasses = 0;

    // 计算下一个玩家
    const players = Array.from(this.state.players.values()).filter(p => p.status === PlayerStatus.PLAYING);
    let nextIndex = (this.state.currentPlayerIndex + 1) % players.length;
    while (players[nextIndex]?.handCount === 0) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    this.state.currentPlayerIndex = nextIndex;

    this.broadcast({
      type: MessageType.PLAY_HAND,
      senderId: playerId,
      payload: {
        cards: cardIds,
        cardDetails: cards,
        handType: validation.type,
        isQiZi: msg.payload.isQiZi,
        nextPlayerIndex: nextIndex,
        handCount: player.handCount,
      },
    });

    // 检查玩家是否出完牌
    if (player.handCount === 0) {
      this.state.finishOrder.push(playerId);
      this.state.justFinishedPlayer = playerId;

      // 检查游戏是否结束
      const playersWithCards = players.filter(p => p.handCount > 0);
      if (playersWithCards.length <= 1) {
        this.state.gameState = GameState.ENDED;
        const rankings = players.sort((a, b) => {
          const idxA = this.state.finishOrder.indexOf(a.id);
          const idxB = this.state.finishOrder.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.handCount - b.handCount;
        }).map(p => ({ id: p.id, name: p.name, handCount: p.handCount }));

        this.broadcast({
          type: MessageType.GAME_END,
          payload: { winnerId: playerId, winnerName: player.name, rankings },
        });
      }
    }

    await this.saveState();
  }

  private async handlePass(msg: GameMessage) {
    const playerId = msg.senderId;
    this.state.consecutivePasses++;

    const players = Array.from(this.state.players.values()).filter(p => p.status === PlayerStatus.PLAYING);
    let nextIndex = (this.state.currentPlayerIndex + 1) % players.length;
    while (players[nextIndex]?.handCount === 0) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    this.state.currentPlayerIndex = nextIndex;

    // 检查是否所有人都过牌
    const playersWithCards = players.filter(p => p.handCount > 0);
    const requiredPasses = this.state.justFinishedPlayer ? playersWithCards.length : playersWithCards.length - 1;

    if (this.state.consecutivePasses >= requiredPasses) {
      this.state.lastHand = null;
      this.state.consecutivePasses = 0;
      this.state.justFinishedPlayer = null;
    }

    // 如果轮回到上一个出牌的人
    if (this.state.lastPlayerId && players[nextIndex]?.id === this.state.lastPlayerId) {
      this.state.lastHand = null;
      this.state.lastPlayerId = null;
      this.state.consecutivePasses = 0;
    }

    this.broadcast({
      type: MessageType.PASS,
      senderId: playerId,
      payload: { nextPlayerIndex: nextIndex },
    });

    await this.saveState();
  }

  private async handleRPSChoice(msg: GameMessage) {
    const { choice } = msg.payload;
    const playerId = msg.senderId;
    this.state.rpsChoices.set(playerId, choice);

    // 检查是否所有人都已选择
    const allChosen = this.state.rpsPlayers.every(idx => {
      const player = Array.from(this.state.players.values())[idx];
      return player && this.state.rpsChoices.has(player.id);
    });

    if (allChosen) {
      const choices = this.state.rpsPlayers.map(idx => {
        const player = Array.from(this.state.players.values())[idx]!;
        return { playerId: player.id, choice: this.state.rpsChoices.get(player.id)! };
      });

      // 检查平局
      const firstChoice = choices[0]?.choice;
      const allSame = choices.every(c => c.choice === firstChoice);
      if (allSame) {
        this.state.rpsChoices.clear();
        this.broadcast({ type: MessageType.STATE_SYNC, payload: { rpsReset: true } });
        return;
      }

      // 找出胜者
      const winner = choices.reduce((prev, curr) => compareRPS(curr.choice, prev.choice) > 0 ? curr : prev);
      const winnerIdx = this.state.rpsPlayers.find(idx => {
        const player = Array.from(this.state.players.values())[idx];
        return player?.id === winner.playerId;
      });

      if (winnerIdx !== undefined) {
        this.state.currentPlayerIndex = winnerIdx;
        this.state.gameState = GameState.PLAYING;
        this.state.rpsPlayers = [];
        this.state.rpsChoices.clear();

        this.broadcast({
          type: MessageType.STATE_SYNC,
          payload: {
            currentPlayerIndex: winnerIdx,
            gameState: GameState.PLAYING,
          },
        });
      }
    }

    await this.saveState();
  }

  private broadcast(message: GameMessage, excludeWs?: WebSocket) {
    const payload = JSON.stringify({ ...message, timestamp: Date.now() });
    for (const [ws] of this.sessions) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}
