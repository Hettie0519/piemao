<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';

const gameStore = useGameStore();
const hostIdInput = ref('');
const joining = ref(false);
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
  <div class="container py-5 vh-100 d-flex flex-column justify-content-center game-container">
    <!-- 横屏提示 -->
    <div v-if="isPortrait" class="rotate-prompt">
      <div class="rotate-icon">📱</div>
      <h3>请旋转设备</h3>
      <p>为了更好的游戏体验，请横屏使用</p>
    </div>

    <div class="row justify-content-center" :class="{ 'blur-content': isPortrait }">
      <div class="col-12 col-md-8 col-lg-6">
        <div class="card bg-secondary text-white">
          <div class="card-header">
            <h2 class="mb-0">加入房间</h2>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="hostId" class="form-label">房间号</label>
              <input
                id="hostId"
                v-model="hostIdInput"
                type="text"
                class="form-control"
                placeholder="请粘贴完整的房间号（约36个字符）"
                style="font-family: monospace;"
                @keyup.enter="joinRoom"
              />
              <small class="text-muted">
                ⚠️ 必须粘贴房主分享的完整房间号，不能有任何遗漏
              </small>
            </div>
            <button
              v-if="gameStore.players.length === 0"
              class="btn btn-primary w-100 py-3"
              @click="joinRoom"
              :disabled="joining"
            >
              {{ joining ? '加入中...' : '加入房间' }}
            </button>
          </div>
        </div>

        <!-- 等待房主开始 -->
        <div v-if="gameStore.players.length > 0" class="card bg-dark text-white mt-4">
          <div class="card-header">
            <h5 class="mb-0">玩家列表</h5>
          </div>
          <div class="card-body">
            <ul class="list-group list-group-flush">
              <li
                v-for="player in gameStore.players"
                :key="player.id"
                class="list-group-item list-group-item-action bg-dark text-white"
              >
                <span v-if="player.isHost" class="badge bg-primary me-2">房主</span>
                {{ player.name }}
                <span v-if="player.id === gameStore.myPlayerId" class="badge bg-success ms-2">你</span>
              </li>
            </ul>
            <p class="text-center text-muted mt-3">
              等待房主开始游戏...
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-group-item {
  border: 1px solid #444;
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

.game-container {
  overflow: hidden;
}
</style>