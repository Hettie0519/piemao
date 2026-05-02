import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Card, Player, GameConfig, GameMessage, Hand, ChatMessage } from '../types/game';
import { GameState, MessageType, PlayerStatus, RockPaperScissorsChoice } from '../types/game';
import { wsManager } from '../utils/wsManager';
import { dealGame } from '../utils/dealer';
import { sortCards, validateHand, canBeatHand } from '../utils/cardUtils';

export const useGameStore = defineStore('game', () => {
  // 玩家信息
  const myPlayerId = ref('');
  const myPlayerName = ref('');
  const players = ref<Player[]>([]);

  // 游戏配置
  const config = ref<GameConfig>({
    deckCount: 1,
    minStraight: 3,
    minSisterPair: 3,
  });

  // 游戏状态
  const gameState = ref<GameState>(GameState.LOBBY);
  const gameSeed = ref('');

  // 手牌
  const myHand = ref<Card[]>([]);

  // 游戏进行状态
  const currentPlayerIndex = ref(0);
  const lastHand = ref<Hand | null>(null);
  const lastPlayerId = ref<string | null>(null);
  const consecutivePasses = ref(0);

  // 石头剪子布状态
  const rpsPlayers = ref<number[]>([]);
  const rpsChoices = ref<Map<string, RockPaperScissorsChoice>>(new Map());
  const myRPSChoice = ref<RockPaperScissorsChoice | null>(null);

  // 记录玩家出完牌的顺序
  const finishOrder = ref<string[]>([]);

  // 聊天消息
  const chatMessages = ref<ChatMessage[]>([]);

  // 游戏排名
  const gameRankings = ref<Array<{id: string, name: string, handCount: number}>>([]);

  // 计算属性
  const myPlayer = computed(() => {
    return players.value.find(p => p.id === myPlayerId.value);
  });

  const currentPlayer = computed(() => {
    return players.value[currentPlayerIndex.value];
  });

  const isMyTurn = computed(() => {
    return currentPlayer.value?.id === myPlayerId.value;
  });

  const canPass = computed(() => {
    return lastHand.value !== null && isMyTurn.value;
  });

  const isHost = computed(() => {
    return myPlayer.value?.isHost || players.value[0]?.id === myPlayerId.value;
  });

  /**
   * 初始化并连接到服务器
   */
  async function initialize(playerName: string): Promise<void> {
    myPlayerName.value = playerName;
    myPlayerId.value = wsManager.getMyId();

    // 注册消息处理器
    registerMessageHandlers();

    // 连接到服务器
    await wsManager.connect();
  }

  /**
   * 发送加入房间请求
   */
  function joinGame(playerName: string): void {
    wsManager.send({
      type: MessageType.JOIN_ROOM,
      payload: { playerName },
    });
  }

  /**
   * 开始游戏
   */
  function startGame(): void {
    wsManager.send({
      type: MessageType.GAME_START,
      payload: { config: config.value },
    });
  }

  /**
   * 出牌
   */
  function playHand(cards: Card[]): void {
    if (!isMyTurn.value) {
      alert('现在不是你的回合');
      return;
    }

    const validation = validateHand(cards, config.value.minStraight, config.value.minSisterPair);
    if (!validation.valid) {
      alert(validation.error || '无效的牌型');
      return;
    }

    let beatResult = { canBeat: true, isQiZi: false };
    if (lastHand.value && lastHand.value.cards.length > 0) {
      beatResult = canBeatHand(cards, lastHand.value, config.value.minStraight, config.value.minSisterPair);
      if (!beatResult.canBeat) {
        alert('你的牌管不住上家的牌');
        return;
      }
    }

    // 从手牌中移除
    myHand.value = myHand.value.filter(c => !cards.includes(c));

    wsManager.send({
      type: MessageType.PLAY_HAND,
      payload: {
        cards: cards.map(c => c.id),
        cardDetails: cards,
        handType: validation.type,
        isQiZi: beatResult.isQiZi || validation.isQiZi || false,
      },
    });
  }

  /**
   * 过牌
   */
  function pass(): void {
    if (!isMyTurn.value) {
      alert('现在不是你的回合');
      return;
    }

    if (!canPass.value) {
      alert('现在不能过牌');
      return;
    }

    wsManager.send({
      type: MessageType.PASS,
    });
  }

  /**
   * 提交石头剪子布选择
   */
  function submitRPSChoice(choice: RockPaperScissorsChoice): void {
    if (gameState.value !== GameState.ROCK_PAPER_SCISSORS) return;

    myRPSChoice.value = choice;

    wsManager.send({
      type: MessageType.RPS_CHOICE,
      payload: { choice },
    });
  }

  /**
   * 发送聊天消息
   */
  function sendChatMessage(message: string): void {
    chatMessages.value = chatMessages.value.filter(m => m.playerId !== myPlayerId.value);

    const chatMessage: ChatMessage = {
      id: `${myPlayerId.value}_${Date.now()}`,
      playerId: myPlayerId.value,
      playerName: myPlayerName.value,
      message,
      timestamp: Date.now(),
    };

    chatMessages.value.push(chatMessage);

    wsManager.send({
      type: MessageType.CHAT_MESSAGE,
      payload: { chatMessage },
    });
  }

  /**
   * 更新玩家昵称
   */
  function updatePlayerName(playerName: string): void {
    myPlayerName.value = playerName;
    wsManager.send({
      type: MessageType.UPDATE_PLAYER_NAME,
      payload: { playerName },
    });
  }

  /**
   * 下一局
   */
  function nextRound(): void {
    wsManager.send({
      type: MessageType.NEXT_ROUND,
    });
  }

  /**
   * 注册消息处理器
   */
  function registerMessageHandlers(): void {
    // 状态同步
    wsManager.onMessage(MessageType.STATE_SYNC, (message: GameMessage) => {
      const { players: updatedPlayers, gameConfig, gameState: newGameState, currentPlayerIndex: newCurrentPlayerIndex, rpsReset } = message.payload;

      if (updatedPlayers) {
        players.value = updatedPlayers;
      }
      if (gameConfig) {
        config.value = gameConfig;
      }
      if (newGameState !== undefined) {
        gameState.value = newGameState;
      }
      if (newCurrentPlayerIndex !== undefined) {
        currentPlayerIndex.value = newCurrentPlayerIndex;
      }
      if (rpsReset) {
        rpsChoices.value.clear();
        myRPSChoice.value = null;
      }
      if (newGameState === GameState.PLAYING) {
        rpsPlayers.value = [];
        rpsChoices.value.clear();
        myRPSChoice.value = null;
      }
    });

    // 玩家加入
    wsManager.onMessage(MessageType.PLAYER_JOIN, (message: GameMessage) => {
      const { player } = message.payload;
      if (player && !players.value.find(p => p.id === player.id)) {
        players.value.push(player);
      }
    });

    // 玩家离开
    wsManager.onMessage(MessageType.PLAYER_LEAVE, (message: GameMessage) => {
      const { playerId } = message.payload;
      const index = players.value.findIndex(p => p.id === playerId);
      if (index !== -1) {
        players.value.splice(index, 1);
      }
    });

    // 昵称更新
    wsManager.onMessage(MessageType.UPDATE_PLAYER_NAME, (message: GameMessage) => {
      const { playerId, playerName } = message.payload;
      const player = players.value.find(p => p.id === playerId);
      if (player) {
        player.name = playerName;
      }
    });

    // 游戏开始
    wsManager.onMessage(MessageType.GAME_START, (message: GameMessage) => {
      const { seed, config: newConfig, playerOrder, currentPlayerIndex: newCurrentPlayerIndex, players: updatedPlayers, gameState: newGameState, rpsPlayers: newRpsPlayers } = message.payload;

      gameSeed.value = seed;
      config.value = newConfig;
      currentPlayerIndex.value = newCurrentPlayerIndex;

      lastHand.value = null;
      lastPlayerId.value = null;
      consecutivePasses.value = 0;
      finishOrder.value = [];

      if (updatedPlayers) {
        players.value = updatedPlayers;
      }

      // 计算自己的手牌
      const myIndex = playerOrder.indexOf(myPlayerId.value);
      if (myIndex !== -1) {
        const hands = dealGame(seed, config.value.deckCount, playerOrder.length);
        if (hands[myIndex]) {
          myHand.value = sortCards(hands[myIndex]);
        }
      }

      gameState.value = newGameState || GameState.PLAYING;

      if (newGameState === GameState.ROCK_PAPER_SCISSORS && newRpsPlayers) {
        rpsPlayers.value = newRpsPlayers;
        rpsChoices.value.clear();
        myRPSChoice.value = null;
      }
    });

    // 出牌
    wsManager.onMessage(MessageType.PLAY_HAND, (message: GameMessage) => {
      const { cardDetails, handType, isQiZi, nextPlayerIndex, handCount } = message.payload;
      const playerId = message.senderId;
      const player = players.value.find(p => p.id === playerId);

      if (player && handCount !== undefined) {
        player.handCount = handCount;
      }

      const cards = cardDetails || [];
      const validation = validateHand(cards, config.value.minStraight, config.value.minSisterPair);

      consecutivePasses.value = 0;

      lastHand.value = {
        type: handType || validation.type || 'single',
        cards,
        count: cards.length,
        rank: cards.length > 0 ? cards[0].rank : '3',
        isQiZi: isQiZi || false,
      };

      lastPlayerId.value = playerId;

      if (nextPlayerIndex !== undefined) {
        currentPlayerIndex.value = nextPlayerIndex;
      }

      // 记录出完牌顺序
      if (player && player.handCount === 0 && !finishOrder.value.includes(playerId)) {
        finishOrder.value.push(playerId);
      }
    });

    // 过牌
    wsManager.onMessage(MessageType.PASS, (message: GameMessage) => {
      const { nextPlayerIndex } = message.payload;

      consecutivePasses.value++;

      const playersWithCards = players.value.filter(p => p.status === PlayerStatus.PLAYING && p.handCount > 0);
      const anyPlayerFinished = players.value.some(p => p.status === PlayerStatus.PLAYING && p.handCount === 0);

      const requiredPasses = anyPlayerFinished ? playersWithCards.length : playersWithCards.length - 1;

      if (consecutivePasses.value >= requiredPasses) {
        lastHand.value = null;
        consecutivePasses.value = 0;
      }

      if (nextPlayerIndex !== undefined) {
        currentPlayerIndex.value = nextPlayerIndex;

        if (lastPlayerId.value && players.value[nextPlayerIndex]?.id === lastPlayerId.value) {
          lastHand.value = null;
          lastPlayerId.value = null;
          consecutivePasses.value = 0;
        }
      }
    });

    // 游戏结束
    wsManager.onMessage(MessageType.GAME_END, (message: GameMessage) => {
      const { rankings } = message.payload;

      gameState.value = GameState.ENDED;

      if (rankings) {
        gameRankings.value = rankings;

        players.value.forEach(player => {
          const ranking = rankings.find((r: any) => r.id === player.id);
          if (ranking) {
            player.handCount = ranking.handCount;
          }
        });
      }
    });

    // 聊天消息
    wsManager.onMessage(MessageType.CHAT_MESSAGE, (message: GameMessage) => {
      const { chatMessage } = message.payload;
      if (chatMessage) {
        chatMessages.value = chatMessages.value.filter(m => m.playerId !== chatMessage.playerId);
        chatMessages.value.push(chatMessage);
      }
    });

    // 连接关闭
    wsManager.onClose(() => {
      console.log('Connection closed');
    });
  }

  return {
    // 状态
    myPlayerId,
    myPlayerName,
    players,
    config,
    gameState,
    gameSeed,
    myHand,
    currentPlayerIndex,
    lastHand,
    lastPlayerId,
    consecutivePasses,
    rpsPlayers,
    rpsChoices,
    myRPSChoice,
    chatMessages,
    gameRankings,

    // 计算属性
    myPlayer,
    currentPlayer,
    isMyTurn,
    canPass,
    isHost,

    // 方法
    initialize,
    joinGame,
    startGame,
    playHand,
    pass,
    submitRPSChoice,
    sendChatMessage,
    updatePlayerName,
    nextRound,
  };
});
