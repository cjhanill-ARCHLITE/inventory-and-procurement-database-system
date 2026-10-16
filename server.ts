import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeSchema } from './src/server/schema.js';
import { seedDatabase } from './src/server/seed.js';

import authRouter from './src/server/routes/auth.js';
import dashboardRouter from './src/server/routes/dashboard.js';
import itemsRouter from './src/server/routes/items.js';
import categoriesRouter from './src/server/routes/categories.js';
import suppliersRouter from './src/server/routes/suppliers.js';
import prRouter from './src/server/routes/purchase-requests.js';
import poRouter from './src/server/routes/purchase-orders.js';
import receivingRouter from './src/server/routes/receiving.js';
import stockRouter from './src/server/routes/stock-transactions.js';
import reportsRouter from './src/server/routes/reports.js';
import usersRouter from './src/server/routes/users.js';
import auditRouter from './src/server/routes/audit.js';
import notificationsRouter from './src/server/routes/notifications.js';
import settingsRouter from './src/server/routes/settings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// REST API routes under /api/v1
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/items', itemsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/suppliers', suppliersRouter);
app.use('/api/v1/purchase-requests', prRouter);
app.use('/api/v1/purchase-orders', poRouter);
app.use('/api/v1/receiving', receivingRouter);
app.use('/api/v1/stock-transactions', stockRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/settings', settingsRouter);

// System health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    system: 'Inventory Procurement Database System',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    console.log('[Server] Initializing PostgreSQL Database Schema...');
    await initializeSchema();
    console.log('[Server] Checking and running Seed Dataset...');
    await seedDatabase();

    // In development, mount Vite dev server middlewares
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Server] Vite middleware attached for SPA development');
    } else {
      // In production, serve built static files from dist/
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] IPDS Server running at http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[Server Error during startup]', err);
    process.exit(1);
  }
}

startServer();
