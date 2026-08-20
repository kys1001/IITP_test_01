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

## 환경변수

현재 API 키는 UI에서 입력하므로 서버 측 API 키 환경변수는 필요하지 않습니다.
`.env.example`에는 앱 이름 확인용 `NEXT_PUBLIC_APP_NAME`만 문서화되어 있습니다.

실제 API 키는 `.env`나 소스 코드에 저장하지 마세요.

## 빌드

```bash
npm run build
```
