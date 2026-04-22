import type { DbConfig, TableInfo, ColumnInfo } from "./types";

// ── MySQL ──────────────────────────────────────────────────────────────
async function withMysql<T>(
  config: DbConfig,
  fn: (db: any) => Promise<T>
): Promise<T> {
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

async function mysqlTableList(config: DbConfig): Promise<TableInfo[]> {
  return withMysql(config, async (conn) => {
    const [rows] = await conn.execute(
      `SELECT TABLE_NAME as name, IFNULL(TABLE_COMMENT, '') as comment
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [config.database]
    );
    return rows as TableInfo[];
  });
}

async function mysqlTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  return withMysql(config, async (conn) => {
    const [rows] = await conn.execute(
      `SELECT
         COLUMN_NAME as name,
         DATA_TYPE as type,
         IFNULL(CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION) as length,
         IF(COLUMN_KEY = 'PRI', 1, 0) as isPrimaryKey,
         IF(IS_NULLABLE = 'YES', 1, 0) as isNullable,
         COLUMN_DEFAULT as defaultValue,
         IFNULL(COLUMN_COMMENT, '') as comment
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [config.database, tableName]
    );
    return (rows as any[]).map((r) => ({
      ...r,
      isPrimaryKey: !!r.isPrimaryKey,
      isNullable: !!r.isNullable,
    }));
  });
}

// ── PostgreSQL ─────────────────────────────────────────────────────────
async function withPg<T>(
  config: DbConfig,
  fn: (client: any) => Promise<T>
): Promise<T> {
  const { Client } = await import("pg");
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function pgTableList(config: DbConfig): Promise<TableInfo[]> {
  return withPg(config, async (client) => {
    const { rows } = await client.query(
      `SELECT c.relname as name,
              COALESCE(obj_description(c.oid, 'pg_class'), '') as comment
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname = 'public'
       ORDER BY c.relname`
    );
    return rows;
  });
}

async function pgTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  return withPg(config, async (client) => {
    const { rows } = await client.query(
      `SELECT
         a.attname as name,
         pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
         NULL as length,
         CASE WHEN pk.contype = 'p' THEN 1 ELSE 0 END as isPrimaryKey,
         CASE WHEN a.attnotnull THEN 0 ELSE 1 END as isNullable,
         pg_get_expr(ad.adbin, ad.adrelid) as defaultValue,
         COALESCE(col_description(a.attrelid, a.attnum), '') as comment
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
       LEFT JOIN (
         SELECT conrelid, unnest(conkey) as attnum, contype
         FROM pg_constraint WHERE contype = 'p'
       ) pk ON pk.conrelid = c.oid AND pk.attnum = a.attnum
       WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0
       ORDER BY a.attnum`,
      [tableName]
    );
    return rows.map((r: any) => ({
      ...r,
      isPrimaryKey: !!r.isPrimaryKey,
      isNullable: !!r.isNullable,
    }));
  });
}

// ── SQL Server ─────────────────────────────────────────────────────────
async function withSqlserver<T>(
  config: DbConfig,
  fn: (conn: any) => Promise<T>
): Promise<T> {
  const mssql = await import("tedious");
  const Connection = (mssql as any).Connection;
  const Request = (mssql as any).Request;

  return new Promise<T>((resolve, reject) => {
    const conn = new Connection({
      server: config.host,
      authentication: {
        type: "default",
        options: { userName: config.username, password: config.password },
      },
      options: { port: config.port, database: config.database },
    });

    conn.on("connect", (err: Error | null) => {
      if (err) return reject(err);
      fn(conn).then(
        (result) => { conn.close(); resolve(result); },
        (err) => { conn.close(); reject(err); }
      );
    });

    conn.connect();
  });
}

async function sqlserverTableList(config: DbConfig): Promise<TableInfo[]> {
  return withSqlserver(config, async (conn) => {
    const mssql = await import("tedious");
    const Request = (mssql as any).Request;
    const rows: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const request = new Request(
        `SELECT t.name as name, ISNULL(ep.value, '') as comment
         FROM sys.tables t
         LEFT JOIN sys.extended_properties ep
           ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
         ORDER BY t.name`,
        (err: Error | null) => (err ? reject(err) : resolve())
      );
      request.on("row", (row: any) => {
        rows.push(
          Object.fromEntries(
            row.map((col: any) => [col.metadata.colName, col.value])
          )
        );
      });
      conn.execSql(request);
    });
    return rows;
  });
}

