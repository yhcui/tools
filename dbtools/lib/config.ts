import type { DbConfig } from "./types";

export function getDefaultDbConfig(): DbConfig {
  return {
    host: process.env.DEFAULT_DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DEFAULT_DB_PORT || "3306", 10),
    database: process.env.DEFAULT_DB_NAME || "",
    username: process.env.DEFAULT_DB_USER || "root",
    password: process.env.DEFAULT_DB_PASSWORD || "",
    type: (process.env.DEFAULT_DB_TYPE || "mysql") as DbConfig["type"],
  };
}
