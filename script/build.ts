import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Main server bundle (for self-hosted / local production)
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Vercel serverless entry — bundle the Express app into api/index.js.
  // Vercel auto-detects api/index.js as a serverless function.
  // We use server/index.ts as the source but stdin-inject an ESM-compatible export.
  console.log("building vercel serverless entry...");
  await esbuild({
    stdin: {
      contents: `
        import express from 'express';
        import { registerRoutes } from './server/routes';
        import { createServer } from 'http';
        import path from 'path';
        import fs from 'fs';
        const app = express();
        const httpServer = createServer(app);
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        registerRoutes(httpServer, app);
        const distPath = path.resolve(process.cwd(), 'dist/public');
        if (fs.existsSync(distPath)) {
          app.use(express.static(distPath));
          app.use('/{*path}', (_req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
        }
        export default app;
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "api/index.cjs",
    external: ["better-sqlite3"],
    minify: false,
    logLevel: "info",
  });
  console.log("done");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
