# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

踹牌是一款基于 Vue 3 + TypeScript 的 P2P 联机扑克游戏，使用 WebRTC（PeerJS）进行点对点通信，无需后端服务器。所有玩家连接到**固定房间号 `hettie2026`**，无需分享房间号，只需打开网页即可自动加入游戏。

## 常用命令

```bash
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # 生产构建（TypeScript 检查 + Vite 构建）
npm run preview  # 预览生产构建
npx cap sync android  # 同步到 Capacitor Android 项目
```

## 架构

### P2P 网络拓扑（星形网络）

游戏采用主机中心的 P2P 架构：
- **房主**（第一个连接成功的玩家）：使用固定房间号 `hettie2026` 创建 PeerJS 连接，作为中央协调者
- **玩家**：后续连接的玩家自动加入固定房间，向房主发送操作，接收状态更新

`P2PManager` 类（`src/utils/p2pManager.ts`）封装 PeerJS 连接，按 `MessageType` 枚举注册消息处理器。

### 状态管理（Pinia）

`gameStore`（`src/stores/gameStore.ts`）是唯一状态源：
- 玩家列表和连接状态
- 游戏阶段（`GameState` 枚举：LOBBY → DEALING → ROCK_PAPER_SCISSORS → PLAYING → ENDED）
- 手牌、当前回合、上一手牌
- 多人持有红桃3时的石头剪子布裁决

**关键点**：房主计算游戏状态变更并广播给所有玩家，非房主玩家通过 `STATE_SYNC` 消息接收状态更新。

### 确定性发牌

所有客户端使用相同种子生成相同手牌（`dealer.ts`）：
1. 房主生成种子，通过 `GAME_START` 广播
2. 所有客户端用相同参数调用 `dealGame(seed, deckCount, playerCount)`
3. 种子随机数确保所有客户端洗牌和发牌结果一致

### 牌型与验证

- 类型定义在 `src/types/game.ts`：`HandType` 枚举（SINGLE, PAIR, STRAIGHT, SISTER_PAIR, BOMB, THUNDER, MULTI）
- `cardUtils.ts` 提供 `validateHand()` 验证牌型，`canBeatHand()` 比较大小
- 特殊规则："起子"——N张4可以管住N+1张其他点数的牌

### 组件结构

组件根据 `gameState` 和玩家角色渲染：
- `GameConfig.vue`：房主大厅（设置牌副数、开始游戏）
- `GameLobby.vue`：非房主玩家等待界面
- `GameBoard.vue`：游戏主界面（手牌、其他玩家、回合指示、快捷发言）
- `GameResult.vue`：游戏结束排名
- `RockPaperScissors.vue`：多人持有红桃3时的石头剪子布裁决

### Android 构建

使用 Capacitor 封装 Web 应用。推送 tag 时通过 GitHub Actions 构建 APK（`.github/workflows/android.yml`）。Web 应用在 main 分支推送时自动部署到 GitHub Pages。

## 游戏规则摘要

- 牌点大小：2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3
- 红桃3持有者先出牌；多人持有时通过石头剪子布决定
- 有效牌型：单牌、对子、顺子（≥3张连续）、姐妹对（≥3组连续对子）、炸弹（3张同点）、轰雷（4张同点）、多张同点（≥5张）
- "起子"规则：N张4可以管住N+1张其他点数的牌
