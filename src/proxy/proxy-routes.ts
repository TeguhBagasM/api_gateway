import { createProxyMiddleware } from "http-proxy-middleware";
import type { Application, Request, Response } from "express";
import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { env } from "../config/env.js";
import { serviceTargets, type ServiceTarget } from "../config/services.js";

// Header internal yang hanya boleh hidup di dalam gateway —
// tidak diteruskan ke service backend agar tidak bocor
// ke service yang tidak seharusnya mengetahuinya.
const INTERNAL_HEADERS = [
  "x-request-id",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
];

// Hapus header internal dari request yang akan diteruskan ke backend.
// x-request-id sengaja tidak dihapus di sini — ia akan diset ulang
// secara eksplisit di prepareProxyRequest agar nilainya pasti
// berasal dari req.id (bukan dari client sembarang).
function stripInternalHeaders(proxyReq: ClientRequest) {
  for (const header of INTERNAL_HEADERS) {
    proxyReq.removeHeader(header);
  }
}

// Handler error proxy: dipanggil oleh http-proxy-middleware kalau
// target service tidak bisa dihubungi (ECONNREFUSED, timeout, dll).
// Mengembalikan 502 untuk erroroneksi, 504 untuk timeout.
// `serviceName` di-inject per service lewat closure saat pembuatan middleware.
function handleProxyError(
  error: Error,
  serviceName: string,
  res: ServerResponse | Socket,
) {
  // Socket case: koneksi ke client sudah tertutup, tidak bisa response.
  if (res instanceof Socket) {
    res.destroy();
    return;
  }

  const expressRes = res as Response;

  // Kalau headers sudah terkirim, tidak bisa mengubah response lagi —
  // tutup koneksi agar client tidak hang.
  if (expressRes.headersSent) {
    expressRes.end();
    return;
  }

  const errorCode = (error as { code?: string }).code;
  const isTimeout =
    errorCode === "ETIMEDOUT" ||
    errorCode === "ECONNABORTED" ||
    errorCode === "ECONNRESET";

  const displayName = serviceName.toUpperCase();

  expressRes.status(isTimeout ? 504 : 502).json({
    success: false,
    message: isTimeout
      ? `Service ${displayName} sedang tidak merespons (timeout)`
      : `Service ${displayName} sedang tidak dapat dihubungi`,
  });
}

// Siapkan request sebelum diteruskan ke backend:
// 1. Hapus header internal (agar tidak bocor ke backend)
// 2. Set x-request-id dari req.id yang sudah dibuat oleh middleware requestId
//    di app.ts — ini memastikan request id konsisten dari gateway sampai backend.
function prepareProxyRequest(proxyReq: ClientRequest, req: IncomingMessage) {
  stripInternalHeaders(proxyReq);
  proxyReq.setHeader("x-request-id", (req as Request).id);
}

// Konversi prefix gateway (/api/auth) ke path internal service (/rbac/auth).
// Gateway menerima request di /api/auth/login, pathRewrite mengubahnya menjadi
// /rbac/auth/login — prefix didedupe per segment path.
//
// Sebelumnya pathRewrite = prefix.replace(/^\/api/, "/" + nama service).
// Formula itu menghasilkan path ganda untuk service-data-master:
//   /api/master → "/master" + "/master" = /master/master (SALAH)
// Semua service dipasang di /api/<sub-path>, lalu pathRewrite menempel
// "/" + nama service di depannya. Untuk RBAC sub-path-nya auth/users/roles/menus
// (≠ "rbac"), jadi hasilnya benar: /rbac/auth. Tapi sub-path master LITERAL
// "master" — sama dengan nama service — sehingga segment "master" ganda.
//
// Dedupe segment pertama yang sama dengan nama service memperbaiki ini:
//   /api/auth   → segment ["auth"]  → /rbac/auth   (segment ≠ "rbac", dipertahankan)
//   /api/master → segment ["master"] → /master      (segment == "master", dibuang)
function toInternalPath(service: ServiceTarget): string {
  const segments = service.prefix.slice("/api".length).split("/").filter(Boolean);
  const subPaths = segments.filter((segment) => segment !== service.name);
  return ["", service.name, ...subPaths].join("/");
}

/**
 * Mount proxy middleware untuk semua service yang terdaftar di serviceTargets.
 *
 * **Urutan mounting di app.ts sangat penting:**
 *   1. proxy routes (fungsi ini) harus dipanggil SEBELUM express.json()
 *      agar body request masih berupa raw stream yang bisa langsung diteruskan
 *      ke target service tanpa di-parse duluan oleh gateway.
 *   2. http-proxy-middleware meng-handle forwarding body secara internal —
 *      kalau express.json() sudah parse body sebelum proxy, maka body
 *      yang diteruskan ke backend akan kosong (sudah di-consume).
 *
 * Catatan: gateway ini TIDAK menggunakan express.json() secara sengaja.
 * Body request dibiarkan tetap raw stream agar proxy bisa meneruskannya
 * langsung ke service backend tanpa overhead parsing di gateway.
 */
export function setupProxyRoutes(app: Application) {
  for (const service of serviceTargets) {
    app.use(
      service.prefix,
      createProxyMiddleware({
        target: service.target,
        changeOrigin: true,
        // Forward host header ke target agar service tahu host aslinya
        // (berguna kalau service menghasilkan URL berbasis host)
        timeout: env.PROXY_TIMEOUT_MS,
        proxyTimeout: env.PROXY_TIMEOUT_MS,

        // pathRewrite: hapus prefix gateway (/api) dan ganti dengan
        // nama service (/rbac) agar path sesuai yang didengarkan
        // oleh service backend.
        //
        // Contoh:
        //   Gateway request:  GET /api/auth/login
        //   Setelah rewrite:  GET /auth/login
        //   (service RBAC mendengarkan /auth/login)
        pathRewrite: (path) => `${toInternalPath(service)}${path}`,

        on: {
          // error handler dibuat per-iterasi (closure) agar tahu service mana
          // yang gagal direspons — pesan error menyebut nama service yang benar.
          error: (error, _req, res) => handleProxyError(error, service.name, res),
          proxyReq: prepareProxyRequest,
        },
      }),
    );
  }
}