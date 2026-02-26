<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { p2pManager } from '../utils/p2pManager';

const gameStore = useGameStore();
const copied = ref(false);
const isInitializing = ref(true);
const isPortrait = ref(false);

const roomId = computed(() => {
  const id = p2pManager.getMyId();
  return id || '生成中...';
});

// 检测屏幕方向
function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth;
}

onMounted(() => {
  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  
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
  window.removeEventListener('resize', checkOrientation);
  window.removeEventListener('orientationchange', checkOrientation);
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
  <div class="container py-5 vh-100 game-container">
    <!-- 横屏提示 -->
    <div v-if="isPortrait" class="rotate-prompt">
      <div class="rotate-icon">📱</div>
      <h3>请旋转设备</h3>
      <p>为了更好的游戏体验，请横屏使用</p>
    </div>

    <div class="row justify-content-center" :class="{ 'blur-content': isPortrait }">
      <div class="col-md-8">
        <div class="card bg-secondary text-white mb-4">
          <div class="card-header">
            <h2 class="mb-0">游戏设置</h2>
          </div>
          <div class="card-body">
            <!-- 房间信息 -->
            <div class="mb-4">
              <h5>房间号</h5>
              <div class="input-group">
                <input
                  type="text"
                  class="form-control"
                  :value="roomId"
                  readonly
                  style="font-family: monospace; font-size: 0.9rem;"
                />
                <button class="btn btn-primary" @click="copyRoomId">
                  {{ copied ? '已复制!' : '复制' }}
                </button>
              </div>
              <small class="text-muted mt-2 d-block">
                ⚠️ 请复制完整的房间号分享给朋友
              </small>
              <small class="text-muted d-block">
                房间号格式：完整的 PeerJS ID（约36个字符）
              </small>
            </div>

            <!-- 牌副数配置 -->
            <div class="mb-4">
              <h5>扑克牌副数</h5>
              <div class="input-group mb-2">
                <button
                  class="btn btn-outline-light"
                  @click="gameStore.config.deckCount = Math.max(1, gameStore.config.deckCount - 1)"
                  :disabled="gameStore.config.deckCount <= 1"
                >
                  -
                </button>
                <input
                  type="number"
                  class="form-control text-center"
                  v-model.number="gameStore.config.deckCount"
                  min="1"
                  max="10"
                  readonly
                />
                <button
                  class="btn btn-outline-light"
                  @click="gameStore.config.deckCount = Math.min(10, gameStore.config.deckCount + 1)"
                  :disabled="gameStore.config.deckCount >= 10"
                >
                  +
                </button>
              </div>
              <small class="text-muted">
                牌副数越多，炸弹和大牌出现概率越高，适合多人局
              </small>
            </div>

            <!-- 玩家列表 -->
            <div class="mb-4">
              <h5>玩家列表 ({{ gameStore.players.length }}/10)</h5>
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
            </div>

            <!-- 开始按钮 -->
            <button
              class="btn btn-success w-100 py-3 fs-5"
              @click="startGame"
              :disabled="gameStore.players.length < 2"
            >
              开始游戏
            </button>
            <p v-if="gameStore.players.length < 2" class="text-center text-muted mt-2">
              等待更多玩家加入...
            </p>
          </div>
        </div>

        <!-- 游戏规则说明 -->
        <div class="card bg-dark text-white">
          <div class="card-header">
            <h5 class="mb-0">游戏规则</h5>
          </div>
          <div class="card-body">
            <h6>牌型（从小到大）</h6>
            <ul class="mb-3">
              <li><strong>单牌/对子</strong> - 1张或2张同点牌</li>
              <li><strong>顺子（链链）</strong> - ≥3张连续单牌</li>
              <li><strong>姐妹对</strong> - ≥3组连续对子</li>
              <li><strong>炸弹</strong> - 3张同点</li>
              <li><strong>轰雷</strong> - 4张同点</li>
              <li><strong>多张同点</strong> - ≥5张同点</li>
            </ul>
            <h6>起子特权</h6>
            <ul class="mb-3">
              <li><strong>对4</strong> 压制 <strong>炸弹（3张）</strong></li>
              <li><strong>三张4</strong> 压制 <strong>轰雷（4张）</strong></li>
              <li><strong>N张4</strong> 压制 <strong>N+1张</strong> 其他同点牌</li>
            </ul>
            <h6>大小顺序</h6>
            <p class="mb-0">2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3</p>
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