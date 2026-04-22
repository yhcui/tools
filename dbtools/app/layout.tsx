import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-gray-50 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
