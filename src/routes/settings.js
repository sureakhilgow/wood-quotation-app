/**
 * Settings GET/PUT.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

// ── GET /api/settings — Get all settings ──
router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();

    const settings = {};
    rows.forEach(r => {
        try {
            settings[r.key] = JSON.parse(r.value);
        } catch {
            settings[r.key] = r.value;
        }
    });

    res.json({ success: true, data: settings });
});

// ── GET /api/settings/:key — Get a single setting ──
router.get('/:key', (req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT key, value FROM settings WHERE key = ?').get(req.params.key);
    if (!row) {
        return res.status(404).json({ success: false, error: `Setting "${req.params.key}" not found` });
    }

    let parsed;
    try {
        parsed = JSON.parse(row.value);
    } catch {
        parsed = row.value;
    }

    res.json({ success: true, data: { key: row.key, value: parsed } });
});

// ── PUT /api/settings — Bulk update settings ──
router.put('/', (req, res) => {
    const db = getDb();
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, error: 'Request body must be an object of key: value pairs' });
    }

    const upsert = db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);

    const updateMany = db.transaction((entries) => {
        for (const [key, value] of entries) {
            // Always store as valid JSON so consumers that JSON.parse() every
            // settings row (routes/units.js, the quote endpoint, quote_prefix)
            // never hit a parse error. Matches the single-key PUT route.
            const serialized = JSON.stringify(value);
            upsert.run(key, serialized);
        }
    });

    updateMany(Object.entries(updates));

    // Return all settings after update
    const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
    const settings = {};
    rows.forEach(r => {
        try {
            settings[r.key] = JSON.parse(r.value);
        } catch {
            settings[r.key] = r.value;
        }
    });

    res.json({ success: true, data: settings });
});

// ── PUT /api/settings/:key — Update a single setting ──
router.put('/:key', (req, res) => {
    const db = getDb();
    const { value } = req.body;

    if (value === undefined) {
        return res.status(400).json({ success: false, error: 'value is required in request body' });
    }

    const serialized = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);

    db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(req.params.key, serialized);

    res.json({ success: true, data: { key: req.params.key, value } });
});

module.exports = router;
