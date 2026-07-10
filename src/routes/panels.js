/**
 * Panels CRUD.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

// ── GET /api/panels — List panels (filter by unit_id) ──
router.get('/', (req, res) => {
    const db = getDb();
    const { unit_id } = req.query;

    let sql = 'SELECT * FROM panels';
    const params = [];

    if (unit_id) {
        sql += ' WHERE unit_id = ?';
        params.push(unit_id);
    }
    sql += ' ORDER BY id';

    const panels = db.prepare(sql).all(...params);
    res.json({ success: true, data: panels });
});

// ── POST /api/panels — Create a panel ──
router.post('/', (req, res) => {
    const db = getDb();
    const { unit_id, name, length_ft, width_ft, qty = 1 } = req.body;

    if (!unit_id || !name || length_ft == null || width_ft == null) {
        return res.status(400).json({
            success: false,
            error: 'unit_id, name, length_ft, and width_ft are required',
        });
    }

    // Verify unit exists
    const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const stmt = db.prepare(
        'INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(unit_id, name, length_ft, width_ft, qty);

    const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: panel });
});

// ── POST /api/panels/bulk — Create multiple panels at once ──
router.post('/bulk', (req, res) => {
    const db = getDb();
    const { unit_id, panels } = req.body;

    if (!unit_id || !Array.isArray(panels) || panels.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'unit_id and non-empty panels array are required',
        });
    }

    const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const insertStmt = db.prepare(
        'INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (?, ?, ?, ?, ?)'
    );

    const insertMany = db.transaction((panelList) => {
        const ids = [];
        for (const p of panelList) {
            const result = insertStmt.run(unit_id, p.name, p.length_ft, p.width_ft, p.qty || 1);
            ids.push(result.lastInsertRowid);
        }
        return ids;
    });

    const ids = insertMany(panels);
    const created = db.prepare(
        `SELECT * FROM panels WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`
    ).all(...ids);

    res.status(201).json({ success: true, data: created });
});

// ── GET /api/panels/:id — Get one panel ──
router.get('/:id', (req, res) => {
    const db = getDb();
    const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
    if (!panel) {
        return res.status(404).json({ success: false, error: 'Panel not found' });
    }
    res.json({ success: true, data: panel });
});

// ── PUT /api/panels/:id — Update a panel ──
router.put('/:id', (req, res) => {
    const db = getDb();
    const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
    if (!panel) {
        return res.status(404).json({ success: false, error: 'Panel not found' });
    }

    const { name, length_ft, width_ft, qty } = req.body;
    const stmt = db.prepare(`
        UPDATE panels SET
            name = COALESCE(?, name),
            length_ft = COALESCE(?, length_ft),
            width_ft = COALESCE(?, width_ft),
            qty = COALESCE(?, qty)
        WHERE id = ?
    `);
    stmt.run(
        name || null,
        length_ft != null ? length_ft : null,
        width_ft != null ? width_ft : null,
        qty != null ? qty : null,
        req.params.id
    );

    const updated = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

// ── DELETE /api/panels/:id — Delete a panel ──
router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM panels WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Panel not found' });
    }
    res.json({ success: true, message: 'Panel deleted' });
});

module.exports = router;
