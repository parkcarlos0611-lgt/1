# GEARHOUSE (가제) — 자동차 회사 경영 + 차량 개발 시뮬레이션

> 1930~2000년 사이 원하는 해에 자동차 회사를 세워, 엔진·파워트레인·플랫폼을 설계하고
> 시대별 실루엣 위에 강판·기계부품·외장부품을 한 겹씩 얹어 차를 "조립"해 파는 2D 경영 게임.

엔지니어링 시뮬레이션 장르(예: *Automation*)의 설계 깊이에서 영감을 받았지만,
시스템 구성·UI·아트·명칭은 모두 이 프로젝트 고유의 것으로 만든다. 외부 게임의 에셋/데이터는 쓰지 않는다.

## 테스트판

`play.html` — 1930~1949 플레이 가능한 테스트 (픽셀 UI). 로컬: `python3 -m http.server` 후 `/play.html`. 엔진 모델 보정 리포트: `node sim/calibrate.mjs`

## 기획 문서

| 문서 | 내용 |
|---|---|
| [docs/GDD.md](docs/GDD.md) | 게임 디자인 문서: 메인 메뉴, 새 게임 설정, 시대 구분, 플랫폼/엔진/파워트레인/디자인 개발, 시뮬레이션 공식, 연구, 경영, UI |
| [docs/SPRITE_SYSTEM.md](docs/SPRITE_SYSTEM.md) | 아트·렌더링 명세: 5뷰 좌표계, 실루엣 에셋 구조, 레이어 스택, 강판/도색 합성, 모듈형 엔진 스프라이트, 스프라이트 재활용 기법, 데이터 포맷 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 개발 계획: 기술 스택, 폴더 구조, 마일스톤, 콘텐츠 물량, 툴 체인, 리스크 |
| [docs/E1_1930S_PLAN.md](docs/E1_1930S_PLAN.md) | 1930년대 제작 계획: 실차 복제 4종, 타이어 규격, VehicleDef(프레임·엔진·구동), 외장 프롭 224종 카탈로그, 단계별 보고 |
| [docs/E1_DESIGN_LIMITS_AND_SOURCING.md](docs/E1_DESIGN_LIMITS_AND_SOURCING.md) | 박스형/유선형 선택, 연도별 곡률·비율 한계, 자료 수급 보고 |
| [docs/REFERENCE_ANALYSIS_3.md](docs/REFERENCE_ANALYSIS_3.md) | 3차: 정면 타이어 단면, 유선형 2종 측정, 엔진룸·하부 패턴, 승인된 자료 출처 |
| [docs/REFERENCE_ANALYSIS_2.md](docs/REFERENCE_ANALYSIS_2.md) | 2차 레퍼런스 분석: 범퍼·하부·창문·장식 패턴, 디테일 축척 12.5mm/px, 자료 요청 목록 |
| [docs/E1_ASSEMBLY_TEST.md](docs/E1_ASSEMBLY_TEST.md) | 조립 테스트: 프롭 무작위 조합 1930년대 차량 20대, 슬롯 호환 규칙, 디자인 점수 |
| [docs/E2_REVISION_PLAN.md](docs/E2_REVISION_PLAN.md) | 1940년대 수정 계획(창문·적재함·군용) + 섀시·파워트레인 결합 계획, 자료 요청 |
| [docs/STAGE3_PLAN.md](docs/STAGE3_PLAN.md) | 3단계: 엔진·변속기 시스템 구현, 새 자료 분석, 차량 디자인 체계화, 테스트판 |
| [docs/ENGINE_DRIVETRAIN_SYSTEM_PLAN.md](docs/ENGINE_DRIVETRAIN_SYSTEM_PLAN.md) | 엔진·변속기·구동계 설계 시스템 (검증된 설계 시뮬 구조 참고 + 역사 제원 보정) |
| [docs/REFERENCE_ANALYSIS_E2B.md](docs/REFERENCE_ANALYSIS_E2B.md) | 1940년대 추가 자료: 픽업 치수, 프레임·스텝다운, 엔진 8종, 자동변속기 컷어웨이 |
| [docs/TECH_PROGRESSION_PLAN.md](docs/TECH_PROGRESSION_PLAN.md) | 기술 계승·노후화 평가 (최근 시대일수록 엄격) |
| [docs/REFERENCE_ANALYSIS_E2.md](docs/REFERENCE_ANALYSIS_E2.md) | 1940년대 레퍼런스 실측 10종, 군용차 모델링 원칙 |
| [docs/E2_1940S_PLAN.md](docs/E2_1940S_PLAN.md) | 1940년대 계획: 전시·전후 처리, 폰툰 디자인 언어, 세그먼트별 복제 대상, 자료 요청 |
| [docs/REFERENCE_ANALYSIS.md](docs/REFERENCE_ANALYSIS.md) | 1930년대 블루프린트 측정 → 휠베이스 비율 규칙, 생성기 구조 규칙 |
| [docs/PIXEL_ART_PIPELINE.md](docs/PIXEL_ART_PIPELINE.md) | Claude Code 픽셀아트 생성 계획: 픽셀 스케일, 생성 방식 4종(DSL·절차적·벡터 래스터·텍스처), 품질 규칙·린터, 작업 루프, 단계별 계획 |

