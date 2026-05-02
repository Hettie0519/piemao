<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import { useGameStore } from './stores/gameStore';
import GameConfig from './components/GameConfig.vue';
import GameLobby from './components/GameLobby.vue';
import GameBoard from './components/GameBoard.vue';
import GameResult from './components/GameResult.vue';
import { GameState, PlayerStatus } from './types/game';

const gameStore = useGameStore();
const playerName = ref('');
const showWelcome = ref(true);
const isInitializing = ref(false);

// 判断是否应该显示 GameLobby
const shouldShowGameLobby = computed(() => {
  return (gameStore.gameState === GameState.LOBBY && !gameStore.isHost) ||
         (gameStore.myPlayer?.status === PlayerStatus.WAITING);
});

// 判断是否应该显示 GameBoard
const shouldShowGameBoard = computed(() => {
  return (gameStore.gameState === GameState.PLAYING || gameStore.gameState === GameState.ROCK_PAPER_SCISSORS) &&
         gameStore.myPlayer?.status !== PlayerStatus.WAITING;
});

onMounted(async () => {
  // 禁用页面复制功能
  document.addEventListener('copy', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('cut', (e) => e.preventDefault());

  // 从本地存储加载昵称
  const savedName = localStorage.getItem('chuaipoker_nickname');
  if (savedName) {
    playerName.value = savedName;
  }

  // 初始化 WebSocket 连接
  isInitializing.value = true;
  try {
    await gameStore.initialize('');

    // 等待连接成功
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (gameStore.myPlayerId) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // 5秒超时
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    // 发送加入请求
    gameStore.joinGame(playerName.value);

    showWelcome.value = false;
  } catch (error) {
    console.error('初始化失败:', error);
  } finally {
    isInitializing.value = false;
  }
});

// 监听昵称变化并保存
watch(playerName, (newName) => {
  if (newName) {
    localStorage.setItem('chuaipoker_nickname', newName);
  }
});
</script>

<template>
  <div id="app">
    <!-- 欢迎页面（显示加载状态） -->
    <div v-if="showWelcome" class="welcome-container">
      <div class="welcome-card">
        <h1 class="game-title">踹牌</h1>
        <p class="game-subtitle">多人联机扑克游戏</p>

        <div v-if="isInitializing" class="loading-state">
          <div class="spinner"></div>
          <p>正在连接服务器...</p>
        </div>
      </div>
    </div>

    <!-- 游戏配置（房主 - 包含昵称输入） -->
    <GameConfig v-else-if="gameStore.gameState === GameState.LOBBY && gameStore.isHost" :playerName="playerName" @updatePlayerName="playerName = $event" />

    <!-- 游戏大厅（玩家 - 包含昵称输入） -->
    <GameLobby v-else-if="shouldShowGameLobby" :playerName="playerName" @updatePlayerName="playerName = $event" />

    <!-- 游戏主界面（包含石头剪子布） -->
    <GameBoard v-else-if="shouldShowGameBoard" />

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
  display: flex;
  align-items: center;
  justify-content: center;
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

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 4vh 0;
}

.spinner {
  width: 8vmin;
  height: 8vmin;
  border: 0.6vh solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  margin: 0;
  font-size: 2.2vmin;
  color: rgba(255, 255, 255, 0.8);
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
