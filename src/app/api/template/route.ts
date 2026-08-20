import { parse } from "kordoc";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const supportedExtensions = new Set(["hwp", "hwpx", "docx", "pdf", "xlsx", "xls"]);
const MAX_FILE_BYTES = 30 * 1024 * 1024;

export async function POST(request: Request) {
  let fileName = "업로드 파일";
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) return NextResponse.json({ error: "분석할 파일을 선택해 주세요." }, { status: 400 });
    fileName = entry.name;
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    if (!supportedExtensions.has(extension)) return NextResponse.json({ fileName, error: `지원하지 않는 파일 형식입니다: .${extension || "unknown"}. HWP, HWPX, DOCX, PDF, XLSX, XLS만 업로드할 수 있습니다.` }, { status: 415 });
    if (entry.size > MAX_FILE_BYTES) return NextResponse.json({ fileName, error: "파일 크기가 30MB를 초과했습니다." }, { status: 413 });

    const buffer = Buffer.from(await entry.arrayBuffer());
    const result = await parse(buffer);
    if (!result.success) return NextResponse.json({ fileName, error: `${result.code ? `[${result.code}] ` : ""}${result.error}` }, { status: 422 });
    const markdown = result.markdown.trim();
    if (!markdown) return NextResponse.json({ fileName, error: "문서에서 분석할 텍스트와 표 구조를 찾지 못했습니다." }, { status: 422 });
    return NextResponse.json({ fileName, analyzed: true, fileType: result.fileType, markdown: markdown.slice(0, 30000), outline: result.outline || [], warnings: result.warnings || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ fileName, error: `문서 분석 중 오류가 발생했습니다: ${message.slice(0, 500)}` }, { status: 500 });
  }
}
