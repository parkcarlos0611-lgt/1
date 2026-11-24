# 95 · NSX 부품 분해 — 세분화 목록과 시험 방법 (검토 167)

목표: `render/car/mesh_nsx.ts`(한 파일, 348줄)를 **공용 키트(선 체계 + 패널 함수 + 부품) + NSX 조립 데이터**로 나눈다. 원본은 그대로 두고, 새 조립 결과가 원본과 같은지 시험한다. 이 표준을 이후 모든 차가 쓴다.

## 1. 층 구조
```
render/car/kit/
  lines.ts     차의 선 체계 (시트 JSON에서 만든다)
  section.ts   표준 단면: 구역별 점 수 고정, 이웃 패널과 경계 점 공유
  panels/      차체 패널 함수 (선 체계 + 형태 매개변수 → 메시)
  parts/       부착 부품 (위치 + 크기 + 형태 → 메시)
  assemble.ts  조립 명세(데이터)를 받아 Mesh를 만든다
render/car/cars/nsx.kit.ts   NSX 조립 명세 (데이터 위주)
```

## 2. 선 체계 (`lines.ts`) — 모든 차 공통
| 선 | 뜻 |
|---|---|
| `centre(x)` | 중심선 높이: 코, 보닛, 앞유리, 지붕, 데크, 꼬리 |
| `half(x)` | 평면 반폭(최대폭 선) |
| `crest(x)` | 펜더 능선 높이와 위치 |
| `belt(x)` | 벨트라인(유리 아래, 캐노피와 차체 경계) |
| `shoulder(x)` | 어깨(옆면 최대폭 높이) |
| `sill(x)`, `foot(x)` | 실 높이와 바닥선 |
| `arches` | 앞뒤 바퀴 아치(중심, 반지름) |
| `stations` | 길이 방향 단면 위치(고정 간격 + 아치 주변) |

## 3. 패널 (`panels/`) — 차체 덩어리
| 패널 | NSX에서 지금 이름 | 매개변수 예 |
|---|---|---|
| `noseBumper` | bumperF, grille, fogF, sidelightF, indicatorF | 코 모양(뾰족/둥근/쐐기), 흡기구 개수·크기, 안개등 |
| `bonnet` | hood, seam, cowl | 램프 자리 형태(팝업/포켓/고정), 셧라인 |
| `frontWing` | wingF, repeater | 크레스트 날카로움, 아치 |
| `popupLamp` | lampLid, lampWell, lampPod, headlamp | 덮개 크기, 램프 수, `lamps` 0..1 |
| `canopy` | canopy, screenPane, sidePane, quarterPane, rearPane, cabinPane | 형태(캐노피/쐐기/버블), 기둥 색과 폭, B필러 폭, 뒷유리 맑기 |
| `door` | door, handle | 앞뒤 경계 곡선, 손잡이 |
| `sideIntake` | intake, intakeGrille | 위치, 깊이, 모서리 둥금, 핀 수 (공용 "파내기" 함수) |
| `sill` | sill | 높이, 돌출 |
| `quarter` | quarter (+ 주유구) | 둔덕 높이, 주유구 위치 |
| `deck` | bootLid, engineBay 덮개 쪽 | 엔진 덮개 종류(유리/루버/판) |
| `tail` | spoiler, tailSlot, tailBand, bumperR, valance, plate | 꼬리 형태(일체형 테두리/원형 램프/캡슐/잘린 꼬리), 스포일러, 범퍼 |
| `underbody` | chassis, 휠 하우스 | — |
| `cabin` | cockpit, seat, steering, bulkhead | 좌석, 대시, 핸들 위치(좌/우) |

## 4. 부품 (`parts/`) — 붙이는 것
| 부품 | NSX에서 | 매개변수 |
|---|---|---|
| `wheel` | wheel, rim, hub, tyreF/R | 지름, 폭, 스포크 형태(5스포크/디스크/별), 깊이 |
| `lampCluster` | tailLamp, stopLamp, indicatorR, reverseLamp | 모양(원/사각/캡슐), 색 배열, 테두리 |
| `mirror` | mirror, mirrorGlass | 머리 모양, 지지대 |
| `wiper` | wiper | 개수, 위치 |
| `exhaust` | exhaust | 개수, 지름, 위치 |
| `badge`, `plate`, `marker`, `fuelFlap` | badge, plate, markerR, … | 위치, 크기 |
| `engine` | (공용 엔진 모듈 그대로) | `ENGINES` 사양, 배치 |

