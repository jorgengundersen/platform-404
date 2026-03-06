const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/projects", label: "Projects" },
  { href: "/models", label: "Models" },
];

function nav(activePath?: string): string {
  const links = NAV_LINKS.map(({ href, label }) => {
    const active = activePath === href ? ` aria-current="page"` : "";
    return `    <li><a href="${href}"${active}>${label}</a></li>`;
  }).join("\n");
  return `<nav class="site-nav">
  <a class="site-nav__brand" href="/">platform-404</a>
  <ul class="site-nav__links">
${links}
  </ul>
</nav>`;
}

export function page(
  title: string,
  content: string,
  activePath?: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
${nav(activePath)}
${content}
</body>
</html>`;
}
