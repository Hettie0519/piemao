<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useGameStore } from '../stores/gameStore';
import type { Card } from '../types/game';
import { GameState } from '../types/game';
import RockPaperScissors from './RockPaperScissors.vue';
import { sortCards } from '../utils/cardUtils';

const gameStore = useGameStore();
const selectedCards = ref<Card[]>([]);

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const myHand = computed(() => gameStore.myHand);

onMounted(() => {
  // 空实现，不需要检测屏幕方向
});

onUnmounted(() => {
  // 清除所有聊天气泡计时器
  chatBubbleTimers.value.forEach(timer => clearTimeout(timer));
  chatBubbleTimers.value.clear();
});

const sortedHand = computed(() => sortCards(gameStore.myHand));

// 其他玩家列表（排除自己），按逆时针顺序排列
const otherPlayers = computed(() => {
  const myIndex = gameStore.players.findIndex(p => p.id === gameStore.myPlayerId);
  const allPlayers = gameStore.players;
  const other = [];
  
  // 从当前玩家开始，按逆时针方向遍历其他玩家
  for (let i = 1; i < allPlayers.length; i++) {
    const index = (myIndex + i) % allPlayers.length;
    other.push(allPlayers[index]);
  }
  
  return other;
});

// 左侧玩家（上家，逆时针方向的后半部分）
const leftPlayers = computed(() => {
  const players = otherPlayers.value;
  if (players.length === 0) return [];
  // 将玩家均匀分配到左右两侧
  const leftCount = Math.ceil(players.length / 2);
  return players.slice(leftCount);
});

// 右侧玩家（下家，逆时针方向的前半部分，需要反转顺序让最远的在顶部）
const rightPlayers = computed(() => {
  const players = otherPlayers.value;
  if (players.length === 0) return [];
  // 将玩家均匀分配到左右两侧
  const leftCount = Math.ceil(players.length / 2);
  const rightPlayersList = players.slice(0, leftCount);
  // 反转顺序，让最远的玩家在顶部
  return rightPlayersList.reverse();
});

// 获取左侧玩家在原数组中的实际索引
function getLeftPlayerActualIndex(index: number) {
  const players = gameStore.players;
  const leftPlayer = leftPlayers.value[index];
  if (!leftPlayer) return -1;
  return players.findIndex(p => p.id === leftPlayer.id);
}

// 获取左侧玩家在玩家列表中的索引
function getLeftPlayerIndex(index: number) {
  const players = gameStore.players;
  const leftPlayer = leftPlayers.value[index];
  if (!leftPlayer) return -1;
  return players.findIndex(p => p.id === leftPlayer.id);
}

// 获取右侧玩家在原数组中的实际索引
function getRightPlayerActualIndex(index: number) {
  const players = gameStore.players;
  const rightPlayer = rightPlayers.value[index];
  if (!rightPlayer) return -1;
  return players.findIndex(p => p.id === rightPlayer.id);
}

// 获取右侧玩家在玩家列表中的索引
function getRightPlayerIndex(index: number) {
  const players = gameStore.players;
  const rightPlayer = rightPlayers.value[index];
  if (!rightPlayer) return -1;
  return players.findIndex(p => p.id === rightPlayer.id);
}

// 计算最后出牌的显示信息
const lastHandDisplay = computed(() => {
  if (!gameStore.lastHand || !gameStore.lastHand.cards || gameStore.lastHand.cards.length === 0) {
    return [];
  }
  
  const firstCard = gameStore.lastHand.cards[0];
  if (typeof firstCard === 'object' && 'suit' in firstCard) {
    return gameStore.lastHand.cards.map((card: Card) => ({
      text: formatCard(card),
      suit: card.suit,
    }));
  }
  
  return gameStore.lastHand.cards.map(cardId => {
    const card = gameStore.myHand.find(c => c.id === String(cardId));
    if (card) {
      return {
        text: formatCard(card),
        suit: card.suit,
      };
    }
    return {
      text: String(cardId),
      suit: 'spades' as const,
    };
  });
});

function isSelected(card: Card) {
  return selectedCards.value.some(c => c.id === card.id);
}

function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

// 拖动处理
let isDragging = false;
let dragStartCard: Card | null = null;
let lastCard: Card | null = null;
let hasMovedToOtherCard = false;
let startCardWasSelected = false;
let hasDragged = false; // 新增：跟踪是否发生过拖动

