/**
 * Accessory Lines CRUD.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

// ── GET /api/accessories — List accessory lines (filter by unit_id) ──
router.get('/', (req, res) => {
    const db = getDb();
    const { unit_id } = req.query;

    let sql = 'SELECT * FROM accessory_lines';
    const params = [];

    if (unit_id) {
        sql += ' WHERE unit_id = ?';
        params.push(unit_id);
    }
    sql += ' ORDER BY id';

    const lines = db.prepare(sql).all(...params);
    res.json({ success: true, data: lines });
});

// ── POST /api/accessories — Create an accessory line ──
router.post('/', (req, res) => {
    const db = getDb();
    const { unit_id, item, qty = 1, rate } = req.body;

    if (!unit_id || !item || rate == null) {
        return res.status(400).json({ success: false, error: 'unit_id, item, and rate are required' });
    }

    const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const stmt = db.prepare(
        'INSERT INTO accessory_lines (unit_id, item, qty, rate) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(unit_id, item, qty, rate);

    const line = db.prepare('SELECT * FROM accessory_lines WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: line });
});

// ── GET /api/accessories/:id — Get one accessory line ──
router.get('/:id', (req, res) => {
    const db = getDb();
    const line = db.prepare('SELECT * FROM accessory_lines WHERE id = ?').get(req.params.id);
    if (!line) {
        return res.status(404).json({ success: false, error: 'Accessory line not found' });
    }
    res.json({ success: true, data: line });
});

// ── PUT /api/accessories/:id — Update an accessory line ──
router.put('/:id', (req, res) => {
    const db = getDb();
    const line = db.prepare('SELECT * FROM accessory_lines WHERE id = ?').get(req.params.id);
    if (!line) {
        return res.status(404).json({ success: false, error: 'Accessory line not found' });
    }

    const { item, qty, rate } = req.body;
    const stmt = db.prepare(`
        UPDATE accessory_lines SET
            item = COALESCE(?, item),
            qty = COALESCE(?, qty),
            rate = COALESCE(?, rate)
        WHERE id = ?
    `);
    stmt.run(item || null, qty != null ? qty : null, rate != null ? rate : null, req.params.id);

    const updated = db.prepare('SELECT * FROM accessory_lines WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

// ── DELETE /api/accessories/:id — Delete an accessory line ──
router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM accessory_lines WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Accessory line not found' });
    }
    res.json({ success: true, message: 'Accessory line deleted' });
});

module.exports = router;
