import { Database } from "bun:sqlite";

function usage(): never {
  console.error("Usage: bun run scripts/seed-dev-opencode-db.ts <db-path>");
  process.exit(2);
}

const dbPath = process.argv[2];
if (!dbPath) {
  usage();
}

const db = new Database(dbPath);

try {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS project (
      id TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      time_updated INTEGER
    );

    CREATE TABLE IF NOT EXISTS message (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      data TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );

    CREATE TABLE IF NOT EXISTS part (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      session_id TEXT,
      data TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );
  `);

  const now = Date.now();

  db.prepare("INSERT OR IGNORE INTO project (id, name) VALUES (?, ?)").run(
    "proj-dev-1",
    "Dev Project",
  );

  db.prepare(
    "INSERT OR IGNORE INTO session (id, project_id, title, time_updated) VALUES (?, ?, ?, ?)",
  ).run("sess-dev-1", "proj-dev-1", "Seed Session", now);

  console.log(`Seeded dev OpenCode DB at ${dbPath}`);
} finally {
  db.close();
}
