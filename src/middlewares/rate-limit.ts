import { rateLimit } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
});

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak percobaan. Silakan coba lagi nanti." },
});

export function authPathRateLimiter(req: Request, res: Response, next: NextFunction) {
  if (/\/auth(?:\/|$)/.test(req.path)) {
    authRateLimiter(req, res, next);
    return;
  }
  next();
}