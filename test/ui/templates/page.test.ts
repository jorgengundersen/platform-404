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
});
