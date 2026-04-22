export interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  type: "mysql" | "postgres" | "sqlserver" | "oracle";
}

export interface TableInfo {
  name: string;
  comment: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length: number | null;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue: string | null;
  comment: string;
}

export interface ConnectResponse {
  success: boolean;
  tables?: TableInfo[];
  error?: string;
}
