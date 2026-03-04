import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "bun";

const dbPath = `/tmp/test-seed-${Date.now()}.db`;

afterAll(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test("seed script creates message and part tables", () => {
  const result = spawnSync([
    "bun",
    "run",
    path.resolve("scripts/seed-dev-opencode-db.ts"),
    dbPath,
  ]);

  expect(result.exitCode).toBe(0);

  const db = new Database(dbPath, { readonly: true });
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
  db.close();

  expect(tables).toContain("message");
  expect(tables).toContain("part");
});
