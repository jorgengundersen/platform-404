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

function nav(): string {
  return `<nav class="site-nav">
  <a class="site-nav__brand" href="/">platform-404</a>
  <ul class="site-nav__links">
    <li><a href="/">Dashboard</a></li>
    <li><a href="/sessions">Sessions</a></li>
    <li><a href="/projects">Projects</a></li>
    <li><a href="/models">Models</a></li>
  </ul>
</nav>`;
}

export function page(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
${nav()}
${content}
</body>
</html>`;
}
