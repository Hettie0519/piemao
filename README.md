# 踹牌 - 多人联机扑克游戏

一款基于 Hono + Cloudflare Workers + Durable Objects 的多人联机扑克游戏，服务器协调模式，连接稳定可靠。

## 🎮 游戏特色

- **稳定连接**：使用 WebSocket + Durable Objects，不受 NAT/防火墙影响
- **自动连接**：单房间模式，打开网页即可加入游戏，无需房间号
- **自定义牌副数**：房主可选择 1-10 副牌，适应不同人数和玩法
- **确定性发牌**：所有客户端使用相同的算法生成手牌，确保公平性
- **移动端适配**：响应式设计，支持手机、平板和桌面设备
- **Android App 支持**：可构建原生 Android 应用，提供更好的游戏体验

## 🃏 游戏规则

### 牌型（从小到大）

1. **单牌/对子** - 1张或2张同点牌
2. **顺子（链链）** - ≥3张连续单牌
3. **姐妹对** - ≥3组连续对子
4. **炸弹** - 3张同点
5. **轰雷** - 4张同点
6. **多张同点** - ≥5张同点

### 起子特权（4的特殊权限）

- **对4** 压制 **炸弹（3张）**
- **三张4** 压制 **轰雷（4张）**
- **N张4** 压制 **N+1张** 其他同点牌

### 大小顺序

2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3

## 🚀 快速开始

### 本地开发

```bash
# 进入项目目录
cd ChuaiPoker

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 🌐 部署到 GitHub Pages

本项目已配置 GitHub Actions 自动部署：

1. 将代码推送到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择 `gh-pages` 分支作为源
4. 推送到 `main` 分支后，自动触发部署

访问地址：`https://kochab0519.github.io/ChuaiPoker/`

## 📱 构建 Android App

### 前置要求

- Node.js 20+
- Java JDK 8 或更高版本
- Android SDK（可通过 Android Studio 安装）

### 构建步骤

```bash
# 1. 构建生产版本
npm run build

# 2. 同步到 Android 项目
npx cap sync android

# 3. 打开 Android Studio
npx cap open android
```

### 在 Android Studio 中

1. 选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)`
2. 构建完成后，APK 文件位于 `android/app/build/outputs/apk/` 目录
3. 将 APK 安装到 Android 设备或分享给朋友

### 使用命令行构建

```bash
# 进入 Android 目录
cd android

# 构建 Release 版本
./gradlew assembleRelease

# 或构建 Debug 版本
./gradlew assembleDebug
```

## 📦 技术栈

- **前端框架**: Vue 3 + TypeScript + Vite
- **UI 框架**: Bootstrap 5
- **状态管理**: Pinia
- **后端**: Hono + Cloudflare Workers + Durable Objects
- **通信**: WebSocket
- **跨平台**: Capacitor
- **部署**: GitHub Pages + Cloudflare Workers

## 🎯 如何游玩

1. **打开游戏**：所有玩家打开游戏网页，自动连接到游戏房间
2. **等待玩家**：等待其他玩家加入游戏
3. **设置游戏**：房主设置牌副数（1-10）
4. **开始游戏**：所有人准备好后，房主点击开始
5. **享受游戏**：红桃3持有者先手，逆时针轮转

## 📝 注意事项

- WebSocket 需要在 HTTPS 环境下运行（GitHub Pages 默认支持）
- 建议使用 Chrome、Firefox、Safari 或 Edge 等现代浏览器
- Android App 建议在 Android 7.0 及以上版本运行
- 游戏期间请保持网络连接稳定
- 断线重连后可继续游戏

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

享受游戏！🎉
