# 数据库设计文档生成工具 - 设计文档

## 概述

一个本地开发的 Web 工具，通过浏览器配置数据库连接信息，导出数据库表结构为 Word 文档。每个表在 Word 中为一个表格，包含字段详情（序号、字段名、类型、长度、是否主键、是否可空、默认值、注释）。

## 技术栈

- **前端/框架**：Next.js (App Router) + React + TypeScript
- **数据库连接**：`knex`（多数据库支持）+ 各数据库驱动（`mysql2`、`pg`、`tedious`、`oracledb`）
- **Word 生成**：`docx`（纯 JS，支持表格、样式、目录）
- **UI 组件**：原生 HTML + CSS，不引入额外 UI 库
- **配置**：`.env.local` 存储默认数据库连接信息

## 项目结构

```
dbtools/
├── app/
│   ├── page.tsx              # 主页面：数据库配置 + 表选择 + 导出
│   ├── layout.tsx            # 全局布局
│   └── api/
│       ├── connect/
│       │   └── route.ts      # 测试数据库连接
│       └── export/
│           └── route.ts      # 生成并返回 Word 文档
├── lib/
│   ├── config.ts             # 读取 .env.local 中的默认数据库配置
│   ├── db-meta.ts            # 数据库元数据查询（表列表、字段信息、索引等）
│   └── word-generator.ts     # Word 文档生成逻辑
├── config/
│   └── default.ts            # 默认配置常量
├── public/
│   └── templates/            # 预留：后续 .docx 模板文件存放
├── .env.example              # 环境变量示例
├── .env.local                # 本地环境变量（不提交到 git）
├── package.json
├── next.config.ts
└── tsconfig.json
```

## 功能设计

### 1. 主页面 (`/`)

**页面布局**：

- 左侧：数据库连接配置表单
  - Host（默认值来自 `.env.local`）
  - Port（默认值来自 `.env.local`）
  - Database（默认值来自 `.env.local`）
  - Username（默认值来自 `.env.local`）
  - Password（默认值来自 `.env.local`）
  - 数据库类型下拉框（MySQL / PostgreSQL / SQL Server / Oracle）
  - "连接"按钮
- 右侧：表列表（连接成功后显示）
  - 全选/取消全选按钮
  - 表名 + 表注释的列表，带复选框
  - 默认全部选中
- 底部："导出为 Word"按钮

**交互流程**：

1. 页面加载时自动填充默认配置
2. 用户点击"连接"→ 调用 `POST /api/connect` → 返回表列表
3. 表列表展示，用户可勾选要导出的表
4. 点击"导出"→ 调用 `POST /api/export` → 下载 `.docx` 文件

### 2. API: 测试连接 (`POST /api/connect`)

**请求体**：
```json
{
  "host": "127.0.0.1",
  "port": 3306,
  "database": "mydb",
  "username": "root",
  "password": "123456",
  "type": "mysql"
}
```

**响应体**：
```json
{
  "success": true,
  "tables": [
    { "name": "users", "comment": "用户表" },
    { "name": "orders", "comment": "订单表" }
  ]
}
```

### 3. API: 导出文档 (`POST /api/export`)

**请求体**：同连接 API + 额外字段：
```json
{
  "host": "...",
  "type": "mysql",
  "tables": ["users", "orders"]  // 要导出的表名列表
}
```

**响应**：`Content-Disposition: attachment; filename="数据库设计文档.docx"` 的文件流

### 4. Word 文档结构

- **文档标题**："{数据库名} - 数据库设计文档"
- **目录**：自动生成，链接到各表章节
- **每个表一个章节**：
  - 标题：表名 + 表注释
  - 表格列：序号(从1开始)、字段名、数据类型、长度、是否主键、是否可空、默认值、注释

### 5. 数据库元数据查询 (`lib/db-meta.ts`)

通过 `knex` 连接数据库，查询各数据库的 `information_schema` 或等价系统表：

- `getTableList(db)` → `{ name, comment }[]`
- `getTableColumns(db, tableName)` → `{ name, type, length, isPrimaryKey, isNullable, defaultValue, comment }[]`
- `getTableIndexes(db, tableName)` → （预留）

每个数据库类型有不同的 SQL 实现，通过策略模式封装。

### 6. 默认配置 (`lib/config.ts`)

```typescript
export const defaultDbConfig = {
  host: process.env.DEFAULT_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DEFAULT_DB_PORT || "3306"),
  database: process.env.DEFAULT_DB_NAME || "",
  username: process.env.DEFAULT_DB_USER || "root",
  password: process.env.DEFAULT_DB_PASSWORD || "",
  type: process.env.DEFAULT_DB_TYPE || "mysql",
};
```

`.env.example` 提供模板，`.env.local` 存放实际值（不提交）。

### 7. Word 生成器 (`lib/word-generator.ts`)

使用 `docx` 库构建文档：

1. 创建 `Document` 实例，设置默认字体和页面边距
2. 添加标题段（一级标题）
3. 添加目录（`docx` 的 `TableOfContents`）
4. 遍历每个表：
   - 添加表标题段（二级标题）
   - 创建表格，表头行：序号、字段名、数据类型、长度、是否主键、是否可空、默认值、注释
   - 每行数据填充，序号从 1 递增
   - 设置表格边框和列宽
5. 返回 `Packer.toBuffer()` 供下载

### 8. Word 模板扩展（预留）

`public/templates/` 目录预留。后续可支持：
- 用户选择模板文件上传
- 使用 `docxtemplater` 替换当前代码生成方式
- 当前实现不阻塞此扩展

## 错误处理

- 连接失败：API 返回 `{ success: false, error: "连接失败原因" }`，前端显示错误提示
- 表不存在：跳过并记录警告
- Word 生成失败：返回 500 + 错误信息
- 前端表单校验：host/port/database 不能为空

## 安全考虑

- 数据库密码仅在前端内存和 API 请求中传递，不落盘
- `.env.local` 加入 `.gitignore`
- 仅本地使用（localhost），不暴露到外网

## 开发命令

```bash
npm run dev      # 开发服务器 (localhost:3000)
npm run build    # 生产构建
npm run start    # 生产服务器
```
