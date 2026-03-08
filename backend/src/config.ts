import "dotenv/config";

const port = Number(process.env.PORT) || 4000;
const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";

if (nodeEnv === "production" && jwtSecret === "dev-secret-change-in-production") {
  console.warn("[Amanah API] WARN: JWT_SECRET should be set in production.");
}

console.log("[Amanah API] config loaded (PORT=" + port + ", NODE_ENV=" + nodeEnv + ")");

export const config = {
  port,
  nodeEnv,
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
} as const;
