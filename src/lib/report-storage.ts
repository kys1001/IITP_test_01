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

const STORAGE_KEY = "iitp-saved-reports";

export function getSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveReport(report: Omit<SavedReport, "id" | "createdAt">) {
  const saved: SavedReport = { ...report, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...getSavedReports()]));
  return saved;
}

export function deleteSavedReport(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSavedReports().filter((report) => report.id !== id)));
}
