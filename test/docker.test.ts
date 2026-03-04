import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

describe("Dockerfile", () => {
  test("exists and contains required instructions", () => {
    const content = readFileSync(join(root, "Dockerfile"), "utf-8");

    expect(content).toContain("FROM oven/bun:1-slim");
    expect(content).toContain("WORKDIR /app");
    expect(content).toContain("COPY package.json bun.lock");
    expect(content).toContain("bun install --frozen-lockfile --production");
    expect(content).toContain("COPY src/");
    expect(content).toContain("EXPOSE 3000");
  });

  test("copies index.ts and uses it as CMD entrypoint", () => {
    const content = readFileSync(join(root, "Dockerfile"), "utf-8");
    expect(content).toContain("index.ts");
    // CMD must invoke index.ts, not src/main.ts directly
    expect(content).toContain('"index.ts"');
  });

  test("copies tsconfig.json so @/ path aliases resolve at runtime", () => {
    const content = readFileSync(join(root, "Dockerfile"), "utf-8");
    expect(content).toContain("tsconfig.json");
  });
});

describe("docker-compose.yml", () => {
  test("exists and contains required config", () => {
    const content = readFileSync(join(root, "docker-compose.yml"), "utf-8");

    expect(content).toContain("devenv-data");
    expect(content).toContain("platform-404-data");
    expect(content).toContain("/data");
    expect(content).toContain("OPENCODE_DB_PATH");
    expect(content).toContain("DASHBOARD_DB_PATH");
    expect(content).toContain("PORT");
    expect(content).toContain("SYNC_INTERVAL_MS");
  });
});
