# 청사진(blueprint) 요청 목록

각 차량은 게임의 **기본 디자인 틀**이 됩니다. 1순위만 있어도 모든 시대·차체 형식이 채워집니다.

## 파일 규격
- **필수: 측면도(side)** — 정사영(원근 없음), 가능하면 왼쪽 면(앞이 왼쪽). 오른쪽 면이어도 됩니다(자동으로 뒤집음).
- **권장: 평면도(top)** — 폭 형상과 유리 위치.
- 선택: 정면도(front), 후면도(rear) — 트랙 폭, 램프·그릴 위치, 이후 정면·후면 렌더용.
- 해상도: 측면도 가로 2000 px 이상 권장. PNG/JPG, 흰 배경 선화 또는 음영 도면 모두 가능.
- 한 장에 여러 뷰가 있어도 됩니다(뷰 위치만 알려 주세요).
- 파일 이름: `ID_side.png`, `ID_top.png` … (ID는 아래 표의 첫 열).
- 넣을 곳: `motorworks/assets/blueprints/` (또는 대화에 첨부).
- 도면에 휠베이스·전장이 적혀 있으면 그대로, 없으면 제가 제원표 값으로 보정합니다.
- 저작권: 도면 이미지는 개인 참고용으로만 쓰고, 게임에는 **추적한 좌표(mm 수치)만** 저장합니다. 공개 배포하는 페이지에 도면 이미지를 넣지 않습니다.

## 1순위 — 시대 × 차체 형식 기본 틀 (24대)

| ID | 차량 | 연식 | 차체 | 게임에서 쓰는 곳 |
|---|---|---|---|---|
| `ford49` | Ford Custom Fordor | 1949 | 4도어 세단 | 1940s 미국 대중 세단 *(사진 추적본 있음 — 청사진으로 교체)* |
| `beetle` | Volkswagen Type 1 (Beetle) | 1953 | 2도어 세단 | 리어엔진 소형 |
| `ponton` | Mercedes-Benz 180 (W120) | 1955 | 4도어 세단 | 1950s 유럽 세단 |
| `belair` | Chevrolet Bel Air 4-door sedan | 1957 | 4도어 세단 | 1950s 미국 세단 |
| `cad59` | Cadillac Sedan de Ville | 1959 | 4도어 하드톱 | 테일핀 고급차 |
| `mini` | Austin/Morris Mini | 1959 | 2도어 세단 | FF 초소형 |
| `willys` | Willys Jeep / Land Rover Series I | 1948 | 4x4 | 초기 오프로더 |
| `f100` | Ford F-100 | 1956 | 픽업 | 1950s 픽업 |
| `mustang` | Ford Mustang Fastback | 1967–69 | 2도어 패스트백 | 포니카·머슬 |
| `etype` | Jaguar E-Type Coupe | 1961 | 2도어 쿠페 | 1960s 스포츠카 |
| `w114` | Mercedes-Benz W114/115 | 1968 | 4도어 세단 | 1960s 말 유럽 중형 |
| `golf1` | Volkswagen Golf Mk1 | 1974 | 해치백 | 1970s 해치백 |
| `w123` | Mercedes-Benz W123 sedan | 1976 | 4도어 세단 | 1970s 3박스 *(사진 추적본 있음 — 청사진으로 교체)* |
| `v245` | Volvo 245 | 1975 | 왜건 | 왜건 |
| `pony` | Hyundai Pony | 1975 | 패스트백 해치 | 1970s 한국 소형 |
| `countach` | Lamborghini Countach LP400 | 1974 | 미드십 쿠페 | 웨지형 슈퍼카 |
| `f150_79` | Ford F-150 (6th gen) regular cab | 1979 | 픽업 | 1970s–80s 픽업 |
| `taurus` | Ford Taurus | 1986 | 4도어 세단 | 1980s 에어로 세단 |
| `caravan` | Dodge Caravan | 1984 | 미니밴 | 초기 미니밴 |
| `xj` | Jeep Cherokee XJ | 1984 | SUV | 유니바디 SUV |
| `camry92` | Toyota Camry (XV10) | 1992 | 4도어 세단 | 1990s 중형 |
| `prius97` | Toyota Prius (NHW10) | 1997 | 4도어 세단 | 첫 하이브리드 |
| `p996` | Porsche 911 (996) | 1998 | 2도어 쿠페 | 1990s 스포츠카 |
| `model3` | Tesla Model 3 | 2017 | 4도어 패스트백 | 전기 세단 |

## 2순위 — 현대 차종·지역 다양성 (16대)

| ID | 차량 | 연식 | 차체 | 게임에서 쓰는 곳 |
|---|---|---|---|---|
| `corolla66` | Toyota Corolla (E10) | 1966 | 2도어 세단 | 1960s 일본 소형 |
| `civic72` | Honda Civic (1st gen) | 1972 | 해치백 | 1970s 일본 해치 |
| `ae86` | Toyota Corolla Levin AE86 | 1983 | 쿠페 | 1980s 경량 스포츠 |
| `v740` | Volvo 740 sedan | 1984 | 4도어 세단 | 1980s 박스형 |
| `testarossa` | Ferrari Testarossa | 1984 | 미드십 쿠페 | 1980s 슈퍼카 |
| `mx5` | Mazda MX-5 (NA) | 1989 | 로드스터 | 로드스터·컨버터블 |
| `rav4_94` | Toyota RAV4 (XA10) | 1994 | SUV | 1990s 소형 SUV |
| `sonata98` | Hyundai Sonata (EF) | 1998 | 4도어 세단 | 1990s 한국 중형 |
| `golf5` | Volkswagen Golf Mk5 | 2003 | 해치백 | 2000s 해치 |
| `prius04` | Toyota Prius (NHW20) | 2004 | 리프트백 | 2000s 하이브리드 |
| `odyssey` | Honda Odyssey | 2018 | 미니밴 | 현대 미니밴 |
| `camry18` | Toyota Camry (XV70) | 2018 | 4도어 세단 | 현대 중형 |
| `rav4_19` | Toyota RAV4 (XA50) | 2019 | SUV | 현대 SUV |
| `f150_21` | Ford F-150 (14th gen) SuperCrew | 2021 | 픽업 | 현대 픽업 |
| `ioniq5` | Hyundai Ioniq 5 | 2021 | 크로스오버 | 전용 EV 플랫폼 |
| `huracan` | Lamborghini Huracán | 2014 | 미드십 쿠페 | 현대 슈퍼카 |

목록에 없는 차도 같은 규격으로 주시면 템플릿으로 추가합니다.