// 快捷发言
const showQuickChat = ref(false);
const quickChatMessages = ['日你', '扳机','6666','秀了','牛逼牛逼','有石粒','么石粒','透', '有车呀么', '么有', '有了'];

// 聊天气泡显示计时器
const chatBubbleTimers = ref<Map<string, number>>(new Map());

// 计算聊天气泡的位置
function getChatBubblePosition(playerId: string) {
  const playerContainer = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!playerContainer) {
    if (playerId === gameStore.myPlayerId) {
      // 自己的气泡 - 显示在玩家信息卡片右侧，垂直居中对齐
      const myInfoTopLeft = document.querySelector('.my-info-top-left');
      if (myInfoTopLeft) {
        const rect = myInfoTopLeft.getBoundingClientRect();
        const containerRect = document.querySelector('.game-container')?.getBoundingClientRect();
        if (containerRect) {
          const relativeTop = ((rect.top - containerRect.top) / containerRect.height) * 100;
          const elementHeightPercent = (rect.height / containerRect.height) * 100;
          const relativeLeft = ((rect.left - containerRect.left) / containerRect.width) * 100;
          const elementWidthPercent = (rect.width / containerRect.width) * 100;
          // 气泡顶部位置 = 卡片顶部 + 卡片高度的一半，然后使用 transform: translateY(-50%) 让气泡垂直居中
          return {
            top: `calc(${relativeTop}% + ${elementHeightPercent / 2}%)`,
            bottom: 'auto',
            left: `calc(${relativeLeft}% + ${elementWidthPercent}% + 0.5vw)`,
            right: 'auto',
            transform: 'translateY(-50%)'
          };
        }
      }
      return { top: 'auto', bottom: '45vh', left: '50%', right: 'auto', transform: 'translateX(-50%)' };
    }
    return { top: '35%', left: '8vw', right: 'auto', bottom: 'auto', transform: 'none' };
  }
  
  // Get actual player-info element
  const playerInfo = playerContainer.querySelector('.player-info');
  if (!playerInfo) {
    return { top: '35%', left: '8vw', right: 'auto', bottom: 'auto', transform: 'none' };
  }
  
  const rect = playerInfo.getBoundingClientRect();
  const containerRect = document.querySelector('.game-container')?.getBoundingClientRect();
  if (!containerRect) {
    return { top: '35%', left: '8vw', right: 'auto', bottom: 'auto', transform: 'none' };
  }
  
  const relativeTop = ((rect.top - containerRect.top) / containerRect.height) * 100;
  const relativeLeft = ((rect.left - containerRect.left) / containerRect.width) * 100;
  const relativeRight = 100 - relativeLeft;
  const elementWidthPercent = (rect.width / containerRect.width) * 100;
  
  if (relativeTop > 60) {
    // Bottom player (me) - 显示在玩家信息卡片右侧，垂直居中对齐
    const myInfoTopLeft = document.querySelector('.my-info-top-left');
    if (myInfoTopLeft) {
      const inlineRect = myInfoTopLeft.getBoundingClientRect();
      const inlineTop = ((inlineRect.top - containerRect.top) / containerRect.height) * 100;
      const inlineHeightPercent = (inlineRect.height / containerRect.height) * 100;
      const inlineLeft = ((inlineRect.left - containerRect.left) / containerRect.width) * 100;
      const inlineWidthPercent = (inlineRect.width / containerRect.width) * 100;
      return {
        top: `calc(${inlineTop}% + ${inlineHeightPercent / 2}%)`,
        bottom: 'auto',
        left: `calc(${inlineLeft}% + ${inlineWidthPercent}% + 0.5vw)`,
        right: 'auto',
        transform: 'translateY(-50%)'
      };
    }
    return { 
      top: `${relativeTop}%`, 
      bottom: 'auto',
      left: `calc(${relativeLeft}% + ${elementWidthPercent}% + 0.5vw)`,
      right: 'auto',
      transform: 'none'
    };
  } else if (relativeLeft < 50) {
    // Left player - 气泡位置基于 player-info 的顶部，不需要 translateY(-50%)
    return { 
      top: `${relativeTop}%`, 
      left: `calc(${relativeLeft}% + ${elementWidthPercent}% + 0.5vw)`,
      right: 'auto',
      bottom: 'auto',
      transform: 'none'
    };
  } else {
    // Right player - 气泡位置基于 player-info 的顶部，不需要 translateY(-50%)
    return { 
      top: `${relativeTop}%`, 
      left: 'auto',
      right: `calc(${relativeRight}% + ${elementWidthPercent}% + 0.5vw)`,
      bottom: 'auto',
      transform: 'none'
    };
  }
}

