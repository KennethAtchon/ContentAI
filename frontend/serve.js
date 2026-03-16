const port = Number(process.env.PORT) || 4173;
const distDir = new URL("./dist", import.meta.url).pathname;
const indexHtml = Bun.file(`${distDir}/index.html`);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const pathname = new URL(req.url).pathname;

    // Serve static assets; fall back to index.html for SPA routing
    if (pathname !== "/") {
      const file = Bun.file(`${distDir}${pathname}`);
      if (await file.exists()) return new Response(file);
    }

    return new Response(indexHtml);
  },
});

console.log(`Serving dist/ on http://0.0.0.0:${port}`);
