import express from "express";
import cors from "cors";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import onboardingRoutes from "./routes/onboarding.js";
import dashboardRoutes from "./routes/dashboard.js";
import academyRoutes from "./routes/academy.js";
import investRoutes from "./routes/invest.js";
import communityRoutes from "./routes/community.js";
import zakatRoutes from "./routes/zakat.js";
import profileRoutes from "./routes/profile.js";
import workspaceRoutes from "./routes/workspace.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Amanah Institute API listening on http://localhost:${config.port}`);
});
