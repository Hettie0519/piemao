<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useGameStore } from './stores/gameStore';
import GameConfig from './components/GameConfig.vue';
import GameLobby from './components/GameLobby.vue';
import GameBoard from './components/GameBoard.vue';
import GameResult from './components/GameResult.vue';
import { GameState } from './types/game';

const gameStore = useGameStore();
const playerName = ref('');
const showWelcome = ref(true);
const isInitializing = ref(false);

onMounted(async () => {
  // 禁用页面复制功能
  document.addEventListener('copy', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('cut', (e) => e.preventDefault());
  
  // 从本地存储加载昵称
  const savedName = localStorage.getItem('piemao_nickname');
  if (savedName) {
    playerName.value = savedName;
  }
  
  // 自动初始化 P2P（不输入昵称）
  isInitializing.value = true;
  try {
    await gameStore.initialize('');
    
    // 等待 myPlayerId 被设置
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
    
    console.log('初始化完成，myPlayerId:', gameStore.myPlayerId);
    
    // 只有当 myPlayerId 等于固定房间号时，才创建房间
    if (gameStore.myPlayerId === 'hettie2026') {
      console.log('我是房主，创建房间');
      gameStore.createRoom();
      console.log('房间创建完成，gameState:', gameStore.gameState);
      console.log('isHost:', gameStore.isHost);
    } else {
      console.log('我是玩家，等待加入房间');
    }
    
    // 隐藏欢迎页面
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
    localStorage.setItem('piemao_nickname', newName);
  }
});
</script>

<template>
  <div id="app">
    <!-- 欢迎页面（显示加载状态） -->
    <div v-if="showWelcome" class="welcome-container">
      <div class="welcome-card">
        <h1 class="game-title">踹牌</h1>
        <p class="game-subtitle">P2P 联机扑克游戏</p>
        
        <div v-if="isInitializing" class="loading-state">
          <div class="spinner"></div>
          <p>正在连接房间...</p>
        </div>
      </div>
    </div>

    <!-- 游戏配置（房主 - 包含昵称输入） -->
    <GameConfig v-else-if="gameStore.gameState === GameState.LOBBY && gameStore.isHost" :playerName="playerName" @updatePlayerName="playerName = $event" />

    <!-- 游戏大厅（玩家 - 包含昵称输入） -->
    <GameLobby v-else-if="gameStore.gameState === GameState.LOBBY && !gameStore.isHost" :playerName="playerName" @updatePlayerName="playerName = $event" />

    <!-- 游戏主界面（包含石头剪子布） -->
    <GameBoard v-else-if="gameStore.gameState === GameState.PLAYING || gameStore.gameState === GameState.ROCK_PAPER_SCISSORS" />

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

/* 昵称输入框样式已移至组件样式文件中 */

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