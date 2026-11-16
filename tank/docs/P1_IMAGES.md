# P1 이미지 목록 — 외곽·주거 채우기 (C2)

총 **41장**. 파일명은 그대로 쓰면 코드가 바로 읽습니다(확장자는 .png 또는 .webp).
넣을 곳: `assets/sprites/town/`.

## 공통 규격 (모든 장)

- **시점:** 정측면(입면) 사실풍 사진·렌더. 원근은 거의 없게. 지붕 윗면이 살짝 보이는 눈높이.
- **배경:** 완전 투명. 이미지 하나에 물체 하나. 물체 바닥(접지선)이 이미지 맨 아래에 수평으로 닿게 합니다.
- **그림자:** 바닥 그림자 없음. 물체 자체의 음영은 있음.
- **조명:** 한낮 위쪽의 부드러운 햇빛. 석양색·밤·강한 역광은 쓰지 않습니다.
- **해상도:** 실제 1 m = 50 px 기준. 아래 "권장 px"보다 크면 괜찮습니다.
- **고증:** 1991년 쿠웨이트. 베이지·흰 회반죽, 콘크리트 블록, 평지붕, 옥상 물탱크, 사막 먼지가 앉은 표면.
- **파손 짝(_dmg):** 정상판과 같은 캔버스 크기, 같은 위치, 같은 접지선으로 만듭니다(바로 갈아 끼움). 파손판은 1991년 전투 흔적으로, 총탄 자국·그을음·무너진 모서리·깨진 창을 넣습니다.

영어 프롬프트 공통 꼬리말(이미지 생성기용):
`orthographic side elevation view, photorealistic, 1991 Kuwait, dusty desert light, midday soft sunlight from above, isolated on transparent background, no ground shadow, full object visible, flat ground line at bottom`

---

## 1. 대추야자 (7장)

| # | 파일명 | 내용 | 실제 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 1 | palm_tall1.png | 다 자란 대추야자, 곧은 줄기, 잎 무성 | 5 × 12 | 250 × 600 | tall date palm tree, straight trunk with old frond bases |
| 2 | palm_tall2.png | 다 자란 대추야자, 줄기가 살짝 휨 | 5 × 13 | 250 × 650 | tall date palm, slightly curved trunk, some dry brown fronds |
| 3 | palm_tall3.png | 키 큰 대추야자, 마른 잎이 아래로 늘어짐 | 4.5 × 14 | 230 × 700 | very tall date palm, skirt of dead hanging fronds |
| 4 | palm_young1.png | 어린 대추야자(줄기 짧음) | 3 × 3.5 | 150 × 175 | young date palm, short trunk, bushy |
| 5 | palm_young2.png | 어린 대추야자 덤불형 | 3.5 × 4.5 | 175 × 225 | young date palm cluster, multiple shoots |
| 6 | palm_grove1.png | 야자수 숲 묶음 3–4그루, 높이 섞임 | 18 × 12 | 900 × 600 | small grove of 4 date palms of mixed height |
| 7 | palm_grove2.png | 야자수 숲 5그루 + 아래 관목 | 24 × 13 | 1200 × 650 | date palm grove with low shrubs underneath |

## 2. 담장·대문 (7장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 8 | wall_block1.png | 회반죽 칠한 블록 담장, 위에 띠 장식. **좌우 끝을 이어 붙일 수 있게** | 10 × 2.5 | 500 × 125 | plastered concrete block compound wall, seamless left-right tile |
| 9 | wall_block2.png | 칠 안 한 회색 콘크리트 블록 담장 | 10 × 2.3 | 500 × 115 | bare grey cinder block wall, tileable |
| 10 | wall_block3.png | 담장 위 장식 격자(구멍 뚫린 블록) | 10 × 2.8 | 500 × 140 | compound wall with decorative breeze-block top row |
| 11 | wall_block1_dmg.png | 8번 파손: 한쪽이 무너짐, 총탄 자국 | 10 × 2.5 | 500 × 125 | same wall partly collapsed, bullet holes |
| 12 | wall_block2_dmg.png | 9번 파손: 구멍 뚫리고 그을림 | 10 × 2.3 | 500 × 115 | same wall breached, scorched |
| 13 | wall_gate1.png | 철제 대문(녹색/흰색 철판), 기둥 2개 | 5 × 3 | 250 × 150 | steel double gate in compound wall, painted metal |
| 14 | wall_gate2.png | 차고 겸용 미닫이 철문 | 6 × 3 | 300 × 150 | sliding metal garage gate in compound wall |

## 3. 담장 주택 (빌라) (8장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 15 | villa1.png | 1층 단독주택, 평지붕, 옥상 물탱크, 앞 담장 포함 | 16 × 6 | 800 × 300 | single storey Kuwaiti villa, flat roof, rooftop water tank, front compound wall |
| 16 | villa2.png | 2층 주택, 발코니, 아치 창 | 15 × 8.5 | 750 × 425 | two storey villa, arched windows, small balcony, flat roof |
| 17 | villa3.png | 2층 주택, 옥상 난간, 위성안테나·에어컨 | 18 × 9 | 900 × 450 | two storey concrete house, parapet roof, AC units, satellite dish |
| 18 | villa4.png | 큰 2층 저택, 야자수 1그루가 담장 위로 보임 | 20 × 9 | 1000 × 450 | large two storey villa behind wall, palm tree peeking over |
| 19 | villa1_dmg.png | 15번 파손 | 16 × 6 | 800 × 300 | same villa damaged, shell hole, scorched windows |
| 20 | villa2_dmg.png | 16번 파손 | 15 × 8.5 | 750 × 425 | same villa damaged, collapsed balcony |
| 21 | villa3_dmg.png | 17번 파손 | 18 × 9 | 900 × 450 | same house damaged, roof corner collapsed |
| 22 | villa4_dmg.png | 18번 파손 | 20 × 9 | 1000 × 450 | same villa burnt out, soot streaks |

