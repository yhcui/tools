import { NextRequest, NextResponse } from "next/server";
import { getTableColumns } from "@/lib/db-meta";
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
  const tableInfos: { name: string; comment: string }[] = body.tableInfos ?? [];

  try {
    const tables = await Promise.all(
      tableInfos.map(async ({ name, comment }) => ({
        info: { name, comment },
        columns: await getTableColumns(config, name),
      }))
    );

    const buffer = await generateDocx(config.database, tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="db-design.docx"; filename*=UTF-8''${encodeURIComponent(
          config.database
        )}-${encodeURIComponent("数据库设计文档")}.docx`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