// 获取气泡的CSS类
function getChatBubbleClass(playerId: string) {
  if (playerId === gameStore.myPlayerId) return 'chat-bubble-my';
  
  const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!playerElement) return '';
  
  const rect = playerElement.getBoundingClientRect();
  const containerRect = document.querySelector('.game-container')?.getBoundingClientRect();
  
  if (!containerRect) return '';
  
  const relativeLeft = ((rect.left - containerRect.left) / containerRect.width) * 100;
  
  if (relativeLeft < 50) return 'chat-bubble-left';
  return 'chat-bubble-right';
}

// 获取箭头的CSS类
function getChatBubbleArrowClass(playerId: string) {
  if (playerId === gameStore.myPlayerId) return 'chat-bubble-arrow-my-bottom';
  
  const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!playerElement) return '';
  
  const rect = playerElement.getBoundingClientRect();
  const containerRect = document.querySelector('.game-container')?.getBoundingClientRect();
  
  if (!containerRect) return '';
  
  const relativeLeft = ((rect.left - containerRect.left) / containerRect.width) * 100;
  
  if (relativeLeft < 50) return 'chat-bubble-arrow-left';
  return 'chat-bubble-arrow-right';
}

// 监听聊天消息，设置自动消失计时器
watch(() => gameStore.chatMessages, async (newMessages) => {
  // 清除所有旧的计时器
  chatBubbleTimers.value.forEach(timer => clearTimeout(timer));
  chatBubbleTimers.value.clear();
  
  // 等待 DOM 更新完成
  await nextTick();
  
  // 为每条消息设置1秒后消失的计时器
  newMessages.forEach((msg: any) => {
    const timer = setTimeout(() => {
      // 从消息列表中移除该消息
      gameStore.chatMessages = gameStore.chatMessages.filter((m: any) => m.id !== msg.id);
    }, 1000); // 1秒后消失
    
    chatBubbleTimers.value.set(msg.id, timer);
  });
}, { deep: true });

function sendQuickChat(message: string) {
  gameStore.sendChatMessage(message);
  console.log('发送快捷消息:', message);
}

function handleCardDragStart(card: Card, event: MouseEvent | TouchEvent) {
  // 阻止事件冒泡和默认行为
  event.stopPropagation();
  event.preventDefault();
  
  isDragging = true;
  dragStartCard = card;
  lastCard = card;
  hasMovedToOtherCard = false;
  hasDragged = false; // 重置拖动标记
  startCardWasSelected = isSelected(card);
  
  // 添加全局拖动事件监听
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', handleCardDragMove);
    window.addEventListener('mouseup', handleCardDragEnd);
    window.addEventListener('touchmove', handleCardDragMove, { passive: false });
    window.addEventListener('touchend', handleCardDragEnd);
  }
}


function handleCardDragMove(event: MouseEvent | TouchEvent) {
  if (!isDragging) return;
  
  // 获取触摸或鼠标位置
  const clientX = event instanceof MouseEvent ? event.clientX : (event.touches[0]?.clientX ?? 0);
  const clientY = event instanceof MouseEvent ? event.clientY : (event.touches[0]?.clientY ?? 0);
  
  // 检查鼠标是否移动到其他牌上
  const elements = document.elementsFromPoint(clientX, clientY);
  let foundDifferentCard = false;
  
  for (const element of elements) {
    const cardElement = element.closest('.hand-card');
    if (cardElement) {
      const cardId = cardElement.getAttribute('data-card-id');
      if (cardId) {
        const card = myHand.value.find((c: Card) => c.id === cardId);
        if (card && card.id !== lastCard?.id && card.id !== dragStartCard?.id) {
          foundDifferentCard = true;
          hasMovedToOtherCard = true;
          hasDragged = true; // 标记发生了拖动
          lastCard = card;
          
          // 检查起始牌是否在选中列表中（在拖动开始时的状态）
          const startCardInSelected = startCardWasSelected;
          
          if (startCardInSelected) {
            // 如果起始牌已选中，取消选中模式
            // 第一次滑到其他牌时，立即取消选中起始牌
            if (!isSelected(dragStartCard!)) {
              // 起始牌已经被取消了选中（之前处理过），不需要再处理
            } else {
              // 取消选中起始牌
              const startIndex = selectedCards.value.findIndex(c => c.id === dragStartCard!.id);
              if (startIndex !== -1) {
                selectedCards.value.splice(startIndex, 1);
              }
            }
            
            // 取消选中滑过的牌
            if (isSelected(card)) {
              const index = selectedCards.value.findIndex(c => c.id === card.id);
              if (index !== -1) {
                selectedCards.value.splice(index, 1);
              }
            }
          } else {
            // 如果起始牌未选中，普通选中模式（选中起始牌和滑过的牌）
            // 如果是第一次滑过其他牌，先选中起始牌
            if (!isSelected(dragStartCard!)) {
              selectedCards.value.push(dragStartCard!);
            }
            
            // 选中滑过的牌
            if (!isSelected(card)) {
              selectedCards.value.push(card);
            }
          }
        }
      }
      break;
    }
  }
  
  // 只有滑到其他牌上才阻止默认行为
  if (foundDifferentCard) {
    event.preventDefault();
  }
}

