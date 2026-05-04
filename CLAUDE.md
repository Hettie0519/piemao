# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

踹牌（ChuaiPoker）是一款基于 Vue 3 + TypeScript 的多人联机扑克游戏，使用 **Hono + Cloudflare Workers + Durable Objects** 实现服务器协调架构。单房间模式，打开网页即可自动加入游戏。

**部署地址**：
- 前端：`https://kochab0519.github.io/ChuaiPoker/`（GitHub Pages）
- 后端：`wss://chuaipoker.kochab.ccwu.cc/ws`（Cloudflare Workers）

## 常用命令

### 前端
```bash
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # 生产构建（TypeScript 检查 + Vite 构建）
npm run preview  # 预览生产构建
```

### 后端
```bash
cd server
npm install      # 安装后端依赖
npm run dev      # 本地开发（wrangler dev）
npm run deploy   # 部署到 Cloudflare Workers
npm run tail     # 查看实时日志
```

### Android
```bash
npm run build && npx cap sync android  # 同步到 Capacitor Android 项目
npx cap open android                    # 打开 Android Studio
```

## 架构

### 前后端分离

```
前端 (Vue 3)                    后端 (Cloudflare Workers)
┌─────────────────┐            ┌─────────────────────────────┐
│  GitHub Pages   │            │  chuaipoker.kochab.ccwu.cc  │
│  (静态文件)      │──WebSocket──►│  Hono + Durable Objects    │
│                 │            │  - 单房间，无房间号          │
└─────────────────┘            │  - 游戏逻辑、状态持久化      │
                               └─────────────────────────────┘
```

### 后端核心：Durable Objects

`server/src/gameRoom.ts` - `Room` 类是游戏核心：
- 管理所有 WebSocket 连接
- 维护游戏状态（玩家、手牌、回合）
- 处理所有游戏消息（出牌、过牌、RPS 等）
- 支持断线重连（15秒超时）

### 前端状态管理

`src/stores/gameStore.ts` - Pinia store：
- 维护本地状态（玩家列表、手牌、游戏阶段）
- 通过 `wsManager.ts` 与服务器通信
- 接收 `STATE_SYNC` 消息更新状态

### 确定性发牌

前后端使用相同算法生成手牌（`dealer.ts`）：
- 服务器生成种子，通过 `GAME_START` 广播
- 所有客户端用相同参数调用 `dealGame(seed, deckCount, playerCount)`
- 服务器维护 `playerHands: Map<string, Card[]>` 作为权威手牌来源

### 消息类型

定义在 `src/types/game.ts` 和 `server/src/types.ts`：
- `JOIN_ROOM` / `PLAYER_JOIN` / `PLAYER_LEAVE` - 玩家管理
- `GAME_START` / `GAME_END` / `NEXT_ROUND` - 游戏控制
- `PLAY_HAND` / `PASS` - 出牌操作
- `STATE_SYNC` - 状态同步（包含 myHand）
- `WAITING_FOR_RECONNECT` / `PLAYER_RECONNECTED` - 断线重连

### 牌型验证

`cardUtils.ts` 提供：
- `validateHand()` - 验证牌型有效性
- `canBeatHand()` - 比较牌型大小
- 特殊规则："起子"——N张4可以管住N+1张其他点数的牌

### 组件结构

- `GameConfig.vue` - 房主大厅（设置牌副数、开始游戏）
- `GameLobby.vue` - 非房主玩家等待界面
- `GameBoard.vue` - 游戏主界面（手牌、其他玩家、回合指示）
- `GameResult.vue` - 游戏结束排名
- `RockPaperScissors.vue` - 多人持有红桃3时的石头剪子布裁决

## 游戏规则摘要

- 牌点大小：2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3
- 红桃3持有者先出牌；多人持有时通过石头剪子布决定
- 有效牌型：单牌、对子、顺子（≥3张）、姐妹对（≥3组）、炸弹（3张）、轰雷（4张）、多张（≥5张）
- "起子"规则：N张4可以管住N+1张其他点数的牌
