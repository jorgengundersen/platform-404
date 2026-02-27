export async function rootHandler(_req: Request): Promise<Response> {
  return new Response(
    "<!DOCTYPE html>\n<html>\n<head><title>platform-404</title></head>\n<body>\n<h1>platform-404</h1>\n</body>\n</html>",
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
}

export async function staticStylesHandler(_req: Request): Promise<Response> {
  const css = `/* platform-404 */

body {
  font-family: sans-serif;
}
`;
  return new Response(css, {
    status: 200,
    headers: {
      "Content-Type": "text/css",
    },
  });
}
