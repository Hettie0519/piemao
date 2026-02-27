import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Card, Player, GameConfig, GameMessage, Hand, ChatMessage } from '../types/game';
import { GameState, MessageType, RockPaperScissorsChoice } from '../types/game';
import { p2pManager } from '../utils/p2pManager';
import { dealGame, findRedHeart3Holder, findAllRedHeart3Holders, generateSeed } from '../utils/dealer';
import { sortCards, validateHand, canBeatHand } from '../utils/cardUtils';

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
  
  // 石头剪子布状态
  const rpsPlayers = ref<number[]>([]); // 需要进行石头剪子布的玩家索引
  const rpsChoices = ref<Map<string, RockPaperScissorsChoice>>(new Map()); // 玩家的选择
  const myRPSChoice = ref<RockPaperScissorsChoice | null>(null);
  
  // 聊天消息
  const chatMessages = ref<ChatMessage[]>([]);
  
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
    
    let roomExistsHandled = false;
    let reinitInProgress = false;
    
    // 设置房间已存在的回调
    p2pManager.setOnRoomExists(() => {
      if (reinitInProgress) {
        console.log('重新初始化已在进行中，跳过');
        return;
      }
      
      console.log('检测到房间已存在，重新初始化Peer并加入房间');
      roomExistsHandled = true;
      reinitInProgress = true;
      
      // 重新初始化 PeerJS 来连接
      p2pManager.reinitForJoin().then(() => {
        console.log('PeerJS 重新初始化成功，开始加入房间');
        // 重新初始化后，设置 myPlayerId
        myPlayerId.value = p2pManager.getMyId();
        console.log('重新初始化后的 ID:', myPlayerId.value);
        // 注册消息处理器
        registerMessageHandlers();
        // 加入房间
        joinRoom('hettie2026');
      }).catch(error => {
        console.error('重新初始化失败:', error);
        reinitInProgress = false;
      });
    });
    
    // 延迟一下，确保如果 peer 已经失败了，error 事件能够触发回调
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 等待 PeerJS 初始化完成或检测到房间被占用
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const id = p2pManager.getMyId();
        if (id) {
          myPlayerId.value = id;
          clearInterval(checkInterval);
          resolve();
        }
        if (roomExistsHandled) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    if (myPlayerId.value) {
      console.log('初始化完成，我的 ID:', myPlayerId.value);
      // 注册消息处理器
      registerMessageHandlers();
    }
  }
  
  /**
   * 创建房间
   */
  function createRoom(): void {
    isHost.value = true;
    p2pManager.setAsHost();
    // 使用固定房间ID
    roomId.value = 'hettie2026';
    
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
      // 检查是否已经加入房间
      const alreadyJoined = players.value.some(p => p.id === myPlayerId.value);
      if (alreadyJoined) {
        console.log('已经加入房间，不再重复加入');
        return true;
      }
      
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
    const redHeart3Holders = findAllRedHeart3Holders(hands);
    
    console.log('红桃3持有者检测结果:', {
      redHeart3HolderIndex,
      redHeart3Holders,
      deckCount: config.value.deckCount,
      playerCount: players.value.length,
    });
    
    // 更新每个玩家的手牌数量
    players.value.forEach((player, index) => {
      if (hands[index]) {
        player.handCount = hands[index].length;
        // 调试：打印每个玩家的红桃3数量
        const redHeart3Count = hands[index].filter(c => c.isRedHeart3).length;
        console.log(`玩家 ${index} (${player.name}) 的红桃3数量: ${redHeart3Count}`);
      }
    });
    
    // 设置当前玩家
    if (redHeart3HolderIndex !== null) {
      // 只有一个玩家持有红桃3，直接先出牌
      currentPlayerIndex.value = redHeart3HolderIndex;
      gameState.value = GameState.PLAYING;
    } else if (redHeart3Holders.length > 1) {
      // 多个玩家持有红桃3，需要石头剪子布决定
      rpsPlayers.value = redHeart3Holders;
      rpsChoices.value.clear();
      myRPSChoice.value = null;
      gameState.value = GameState.ROCK_PAPER_SCISSORS;
      console.log(`多个玩家持有红桃3，需要石头剪子布决定先手: ${redHeart3Holders.join(', ')}`);
    } else {
      // 没有人持有红桃3（不应该发生），随机选择一个
      currentPlayerIndex.value = 0;
      gameState.value = GameState.PLAYING;
      console.log('没有人持有红桃3，随机选择玩家0先出牌');
    }
    
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
        gameState: gameState.value, // 包含游戏状态（可能是ROCK_PAPER_SCISSORS或PLAYING）
        rpsPlayers: rpsPlayers.value, // 添加石头剪刀布玩家列表
      },
    };
    p2pManager.broadcast(message);
    
    // 主机已经设置了游戏状态，不需要再设置
    // gameState.value = GameState.PLAYING; // 删除这行
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
    let beatResult = { canBeat: true, isQiZi: false };
    if (lastHand.value && lastHand.value.cards.length > 0) {
      beatResult = canBeatHand(cards, lastHand.value, config.value.minStraight, config.value.minSisterPair);
      
      console.log('牌型比较:', {
        currentHand: validation.type,
        lastHand: lastHand.value.type,
        canBeat: beatResult.canBeat,
        isQiZi: beatResult.isQiZi,
        currentCards: cards.map(c => `${c.suit}${c.rank}`),
        lastCards: lastHand.value.cards.map(c => `${c.suit}${c.rank}`),
      });
      
      if (!beatResult.canBeat) {
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
        isQiZi: beatResult.isQiZi || validation.isQiZi || false, // 使用 canBeatHand 的结果
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
    const { seed, config: newConfig, playerOrder, currentPlayerIndex: newCurrentPlayerIndex, players: updatedPlayers, gameState: newGameState, rpsPlayers: newRpsPlayers } = message.payload;
    
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
    
    // 使用消息中的游戏状态，而不是直接设置为PLAYING
    gameState.value = newGameState || GameState.PLAYING;
    
    // 如果是石头剪刀布状态，更新rpsPlayers
    if (newGameState === GameState.ROCK_PAPER_SCISSORS && newRpsPlayers) {
      rpsPlayers.value = newRpsPlayers;
      rpsChoices.value.clear();
      myRPSChoice.value = null;
    }
    
    console.log(`handleGameStart: 游戏状态设置为 ${gameState.value}`);
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
    
    // 检查玩家是否已经存在
    const existingPlayer = players.value.find(p => p.id === message.senderId);
    if (existingPlayer) {
      console.log('玩家已存在，忽略重复加入请求:', message.senderId);
      return;
    }
    
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
   * 处理玩家昵称更新
   */
  function handlePlayerNameUpdate(message: GameMessage): void {
    if (!isHost.value) return;
    
    const { playerId, playerName } = message.payload;
    console.log('收到昵称更新请求:', playerId, playerName);
    
    if (playerId && playerName) {
      const player = players.value.find(p => p.id === playerId);
      if (player) {
        console.log('更新玩家昵称:', playerId, '从', player.name, '到', playerName);
        player.name = playerName;
        
        // 广播昵称更新给所有玩家
        const updateMsg: GameMessage = {
          type: MessageType.UPDATE_PLAYER_NAME,
          timestamp: Date.now(),
          senderId: myPlayerId.value,
          payload: { playerId, playerName },
        };
        p2pManager.broadcast(updateMsg);
        console.log('已广播昵称更新给所有玩家');
      } else {
        console.log('未找到玩家:', playerId);
      }
    }
  }
  
  /**
   * 广播昵称更新（房主使用）
   */
  function broadcastPlayerNameUpdate(playerName: string): void {
    if (!isHost.value) return;
    
    const updateMsg: GameMessage = {
      type: MessageType.UPDATE_PLAYER_NAME,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: { playerId: myPlayerId.value, playerName },
    };
    p2pManager.broadcast(updateMsg);
  }
  
  /**
   * 发送昵称更新给房主（玩家使用）
   */
  function sendPlayerNameUpdate(playerName: string): void {
    if (isHost.value) return;
    
    const updateMsg: GameMessage = {
      type: MessageType.UPDATE_PLAYER_NAME,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: { playerId: myPlayerId.value, playerName },
    };
    
    const hostId = p2pManager.getHostId();
    if (hostId) {
      p2pManager.sendTo(hostId, updateMsg);
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
    p2pManager.onMessage(MessageType.RPS_CHOICE, handleRPSChoice);
    p2pManager.onMessage(MessageType.CHAT_MESSAGE, handleChatMessage);
    
    // 处理昵称更新（请求或广播）
    p2pManager.onMessage(MessageType.UPDATE_PLAYER_NAME, (message: GameMessage) => {
      console.log('收到昵称更新消息:', message, 'isHost:', isHost.value);
      
      if (isHost.value) {
        // 我是房主，这是昵称更新请求
        handlePlayerNameUpdate(message);
      } else {
        // 我是玩家，这是昵称更新广播
        const { playerId, playerName } = message.payload;
        if (playerId && playerName) {
          const player = players.value.find(p => p.id === playerId);
          if (player) {
            console.log('更新玩家昵称（玩家）:', playerId, playerName);
            player.name = playerName;
          }
        }
      }
    });
    
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
      
      console.log('收到状态同步消息:', message.payload);
      
      const { 
        players: updatedPlayers, 
        config: newConfig, 
        roomId: newRoomId,
        gameState: newGameState,
        currentPlayerIndex: newCurrentPlayerIndex,
        rpsReset
      } = message.payload;
      
      if (updatedPlayers) {
        players.value = updatedPlayers;
      }
      if (newConfig) {
        config.value = newConfig;
      }
      if (newRoomId) {
        roomId.value = newRoomId;
      }
      if (newGameState !== undefined) {
        gameState.value = newGameState;
        console.log('游戏状态同步为:', newGameState);
      }
      if (newCurrentPlayerIndex !== undefined) {
        currentPlayerIndex.value = newCurrentPlayerIndex;
        console.log('当前玩家索引同步为:', newCurrentPlayerIndex);
      }
      
      // 处理石头剪子布重置
      if (rpsReset) {
        console.log('收到石头剪子布重置信号');
        // 只清空选择，不清空玩家列表
        rpsChoices.value.clear();
        myRPSChoice.value = null;
        console.log('石头剪子布已重置，myRPSChoice:', myRPSChoice.value);
      }
      
      // 清理石头剪子布状态（当游戏开始时）
      if (newGameState === GameState.PLAYING) {
        rpsPlayers.value = [];
        rpsChoices.value.clear();
        myRPSChoice.value = null;
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
  
  /**
   * 提交石头剪子布选择
   */
  function submitRPSChoice(choice: RockPaperScissorsChoice): void {
    if (gameState.value !== GameState.ROCK_PAPER_SCISSORS) return;
    
    myRPSChoice.value = choice;
    
    const message: GameMessage = {
      type: MessageType.RPS_CHOICE,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        choice,
      },
    };
    
    // 如果是主机，处理选择
    if (isHost.value) {
      handleRPSChoice(message);
    } else {
      // 发送给主机
      const host = players.value.find(p => p.isHost);
      if (host) {
        p2pManager.broadcast(message);
      }
    }
  }
  
  /**
   * 处理石头剪子布选择
   */
  function handleRPSChoice(message: GameMessage): void {
    const { choice } = message.payload;
    rpsChoices.value.set(message.senderId, choice);
    
    console.log(`收到 ${message.senderId} 的石头剪子布选择: ${choice}`);
    
    // 检查是否所有参与石头剪子布的玩家都已选择
    const allChosen = rpsPlayers.value.every(index => {
      const player = players.value[index];
      return player && rpsChoices.value.has(player.id);
    });
    
    if (allChosen) {
      determineRPSWinner();
    }
  }
  
  /**
   * 判断石头剪子布的胜负
   */
  function determineRPSWinner(): void {
    if (!isHost.value) return;
    
    console.log('开始判断石头剪子布胜负');
    console.log('rpsPlayers:', rpsPlayers.value);
    console.log('rpsChoices:', rpsChoices.value);
    console.log('players:', players.value);
    
    const choices: Array<{ playerId: string; choice: RockPaperScissorsChoice }> = [];
    
    rpsPlayers.value.forEach(index => {
      const player = players.value[index];
      if (player) {
        const choice = rpsChoices.value.get(player.id);
        console.log(`玩家 ${index} (${player.name}): ${choice}`);
        if (choice) {
          choices.push({ playerId: player.id, choice });
        }
      }
    });
    
    console.log('choices:', choices);
    
    // 简单的石头剪子布逻辑：如果有平局，重新开始
    let winnerIndex = -1;
    
    // 检查是否所有人都出一样的（平局）
    const firstChoice = choices[0]?.choice;
    const allSame = choices.every(c => c.choice === firstChoice);
    
    if (allSame && choices.length > 1) {
      // 平局，重新开始石头剪子布
      rpsChoices.value.clear();
      myRPSChoice.value = null;
      console.log('石头剪子布平局，重新开始');
      console.log('广播石头剪子布重置消息');
      
      // 广播平局消息，让所有玩家重新选择
      const message: GameMessage = {
        type: MessageType.STATE_SYNC,
        timestamp: Date.now(),
        senderId: myPlayerId.value,
        payload: {
          rpsReset: true, // 标记为石头剪子布重置
        },
      };
      p2pManager.broadcast(message);
      return;
    }
    
    // 找出胜者
    const winner = choices.reduce((prev, current) => {
      return compareRPS(current.choice, prev.choice) > 0 ? current : prev;
    });
    
    console.log('winner:', winner);
    
    // 在 rpsPlayers 数组中找到胜者的索引
    const winnerRPSIndex = rpsPlayers.value.findIndex(index => {
      const player = players.value[index];
      return player && player.id === winner.playerId;
    });
    
    // 获取胜者在 players 数组中的实际索引
    winnerIndex = rpsPlayers.value[winnerRPSIndex] ?? -1;
    
    console.log('winnerRPSIndex:', winnerRPSIndex);
    console.log('winnerIndex:', winnerIndex);
    
    if (winnerIndex !== -1) {
      currentPlayerIndex.value = winnerIndex;
      gameState.value = GameState.PLAYING;
      rpsPlayers.value = [];
      rpsChoices.value.clear();
      console.log(`石头剪子布结束，玩家 ${winnerIndex} 获胜，先出牌`);
      
      // 广播结果（包含玩家手牌信息）
      const message: GameMessage = {
        type: MessageType.STATE_SYNC,
        timestamp: Date.now(),
        senderId: myPlayerId.value,
        payload: {
          currentPlayerIndex: winnerIndex,
          gameState: GameState.PLAYING,
          players: players.value, // 包含玩家手牌信息
        },
      };
      p2pManager.broadcast(message);
    }
  }
  
  /**
   * 比较两个石头剪子布选择
   * 返回：1表示c1胜，-1表示c2胜，0表示平局
   */
  function compareRPS(c1: RockPaperScissorsChoice, c2: RockPaperScissorsChoice): number {
    if (c1 === c2) return 0;
    
    // 石头胜剪刀，剪刀胜布，布胜石头
    if (c1 === RockPaperScissorsChoice.ROCK && c2 === RockPaperScissorsChoice.SCISSORS) return 1;
    if (c1 === RockPaperScissorsChoice.SCISSORS && c2 === RockPaperScissorsChoice.PAPER) return 1;
    if (c1 === RockPaperScissorsChoice.PAPER && c2 === RockPaperScissorsChoice.ROCK) return 1;
    
    return -1;
  }
  
  /**
   * 发送聊天消息
   */
  function sendChatMessage(message: string): void {
    console.log('发送聊天消息:', message, '玩家ID:', myPlayerId.value);
    
    // 删除该玩家之前的消息
    chatMessages.value = chatMessages.value.filter(m => m.playerId !== myPlayerId.value);
    
    const chatMessage: ChatMessage = {
      id: `${myPlayerId.value}_${Date.now()}`,
      playerId: myPlayerId.value,
      playerName: myPlayerName.value,
      message,
      timestamp: Date.now(),
    };
    
    // 添加新消息
    chatMessages.value.push(chatMessage);
    
    console.log('本地消息列表:', chatMessages.value);
    
    // 广播给所有玩家
    const gameMessage: GameMessage = {
      type: MessageType.CHAT_MESSAGE,
      timestamp: Date.now(),
      senderId: myPlayerId.value,
      payload: {
        chatMessage,
      },
    };
    
    const broadcastResult = p2pManager.broadcast(gameMessage);
    console.log('广播结果:', broadcastResult);
  }
  
  /**
   * 处理接收到的聊天消息
   */
  function handleChatMessage(message: GameMessage): void {
    console.log('接收到聊天消息:', message);
    const { chatMessage } = message.payload;
    if (chatMessage) {
      console.log('聊天消息内容:', chatMessage);
      // 删除该发送者之前的消息
      chatMessages.value = chatMessages.value.filter(m => m.playerId !== chatMessage.playerId);
      // 添加新消息
      chatMessages.value.push(chatMessage);
      console.log('更新后的消息列表:', chatMessages.value);
    }
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
    sendChatMessage,
    handleChatMessage,
    nextRound,
    submitRPSChoice,
    broadcastPlayerNameUpdate,
    sendPlayerNameUpdate,
  };
});