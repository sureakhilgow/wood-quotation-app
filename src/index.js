/**
 * UKD Industries — Quotation Backend Server
 *
 * Express application entry point.
 *   - Mounts all /api/* routers
 *   - Serves the static frontend SPA (../../frontend)
 *   - Initialises the SQLite database (schema + seed) on boot
 *
 * Start with:  npm run dev   (or)   npm start
 */
const path = require('path');
const express = require('express');
const cors = require('cors');

const { getDb, closeDb } = require('./db/connection');

// Route modules
const projectsRouter = require('./routes/projects');
const unitsRouter = require('./routes/units');
const panelsRouter = require('./routes/panels');
const hardwareRouter = require('./routes/hardware');
const accessoriesRouter = require('./routes/accessories');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// Global middleware
// ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Tiny request logger (dev-friendly, no dependency)
app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
    }
    next();
});

// ──────────────────────────────────────────────
// API routes
// ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'ukd-backend', time: new Date().toISOString() });
});

app.use('/api/projects', projectsRouter);
app.use('/api/units', unitsRouter);
app.use('/api/panels', panelsRouter);
app.use('/api/hardware', hardwareRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/settings', settingsRouter);

// Unknown API route → JSON 404 (so the SPA fallback never swallows API typos)
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: `No API route for ${req.method} ${req.originalUrl}` });
});

// ──────────────────────────────────────────────
// Static frontend + SPA fallback
// ──────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Any non-API GET falls back to the SPA shell (hash routing means one entry file)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => {
        if (err) next(err);
    });
});

// ──────────────────────────────────────────────
// Error handler
// ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
function start() {
    // Initialise DB eagerly so schema/seed run (and errors surface) before we listen.
    try {
        getDb();
        console.log('✔ Database initialised');
    } catch (err) {
        console.error('✖ Failed to initialise database:', err.message);
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log('');
        console.log('  UKD Industries — Quotation Manager');
        console.log(`  ▸ App:  http://localhost:${PORT}`);
        console.log(`  ▸ API:  http://localhost:${PORT}/api/health`);
        console.log('');
    });

    const shutdown = (signal) => {
        console.log(`\n${signal} received — shutting down…`);
        server.close(() => {
            closeDb();
            process.exit(0);
        });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only start if run directly (allows importing `app` in tests)
if (require.main === module) {
    start();
}

module.exports = { app, start };