function handleCardDragEnd(event: MouseEvent | TouchEvent) {
  // 阻止事件冒泡和默认行为
  event.stopPropagation();
  event.preventDefault();
  
  // 如果没有移动到其他牌，这是单击，切换起始牌的选中状态
  const wasDragging = hasMovedToOtherCard || hasDragged;
  
  if (!wasDragging && dragStartCard) {
    const index = selectedCards.value.findIndex(c => c.id === dragStartCard!.id);
    if (index === -1) {
      selectedCards.value.push(dragStartCard!);
    } else {
      selectedCards.value.splice(index, 1);
    }
  }
  // 注意：如果移动到其他牌且起始牌已选中，起始牌已经在 handleCardDragMove 中被取消了选中
  
  isDragging = false;
  dragStartCard = null;
  lastCard = null;
  hasMovedToOtherCard = false;
  startCardWasSelected = false;
  hasDragged = false; // 重置拖动标记
  
  // 移除全局事件监听
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', handleCardDragMove);
    window.removeEventListener('mouseup', handleCardDragEnd);
    window.removeEventListener('touchmove', handleCardDragMove);
    window.removeEventListener('touchend', handleCardDragEnd);
  }
}

function playSelectedCards() {
  if (selectedCards.value.length === 0) {
    alert('请选择要出的牌');
    return;
  }
  
  gameStore.playHand(selectedCards.value);
  selectedCards.value = [];
}

function passTurn() {
  gameStore.pass();
}

// 判断是否是每行的最后一个牌（实际上就是最后一张牌，因为所有牌都在一行）
function isLineEnd(index: number) {
  return index === gameStore.myHand.length - 1;
}
</script>

<template>
  <div class="game-container">
    <!-- 石头剪子布模态框 -->
    <RockPaperScissors v-if="gameStore.gameState === GameState.ROCK_PAPER_SCISSORS" />
    
    <!-- 游戏界面 -->
    <div class="game-layout">
      <!-- 顶部信息栏 -->
      <div class="top-bar">
        <div class="game-title">
          <h1>踹牌</h1>
        </div>
        <div class="deck-info">
          <span>牌副数: {{ gameStore.config.deckCount }}</span>
        </div>
      </div>

      <!-- 游戏主区域 -->
      <div class="game-main">
        <!-- 聊天消息气泡显示区域 -->
        <div class="chat-bubbles-container">
          <div
            v-for="msg in gameStore.chatMessages"
            :key="msg.id"
            class="chat-bubble"
            :class="getChatBubbleClass(msg.playerId)"
            :style="getChatBubblePosition(msg.playerId)"
          >
            <div class="chat-bubble-content">
              <span class="chat-bubble-text">{{ msg.message }}</span>
            </div>
            <div class="chat-bubble-arrow" :class="getChatBubbleArrowClass(msg.playerId)"></div>
          </div>
        </div>

        <!-- 左侧对手容器 -->
        <div class="left-players-container">
          <!-- 左侧对手 -->
          <div
            v-for="(player, index) in leftPlayers"
            :key="player!.id"
            class="player-left"
            :class="{ 'current-turn': getLeftPlayerIndex(index) === gameStore.currentPlayerIndex }"
            :data-player-id="player!.id"
          >
            <div class="player-info">
              <span v-if="player!.isHost" class="crown">👑</span>
              <span class="player-number">{{ getLeftPlayerActualIndex(index) + 1 }}</span>
              <span class="player-name">{{ player!.name }}</span>
              <span class="player-hand-count">{{ player!.handCount }} 张</span>
            </div>
          </div>
        </div>

        <!-- 中央出牌区 -->
        <div class="center-area">
          <div class="play-area">
            <div v-if="gameStore.lastHand" class="played-cards">
              <div class="cards-display">
                <span
                  v-for="(cardInfo, idx) in lastHandDisplay"
                  :key="idx"
                  class="played-card"
                  :class="cardInfo.suit"
                >
                  {{ cardInfo.text }}
                </span>
              </div>
              <div class="play-info">
                <span class="player-name">{{ gameStore.players.find(p => p.id === gameStore.lastPlayerId)?.name }}</span>
                <span class="card-count">{{ gameStore.lastHand.cards.length }} 张</span>
              </div>
            </div>
            <div v-else class="waiting-text">
              {{ gameStore.isMyTurn ? '请出牌' : `等待 ${gameStore.currentPlayer?.name} 出牌` }}
            </div>
          </div>
        </div>

        <!-- 右侧对手容器 -->
        <div class="right-players-container">
          <!-- 右侧对手 -->
          <div
            v-for="(player, index) in rightPlayers"
            :key="player!.id"
            class="player-right"
            :class="{ 'current-turn': getRightPlayerIndex(index) === gameStore.currentPlayerIndex }"
            :data-player-id="player!.id"
          >
            <div class="player-info">
              <span v-if="player!.isHost" class="crown">👑</span>
              <span class="player-number">{{ getRightPlayerActualIndex(index) + 1 }}</span>
              <span class="player-name">{{ player!.name }}</span>
              <span class="player-hand-count">{{ player!.handCount }} 张</span>
            </div>
          </div>
        </div>
      </div>

