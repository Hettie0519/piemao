import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Card, Player, GameConfig, GameMessage, Hand } from '../types/game';
import { GameState, MessageType, ComparisonResult } from '../types/game';
import { p2pManager } from '../utils/p2pManager';
import { dealGame, findRedHeart3Holder, generateSeed } from '../utils/dealer';
import { sortCards, validateHand, createHand, compareHands } from '../utils/cardUtils';

export const useGameStore = defineStore('game', () => {
  // 玩家信息
  const myPlayerId = ref('');
  const myPlayerName = ref('');
  const players = ref<Player[]>([]);
  
  // 房间信息
  const roomId = ref('');
  const isHost = ref(false);
  
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
    const can = lastHand.value !== null && isMyTurn.value;
    console.log('canPass 检查:', {
      lastHand: lastHand.value,
      isMyTurn: isMyTurn.value,
      currentPlayerIndex: currentPlayerIndex.value,
      myPlayerId: myPlayerId.value,
      currentPlayer: currentPlayer.value,
      result: can
    });
    return can;
  });
  
  /**
   * 初始化
   */
  async function initialize(playerName: string): Promise<void> {
    myPlayerName.value = playerName;
    
    // 等待 PeerJS 初始化完成
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const id = p2pManager.getMyId();
        if (id) {
          myPlayerId.value = id;
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    console.log('初始化完成，我的 ID:', myPlayerId.value);
    
    // 注册消息处理器
    registerMessageHandlers();
  }
  
  /**
   * 创建房间
   */
  function createRoom(): void {
    isHost.value = true;
    p2pManager.setAsHost();
    roomId.value = generateSeed().substring(0, 8).toUpperCase();
    
    // 添加自己到玩家列表
    players.value = [{
      id: myPlayerId.value,
      name: myPlayerName.value,
      isHost: true,
      handCount: 0,
      isConnected: true,
    }];
    
    gameState.value = GameState.LOBBY;
  }
  
  /**
   * 加入房间
   */
  async function joinRoom(hostId: string): Promise<boolean> {
    try {
      // 确保 myPlayerId 已设置
      if (!myPlayerId.value) {
        console.warn('myPlayerId 未设置，尝试重新获取');
        myPlayerId.value = p2pManager.getMyId();
        
        if (!myPlayerId.value) {
          console.error('无法获取 myPlayerId，请等待 PeerJS 初始化完成');
          return false;
        }
      }
      
      console.log('正在连接到主机:', hostId);
      console.log('我的 ID:', myPlayerId.value);
      
      // 添加超时处理
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('连接超时，请检查网络或房间号是否正确')), 15000);
      });
      
      await Promise.race([
        p2pManager.connectToHost(hostId),
        timeoutPromise
      ]);
      
      roomId.value = hostId.substring(0, 8).toUpperCase();
      isHost.value = false;
      
      console.log('连接成功，等待连接稳定...');
      
      // 等待连接完全稳定
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('连接已稳定，等待接收房主消息...');
      
      // 监听传入连接（房主可能会主动连接回来）
      p2pManager.onConnectionOpen((peerId) => {
        console.log('收到传入连接:', peerId);
      });
      
      console.log('连接已稳定，发送加入请求');
      console.log('我的昵称:', myPlayerName.value);
      
      // 发送加入请求
      const message: GameMessage = {
        type: MessageType.JOIN_ROOM,
        timestamp: Date.now(),
        senderId: myPlayerId.value,
        payload: {
          playerName: myPlayerName.value,
        },
      };
      
      console.log('发送加入请求:', message);
      const sent = p2pManager.sendTo(hostId, message);
      if (!sent) {
        console.error('发送加入请求失败');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('加入房间失败:', error);
      return false;
    }
  }
  
  /**
   * 开始游戏（仅主机）
   */
  function startGame(): void {
    if (!isHost.value) return;
    
    gameSeed.value = generateSeed();
    gameState.value = GameState.DEALING;
    
    // 发牌
    const hands = dealGame(gameSeed.value, config.value.deckCount, players.value.length);
    
    // 找到红桃3的持有者
    const redHeart3HolderIndex = findRedHeart3Holder(hands);
    
    // 更新每个玩家的手牌数量
    players.value.forEach((player, index) => {
      if (hands[index]) {
        player.handCount = hands[index].length;
      }
    });
    
    // 设置当前玩家（红桃3持有者）
    currentPlayerIndex.value = redHeart3HolderIndex !== null ? redHeart3HolderIndex : 0;
    lastHand.value = null;
    lastPlayerId.value = null;
    consecutivePasses.value = 0;
    
    // 保存自己的手牌
    const myIndex = players.value.findIndex(p => p.id === myPlayerId.value);
    if (myIndex !== -1 && hands[myIndex]) {
      myHand.value = sortCards(hands[myIndex]);
    }
    
    // 广播游戏开始消息（包含玩家列表和手牌数量）
    const message: GameMessage = {
      type: MessageType.GAME_START,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        seed: gameSeed.value,
        config: config.value,
        playerOrder: players.value.map(p => p.id),
        currentPlayerIndex: currentPlayerIndex.value,
        players: players.value, // 添加玩家列表，包含手牌数量
      },
    };
    p2pManager.broadcast(message);
    
    gameState.value = GameState.PLAYING;
  }
  
  /**
   * 出牌
   */
  function playHand(cards: Card[]): void {
    // 验证是否轮到自己
    if (!isMyTurn.value) {
      alert('现在不是你的回合');
      return;
    }
    
    // 验证牌型
    const validation = validateHand(cards, config.value.minStraight, config.value.minSisterPair);
    if (!validation.valid) {
      alert(validation.error || '无效的牌型');
      return;
    }
    
    // 检查是否可以管住上家的牌
    if (lastHand.value && lastHand.value.cards.length > 0) {
      const currentHand = createHand(cards, validation);
      const comparison = compareHands(currentHand, lastHand.value);
      
      console.log('牌型比较:', {
        currentHand: currentHand.type,
        lastHand: lastHand.value.type,
        comparison: comparison,
        currentCards: cards.map(c => `${c.suit}${c.rank}`),
        lastCards: lastHand.value.cards.map(c => `${c.suit}${c.rank}`),
      });
      
      if (comparison !== ComparisonResult.WIN) {
        alert('你的牌管不住上家的牌');
        return;
      }
    }
    
    // 计算下一个玩家索引
    const nextPlayerIndex = (currentPlayerIndex.value + 1) % players.value.length;
    
    const playMessage: GameMessage = {
      type: MessageType.PLAY_HAND,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        cards: cards.map(c => c.id),
        cardDetails: cards, // 包含完整的牌面信息供显示
        handType: validation.type,
        isQiZi: validation.isQiZi || false,
        nextPlayerIndex: nextPlayerIndex, // 包含下一个玩家索引
      },
    };
    
    // 从手牌中移除
    myHand.value = myHand.value.filter(c => !cards.includes(c));
    
    console.log(`出牌后手牌数量: ${myHand.value.length}`);
    
    const currentPlayer = myPlayer.value;
    if (currentPlayer) {
      currentPlayer.handCount = myHand.value.length;
      console.log(`更新 myPlayer.handCount: ${currentPlayer.handCount}`);
    }
    
    // 同时更新 players 数组中的自己
    const myPlayerIndex = players.value.findIndex(p => p.id === myPlayerId.value);
    if (myPlayerIndex !== -1) {
      const myPlayerInList = players.value[myPlayerIndex];
      if (myPlayerInList) {
        myPlayerInList.handCount = myHand.value.length;
        console.log(`更新 players[${myPlayerIndex}].handCount: ${myPlayerInList.handCount}`);
      }
    }
    
    if (isHost.value) {
      // 主机先轮转，然后广播，然后处理自己的消息来检测游戏结束
      currentPlayerIndex.value = nextPlayerIndex;
      p2pManager.broadcast(playMessage);
      
      // 处理自己的出牌消息来检测游戏结束（不轮转）
      handlePlayHand(playMessage, true);
    } else {
      // 发送给主机
      p2pManager.sendTo(p2pManager.getHostId()!, playMessage);
    }
  }
  
  /**
   * 过牌
   */
  function pass(): void {
    // 验证是否轮到自己
    if (!isMyTurn.value) {
      alert('现在不是你的回合');
      return;
    }
    
    if (!canPass.value) {
      alert('现在不能过牌');
      return;
    }
    
    // 计算下一个玩家索引
    const nextPlayerIndex = (currentPlayerIndex.value + 1) % players.value.length;
    
    const passMessage: GameMessage = {
      type: MessageType.PASS,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        nextPlayerIndex: nextPlayerIndex,
      },
    };
    
    if (isHost.value) {
      // 主机先轮转，然后广播
      currentPlayerIndex.value = nextPlayerIndex;
      p2pManager.broadcast(passMessage);
    } else {
      // 发送给主机
      p2pManager.sendTo(p2pManager.getHostId()!, passMessage);
    }
  }
  
  /**
   * 处理游戏开始消息
   */
  function handleGameStart(message: GameMessage): void {
    const { seed, config: newConfig, playerOrder, currentPlayerIndex: newCurrentPlayerIndex, players: updatedPlayers } = message.payload;
    
    gameSeed.value = seed;
    config.value = newConfig;
    currentPlayerIndex.value = newCurrentPlayerIndex;
    
    // 更新玩家列表（包含手牌数量）
    if (updatedPlayers) {
      players.value = updatedPlayers;
    }
    
    // 根据自己的位置计算手牌
    const myIndex = playerOrder.indexOf(myPlayerId.value);
    const hands = dealGame(seed, config.value.deckCount, playerOrder.length);
    if (hands[myIndex]) {
      myHand.value = sortCards(hands[myIndex]);
    }
    
    gameState.value = GameState.PLAYING;
  }
  
  /**
   * 处理出牌消息
   */
  function handlePlayHand(message: GameMessage, isOwnMessage: boolean = false): void {
    const playerIndex = players.value.findIndex(p => p.id === message.senderId);
    if (playerIndex === -1) return;
    
    const player = players.value[playerIndex];
    if (!player) return;
    
    console.log(`处理 ${player.name} 的出牌消息 (isOwnMessage: ${isOwnMessage})`);
    
    // 如果不是自己的消息，才更新手牌数量
    if (!isOwnMessage && message.payload.cards) {
      player.handCount -= message.payload.cards.length;
    }
    
    // 更新最后出牌（存储完整的卡片信息用于显示）
    const cards = message.payload.cardDetails || [];
    const validation = validateHand(cards, config.value.minStraight, config.value.minSisterPair);
    
    lastHand.value = {
      type: message.payload.handType || validation.type || 'single',
      cards: cards,
      count: message.payload.cards?.length || 0,
      rank: cards.length > 0 ? cards[0].rank : '3',
      isQiZi: message.payload.isQiZi || validation.isQiZi || false,
    };
    lastPlayerId.value = message.senderId;
    consecutivePasses.value = 0;
    
    // 从消息中获取下一个玩家索引
    if (message.payload.nextPlayerIndex !== undefined) {
      currentPlayerIndex.value = message.payload.nextPlayerIndex;
      console.log(`轮转到 ${players.value[currentPlayerIndex.value]?.name}`);
    }
    
    // 如果是主机，广播给所有玩家（如果是玩家发给主机的消息）
    if (isHost.value && !isOwnMessage && message.senderId !== myPlayerId.value) {
      p2pManager.broadcast(message);
    }
    
    // 检查游戏是否结束
    if (player.handCount === 0) {
      console.log(`玩家 ${player.name} 手牌归零`);
      
      // 只有主机才处理游戏结束并广播消息
      if (isHost.value) {
        console.log(`我是主机，处理游戏结束并广播`);
        
        gameState.value = GameState.ENDED;
        
        const gameOverMessage: GameMessage = {
          type: MessageType.GAME_END,
          timestamp: Date.now(),
          senderId: myPlayerId.value,
          payload: {
            winnerId: player.id,
            winnerName: player.name,
            rankings: players.value.map(p => ({
              id: p.id,
              name: p.name,
              handCount: p.handCount,
            })),
          },
        };
        
        console.log('广播游戏结束消息');
        const sent = p2pManager.broadcast(gameOverMessage);
        console.log('游戏结束消息发送结果:', sent);
      } else {
        console.log(`我不是主机，等待主机处理游戏结束`);
      }
    }
  }
  
  /**
   * 处理过牌消息
   */
  function handlePass(message: GameMessage): void {
    const playerIndex = players.value.findIndex(p => p.id === message.senderId);
    if (playerIndex === -1) return;
    
    const player = players.value[playerIndex];
    if (!player) return;
    
    console.log(`处理 ${player.name} 的过牌消息`);
    
    consecutivePasses.value++;
    
    // 检查是否所有人都过牌了
    if (consecutivePasses.value >= players.value.length - 1) {
      // 新一轮，最后出牌者先手
      lastHand.value = null;
      consecutivePasses.value = 0;
      console.log('所有人都过牌了，新一轮开始');
    }
    
    // 从消息中获取下一个玩家索引
    if (message.payload.nextPlayerIndex !== undefined) {
      currentPlayerIndex.value = message.payload.nextPlayerIndex;
      console.log(`轮转到 ${players.value[currentPlayerIndex.value]?.name}`);
    }
    
    // 如果是主机，广播给所有玩家（如果是玩家发给主机的消息）
    if (isHost.value && message.senderId !== myPlayerId.value) {
      p2pManager.broadcast(message);
    }
  }
  
  /**
   * 处理游戏结束消息
   */
  function handleGameEnd(message: GameMessage): void {
    console.log('收到游戏结束消息:', message.payload);
    
    const { winnerName, rankings } = message.payload;
    
    console.log(`游戏结束，获胜者: ${winnerName}`);
    
    gameState.value = GameState.ENDED;
    
    // 更新排名信息
    if (rankings) {
      players.value.forEach(player => {
        const ranking = rankings.find((r: any) => r.id === player.id);
        if (ranking) {
          player.handCount = ranking.handCount;
        }
      });
    }
    
    console.log('游戏状态已更新为 END，当前状态:', gameState.value);
  }
  
  /**
   * 处理玩家加入
   */
  async function handlePlayerJoin(message: GameMessage): Promise<void> {
    if (!isHost.value) return;
    
    const newPlayer: Player = {
      id: message.senderId,
      name: message.payload.playerName,
      isHost: false,
      handCount: 0,
      isConnected: true,
    };
    
    players.value.push(newPlayer);
    
    console.log('玩家加入，等待连接稳定...');
    
    // 等待连接完全稳定
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('连接稳定，发送玩家加入广播');
    
    // 广播玩家加入消息（包括所有玩家列表）
    const broadcastMsg: GameMessage = {
      type: MessageType.PLAYER_JOIN,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: { player: newPlayer, players: players.value },
    };
    
    const broadcastSent = p2pManager.broadcast(broadcastMsg);
    console.log('玩家加入广播发送结果:', broadcastSent);
    
    console.log('发送状态同步');
    
    // 发送当前游戏配置给新玩家
    const configMsg: GameMessage = {
      type: MessageType.STATE_SYNC,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        players: players.value,
        config: config.value,
        roomId: roomId.value,
      },
    };
    
    const configSent = p2pManager.sendTo(message.senderId, configMsg);
    console.log('状态同步发送结果:', configSent);
  }
  
  /**
   * 处理玩家离开
   */
  function handlePlayerLeave(message: GameMessage): void {
    const index = players.value.findIndex(p => p.id === message.senderId);
    if (index !== -1) {
      players.value.splice(index, 1);
    }
  }
  
  /**
   * 注册消息处理器
   */
  function registerMessageHandlers(): void {
    p2pManager.onMessage(MessageType.GAME_START, handleGameStart);
    p2pManager.onMessage(MessageType.GAME_END, handleGameEnd);
    p2pManager.onMessage(MessageType.PLAY_HAND, handlePlayHand);
    p2pManager.onMessage(MessageType.PASS, handlePass);
    p2pManager.onMessage(MessageType.JOIN_ROOM, handlePlayerJoin);
    p2pManager.onMessage(MessageType.LEAVE_ROOM, handlePlayerLeave);
    
    // 处理玩家加入广播（非主机玩家接收）
    p2pManager.onMessage(MessageType.PLAYER_JOIN, (message: GameMessage) => {
      if (isHost.value) return; // 主机已经处理过了
      
      const { player, players: updatedPlayers } = message.payload;
      if (player && updatedPlayers) {
        players.value = updatedPlayers;
      }
    });
    
    // 处理状态同步
    p2pManager.onMessage(MessageType.STATE_SYNC, (message: GameMessage) => {
      if (isHost.value) return;
      
      const { players: updatedPlayers, config: newConfig, roomId: newRoomId } = message.payload;
      if (updatedPlayers) {
        players.value = updatedPlayers;
      }
      if (newConfig) {
        config.value = newConfig;
      }
      if (newRoomId) {
        roomId.value = newRoomId;
      }
    });
    
    p2pManager.onConnectionOpen((peerId) => {
      console.log('Player connected:', peerId);
    });
    
    p2pManager.onConnectionClose((peerId) => {
      console.log('Player disconnected:', peerId);
      const message: GameMessage = {
        type: MessageType.PLAYER_LEAVE,
        timestamp: Date.now(),
        senderId: peerId,
        payload: {},
      };
      handlePlayerLeave(message);
    });
  }
  
  /**
   * 下一局
   */
  function nextRound(): void {
    if (!isHost.value) return;
    
    startGame();
  }
  
  return {
    // 状态
    myPlayerId,
    myPlayerName,
    players,
    roomId,
    isHost,
    config,
    gameState,
    myHand,
    currentPlayerIndex,
    lastHand,
    lastPlayerId,
    consecutivePasses,
    
    // 计算属性
    myPlayer,
    currentPlayer,
    isMyTurn,
    canPass,
    
    // 方法
    initialize,
    createRoom,
    joinRoom,
    startGame,
    playHand,
    pass,
    nextRound,
  };
});