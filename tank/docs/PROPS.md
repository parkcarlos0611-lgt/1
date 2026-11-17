# 프롭 목록 — 현재 보유 + 추가 필요

이미지 추가용 정리. id는 코드에서 쓰는 이름(파일명)이고, 크기는 실제 크기(m)입니다.

## 이미지 제작 규격 (새 이미지 공통)

- **시점:** 정측면(입면). 원근이 없거나 아주 약하게. 지붕 윗면은 살짝만 보이게.
- **배경:** 투명 PNG(또는 WebP). 이미지 하나에 물체 하나. 바닥 접지선은 수평이고 이미지 맨 아래에 붙입니다.
- **그림자:** 바닥 그림자는 넣지 않습니다(게임이 해 위치에 맞춰 그립니다). 물체 자체의 음영은 넣습니다.
- **조명:** 위에서 오는 부드러운 주광. 한쪽에 강한 역광이나 석양색은 피합니다(시간대 색은 게임이 입힘).
- **해상도:**
  - 실제 1 m당 40 px 이상.
  - 건물은 높이 800 px 이상, 소품은 긴 변 150 px 이상.
- **파손 짝:** 부서지는 물체는 정상/파손(또는 전소) 두 장을 같은 크기·같은 위치로 만듭니다.
- **화풍 통일:** 지금 그림들은 일러스트풍입니다. 사실풍으로 가면 한 구역(예: 외곽 전체)을 한꺼번에 바꿔야 섞여 보이지 않습니다.
- **고증:** 1991년 2월 쿠웨이트. 담장 두른 회반죽·콘크리트 주택, 평지붕, 옥상 물탱크, 아랍어 간판, 대추야자.

---

## 1. 현재 보유

### 1-1. 사격장 (assets/sprites/props)

| id | 내용 |
|---|---|
| barracks | 막사 |
| tent | 군용 텐트 |
| sandbag | 모래주머니 진지 |
| hesco | HESCO 방벽 |
| twall | T-월 방폭벽 |
| supply | 보급품 더미 |
| s_range, s_danger, s_warning, s_lane | 사격장 표지판 |
| s_500 … s_4500 | 거리 표지(500 m 간격) |
| usflag, pole | 성조기, 깃대 |
| road | 기지 도로 |

### 1-2. 범용 고층 (assets/sprites/buildings)

| id | 내용 |
|---|---|
| b1, b1_broken | 아파트 A, 파손 |
| b2, b2_broken | 아파트 B, 파손 |
| b3, b3_broken | 업무용 빌딩, 파손 |
| b4, b4_broken | 곡면 아파트, 파손 |

### 1-3. 시내 건물 (assets/sprites/city, data/city.js)

| id | 내용 | 높이 |
|---|---|---|
| h1 | 고층 아파트 A | 30 m |
| h2 | 유리 업무 빌딩 | 30 m |
| h3 | 고층 아파트 B | 32 m |
| h4 | 아치 기단 빌딩 | 32 m |
| h5 | 업무 빌딩 | 30 m |
| h6 | 원통형 빌딩 | 30 m |
| hd1, hd2 | 파손된 고층 A, B | 30 m |
| m1–m7 | 중층 건물 1–7 | 14–18 m |
| l1 | 단층 연립 | 6 m |
| l2 | 아치 건물 | 7 m |
| l3 | 2층 상가주택 | 7 m |
| l4 | 돔 건물 | 6.5 m |
| l5 | 상점 건물 | 6 m |
| l6 | 창고 | 7 m |
| l7 | 차양 시장 | 4.5 m |

### 1-4. 시내 스프라이트 (assets/sprites/town, data/town_sprites.js)

| 분류 | id (이름) |
|---|---|
| 시장·상점 | market_gate (아치문), market_2storey (2층 상가), market_arcade (아케이드), market_alley (골목), market_a / market_b (시장 단지 파노라마), shop_grocery, shop_garage, shop_awning, shop_clothes, shop_elec, stall_fruit / stall_red / stall_blue / stall_meat (노점) |
| 외곽 구조물 | tin_shed (함석 창고), shed_pair (판잣집 상점), container (컨테이너 사무실), tent, quonset (반원형 창고), canopy, shelter_tin / shelter_wood / shelter_cloth (차양), camo_net (위장망 진지), watchtower (감시탑), ruin_small, ruin_wall (무너진 벽·담장) |
| 시장 물품 | fruit_crate1–3, plastic_crate, crates, crates_small, crate_stack, sacks, flat_sacks, basket, pots, jerrycans, table, table2, small_table, stool, red_table, carpet_stand, pallet_goods, covered_goods |
| 잡동사니 | drum_red, drum_blue, ibc, water_tank, tires1, tires2, pallets, burn_drum |
| 방어물 | sandbags, barrier1, barrier2 (콘크리트 방벽), roadblock1, roadblock2, hedgehog (대전차 장애물) |
| 간판·가로시설 | billboard → billboard_dmg → sign_frame, roof_billboard, shop_sign, direction_sign, poster_board, lamp → lamp_bent → lamp_down, lane_lamp, traffic_light |
| 쓰레기통 | trash_can → bin_burnt, wheelie_bin → bin_tipped, dumpster |
| 민간 차량 | sedan, old_sedan, pickup, van, taxi + 파손 sedan_dmg, old_sedan_dmg, pickup_dmg, van_dmg, taxi_burnt |