## 한 줄 요약 (핵심 결정 사항)

1. **하나의 차량 데이터 → 5개 정사영 뷰** (좌측면·우측면·탑·프론트·리어). 부품은 차량 좌표(mm)에 한 번만 배치하고 각 뷰는 투영해서 그린다.
2. **실루엣 = 마스크 + 슬롯** 에셋. 강판 소재 텍스처는 실루엣 마스크 안에 클리핑되고, 모든 부품은 실루엣이 정의한 슬롯/영역 안에서만 배치된다.
3. **스프라이트는 조립 단위로 분해**: 실린더 1기통 모듈을 N번 반복해 직렬/V/수평대향 엔진을 만들고, 스포크 1개를 회전 반복해 휠을 만드는 식으로 적은 원화로 수천 가지 조합을 만든다.
4. **시대 1930~2000을 7개 Era로 나누고**, 실루엣·소재·기술·색상 팔레트를 Era 태그로 해금한다.
5. 기존 `cage/` 프로젝트와 동일한 **바닐라 JS + Canvas2D (선택적 WebGL)** 스택, 데이터 드리븐 JSON 콘텐츠.

## 샘플 이미지 (`samples/`, `node tools/pixel/samples.mjs` · `samples30.mjs`로 재생성)

- `e1_vehicles_xray_x4.png`: 1930년대 복제 차량 4종 외관 + X-ray(프레임·서스·엔진·변속·연료탱크) — `node tools/pixel/samplesE1.mjs`
- `e1_town_sedan_views_x4.png`: 1930 타운 세단 4뷰 (타이어 규격 반영)
- `e1_design_language_x3.png`: 박스형/유선형 × 1931/1935/1939, 슬라이더 극단값 클램프, 금지 조합 대체 — `node tools/pixel/samplesGen.mjs`
- `e1_detail_before_after.png`, `e1_detail_front_rear.png`: 디테일 축척(12.5mm/px) 사실 묘사 — `node tools/pixel/samplesD.mjs`
- `e1_streamline_detail.png`: 1934 에어플로형 세단 / 1937 V 그릴 패스트백 쿠페 (12.5mm/px)
- `e1_engine_sv_detail.png`: 사이드밸브 직렬4 디테일 (엔진룸 사진 기반, 5mm/px)
- `e1_underbody.png`: 하부 평면 뷰 / `e1_towncar_views.png`: 1934 V12 타운카 3뷰 / `e1_streamline_front_rear.png`: 유선형 정면·후면
- `e1_props_batchA.png` + `data/props_e1_batchA.json`: 1930년대 외장 프롭 배치 A 84종 — `node tools/pixel/samplesProps.mjs`
- `e1_assembly_test.png`: 조립 테스트 20대 — `node tools/pixel/samplesAsm.mjs`
- `e1_assembly_3view.png`: 조립 차량 3뷰 / `e2_generator_preview.png`: 1940년대 생성기 미리보기 — `node tools/pixel/samplesE2.mjs`
- `e2_civil.png`: 1940년대 민수 8종(창 v2·적재함 모듈) / `e2_military.png`: 군용 v2 4x4·6x6 + 캡·장비 변형 — `node tools/pixel/samplesE2civ.mjs`, `samplesE2mil.mjs`
- `e2_powertrain.png`: 1940년대 엔진·변속기 (5mm/px) — `samplesE2pt.mjs` / `e2_chassis_integration.png`: X-ray·분해도·하부 뷰 — `samplesE2mech.mjs`
- `cars_1930s_side_x4.png`: 1930 업라이트 세단 / 1933 고급 카브리올레 / 1937 유선형 (블루프린트 비율 기반)
- `car1930_views_x4.png`: 1930 세단 좌·우·정면·후면
- `cars_side_x4.png`, `car57_views_x4.png`: 시대별 초기 샘플 (1950년대 이후는 아직 레퍼런스 미반영)
- `props_s2_x2.png`: 엔진(모듈 반복·뱅크 회전), 휠, 램프, 그릴, 강판 등급, 스프링, 탱크
