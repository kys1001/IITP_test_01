import { supabase } from "./supabase";

export type SavedProviderResult = { ok: boolean; text?: string; error?: string };

export type SavedReport = {
  id: string;
  title: string;
  query: string;
  reportType: string;
  period: string;
  sources: string[];
  templateFileName?: string;
  createdAt: string;
  openai?: SavedProviderResult;
  gemini?: SavedProviderResult;
  references: { title: string; url: string }[];
};

type SavedReportInput = Omit<SavedReport, "id" | "createdAt">;

function requireSupabase() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return supabase;
}

function fromRow(row: any): SavedReport {
  return { id: row.id, title: row.title, query: row.query || "", reportType: row.report_type, period: row.period, sources: row.sources || [], templateFileName: row.template_file_name || undefined, createdAt: row.created_at, openai: row.openai || undefined, gemini: row.gemini || undefined, references: row.references_data || [] };
}

export async function getSavedReports(): Promise<SavedReport[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("saved_reports").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`저장된 보고서를 불러오지 못했습니다: ${error.message}`);
  return (data || []).map(fromRow);
}

export async function saveReport(report: SavedReportInput): Promise<SavedReport> {
  const client = requireSupabase();
  const { data, error } = await client.from("saved_reports").insert({ title: report.title, query: report.query, report_type: report.reportType, period: report.period, sources: report.sources, template_file_name: report.templateFileName || null, openai: report.openai || null, gemini: report.gemini || null, references_data: report.references }).select().single();
  if (error) throw new Error(`보고서를 저장하지 못했습니다: ${error.message}`);
  return fromRow(data);
}

export async function deleteSavedReport(id: string) {
  const client = requireSupabase();
  const { error } = await client.from("saved_reports").delete().eq("id", id);
  if (error) throw new Error(`보고서를 삭제하지 못했습니다: ${error.message}`);
}
