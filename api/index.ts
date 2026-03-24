/**
 * Vercel Serverless Function entry point.
 * Vercel auto-detects files in /api and serves them as serverless functions.
 * This file must stay at api/index.ts (project root level).
 */
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";
import path from "path";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register all API routes
registerRoutes(httpServer, app);

// Serve static files — Vercel CDN handles this in production,
// but Express serves them as fallback
const distPath = path.resolve(process.cwd(), "dist/public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// SPA fallback — all non-API routes serve index.html
app.use("/{*path}", (_req: Request, res: Response) => {
  const indexPath = path.resolve(process.cwd(), "dist/public/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

export default app;
