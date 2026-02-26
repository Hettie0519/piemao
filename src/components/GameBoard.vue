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
  <div class="container-fluid py-3 vh-100 d-flex flex-column game-container">
    <!-- 横屏提示 -->
    <div v-if="isPortrait" class="rotate-prompt">
      <div class="rotate-icon">📱</div>
      <h3>请旋转设备</h3>
      <p>为了更好的游戏体验，请横屏使用</p>
    </div>

    <div class="row flex-grow-1 mb-3" :class="{ 'blur-content': isPortrait }">
      <!-- 左侧：其他玩家信息 -->
      <div class="col-12 col-lg-3 col-md-4 mb-3 mb-md-0">
        <div class="card bg-secondary text-white h-100">
          <div class="card-header">
            <h5 class="mb-0">玩家</h5>
          </div>
          <div class="card-body overflow-auto">
            <div
              v-for="(player, index) in gameStore.players"
              :key="player.id"
              class="d-flex justify-content-between align-items-center mb-2 p-2 rounded"
              :class="{
                'bg-primary': index === gameStore.currentPlayerIndex,
                'bg-success': player.id === gameStore.myPlayerId,
              }"
            >
              <div>
                <span v-if="player.isHost" class="badge bg-warning text-dark me-1">房主</span>
                {{ player.name }}
                <span v-if="player.id === gameStore.myPlayerId" class="badge bg-light text-dark ms-1">你</span>
              </div>
              <span class="badge bg-dark">{{ player.handCount }} 张</span>
            </div>
          </div>
        </div>

        <!-- 游戏信息 -->
        <div class="card bg-dark text-white mt-3">
          <div class="card-header">
            <h5 class="mb-0">游戏信息</h5>
          </div>
          <div class="card-body">
            <p class="mb-1"><strong>牌副数:</strong> {{ gameStore.config.deckCount }}</p>
            <p class="mb-0"><strong>房间:</strong> {{ gameStore.roomId }}</p>
          </div>
        </div>
      </div>

      <!-- 中间：游戏桌面 -->
      <div class="col-12 col-lg-6 col-md-4 mb-3 mb-md-0">
        <div class="card bg-success text-white h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">游戏桌面</h5>
            <span v-if="gameStore.isMyTurn" class="badge bg-warning text-dark">轮到你了</span>
            <span v-else class="badge bg-secondary">等待 {{ gameStore.currentPlayer?.name }}</span>
          </div>
          <div class="card-body d-flex flex-column justify-content-center align-items-center">
            <!-- 上家出的牌 -->
            <div v-if="gameStore.lastHand" class="text-center">
              <p class="mb-2">上次出牌:</p>
              <div class="d-flex justify-content-center gap-2 mb-3 flex-wrap">
                <span
                  v-for="(cardInfo, index) in lastHandDisplay"
                  :key="index"
                  class="card-display"
                  :class="cardInfo.suit"
                >
                  {{ cardInfo.text }}
                </span>
              </div>
              <p class="text-muted small">由 {{ gameStore.players.find(p => p.id === gameStore.lastPlayerId)?.name }} 出牌</p>
            </div>
            <p v-else class="text-muted">等待出牌...</p>
          </div>
        </div>
      </div>

      <!-- 右侧：操作按钮 -->
      <div class="col-12 col-lg-3 col-md-4">
        <div class="card bg-dark text-white h-100">
          <div class="card-header">
            <h5 class="mb-0">操作</h5>
          </div>
          <div class="card-body d-flex flex-column gap-2">
            <button
              class="btn btn-primary py-3"
              @click="playSelectedCards"
              :disabled="!gameStore.isMyTurn || selectedCards.length === 0"
            >
              出牌 ({{ selectedCards.length }})
            </button>
            <button
              class="btn btn-secondary py-3"
              @click="passTurn"
              :disabled="!gameStore.canPass"
            >
              过牌
            </button>
            <button
              v-if="gameStore.isHost && gameStore.gameState === 'ended'"
              class="btn btn-warning py-3"
              @click="gameStore.nextRound"
            >
              下一局
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部：我的手牌 -->
    <div class="row flex-shrink-0">
      <div class="col-12">
        <div class="card bg-secondary text-white">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">我的手牌 ({{ gameStore.myHand.length }})</h5>
            <button class="btn btn-sm btn-outline-light" @click="selectedCards = []">
              取消选择
            </button>
          </div>
          <div class="card-body overflow-auto">
            <div class="d-flex flex-wrap gap-2 justify-content-center">
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
  </div>
</template>

<style scoped>
/* 桌面牌显示 */
.card-display {
  background: white;
  color: black;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 1.1rem;
  min-width: 50px;
  text-align: center;
}

.card-display.hearts,
.card-display.diamonds {
  color: #dc3545; /* 红色 */
}

.card-display.clubs,
.card-display.spades {
  color: #212529; /* 黑色 */
}

/* 手牌样式 */
.playing-card {
  width: 50px;
  height: 75px;
  background: white;
  border: 2px solid #333;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
  font-weight: bold;
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .playing-card {
    width: 60px;
    height: 90px;
  }
}

.playing-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.playing-card.selected {
  transform: translateY(-10px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  border-color: #ffc107;
}

.playing-card.red-heart-3 {
  border-color: #ffc107;
  border-width: 3px;
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
  gap: 4px;
}

.card-rank {
  font-size: 1.2rem;
  font-weight: bold;
}

.card-suit {
  font-size: 1.5rem;
}

.badge {
  font-size: 0.75rem;
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

/* 游戏容器 */
.game-container {
  overflow: hidden;
}
</style>