<!-- 底部我的区域 -->
      <div class="bottom-area">
        <!-- 我的信息 - 在底部区域左上角 -->
        <div class="my-info-top-left">
          <span v-if="gameStore.myPlayer?.isHost" class="crown">👑</span>
          <span class="player-name">{{ gameStore.myPlayer?.name }}</span>
          <span class="player-hand-count">{{ gameStore.myHand.length }} 张</span>
        </div>

        <!-- 操作按钮和我的信息组合 -->
        <div class="action-buttons-wrapper">
          <!-- 我的信息 - 在最左侧 -->
          <div class="my-info-inline">
            <span v-if="gameStore.myPlayer?.isHost" class="crown">👑</span>
            <span class="player-name">{{ gameStore.myPlayer?.name }}</span>
            <span class="player-hand-count">{{ gameStore.myHand.length }} 张</span>
          </div>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <button
              class="btn-pass"
              @click="passTurn"
              :disabled="!gameStore.canPass"
            >
              过牌
            </button>
            <button
              class="btn-play"
              @click="playSelectedCards"
              :disabled="!gameStore.isMyTurn || selectedCards.length === 0"
            >
              出牌 ({{ selectedCards.length }})
            </button>
            <button
              v-if="gameStore.isHost && gameStore.gameState === 'ended'"
              class="btn-next"
              @click="gameStore.nextRound"
            >
              下一局
            </button>
            <button
              class="btn-chat"
              @click="showQuickChat = !showQuickChat"
            >
              快捷发言
            </button>
          </div>
        </div>        <!-- 快捷发言列表 -->
        <div v-if="showQuickChat" class="quick-chat-panel">
          <div class="quick-chat-header">
            <span>快捷发言</span>
            <span class="close-btn" @click="showQuickChat = false">×</span>
          </div>
          <div class="quick-chat-messages">
            <div
              v-for="message in quickChatMessages"
              :key="message"
              class="quick-chat-item"
              @click="sendQuickChat(message)"
            >
              {{ message }}
            </div>
          </div>
        </div>

        <!-- 手牌区 -->
        <div class="hand-area">
          <div class="hand-cards">
            <div
              v-for="(card, index) in sortedHand"
              :key="card.id"
              class="hand-card"
              :class="{
                'selected': isSelected(card),
                'line-end': isLineEnd(index),
                'red-heart-3': card.isRedHeart3,
                'hearts': card.suit === 'hearts',
                'diamonds': card.suit === 'diamonds',
                'clubs': card.suit === 'clubs',
                'spades': card.suit === 'spades',
              }"
              :data-card-id="card.id"
              @mousedown="handleCardDragStart(card, $event)"
              @touchstart="handleCardDragStart(card, $event)"
            >
              <div class="card-content">
                <span class="card-rank">{{ card.rank }}</span>
                <span class="card-suit">{{ SUIT_SYMBOLS[card.suit] }}</span>
              </div>
            </div>
          </div>
          <button class="btn-clear" @click="selectedCards = []" v-if="selectedCards.length > 0">
            取消选择
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 游戏容器 */
.game-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 游戏布局 */
.game-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 顶部信息栏 */
.top-bar {
  height: 5vh;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2vw;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 35px;
}

