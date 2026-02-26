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
  <div id="app">
    <!-- 欢迎页面 -->
    <div v-if="showWelcome" class="welcome-container">
      <div class="welcome-card">
        <h1 class="game-title">撇二毛</h1>
        <p class="game-subtitle">P2P 联机扑克游戏</p>
        
        <div class="input-group">
          <label class="input-label" for="playerName">昵称</label>
          <input
            id="playerName"
            v-model="playerName"
            type="text"
            class="name-input"
            placeholder="请输入你的昵称"
            @keyup.enter="enterGame"
          />
        </div>
        
        <button class="btn-enter" @click="enterGame">进入游戏</button>
      </div>
    </div>

    <!-- 房间选择页面 -->
    <div v-else-if="showRoomSelection" class="welcome-container">
      <div class="welcome-card">
        <h2 class="page-title">选择模式</h2>
        <p class="greeting-text">你好，{{ playerName }}！</p>
        
        <div class="mode-buttons">
          <button class="btn-mode btn-create" @click="createRoom">
            <span class="btn-icon">🎮</span>
            <span class="btn-content">
              <span class="btn-text">创建房间</span>
              <span class="btn-desc">创建房间并邀请朋友加入</span>
            </span>
          </button>
          
          <button class="btn-mode btn-join" @click="joinRoom">
            <span class="btn-icon">🔗</span>
            <span class="btn-content">
              <span class="btn-text">加入房间</span>
              <span class="btn-desc">输入房间号加入朋友的房间</span>
            </span>
          </button>
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
}

#app {
  font-family: 'PingFang SC', 'HarmonyOS Sans', 'Noto Sans CJK', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
}

/* 欢迎页面容器 */
.welcome-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.welcome-card {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2vh;
  padding: 4vh 5vw;
  color: white;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 3vh;
  animation: fadeIn 0.5s ease-in;
  margin: 0 auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(2vh);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.game-title {
  font-size: 4vmin;
  font-weight: 700;
  text-align: center;
  margin: 0;
  letter-spacing: 0.5vmin;
}

.game-subtitle {
  font-size: 2vmin;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin: 0;
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

.name-input {
  width: 100%;
  padding: 2vh 3vw;
  border: none;
  border-radius: 1vh;
  background: rgba(255, 255, 255, 0.95);
  color: black;
  font-size: 2.5vmin;
  outline: none;
  transition: all 0.3s;
}

.name-input:focus {
  box-shadow: 0 0 0 0.4vh rgba(24, 144, 255, 0.5);
}

.name-input::placeholder {
  color: rgba(0, 0, 0, 0.4);
}

.btn-enter {
  width: 100%;
  padding: 2.5vh;
  border: none;
  border-radius: 1.5vh;
  background: linear-gradient(135deg, #1890FF 0%, #0D79D2 100%);
  color: white;
  font-size: 2.8vmin;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 0.5px;
}

.btn-enter:hover {
  transform: scale(1.02);
  box-shadow: 0 0.6vh 1.5vh rgba(24, 144, 255, 0.5);
}

.btn-enter:active {
  transform: scale(0.98);
}

/* 房间选择页面 */
.page-title {
  font-size: 3.5vmin;
  font-weight: 700;
  text-align: center;
  margin: 0;
}

.greeting-text {
  font-size: 2.2vmin;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  margin: 0;
}

.mode-buttons {
  display: flex;
  flex-direction: column;
  gap: 2vh;
}

.btn-mode {
  width: 100%;
  padding: 2.5vh 3vw;
  border: none;
  border-radius: 1.5vh;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 1.5vw;
  text-align: left;
}

.btn-create {
  background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
  color: white;
}

.btn-join {
  background: linear-gradient(135deg, #1890FF 0%, #0D79D2 100%);
  color: white;
}

.btn-mode:hover {
  transform: scale(1.02);
  box-shadow: 0 0.6vh 1.5vh rgba(0, 0, 0, 0.3);
}

.btn-mode:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 3vmin;
  flex-shrink: 0;
  line-height: 1;
}

.btn-content {
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
  align-items: flex-start;
}

.btn-text {
  font-size: 2.5vmin;
  font-weight: 600;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  line-height: 1.2;
}

.btn-desc {
  font-size: 1.8vmin;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  line-height: 1.2;
}

/* 桌面端优化 */
@media (min-width: 1024px) {
  .welcome-card {
    padding: 5vh 6vw;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .welcome-card {
    padding: 3vh 4vw;
    max-width: 90vw;
  }
  
  .game-title {
    font-size: 6vmin;
  }
  
  .game-subtitle {
    font-size: 2.5vmin;
  }
}
</style>