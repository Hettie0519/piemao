<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';

const gameStore = useGameStore();
const hostIdInput = ref('');
const joining = ref(false);

onMounted(() => {
  // 空实现，不需要检测屏幕方向
});

onUnmounted(() => {
  // 空实现
});

async function joinRoom() {
  if (!hostIdInput.value.trim()) {
    alert('请输入房间号');
    return;
  }
  
  joining.value = true;
  const success = await gameStore.joinRoom(hostIdInput.value);
  
  if (!success) {
    alert('加入房间失败，请检查房间号是否正确');
    joining.value = false;
  } else {
    // 成功加入，等待游戏开始
    joining.value = false;
    console.log('成功加入房间，等待房主开始游戏');
  }
}
</script>

<template>
  <div class="game-container vh-100 d-flex flex-column">
<!-- 大厅界面 -->
    <div class="lobby-content">
      <div class="lobby-card">
        <h2 class="lobby-title">加入房间</h2>
        <div class="input-group">
          <input
            v-model="hostIdInput"
            type="text"
            class="form-input"
            placeholder="请粘贴完整的房间号（约36个字符）"
            @keyup.enter="joinRoom"
          />
          <button
            v-if="gameStore.players.length === 0"
            class="btn-join"
            @click="joinRoom"
            :disabled="joining"
          >
            {{ joining ? '加入中...' : '加入房间' }}
          </button>
        </div>
        <small class="help-text">
          ⚠️ 必须粘贴房主分享的完整房间号，不能有任何遗漏
        </small>
      </div>

      <!-- 玩家列表 -->
      <div v-if="gameStore.players.length > 0" class="players-card">
        <h5 class="card-title">玩家列表</h5>
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
        <p class="waiting-text">等待房主开始游戏...</p>
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

.lobby-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 3vh;
  height: 100%;
  padding: 2vh;
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.lobby-card,
.players-card {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2vh;
  padding: 3vh 4vw;
  color: white;
  width: 100%;
  max-width: 50vw;
  min-width: 300px;
}

.lobby-title {
  margin: 0 0 2vh 0;
  font-size: 3vmin;
  text-align: center;
}

.input-group {
  display: flex;
  gap: 1vw;
  margin-bottom: 1.5vh;
}

.form-input {
  flex: 1;
  padding: 1.5vh 2vw;
  border: none;
  border-radius: 1vh;
  font-size: 2vmin;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.9);
}

.btn-join {
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

.btn-join:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0.4vh 1vh rgba(255, 193, 7, 0.5);
}

.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.help-text {
  display: block;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.8vmin;
  text-align: center;
}

.card-title {
  margin: 0 0 2vh 0;
  font-size: 2.5vmin;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-bottom: 2vh;
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

.waiting-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  font-size: 2vmin;
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .lobby-content {
    flex-direction: row;
  }
  
  .lobby-card,
  .players-card {
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .lobby-card,
  .players-card {
    max-width: 90vw;
    padding: 2vh 3vw;
  }
  
  .lobby-title {
    font-size: 4vmin;
  }
  
  .form-input,
  .btn-join {
    font-size: 2.5vmin;
  }
}
</style>