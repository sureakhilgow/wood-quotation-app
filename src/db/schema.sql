-- UKD Industries Quotation Backend - Database Schema

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    quote_no TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL DEFAULT (date('now')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'approved')),
    unit_system TEXT NOT NULL DEFAULT 'ft' CHECK(unit_system IN ('ft', 'inch', 'mm')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Units table (wardrobe, tv_unit, kitchen_module)
CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('wardrobe', 'tv_unit', 'kitchen_module')),
    finish TEXT NOT NULL DEFAULT 'Matte Laminate',
    wastage_pct REAL NOT NULL DEFAULT 10,
    labour_rate REAL NOT NULL DEFAULT 45,
    labour_lump_sum REAL DEFAULT NULL,
    transport REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Panels table (all dimensions stored in feet)
CREATE TABLE IF NOT EXISTS panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    length_ft REAL NOT NULL,
    width_ft REAL NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- Hardware line items
CREATE TABLE IF NOT EXISTS hardware_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    rate REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- Accessory line items
CREATE TABLE IF NOT EXISTS accessory_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    rate REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- Settings table (key-value store for configurable rates)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_units_project_id ON units(project_id);
CREATE INDEX IF NOT EXISTS idx_panels_unit_id ON panels(unit_id);
CREATE INDEX IF NOT EXISTS idx_hardware_lines_unit_id ON hardware_lines(unit_id);
CREATE INDEX IF NOT EXISTS idx_accessory_lines_unit_id ON accessory_lines(unit_id);
