import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { Request } from "express";
import type { IncomingMessage } from "node:http";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { authProxyLimiter, globalLimiter } from "./middlewares/rate-limit.js";
import { requestId } from "./middlewares/request-id.js";
import { setupProxyRoutes } from "./proxy/proxy-routes.js";
import { healthRouter } from "./routes/health.js";

morgan.token("request-id", (req: IncomingMessage) => (req as Request).id ?? "-");

// Format log: [timestamp] [request-id] method path status response-time-ms
// Contoh: [2026-09-08T08:00:00.000Z] [a1b2...] POST /api/auth/login 401 12.345 ms
const LOG_FORMAT = "[:date[iso]] [:request-id] :method :url :status :response-time ms";

export function createApp() {
  const app = express();

  // Urutan middleware penting — jangan diacak:
  // helmet → cors → request-id → logger → globalLimiter
  // → authProxyLimiter (khusus /api/auth)
  // → proxy routes → 404 handler → error handler
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
  app.use(requestId);
  app.use(morgan(LOG_FORMAT));
  app.use(globalLimiter);

  // Limiter khusus autentikasi — DIPASANG PREFIX-SPECIFIC, bukan global.
  // Hanya request yang path-nya /api/auth/* (login & register) yang kena.
  // Harus SEBELUM proxy routes untuk prefix /api/auth agar request
  // di-limit dulu sebelum diteruskan ke service RBAC.
  app.use("/api/auth", authProxyLimiter);

  // /health        → liveness probe ringan (tanpa cek service backend)
  // /health/detailed → cek /health tiap service dengan timeout 2 detik
  app.use(healthRouter);

  // --- PROXY MIDDLEWARE ---
  // Mount SEBELUM express.json() (kalau ditambahkan nanti) karena
  // http-proxy-middleware meneruskan body request sebagai raw stream.
  // Kalau express.json() di-mount duluan, body akan di-parse dan
  // di-consume oleh gateway → body yang diteruskan ke backend kosong.
  //
  // Saat ini gateway TIDAK menggunakan express.json() secara sengaja —
  // semua body request dibiarkan tetap raw agar bisa diteruskan langsung
  // ke service backend tanpa overhead parsing di gateway.
  setupProxyRoutes(app);

  // Catch-all: route yang tidak match prefix manapun akan return 404.
  // Harus SETELAH proxy routes agar request yang match prefix service
  // tidak ke-handle oleh notFoundHandler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}