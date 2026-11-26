# GEARHOUSE — 개발 계획 (v0.1)

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어/런타임 | 바닐라 JavaScript (ES Modules), 빌드 없이 실행 가능 | 기존 `cage/` 프로젝트와 동일 — 의존성·다운로드 비용 0 |
| 렌더링 | Canvas2D 기본 + 선택적 WebGL 합성기 | 저사양 호환 + 고급 효과 |
| 데이터 | JSON 콘텐츠(실루엣·부품·기술·국가·연표), 빌드 시 아틀라스 패킹 | 데이터 드리븐, 모딩 용이 |
| 저장 | IndexedDB + JSON 내보내기 | |
| 시뮬레이션 | UI와 분리된 순수 모듈, 시드 RNG, Node에서 헤드리스 실행 가능 | 밸런스 벤치 |
| 테스트 | Node 단위 테스트(공식·조립 규칙) + Playwright 스크린샷 회귀(5뷰 렌더) | |
| 배포 | 정적 웹 → (확장) Electron/Tauri | |

## 2. 폴더 구조 (예정)

```
gearhouse/
  index.html
  src/
    core/        Game.js, Clock.js, RNG.js, SaveManager.js, Migrations.js, Settings.js
    sim/         EngineSim.js, DrivetrainSim.js, VehicleStats.js, Aero.js, Market.js, Economy.js,
                 Research.js, Factory.js, Events.js, CompetitorAI.js
    model/       Platform.js, EngineFamily.js, EngineVariant.js, Body.js, Trim.js, Company.js
    render/      ViewProjector.js (5뷰 투영), LayerStack.js, SilhouetteRaster.js, PanelComposer.js,
                 PaintComposer.js, SpriteOps.js (repeat/radial/slice/path/bone/mirror/tint/pattern),
                 EngineAssembler.js, ChassisAssembler.js, PartRenderer.js, BakeCache.js, GPUCompositor.js
    ui/          MainMenu.js, NewGameWizard.js, GraphicsSettings.js, Dashboard.js, ResearchUI.js,
                 PlatformUI.js, EngineUI.js, DesignStudio.js, TestTrack.js, FactoryUI.js, MarketUI.js, FinanceUI.js
  data/          countries.json, eras.json, timeline.json, tech.json, materials.json, buyers.json
  assets/        (SPRITE_SYSTEM §11 구조)
  tools/
    silhouette-editor/   스플라인·슬롯·패키징 박스 편집기 (웹 툴)
    silgen.js            파라메트릭 실루엣 생성기
    atlas-pack.js        아틀라스 패커
    validate.js          에셋 검증(슬롯이 외곽 안에 있는지, 패키징 박스 겹침, era 범위 등)
    simbench.js          1930→2010 헤드리스 밸런스 벤치
  docs/
```

## 3. 마일스톤

| 단계 | 목표 | 범위 | 완료 기준 |
|---|---|---|---|
| **M0 — 렌더 프로토타입** | 스프라이트 시스템 검증 | 5뷰 투영, 실루엣 3종(E3), 강판 2등급, 도색, 헤드램프·그릴·범퍼·휠, 직렬/V 엔진 조립 | 한 부품을 옮기면 5뷰가 동기화되어 갱신, 직렬4→V8 전환이 원화 추가 없이 동작 |
| **M1 — 설계 루프** | 차 한 대를 끝까지 설계 | 플랫폼·엔진(패밀리/변형)·변속기·디자인 6단계, 통계 계산, 테스트 트랙 | 설계 → 통계 → 수정 반복이 재미있는지 플레이테스트 |
| **M2 — 버티컬 슬라이스** | 경영 루프 연결 | 메인 메뉴·새 게임(국가/연도/자본/연구 규모)·저장/불러오기·그래픽 설정, Era 2개(E3·E4), 공장·시장·재무, 경쟁사 AI 2개, 실루엣 30종 | 1950→1970 20년 플레이 가능 |
| **M3 — 알파** | 전 시대 시스템 완성 | E1~E7 전체 기술 트리·이벤트·규제, 국가 10개+, 실루엣 120종, 실루엣 에디터·생성기 완성 | 1930/1965/2000 어느 해 시작이든 종료까지 진행 가능 |
| **M4 — 베타** | 콘텐츠 & 밸런스 | 실루엣 300종+, 부품 원화 전량, simbench 밸런스, 픽셀 모드, 성능 최적화 | 파산률·점유율 분포 목표 범위, 60fps(디자인 스튜디오) |
| **M5 — 출시** | 폴리싱 | 튜토리얼, 현지화(한/영), 차량 공유(.ghcar) | |
| 이후 | 확장 | 모터스포츠, 인수합병, 라이선스, 2000년대 Era(E8), 모드 지원 | |