### 1-5. 식생·지형 (assets/sprites/city)

| id | 내용 |
|---|---|
| bush1–7 | 관목 |
| grass1–5 | 마른 풀 |
| rock1–7 | 바위 |
| tree | 나무 |
| dune1–2 | 작은 모래둔덕 |

### 1-6. 건물 잔해 (data/city.js)

| 분류 | id |
|---|---|
| 콘크리트·벽돌 | pile1–5, conc1–7, brick1–3, grit1–2, gravel, mixed1–4 |
| 구조 부재 | wall1–5, slab1, block1–2, col1–2, arch, pillar, beam1–2 |
| 철근·판재 | rebar1–4, sheet1–4, pipe |
| 그 밖 | sack1–3, wood1–3, burnt1–4, barrel–barrel3, crate–crate2, glass1–3 |

### 1-7. 지면 텍스처 (assets/sprites/ground)

road, alley1–2, lot1–2

### 1-8. 코드로 그리는 것 (이미지 없음)

- 하늘·구름·유정 화재·연기
- 정유시설 지평선 윤곽, 먼 도시 윤곽(C1)
- 자갈·판석·마른 개울
- 도로·보도
- 불빛·서치라이트

---

## 2. 추가 필요 (우선순위 순)

### P1 — 외곽·주거 채우기 (C2) ★ 가장 효과 큼

| 제안 id | 내용 | 크기 (폭×높이 m) | 수량 |
|---|---|---|---|
| palm_tall | 대추야자, 다 자란 것 | 4–6 × 10–14 | 3종 |
| palm_young | 어린 대추야자 | 3 × 3–5 | 2종 |
| palm_grove | 야자수 숲 묶음(3–5그루) | 15–25 × 10–13 | 2종 |
| wall_block | 블록·회반죽 담장, 좌우 이어붙일 수 있게 | 8–12 × 2.2–2.8 | 3종 (+파손 2) |
| wall_gate | 담장 철문(대문)·차고문 | 4–6 × 3 | 2종 |
| villa | 담장 두른 1–2층 주택, 평지붕, 옥상 물탱크 | 14–20 × 7–9 | 4종 (+파손) |
| farm_shed | 농가 창고·축사, 철골+함석 | 15–25 × 5–7 | 2종 |
| warehouse_big | 대형 철골 창고(공업지대) | 30–40 × 9–12 | 2종 (+파손) |
| fuel_station | 주유소 캐노피·주유기·사무실 | 20–25 × 6 | 1종 (+파손) |
| fuel_sign | 주유소 기둥 간판 | 2 × 8 | 1종 |
| water_tower | 버섯형 급수탑(일반형) | 10 × 25–30 | 2종 |
| mosque_small | 동네 모스크, 돔+미나렛 1개 | 14–18 × 8 (미나렛 22–28) | 2종 |
| mosque_big | 큰 모스크, 돔+미나렛 2개 | 30–40 × 12 (미나렛 35) | 1종 |
| pylon | 송전 철탑 | 8 × 30 | 1종 (+쓰러진 것) |
| pole_power | 콘크리트 전신주(애자·변압기) | 1.5 × 10 | 2종 |
| substation | 변전설비(울타리 안 변압기들) | 15 × 6 | 1종 |

### P2 — 도로·도시 인프라

