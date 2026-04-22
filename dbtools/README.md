# 数据库设计文档生成工具

配置数据库连接，一键导出表结构为 Word 文档。

## 功能特性

- 支持 MySQL、PostgreSQL、SQL Server、Oracle 四种数据库
- 自动读取表名、表注释、字段名、字段类型、字段注释等元数据
- 可选导出部分表或全部表，默认全选
- 生成的 Word 文档包含目录，每个表一个章节，表格样式可配置
- 页面自动填充默认数据库连接信息（可在 `.env.local` 中配置）

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React + TypeScript |
| 数据库驱动 | mysql2、pg、tedious、oracledb |
| Word 生成 | docx |
| 样式 | Tailwind CSS |

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 11

### 安装

```bash
npm install
```

### 配置

复制 `.env.example` 为 `.env.local`，修改默认数据库连接信息：

```env
# Backend defaults
DEFAULT_DB_HOST=127.0.0.1
DEFAULT_DB_PORT=3306
DEFAULT_DB_NAME=opportunity
DEFAULT_DB_USER=root
DEFAULT_DB_PASSWORD=root
DEFAULT_DB_TYPE=mysql

# Frontend defaults（NEXT_PUBLIC_ 前缀必填）
NEXT_PUBLIC_DEFAULT_DB_HOST=127.0.0.1
NEXT_PUBLIC_DEFAULT_DB_PORT=3306
NEXT_PUBLIC_DEFAULT_DB_NAME=opportunity
NEXT_PUBLIC_DEFAULT_DB_USER=root
NEXT_PUBLIC_DEFAULT_DB_PASSWORD=root
NEXT_PUBLIC_DEFAULT_DB_TYPE=mysql
```

> `NEXT_PUBLIC_` 前缀的变量会被前端页面读取，用于自动填充表单。

### 运行

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

开发模式下访问 http://localhost:3000。

## 使用流程

1. 打开页面，检查左侧表单的默认连接信息是否正确
2. 选择数据库类型（切换类型时端口会自动调整）
3. 点击 **连接数据库**
4. 右侧出现表列表，默认全部选中，可手动勾选/取消
5. 点击底部 **导出为 Word** 按钮
6. 浏览器自动下载 `.docx` 文件

## 项目结构

```
├── app/
│   ├── page.tsx              # 主页面（客户端组件）
│   ├── layout.tsx            # 全局布局
│   ├── globals.css           # 全局样式
│   └── api/
│       ├── connect/route.ts  # 连接数据库，返回表列表
│       └── export/route.ts   # 生成并返回 Word 文档
├── lib/
│   ├── types.ts              # 共享 TypeScript 类型
│   ├── config.ts             # 读取环境变量默认配置
│   ├── db-meta.ts            # 数据库元数据查询
│   └── word-generator.ts     # Word 文档生成逻辑
├── public/
│   └── templates/            # 预留：后续 .docx 模板文件
├── .env.example              # 环境变量示例
├── .env.local                # 本地环境变量（不提交）
└── docs/
    └── superpowers/
        ├── specs/            # 设计文档
        └── plans/            # 实现计划
```

## 默认样式说明

Word 文档默认样式：

- 文档标题居中，宋体
- 表标题编号格式：`2.1`、`2.2`、`2.3`…，四号字体，宋体，加粗
- 表格列：序号、字段、字段类型、数据项、是否必填、描述
- 表头灰色背景、居中对齐、五号字体加粗
- 表格内容左对齐，五号字体，宋体
- 表格整体居中，带黑色边框

修改样式在 `lib/word-generator.ts` 中调整。

## 注意事项

- 数据库密码仅在页面内存和 API 请求中传递，不会落盘
- 仅本地使用（localhost），请勿暴露到外网
- `.env.local` 已加入 `.gitignore`，不会提交到版本控制
