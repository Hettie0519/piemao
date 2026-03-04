# iFlow CLI 工作目录

## 目录概述

这是一个 iFlow CLI 的工作目录，包含多个项目，主要是一个 P2P 联机扑克游戏项目（piemao）和一些示例代码。

## 项目结构

```
C:\Develop\IFlow\
├── bin/                    # 编译输出目录
│   └── Fibonacci.class
├── docs/                   # 文档目录
│   └── AGENTS.md          # 本文档
├── piemao/                 # 主要项目：P2P 联机扑克游戏
│   ├── src/              # 源代码目录
│   │   ├── components/   # Vue 组件
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── types/        # TypeScript 类型定义
│   │   └── utils/        # 工具函数
│   ├── dist/             # 构建输出目录
│   ├── public/           # 静态资源
│   ├── android/          # Android 原生项目（Capacitor）
│   ├── package.json      # 项目配置
│   ├── vite.config.ts    # Vite 配置
│   └── README.md         # 项目说明
└── src/                   # 示例代码目录
    └── Fibonacci.java    # Java 斐波那契数列示例
```

## 主要项目：piemao（踹牌）

### 项目概述
一款基于 WebRTC 技术的纯前端扑克游戏，无需后端服务器，玩家通过分享房间号即可建立点对点（P2P）连接。支持 Web 和 Android 平台。

### 技术栈
- **前端框架**: Vue 3 + TypeScript + Vite
- **UI 框架**: Bootstrap 5
- **状态管理**: Pinia
- **P2P 通信**: PeerJS (WebRTC)
- **跨平台**: Capacitor
- **部署**: GitHub Pages + Android APK

### 核心特性
- 零服务器成本，纯前端实现
- 点对点直连，无需登录注册
- 自定义牌副数（1-10副）
- 确定性发牌算法，确保公平性
- 移动端适配，响应式设计
- 支持构建原生 Android 应用

### 游戏规则

#### 牌型（从小到大）
1. **单牌/对子** - 1张或2张同点牌
2. **顺子（链链）** - ≥3张连续单牌
3. **姐妹对** - ≥3组连续对子（只能被更大的姐妹对、雷或多张管住）
4. **炸弹** - 3张同点
5. **轰雷** - 4张同点
6. **多张同点** - ≥5张同点

#### 起子特权（4的特殊权限）
- **对4** 压制 **炸弹（3张）**
- **三张4** 压制 **轰雷（4张）**
- **N张4** 压制 **N+1张** 其他同点牌

#### 大小顺序
2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3

### 构建和运行

#### 开发环境
```bash
cd piemao
npm install
npm run dev
```

#### 生产构建
```bash
cd piemao
npm run build
```

#### 预览生产版本
```bash
cd piemao
npm run preview
```

#### 部署到 GitHub Pages
推送到 `main` 分支后，GitHub Actions 会自动部署到 GitHub Pages。

#### 构建 Android App
```bash
# 1. 构建生产版本
npm run build

# 2. 同步到 Android 项目
npx cap sync android

# 3. 打开 Android Studio 或使用命令行构建
npx cap open android

# 命令行构建 Debug 版本
cd android
./gradlew assembleDebug

# 命令行构建 Release 版本
cd android
./gradlew assembleRelease
```

### 关键文件

#### 源代码结构
- `src/App.vue` - 应用根组件，包含游戏状态管理和路由逻辑
- `src/main.ts` - 应用入口，配置 Vue、Pinia 和 Bootstrap
- `src/components/GameBoard.vue` - 游戏主界面
- `src/components/GameLobby.vue` - 游戏大厅
- `src/components/GameConfig.vue` - 游戏配置
- `src/components/RockPaperScissors.vue` - 石头剪刀布选先手
- `src/components/GameResult.vue` - 游戏结果展示
- `src/stores/gameStore.ts` - 游戏状态管理（Pinia Store）
- `src/utils/cardUtils.ts` - 牌型判断和比牌逻辑
- `src/utils/p2pManager.ts` - P2P 连接管理（PeerJS 封装）
- `src/utils/dealer.ts` - 发牌逻辑（确定性发牌算法）
- `src/types/game.ts` - 游戏类型定义

#### 配置文件
- `package.json` - 项目依赖和脚本
- `vite.config.ts` - Vite 构建配置（base 路径设置为 `/piemao/`）
- `capacitor.config.ts` - Capacitor 配置（appId: `com.piemao.game`）
- `tsconfig.json` - TypeScript 配置
- `.github/workflows/deploy.yml` - GitHub Pages 自动部署配置
- `.github/workflows/android.yml` - Android APK 自动构建配置

#### Android 项目
- `android/app/build.gradle` - Android 应用构建配置
- `android/app/src/main/AndroidManifest.xml` - Android 清单文件
- `android/app/src/main/java/com/piemao/game/MainActivity.java` - Android 主 Activity

### 开发约定

#### 代码风格
- 使用 TypeScript 进行类型检查
- 遵循 Vue 3 Composition API 最佳实践
- 使用 Pinia 进行状态管理
- 组件和工具函数使用清晰的命名
- 响应式设计，使用相对单位（vmin、vh、vw）适配不同屏幕

#### Git 工作流
- 推送到 `main` 分支会自动触发 GitHub Pages 部署
- 推送到 `main` 分支或打标签会自动触发 Android APK 构建
- 使用语义化的提交信息

#### 环境要求
- Node.js 版本: 20+
- 推荐使用现代浏览器（Chrome、Firefox、Safari、Edge）
- WebRTC 需要 HTTPS 环境（GitHub Pages 默认支持）
- Android 构建需要 Java JDK 21 和 Android SDK

