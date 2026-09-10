export interface ServiceTarget {
  name: string;
  prefix: string;
  target: string;
}

export const serviceTargets: ServiceTarget[] = [
  { name: "rbac", prefix: "/api/auth", target: process.env.RBAC_SERVICE_URL! },
  { name: "rbac", prefix: "/api/users", target: process.env.RBAC_SERVICE_URL! },
  { name: "rbac", prefix: "/api/roles", target: process.env.RBAC_SERVICE_URL! },
  { name: "rbac", prefix: "/api/menus", target: process.env.RBAC_SERVICE_URL! },
  { name: "master", prefix: "/api/master", target: process.env.MASTER_SERVICE_URL! },
  { name: "dokumen", prefix: "/api/dokumen", target: process.env.DOKUMEN_SERVICE_URL! },
  { name: "transaksi", prefix: "/api/transaksi", target: process.env.TRANSAKSI_SERVICE_URL! },
];