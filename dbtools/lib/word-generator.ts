import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  HeadingLevel,
  PageOrientation,
  WidthType,
  ShadingType,
  BorderStyle,
  TableOfContents,
} from "docx";
import type { TableInfo, ColumnInfo } from "./types";

const HEADER_CELLS = ["序号", "字段", "字段类型", "数据项", "是否必填", "描述"];

function makeCell(text: string, opts?: { bold?: boolean }) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
            size: 21, // 5号字体 (10.5pt * 2)
            font: "宋体",
          }),
        ],
        alignment: opts?.bold ? AlignmentType.CENTER : AlignmentType.LEFT,
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    },
    shading: opts?.bold
      ? { type: ShadingType.SOLID, color: "D6D6D6", fill: "D6D6D6" }
      : undefined,
  });
}

function createColumnTable(columns: ColumnInfo[]): Table {
  const rows: TableRow[] = [];

  // Header
  rows.push(
    new TableRow({
      children: HEADER_CELLS.map((h) => makeCell(h, { bold: true })),
    })
  );

  // Data rows
  columns.forEach((col, i) => {
    const fieldType = col.length !== null ? `${col.type}(${col.length})` : col.type;
    const required = col.isNullable ? "否" : "是";
    const description = col.comment || "";

    rows.push(
      new TableRow({
        children: [
          makeCell(String(i + 1)),
          makeCell(col.name),
          makeCell(fieldType),
          makeCell(description),
          makeCell(required),
          makeCell(description),
        ],
      })
    );
  });

  return new Table({
    rows,
    width: { size: 9500, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
  });
}

export async function generateDocx(
  _databaseName: string,
  tables: { info: TableInfo; columns: ColumnInfo[] }[]
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "数据库设计文档",
                bold: true,
                size: 32,
                font: "宋体",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          new TableOfContents("目录", {
            hyperlink: true,
            headingStyleRange: "1-2",
          }),

          new Paragraph({
            children: [new TextRun({ text: "", break: 1 })],
          }),

          ...tables.flatMap(({ info, columns }, i) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `2.${i + 1}. ${info.comment || info.name}`,
                  bold: true,
                  size: 28, // 四号字体 (14pt * 2)
                  font: "宋体",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),

            createColumnTable(columns),
          ]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
