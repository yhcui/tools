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
  database: process.env.NEXT_PUBLIC_DEFAULT_DB_NAME ?? "opportunity",
  username: process.env.NEXT_PUBLIC_DEFAULT_DB_USER ?? "root",
  password: process.env.NEXT_PUBLIC_DEFAULT_DB_PASSWORD ?? "root",
  type: (process.env.NEXT_PUBLIC_DEFAULT_DB_TYPE ?? "mysql") as DbConfig["type"],
};

const DB_ICONS: Record<string, string> = {
  mysql: "MySQL",
  postgres: "PostgreSQL",
  sqlserver: "SQL Server",
  oracle: "Oracle",
};

export default function Home() {
  const [config, setConfig] = useState<DbConfig>(DEFAULT_CONFIG);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

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
    setSuccess("");
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
        setSuccess(`连接成功，找到 ${data.tables.length} 张表`);
      } else {
        setError(data.error ?? "连接失败");
        setTables([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "网络错误");
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
    setSuccess("");
    setExporting(true);
    try {
      const tableInfos = tables
        .filter((t) => selectedTables.has(t.name))
        .map((t) => ({ name: t.name, comment: t.comment }));
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          tableInfos,
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
      setSuccess("导出成功！");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6M9 16h4"/>
          </svg>
          <div>
            <h1 className="text-xl font-semibold">数据库设计文档生成工具</h1>
            <p className="text-blue-100 text-sm">配置数据库连接，一键导出表结构 Word 文档</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Config Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
                <h2 className="font-medium text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  数据库连接
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* DB Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">数据库类型</label>
                  <select
                    value={config.type}
                    onChange={(e) => updateConfig("type", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="sqlserver">SQL Server</option>
                    <option value="oracle">Oracle</option>
                  </select>
                </div>

                {/* Host + Port */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Host</label>
                    <input
                      type="text"
                      value={config.host}
                      onChange={(e) => updateConfig("host", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Port</label>
                    <input
                      type="number"
                      value={config.port}
                      onChange={(e) => updateConfig("port", parseInt(e.target.value, 10))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Database */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Database</label>
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => updateConfig("database", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                    <input
                      type="text"
                      value={config.username}
                      onChange={(e) => updateConfig("username", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={config.password}
                      onChange={(e) => updateConfig("password", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {connecting && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  )}
                  {connecting ? "连接中..." : "连接数据库"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Table List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <h2 className="font-medium text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
                  </svg>
                  选择要导出的表
                </h2>
                {tables.length > 0 && (
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    已选 {selectedTables.size}/{tables.length}
                  </span>
                )}
              </div>
              <div className="p-5">
                {tables.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => toggleSelectAll(true)}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition text-gray-700"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => toggleSelectAll(false)}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition text-gray-700"
                    >
                      取消全选
                    </button>
                  </div>
                )}
                {tables.length === 0 && !connecting && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                    <p className="text-sm">请先连接数据库</p>
                  </div>
                )}
                <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                  {tables.map((t) => (
                    <label
                      key={t.name}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        selectedTables.has(t.name)
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTables.has(t.name)}
                        onChange={() => toggleTable(t.name)}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="font-mono text-sm text-gray-800">{t.name}</span>
                      {t.comment && (
                        <span className="text-xs text-gray-400 truncate">{t.comment}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 13l4 4L19 7"/>
            </svg>
            {success}
          </div>
        )}

        {/* Export Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleExport}
            disabled={exporting || selectedTables.size === 0}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium px-10 py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center gap-2"
          >
            {exporting && (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {exporting ? "生成中..." : `导出为 Word${selectedTables.size > 0 ? `（${selectedTables.size} 张表）` : ""}`}
          </button>
        </div>
      </main>
    </div>
  );
}
