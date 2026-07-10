/**
 * Database connection singleton using better-sqlite3.
 * Initialises schema and seeds default data on first run.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'ukd.db');

let _db = null;

/**
 * Get (or create) the singleton database connection.
 * @param {string} [dbPath] - Override DB file path (useful for tests).
 * @returns {import('better-sqlite3').Database}
 */
function getDb(dbPath) {
    const resolvedPath = dbPath || DB_PATH;

    if (_db && !dbPath) return _db;

    const db = new Database(resolvedPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Seed defaults if settings table is empty
    const count = db.prepare('SELECT COUNT(*) as cnt FROM settings').get();
    if (count.cnt === 0) {
        const seedPath = path.join(__dirname, 'seed.sql');
        const seed = fs.readFileSync(seedPath, 'utf8');
        db.exec(seed);
    }

    if (!dbPath) _db = db;
    return db;
}

/**
 * Close the singleton database connection.
 */
function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}

module.exports = { getDb, closeDb };
