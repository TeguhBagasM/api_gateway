import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

// Limiter global: 100 request/menit per IP.
// Dipasang di app.ts untuk SEMUA route via app.use(globalLimiter).
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
});

// Limiter khusus autentikasi: 10 request/15 menit per IP.
// KHUSUS untuk request yang menuju prefix /api/auth (login & register) —
// di-mount di app.ts lewat app.use("/api/auth", authProxyLimiter)
// SEBELUM proxy middleware untuk prefix tersebut. BUKAN dipasang global.
//
// Dipisah dari globalLimiter karena endpoint login/register harus pakai
// kuota yang lebih ketat dari traffic proxy biasa.
export const authProxyLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak percobaan login/register. Silakan coba lagi nanti." },
});