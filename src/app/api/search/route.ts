import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const REQUEST_TIMEOUT_MS = 120_000;
const MAX_SOURCES = 20;

type SearchRequest = {
  openaiKey?: string;
  geminiKey?: string;
  query?: string;
  reportType?: string;
  period?: string;
  sources?: string[];
  templateFileName?: string;
  templateMarkdown?: string;
};

type Source = { title: string; url: string };
type RawResult = { text: string; sources: Source[]; supports: { endIndex: number; sourceUrls: string[] }[] };

const sourceDomains: Record<string, string[]> = {
  "정부·공공기관": ["go.kr", "gov.kr", "gov", "korea.kr"],
  "연구·학술": ["arxiv.org", "nature.com", "sciencedirect.com", "pubmed.ncbi.nlm.nih.gov", "scholar.google.com"],
  뉴스: ["reuters.com", "apnews.com", "yonhapnews.co.kr", "bbc.com", "khan.co.kr", "chosun.com"],
  기업: ["samsung.com", "nvidia.com", "microsoft.com", "google.com", "apple.com", "intel.com"],
  국제기구: ["un.org", "oecd.org", "imf.org", "worldbank.org", "who.int", "wto.org"],
};

function trimError(value: unknown) {
  if (value instanceof Error) return value.message.slice(0, 300);
  return String(value).slice(0, 300);
}

function normalizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    });
    url.hash = "";
    const normalized = url.toString();
    return normalized.endsWith("/") && url.pathname !== "/" ? normalized.slice(0, -1) : normalized;
  } catch {
    return rawUrl;
  }
}

function uniqueSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const url = normalizeUrl(source.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    source.url = url;
    return true;
  }).slice(0, MAX_SOURCES);
}

function addCitations(text: string, supports: { endIndex: number; sourceUrls: string[] }[], sourceIndex: Map<string, number>) {
  let result = text;
  [...supports].sort((a, b) => b.endIndex - a.endIndex).forEach((support) => {
    const numbers = [...new Set(support.sourceUrls.map((url) => sourceIndex.get(normalizeUrl(url))).filter((index): index is number => index !== undefined))];
    if (!numbers.length || support.endIndex < 0 || support.endIndex > result.length) return;
    result = `${result.slice(0, support.endIndex)}${numbers.map((number) => `[${number}]`).join(" ")}${result.slice(support.endIndex)}`;
  });
  return result;
}

function extractOpenAiResult(payload: any): RawResult {
  const text = typeof payload.output_text === "string" ? payload.output_text : "";
  const sources: Source[] = [];
  const supports: RawResult["supports"] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "url_citation" && typeof node.url === "string") {
      sources.push({ title: node.title || node.url, url: node.url });
      if (typeof node.end_index === "number") supports.push({ endIndex: node.end_index, sourceUrls: [node.url] });
    }
    Object.values(node).forEach(walk);
  };
  walk(payload.output);
  return { text, sources: uniqueSources(sources), supports };
}

function extractGeminiResult(payload: any): RawResult {
  const candidate = payload?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part: any) => part.text || "").join("").trim() || "";
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources: Source[] = chunks.map((chunk: any) => ({ title: chunk.web?.title || chunk.web?.uri || "Google Search source", url: chunk.web?.uri })).filter((source: Source) => source.url);
  const supports = (candidate?.groundingMetadata?.groundingSupports || []).map((support: any) => ({ endIndex: support.segment?.endIndex, sourceUrls: (support.groundingChunkIndices || []).map((index: number) => chunks[index]?.web?.uri).filter(Boolean) })).filter((support: any) => typeof support.endIndex === "number" && support.sourceUrls.length);
  return { text, sources: uniqueSources(sources), supports };
}

function buildPrompt(body: SearchRequest) {
  const period = body.period || "최근 30일";
  const selectedSources = body.sources?.length ? body.sources.join(", ") : "전체 검색 소스";
  const reportType = body.reportType === "one-page" ? "보고용 1장 페이퍼" : "현황-문제점-대응방향";
  const templateInstruction = body.templateMarkdown ? `\n\n업로드된 문서 양식(${body.templateFileName || "원본 양식"})을 아래에 제공한다. 이 양식의 제목·항목·문단 순서·표 구조를 최대한 유지하고, 보고서 결과가 같은 구조를 따르도록 작성해줘. 양식에 있는 빈칸·placeholder·지시문은 실제 조사 결과로 채울 위치로 해석해줘. 원본에 없는 항목을 임의로 앞에 추가하지 말고, 필요한 내용은 해당 항목 아래에 작성해줘.\n\n[업로드 양식 분석 결과]\n${body.templateMarkdown.slice(0, 30000)}\n[업로드 양식 끝]` : "";
  return `다음 이슈를 웹 검색으로 조사해 한국어 보고서 초안을 작성해줘. 보고서 유형은 ${reportType}이다. 검색 기간은 ${period}이며, 가능한 경우 해당 기간의 최신 자료를 우선 사용해줘. 검색 소스는 ${selectedSources}로 제한하거나 우선해줘. 검색 결과는 최대 ${MAX_SOURCES}개 출처만 사용해줘. 반드시 다음 형식으로 작성해줘: 제목, 핵심 요약, 현황, 문제점, 대응방향, 효과성, 시사점, 참고 출처. 각 주장과 근거 문장 뒤에는 제공되는 출처 인용을 붙일 수 있도록 명확한 문장 단위로 작성해줘.${templateInstruction}\n\n이슈 입력:\n${(body.query || "").slice(0, 5000)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function callOpenAi(key: string, prompt: string, allowedDomains: string[]): Promise<RawResult> {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt, store: false, tools: [{ type: "web_search", ...(allowedDomains.length ? { filters: { allowed_domains: allowedDomains } } : {}) }] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${payload?.error?.message || "응답 오류"}`);
  return extractOpenAiResult(payload);
}

async function callGemini(key: string, prompt: string): Promise<RawResult> {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${payload?.error?.message || "응답 오류"}`);
  return extractGeminiResult(payload);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SearchRequest;
    const openaiKey = body.openaiKey?.trim();
    const geminiKey = body.geminiKey?.trim();
    if (!openaiKey && !geminiKey) return NextResponse.json({ error: "OpenAI 또는 Gemini API 키가 필요합니다." }, { status: 400 });
    const prompt = buildPrompt(body);
    const allowedDomains = [...new Set((body.sources || []).flatMap((source) => sourceDomains[source] || []))];
    const tasks = await Promise.allSettled([
      openaiKey ? callOpenAi(openaiKey, prompt, allowedDomains) : Promise.reject(new Error("OpenAI API 키가 입력되지 않았습니다.")),
      geminiKey ? callGemini(geminiKey, prompt) : Promise.reject(new Error("Gemini API 키가 입력되지 않았습니다.")),
    ]);
    const rawResults = tasks.map((task) => task.status === "fulfilled" ? task.value : null);
    const allSources = uniqueSources(rawResults.flatMap((result) => result?.sources || []));
    const sourceIndex = new Map(allSources.map((source, index) => [normalizeUrl(source.url), index + 1]));
    const formatResult = (task: PromiseSettledResult<RawResult>, result: RawResult | null) => task.status === "fulfilled" && result ? { ok: true, text: addCitations(result.text, result.supports, sourceIndex) } : { ok: false, error: trimError((task as PromiseRejectedResult).reason) };
    return NextResponse.json({ openai: formatResult(tasks[0], rawResults[0]), gemini: formatResult(tasks[1], rawResults[1]), sources: allSources });
  } catch (error) {
    return NextResponse.json({ error: trimError(error) }, { status: 500 });
  }
}
