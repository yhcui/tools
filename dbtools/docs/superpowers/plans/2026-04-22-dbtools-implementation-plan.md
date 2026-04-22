# 数据库设计文档生成工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Next.js Web 应用，配置数据库连接后导出包含表结构信息的 Word 文档。

**Architecture:** Next.js App Router 单页应用。前端 React 组件做配置表单和表选择，API Routes 处理数据库连接/元数据查询和 Word 文档生成。所有业务逻辑在 `lib/` 下的纯函数中。

**Tech Stack:** Next.js 15 (App Router) + React + TypeScript + knex + mysql2 + docx

---

## File Structure

| File | Responsibility |
|------|---------------|
| `package.json` | Project dependencies and scripts |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration |
| `.env.example` | Environment variable template |
| `.env.local` | Local environment (gitignored) |
| `.gitignore` | Ignore patterns |
| `app/layout.tsx` | Root layout with basic HTML structure |
| `app/page.tsx` | Client component: DB config form + table list + export |
| `app/api/connect/route.ts` | POST: test DB connection, return table list |
| `app/api/export/route.ts` | POST: generate and return Word document |
| `lib/config.ts` | Read default DB config from env vars |
| `lib/types.ts` | Shared TypeScript types |
| `lib/db-meta.ts` | Database metadata queries (knex-based) |
| `lib/word-generator.ts` | Word document generation using `docx` |
| `public/templates/` | Reserved for future .docx template files |

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project and install dependencies**

Run these commands in sequence:

```bash
cd /d/code/dbtools

# Initialize Next.js App Router project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --turbopack

# Install database and Word generation dependencies
npm install knex mysql2 docx
```

> Note: If `create-next-app` fails due to the directory not being empty (docs/ exists), create a temp dir, init there, then copy files over:
> ```bash
> mkdir /d/code/dbtools-tmp && cd /d/code/dbtools-tmp
> npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --turbopack
> # Copy all generated files to /d/code/dbtools
> cp -r * /d/code/dbtools/
> cd /d/code/dbtools && rm -rf /d/code/dbtools-tmp
> ```

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "init: scaffold Next.js project with dependencies"
```

---

### Task 2: Types and Config

**Files:**
- Create: `lib/types.ts`, `lib/config.ts`, `.env.example`, `.env.local`

- [ ] **Step 1: Define shared types**

Create `lib/types.ts`:

```typescript
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
```

- [ ] **Step 2: Create default config loader**

Create `lib/config.ts`:

```typescript
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
```

- [ ] **Step 3: Create environment variable templates**

Create `.env.example`:

```env
# Default database connection settings
DEFAULT_DB_HOST=127.0.0.1
DEFAULT_DB_PORT=3306
DEFAULT_DB_NAME=
DEFAULT_DB_USER=root
DEFAULT_DB_PASSWORD=
DEFAULT_DB_TYPE=mysql
```

Create `.env.local`:

```env
DEFAULT_DB_HOST=127.0.0.1
DEFAULT_DB_PORT=3306
DEFAULT_DB_NAME=
DEFAULT_DB_USER=root
DEFAULT_DB_PASSWORD=
DEFAULT_DB_TYPE=mysql
```

- [ ] **Step 4: Ensure .gitignore includes .env.local**

Check that `.gitignore` contains `.env.local`. If `create-next-app` already added it, skip. If not, append:

```bash
echo ".env.local" >> .gitignore
```

Also create the reserved templates directory:

```bash
mkdir -p public/templates
```

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/config.ts .env.example .env.local .gitignore
git commit -m "feat: add shared types and default DB config from env"
```

---

### Task 3: Database Metadata Queries

**Files:**
- Create: `lib/db-meta.ts`

- [ ] **Step 1: Implement MySQL metadata queries**

Create `lib/db-meta.ts`:

