<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { sortCards, formatCard, SUIT_SYMBOLS } from '../utils/cardUtils';
import type { Card } from '../types/game';

const gameStore = useGameStore();
const selectedCards = ref<Card[]>([]);
const isPortrait = ref(false);

// 检测屏幕方向
function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth;
}

onMounted(() => {
  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation);
  window.removeEventListener('orientationchange', checkOrientation);
});

const sortedHand = computed(() => sortCards(gameStore.myHand));

// 其他玩家列表（排除自己）
const otherPlayers = computed(() => {
  return gameStore.players.filter(p => p.id !== gameStore.myPlayerId);
});

// 调整后的当前玩家索引（用于其他玩家列表）
const adjustedCurrentPlayerIndex = computed(() => {
  const myIndex = gameStore.players.findIndex(p => p.id === gameStore.myPlayerId);
  const currentIndex = gameStore.currentPlayerIndex;
  
  if (myIndex === -1 || currentIndex === myIndex) return -1;
  
  // 在 otherPlayers 数组中的索引
  const adjustedIndex = currentIndex > myIndex ? currentIndex - 1 : currentIndex;
  return adjustedIndex;
});

// 计算最后出牌的显示信息
const lastHandDisplay = computed(() => {
  if (!gameStore.lastHand || !gameStore.lastHand.cards || gameStore.lastHand.cards.length === 0) {
    return [];
  }
  
  // 检查是否是完整的 Card 对象数组
  const firstCard = gameStore.lastHand.cards[0];
  if (typeof firstCard === 'object' && 'suit' in firstCard) {
    // 是完整的 Card 对象
    return gameStore.lastHand.cards.map((card: Card) => ({
      text: formatCard(card),
      suit: card.suit,
    }));
  }
  
  // 是 ID 数组，从自己的手牌中查找
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

function toggleCardSelection(card: Card) {
  const index = selectedCards.value.findIndex(c => c.id === card.id);
  if (index === -1) {
    selectedCards.value.push(card);
  } else {
    selectedCards.value.splice(index, 1);
  }
}

function isSelected(card: Card) {
  return selectedCards.value.some(c => c.id === card.id);
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
</script>

<template>
  <div class="game-container vh-100 d-flex flex-column">
    <!-- 横屏提示 -->
    <div v-if="isPortrait" class="rotate-prompt">
      <div class="rotate-icon">📱</div>
      <h3>请旋转设备</h3>
      <p>为了更好的游戏体验，请横屏使用</p>
    </div>

    <!-- 游戏主界面 -->
    <div class="game-layout flex-grow-1" :class="{ 'blur-content': isPortrait }">
      <!-- 顶部：其他玩家信息 -->
      <div class="top-players">
        <div
          v-for="(player, index) in otherPlayers"
          :key="player.id"
          class="player-card"
          :class="{
            'current-turn': index === adjustedCurrentPlayerIndex,
          }"
        >
          <div class="player-avatar">
            <span v-if="player.isHost" class="host-badge">👑</span>
            <span class="player-name">{{ player.name }}</span>
          </div>
          <div class="player-cards">{{ player.handCount }} 张</div>
        </div>
      </div>

      <!-- 中间：游戏桌面 -->
      <div class="game-table">
        <div class="table-info">
          <span class="info-item">牌副数: {{ gameStore.config.deckCount }}</span>
          <span class="info-item">房间: {{ gameStore.roomId?.slice(0, 8) }}...</span>
        </div>
        
        <!-- 上家出的牌 -->
        <div v-if="gameStore.lastHand" class="last-played">
          <p class="last-label">上次出牌</p>
          <div class="played-cards">
            <span
              v-for="(cardInfo, index) in lastHandDisplay"
              :key="index"
              class="card-display"
              :class="cardInfo.suit"
            >
              {{ cardInfo.text }}
            </span>
          </div>
          <p class="last-player">由 {{ gameStore.players.find(p => p.id === gameStore.lastPlayerId)?.name }} 出牌</p>
        </div>
        <p v-else class="waiting-text">等待出牌...</p>
      </div>

      <!-- 底部：我的手牌和操作 -->
      <div class="bottom-section">
        <!-- 我的信息 -->
        <div class="my-info">
          <div class="my-avatar">
            <span v-if="gameStore.isHost" class="host-badge">👑</span>
            <span class="my-name">{{ gameStore.myPlayerName }}</span>
            <span class="my-cards">{{ gameStore.myHand.length }} 张</span>
          </div>
          <div class="turn-indicator" :class="{ active: gameStore.isMyTurn }">
            {{ gameStore.isMyTurn ? '轮到你了' : `等待 ${gameStore.currentPlayer?.name}` }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button
            class="btn-action btn-pass"
            @click="passTurn"
            :disabled="!gameStore.canPass"
          >
            过牌
          </button>
          <button
            class="btn-action btn-play"
            @click="playSelectedCards"
            :disabled="!gameStore.isMyTurn || selectedCards.length === 0"
          >
            出牌 ({{ selectedCards.length }})
          </button>
          <button
            v-if="gameStore.isHost && gameStore.gameState === 'ended'"
            class="btn-action btn-next"
            @click="gameStore.nextRound"
          >
            下一局
          </button>
        </div>

        <!-- 我的手牌 -->
        <div class="my-hand">
          <div class="hand-cards">
            <div
              v-for="card in sortedHand"
              :key="card.id"
              class="playing-card"
              :class="{
                'selected': isSelected(card),
                'red-heart-3': card.isRedHeart3,
                'hearts': card.suit === 'hearts',
                'diamonds': card.suit === 'diamonds',
                'clubs': card.suit === 'clubs',
                'spades': card.suit === 'spades',
              }"
              @click="toggleCardSelection(card)"
            >
              <div class="card-content">
                <span class="card-rank">{{ card.rank }}</span>
                <span class="card-suit">{{ SUIT_SYMBOLS[card.suit] }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 游戏容器 */
.game-container {
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
  overflow: hidden;
}

.game-layout {
  display: flex;
  flex-direction: column;
  padding: 5px;
  gap: 5px;
}

/* 顶部玩家 */
.top-players {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 5px;
}

.player-card {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  padding: 8px 12px;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.player-card.current-turn {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.3);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(255, 193, 7, 0);
  }
}

.player-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-badge {
  font-size: 1rem;
}

.player-name {
  font-weight: bold;
  font-size: 0.85rem;
}

.player-cards {
  background: rgba(255, 255, 255, 0.2);
  padding: 3px 8px;
  border-radius: 15px;
  font-size: 0.8rem;
}

/* 游戏桌面 */
.game-table {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  position: relative;
  min-height: 120px;
}

.table-info {
  position: absolute;
  top: 8px;
  right: 10px;
  display: flex;
  gap: 10px;
}

.info-item {
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 8px;
  border-radius: 12px;
  color: white;
  font-size: 0.75rem;
}

.last-played {
  text-align: center;
}

.last-label {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
  font-size: 0.85rem;
}

.played-cards {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.card-display {
  background: white;
  color: black;
  padding: 6px 10px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 1rem;
  min-width: 40px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.card-display.hearts,
.card-display.diamonds {
  color: #dc3545;
}

.card-display.clubs,
.card-display.spades {
  color: #212529;
}

.last-player {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  margin: 0;
}

.waiting-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.95rem;
}

/* 底部区域 */
.bottom-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.my-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
}

.my-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
}

.my-name {
  font-weight: bold;
  font-size: 0.95rem;
}

.my-cards {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.85rem;
}

.turn-indicator {
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 12px;
  border-radius: 15px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
}

.turn-indicator.active {
  background: #ffc107;
  color: black;
  font-weight: bold;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px #ffc107;
  }
  50% {
    box-shadow: 0 0 15px #ffc107;
  }
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 0 10px;
}

