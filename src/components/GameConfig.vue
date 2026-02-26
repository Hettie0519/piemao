<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { p2pManager } from '../utils/p2pManager';

const gameStore = useGameStore();
const copied = ref(false);
const isInitializing = ref(true);

const roomId = computed(() => {
  const id = p2pManager.getMyId();
  return id || '生成中...';
});

onMounted(() => {
  // 空实现，不需要检测屏幕方向
  
  // 确保房间已创建
  if (!gameStore.isHost && gameStore.gameState === 'lobby') {
    gameStore.createRoom();
  }
  
  // 等待 PeerJS 初始化
  const checkInterval = setInterval(() => {
    if (p2pManager.getMyId()) {
      isInitializing.value = false;
      clearInterval(checkInterval);
    }
  }, 100);
});

onUnmounted(() => {
  // 空实现
});

function copyRoomId() {
  const id = p2pManager.getMyId();
  if (id) {
    navigator.clipboard.writeText(roomId.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

function startGame() {
  if (gameStore.players.length < 2) {
    alert('至少需要2名玩家才能开始游戏');
    return;
  }
  gameStore.startGame();
}
</script>

<template>
  <div class="game-container vh-100 d-flex flex-column">
<!-- 配置界面 -->
    <div class="config-content">
      <!-- 房间信息 -->
      <div class="config-card">
        <h2 class="card-title">房间号</h2>
        <div class="room-id-group">
          <input
            type="text"
            class="room-id-input"
            :value="roomId"
            readonly
          />
          <button class="btn-copy" @click="copyRoomId">
            {{ copied ? '已复制!' : '复制' }}
          </button>
        </div>
        <small class="help-text">⚠️ 请复制完整的房间号分享给朋友</small>
      </div>

      <!-- 牌副数配置 -->
      <div class="config-card">
        <h5 class="card-title">扑克牌副数</h5>
        <div class="deck-control">
          <button
            class="btn-deck"
            @click="gameStore.config.deckCount = Math.max(1, gameStore.config.deckCount - 1)"
            :disabled="gameStore.config.deckCount <= 1"
          >
            -
          </button>
          <span class="deck-count">{{ gameStore.config.deckCount }}</span>
          <button
            class="btn-deck"
            @click="gameStore.config.deckCount = Math.min(10, gameStore.config.deckCount + 1)"
            :disabled="gameStore.config.deckCount >= 10"
          >
            +
          </button>
        </div>
        <small class="help-text">牌副数越多，炸弹和大牌出现概率越高</small>
      </div>

      <!-- 玩家列表 -->
      <div class="config-card">
        <h5 class="card-title">玩家列表 ({{ gameStore.players.length }}/10)</h5>
        <div class="players-list">
          <div
            v-for="player in gameStore.players"
            :key="player.id"
            class="player-item"
          >
            <span v-if="player.isHost" class="host-badge">👑</span>
            {{ player.name }}
            <span v-if="player.id === gameStore.myPlayerId" class="my-badge">你</span>
          </div>
        </div>
      </div>

      <!-- 开始按钮 -->
      <button
        class="btn-start"
        @click="startGame"
        :disabled="gameStore.players.length < 2"
      >
        开始游戏
      </button>
      <p v-if="gameStore.players.length < 2" class="waiting-text">
        等待更多玩家加入...
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 游戏容器 */
.game-container {
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 2vh;
  padding: 2vh;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2vh;
}

.config-card {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2vh;
  padding: 2.5vh 3vw;
  color: white;
}

.card-title {
  margin: 0 0 1.5vh 0;
  font-size: 2.5vmin;
}

/* 房间号 */
.room-id-group {
  display: flex;
  gap: 1vw;
  margin-bottom: 1.5vh;
}

.room-id-input {
  flex: 1;
  padding: 1.5vh 2vw;
  border: none;
  border-radius: 1vh;
  font-size: 1.8vmin;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.9);
  color: black;
}

.btn-copy {
  padding: 1.5vh 3vw;
  border: none;
  border-radius: 1vh;
  background: linear-gradient(135deg, #ffc107 0%, #ffca2c 100%);
  color: black;
  font-weight: bold;
  font-size: 2vmin;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy:hover {
  transform: scale(1.05);
  box-shadow: 0 0.4vh 1vh rgba(255, 193, 7, 0.5);
}

/* 牌副数控制 */
.deck-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2vw;
  margin-bottom: 1.5vh;
}

.btn-deck {
  width: 6vh;
  height: 6vh;
  border: none;
  border-radius: 1vh;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 3vmin;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-deck:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.btn-deck:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.deck-count {
  font-size: 3vmin;
  font-weight: bold;
  min-width: 3vmin;
  text-align: center;
}

/* 玩家列表 */
.players-list {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-bottom: 1vh;
}

.player-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5vh 2vw;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  gap: 1vw;
}

.host-badge {
  font-size: 2vmin;
}

.my-badge {
  background: #28a745;
  color: white;
  padding: 0.5vh 1vw;
  border-radius: 1vmin;
  font-size: 1.5vmin;
  margin-left: auto;
}

/* 开始按钮 */
.btn-start {
  width: 100%;
  padding: 2.5vh;
  border: none;
  border-radius: 1.5vh;
  background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
  color: white;
  font-weight: bold;
  font-size: 3vmin;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-start:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 0.6vh 1.5vh rgba(40, 167, 69, 0.5);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.waiting-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  font-size: 2vmin;
}

.help-text {
  display: block;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.8vmin;
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .config-content {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .config-card {
    padding: 3vh 4vw;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .config-content {
    padding: 1.5vh;
  }
  
  .config-card {
    padding: 2vh 3vw;
  }
  
  .card-title {
    font-size: 3vmin;
  }
}
</style>