.game-title {
  display: flex;
  align-items: center;
  gap: 1vw;
  white-space: nowrap;
}

.game-title h1 {
  font-size: 2vmin;
  font-weight: 700;
  color: #fff;
  margin: 0;
  letter-spacing: 0.3vmin;
  white-space: nowrap;
}

.deck-info {
  font-size: 1.3vmin;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
}

/* 游戏主区域 */
.game-main {
  flex: 1;
  display: grid;
  grid-template-columns: 12vw 1fr 12vw; /* 左右两侧固定宽度，中间自适应 */
  grid-template-rows: 1fr;
  gap: 1vw;
  padding: 1vh;
}

/* 左侧玩家容器 */
.left-players-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2vh;
  height: 100%;
  grid-column: 1; /* 占据第一列 */
}

/* 左侧玩家 */
.player-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 右侧玩家容器 */
.right-players-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2vh;
  height: 100%;
  grid-column: 3; /* 占据第三列 */
}

/* 右侧玩家 */
.player-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 玩家信息 */
.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5vh;
  padding: 1vh;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 1vh;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.crown {
  font-size: 1.8vmin;
}

.player-number {
  font-size: 1.5vmin;
  font-weight: 700;
  color: #ffd700;
}

.player-name {
  font-size: 1.3vmin;
  font-weight: 600;
  color: #fff;
}

.player-hand-count {
  font-size: 1.1vmin;
  color: rgba(255, 255, 255, 0.8);
}

/* 当前轮次高亮 */
.current-turn .player-info {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

/* 中央出牌区 */
.center-area {
  display: flex;
  align-items: center;
  justify-content: center;
  grid-column: 2; /* 占据第二列 */
}

.play-area {
  width: 100%;
  height: 25vh;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 1.5vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5vh;
  position: relative;
}

/* 已出的牌 */
.played-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8vh;
}

.cards-display {
  display: flex;
  gap: 0.3vw;
  flex-wrap: wrap;
  justify-content: center;
}

