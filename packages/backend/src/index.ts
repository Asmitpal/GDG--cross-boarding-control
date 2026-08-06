import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { generalLimiter, webhookLimiter } from './middleware/rateLimiter.js';

import hiresRouter      from './routes/hires.js';
import escalationsRouter from './routes/escalations.js';
import rulesRouter      from './routes/rules.js';
import webhooksRouter   from './routes/webhooks.js';
import { createApprovalsRouter } from './routes/approvals.js';
import { createTasksRouter }    from './routes/tasks.js';

import { startSlaMonitorWorker }  from './workers/SlaMonitorWorker.js';
import { startIdpProvisionWorker } from './workers/IdpProvisionWorker.js';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app        = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new IOServer(httpServer, {
  cors: {
    origin:  config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[WS] Client disconnected: ${socket.id}`));
});

// ─── Express Middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin, methods: ['GET','POST','PATCH','PUT','DELETE'] }));
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

// ─── Health Check (no auth) ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.nodeEnv });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const v1 = express.Router();
v1.use(authMiddleware);

v1.use('/hires',              hiresRouter);
v1.use('/hires/:id/approval', createApprovalsRouter(io));
v1.use('/tasks',              createTasksRouter(io));
v1.use('/escalations',        escalationsRouter);
v1.use('/rules',              rulesRouter);

// Webhooks — separate rate limit, auth handled by signature in production
v1.use('/webhooks', webhookLimiter, webhooksRouter);

app.use('/api/v1', v1);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Workers ─────────────────────────────────────────────────────────────────
const { worker: slaWorker, slackWorker } = startSlaMonitorWorker(io);
const idpWorker = startIdpProvisionWorker();

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(config.port, () => {
  console.log(`\n🚀  Cross-Boarding API running on http://localhost:${config.port}`);
  console.log(`   ENV: ${config.nodeEnv}`);
  console.log(`   WebSocket ready`);
  console.log(`   SLA monitor worker active (15-min interval)\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  console.log('\n⚠️  Shutting down gracefully…');
  await Promise.all([slaWorker.close(), slackWorker.close(), idpWorker.close()]);
  httpServer.close(() => {
    console.log('✅  Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
