<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { sortCards, formatCard, SUIT_SYMBOLS } from '../utils/cardUtils';
import type { Card } from '../types/game';

const gameStore = useGameStore();
const selectedCards = ref<Card[]>([]);

onMounted(() => {
  // 空实现，不需要检测屏幕方向
});

onUnmounted(() => {
  // 空实现
});

const sortedHand = computed(() => sortCards(gameStore.myHand));

// 其他玩家列表（排除自己）
const otherPlayers = computed(() => {
  return gameStore.players.filter(p => p.id !== gameStore.myPlayerId);
});

// 左侧玩家（上半部分）
const leftPlayers = computed(() => {
  const players = otherPlayers.value;
  if (players.length === 0) return [];
  return [players[0]];
});

// 右侧玩家（下半部分）
const rightPlayers = computed(() => {
  const players = otherPlayers.value;
  if (players.length <= 1) return [];
  return players.slice(1);
});

// 获取右侧玩家在原数组中的实际索引
function getRightPlayerActualIndex(index: number) {
  return index + 1;
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

// 判断是否是每行的最后一个牌（实际上就是最后一张牌，因为所有牌都在一行）
function isLineEnd(index: number) {
  return index === gameStore.myHand.length - 1;
}
</script>

<template>
  <div class="game-container">
    <!-- 游戏界面 -->
    <div class="game-layout">
      <!-- 顶部信息栏 -->
      <div class="top-bar">
        <div class="game-title">
          <h1>撇二毛</h1>
          <span class="room-info">房间: {{ gameStore.roomId }}</span>
        </div>
        <div class="deck-info">
          <span>牌副数: {{ gameStore.config.deckCount }}</span>
        </div>
      </div>

      <!-- 游戏主区域 -->
      <div class="game-main">
        <!-- 左侧对手 -->
        <div
          v-for="(player, index) in leftPlayers"
          :key="player!.id"
          class="player-left"
          :class="{ 'current-turn': index === gameStore.currentPlayerIndex }"
        >
          <div class="player-info">
            <span v-if="player!.isHost" class="crown">👑</span>
            <span class="player-number">{{ index + 1 }}</span>
            <span class="player-name">{{ player!.name }}</span>
            <span class="player-hand-count">{{ player!.handCount }} 张</span>
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

        <!-- 右侧对手 -->
        <div
          v-for="(player, index) in rightPlayers"
          :key="player!.id"
          class="player-right"
          :class="{ 'current-turn': getRightPlayerIndex(index) === gameStore.currentPlayerIndex }"
        >
          <div class="player-info">
            <span v-if="player!.isHost" class="crown">👑</span>
            <span class="player-number">{{ getRightPlayerActualIndex(index) + 1 }}</span>
            <span class="player-name">{{ player!.name }}</span>
            <span class="player-hand-count">{{ player!.handCount }} 张</span>
          </div>
        </div>
      </div>

      <!-- 底部我的区域 -->
      <div class="bottom-area">
        <!-- 我的信息 -->
        <div class="my-info">
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
              @click="toggleCardSelection(card)"
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

.room-info {
  font-size: 1.3vmin;
  color: rgba(255, 255, 255, 0.7);
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
  grid-template-columns: 10vw 1fr 10vw;
  gap: 1vw;
  padding: 1vh;
}

/* 左侧玩家 */
.player-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
}

/* 我的信息 */
.my-info {
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 0.5vh 1.5vw;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 1vh;
  border: 1px solid rgba(255, 215, 0, 0.3);
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
  justify-content: center;
  gap: 0.5vh;
  width: 100%;
  padding: 0 2vw;
  overflow: hidden;
}

.hand-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  justify-content: center;
  align-items: center;
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

.hand-card:hover,
.hand-card.selected {
  z-index: 10;
  transform: translateY(-0.8vh) scale(1.05);
}

/* 每行的最后一个牌不堆叠 */
.hand-cards > .hand-card.line-end {
  margin-right: 0;
}

/* 每行的第一张牌左边距为0 */
.hand-cards > .hand-card:first-child {
  margin-left: 0;
}

/* 每行之间添加间距 */
.hand-cards > .hand-card:nth-child(n) {
  /* 每行的第一张牌右边添加间距 */
}

/* 使用 CSS 变量实现自动换行间距 */
.hand-cards {
  --cards-per-line: 12;
}

@media (min-width: 1024px) {
  .hand-cards {
    --cards-per-line: 12;
  }
}

@media (min-width: 1366px) {
  .hand-cards {
    --cards-per-line: 15;
  }
}

@media (min-width: 1920px) {
  .hand-cards {
    --cards-per-line: 18;
  }
}

.hand-card {
  margin-left: calc(100% / var(--cards-per-line) * -0.8 + var(--margin-right, 0));
  margin-right: var(--margin-right, -1.5vw);
}

/* 桌面端 */
@media (min-width: 1024px) {
  .hand-card {
    margin-left: calc(100% / 12 * -0.8 + var(--margin-right, 0));
    margin-right: var(--margin-right, -1.8vw);
  }
}

@media (min-width: 1366px) {
  .hand-card {
    margin-left: calc(100% / 15 * -0.8 + var(--margin-right, 0));
    margin-right: var(--margin-right, -1.8vw);
  }
}

@media (min-width: 1920px) {
  .hand-card {
    margin-left: calc(100% / 18 * -0.8 + var(--margin-right, 0));
    margin-right: var(--margin-right, -1.8vw);
  }
}

/* 移动端 */
@media (max-width: 767px) {
  .hand-cards {
    --cards-per-line: 10;
  }
  
  .hand-card {
    margin-left: calc(100% / 10 * -0.8 + var(--margin-right, 0));
    margin-right: var(--margin-right, -2.2vw);
  }
}

.hand-card:hover {
  transform: translateY(-0.3vh);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.hand-card.selected {
  transform: translateY(-0.8vh);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  border-color: #ffd700;
  border-width: 3px;
}

.hand-card.red-heart-3 {
  border-color: #ffd700;
  border-width: 3px;
}

.hand-card.hearts,
.hand-card.diamonds {
  color: #dc3545;
}

.hand-card.clubs,
.hand-card.spades {
  color: #000;
}

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
  min-font-size: 14px;
}

.card-suit {
  font-size: 2.2vmin;
  line-height: 1;
  min-font-size: 16px;
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
@media (max-width: 768px) {
  .top-bar {
    height: 4vh;
    padding: 0 3vw;
    min-height: 30px;
  }
  
  .game-title h1 {
    font-size: 1.8vmin;
  }
  
  .room-info,
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
  }
  
  .card-rank {
    font-size: 1.5vmin;
  }
  
  .card-suit {
    font-size: 1.8vmin;
  }
}
</style>