.played-card {
  background: #fff;
  color: #000;
  padding: 0.6vh 1vw;
  border-radius: 0.4vh;
  font-weight: bold;
  font-size: 1.5vmin;
  min-width: 3vw;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.played-card.hearts,
.played-card.diamonds {
  color: #dc3545;
}

.played-card.clubs,
.played-card.spades {
  color: #000;
}

.play-info {
  display: flex;
  gap: 0.8vw;
  font-size: 1.2vmin;
  color: rgba(255, 255, 255, 0.8);
}

/* 等待文字 */
.waiting-text {
  font-size: 2vmin;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

/* 底部区域 */
.bottom-area {
  height: 40vh;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1vh 2vw;
  gap: 1vh;
  position: relative;
}

/* 我的信息 */
.my-info {
  display: none; /* 隐藏原来的单独信息区域 */
}

.my-info-top-left {
  display: none; /* 隐藏左上角定位 */
}

/* 我的信息 - 在按钮最左侧（红框位置） */
.my-info-inline {
  display: none; /* 隐藏原来的按钮区域内的信息卡片 */
}

/* 我的信息 - 在底部区域左上角 */
.my-info-top-left {
  position: absolute;
  top: 1vh;
  left: 2vw;
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 0.5vh 1.5vw;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 1vh;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

/* 操作按钮和我的信息组合 */
.action-buttons-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2vw;
  margin-bottom: 1vh;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 1vw;
}

.btn-pass,
.btn-play,
.btn-next {
  padding: 1.2vh 2vw;
  border-radius: 1vh;
  font-size: 1.6vmin;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-pass {
  background: #4a5555;
  color: #fff;
}

.btn-pass:hover:not(:disabled) {
  background: #5a6a6a;
}

.btn-pass:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-play {
  background: #a3a34a;
  color: #fff;
}

.btn-play:hover:not(:disabled) {
  background: #c9c95a;
}

.btn-play:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-next {
  background: #28a745;
  color: #fff;
}

.btn-next:hover {
  background: #34ce57;
}

/* 手牌区 */
.hand-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5vh;
  width: 100%;
  padding: 0 2vw;
  overflow: visible;
  padding-top: 1vh;
}

.hand-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  max-width: 90vw;
  padding: 0.5vh;
}

/* 手牌卡片 - 堆叠布局 */
.hand-card {
  width: 4.5vw;
  height: 6.5vh;
  min-width: 50px;
  min-height: 72px;
  max-width: 65px;
  max-height: 95px;
  background: #fff;
  border: 2px solid #333;
  border-radius: 0.6vh;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-right: -2.5vw;
  margin-bottom: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
}

.hand-card:hover {
  transform: translateY(-1vh);
  z-index: 1;
}

/* 每行的最后一个牌不堆叠 */
.hand-cards > .hand-card.line-end {
  margin-right: 0;
}

/* 禁用移动端的悬停效果 */
@media (hover: none) and (pointer: coarse) {
  .hand-card:hover {
    transform: none;
  }
}

/* 花色颜色 */
.hand-card.hearts,
.hand-card.diamonds {
  color: #dc3545;
}

.hand-card.clubs,
.hand-card.spades {
  color: #000;
}

/* 选中状态 - 保持悬停效果 */
.hand-card.selected {
  transform: translateY(-1vh);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  border-color: #ffd700;
  border-width: 3px;
  transition: all 0.2s ease;
}

/* 卡牌内容定位 */
.card-content {
  position: absolute;
  top: 0.3vh;
  left: 0.3vw;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.card-rank {
  font-size: 1.8vmin;
  font-weight: bold;
  line-height: 1;
}

.card-suit {
  font-size: 2.2vmin;
  line-height: 1;
}

/* 红桃三特殊标记 */
.hand-card.red-heart-3 {
  border-color: #ffd700;
  border-width: 3px;
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .card-rank {
    font-size: 1.8vmin;
    font-weight: bold;
    line-height: 1;
    min-font-size: 14px;
  }

  .card-suit {
    font-size: 2.2vmin;
    line-height: 1;
    min-font-size: 16px;
  }
}

/* 取消选择按钮 */
.btn-clear {
  padding: 0.6vh 1.5vw;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.5vh;
  font-size: 1.3vmin;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 快捷发言按钮 */
.btn-chat {
  padding: 0.8vh 1.5vw;
  background: #28a745;
  color: #fff;
  border: 1px solid #34ce57;
  border-radius: 1vh;
  font-size: 1.3vmin;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5vw;
}

.btn-chat:hover {
  background: #34ce57;
  transform: scale(1.05);
}

/* 快捷发言面板 */
.quick-chat-panel {
  position: fixed;
  right: 2vw;
  bottom: 15vh;
  width: 30vw;
  max-width: 300px;
  background: linear-gradient(135deg, rgba(26, 71, 42, 0.95) 0%, rgba(45, 90, 61, 0.95) 100%);
  border: 2px solid #28a745;
  border-radius: 12px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
}

.quick-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2vh 1.5vw;
  background: rgba(40, 167, 69, 0.3);
  border-radius: 10px 10px 0 0;
  border-bottom: 1px solid #28a745;
}

.quick-chat-header span {
  color: #fff;
  font-size: 1.4vmin;
  font-weight: bold;
}

.close-btn {
  color: #fff;
  font-size: 2vmin;
  cursor: pointer;
  padding: 0 0.5vw;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #34ce57;
  transform: scale(1.2);
}

.quick-chat-messages {
  max-height: 50vh;
  overflow-y: auto;
  padding: 1vh;
}

.quick-chat-messages::-webkit-scrollbar {
  width: 6px;
}

.quick-chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.quick-chat-messages::-webkit-scrollbar-thumb {
  background: #28a745;
  border-radius: 3px;
}

.quick-chat-messages::-webkit-scrollbar-thumb:hover {
  background: #34ce57;
}

.quick-chat-item {
  padding: 1.2vh 1.5vw;
  background: rgba(40, 167, 69, 0.15);
  color: #fff;
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 8px;
  font-size: 1.3vmin;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.8vh;
}

.quick-chat-item:last-child {
  margin-bottom: 0;
}

.quick-chat-item:hover {
  background: rgba(40, 167, 69, 0.3);
  border-color: #34ce57;
  transform: translateX(-4px);
}

.quick-chat-item:active {
  transform: translateX(-2px) scale(0.98);
}

/* 聊天消息气泡显示 */
.chat-bubbles-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
}

.chat-bubble {
  position: absolute;
  left: 12vw;
  top: 15%;
  max-width: 35vw;
  z-index: 100;
}

@keyframes bubblePop {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(-50%) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(-50%);
  }
}

