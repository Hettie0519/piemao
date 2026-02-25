<script setup lang="ts">
import { ref } from 'vue';
import { useGameStore } from '../stores/gameStore';

const gameStore = useGameStore();
const hostIdInput = ref('');
const joining = ref(false);

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
  <div class="container py-5 vh-100 d-flex flex-column justify-content-center">
    <div class="row justify-content-center">
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
</style>