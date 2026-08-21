"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { saveReport } from "@/lib/report-storage";

type ReportType = "one-page" | "status";
type SaveState = "idle" | "saved";
type ProviderResult = { ok: boolean; text?: string; error?: string };
type SearchResponse = { openai?: ProviderResult; gemini?: ProviderResult; sources?: { title: string; url: string }[]; error?: string };

const sourceOptions = ["정부·공공기관", "연구·학술", "뉴스", "기업", "국제기구"];
const exampleReport = { title: "AI 반도체 산업 경쟁력 강화 이슈 대응 초안", updated: "2024. 06. 18. 기준", summary: "글로벌 AI 반도체 수요가 빠르게 확대되는 가운데, 국내 기업의 공급망 안정성과 기술 경쟁력 확보가 핵심 과제로 부상하고 있습니다.", points: ["주요국은 AI 반도체 생산·설계 역량 확보를 위한 정책 지원을 확대하고 있음", "국내 팹리스·소부장 기업은 원천기술과 대규모 실증 레퍼런스 확보에 어려움", "민관 협력 기반의 수요 연계형 R&D와 인프라 지원을 병행할 필요"] };

export default function Home() {
  const [query, setQuery] = useState("");
  const [reportType, setReportType] = useState<ReportType>("one-page");
  const [period, setPeriod] = useState("최근 30일");
  const [sources, setSources] = useState(sourceOptions);
  const [isGenerated, setIsGenerated] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [keyError, setKeyError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [templateFileName, setTemplateFileName] = useState("");
  const [templateMarkdown, setTemplateMarkdown] = useState("");
  const [templateStatus, setTemplateStatus] = useState<"idle" | "analyzing" | "complete" | "error">("idle");
  const [templateError, setTemplateError] = useState("");
  const [reportSaveState, setReportSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reportSaveError, setReportSaveError] = useState("");

  useEffect(() => {
    setOpenaiKey(sessionStorage.getItem("iitp-openai-api-key") ?? "");
    setGeminiKey(sessionStorage.getItem("iitp-gemini-api-key") ?? "");
    if (sessionStorage.getItem("iitp-api-keys-saved") === "true") setSaveState("saved");
  }, []);

  const updateKey = (kind: "openai" | "gemini", value: string) => {
    if (kind === "openai") {
      setOpenaiKey(value);
      sessionStorage.setItem("iitp-openai-api-key", value);
    } else {
      setGeminiKey(value);
      sessionStorage.setItem("iitp-gemini-api-key", value);
    }
    sessionStorage.removeItem("iitp-api-keys-saved");
    setSaveState("idle");
    setKeyError("");
  };

  const handleSessionSave = () => {
    sessionStorage.setItem("iitp-openai-api-key", openaiKey);
    sessionStorage.setItem("iitp-gemini-api-key", geminiKey);
    sessionStorage.setItem("iitp-api-keys-saved", "true");
    setSaveState("saved");
    setKeyError("");
  };

  const handleSessionClear = () => {
    sessionStorage.removeItem("iitp-openai-api-key");
    sessionStorage.removeItem("iitp-gemini-api-key");
    sessionStorage.removeItem("iitp-api-keys-saved");
    setOpenaiKey("");
    setGeminiKey("");
    setSaveState("idle");
    setKeyError("");
  };

  const handleReset = () => {
    setQuery("");
    setReportType("one-page");
    setPeriod("최근 30일");
    setSources(sourceOptions);
    setIsGenerated(false);
    setKeyError("");
    setSearchResults(null);
    setSearchError("");
    setReportSaveState("idle");
    setReportSaveError("");
    clearTemplate();
  };

  const handleGenerate = async () => {
    if (!openaiKey.trim() && !geminiKey.trim()) {
      setKeyError("OpenAI 또는 Gemini API 키를 입력하고 세션 저장 후 생성해 주세요.");
      setIsGenerated(false);
      return;
    }
    setKeyError("");
    setSearchError("");
    setIsSearching(true);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openaiKey, geminiKey, query, reportType, period, sources, templateFileName, templateMarkdown }) });
      const payload = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(payload.error || "검색 요청에 실패했습니다.");
      setSearchResults(payload);
      setIsGenerated(Boolean(payload.openai?.ok || payload.gemini?.ok));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "검색 요청 중 오류가 발생했습니다.");
      setIsGenerated(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateFileName(file.name);
    setTemplateMarkdown("");
    setTemplateError("");
    setTemplateStatus("analyzing");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/template", { method: "POST", body: formData });
      const payload = await response.json() as { markdown?: string; error?: string };
      if (!response.ok || !payload.markdown) throw new Error(payload.error || "양식 분석에 실패했습니다.");
      setTemplateMarkdown(payload.markdown);
      setTemplateStatus("complete");
    } catch (error) {
      setTemplateStatus("error");
      setTemplateError(error instanceof Error ? error.message : "양식 분석 중 오류가 발생했습니다.");
    }
  };

  const clearTemplate = () => {
    setTemplateFileName("");
    setTemplateMarkdown("");
    setTemplateStatus("idle");
    setTemplateError("");
  };

  const toggleSource = (source: string) => setSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source]);

  const handleReportSave = async () => {
    if (!searchResults || !isGenerated) return;
    setReportSaveState("saving");
    setReportSaveError("");
    try {
      await saveReport({ title: query.trim() ? `${query.trim().slice(0, 42)} 보고서 초안` : "이슈 대응 보고서 초안", query, reportType, period, sources, templateFileName: templateFileName || undefined, openai: searchResults.openai, gemini: searchResults.gemini, references: searchResults.sources || [] });
      setReportSaveState("saved");
    } catch (error) {
      setReportSaveState("error");
      setReportSaveError(error instanceof Error ? error.message : "보고서를 저장하지 못했습니다.");
    }
  };

  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}><Link className={styles.brand} href="/"><span className={styles.brandMark}>I</span><span>IITP 평가관리</span></Link><div className={styles.headerNav}><Link className={styles.navLink} href="/saved-reports">저장된 보고서</Link><div className={styles.headerMeta}><span className={styles.liveDot} /><span>이슈 대응·성과 보고서</span></div></div></div></header>
    <main className={styles.main}>
      <section className={styles.hero}><div><p className={styles.eyebrow}>REPORT DRAFT STUDIO</p><h1>이슈를 입력하면<br /><span>보고서 초안</span>을 만듭니다.</h1><p className={styles.heroCopy}>키워드나 기사 본문을 바탕으로 핵심 현황과 대응 방향을 빠르게 정리해 보세요.</p></div><div className={styles.heroBadge}><span className={styles.badgeIcon}>✦</span><span>AI 초안 생성</span></div></section>

      <section className={`${styles.panel} ${styles.apiPanel}`} aria-label="API 키 설정"><div className={styles.apiHeader}><div><p className={styles.sectionKicker}>SESSION / API KEYS</p><h2>API 키 설정</h2></div><span className={styles.sessionNotice}>탭을 닫으면 자동으로 삭제됩니다</span></div><div className={styles.apiFields}><label className={styles.apiField}><span>OpenAI API 키</span><input type="password" value={openaiKey} onChange={(event) => updateKey("openai", event.target.value)} placeholder="sk-..." autoComplete="off" /></label><label className={styles.apiField}><span>Gemini API 키</span><input type="password" value={geminiKey} onChange={(event) => updateKey("gemini", event.target.value)} placeholder="AIza..." autoComplete="off" /></label></div><div className={styles.apiFooter}><span className={`${styles.saveIndicator} ${saveState === "saved" ? styles.saveIndicatorActive : ""}`}><span />{saveState === "saved" ? "현재 세션에 저장됨" : "아직 저장되지 않음"}</span><div className={styles.sessionButtons}><button type="button" onClick={handleSessionSave}>세션 저장</button><button type="button" onClick={handleSessionClear}>세션 비우기</button></div></div>{keyError && <p className={styles.keyError} role="alert">{keyError}</p>}<p className={styles.apiHint}>API 키는 이 브라우저 탭의 sessionStorage에만 저장되며 서버 로그나 보고서 결과에 표시되지 않습니다.</p></section>

      <section className={`${styles.panel} ${styles.templatePanel}`} aria-label="문서 양식 분석"><div className={styles.apiHeader}><div><p className={styles.sectionKicker}>TEMPLATE / ANALYZE</p><h2>문서 양식 분석</h2></div><span className={styles.sessionNotice}>HWP · HWPX · DOCX · PDF · XLSX · XLS</span></div><label className={styles.uploadDrop}><input type="file" accept=".hwp,.hwpx,.docx,.pdf,.xlsx,.xls" onChange={handleTemplateUpload} /><span className={styles.uploadIcon}>↥</span><span><strong>{templateStatus === "analyzing" ? "문서 양식 분석 중…" : "분석할 문서 양식을 선택하세요"}</strong><small>제목·항목·문단 순서를 분석해 보고서 프롬프트에 반영합니다.</small></span><em>파일 선택</em></label>{templateFileName && <div className={styles.templateStatus}><span className={templateStatus === "complete" ? styles.templateOk : templateStatus === "error" ? styles.templateFail : styles.templateWorking}>{templateStatus === "complete" ? "분석 완료" : templateStatus === "error" ? "분석 실패" : "분석 중"}</span><strong>{templateFileName}</strong>{templateStatus === "complete" && <small>보고서 생성 시 이 양식 구조를 따릅니다.</small>}{templateStatus === "error" && <p role="alert">{templateError}</p>}<button type="button" onClick={clearTemplate}>제거</button></div>}<p className={styles.apiHint}>파일은 분석 후 서버에 보관하지 않으며, 분석된 Markdown 구조만 현재 화면에서 보고서 요청에 포함합니다.</p></section>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="보고서 생성 조건"><div className={styles.panelHeader}><div><p className={styles.sectionKicker}>01 / INPUT</p><h2>이슈 정보 입력</h2></div><span className={styles.step}>STEP 1</span></div>
          <label className={styles.label} htmlFor="query">키워드 또는 뉴스 기사 본문</label><textarea id="query" className={styles.textarea} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'예: AI 반도체 산업 경쟁력 강화 방안\n\n기사 본문을 붙여넣거나, 분석할 이슈 키워드를 입력해 주세요.'} rows={7} /><div className={styles.fieldHint}><span>최대 5,000자</span><span>{query.length.toLocaleString()}자</span></div>
          <div className={styles.divider} /><p className={styles.sectionKicker}>02 / FORMAT</p><fieldset className={styles.fieldset}><legend className={styles.label}>보고서 유형</legend><div className={styles.choiceGrid}>{([["one-page", "보고용 1장 페이퍼", "핵심만 한눈에 요약"], ["status", "현황 · 문제점 · 대응방향", "구조화된 상세 분석"]] as const).map(([value, title, desc]) => <label key={value} className={`${styles.choice} ${reportType === value ? styles.choiceActive : ""}`}><input type="radio" name="reportType" checked={reportType === value} onChange={() => setReportType(value)} /><span><strong>{title}</strong><small>{desc}</small></span><i>✓</i></label>)}</div></fieldset>
          <div className={styles.divider} /><p className={styles.sectionKicker}>03 / SOURCES</p><div className={styles.filterRow}><fieldset className={styles.filterBlock}><legend className={styles.label}>검색 기간</legend><div className={styles.selectWrap}><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="검색 기간"><option>최근 7일</option><option>최근 30일</option><option>최근 1년</option><option>전체 기간</option></select><span>⌄</span></div></fieldset><fieldset className={styles.filterBlock}><legend className={styles.label}>검색 소스</legend><div className={styles.checkGrid}>{sourceOptions.map((source) => <label key={source} className={styles.checkLabel}><input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} /><span>{source}</span></label>)}</div></fieldset></div>
          <button className={styles.generateButton} onClick={handleGenerate} disabled={isSearching} type="button"><span>{isSearching ? "웹 자료 검색 중…" : "보고서 초안 생성"}</span><span className={styles.arrow}>→</span></button><button className={styles.resetButton} onClick={handleReset} type="button">입력·결과 리셋 <span>API 키는 유지됩니다</span></button><p className={styles.disclaimer}>OpenAI Web Search와 Gemini Google Search 결과를 병렬로 수집합니다. 최대 20개 출처를 사용합니다.</p>
        </section>
        <section className={`${styles.panel} ${styles.resultPanel}`} aria-label="생성 결과"><div className={styles.panelHeader}><div><p className={styles.sectionKicker}>RESULT / PREVIEW</p><h2>생성 결과</h2></div><span className={`${styles.status} ${isGenerated ? styles.statusReady : ""}`}><span />{isSearching ? "검색 중" : isGenerated ? "생성 완료" : "예시 결과"}</span></div>
          {searchError && <p className={styles.keyError} role="alert">{searchError}</p>}
          {searchResults ? <div className={styles.providerResults}>{([['openai', 'OpenAI Web Search'], ['gemini', 'Gemini Google Search']] as const).map(([key, label]) => { const result = searchResults[key]; return <article className={styles.providerCard} key={key}><div className={styles.providerHeader}><strong>{label}</strong><span className={result?.ok ? styles.providerOk : styles.providerFail}>{result?.ok ? "성공" : "실패"}</span></div>{result?.ok ? <p className={styles.providerText}>{result.text}</p> : <p className={styles.providerError}>{result?.error || "이 API 결과가 없습니다."}</p>}</article>; })}<div className={styles.sourcesBox}><p className={styles.resultLabel}>참고 출처</p>{searchResults.sources?.length ? <ol>{searchResults.sources.map((source, index) => <li key={source.url}><span>[{index + 1}]</span> <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ol> : <p className={styles.resultText}>검색 결과에서 추출된 출처가 없습니다.</p>}</div></div> : <div className={styles.resultCard}><div className={styles.resultTopline}><span>ISSUE RESPONSE BRIEF</span><span>{exampleReport.updated}</span></div><h3>{exampleReport.title}</h3><div className={styles.resultSummary}>{exampleReport.summary}</div><div className={styles.resultSection}><p className={styles.resultLabel}>핵심 포인트</p><ul>{exampleReport.points.map((point) => <li key={point}>{point}</li>)}</ul></div><div className={styles.resultSection}><p className={styles.resultLabel}>대응 방향</p><p className={styles.resultText}>산업 현장의 수요를 반영한 대규모 실증과 인프라 공동 활용을 지원하고, 핵심 기술의 국내 자립도를 높이기 위한 단계별 투자 전략을 마련합니다.</p></div><div className={styles.resultFooter}><span>초안 · 검토 필요</span><span>01 / 01</span></div></div>}
          {reportSaveError && <p className={styles.keyError} role="alert">{reportSaveError}</p>}<div className={styles.resultActions}><button type="button" onClick={handleReportSave} disabled={!isGenerated || reportSaveState === "saved" || reportSaveState === "saving"}>{reportSaveState === "saving" ? "저장 중…" : reportSaveState === "saved" ? "저장 완료" : "보고서 저장"}</button><button type="button">복사하기</button><button type="button">다운로드 준비 중</button></div>
        </section>
      </div>
    </main><footer className={styles.footer}><span>© IITP Evaluation Management</span><span>Draft Studio v0.1</span></footer>
  </div>;
}
