import "dotenv/config";
import { validateEnv } from "./lib/env.js";
validateEnv();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger.js";
import prisma from "./lib/prisma.js";
import { isSmtpConfigured } from "./lib/email.js";
import multer from "multer";

import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import assignmentRoutes from "./routes/assignments.js";
import reportRoutes from "./routes/reports.js";
import reviewRoutes from "./routes/reviews.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes from "./routes/uploads.js";
import teamRoutes from "./routes/teams.js";
import templateRoutes from "./routes/templates.js";
import { checkOverdueRequests } from "./lib/overdueCheck.js";

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors({
  origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(","),
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/templates", templateRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "PRRMS API",
    smtp: isSmtpConfigured() ? "configured" : "not_configured",
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// Central error handler — converts multer/file-filter rejections into clean JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum size is 50MB"
        : `Upload failed: ${err.message}`;
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
  }
  if (err && err.expose) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
  logger.error("Unhandled server error", { error: err });
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  logger.info(`PRRMS API server running on port ${PORT}`, { route: `/`, method: 'START' });
  if (!isSmtpConfigured()) {
    logger.warn('SMTP not configured — emails will be logged to console only', { route: '/', method: 'START' });
  }
  checkOverdueRequests();
  setInterval(() => checkOverdueRequests(), 60 * 60 * 1000).unref();
});

/**
 * Without an explicit shutdown the process is killed as soon as the container
 * stops, so in-flight requests are dropped and the Postgres connection pool is
 * torn down mid-transaction. Drain first, then close Prisma, then exit — and
 * force-exit if something refuses to settle.
 */
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal} — shutting down gracefully`, { route: "/", method: "SHUTDOWN" });

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit", { route: "/", method: "SHUTDOWN" });
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
    logger.info("Shutdown complete", { route: "/", method: "SHUTDOWN" });
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown", { error: err });
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export default app;
