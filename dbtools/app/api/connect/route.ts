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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "连接失败";
    return NextResponse.json({
      success: false,
      error: message,
    } satisfies ConnectResponse);
  }
}
