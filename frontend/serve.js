const port = Number(process.env.PORT) || 4173;
const distDir = new URL("./dist", import.meta.url).pathname;

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const pathname = new URL(req.url).pathname;
    const file = Bun.file(`${distDir}${pathname}`);

    if (await file.exists()) return new Response(file);

    // SPA fallback — all unknown routes serve index.html
    return new Response(Bun.file(`${distDir}/index.html`));
  },
});

console.log(`Serving dist/ on http://0.0.0.0:${port}`);
