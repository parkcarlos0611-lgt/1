# P2–P5 이미지 목록

형식과 공통 규격은 `docs/P1_IMAGES.md`와 같습니다.
- 정측면, 투명 배경, 바닥 그림자 없음, 한낮의 부드러운 빛
- 1 m = 50 px 기준. 작은 소품은 긴 변 150 px 이상. 권장 px의 `(→ …)`는 이 최소 크기를 적용한 값이니 그쪽을 따르세요.
- 파손판은 같은 캔버스 크기와 같은 바닥선
- **오버레이**라고 적힌 것: 건물이나 지면 위에 겹쳐 그리는 반투명 그림
- 넣을 곳: `assets/sprites/town/` (P5의 사막 항목도 같은 곳)

영어 프롬프트 공통 꼬리말:
`orthographic side elevation view, photorealistic, 1991 Kuwait, dusty desert light, midday soft sunlight from above, isolated on transparent background, no ground shadow, full object visible, flat ground line at bottom`

**합계: P2 22장, P3 20장, P4 11장, P5 16장 = 69장**

---

## P2 — 도로·도시 인프라 (22장)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 1 | overpass.png | 고가도로 한 칸: 상판 + 교각 2개. **좌우 이어붙임** | 30 × 9 | 1500 × 450 | concrete highway overpass span with two piers, tileable left-right |
| 2 | overpass_dmg.png | 1번 파손: 상판 한쪽 내려앉음, 철근 노출 | 30 × 9 | 1500 × 450 | same overpass span, deck partly collapsed, exposed rebar |
| 3 | gantry.png | 고속도로 표지 갠트리, 녹색 표지 2–3장 (아랍어·영어) | 20 × 7 | 1000 × 350 | highway overhead sign gantry, green signs Arabic and English |
| 4 | gantry_dmg.png | 3번 파손: 표지 찢김, 한쪽 기둥 휨 | 20 × 7 | 1000 × 350 | same gantry damaged, torn signs, bent leg |
| 5 | guardrail.png | 철제 가드레일 구간, 이어붙임 | 4 × 0.8 | 200 × 40 (→ 300 × 60) | steel W-beam guardrail section, tileable |
| 6 | median.png | 중앙분리대 화단 (연석 + 마른 관목) | 6 × 1 | 300 × 50 (→ 450 × 75) | road median planter, kerb, dry shrubs, tileable |
| 7 | bus_stop.png | 버스 정류장 (차양 + 벤치) | 4 × 2.8 | 200 × 140 | 1980s bus stop shelter with bench |
| 8 | phone_booth.png | 공중전화 부스 | 1 × 2.3 | 65 × 150 | public telephone booth, 1980s Gulf |
| 9 | crane_tower.png | 타워크레인 (마스트 + 지브 + 평형추) | 22 × 40 | 1100 × 2000 | tower crane at construction site |
| 10 | scaffold.png | 비계에 싸인 짓다 만 건물 골조 (4–5층) | 15 × 18 | 750 × 900 | unfinished concrete building frame wrapped in scaffolding |
| 11 | roof_tank1.png | 옥상 물탱크 (원통형, 받침대) | 2 × 2 | 150 × 150 | rooftop cylindrical water tank on stand |
| 12 | roof_tank2.png | 옥상 물탱크 (사각 철제) | 2 × 1.6 | 150 × 120 | rooftop square steel water tank |
| 13 | roof_dish.png | 옥상 위성안테나 | 1.5 × 1.5 | 150 × 150 | rooftop satellite dish, 1980s |
| 14 | roof_ac.png | 에어컨 실외기 (벽·옥상용) | 1 × 0.8 | 150 × 120 | window air conditioner unit, side view |
| 15 | roof_antenna.png | 옥상 TV 안테나 묶음 | 3 × 4 | 150 × 200 | cluster of rooftop TV antennas |
| 16 | shop_shutter_open1.png | 셔터 올린 상점, 물건 진열 | 6 × 4 | 300 × 200 | small shop front, roller shutter open, goods displayed |
| 17 | shop_shutter_open2.png | 셔터 올린 상점, 다른 업종 | 6 × 4 | 300 × 200 | shop front open, hardware store, Arabic sign |
| 18 | shop_shutter_closed1.png | 셔터 내린 상점 (낙서 약간) | 6 × 4 | 300 × 200 | shop front with closed roller shutter, faded graffiti |
| 19 | shop_shutter_closed2.png | 셔터 내린 상점, 녹슨 것 | 6 × 4 | 300 × 200 | shop with rusty closed shutter |
| 20 | sign_ar1.png | 아랍어 벽 간판 (가로형, 흰 바탕) — **오버레이** | 5 × 1 | 250 × 50 (→ 500 × 100) | Arabic shop sign board, white background, painted letters |
| 21 | sign_ar2.png | 아랍어 벽 간판 (녹색·빨강) — **오버레이** | 4 × 1 | 400 × 100 | Arabic shop sign, green and red |
| 22 | sign_ar3.png | 네온 테 간판 (아랍어 + 영어) — **오버레이** | 6 × 1.2 | 600 × 120 | Arabic and English shop sign with neon tube outline |