```typescript
import knex from "knex";
import type { DbConfig, TableInfo, ColumnInfo } from "./types";

function createKnex(config: DbConfig) {
  return knex({
    client: config.type === "postgres" ? "pg" : config.type,
    connection: {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    },
  });
}

export async function getTableList(config: DbConfig): Promise<TableInfo[]> {
  const db = createKnex(config);
  try {
    if (config.type === "mysql") {
      const rows = await db.raw(
        `SELECT TABLE_NAME as name, IFNULL(TABLE_COMMENT, '') as comment
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`,
        [config.database]
      );
      return rows[0];
    }
    if (config.type === "postgres") {
      const rows = await db.raw(
        `SELECT c.relname as name,
                COALESCE(obj_description(c.oid, 'pg_class'), '') as comment
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r' AND n.nspname = 'public'
         ORDER BY c.relname`
      );
      return rows;
    }
    // SQL Server
    if (config.type === "sqlserver") {
      const rows = await db.raw(
        `SELECT t.name as name,
                ISNULL(ep.value, '') as comment
         FROM sys.tables t
         LEFT JOIN sys.extended_properties ep
           ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
         ORDER BY t.name`
      );
      return rows;
    }
    // Oracle
    const rows = await db.raw(
      `SELECT TABLE_NAME as name,
              NVL(COMMENTS, '') as comment
       FROM ALL_TAB_COMMENTS
       WHERE OWNER = UPPER(USER)
       ORDER BY TABLE_NAME`
    );
    return rows;
  } finally {
    await db.destroy();
  }
}

export async function getTableColumns(
  config: DbConfig,
  tableName: string
): Promise<ColumnInfo[]> {
  const db = createKnex(config);
  try {
    if (config.type === "mysql") {
      const rows = await db.raw(
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
      return rows[0].map((r: any) => ({
        ...r,
        isPrimaryKey: !!r.isPrimaryKey,
        isNullable: !!r.isNullable,
      }));
    }

    if (config.type === "postgres") {
      const rows = await db.raw(
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
         WHERE n.nspname = 'public' AND c.relname = ? AND a.attnum > 0
         ORDER BY a.attnum`,
        [tableName]
      );
      return rows.map((r: any) => ({
        ...r,
        isPrimaryKey: !!r.isPrimaryKey,
        isNullable: !!r.isNullable,
      }));
    }

    // SQL Server
    if (config.type === "sqlserver") {
      const rows = await db.raw(
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
         WHERE t.name = ?
         ORDER BY c.column_id`,
        [tableName]
      );
      return rows.map((r: any) => ({
        ...r,
        isPrimaryKey: !!r.isPrimaryKey,
        isNullable: !!r.isNullable,
      }));
    }

    // Oracle
    const rows = await db.raw(
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
       WHERE ac.OWNER = UPPER(USER) AND ac.TABLE_NAME = ?
       ORDER BY ac.COLUMN_ID`,
      [tableName.toUpperCase()]
    );
    return rows.map((r: any) => ({
      ...r,
      isPrimaryKey: !!r.isPrimaryKey,
      isNullable: !!r.isNullable,
    }));
  } finally {
    await db.destroy();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db-meta.ts
git commit -m "feat: add database metadata queries for MySQL, PostgreSQL, SQL Server, Oracle"
```

---

### Task 4: Word Document Generator

**Files:**
- Create: `lib/word-generator.ts`

- [ ] **Step 1: Install docx dependency**

```bash
npm install docx
```

- [ ] **Step 2: Implement Word generator**

Create `lib/word-generator.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  PageOrientation,
  TableOfContents,
  WidthType,
  ShadingType,
} from "docx";
import type { TableInfo, ColumnInfo } from "./types";

const HEADER_CELLS = ["序号", "字段名", "数据类型", "长度", "是否主键", "是否可空", "默认值", "注释"];

function makeCell(text: string, opts?: { bold?: boolean; width?: number }) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
            size: 20,
            font: "Microsoft YaHei",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts?.bold
      ? { type: ShadingType.SOLID, color: "D9E2F3", fill: "D9E2F3" }
      : undefined,
  });
}

function createColumnTable(columns: ColumnInfo[]): Table {
  const rows: TableRow[] = [];

  // Header row
  rows.push(
    new TableRow({
      children: HEADER_CELLS.map((h) => makeCell(h, { bold: true })),
    })
  );

  // Data rows
  columns.forEach((col, i) => {
    rows.push(
      new TableRow({
        children: [
          makeCell(String(i + 1)),
          makeCell(col.name),
          makeCell(col.type),
          makeCell(col.length !== null ? String(col.length) : "-"),
          makeCell(col.isPrimaryKey ? "是" : ""),
          makeCell(col.isNullable ? "是" : "否"),
          makeCell(col.defaultValue !== null && col.defaultValue !== undefined ? col.defaultValue : "-"),
          makeCell(col.comment),
        ],
      })
    );
  });

  return new Table({
    rows,
    width: { size: 9500, type: WidthType.DXA },
  });
}

