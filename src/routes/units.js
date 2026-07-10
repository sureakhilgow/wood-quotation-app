/**
 * Units CRUD + Panel Generator endpoint.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { generatePanels } = require('../engine/panelGenerator');

// ── GET /api/units — List units (filter by project_id) ──
router.get('/', (req, res) => {
    const db = getDb();
    const { project_id } = req.query;

    let sql = 'SELECT * FROM units';
    const params = [];

    if (project_id) {
        sql += ' WHERE project_id = ?';
        params.push(project_id);
    }
    sql += ' ORDER BY id';

    const units = db.prepare(sql).all(...params);
    res.json({ success: true, data: units });
});

// ── POST /api/units — Create a unit ──
router.post('/', (req, res) => {
    const db = getDb();
    const { project_id, name, type, finish, wastage_pct, labour_rate, labour_lump_sum, transport } = req.body;

    if (!project_id || !name || !type) {
        return res.status(400).json({ success: false, error: 'project_id, name, and type are required' });
    }

    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Load defaults from settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = JSON.parse(r.value); });

    const stmt = db.prepare(`
        INSERT INTO units (project_id, name, type, finish, wastage_pct, labour_rate, labour_lump_sum, transport)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        project_id,
        name,
        type,
        finish || 'Matte Laminate',
        wastage_pct != null ? wastage_pct : (settings.default_wastage_pct || 10),
        labour_rate != null ? labour_rate : (settings.labour_rate || 45),
        labour_lump_sum != null ? labour_lump_sum : null,
        transport != null ? transport : 0
    );

    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: unit });
});

// ── GET /api/units/:id — Get one unit ──
router.get('/:id', (req, res) => {
    const db = getDb();
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }
    res.json({ success: true, data: unit });
});

// ── PUT /api/units/:id — Update a unit ──
router.put('/:id', (req, res) => {
    const db = getDb();
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const { name, type, finish, wastage_pct, labour_rate, labour_lump_sum, transport } = req.body;
    const stmt = db.prepare(`
        UPDATE units SET
            name = COALESCE(?, name),
            type = COALESCE(?, type),
            finish = COALESCE(?, finish),
            wastage_pct = COALESCE(?, wastage_pct),
            labour_rate = COALESCE(?, labour_rate),
            labour_lump_sum = ?,
            transport = COALESCE(?, transport),
            updated_at = datetime('now')
        WHERE id = ?
    `);
    stmt.run(
        name || null,
        type || null,
        finish || null,
        wastage_pct != null ? wastage_pct : null,
        labour_rate != null ? labour_rate : null,
        labour_lump_sum !== undefined ? labour_lump_sum : unit.labour_lump_sum,
        transport != null ? transport : null,
        req.params.id
    );

    const updated = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

// ── DELETE /api/units/:id — Delete a unit ──
router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }
    res.json({ success: true, message: 'Unit deleted' });
});

// ──────────────────────────────────────────────
// POST /api/units/:id/generate-panels — Quick-mode panel generator
// ──────────────────────────────────────────────
router.post('/:id/generate-panels', (req, res) => {
    const db = getDb();
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    if (!unit) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(unit.project_id);
    const unitSystem = project ? project.unit_system : 'ft';

    const { H, W, D, ...options } = req.body;

    if (H == null || W == null || D == null) {
        return res.status(400).json({ success: false, error: 'H, W, and D dimensions are required' });
    }

    try {
        const panels = generatePanels(unit.type, H, W, D, options, unitSystem);

        // Option: auto-save to DB (controlled by ?save=true query param)
        if (req.query.save === 'true') {
            // Clear existing panels for this unit
            db.prepare('DELETE FROM panels WHERE unit_id = ?').run(unit.id);

            const insertStmt = db.prepare(
                'INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (?, ?, ?, ?, ?)'
            );
            const insertMany = db.transaction((panelList) => {
                for (const p of panelList) {
                    insertStmt.run(unit.id, p.name, p.length_ft, p.width_ft, p.qty);
                }
            });
            insertMany(panels);

            // Return saved panels with IDs
            const savedPanels = db.prepare('SELECT * FROM panels WHERE unit_id = ? ORDER BY id').all(unit.id);
            return res.json({ success: true, data: savedPanels, saved: true });
        }

        // Return generated panels without saving (default — for preview/editing)
        res.json({ success: true, data: panels, saved: false });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