## P3 — 전쟁 흔적, 1991년 2월 (20장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 23 | zu23_pos.png | ZU-23-2 쌍열 대공포 + 모래주머니 원형 진지 | 5 × 2 | 250 × 100 (→ 500 × 200) | Iraqi ZU-23-2 twin anti-aircraft gun in sandbag emplacement |
| 24 | zu23_pos_dmg.png | 23번 파괴: 포신 휨, 모래주머니 터짐, 그을림 | 5 × 2 | 500 × 200 | destroyed ZU-23-2 position, bent barrels, burst sandbags |
| 25 | s60_pos.png | S-60 57 mm 대공포 (바퀴 접고 거치) | 6 × 2.5 | 300 × 125 (→ 600 × 250) | Iraqi S-60 57mm anti-aircraft gun emplaced |
| 26 | s60_pos_dmg.png | 25번 파괴 | 6 × 2.5 | 600 × 250 | destroyed S-60 gun, burnt |
| 27 | berm1.png | 흙둑 단면 (방어 둑), 이어붙임 | 10 × 2 | 500 × 100 | sand defensive berm section, bulldozed, tileable |
| 28 | berm2.png | 흙둑 + 사대 구멍 | 10 × 2.2 | 500 × 110 | sand berm with firing position cut |
| 29 | trench.png | 참호 입구 (모래주머니 테두리, 나무 덮개) | 6 × 1 | 300 × 50 (→ 600 × 100) | trench entrance with sandbag rim and timber cover |
| 30 | wire_coil.png | 윤형 철조망 (말뚝 포함), 이어붙임 | 6 × 1 | 300 × 50 (→ 600 × 100) | concertina razor wire on pickets, tileable |
| 31 | mine_sign.png | 지뢰 경고판 (빨간 삼각형, 아랍어·영어) | 0.6 × 1.2 | 75 × 150 | landmine warning sign on stake, Arabic and English |
| 32 | ural_wreck.png | Ural-375 군용 트럭 전소 잔해 | 7.4 × 2.7 | 370 × 135 | burnt out Ural-375 military truck wreck |
| 33 | zil_wreck.png | ZIL-131 군용 트럭 잔해 (타이어 녹아내림) | 7 × 2.5 | 350 × 125 | destroyed ZIL-131 truck, melted tyres |
| 34 | bus_wreck.png | 불탄 시내버스 | 11 × 3 | 550 × 150 | burnt out city bus wreck, 1980s |
| 35 | car_wreck_row.png | 약탈품 실은 채 버려진 민간차 2–3대 묶음 (전소) | 14 × 1.8 | 700 × 90 | row of burnt abandoned civilian cars loaded with goods |
| 36 | ammo_crates1.png | 버려진 탄약상자 더미 (녹색 나무상자) | 2 × 1 | 150 × 75 (→ 300 × 150) | pile of abandoned green wooden ammunition crates |
| 37 | ammo_crates2.png | 흩어진 탄약상자 + 탄피 | 2.5 × 0.8 | 300 × 100 | scattered ammo boxes and shell casings |
| 38 | wall_soot1.png | 창문 위로 번진 그을음 — **오버레이** (반투명) | 3 × 3 | 300 × 300 | soot scorch stain above a window, transparent overlay |
| 39 | wall_soot2.png | 벽면 큰 그을음 + 탄흔 — **오버레이** | 4 × 4 | 400 × 400 | large scorch mark with bullet impacts, transparent overlay |
| 40 | bullet_holes.png | 총탄 자국 무리 — **오버레이** | 2 × 1.5 | 300 × 225 | cluster of bullet holes in plaster wall, transparent overlay |
| 41 | poster_war1.png | 전쟁 선전 벽화 (일반화한 인물·문구) | 3 × 2 | 300 × 200 | faded wartime propaganda mural, generic figure, Arabic text |
| 42 | poster_war2.png | 찢어진 포스터들이 붙은 벽 조각 — **오버레이** | 2 × 1.5 | 300 × 225 | torn political posters pasted on wall, transparent overlay |

## P4 — 시장·도심 생활감 (11장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 43 | laundry1.png | 발코니 빨래줄 (옷 몇 벌) — **오버레이** | 3 × 1.5 | 300 × 150 | laundry hanging on balcony line |
| 44 | laundry2.png | 옥상 빨래줄 (침구) | 4 × 1.8 | 300 × 135 | rooftop washing line with sheets |
| 45 | awning_long1.png | 긴 천 차양 (줄무늬) — **오버레이** | 8 × 2.5 | 400 × 125 | long striped fabric shop awning |
| 46 | awning_long2.png | 긴 천 차양 (바랜 녹색) — **오버레이** | 8 × 2.5 | 400 × 125 | long faded green canvas awning |
| 47 | cafe_set.png | 찻집 탁자 + 플라스틱 의자 묶음 | 3 × 1 | 300 × 100 | street tea house tables and plastic chairs |
| 48 | hand_cart.png | 손수레 (짐 실은) | 2 × 1.2 | 200 × 120 | wooden hand cart loaded with goods |
| 49 | push_cart.png | 노점 수레 (차양 달린) | 2.5 × 2 | 250 × 200 | street vendor push cart with canopy |
| 50 | goats.png | 염소 3–4마리 (외곽) | 3 × 0.8 | 300 × 80 | small group of goats standing, side view |
| 51 | wires_hang.png | 건물 사이 늘어진 전선 — **오버레이** | 10 × 2 | 500 × 100 | sagging electrical wires between buildings, transparent |
| 52 | dish_cluster.png | 발코니 위성안테나·에어컨 묶음 — **오버레이** | 3 × 2 | 300 × 200 | balcony with satellite dishes and AC units |
| 53 | parked_bike.png | 세워 둔 오토바이·자전거 | 1.8 × 1.1 | 180 × 110 | parked motorcycle and bicycle |

