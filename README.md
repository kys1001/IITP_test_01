# IITP 이슈 대응·성과 보고서 초안 생성기

Next.js App Router 기반의 보고서 초안 생성기입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 또는 개발 서버가 안내하는 로컬 주소를 엽니다.

## 주요 기능

- OpenAI Web Search와 Gemini Google Search Grounding 연동
- HWP/HWPX/DOCX/PDF/XLSX/XLS 양식 분석 (`kordoc`)
- 업로드 문서의 제목·항목·문단 순서를 보고서 프롬프트에 반영
- API 키는 서버 환경변수가 아니라 현재 브라우저 탭의 `sessionStorage`에 저장
- 생성한 보고서를 Supabase에 저장하고 저장된 보고서 메뉴에서 조회

## 환경변수

현재 API 키는 UI에서 입력하므로 서버 측 API 키 환경변수는 필요하지 않습니다.
Supabase 연결을 위해 `.env.example`의 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정합니다.

Supabase SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)을 한 번 실행해 `saved_reports` 테이블과 임시 프로토타입 정책을 생성합니다. 인증 도입 후에는 해당 정책을 사용자별 RLS 정책으로 교체해야 합니다.

실제 API 키는 `.env`나 소스 코드에 저장하지 마세요.

## 빌드

```bash
npm run build
```
