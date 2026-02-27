export async function healthHandler(_req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({
      data: {
        status: "ok",
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
