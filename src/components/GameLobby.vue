<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';
import './GameLobby-styles-v2.css';

const gameStore = useGameStore();
const joining = ref(false);
const FIXED_ROOM_ID = 'hettie2026';

const props = defineProps<{
  playerName: string;
}>();

const emit = defineEmits<{
  updatePlayerName: [name: string];
}>();

// 监听昵称变化
watch(() => props.playerName, (newName: string) => {
  console.log('watch 被触发，props.playerName:', newName);
  console.log('watch 被触发，gameStore.myPlayerName:', gameStore.myPlayerName);
  if (newName) {
    gameStore.myPlayerName = newName;
    // 发送昵称更新给房主
    console.log('发送昵称更新给房主:', newName);
    gameStore.sendPlayerNameUpdate(newName);
  }
});

function onNameInput(event: Event) {
  const target = event.target as HTMLInputElement;
  console.log('onNameInput 被调用:', target.value);
  emit('updatePlayerName', target.value);
}

onMounted(() => {
  // 空实现，不需要检测屏幕方向
  
  // 如果昵称不为空，立即发送昵称更新
  if (props.playerName && props.playerName.trim()) {
    console.log('组件挂载时昵称已存在，立即发送昵称更新:', props.playerName);
    gameStore.myPlayerName = props.playerName;
    gameStore.sendPlayerNameUpdate(props.playerName);
  }
});

onUnmounted(() => {
  // 空实现
});

async function joinRoom() {
  joining.value = true;
  const success = await gameStore.joinRoom(FIXED_ROOM_ID);
  
  if (!success) {
    alert('加入房间失败，请检查网络连接');
    joining.value = false;
  } else {
    joining.value = false;
    console.log('成功加入房间，等待房主开始游戏');
  }
}

// 自动加入房间
onMounted(() => {
  // 延迟一下，确保初始化完成
  setTimeout(() => {
    if (!gameStore.isHost) {
      joinRoom();
    }
  }, 500);
});
</script>

<template>
  <div class="game-container vh-100 d-flex flex-column">
    <!-- 大厅界面 -->
    <div class="lobby-content">
      <div class="lobby-card">
        <h2 class="lobby-title">等待房主开始游戏</h2>
        
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
        
        <div v-if="joining" class="joining-info">
          <p>正在加入房间...</p>
        </div>
        
        <div v-else class="joined-info">
          <p>已加入房间，等待房主开始游戏...</p>
          <p>当前玩家：{{ gameStore.players.length }} 人</p>
          
          <!-- 玩家列表 -->
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

.lobby-card {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2vh;
  padding: 2.5vh 3vw;
  color: white;
}

.lobby-title {
  margin: 0 0 2vh 0;
  font-size: 2.5vmin;
  text-align: center;
}

/* 输入框样式 */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-bottom: 2vh;
}

.input-label {
  font-size: 2vmin;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* 加入信息 */
.joining-info,
.joined-info {
  text-align: center;
  padding: 2vh;
}

.joining-info p,
.joined-info p {
  margin: 1vh 0;
  font-size: 2vmin;
  color: rgba(255, 255, 255, 0.8);
}

/* 玩家列表 */
.players-list {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-top: 2vh;
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

/* 桌面端优化 */
@media (min-width: 1024px) {
  .lobby-content {
    flex-direction: row;
  }
  
  .lobby-card {
    max-width: 400px;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .lobby-card {
    max-width: 90vw;
    padding: 2vh 3vw;
  }
  
  .lobby-title {
    font-size: 4vmin;
  }
  
  .btn-join {
    font-size: 2.5vmin;
  }
}
</style>