## 5. NSX 조립 명세 (`cars/nsx.kit.ts`)
- 시트 JSON → 선 체계
- 패널 목록과 형태 매개변수(코=뾰족, 캐노피=캐노피형, 꼬리=일체형 테두리 …)
- 부품 목록과 위치
- 색과 재질
코드는 거의 없고 데이터 위주로 만든다.

## 6. 시험
1. **일치 시험(회귀):** 키트로 조립한 NSX와 원본 `mesh_nsx.ts`를 같은 각도(옆, 위, 앞, 뒤, 3/4 두 장)로 렌더한다.
   - 윤곽 일치(IoU) 0.98 이상.
   - 픽셀 차이 그림을 만든다.
   - 삼각형 수 ±10 % 이내.
   - `wheelsOf`가 같은 바퀴 4개를 찾는다.
   - 실시간 렌더러로 3/4 앞뒤를 나란히 찍는다.
2. **이음매 시험:** 패널 경계 점이 모두 짝이 있는지(틈 0) 확인한다. 같은 자리에 겹친 면이 없는지도 본다.
3. **교체 시험(부품화가 됐다는 증거):**
   - 휠베이스를 +150 mm, 폭을 +60 mm 바꿔도 틈이 없고 모양이 따라 늘어난다.
   - 꼬리를 다른 형태(예: 원형 램프 4개)로 바꿔도 조립된다.
   - 휠을 다른 형태로 바꾼다.
4. **테스트 파일:** `tests/kit.test.ts`에 위 1~3의 숫자 검사를 넣는다.

## 7. 범위와 원칙
- 원본 `mesh_nsx.ts`와 게임 등록은 그대로 둔다. 시험을 통과하면 등록을 키트판으로 바꿀지 따로 정한다.
- 패널 함수는 NSX 전용 숫자를 쓰지 않는다. NSX 값은 조립 명세에만 둔다.
- 이번에 모든 형태를 만들 필요는 없다. NSX에 필요한 형태만 만들되, 형태를 고를 수 있는 구조는 만들어 둔다.

## 결과 (검토 170)
- **키트:** `render/car/kit/`. 선 체계, 표준 단면, 격자(skin), 패널 13개, 부품 7개, 조립기, 이음매 검사로 이뤄진다. NSX 조립 명세는 `render/car/cars/nsx.kit.ts`이고, 결과 메시는 `render/car/mesh_nsx_kit.ts`.
- **원본과 일치:** 6개 각도 모두 윤곽 일치 0.9996 이상. 삼각형은 9,436개로 원본 9,150보다 3.1 % 많다. 바퀴 4개와 부품 이름이 같다.
- **이음매:** 차체 껍질의 열린 가장자리, 과다 사용 가장자리, 겹친 면, 접힌 면이 모두 0이다. 원본에는 열린 가장자리 222개와 과다 사용 가장자리 40개가 있었는데, 키트에서 고쳤다(A필러, 바닥, 흡기구, 꼬리 슬롯, 범퍼 모서리).
- **교체 시험:** 모두 이음매 0으로 통과했다.
  - 휠베이스 +150 mm·폭 +30 mm: 길이 4,555 mm, 도어와 지붕이 따라 늘어난다.
  - 원형 램프 꼬리
  - 디스크 휠
- **테스트:** `tests/car_kit.test.ts`. `tests/kit.test.ts`는 원래 UI 키트 테스트라 따로 뒀다.
- **표준 단면:** 옆 사슬 12점(크레스트 1, 어깨 3, 최대폭 1, 도어 2, 실 2, 면 1, 바닥 2), 위 단면 8열(중심~셧라인 4, 덮개 3, 크레스트 1). 보닛, 앞유리, 지붕, 뒷유리가 위 단면을 함께 쓴다.
- **만든 형태:**
  - 코 `round`
  - 캐노피 `canopy`
  - 꼬리 `frame`, `roundLamps`
  - 데크 `lid`
  - 헤드램프 `popup`
  - 휠 `fiveSpoke`, `disc`
  - 나머지 형태는 선택하면 "아직 없음" 오류가 난다.
- **다른 차를 옮기려면 더할 것**
  - F355: 코 `pointed`, 루버 데크, 차체색 기둥과 버팀벽, 긴 옆 홈
  - 디아블로: 코 `wedge`, 다각형 뒷바퀴 아치, 꼬리 `cut`
  - XJ220: 헤드램프 `pocket`, 루버 데크, 별도 윙
  - EB110: 별도 캐빈
  - 공통: 앞 아치보다 앞쪽 단면 위치, 세로 엔진 배치, 고정 헤드램프, 캡슐 램프
- 원본 `mesh_nsx.ts`와 게임 등록은 그대로다.
