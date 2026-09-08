import { env } from "./env.js";

export interface ServiceTarget {
  name: string;
  baseUrl: string;
  prefix: string;
}

function buildServiceTargets(): ServiceTarget[] {
  const targets: ServiceTarget[] = [];
  if (env.RBAC_SERVICE_URL) targets.push({ name: "rbac", baseUrl: env.RBAC_SERVICE_URL, prefix: "/rbac" });
  if (env.MASTER_SERVICE_URL) targets.push({ name: "master", baseUrl: env.MASTER_SERVICE_URL, prefix: "/master" });
  if (env.DOKUMEN_SERVICE_URL) targets.push({ name: "dokumen", baseUrl: env.DOKUMEN_SERVICE_URL, prefix: "/dokumen" });
  if (env.TRANSAKSI_SERVICE_URL) targets.push({ name: "transaksi", baseUrl: env.TRANSAKSI_SERVICE_URL, prefix: "/transaksi" });
  return targets;
}

export const serviceTargets = buildServiceTargets();