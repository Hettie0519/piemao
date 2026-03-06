<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { PlayerStatus } from '../types/game';

const gameStore = useGameStore();

// 使用存储的排名（只包含参与游戏的玩家）
const displayPlayers = computed(() => {
  // 如果有存储的排名，就使用它
  if (gameStore.gameRankings && gameStore.gameRankings.length > 0) {
    return gameStore.gameRankings;
  }
  // 否则，从 players 中过滤出参与游戏的玩家
  return gameStore.players.filter(p => p.status === PlayerStatus.PLAYING);
});

function nextRound() {
  gameStore.nextRound();
}
</script>

<template>
  <div class="game-result-container">
    <div class="result-card">
      <h1 class="title">🎉 游戏结束 🎉</h1>
      <p class="winner-text">
        恭喜 {{ displayPlayers.find(p => p.handCount === 0)?.name }} 获胜！
      </p>
      
      <div class="ranking-section">
        <h5 class="ranking-title">最终排名</h5>
        <ul class="ranking-list">
          <li
            v-for="(player, index) in displayPlayers"
            :key="player.id"
            class="ranking-item"
          >
            <div class="player-info">
              <span class="rank-badge">#{{ index + 1 }}</span>
              <span v-if="gameStore.players.find(p => p.id === player.id)?.isHost" class="host-badge">房主</span>
              <span class="player-name">{{ player.name }}</span>
              <span v-if="player.id === gameStore.myPlayerId" class="me-badge">你</span>
            </div>
            <span class="hand-count">{{ player.handCount }} 张</span>
          </li>
        </ul>
      </div>

      <div class="button-group">
        <button
          v-if="gameStore.isHost"
          class="btn-primary-large"
          @click="nextRound"
        >
          下一局
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-result-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2vh 2vw;
  background: #1a3d2a;
  z-index: 9999;
}

.result-card {
  width: 100%;
  max-width: 80vw;
  background: #2a4d3a;
  border-radius: 2vh;
  padding: 3vh;
  text-align: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.title {
  font-size: 4vmin;
  font-weight: bold;
  margin-bottom: 2vh;
  color: #ffd700;
}

.winner-text {
  font-size: 2.5vmin;
  margin-bottom: 3vh;
  color: #fff;
}

.ranking-section {
  margin-bottom: 3vh;
}

.ranking-title {
  font-size: 2vmin;
  margin-bottom: 1.5vh;
  color: #ffd700;
}

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ranking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a3d2a;
  border: 1px solid #444;
  border-radius: 1vh;
  padding: 1.5vh 2vw;
  margin-bottom: 1vh;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  flex: 1;
  min-width: 0;
}

.rank-badge {
  background: #007bff;
  padding: 0.5vh 1vw;
  border-radius: 0.5vh;
  font-size: 1.6vmin;
  font-weight: bold;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 2.5vmin;
  line-height: 1;
}

.host-badge {
  background: #ffc107;
  color: #000;
  padding: 0.5vh 1vw;
  border-radius: 0.5vh;
  font-size: 1.4vmin;
  font-weight: bold;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 2.5vmin;
  line-height: 1;
}

.player-name {
  font-size: 2vmin;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  height: 2.5vmin;
  line-height: 1;
}

.me-badge {
  background: #28a745;
  padding: 0.5vh 1vw;
  border-radius: 0.5vh;
  font-size: 1.4vmin;
  font-weight: bold;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 2.5vmin;
  line-height: 1;
}

.hand-count {
  background: #6c757d;
  padding: 0.5vh 1.5vw;
  border-radius: 0.5vh;
  font-size: 1.6vmin;
  font-weight: bold;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 2.5vmin;
  line-height: 1;
}

.button-group {
  display: flex;
  gap: 2vw;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary-large {
  background: #007bff;
  color: #fff;
  border: none;
  padding: 1.5vh 3vw;
  border-radius: 1vh;
  font-size: 2vmin;
  font-weight: bold;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-primary-large:hover {
  background: #0056b3;
}
</style>