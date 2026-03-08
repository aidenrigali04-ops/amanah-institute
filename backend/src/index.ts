import "./earlyLog.js";
import express from "express";
import cors from "cors";
import { config } from "./config.js";

process.on("uncaughtException", (err) => {
  console.error("[Amanah API] uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, p) => {
  console.error("[Amanah API] unhandledRejection:", reason, p);
  process.exit(1);
});

console.log("[Amanah API] Loading routes (Prisma will init)...");
import authRoutes from "./routes/auth.js";
import onboardingRoutes from "./routes/onboarding.js";
import dashboardRoutes from "./routes/dashboard.js";
import academyRoutes from "./routes/academy.js";
import investRoutes from "./routes/invest.js";
import communityRoutes from "./routes/community.js";
import zakatRoutes from "./routes/zakat.js";
import profileRoutes from "./routes/profile.js";
import workspaceRoutes from "./routes/workspace.js";
console.log("[Amanah API] Routes loaded.");

console.log("[Amanah API] Imports done, setting up Express app (PORT=" + config.port + ")...");
const app = express();

// CORS: set Access-Control-Allow-Origin on every response so preflight and actual requests pass
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  if (_req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

// Log requests to health and auth so Railway logs show if traffic reaches the app
app.use((req, _res, next) => {
  const path = req.path;
  if (path === "/health" || path.startsWith("/api/auth/")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);
  }
  next();
});

// Root (for Railway/load balancer health checks that hit /)
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "amanah-institute-api" });
});
// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "amanah-institute-api" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/academy", academyRoutes);
app.use("/api/invest", investRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/zakat", zakatRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/workspace", workspaceRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler (must have 4 args so Express treats it as error middleware)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  console.error("[Amanah API] Error:", err?.message ?? err);
  res.status(500).json({ error: "Internal server error" });
});

const host = "0.0.0.0";
app.listen(config.port, host, () => {
  console.log(`[Amanah API] Listening on http://${host}:${config.port} (PORT=${config.port})`);
}).on("error", (err) => {
  console.error("[Amanah API] listen error:", err);
  process.exit(1);
});
