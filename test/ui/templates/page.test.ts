import { describe, expect, test } from "bun:test";

import { escapeHtml } from "@/ui/templates/page";

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });
});
