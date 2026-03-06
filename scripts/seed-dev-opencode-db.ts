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

    DROP TABLE IF EXISTS part;
    DROP TABLE IF EXISTS message;
    DROP TABLE IF EXISTS session;
    DROP TABLE IF EXISTS project;

    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );

    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      data TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );

    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      session_id TEXT,
      data TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );
  `);

  const now = Date.now();

  db.prepare("INSERT INTO project (id, name) VALUES (?, ?)").run(
    "proj-dev-1",
    "Dev Project",
  );

  db.prepare(
    "INSERT INTO session (id, project_id, title, time_created, time_updated) VALUES (?, ?, ?, ?, ?)",
  ).run("sess-dev-1", "proj-dev-1", "Seed Session", now, now);

  console.log(`Seeded dev OpenCode DB at ${dbPath}`);
} finally {
  db.close();
}