M0에서 가장 위험한 가정(“분해된 스프라이트 조합이 충분히 예쁘고 다양해 보이는가”)을 먼저 검증한다.

## 4. 콘텐츠 물량 추정 (출시 기준)

| 에셋 | 수량 | 비고 |
|---|---|---|
| 실루엣 | 300~400 | 생성기 70% + 수작업 다듬기 |
| 패널 셰이딩 맵 | 실루엣 × 5뷰 | 반자동 생성(외곽 기반 그라디언트) + 보정 |
| 소재 타일 | 7 Era × 5등급 ≈ 25 (중복 공유) | |
| 엔진 모듈 | 약 120 (모듈 × 3뷰 × 시대 스타일) | 이것만으로 모든 레이아웃·기통수 커버 |
| 섀시/구동 모듈 | 약 80 | |
| 외장 부품 조각 | 약 600 (조각 × 뷰) | 조합 시 수만 가지 |
| 패턴 타일 | 약 60 | 그릴·렌즈·직물 |
| 도색 팔레트 | 7 Era × 24색 | |
| UI·배경 일러스트 | 쇼룸/공장/본사 Era별 7세트 | |

## 5. 툴 체인

1. **실루엣 에디터**: 스플라인 편집(5뷰 탭), 패널·유리·스타일 라인 영역, 슬롯·패키징 박스 3D 편집, 모프 핸들 가중치, 실시간 부품 미리 끼워보기.
2. **실루엣 생성기 (`silgen.js`)**: 차종 템플릿 × Era 스타일 프리셋 × 랜덤 시드 → 후보 JSON 대량 생성 → 에디터에서 선별.
3. **부품 메타 편집기**: 원화 위에 앵커·9-slice 가이드·패턴 영역 지정.
4. **검증기 (`validate.js`)**: 슬롯이 외곽 내부인지, 패키징 박스가 외곽 투영 안인지, era 범위·태그 오타, 필수 뷰 누락 검사 — CI에서 실행.
5. **스크린샷 회귀**: 기준 차량 20대 × 5뷰 렌더를 Playwright로 비교.

## 6. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 실루엣 수백 종 제작량 | 일정 초과 | 파라메트릭 생성기 + 모프로 체감 다양성 확보, 출시 목표를 Era당 최소 40종으로 단계화 |
| 5뷰 간 형태 불일치 | 어색한 외형 | 단일 파라미터 골격에서 5뷰 스플라인을 함께 생성, 검증기로 치수(길이·폭·높이) 교차 검사 |
| 조립형 스프라이트가 "싸구려" 처럼 보임 | 비주얼 품질 | M0에서 아트 디렉션 확정, 셰이딩 맵·하이라이트 레이어로 통일감, 이음부 마스킹 |
| 시뮬레이션 복잡도 | 이해 어려움 | 통계 툴팁에 "왜 이 값인가" 분해 표시, 튜토리얼 단계적 해금 |
| 성능(경쟁차 수백 대 썸네일) | 프레임 드랍 | 베이크 캐시, 지연 생성, Worker + OffscreenCanvas |
| 역사 고증 민감성 | | 실제 국가·연표는 사용하되 실존 기업·차명·로고 미사용 |
| 참고 게임과의 유사성 | 법적/독창성 | 장르 메커니즘(설계 깊이)만 참고, UI·명칭·수치 모델·아트는 독자 설계 |

## 7. 다음 작업 (M0 착수 체크리스트)

- [ ] `ViewProjector` — 차량 좌표 → 5뷰 투영, 우측면 미러 + 비대칭 오버레이
- [ ] `SilhouetteRaster` — 스플라인 → 알파 마스크, 패널 영역 마스크
- [ ] `SpriteOps` — repeat / radial / 3·9-slice / path strip / bone / mirror / tint / pattern
- [ ] `PanelComposer` + `PaintComposer` — 소재 × 셰이딩 × 도색 × 하이라이트
- [ ] `EngineAssembler` — 직렬·V·수평대향, 장착 방향 재매핑, 바운딩 박스 산출
- [ ] E3 실루엣 3종(4도어 세단·쿠페·픽업) 수작업 제작
- [ ] 부품 최소 세트: 원형 헤드램프, 세로바/에그크레이트 그릴, 크롬 범퍼, 스틸휠+허브캡, 테일램프 2종
- [ ] 디자인 스튜디오 최소 UI: 5뷰 탭 + 4분할, 슬롯 하이라이트, 드래그 배치
