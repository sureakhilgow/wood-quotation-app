/**
 * UKD Industries — Table-Driven Panel Generator
 *
 * Each unit type has a template object that declares panels as formula
 * functions of (H, W, D, options). Adding new unit types = adding a new
 * entry to TEMPLATES. No other code needs to change.
 *
 * All dimensions are in feet. The generator returns an array of editable
 * panel rows: { name, length_ft, width_ft, qty }.
 */

const { toFeet } = require('./pricing');

// ──────────────────────────────────────────────
// Template Registry
// ──────────────────────────────────────────────

/**
 * Each template is an object with:
 *   name: string
 *   generate(H, W, D, options) → Array<{ name, length_ft, width_ft, qty }>
 *
 * Options vary by type but follow common conventions:
 *   n_partitions, n_shelves, loft (bool), loft_height, n_drawers, drawer_height, drawer_width
 */
const TEMPLATES = {};

// ──────────────────────────────────────────────
// WARDROBE Template
// ──────────────────────────────────────────────
TEMPLATES.wardrobe = {
    name: 'Wardrobe',
    generate(H, W, D, opts = {}) {
        const {
            n_partitions = 0,
            n_shelves = 0,       // shelves per section
            loft = false,
            loft_height = 1.5,   // feet
            n_drawers = 0,
            drawer_height = 0.5, // feet
            drawer_width = null, // defaults to section_width
        } = opts;

        const panels = [];
        const sections = n_partitions + 1;
        const sectionWidth = parseFloat((W / sections).toFixed(4));

        // Main carcass
        panels.push({ name: 'Side Panel',  length_ft: H, width_ft: D, qty: 2 });
        panels.push({ name: 'Top Panel',   length_ft: W, width_ft: D, qty: 1 });
        panels.push({ name: 'Bottom Panel', length_ft: W, width_ft: D, qty: 1 });
        panels.push({ name: 'Back Panel',  length_ft: H, width_ft: W, qty: 1 });

        // Partitions
        if (n_partitions > 0) {
            panels.push({ name: 'Partition', length_ft: H, width_ft: D, qty: n_partitions });
        }

        // Shutters (full front)
        panels.push({ name: 'Shutter', length_ft: H, width_ft: W, qty: 1 });

        // Shelves — n_shelves per section
        if (n_shelves > 0) {
            const totalShelves = n_shelves * sections;
            panels.push({
                name: 'Shelf',
                length_ft: parseFloat(sectionWidth.toFixed(2)),
                width_ft: D,
                qty: totalShelves,
            });
        }

        // Loft (if enabled)
        if (loft) {
            const lH = loft_height;
            panels.push({ name: 'Loft Side Panel',   length_ft: lH, width_ft: D, qty: 2 });
            panels.push({ name: 'Loft Top Panel',    length_ft: W,  width_ft: D, qty: 1 });
            panels.push({ name: 'Loft Bottom Panel', length_ft: W,  width_ft: D, qty: 1 });
            panels.push({ name: 'Loft Back Panel',   length_ft: lH, width_ft: W, qty: 1 });
            panels.push({ name: 'Loft Shutter',      length_ft: lH, width_ft: W, qty: 1 });
        }

        // Drawers
        if (n_drawers > 0) {
            const dW = drawer_width || sectionWidth;
            for (let i = 1; i <= n_drawers; i++) {
                const prefix = `Drawer ${i}`;
                panels.push({ name: `${prefix} - Side`,   length_ft: drawer_height, width_ft: D,  qty: 2 });
                panels.push({ name: `${prefix} - Front`,  length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Back`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Bottom`, length_ft: dW,            width_ft: D,  qty: 1 });
                panels.push({ name: `${prefix} - Face`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
            }
        }

        return panels;
    },
};

// ──────────────────────────────────────────────
// TV_UNIT Template
// ──────────────────────────────────────────────
TEMPLATES.tv_unit = {
    name: 'TV Unit',
    generate(H, W, D, opts = {}) {
        const {
            n_partitions = 1,
            n_shelves = 1,       // shelves per section
            n_drawers = 0,
            drawer_height = 0.5,
            drawer_width = null,
            has_back_panel = true,
        } = opts;

        const panels = [];
        const sections = n_partitions + 1;
        const sectionWidth = parseFloat((W / sections).toFixed(4));

        // Main carcass
        panels.push({ name: 'Side Panel',   length_ft: H, width_ft: D, qty: 2 });
        panels.push({ name: 'Top Panel',    length_ft: W, width_ft: D, qty: 1 });
        panels.push({ name: 'Bottom Panel', length_ft: W, width_ft: D, qty: 1 });

        if (has_back_panel) {
            panels.push({ name: 'Back Panel', length_ft: H, width_ft: W, qty: 1 });
        }

        // Partitions
        if (n_partitions > 0) {
            panels.push({ name: 'Partition', length_ft: H, width_ft: D, qty: n_partitions });
        }

        // Shelves per section
        if (n_shelves > 0) {
            const totalShelves = n_shelves * sections;
            panels.push({
                name: 'Shelf',
                length_ft: parseFloat(sectionWidth.toFixed(2)),
                width_ft: D,
                qty: totalShelves,
            });
        }

        // Shutter/Door — covers full front
        panels.push({ name: 'Shutter', length_ft: H, width_ft: W, qty: 1 });

        // Drawers
        if (n_drawers > 0) {
            const dW = drawer_width || sectionWidth;
            for (let i = 1; i <= n_drawers; i++) {
                const prefix = `Drawer ${i}`;
                panels.push({ name: `${prefix} - Side`,   length_ft: drawer_height, width_ft: D,  qty: 2 });
                panels.push({ name: `${prefix} - Front`,  length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Back`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Bottom`, length_ft: dW,            width_ft: D,  qty: 1 });
                panels.push({ name: `${prefix} - Face`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
            }
        }

        return panels;
    },
};

// ──────────────────────────────────────────────
// KITCHEN_MODULE Template
// ──────────────────────────────────────────────
TEMPLATES.kitchen_module = {
    name: 'Kitchen Module',
    generate(H, W, D, opts = {}) {
        const {
            n_partitions = 0,
            n_shelves = 2,       // shelves per section
            n_drawers = 0,
            drawer_height = 0.5,
            drawer_width = null,
            has_back_panel = true,
            is_wall_unit = false,
        } = opts;

        const panels = [];
        const sections = n_partitions + 1;
        const sectionWidth = parseFloat((W / sections).toFixed(4));

        // Main carcass
        panels.push({ name: 'Side Panel',   length_ft: H, width_ft: D, qty: 2 });
        panels.push({ name: 'Top Panel',    length_ft: W, width_ft: D, qty: 1 });
        panels.push({ name: 'Bottom Panel', length_ft: W, width_ft: D, qty: 1 });

        if (has_back_panel) {
            panels.push({ name: 'Back Panel', length_ft: H, width_ft: W, qty: 1 });
        }

        // Partitions
        if (n_partitions > 0) {
            panels.push({ name: 'Partition', length_ft: H, width_ft: D, qty: n_partitions });
        }

        // Shelves per section
        if (n_shelves > 0) {
            const totalShelves = n_shelves * sections;
            panels.push({
                name: 'Shelf',
                length_ft: parseFloat(sectionWidth.toFixed(2)),
                width_ft: D,
                qty: totalShelves,
            });
        }

        // Shutter/Door
        panels.push({ name: 'Shutter', length_ft: H, width_ft: W, qty: 1 });

        // Drawers (common in base kitchen modules)
        if (n_drawers > 0) {
            const dW = drawer_width || sectionWidth;
            for (let i = 1; i <= n_drawers; i++) {
                const prefix = `Drawer ${i}`;
                panels.push({ name: `${prefix} - Side`,   length_ft: drawer_height, width_ft: D,  qty: 2 });
                panels.push({ name: `${prefix} - Front`,  length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Back`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
                panels.push({ name: `${prefix} - Bottom`, length_ft: dW,            width_ft: D,  qty: 1 });
                panels.push({ name: `${prefix} - Face`,   length_ft: drawer_height, width_ft: dW, qty: 1 });
            }
        }

        return panels;
    },
};

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate panels for a given unit type.
 * Dimensions can be in any supported system; they are converted to feet.
 *
 * @param {string} type - 'wardrobe' | 'tv_unit' | 'kitchen_module' (or any registered template)
 * @param {number} H - Height
 * @param {number} W - Width
 * @param {number} D - Depth
 * @param {object} [options] - Template-specific options
 * @param {'ft'|'inch'|'mm'} [unitSystem='ft'] - Input dimension unit system
 * @returns {Array<{ name: string, length_ft: number, width_ft: number, qty: number }>}
 */
function generatePanels(type, H, W, D, options = {}, unitSystem = 'ft') {
    const template = TEMPLATES[type];
    if (!template) {
        throw new Error(`Unknown unit type: "${type}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
    }

    // Convert input dimensions to feet
    const hFt = toFeet(H, unitSystem);
    const wFt = toFeet(W, unitSystem);
    const dFt = toFeet(D, unitSystem);

    // Convert any dimension-based options to feet as well
    const convertedOpts = { ...options };
    if (convertedOpts.loft_height != null) {
        convertedOpts.loft_height = toFeet(convertedOpts.loft_height, unitSystem);
    }
    if (convertedOpts.drawer_height != null) {
        convertedOpts.drawer_height = toFeet(convertedOpts.drawer_height, unitSystem);
    }
    if (convertedOpts.drawer_width != null) {
        convertedOpts.drawer_width = toFeet(convertedOpts.drawer_width, unitSystem);
    }

    return template.generate(hFt, wFt, dFt, convertedOpts);
}

/**
 * Register a custom template at runtime (extensibility).
 * @param {string} type - unique key
 * @param {{ name: string, generate: Function }} template
 */
function registerTemplate(type, template) {
    if (!template || typeof template.generate !== 'function') {
        throw new Error('Template must have a generate(H, W, D, options) function');
    }
    TEMPLATES[type] = template;
}

/**
 * List all registered template types.
 * @returns {string[]}
 */
function listTemplates() {
    return Object.keys(TEMPLATES);
}

module.exports = {
    generatePanels,
    registerTemplate,
    listTemplates,
    TEMPLATES,
};
