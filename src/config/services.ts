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
  // TODO: tambahkan service-data-master di sini
  // TODO: tambahkan service-dokumen di sini
  // TODO: tambahkan service-transaksi di sini
];