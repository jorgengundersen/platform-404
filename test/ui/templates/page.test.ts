import { describe, expect, test } from "bun:test";

import { escapeHtml, page } from "@/ui/templates/page";

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });
});

describe("page()", () => {
  test("includes persistent nav with links to /, /sessions, /projects, /models", () => {
    const html = page("Test", "<p>content</p>");
    expect(html).toContain(`href="/"`);
    expect(html).toContain(`href="/sessions"`);
    expect(html).toContain(`href="/projects"`);
    expect(html).toContain(`href="/models"`);
    expect(html).toContain(`class="site-nav"`);
  });

  test("marks active nav link with aria-current=page when activePath is provided", () => {
    const html = page("Sessions", "<p>content</p>", "/sessions");
    expect(html).toContain(`href="/sessions" aria-current="page"`);
    expect(html).not.toContain(`href="/" aria-current="page"`);
    expect(html).not.toContain(`href="/projects" aria-current="page"`);
    expect(html).not.toContain(`href="/models" aria-current="page"`);
  });
});
