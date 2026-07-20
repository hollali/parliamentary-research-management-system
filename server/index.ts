import "dotenv/config";
import { validateEnv } from "./lib/env.js";
validateEnv();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger.js";
import { isSmtpConfigured } from "./lib/email.js";

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

app.listen(PORT, () => {
  logger.info(`PRRMS API server running on port ${PORT}`, { route: `/`, method: 'START' });
  if (!isSmtpConfigured()) {
    logger.warn('SMTP not configured — emails will be logged to console only', { route: '/', method: 'START' });
  }
  checkOverdueRequests();
  setInterval(() => checkOverdueRequests(), 60 * 60 * 1000).unref();
});

export default app;
