import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { Request } from "express";
import type { IncomingMessage } from "node:http";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { authPathRateLimiter, globalRateLimiter } from "./middlewares/rate-limit.js";
import { requestId } from "./middlewares/request-id.js";
import { setupProxyRoutes } from "./proxy/proxy-routes.js";

morgan.token("request-id", (req: IncomingMessage) => (req as Request).id ?? "-");

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
  app.use(requestId);
  app.use(morgan(":method :url :status :response-time ms request-id=:request-id"));
  app.use(globalRateLimiter);
  app.use(authPathRateLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "gateway" });
  });

  setupProxyRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}