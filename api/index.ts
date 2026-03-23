/**
 * Vercel Serverless Function entry point.
 * Exports the Express app so Vercel can route requests to it.
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

// Serve static files from dist/public (for local prod usage)
// On Vercel, static files are served by the CDN — this is a fallback
const distPath = path.resolve(process.cwd(), "dist/public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use("/{*path}", (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

export default app;
