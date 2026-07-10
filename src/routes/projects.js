/**
 * Projects CRUD + Quote endpoints.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const pricing = require('../engine/pricing');

// ── GET /api/projects — List all projects ──
router.get('/', (req, res) => {
    const db = getDb();
    const { status, search } = req.query;

    let sql = 'SELECT * FROM projects';
    const conditions = [];
    const params = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (search) {
        conditions.push('(client_name LIKE ? OR quote_no LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const projects = db.prepare(sql).all(...params);
    res.json({ success: true, data: projects });
});

// ── POST /api/projects — Create a project ──
router.post('/', (req, res) => {
    const db = getDb();
    const { client_name, unit_system = 'ft' } = req.body;

    if (!client_name) {
        return res.status(400).json({ success: false, error: 'client_name is required' });
    }

    // Generate quote number: PREFIX-YEAR-SEQ
    const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'quote_prefix'").get();
    const prefix = prefixRow ? JSON.parse(prefixRow.value) : 'UKD';
    const year = new Date().getFullYear();
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM projects WHERE quote_no LIKE ?").get(`${prefix}-${year}-%`);
    const seq = String((countRow.cnt || 0) + 1).padStart(3, '0');
    const quote_no = `${prefix}-${year}-${seq}`;

    const stmt = db.prepare(`
        INSERT INTO projects (client_name, quote_no, date, status, unit_system)
        VALUES (?, ?, date('now'), 'draft', ?)
    `);
    const result = stmt.run(client_name, quote_no, unit_system);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: project });
});

// ── GET /api/projects/:id — Get one project ──
router.get('/:id', (req, res) => {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
});

// ── PUT /api/projects/:id — Update a project ──
router.put('/:id', (req, res) => {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { client_name, status, unit_system, date } = req.body;
    const stmt = db.prepare(`
        UPDATE projects SET
            client_name = COALESCE(?, client_name),
            status = COALESCE(?, status),
            unit_system = COALESCE(?, unit_system),
            date = COALESCE(?, date),
            updated_at = datetime('now')
        WHERE id = ?
    `);
    stmt.run(client_name || null, status || null, unit_system || null, date || null, req.params.id);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});

// ── DELETE /api/projects/:id — Delete a project ──
router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, message: 'Project deleted' });
});

// ──────────────────────────────────────────────
// GET /api/projects/:id/quote — Full itemised breakdown
// ──────────────────────────────────────────────
router.get('/:id/quote', (req, res) => {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = JSON.parse(r.value); });

    const finishRates = settings.finish_rates || {};
    const marginPct = settings.default_margin_pct || 15;
    const gstPct = settings.gst_pct || 18;

    // Load units
    const units = db.prepare('SELECT * FROM units WHERE project_id = ? ORDER BY id').all(project.id);

    const unitBreakdowns = units.map(unit => {
        const panels = db.prepare('SELECT * FROM panels WHERE unit_id = ? ORDER BY id').all(unit.id);
        const hardware = db.prepare('SELECT * FROM hardware_lines WHERE unit_id = ? ORDER BY id').all(unit.id);
        const accessories = db.prepare('SELECT * FROM accessory_lines WHERE unit_id = ? ORDER BY id').all(unit.id);

        const finishRate = finishRates[unit.finish] || 0;
        const breakdown = pricing.computeUnitBreakdown(unit, panels, hardware, accessories, finishRate);

        return {
            unit: {
                id: unit.id,
                name: unit.name,
                type: unit.type,
                finish: unit.finish,
                wastage_pct: unit.wastage_pct,
                labour_rate: unit.labour_rate,
                labour_lump_sum: unit.labour_lump_sum,
                transport: unit.transport,
            },
            panels: panels.map(p => ({
                id: p.id,
                name: p.name,
                length_ft: p.length_ft,
                width_ft: p.width_ft,
                qty: p.qty,
                area: pricing.panelArea(p),
            })),
            hardware,
            accessories,
            breakdown,
        };
    });

    const projectTotals = pricing.computeProjectTotals(
        unitBreakdowns.map(u => u.breakdown),
        marginPct,
        gstPct
    );

    res.json({
        success: true,
        data: {
            project: {
                id: project.id,
                client_name: project.client_name,
                quote_no: project.quote_no,
                date: project.date,
                status: project.status,
                unit_system: project.unit_system,
            },
            units: unitBreakdowns,
            totals: projectTotals,
            settings: {
                margin_pct: marginPct,
                gst_pct: gstPct,
            },
        },
    });
});

// ──────────────────────────────────────────────
// GET /api/projects/:id/quote.pdf — PDF quotation
// ──────────────────────────────────────────────
router.get('/:id/quote.pdf', (req, res) => {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = JSON.parse(r.value); });

    const finishRates = settings.finish_rates || {};
    const marginPct = settings.default_margin_pct || 15;
    const gstPct = settings.gst_pct || 18;

    // Load units + breakdowns
    const units = db.prepare('SELECT * FROM units WHERE project_id = ? ORDER BY id').all(project.id);
    const unitBreakdowns = units.map(unit => {
        const panels = db.prepare('SELECT * FROM panels WHERE unit_id = ? ORDER BY id').all(unit.id);
        const hardware = db.prepare('SELECT * FROM hardware_lines WHERE unit_id = ? ORDER BY id').all(unit.id);
        const accessories = db.prepare('SELECT * FROM accessory_lines WHERE unit_id = ? ORDER BY id').all(unit.id);
        const finishRate = finishRates[unit.finish] || 0;
        const breakdown = pricing.computeUnitBreakdown(unit, panels, hardware, accessories, finishRate);
        return {
            unit,
            panels: panels.map(p => ({ ...p, area: pricing.panelArea(p) })),
            hardware,
            accessories,
            breakdown,
        };
    });

    const projectTotals = pricing.computeProjectTotals(
        unitBreakdowns.map(u => u.breakdown),
        marginPct,
        gstPct
    );

    // Generate PDF
    const { generateQuotePdf } = require('../services/pdfGenerator');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${project.quote_no}.pdf"`);

    generateQuotePdf(project, unitBreakdowns, projectTotals, settings, res);
});

module.exports = router;
