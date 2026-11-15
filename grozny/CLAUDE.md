# CLAUDE.md — GROZNY 프로젝트 작업 규칙

## 프로젝트
1차 체첸 전쟁 배경 쿼터뷰 생존·분대 게임. 기획은 `docs/`에 있다. 작업 전에 관련 문서를 읽는다.
- 무엇을 만드나: `docs/01_GDD.md`, 수치: `docs/03_SYSTEMS.md`
- 어떻게 만드나: `docs/02_TECH.md`
- 지금 할 일: `docs/04_ROADMAP.md`의 다음 미완료 티켓

## 기술 규칙
- TypeScript strict. `src/sim/`은 DOM, Three.js, `window`, `Math.random`, `Date.now` 사용 금지 (시드 난수와 틱만 사용)
- 렌더러와 UI는 sim 상태를 읽기만 하고, 변경은 `Command`로만 한다
- 밸런스 수치는 `data/*.json`에 둔다. 코드에 하드코딩하지 않는다
- sim 기능은 Vitest 테스트와 함께 작성한다
- 화면이 바뀌는 작업은 Playwright 스크린샷을 `docs/shots/<티켓>.png`로 저장하고 직접 확인한다
- 커밋 전: `npm test` 통과, 콘솔 오류 없음

## 티켓 완료 시
1. `docs/04_ROADMAP.md`에 완료 표시
2. 결정을 바꿨다면 `docs/05_DECISIONS.md`에 이유를 기록
3. 커밋 메시지는 티켓 번호로 시작 (예: `T07 시야 원뿔 + 벽 차단`)

## 콘텐츠 규칙
- `docs/06_RESEARCH.md`의 표현 원칙 체크리스트를 지킨다
- 실존 부대·인물 이름을 쓰지 않는다
- 역사적 사실은 확인되지 않으면 TODO로 표시하고 지어내지 않는다
