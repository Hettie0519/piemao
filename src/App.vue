<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useGameStore } from './stores/gameStore';
import GameConfig from './components/GameConfig.vue';
import GameLobby from './components/GameLobby.vue';
import GameBoard from './components/GameBoard.vue';
import GameResult from './components/GameResult.vue';
import { GameState } from './types/game';

const gameStore = useGameStore();
const playerName = ref('');
const showWelcome = ref(true);
const showRoomSelection = ref(false);

onMounted(async () => {
  // 从本地存储加载昵称
  const savedName = localStorage.getItem('piemao_nickname');
  if (savedName) {
    playerName.value = savedName;
  }
});

async function enterGame() {
  if (!playerName.value.trim()) {
    alert('请输入昵称');
    return;
  }
  
  // 保存昵称
  localStorage.setItem('piemao_nickname', playerName.value);
  
  // 初始化 P2P 连接
  await gameStore.initialize(playerName.value);
  
  showWelcome.value = false;
  showRoomSelection.value = true;
}

function createRoom() {
  gameStore.createRoom();
  showRoomSelection.value = false;
}

function joinRoom() {
  // 隐藏房间选择页面，实际加入逻辑在 GameLobby 组件中处理
  showRoomSelection.value = false;
}
</script>

<template>
  <div id="app" class="min-vh-100 bg-dark text-white">
    <!-- 欢迎页面 -->
    <div v-if="showWelcome" class="d-flex align-items-center justify-content-center min-vh-100">
      <div class="card bg-secondary text-white p-4" style="max-width: 400px; width: 100%;">
        <h1 class="text-center mb-4">撇二毛</h1>
        <p class="text-center mb-4 text-muted">P2P 联机扑克游戏</p>
        <div class="mb-3">
          <label for="playerName" class="form-label">昵称</label>
          <input
            id="playerName"
            v-model="playerName"
            type="text"
            class="form-control"
            placeholder="请输入你的昵称"
            @keyup.enter="enterGame"
          />
        </div>
        <button class="btn btn-primary w-100" @click="enterGame">进入游戏</button>
      </div>
    </div>

    <!-- 房间选择页面 -->
    <div v-else-if="showRoomSelection" class="d-flex align-items-center justify-content-center min-vh-100">
      <div class="card bg-secondary text-white p-4" style="max-width: 500px; width: 100%;">
        <h2 class="text-center mb-4">选择模式</h2>
        <p class="text-center mb-4 text-muted">你好，{{ playerName }}！</p>
        
        <div class="d-grid gap-3">
          <button class="btn btn-success py-3 fs-5" @click="createRoom">
            🎮 创建房间
          </button>
          <p class="text-center text-muted small mb-0">创建房间并邀请朋友加入</p>
          
          <button class="btn btn-primary py-3 fs-5" @click="joinRoom">
            🔗 加入房间
          </button>
          <p class="text-center text-muted small mb-0">输入房间号加入朋友的房间</p>
        </div>
      </div>
    </div>

    <!-- 游戏配置 -->
    <GameConfig v-else-if="gameStore.gameState === GameState.LOBBY && gameStore.isHost" />

    <!-- 游戏大厅 -->
    <GameLobby v-else-if="gameStore.gameState === GameState.LOBBY && !gameStore.isHost" />

    <!-- 游戏主界面 -->
    <GameBoard v-else-if="gameStore.gameState === GameState.PLAYING" />

    <!-- 游戏结果 -->
    <GameResult v-else-if="gameStore.gameState === GameState.ENDED" />
  </div>
</template>

<style>
#app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.card {
  border-radius: 12px;
}

.btn {
  border-radius: 8px;
}

.form-control {
  border-radius: 8px;
}
</style>