## P5 — 사막·유전, 중경 배치용 (16장)

| # | 파일명 | 내용 | 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 54 | shrub_dry1.png | 가지형 마른 덤불 (참고 이미지 스타일) | 1.8 × 1.3 | 180 × 130 (→ 300 × 215) | dry leafless desert shrub, twiggy branches |
| 55 | shrub_dry2.png | 넓게 퍼진 마른 덤불 | 2.2 × 1 | 300 × 135 | wide low dry desert shrub |
| 56 | shrub_dry3.png | 작은 마른 덤불 | 1 × 0.8 | 190 × 150 | small dry twig bush |
| 57 | slab_rock1.png | 층진 석회암 판석 | 3 × 0.7 | 300 × 70 | flat layered limestone slab rock |
| 58 | slab_rock2.png | 깨진 판석 더미 | 4 × 1 | 400 × 100 | broken limestone slabs pile |
| 59 | wellhead.png | 유정 헤드 (밸브 트리, 정상) | 2 × 2.2 | 200 × 220 | oil wellhead christmas tree valve assembly |
| 60 | wellhead_fire.png | 불타는 유정 헤드 바닥부 (불꽃은 게임이 그림, 그을린 헤드만) | 3 × 2 | 300 × 200 | scorched blown-out oil wellhead, blackened ground |
| 61 | wellhead_capped.png | 진화 후 덮은 유정 | 2 × 1.5 | 200 × 150 | capped oil wellhead after firefighting |
| 62 | pumpjack.png | 펌프잭 (근거리, 정측면) | 8 × 6 | 400 × 300 | oil pumpjack side view |
| 63 | pipeline.png | 지상 송유관 구간 (받침대 위), 이어붙임 | 10 × 1.2 | 500 × 60 (→ 750 × 90) | above-ground oil pipeline on supports, tileable |
| 64 | pipeline_dmg.png | 63번 파손: 터져서 기름 흘림 | 10 × 1.2 | 750 × 90 | ruptured pipeline leaking oil |
| 65 | oil_lake1.png | 원유 웅덩이 — **지면 오버레이** (검게 번들거림, 하늘 반사) | 15 × 0.3 | 750 × 15 (→ 1500 × 60) | thin pool of crude oil on desert sand, glossy black, side-on sliver |
| 66 | oil_lake2.png | 원유 웅덩이 가장자리 (말라 갈라진 타르) — **지면 오버레이** | 10 × 0.3 | 1000 × 40 | dried cracked tar edge of oil lake |
| 67 | tank_farm1.png | 원유 저장탱크 1기 (흰색 원통, 계단) | 20 × 10 | 1000 × 500 | white crude oil storage tank with stairs |
| 68 | tank_farm2.png | 저장탱크 2기 + 배관 | 30 × 10 | 1500 × 500 | two oil storage tanks with pipework |
| 69 | tank_farm1_dmg.png | 67번 파괴: 지붕 날아가고 그을림 | 20 × 10 | 1000 × 500 | destroyed oil storage tank, roof blown, scorched |

---

## 배치 계획 (받으면)

- **P2 인프라:**
  - 고가도로·갠트리는 서쪽·동쪽 간선과 도심 입구에 둡니다.
  - 크레인과 비계는 도심 먼 줄에 둡니다.
  - 옥상 소품은 기존 건물 지붕선 위에 자동으로 얹습니다.
- **P3 전쟁 흔적:**
  - 대공포·흙둑·참호·철조망·지뢰판은 동쪽 간선(이라크군 진지)과 외곽 입구 검문소에 둡니다.
  - 트럭·버스 잔해는 파괴 구역과 동쪽 간선에 둡니다.
  - 그을음·탄흔 오버레이는 파괴 구역 건물 벽에 무작위로 붙입니다.
- **P4 생활감:** 시장·저층 주거·도심의 건물 앞과 발코니에 흩뿌립니다.
- **P5 사막·유전:**
  - 사격장과 사막 간선의 가까운 땅에 마른 덤불과 판석을 둡니다.
  - 중경에는 유정·펌프잭·송유관·원유 웅덩이·저장탱크를 둡니다.
  - 불타는 유정은 지평선 화재와 같은 방식으로 게임이 불꽃과 연기를 덧그립니다.
