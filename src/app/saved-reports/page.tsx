"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteSavedReport, getSavedReports, type SavedReport } from "@/lib/report-storage";
import styles from "../page.module.css";

export default function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    setReports(getSavedReports());
  }, []);

  const removeReport = (id: string) => {
    deleteSavedReport(id);
    setReports((current) => current.filter((report) => report.id !== id));
  };

  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}><Link className={styles.brand} href="/"><span className={styles.brandMark}>I</span><span>IITP 평가관리</span></Link><div className={styles.headerNav}><Link className={styles.navLink} href="/">새 보고서 만들기</Link><div className={styles.headerMeta}><span className={styles.liveDot} /><span>이슈 대응·성과 보고서</span></div></div></div></header>
    <main className={styles.main}>
      <section className={styles.savedHero}><p className={styles.eyebrow}>REPORT ARCHIVE</p><h1>저장된 <span>보고서</span></h1><p className={styles.heroCopy}>현재 브라우저에 저장된 보고서 초안을 확인하고 관리합니다.</p></section>
      {reports.length === 0 ? <section className={`${styles.panel} ${styles.emptyState}`}><span className={styles.emptyIcon}>□</span><h2>저장된 보고서가 없습니다.</h2><p>보고서 초안을 생성한 뒤 결과 영역에서 저장하면 이곳에서 확인할 수 있습니다.</p><Link className={styles.primaryLink} href="/">새 보고서 만들기 →</Link></section> : <section className={styles.savedGrid}>{reports.map((report) => <article className={`${styles.panel} ${styles.savedCard}`} key={report.id}><div className={styles.savedCardTop}><span className={styles.savedDate}>{new Date(report.createdAt).toLocaleString("ko-KR")}</span><button type="button" onClick={() => removeReport(report.id)}>삭제</button></div><h2>{report.title}</h2><p className={styles.savedQuery}>{report.query || "입력 키워드 없음"}</p><div className={styles.savedMeta}><span>{report.reportType === "one-page" ? "보고용 1장 페이퍼" : "현황 · 문제점 · 대응방향"}</span><span>{report.period}</span>{report.templateFileName && <span>양식: {report.templateFileName}</span>}</div><div className={styles.savedProviders}>{report.openai?.ok && <span>OpenAI 성공</span>}{report.gemini?.ok && <span>Gemini 성공</span>}{report.references.length > 0 && <span>출처 {report.references.length}개</span>}</div><div className={styles.savedPreview}>{report.openai?.ok ? report.openai.text : report.gemini?.ok ? report.gemini.text : "생성 결과가 저장되지 않았습니다."}</div><details className={styles.savedSources}><summary>참고 출처 보기 ({report.references.length})</summary><ol>{report.references.map((source, index) => <li key={source.url}><span>[{index + 1}]</span> <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ol></details></article>)}</section>}
    </main><footer className={styles.footer}><span>© IITP Evaluation Management</span><span>Draft Studio v0.1</span></footer>
  </div>;
}
