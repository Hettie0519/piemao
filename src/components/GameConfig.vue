<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { p2pManager } from '../utils/p2pManager';
import './GameConfig-styles-v2.css';

const gameStore = useGameStore();
const isInitializing = ref(true);

const props = defineProps<{
  playerName: string;
}>();

const emit = defineEmits<{
  updatePlayerName: [name: string];
}>();

// 监听昵称变化
watch(() => props.playerName, (newName: string) => {
  console.log('房主昵称变化:', newName);
  if (newName) {
    gameStore.myPlayerName = newName;
    // 我是房主，更新自己的昵称
    const player = gameStore.players.find(p => p.id === gameStore.myPlayerId);
    if (player) {
      player.name = newName;
      console.log('房主更新自己的昵称:', newName);
    }
    // 广播昵称更新
    gameStore.broadcastPlayerNameUpdate(newName);
  }
});

function onNameInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('updatePlayerName', target.value);
}

onMounted(() => {
  // 空实现，不需要检测屏幕方向
  
  // 如果昵称不为空，立即发送昵称更新
  if (props.playerName && props.playerName.trim()) {
    console.log('组件挂载时昵称已存在，立即更新昵称:', props.playerName);
    gameStore.myPlayerName = props.playerName;
    const player = gameStore.players.find(p => p.id === gameStore.myPlayerId);
    if (player) {
      player.name = props.playerName;
    }
    gameStore.broadcastPlayerNameUpdate(props.playerName);
  }
  
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
      <div class="config-card">
        <h2 class="card-title">你是房主 <span class="host-icon">👑</span></h2>
        
        <!-- 昵称输入 -->
        <div class="input-group">
          <label class="input-label">你的昵称</label>
          <input
            :value="playerName"
            @input="onNameInput"
            type="text"
            class="name-input"
            placeholder="请输入你的昵称"
          />
        </div>
        
        <!-- 牌副数配置 -->
        <div class="deck-section">
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
        <div class="players-section">
          <h5 class="card-title">玩家列表 ({{ gameStore.players.length }}/10)</h5>
          <div class="players-list">
            <div
              v-for="player in gameStore.players"
              :key="player.id"
              class="player-item"
            >
              <span v-if="player.isHost" class="host-badge">👑</span>
              {{ player.name || '未设置昵称' }}
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
  display: flex;
  flex-direction: column;
  gap: 2vh;
}

.card-title {
  margin: 0 0 1.5vh 0;
  font-size: 2.5vmin;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 1vh;
}

.input-label {
  font-size: 2vmin;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* 牌副数配置 */
.deck-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 2vh;
  border-radius: 1vh;
}

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
.players-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 2vh;
  border-radius: 1vh;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 1vh;
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