#### 网络配置
- 使用固定的房间号：`hettie2026`
- PeerJS 服务器：`0.peerjs.com:443`
- STUN 服务器：Google 公共 STUN 服务器
- TURN 服务器：多个免费 TURN 服务器（numb.viagenie.ca、openrelay.metered.ca）

### 游戏流程

1. **初始化**：应用启动时自动初始化 P2P 连接
2. **房间创建/加入**：
   - 如果玩家 ID 等于固定房间号 `hettie2026`，则成为房主并创建房间
   - 否则，自动检测房间已存在并重新初始化以加入现有房间
3. **游戏配置**：房主设置牌副数（1-10）
4. **发牌**：使用确定性发牌算法，所有客户端生成相同的手牌
5. **先手决定**：
   - 查找红桃3持有者
   - 如果只有一个玩家持有红桃3，该玩家先手
   - 如果多个玩家持有红桃3，通过石头剪子布决定先手
6. **游戏进行**：逆时针轮转，玩家可以出牌或过牌
7. **游戏结束**：当只有一名玩家未出完牌时，游戏结束并显示排名

### P2P 通信机制

- **房主模式**：使用固定 ID `hettie2026` 创建 Peer，等待其他玩家连接
- **玩家模式**：使用随机 ID 创建 Peer，连接到房主
- **消息传递**：所有游戏操作通过 P2P 消息传递，房主负责广播和状态同步
- **消息类型**：定义在 `src/types/game.ts` 中的 `MessageType` 枚举

### 示例代码：Fibonacci.java

位于 `C:\Develop\IFlow\src/` 目录的 Java 示例程序，用于演示基本的递归算法。

**功能**：
- 使用递归方法计算斐波那契数列
- 输出前10项：0 1 1 2 3 5 8 13 21 34

**编译和运行**：
```bash
cd C:\Develop\IFlow
javac -d bin src/Fibonacci.java
java -cp bin Fibonacci
```

**注意**：
- 如果遇到中文字符编码问题，使用 `-encoding UTF-8` 参数：
  ```bash
  javac -encoding UTF-8 YourFile.java
  ```

## 使用说明

### 开发 piemao 项目
1. 进入项目目录：`cd piemao`
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 访问 `http://localhost:3000`

### 测试 Java 示例
1. 进入根目录：`cd C:\Develop\IFlow`
2. 编译 Java 文件：`javac -d bin src/Fibonacci.java`
3. 运行程序：`java -cp bin Fibonacci`

### 构建 Android 应用
1. 确保 Java JDK 21 和 Android SDK 已安装
2. 构建生产版本：`npm run build`
3. 同步到 Android：`npx cap sync android`
4. 构建 APK：`cd android && ./gradlew assembleRelease`
5. APK 输出位置：`android/app/build/outputs/apk/release/`

## 开发环境信息

- **操作系统**: Windows 10 (版本 10.0.26200)
- **Git**: 版本 2.52.0.windows.1
- **Node.js**: 版本 20+（通过 package.json 推断）
- **Java**: 已安装（可执行 javac 和 java 命令）
- **Curl**: 版本 8.16.0
- **Gradle**: 用于 Android 构建（版本 8.13.0）

## 注意事项

1. **WebRTC 限制**: P2P 通信需要在 HTTPS 环境下运行，本地开发可以使用 HTTP
2. **网络稳定性**: 游戏期间请保持网络连接稳定
3. **房主责任**: 房主断线后，需要重新创建房间
4. **浏览器兼容性**: 建议使用支持 WebRTC 的现代浏览器
5. **编码问题**: Java 文件如包含中文字符，需要使用 UTF-8 编译
6. **Android 构建**: Windows 环境下使用 `gradlew.bat` 而不是 `gradlew`
7. **房间号冲突**: 使用固定房间号可能导致冲突，建议在生产环境中使用动态房间号

## 项目状态

piemao 项目目前处于活跃开发状态，最近更新包括：
- 添加了快捷聊天功能
- 修复了聊天气泡定位问题
- 优化了玩家布局（逆时针分布）
- 修正了牌型比较规则（姐妹对的管牌规则）
- 添加了 Capacitor 支持，可构建原生 Android 应用
- 配置了 GitHub Actions 自动部署和构建

## 自动化部署

### GitHub Pages 部署
- 触发条件：推送到 `main` 分支
- 构建流程：安装依赖 → 构建 → 上传 artifact → 部署
- 部署地址：`https://<username>.github.io/piemao/`

### Android APK 构建
- 触发条件：推送到 `main` 分支、打标签（`v*`）或手动触发
- 构建流程：安装依赖 → 构建 Web → 同步 Capacitor → 构建 Android APK
- 输出产物：Debug APK（保留30天）和 Release APK（保留90天）
- 发布：打标签时会自动创建 GitHub Release 并上传 APK

## 故障排除

### P2P 连接问题
1. 检查网络连接
2. 确保使用 HTTPS（生产环境）
3. 检查 TURN 服务器是否可用
4. 尝试刷新页面重新初始化

### Android 构建问题
1. 确保已安装 Java JDK 21
2. 确保已安装 Android SDK
3. 在 Android Studio 中打开项目进行构建
4. 检查 `android/variables.gradle` 配置

### 依赖安装问题
```bash
# 清除缓存并重新安装
rm -rf node_modules package-lock.json
npm install
```

## 未来改进方向

1. **动态房间号**：支持多个房间同时运行
2. **游戏录像**：记录和回放游戏过程
3. **AI 玩家**：添加单人练习模式
4. **更多牌型**：扩展游戏规则支持更多牌型
5. **iOS 支持**：使用 Capacitor 构建 iOS 应用
6. **性能优化**：优化大量牌的渲染和交互