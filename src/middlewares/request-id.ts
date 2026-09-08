import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  // UUID v4 per request — dipakai untuk tracing dari masuk gateway
  // sampai diproses service tujuan.
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  // Proxy middleware (proxy-routes.ts → prepareProxyRequest) membaca req.id
  // ini dan meneruskannya sebagai header x-request-id ke service tujuan,
  // sehingga request id konsisten di seluruh alur request.
  next();
}