| 제안 id | 내용 | 크기 (m) | 수량 |
|---|---|---|---|
| overpass | 고가도로 상판+교각 한 칸(이어붙임) | 30 × 9 | 1종 (+파손) |
| gantry | 고속도로 표지 갠트리(아랍어·영어) | 20 × 7 | 1종 |
| guardrail | 가드레일 구간 | 4 × 0.8 | 1종 |
| median | 중앙분리대 화단 | 6 × 1 | 1종 |
| bus_stop | 버스 정류장 | 4 × 2.8 | 1종 |
| phone_booth | 공중전화 부스 | 1 × 2.3 | 1종 |
| crane_tower | 타워크레인 | 20 × 40 | 1종 |
| scaffold | 공사 비계에 싸인 건물 골조 | 15 × 15–20 | 1종 |
| roof_tank | 옥상 물탱크 | 2 × 2 | 2종 |
| roof_dish | 옥상 위성안테나 | 1.5 × 1.5 | 1종 |
| roof_ac | 옥상 에어컨 실외기 | 1 × 0.8 | 1종 |
| roof_antenna | 옥상 안테나 숲 | 3 × 4 | 1종 |
| shop_shutter_open / shop_shutter_closed | 셔터 상점(열림/닫힘) | 6 × 4 | 각 2종 |
| sign_ar | 아랍어 벽 간판 | 3–6 × 1 | 4종 |

### P3 — 전쟁 흔적 (1991년 2월)

| 제안 id | 내용 | 크기 (m) | 수량 |
|---|---|---|---|
| zu23_pos | ZU-23-2 대공포 진지(모래주머니 포함) | 5 × 2 | 1종 (+파괴) |
| s60_pos | S-60 57 mm 대공포 | 6 × 2.5 | 1종 (+파괴) |
| berm_section | 흙둑(방어 둑) 단면, 이어붙임 | 10 × 2 | 2종 |
| trench | 참호 입구·사대 | 6 × 1 | 1종 |
| wire_coil | 윤형 철조망 | 6 × 1 | 1종 |
| mine_sign | 지뢰 경고판(아랍어·영어) | 0.6 × 1.2 | 1종 |
| ural_wreck, zil_wreck | 군용 트럭 잔해(전소) | 7–8 × 2.8 | 각 1종 |
| bus_wreck | 불탄 버스 | 11 × 3 | 1종 |
| ammo_crates | 버려진 탄약상자 더미 | 2 × 1 | 2종 |
| wall_soot | 그을린 벽면 오버레이(창문 위 그을음) | 3 × 3 | 2종 |
| poster_war | 선전 벽화·포스터(일반화) | 3 × 2 | 2종 |

### P4 — 시장·도심 생활감

| 제안 id | 내용 | 크기 (m) | 수량 |
|---|---|---|---|
| laundry | 발코니 빨래줄 | 3 × 1.5 | 2종 |
| awning_long | 긴 천 차양(상점가) | 8 × 2.5 | 2종 |
| cafe_set | 카페 탁자·의자 묶음 | 3 × 1 | 1종 |
| hand_cart | 손수레 | 2 × 1.2 | 1종 |
| goats | 염소 몇 마리(외곽) | 2–3 × 0.8 | 1종 |
| wires_hang | 늘어진 전선(건물 사이) | 10 × 2 | 1종 |

### P5 — 사막·유전 (중경 배치용)

| 제안 id | 내용 | 크기 (m) | 수량 |
|---|---|---|---|
| shrub_dry | 참고 이미지식 가지형 마른 덤불 | 1–2 × 1–1.5 | 3종 |
| slab_rock | 층진 석회암 판석 | 2–4 × 0.5–1 | 2종 |
| wellhead | 유정 헤드: 정상 / 불타는 바닥 / 꺼진 것 | 2 × 2 | 3종 |
| pumpjack | 펌프잭(근거리용) | 8 × 6 | 1종 |
| pipeline | 지상 송유관 구간(이어붙임) | 10 × 1.2 | 1종 |
| oil_lake | 원유 웅덩이(지면 오버레이, 반사) | 15 × 0.3 | 2종 |
| tank_farm | 원유 저장탱크(중경) | 20 × 10 | 2종 |

### 배치 계획

새 이미지가 들어오면 이렇게 씁니다.

- **외곽(2–5 km):**
  - 줄 3–5: 농가, 창고, 야자수 숲, 송전탑, 급수탑.
  - 줄 1–2: 담장, 주유소, 전신주.
- **저층 주거(5–8 km):** 담장 주택, 야자수, 동네 모스크, 옥상 소품.
- **시장·도심:** 아랍어 간판, 빨래줄, 차양, 크레인과 공사 중 건물.
- **파괴 구역:** 그을린 벽, 트럭과 버스 잔해, 늘어진 전선.
- **사막 간선(동·서):** 대공포 진지, 흙둑, 철조망, 지뢰 경고판, 유정.
