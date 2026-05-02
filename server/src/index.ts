import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Room } from './gameRoom';

type Bindings = {
  GAME_ROOM: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 配置
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'https://kochab0519.github.io',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// 单房间模式，使用固定 ID
const ROOM_ID = 'default';

// WebSocket 升级
app.get('/ws', async (c) => {
  const stub = c.env.GAME_ROOM.getByName(ROOM_ID);
  return stub.fetch(c.req.raw);
});

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', room: ROOM_ID }));

// 重置房间（清除所有玩家）
app.post('/reset', async (c) => {
  const stub = c.env.GAME_ROOM.getByName(ROOM_ID);
  const response = await stub.fetch(new Request('http://internal/reset', { method: 'POST' }));
  return c.json({ status: 'reset', message: '房间已重置' });
});

export { Room };
export default app;
