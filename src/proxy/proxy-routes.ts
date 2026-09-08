import { createProxyMiddleware } from "http-proxy-middleware";
import type { Application, Request, Response } from "express";
import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { env } from "../config/env.js";
import { serviceTargets, type ServiceTarget } from "../config/services.js";

const INTERNAL_HEADERS = [
  "x-request-id",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
];

function stripInternalHeaders(proxyReq: ClientRequest) {
  for (const header of INTERNAL_HEADERS) {
    proxyReq.removeHeader(header);
  }
}

function handleProxyError(error: Error, _req: IncomingMessage, res: ServerResponse | Socket) {
  if (res instanceof Socket) {
    res.destroy();
    return;
  }
  const expressRes = res as Response;
  if (expressRes.headersSent) {
    expressRes.end();
    return;
  }
  const errorCode = (error as { code?: string }).code;
  const isTimeout = errorCode === "ETIMEDOUT" || errorCode === "ECONNABORTED" || errorCode === "ECONNRESET";
  const reason = error.message || errorCode || "koneksi ditolak";
  expressRes.status(isTimeout ? 504 : 502).json({
    success: false,
    message: isTimeout
      ? "Service tujuan tidak merespons dalam batas waktu (timeout)"
      : `Service tujuan tidak dapat dihubungi: ${reason}`,
  });
}

function prepareProxyRequest(proxyReq: ClientRequest, req: IncomingMessage) {
  stripInternalHeaders(proxyReq);
  proxyReq.setHeader("x-request-id", (req as Request).id);
}

function toInternalPath(service: ServiceTarget): string {
  return service.prefix.replace(/^\/api/, `/${service.name}`);
}

export function setupProxyRoutes(app: Application) {
  for (const service of serviceTargets) {
    app.use(
      service.prefix,
      createProxyMiddleware({
        target: service.target,
        changeOrigin: true,
        timeout: env.PROXY_TIMEOUT_MS,
        proxyTimeout: env.PROXY_TIMEOUT_MS,
        pathRewrite: (path) => `${toInternalPath(service)}${path}`,
        on: {
          error: handleProxyError,
          proxyReq: prepareProxyRequest,
        },
      }),
    );
  }
}