## 4. 농가·창고 (6장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 23 | farm_shed1.png | 철골+함석 농가 창고, 한쪽 열림 | 18 × 6 | 900 × 300 | open-sided farm shed, steel frame, corrugated metal roof |
| 24 | farm_shed2.png | 흙벽돌·블록 축사와 울타리 | 20 × 5 | 1000 × 250 | desert livestock pen, block walls, fence |
| 25 | warehouse1.png | 대형 철골 창고, 박공지붕, 큰 셔터 | 35 × 10 | 1750 × 500 | large industrial steel warehouse, gable roof, big roller doors |
| 26 | warehouse2.png | 대형 창고, 평지붕, 하역장 | 38 × 9 | 1900 × 450 | industrial warehouse with loading dock, flat roof |
| 27 | warehouse1_dmg.png | 25번 파손: 지붕 일부 날아감, 철판 휨 | 35 × 10 | 1750 × 500 | same warehouse, roof torn open, bent metal sheets |
| 28 | warehouse2_dmg.png | 26번 파손: 그을림, 셔터 찌그러짐 | 38 × 9 | 1900 × 450 | same warehouse burnt, crushed doors |

## 5. 주유소 (3장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 29 | fuel_station.png | 캐노피 + 주유기 3–4대 + 작은 사무실 | 24 × 6 | 1200 × 300 | 1980s Middle East petrol station, canopy, fuel pumps, small kiosk |
| 30 | fuel_station_dmg.png | 29번 파손: 캐노피 내려앉음, 그을음 | 24 × 6 | 1200 × 300 | same petrol station, canopy collapsed, burnt |
| 31 | fuel_sign.png | 기둥 간판(아랍어 + 숫자 가격판) | 2 × 8 | 100 × 400 | tall petrol station pole sign, Arabic lettering |

## 6. 급수탑·모스크 (5장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 32 | water_tower1.png | 버섯형 콘크리트 급수탑(일반형) | 10 × 26 | 500 × 1300 | mushroom shaped concrete water tower |
| 33 | water_tower2.png | 철골 다리 위 구형·원통 물탱크 | 8 × 22 | 400 × 1100 | steel lattice water tower with cylindrical tank |
| 34 | mosque_small1.png | 동네 모스크: 돔 1 + 미나렛 1, 흰 회반죽 | 16 × 25 (돔 높이 8) | 800 × 1250 | small neighbourhood mosque, one dome, one minaret, white plaster |
| 35 | mosque_small2.png | 동네 모스크: 사각 미나렛, 녹색 돔 | 14 × 22 | 700 × 1100 | small mosque, square minaret, green dome |
| 36 | mosque_big.png | 큰 모스크: 큰 돔 + 미나렛 2 | 36 × 35 | 1800 × 1750 | large mosque, big central dome, two tall minarets |

## 7. 전력 시설 (5장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 37 | pylon.png | 송전 철탑(고압선 매다는 팔 3단) | 8 × 30 | 400 × 1500 | high voltage lattice transmission tower, side view |
| 38 | pylon_down.png | 쓰러지고 휜 송전탑 | 22 × 8 | 1100 × 400 | collapsed bent transmission tower lying on ground |
| 39 | pole_power1.png | 콘크리트 전신주(애자·전선 고정대) | 1.5 × 10 | 75 × 500 | concrete electricity pole with insulators |
| 40 | pole_power2.png | 콘크리트 전신주 + 변압기 통 | 2 × 10 | 100 × 500 | concrete utility pole with transformer can |
| 41 | substation.png | 철망 울타리 안 변압기·철골 구조물 | 15 × 6 | 750 × 300 | small electrical substation behind chain-link fence |

---

## 받으면 하는 일 (C2)

- **크기 등록:** 이름과 실제 크기를 `data/town_sprites.js`에 등록합니다. 크기는 위 표 기준이고, 실제 이미지 비율에 맞춰 조정합니다.
- **외곽(2–5 km)과 서쪽 사막 간선 끝:**
  - 먼 줄 4–5: 창고, 농가, 야자수 숲, 급수탑, 송전탑(전선으로 이음)
  - 중간 줄 2–3: 빌라, 담장, 대문, 주유소, 모스크
  - 앞줄 1: 전신주, 어린 야자수, 변전설비
- **저층 주거(5–8 km):** 담장 주택가에 야자수와 동네 모스크를 섞습니다. 큰 모스크는 광장 근처에 둡니다.
- **파괴 구역:** _dmg판으로 바꿔 둡니다.
- **포격:** 포격이 맞으면 정상판이 _dmg판으로 바뀝니다(기존 간판·가로등과 같은 방식).
