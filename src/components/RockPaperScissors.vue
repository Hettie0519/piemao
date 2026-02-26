<template>
  <div class="rps-modal">
    <div class="rps-content">
      <h2>石头剪子布决定先手</h2>
      <p class="rps-info">
        多位玩家持有红桃3，持有红桃3的玩家请选择石头、剪刀或布来决定谁先出牌
      </p>

      <div class="rps-players">
        <div
          v-for="(playerIndex, index) in rpsPlayers"
          :key="players[playerIndex]?.id || index"
          class="rps-player"
          :class="{
            'is-me': players[playerIndex] && players[playerIndex].id === gameStore.myPlayerId,
            'has-chosen': players[playerIndex] && rpsChoices.has(players[playerIndex].id)
          }"
        >
          <span class="player-name">{{ players[playerIndex]?.name || '未知玩家' }}</span>
          <span v-if="players[playerIndex] && rpsChoices.has(players[playerIndex].id)" class="chosen-mark">✓ 已选择</span>
          <span v-else class="waiting-mark">⏳ 等待中</span>
        </div>
      </div>
      
      <div class="rps-buttons" v-if="shouldParticipateRPS && !gameStore.myRPSChoice">
        <button class="rps-btn rock" @click="choose('rock')">
          <span class="rps-icon">✊</span>
          <span>石头</span>
        </button>
        <button class="rps-btn scissors" @click="choose('scissors')">
          <span class="rps-icon">✌️</span>
          <span>剪刀</span>
        </button>
        <button class="rps-btn paper" @click="choose('paper')">
          <span class="rps-icon">✋</span>
          <span>布</span>
        </button>
      </div>
      
      <div class="rps-waiting" v-else-if="shouldParticipateRPS">
        <p>你已选择: {{ getChoiceName(gameStore.myRPSChoice || RPSC.ROCK) }}</p>
        <p>等待其他玩家选择...</p>
      </div>
      
      <div class="rps-waiting" v-else>
        <p>你没有持有红桃3，正在等待石头剪刀布结果...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import type { RockPaperScissorsChoice } from '../types/game';
import { RockPaperScissorsChoice as RPSC } from '../types/game';

const gameStore = useGameStore();

const rpsPlayers = computed(() => gameStore.rpsPlayers);
const rpsChoices = computed(() => gameStore.rpsChoices);
const players = computed(() => gameStore.players);

// 判断当前玩家是否需要参与石头剪刀布
const shouldParticipateRPS = computed(() => {
  const myIndex = players.value.findIndex(p => p.id === gameStore.myPlayerId);
  return rpsPlayers.value.includes(myIndex);
});

onMounted(() => {
  console.log('RockPaperScissors 组件已挂载');
  console.log('rpsPlayers:', rpsPlayers.value);
  console.log('rpsChoices:', rpsChoices.value);
  console.log('players:', players.value);
});

function choose(choice: 'rock' | 'scissors' | 'paper') {
  let rpsChoice: RockPaperScissorsChoice;
  switch (choice) {
    case 'rock':
      rpsChoice = RPSC.ROCK;
      break;
    case 'scissors':
      rpsChoice = RPSC.SCISSORS;
      break;
    case 'paper':
      rpsChoice = RPSC.PAPER;
      break;
  }
  console.log('选择:', choice, '枚举值:', rpsChoice);
  gameStore.submitRPSChoice(rpsChoice);
}

function getChoiceName(choice: RockPaperScissorsChoice): string {
  switch (choice) {
    case RPSC.ROCK:
      return '石头';
    case RPSC.PAPER:
      return '布';
    case RPSC.SCISSORS:
      return '剪刀';
  }
}
</script>

<style scoped>
.rps-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(26, 71, 42, 0.95) 0%, rgba(45, 90, 61, 0.95) 100%);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.rps-content {
  background: rgba(0, 0, 0, 0.5);
  padding: 3vh 3vw;
  border-radius: 2vh;
  max-width: 80vw;
  width: 400px;
  text-align: center;
  border: 2px solid rgba(168, 230, 207, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.rps-content h2 {
  color: #a8e6cf;
  margin: 0 0 2vh 0;
  font-size: 2.5vmin;
  font-weight: 500;
  text-shadow: 0 0 10px rgba(168, 230, 207, 0.5);
}

.rps-info {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.5vmin;
  margin-bottom: 3vh;
}

.rps-players {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-bottom: 3vh;
  background: rgba(255, 255, 255, 0.08);
  padding: 1.5vh;
  border-radius: 1vh;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rps-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1vh 1.5vw;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 1vh;
  color: #fff;
}

.rps-player.is-me {
  background: rgba(168, 230, 207, 0.25);
  border: 1px solid rgba(168, 230, 207, 0.5);
}

.rps-player.has-chosen {
  opacity: 0.6;
}

.chosen-mark {
  color: #a8e6cf;
  font-weight: bold;
  font-size: 1.5vmin;
}

.waiting-mark {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.5vmin;
}

.rps-buttons {
  display: flex;
  gap: 1.5vw;
  justify-content: center;
}

.rps-btn {
  flex: 1;
  padding: 2.5vh 1.5vw;
  border: 2px solid rgba(168, 230, 207, 0.4);
  border-radius: 1.5vh;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1vh;
  transition: all 0.3s ease;
  font-size: 1.5vmin;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
}

.rps-btn:hover {
  background: rgba(168, 230, 207, 0.15);
  border-color: #a8e6cf;
  box-shadow: 0 0 20px rgba(168, 230, 207, 0.4);
  transform: translateY(-0.3vh);
}

.rps-icon {
  font-size: 3.5vmin;
}

.rps-waiting {
  padding: 2.5vh;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1vh;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rps-waiting p {
  margin: 0.5vh 0;
  font-size: 1.5vmin;
}

.rps-waiting p:first-child {
  color: #a8e6cf;
  font-weight: bold;
}

@media (max-width: 767px) {
  .rps-content {
    padding: 2vh 2vw;
    width: 90vw;
  }
  
  .rps-content h2 {
    font-size: 3vmin;
  }
  
  .rps-info {
    font-size: 2vmin;
  }
  
  .rps-btn {
    padding: 1.5vh 1vw;
    font-size: 2vmin;
  }
  
  .rps-icon {
    font-size: 4vmin;
  }
}
</style>