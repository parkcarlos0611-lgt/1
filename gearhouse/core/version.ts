// The game's version, in one place (docs/systems/101 section 7: alpha 0.10 was the builder and the drive page as they
// stood; 0.11 to 0.19 the stages S1 to S5 and the polish; 0.20 the company). Shown on the title and the about screen.
export const ALPHA = '0.11';
/** the version as the screens write it */
export const VERSION_NAME = `알파 ${ALPHA}`;
/** what changed in this version, for the about screen (newest first) */
export const CHANGES: readonly string[] = [
  '한 페이지 게임: 타이틀, 차고, 차 빌더, 시험장, 레이스, 설정, 정보가 한 화면에서 이어집니다 (새 창과 새로 불러오기 없음)',
  '불러오기 화면 (진행 막대와 자동차 공학 팁)',
  '타이틀 화면: 턴테이블 위에서 최근 설계가 돕니다',
  '차고: 저장한 설계를 카드로 보고, 열기·복제·삭제·내보내기',
  '시험 주행이 같은 페이지의 주행 화면으로 열리고, 돌아오면 빌더의 같은 단계로 갑니다',
  '주행 중 일시정지 메뉴 (Esc, 휴대폰은 일시정지 버튼): 계속, 다시 시작, 설계로 돌아가기, 설정, 타이틀로',
  '설정 통합: 그래픽, 소리, 조작, 화면, 저장 관리 (전체 내보내기·가져오기·초기화)',
  '메뉴를 키보드로 이동 (화살표, Enter, Esc)',
];
