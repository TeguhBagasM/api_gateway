import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN wajib diisi"),
  RBAC_SERVICE_URL: z.string().min(1, "RBAC_SERVICE_URL wajib diisi"),
  MASTER_SERVICE_URL: z.string().default(""),
  DOKUMEN_SERVICE_URL: z.string().default(""),
  TRANSAKSI_SERVICE_URL: z.string().default(""),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("==========================================");
  console.error("FAILED TO START: validasi environment variable gagal.");
  for (const issue of parsed.error.issues) {
    console.error(`  - [${issue.path.join(".")}] ${issue.message}`);
  }
  console.error("==========================================");
  throw new Error("Invalid environment variables — gateway tidak bisa start");
}

export const env = parsed.data;