.btn-action {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-pass {
  background: rgba(108, 117, 125, 0.9);
  color: white;
}

.btn-pass:hover:not(:disabled) {
  background: rgba(108, 117, 125, 1);
}

.btn-play {
  background: linear-gradient(135deg, #ffc107 0%, #ffca2c 100%);
  color: black;
}

.btn-play:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.5);
}

.btn-next {
  background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
  color: white;
}

.btn-next:hover:not(:disabled) {
  transform: scale(1.05);
}

/* 我的手牌 */
.my-hand {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px 12px 0 0;
  padding: 8px 5px;
  min-height: 95px;
}

.hand-cards {
  display: flex;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* 手牌样式 */
.playing-card {
  width: 45px;
  height: 68px;
  background: white;
  border: 2px solid #333;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
  font-weight: bold;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.playing-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.playing-card.selected {
  transform: translateY(-12px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
  border-color: #ffc107;
  border-width: 2px;
}

.playing-card.red-heart-3 {
  border-color: #ffc107;
  border-width: 2px;
}

.playing-card.hearts,
.playing-card.diamonds {
  color: #dc3545;
}

.playing-card.clubs,
.playing-card.spades {
  color: #212529;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.card-rank {
  font-size: 1rem;
  font-weight: bold;
}

.card-suit {
  font-size: 1.2rem;
}

/* 横屏提示 */
.rotate-prompt {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 9999;
  text-align: center;
  padding: 20px;
}

.rotate-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: rotate-phone 2s ease-in-out infinite;
}

@keyframes rotate-phone {
  0%, 100% {
    transform: rotate(-90deg);
  }
  50% {
    transform: rotate(-90deg) scale(1.1);
  }
}

.rotate-prompt h3 {
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.rotate-prompt p {
  font-size: 1rem;
  color: #ccc;
}

.blur-content {
  filter: blur(5px);
  pointer-events: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .top-players {
    gap: 8px;
    padding: 5px;
  }

  .player-card {
    min-width: 90px;
    padding: 6px 10px;
  }

  .playing-card {
    width: 40px;
    height: 62px;
  }

  .btn-action {
    padding: 6px 16px;
    font-size: 0.85rem;
  }

  .card-display {
    padding: 5px 8px;
    font-size: 0.9rem;
    min-width: 36px;
  }

  .my-hand {
    padding: 6px 4px;
    min-height: 85px;
  }

  .game-table {
    padding: 8px;
    min-height: 100px;
  }
}

/* 超小屏幕适配 */
@media (max-height: 400px) {
  .game-layout {
    padding: 3px;
    gap: 3px;
  }

  .top-players {
    gap: 6px;
    padding: 3px;
  }

  .player-card {
    min-width: 80px;
    padding: 5px 8px;
  }

  .playing-card {
    width: 36px;
    height: 56px;
  }

  .card-rank {
    font-size: 0.9rem;
  }

  .card-suit {
    font-size: 1rem;
  }

  .my-hand {
    padding: 5px 3px;
    min-height: 75px;
  }

  .action-buttons {
    gap: 6px;
  }

  .btn-action {
    padding: 5px 14px;
    font-size: 0.8rem;
  }
}
</style>