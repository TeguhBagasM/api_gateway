import { Router } from "express";
import { serviceTargets, type ServiceTarget } from "../config/services.js";

// Timeout pendek (2 detik) agar /health/detailed tidak menggantung lama
// kalau ada service yang down atau lambat merespons.
const HEALTH_TIMEOUT_MS = 2000;

interface ServiceHealth {
  status: "ok" | "down";
  responseTimeMs: number;
  error?: string;
}

export const healthRouter = Router();

// Liveness probe CEPAT — cuma jawab status gateway, TIDAK mengecek service
// manapun. Dipakai orchestrator/load balancer untuk memutuskan kalau
// gateway ini masih hidup dan layak menerima traffic.
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

// Health check detail untuk debugging manual — cek /health tiap service
// backend (dari serviceTargets) dengan timeout 2 detik per service.
// Gateway TETAP return HTTP 200 walau ada service yang down; service yang
// bermasalah ditandai status "down" + pesan errornya.
healthRouter.get("/health/detailed", async (_req, res) => {
  // serviceTargets berisi SATU baris per route (mis. rbac punya 4 prefix:
  // /api/auth, /api/users, /api/roles, /api/menus — semuanya target yang sama).
  // Dedupe by nama service supaya tiap service hanya di-check 1x.
  const uniqueServices = new Map<string, ServiceTarget>();
  for (const entry of serviceTargets) {
    if (!uniqueServices.has(entry.name)) {
      uniqueServices.set(entry.name, entry);
    }
  }

  // Semua service di-check secara paralel (bukan berurutan) —
  // total durasi = service paling lambat, bukan jumlah service × 2 detik.
  const checks = await Promise.all(
    [...uniqueServices].map(async ([name, svc]) => [name, await checkService(svc.target)] as const),
  );

  res.json({
    gateway: "ok",
    services: Object.fromEntries(checks),
  });
});

async function checkService(target: string): Promise<ServiceHealth> {
  const startedAt = performance.now();

  try {
    const response = await fetch(`${target}/health`, {
      // AbortSignal.timeout membatalkan fetch otomatis setelah 2 detik.
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);

    if (response.ok) {
      return { status: "ok", responseTimeMs };
    }
    return { status: "down", responseTimeMs, error: `HTTP ${response.status}` };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout =
      typeof error !== "string" &&
      typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "TimeoutError";
    return {
      status: "down",
      responseTimeMs,
      error: isTimeout ? `timeout (${HEALTH_TIMEOUT_MS / 1000}s)` : message,
    };
  }
}