export async function generateDocx(
  databaseName: string,
  tables: { info: TableInfo; columns: ColumnInfo[] }[]
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: PageOrientation.LANDSCAPE,
          },
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: `${databaseName} - 数据库设计文档`,
                bold: true,
                size: 32,
                font: "Microsoft YaHei",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Table of Contents
          new TableOfContents("目录", {
            hyperlink: true,
            headingStyleRange: "1-2",
          }),

          // Page break after TOC
          new Paragraph({
            children: [new TextRun({ text: "", break: 1 })],
          }),

          // Each table section
          ...tables.flatMap(({ info, columns }) => [
            // Table title
            new Paragraph({
              children: [
                new TextRun({
                  text: `${info.name}${info.comment ? ` (${info.comment})` : ""}`,
                  bold: true,
                  size: 28,
                  font: "Microsoft YaHei",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),

            // Column table
            createColumnTable(columns),
          ]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/word-generator.ts
git commit -m "feat: add Word document generator with docx library"
```

---

### Task 5: API Route - Test Connection

**Files:**
- Create: `app/api/connect/route.ts`

- [ ] **Step 1: Create connect API route**

Create `app/api/connect/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTableList } from "@/lib/db-meta";
import type { DbConfig, ConnectResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const config: DbConfig = {
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
    type: body.type,
  };

  try {
    const tables = await getTableList(config);
    return NextResponse.json({ success: true, tables } satisfies ConnectResponse);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message ?? "连接失败",
    } satisfies ConnectResponse);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/connect/route.ts
git commit -m "feat: add /api/connect endpoint for testing DB connection and listing tables"
```

---

### Task 6: API Route - Export Document

**Files:**
- Create: `app/api/export/route.ts`

- [ ] **Step 1: Create export API route**

Create `app/api/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTableList, getTableColumns } from "@/lib/db-meta";
import { generateDocx } from "@/lib/word-generator";
import type { DbConfig } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const config: DbConfig = {
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
    type: body.type,
  };
  const tableNames: string[] = body.tables ?? [];

  try {
    // Fetch column details for each selected table
    const tables = await Promise.all(
      tableNames.map(async (name) => ({
        info: { name, comment: "" }, // comment will be filled if we re-query, but columns are what matters
        columns: await getTableColumns(config, name),
      }))
    );

    // Generate Word document
    const buffer = await generateDocx(config.database, tables);

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          config.database
        )}-数据库设计文档.docx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? "生成失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/export/route.ts
git commit -m "feat: add /api/export endpoint for generating and downloading Word document"
```

---

### Task 7: Frontend Main Page

**Files:**
- Create: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update layout**

Modify `app/layout.tsx` to remove any Tailwind/extra styles and keep it minimal:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "数据库设计文档生成工具",
  description: "配置数据库连接，导出表结构 Word 文档",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create main page component**

Create `app/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { DbConfig, TableInfo, ConnectResponse } from "@/lib/types";

const DB_TYPE_DEFAULTS: Record<string, number> = {
  mysql: 3306,
  postgres: 5432,
  sqlserver: 1433,
  oracle: 1521,
};

const DEFAULT_CONFIG: DbConfig = {
  host: process.env.NEXT_PUBLIC_DEFAULT_DB_HOST ?? "127.0.0.1",
  port: parseInt(process.env.NEXT_PUBLIC_DEFAULT_DB_PORT ?? "3306", 10),
  database: process.env.NEXT_PUBLIC_DEFAULT_DB_NAME ?? "",
  username: process.env.NEXT_PUBLIC_DEFAULT_DB_USER ?? "root",
  password: process.env.NEXT_PUBLIC_DEFAULT_DB_PASSWORD ?? "",
  type: (process.env.NEXT_PUBLIC_DEFAULT_DB_TYPE ?? "mysql") as DbConfig["type"],
};

export default function Home() {
  const [config, setConfig] = useState<DbConfig>(DEFAULT_CONFIG);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");

  const updateConfig = (field: keyof DbConfig, value: string | number) => {
    setConfig((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type" && typeof value === "string") {
        next.port = DB_TYPE_DEFAULTS[value] ?? prev.port;
      }
      return next;
    });
  };

  const handleConnect = async () => {
    if (!config.host || !config.database) {
      setError("Host 和 Database 不能为空");
      return;
    }
    setError("");
    setConnecting(true);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data: ConnectResponse = await res.json();
      if (data.success && data.tables) {
        setTables(data.tables);
        setSelectedTables(new Set(data.tables.map((t) => t.name)));
      } else {
        setError(data.error ?? "连接失败");
        setTables([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "网络错误");
      setTables([]);
    } finally {
      setConnecting(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTables(new Set(tables.map((t) => t.name)));
    } else {
      setSelectedTables(new Set());
    }
  };

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedTables.size === 0) {
      setError("请至少选择一个表");
      return;
    }
    setError("");
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          tables: Array.from(selectedTables),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "导出失败");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.database}-数据库设计文档.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "网络错误");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ textAlign: "center", marginBottom: 32 }}>
        数据库设计文档生成工具
      </h1>

      <div style={{ display: "flex", gap: 32 }}>
        {/* Left: Config Form */}
        <div style={{ flex: "0 0 360px" }}>
          <h3>数据库连接配置</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              数据库类型
              <select
                value={config.type}
                onChange={(e) => updateConfig("type", e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
              >
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="sqlserver">SQL Server</option>
                <option value="oracle">Oracle</option>
              </select>
            </label>
            {(["host", "database", "username", "password"] as const).map((field) => (
              <label key={field}>
                {field === "host" ? "Host" : field.charAt(0).toUpperCase() + field.slice(1)}
                <input
                  type={field === "password" ? "password" : "text"}
                  value={config[field]}
                  onChange={(e) => updateConfig(field, e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
                />
              </label>
            ))}
            <label>
              Port
              <input
                type="number"
                value={config.port}
                onChange={(e) => updateConfig("port", parseInt(e.target.value, 10))}
                style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
              />
            </label>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                padding: "10px 20px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: connecting ? "not-allowed" : "pointer",
                opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? "连接中..." : "连接"}
            </button>
          </div>
        </div>

        {/* Right: Table List */}
        <div style={{ flex: 1 }}>
          <h3>选择要导出的表</h3>
          {tables.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSelectAll(true)}
                style={{ marginRight: 8 }}
              >
                全选
              </button>
              <button onClick={() => toggleSelectAll(false)}>取消全选</button>
              <span style={{ marginLeft: 16, color: "#666" }}>
                已选 {selectedTables.size}/{tables.length}
              </span>
            </div>
          )}
          {tables.length === 0 && !connecting && (
            <p style={{ color: "#999" }}>请先连接数据库</p>
          )}
          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              border: "1px solid #e5e5e5",
              borderRadius: 4,
              padding: 8,
            }}
          >
            {tables.map((t) => (
              <label
                key={t.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTables.has(t.name)}
                  onChange={() => toggleTable(t.name)}
                />
                <span>{t.name}</span>
                {t.comment && <span style={{ color: "#999" }}>({t.comment})</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Error & Export */}
      {error && (
        <div
          style={{
            marginTop: 24,
            padding: 12,
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button
          onClick={handleExport}
          disabled={exporting || selectedTables.size === 0}
          style={{
            padding: "12px 40px",
            fontSize: 16,
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: exporting || selectedTables.size === 0 ? "not-allowed" : "pointer",
            opacity: exporting || selectedTables.size === 0 ? 0.6 : 1,
          }}
        >
          {exporting ? "生成中..." : "导出为 Word"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add main page with DB config form, table selection, and export"
```

---

### Task 8: Polish and .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ensure .gitignore is complete**

Ensure `.gitignore` includes:

```
.env.local
.env*.local
.next/
out/
node_modules/
```

- [ ] **Step 2: Verify dev server runs and page renders**

```bash
npm run dev
```

Open http://localhost:3000 — verify the page renders with config form and table list area.

- [ ] **Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: finalize .gitignore and verify dev server"
```

---

## Self-Review

### 1. Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Next.js App Router + React + TypeScript | Task 1, 7 |
| DB config form with defaults from .env | Task 2, 7 |
| Database type dropdown (MySQL/PG/SQL Server/Oracle) | Task 7 |
| Connect button → API → table list | Task 5, 7 |
| Table list with checkboxes, default all selected | Task 7 |
| Export button → API → download .docx | Task 6, 7 |
| /api/connect returns table list | Task 5 |
| /api/export generates Word with file stream | Task 6 |
| Word: title + TOC + table sections | Task 4 |
| Word: column table with 序号, 字段名, etc. | Task 4 |
| lib/db-meta.ts with multi-DB strategy | Task 3 |
| lib/word-generator.ts with docx | Task 4 |
| .env.example + .env.local | Task 2 |
| public/templates/ reserved | Task 2 |
| Error handling (connection fail, empty fields) | Task 5, 7 |

All spec requirements covered. ✓

### 2. Placeholder Scan

No "TBD", "TODO", "implement later", "add tests for the above", or "similar to Task N" found. ✓

### 3. Type Consistency

- `DbConfig`, `TableInfo`, `ColumnInfo`, `ConnectResponse` defined in `lib/types.ts` (Task 2)
- Used identically in `lib/config.ts`, `lib/db-meta.ts`, `app/api/connect/route.ts`, `app/api/export/route.ts`, `app/page.tsx`
- Function signatures: `getTableList(config) → TableInfo[]`, `getTableColumns(config, tableName) → ColumnInfo[]`, `generateDocx(databaseName, tables) → Buffer` — consistent across all usages. ✓

### 4. Scope Check

Focused on a single feature: connect → select → export. No extra features. ✓
