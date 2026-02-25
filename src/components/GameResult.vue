<script setup lang="ts">
import { useGameStore } from '../stores/gameStore';

const gameStore = useGameStore();

function nextRound() {
  gameStore.nextRound();
}

function reloadPage() {
  window.location.reload();
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card bg-success text-white text-center py-5">
          <div class="card-body">
            <h1 class="display-4 mb-4">🎉 游戏结束 🎉</h1>
            <p class="lead mb-4">
              恭喜 {{ gameStore.players.find(p => p.handCount === 0)?.name }} 获胜！
            </p>
            
            <div class="mb-4">
              <h5>最终排名</h5>
              <ul class="list-group list-group-flush text-start mt-3">
                <li
                  v-for="(player, index) in [...gameStore.players].sort((a, b) => a.handCount - b.handCount)"
                  :key="player.id"
                  class="list-group-item list-group-item-action bg-dark text-white d-flex justify-content-between align-items-center"
                >
                  <div>
                    <span class="badge bg-primary me-2">#{{ index + 1 }}</span>
                    <span v-if="player.isHost" class="badge bg-warning text-dark me-2">房主</span>
                    {{ player.name }}
                    <span v-if="player.id === gameStore.myPlayerId" class="badge bg-success ms-2">你</span>
                  </div>
                  <span class="badge bg-secondary">{{ player.handCount }} 张</span>
                </li>
              </ul>
            </div>

            <div class="d-flex gap-3 justify-content-center">
              <button
                v-if="gameStore.isHost"
                class="btn btn-primary btn-lg px-5"
                @click="nextRound"
              >
                下一局
              </button>
              <button
                class="btn btn-outline-light btn-lg px-5"
                @click="reloadPage"
              >
                返回大厅
              </button>
            </div>
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