async function sqlserverTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  return withSqlserver(config, async (conn) => {
    const mssql = await import("tedious");
    const Request = (mssql as any).Request;
    const TYPES = (mssql as any).TYPES;
    const rows: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const request = new Request(
        `SELECT
           c.name as name,
           TYPE_NAME(c.user_type_id) as type,
           c.max_length as length,
           CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
           c.is_nullable as isNullable,
           ISNULL(CAST(d.definition as varchar(100)), NULL) as defaultValue,
           ISNULL(CAST(ep.value as varchar(500)), '') as comment
         FROM sys.columns c
         JOIN sys.tables t ON t.object_id = c.object_id
         LEFT JOIN sys.default_constraints d ON d.parent_object_id = t.object_id AND d.parent_column_id = c.column_id
         LEFT JOIN (
           SELECT ic.object_id, ic.column_id
           FROM sys.indexes i
           JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
           WHERE i.is_primary_key = 1
         ) pk ON pk.object_id = t.object_id AND pk.column_id = c.column_id
         LEFT JOIN sys.extended_properties ep
           ON ep.major_id = t.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
         WHERE t.name = @tableName
         ORDER BY c.column_id`,
        (err: Error | null) => (err ? reject(err) : resolve())
      );
      request.addParameter("tableName", TYPES.NVarChar, tableName);
      request.on("row", (row: any) => {
        rows.push(
          Object.fromEntries(
            row.map((col: any) => [col.metadata.colName, col.value])
          )
        );
      });
      conn.execSql(request);
    });
    return rows.map((r) => ({
      ...r,
      isPrimaryKey: !!r.isPrimaryKey,
      isNullable: !!r.isNullable,
    }));
  });
}

// ── Oracle ─────────────────────────────────────────────────────────────
async function withOracle<T>(
  config: DbConfig,
  fn: (conn: any) => Promise<T>
): Promise<T> {
  const oracledb = await import("oracledb");
  const conn = await oracledb.getConnection({
    user: config.username,
    password: config.password,
    connectString: `${config.host}:${config.port}/${config.database}`,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

async function oracleTableList(config: DbConfig): Promise<TableInfo[]> {
  return withOracle(config, async (conn) => {
    const result = await conn.execute(
      `SELECT TABLE_NAME as name, NVL(COMMENTS, '') as comment
       FROM ALL_TAB_COMMENTS
       WHERE OWNER = UPPER(USER)
       ORDER BY TABLE_NAME`
    );
    const cols = result.metaData?.map((m: any) => m.name.toLowerCase()) ?? [];
    return (result.rows as any[][]).map((row) =>
      Object.fromEntries(row.map((v, i) => [cols[i], v]))
    );
  });
}

async function oracleTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  return withOracle(config, async (conn) => {
    const result = await conn.execute(
      `SELECT
         ac.COLUMN_NAME as name,
         ac.DATA_TYPE as type,
         ac.DATA_LENGTH as length,
         CASE WHEN cons.constraint_type = 'P' THEN 1 ELSE 0 END as isPrimaryKey,
         CASE WHEN ac.NULLABLE = 'Y' THEN 1 ELSE 0 END as isNullable,
         ac.DATA_DEFAULT as defaultValue,
         NVL(comm.comments, '') as comment
       FROM ALL_TAB_COLUMNS ac
       LEFT JOIN ALL_COL_COMMENTS comm
         ON comm.OWNER = ac.OWNER AND comm.TABLE_NAME = ac.TABLE_NAME AND comm.COLUMN_NAME = ac.COLUMN_NAME
       LEFT JOIN (
         SELECT c.owner, c.table_name, cc.column_name, c.constraint_type
         FROM ALL_CONSTRAINTS c
         JOIN ALL_CONS_COLUMNS cc ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
         WHERE c.constraint_type = 'P'
       ) cons ON cons.owner = ac.OWNER AND cons.table_name = ac.TABLE_NAME AND cons.column_name = ac.COLUMN_NAME
       WHERE ac.OWNER = UPPER(USER) AND ac.TABLE_NAME = :tableName
       ORDER BY ac.COLUMN_ID`,
      { tableName: tableName.toUpperCase() }
    );
    const cols = result.metaData?.map((m: any) => m.name.toLowerCase()) ?? [];
    return (result.rows as any[][]).map((row) => {
      const obj = Object.fromEntries(row.map((v, i) => [cols[i], v]));
      return {
        ...obj,
        isPrimaryKey: !!obj.isPrimaryKey,
        isNullable: !!obj.isNullable,
      };
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────
export async function getTableList(config: DbConfig): Promise<TableInfo[]> {
  switch (config.type) {
    case "mysql":
      return mysqlTableList(config);
    case "postgres":
      return pgTableList(config);
    case "sqlserver":
      return sqlserverTableList(config);
    case "oracle":
      return oracleTableList(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

export async function getTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  switch (config.type) {
    case "mysql":
      return mysqlTableColumns(config, tableName);
    case "postgres":
      return pgTableColumns(config, tableName);
    case "sqlserver":
      return sqlserverTableColumns(config, tableName);
    case "oracle":
      return oracleTableColumns(config, tableName);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