/* 左侧对手气泡动画 - 不使用 translateY(-50%) */
@keyframes bubblePopLeft {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 右侧对手气泡动画 - 不使用 translateY(-50%) */
@keyframes bubblePopRight {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes bubbleFadeOut {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.8) translateY(-10px);
  }
}

.chat-bubble-content {
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 1.2vh 1.5vw;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
  min-width: 8vw;
  max-width: 20vw;
  white-space: nowrap;
}

.chat-bubble-text {
  color: #333;
  font-size: 1.8vmin;
  font-weight: 500;
  line-height: 1.4;
}

.chat-bubble-arrow {
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 12px solid rgba(255, 255, 255, 0.95);
}

/* 我的聊天气泡 */
.chat-bubble-my {
  position: absolute;
  animation: bubblePop 0.3s ease;
}

.chat-bubble-arrow-my-bottom {
  display: none; /* 隐藏箭头 */
}

/* 左侧对手聊天气泡 */
.chat-bubble-left {
  position: absolute;
  animation: bubblePopLeft 0.3s ease;
}

.chat-bubble-arrow-left {
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 12px solid rgba(255, 255, 255, 0.95);
  border-left: none;
}

/* 右侧对手聊天气泡 */
.chat-bubble-right {
  position: absolute;
  animation: bubblePopRight 0.3s ease;
}

.chat-bubble-right .chat-bubble-arrow {
  left: auto;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 12px solid rgba(255, 255, 255, 0.95);
  border-right: none;
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .hand-card {
    width: 5vw;
    height: 7vh;
    min-width: 55px;
    min-height: 80px;
    max-width: 75px;
    max-height: 105px;
    margin-right: -1.8vw;
  }
  
  .card-rank {
    font-size: 1.8vmin;
  }
  
  .card-suit {
    font-size: 2.2vmin;
  }
}

/* 移动端优化 */
@media (max-width: 768px) and (orientation: portrait) {
  .top-bar {
    height: 4vh;
    padding: 0 3vw;
    min-height: 30px;
  }
  
  .game-title h1 {
    font-size: 1.8vmin;
  }
  
  .deck-info {
    font-size: 1.1vmin;
  }
  
  .bottom-area {
    height: 42vh;
    padding: 0.5vh 1vw;
    gap: 0.5vh;
  }
  
  .btn-pass,
  .btn-play,
  .btn-next {
    padding: 1vh 1.5vw;
    font-size: 1.8vmin;
  }
  
  .hand-card {
    width: 6vw;
    height: 8vh;
    min-width: 45px;
    min-height: 60px;
    max-width: 65px;
    max-height: 90px;
    margin-right: -2.2vw;
    transition: all 0.2s ease;
  }
  
  .hand-card.selected {
    transform: translateY(-1vh);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    border-color: #ffd700;
    border-width: 3px;
    transition: all 0.2s ease;
  }
  
  .card-rank {
    font-size: 1.5vmin;
  }
  
  .card-suit {
    font-size: 1.8vmin;
  }
}

/* 移动端横屏优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .top-bar {
    height: 6vh;
    padding: 0 2vw;
    min-height: 35px;
  }
  
  .game-title h1 {
    font-size: 1.5vmin;
  }
  
  .deck-info {
    font-size: 1.0vmin;
  }
  
  .bottom-area {
    height: 50vh;
    padding: 0.3vh 1vw;
    gap: 0.3vh;
  }
  
  .btn-pass,
  .btn-play,
  .btn-next {
    padding: 0.8vh 1.2vw;
    font-size: 1.5vmin;
  }
  
  .hand-card {
    width: 5vw;
    height: 7vh;
    min-width: 40px;
    min-height: 55px;
    max-width: 55px;
    max-height: 80px;
    margin-right: -2vw;
    transition: all 0.2s ease;
  }
  
  .hand-card.selected {
    transform: translateY(-0.8vh);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
    border-color: #ffd700;
    border-width: 2px;
    transition: all 0.2s ease;
  }
  
  .card-rank {
    font-size: 1.3vmin;
  }
  
  .card-suit {
    font-size: 1.5vmin;
  }
}
</style>