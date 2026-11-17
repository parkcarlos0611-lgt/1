# 현재 이미지 목록 — 사실풍 교체용

지금 게임이 쓰는 배경·소품 이미지 전부입니다(**226장 + 지면 텍스처 5장**). 같은 파일명으로 덮어쓰면 그대로 교체됩니다.
크기는 데이터 파일에서 계산한 실제 크기(m)입니다.
- **확장자:** `.webp`로 된 것은 webp로 넣거나, png로 넣고 알려주시면 경로를 바꿉니다.
- **비율:** 새 그림의 가로세로 비율이 달라져도 됩니다. 게임은 높이(또는 길이) 기준으로 맞춥니다.
- **시내 건물(3번):** 층·칸 경계 데이터가 따로 있습니다(부서질 때 칸 단위로 무너짐). 교체하면 층 위치를 다시 잽니다. 정면 창문 격자가 반듯할수록 좋습니다.

**목록에서 뺀 것:**
- **전차·장갑차·헬기·자주포 등 차량:** 부품을 분리한 리그 시트라 형식이 다릅니다. 필요하면 따로 정리합니다.
- **코드로 그리는 것:** 하늘, 구름, 유정 화재, 연기, 지평선 윤곽, 자갈 지면, 불빛.

## 공통 규격

`docs/P1_IMAGES.md`와 같습니다.
- 정측면, 투명 배경, 바닥 그림자 없음, 한낮의 부드러운 빛
- 1 m = 50 px 이상. 작은 소품은 긴 변 150 px 이상, 잔해 조각은 250 px 이상
- 파손판은 정상판과 같은 캔버스 크기와 같은 바닥선

영어 프롬프트 공통 꼬리말:
`orthographic side elevation view, photorealistic, 1991 Kuwait, dusty desert light, midday soft sunlight from above, isolated on transparent background, no ground shadow, full object visible, flat ground line at bottom`

**교체 우선순위 권장:**
1. 시내 건물(3번)
2. 시내 스프라이트 중 건물·상점·차량
3. 가로시설
4. 식생
5. 잔해 (작게 보여서 효과가 가장 적음)

---

## 1. 사격장 (`assets/sprites/props/`)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 1 | barracks.png | 막사 | 12.5 × 4.2 | 625 × 209 | US Army desert barracks hut, 1991 Saudi base |
| 2 | tent.png | 군용 텐트 | 9.8 × 3.5 | 490 × 173 | US Army GP medium tent, desert tan |
| 3 | sandbag.png | 모래주머니 진지 | 6.4 × 2.3 | 320 × 116 | sandbag fighting position wall |
| 4 | hesco.png | HESCO 방벽 (이어붙임) | 6.6 × 2.2 | 330 × 111 | HESCO bastion wall section filled with sand, tileable |
| 5 | twall.png | T-월 방폭벽 | 6.6 × 2 | 330 × 102 | concrete T-wall blast barrier section |
| 6 | supply.png | 보급품 더미 | 13 × 2.5 | 650 × 125 | military supply dump, pallets, crates, fuel drums under netting |
| 7 | s_range.png | 사격장 입구 표지판 | 5.2 × 4.7 | 260 × 234 | US Army firing range entrance sign board |
| 8 | s_danger.png | 위험 표지판 | 3.3 × 3.7 | 165 × 186 | DANGER live fire range warning sign |
| 9 | s_warning.png | 경고 표지판 | 2.8 × 3.5 | 140 × 176 | WARNING sign on posts, military range |
| 10 | s_lane.png | 사로 표지판 | 2.6 × 3.5 | 130 × 175 | firing lane number sign |
| 11 | s_500.png | 거리 표지 500 m | 2.4 × 2.6 | 138 × 150 | range distance marker board 500 m |
| 12 | s_1000.png | 거리 표지 1000 m | 2.4 × 2.6 | 139 × 150 | range distance marker board 1000 m |
| 13 | s_1500.png | 거리 표지 1500 m | 2.4 × 2.6 | 141 × 150 | range distance marker board 1500 m |
| 14 | s_2000.png | 거리 표지 2000 m | 2.4 × 2.6 | 140 × 150 | range distance marker board 2000 m |
| 15 | s_2500.png | 거리 표지 2500 m | 2.4 × 2.6 | 139 × 150 | range distance marker board 2500 m |
| 16 | s_3000.png | 거리 표지 3000 m | 2.4 × 2.6 | 139 × 150 | range distance marker board 3000 m |
| 17 | s_3500.png | 거리 표지 3500 m | 2.4 × 2.5 | 142 × 150 | range distance marker board 3500 m |
| 18 | s_4000.png | 거리 표지 4000 m | 2.4 × 2.5 | 143 × 150 | range distance marker board 4000 m |
| 19 | s_4500.png | 거리 표지 4500 m | 2.4 × 2.5 | 144 × 150 | range distance marker board 4500 m |
| 20 | pole.png | 깃대 | 0.3 × 9 | 40 × 450 | steel flagpole |
| 21 | usflag.png | 성조기 (깃발만) | 1.8 × 1 | 180 × 100 | US flag, side-on, waving |
| 22 | road.png | 기지 도로 띠 (타일링) | 10 × 1 | 500 × 50 | gravel base road surface strip, tileable |

## 2. 범용 고층 (`assets/sprites/buildings/`, 정상 + `_broken`)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 23 | b1.png | 아파트 A | 20.1 × 30 | 1004 × 1500 | 10 storey 1980s apartment block, concrete balconies |
| 24 | b1_broken.png | 아파트 A (파손) | 20.1 × 30 | 1004 × 1500 | 10 storey 1980s apartment block, concrete balconies, war damaged, shell holes, collapsed corner |
| 25 | b2.png | 아파트 B | 20.9 × 31 | 1046 × 1550 | 10 storey apartment block, horizontal bands |
| 26 | b2_broken.png | 아파트 B (파손) | 20.9 × 31 | 1046 × 1550 | 10 storey apartment block, horizontal bands, war damaged, shell holes, collapsed corner |
| 27 | b3.png | 업무용 빌딩 | 19.4 × 30 | 972 × 1500 | glass and concrete office tower |
| 28 | b3_broken.png | 업무용 빌딩 (파손) | 19.4 × 30 | 972 × 1500 | glass and concrete office tower, war damaged, shell holes, collapsed corner |
| 29 | b4.png | 곡면 아파트 | 19.4 × 29 | 969 × 1450 | curved facade apartment tower |
| 30 | b4_broken.png | 곡면 아파트 (파손) | 19.4 × 29 | 969 × 1450 | curved facade apartment tower, war damaged, shell holes, collapsed corner |

## 3. 시내 건물 (`assets/sprites/city/`, .webp — 부서짐은 칸 단위로 게임이 처리)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 31 | h1.webp | 고층 아파트 A | 22.7 × 35.7 | 1137 × 1785 | 10 storey Kuwait City apartment tower 1980s |
| 32 | h2.webp | 유리 업무 빌딩 | 18.8 × 35.9 | 938 × 1797 | glass office tower 1980s Kuwait City |
| 33 | h3.webp | 고층 아파트 B | 19.2 × 37.5 | 960 × 1877 | tall apartment tower with balconies |
| 34 | h4.webp | 아치 기단 빌딩 | 22.3 × 37 | 1114 × 1849 | tower with arched arcade base |
| 35 | h5.webp | 업무 빌딩 | 16.5 × 33.5 | 827 × 1674 | 1980s office building, concrete grid facade |
| 36 | h6.webp | 원통형 빌딩 | 19.8 × 37.4 | 991 × 1870 | cylindrical round office tower |
| 37 | hd1.webp | 파손된 고층 A | 14.8 × 33.1 | 738 × 1657 | war damaged high-rise, shell holes, collapsed floors |
| 38 | hd2.webp | 파손된 고층 B | 14.4 × 35.6 | 719 × 1780 | burnt out high-rise, exposed floors, soot |
| 39 | m1.webp | 중층 건물 1 | 19.1 × 18.6 | 955 × 928 | 5 storey mixed use building, shops at street level |
| 40 | m2.webp | 중층 건물 2 | 17.2 × 21.2 | 859 × 1060 | 6 storey apartment building, balconies |
| 41 | m3.webp | 중층 건물 3 | 15.3 × 17.6 | 767 × 878 | 5 storey concrete residential block |
| 42 | m4.webp | 중층 건물 4 | 16.8 × 19.1 | 842 × 957 | 5 storey building with arched windows |
| 43 | m5.webp | 중층 건물 5 | 17.8 × 17.6 | 888 × 881 | 4 storey commercial building |
| 44 | m6.webp | 중층 건물 6 | 14.1 × 16.9 | 704 × 844 | 5 storey building, AC units on facade |
| 45 | m7.webp | 중층 건물 7 | 17.3 × 19.5 | 864 × 975 | 5 storey corner building |
| 46 | l1.webp | 단층 연립 | 21.4 × 8 | 1072 × 402 | single storey row of shops and houses, flat roof |
| 47 | l2.webp | 아치 건물 | 10.3 × 8 | 517 × 398 | single storey building with arched portico |
| 48 | l3.webp | 2층 상가주택 | 15.5 × 8.5 | 777 × 427 | two storey shop house |
| 49 | l4.webp | 돔 건물 | 12.1 × 8.8 | 606 × 439 | small domed building |
| 50 | l5.webp | 상점 건물 | 13.5 × 7 | 674 × 350 | single storey shop building with signs |
| 51 | l6.webp | 창고 | 16 × 8.4 | 799 × 421 | single storey storage warehouse |
| 52 | l7.webp | 차양 시장 | 10.7 × 4.5 | 537 × 227 | covered market shed with awnings |

## 4. 시내 스프라이트 (`assets/sprites/town/`, `dmg`는 파손 시 바뀌는 그림)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 53 | market_gate.png | 시장 아치문 | 13.3 × 11 | 665 × 550 | Middle Eastern souq entrance arch gate |
| 54 | market_2storey.png | 시장 2층 상가 | 11.2 × 8 | 558 × 400 | two storey souq shop building |
| 55 | market_arcade.png | 시장 아케이드 | 18.1 × 6.5 | 904 × 325 | souq arcade with arches and shop fronts |
| 56 | market_alley.png | 시장 골목 | 28.4 × 8 | 1419 × 400 | covered souq alley facade |
| 57 | shop_grocery.png | 상점 (식료품) | 6 × 5.2 | 300 × 260 | small grocery shop front, Arabic sign |
| 58 | stall_fruit.png | 과일 노점 | 4 × 2 | 198 × 100 | fruit market stall with produce |
| 59 | stall_red.png | 노점 (빨간 차양) | 2.8 × 2 | 150 × 106 | market stall with red awning |
| 60 | stall_blue.png | 노점 (파란 차양) | 3 × 2 | 150 × 102 | market stall with blue awning |
| 61 | stall_meat.png | 고기 노점 | 2.4 × 2 | 150 × 127 | butcher market stall |
| 62 | tin_shed.png | 함석 창고 | 8.7 × 3.4 | 434 × 170 | corrugated tin storage shed |
| 63 | shed_pair.png | 판잣집 상점 | 11.2 × 3.6 | 560 × 180 | pair of shanty shop sheds |
| 64 | container.png | 컨테이너 사무실 | 6.1 × 2.8 | 305 × 142 | shipping container converted site office |
| 65 | tent.png | 텐트 | 8.2 × 4 | 410 × 200 | canvas tent, civilian |
| 66 | quonset.png | 반원형 창고 | 9 × 4.6 | 448 × 230 | half-round quonset hut, corrugated metal |
| 67 | canopy.png | 차양 창고 | 5.1 × 2.6 | 256 × 130 | open canopy storage shelter |
| 68 | shelter_tin.png | 함석 차양 | 8.8 × 3.2 | 441 × 160 | corrugated tin lean-to shelter |
| 69 | shelter_wood.png | 나무 차양 | 4.9 × 2.8 | 245 × 140 | wooden lean-to shelter |
| 70 | shelter_cloth.png | 천 차양 | 5.4 × 3 | 272 × 150 | cloth shade shelter on poles |
| 71 | ruin_small.png | 무너진 벽 (작음) | 4.8 × 4 | 240 × 200 | small collapsed wall ruin |
| 72 | ruin_wall.png | 무너진 담장 | 14.8 × 4.5 | 740 × 225 | long ruined compound wall |
| 73 | camo_net.png | 위장망 진지 | 9.3 × 3 | 463 × 150 | Iraqi position under camouflage net |
| 74 | watchtower.png | 감시탑 | 5.7 × 6 | 286 × 300 | military guard watchtower, sandbagged |
| 75 | fruit_crate1.png | 과일 상자 | 1 × 0.5 | 150 × 68 | wooden crate of fruit |
| 76 | fruit_crate2.png | 과일 상자 | 0.9 × 0.5 | 150 × 73 | wooden crate of vegetables |
| 77 | fruit_crate3.png | 과일 상자 | 1 × 0.5 | 150 × 68 | crate of oranges |
| 78 | plastic_crate.png | 플라스틱 상자 | 0.7 × 0.3 | 150 × 74 | plastic crate |
| 79 | crates.png | 나무 상자 더미 | 1.6 × 0.9 | 250 × 144 | stack of wooden crates |
| 80 | sacks.png | 자루 | 1.1 × 0.6 | 150 × 79 | burlap sacks |
| 81 | basket.png | 바구니 | 0.5 × 0.5 | 150 × 147 | woven basket |
| 82 | pots.png | 항아리 | 1.3 × 0.7 | 150 × 82 | clay pots |
| 83 | jerrycans.png | 연료통 | 0.5 × 0.5 | 150 × 136 | jerrycans |
| 84 | crate_stack.png | 상자 더미 | 1.2 × 1 | 250 × 200 | stacked wooden boxes |
| 85 | drum_red.png | 드럼통 (빨강) | 0.7 × 0.9 | 194 × 250 | red 200 litre oil drum |
| 86 | drum_blue.png | 드럼통 (파랑) | 0.7 × 0.9 | 197 × 250 | blue 200 litre drum |
| 87 | ibc.png | IBC 탱크 | 1.5 × 1.1 | 150 × 118 | IBC water container in cage |
| 88 | water_tank.png | 물탱크 | 2.4 × 1.8 | 150 × 109 | plastic rooftop water tank |
| 89 | sandbags.png | 모래주머니 | 2 × 0.8 | 150 × 56 | sandbag wall |
| 90 | barrier1.png | 콘크리트 방벽 | 3 × 1.1 | 150 × 54 | concrete jersey barrier |
| 91 | barrier2.png | 콘크리트 방벽 | 3 × 1 | 150 × 52 | concrete jersey barrier, chipped |
| 92 | table.png | 탁자 | 1.7 × 0.8 | 150 × 66 | wooden market table |
| 93 | covered_goods.png | 덮인 짐 | 1.9 × 0.6 | 150 × 49 | goods under tarpaulin |
| 94 | red_table.png | 진열대 | 2.5 × 0.8 | 150 × 48 | market display table, red cloth |
| 95 | carpet_stand.png | 카펫 진열 | 2.3 × 0.8 | 150 × 52 | carpet display stand |
| 96 | flat_sacks.png | 쌓인 자루 | 1.6 × 0.5 | 150 × 46 | pile of flat sacks |
| 97 | pallet_goods.png | 팔레트 짐 | 1.1 × 0.5 | 150 × 67 | goods on a pallet |
| 98 | small_table.png | 작은 탁자 | 1.1 × 0.6 | 150 × 83 | small wooden table |
| 99 | roadblock1.png | 도로 차단기 | 1.8 × 1 | 150 × 84 | road checkpoint barrier |
| 100 | roadblock2.png | 도로 차단기 | 1.8 × 1 | 150 × 82 | road checkpoint barrier with sign |
| 101 | hedgehog.png | 대전차 장애물 | 1.3 × 1 | 150 × 113 | steel anti-tank hedgehog |
| 102 | tires1.png | 타이어 | 0.8 × 0.6 | 150 × 115 | stack of old tyres |
| 103 | tires2.png | 타이어 | 0.6 × 0.5 | 150 × 109 | pile of tyres |
| 104 | pallets.png | 팔레트 | 1.1 × 0.5 | 150 × 71 | stack of wooden pallets |
| 105 | table2.png | 탁자 | 1.2 × 0.8 | 150 × 93 | wooden table |
| 106 | stool.png | 의자 | 0.5 × 0.5 | 150 × 127 | plastic stool |
| 107 | crates_small.png | 작은 상자 | 1 × 0.6 | 150 × 87 | small crates |
| 108 | billboard.png | 대형 도로 광고판 → 파손 시 billboard_dmg | 5.7 × 5 | 284 × 250 | large roadside billboard, Arabic advertisement |
| 109 | roof_billboard.png | 옥상 광고판 (건물 모서리) | 5.6 × 7 | 280 × 350 | rooftop billboard frame on building corner |
| 110 | shop_sign.png | 상점 간판 (벽) | 2.4 × 4 | 118 × 200 | vertical shop sign on wall, Arabic |
| 111 | direction_sign.png | 방향 표지판 | 3.6 × 4.6 | 178 × 230 | green road direction sign, Arabic and English |
| 112 | poster_board.png | 선전 포스터판 | 2.8 × 3.6 | 140 × 180 | propaganda poster board |
| 113 | billboard_dmg.png | 파손된 광고판 → 파손 시 sign_frame | 4.7 × 5 | 237 × 250 | shot up damaged billboard |
| 114 | sign_frame.png | 파괴된 간판 프레임 | 3.7 × 4.2 | 186 × 210 | destroyed sign frame, bare steel |
| 115 | lamp.png | 가로등 → 파손 시 lamp_bent | 3.5 × 5.5 | 174 × 275 | single arm street lamp |
| 116 | lane_lamp.png | 동네 가로등 | 1.9 × 3.8 | 94 × 190 | small neighbourhood street lamp |
| 117 | traffic_light.png | 신호등 | 4.4 × 5.5 | 221 × 275 | traffic light on pole with arm |
| 118 | lamp_bent.png | 휜 가로등 → 파손 시 lamp_down | 4.4 × 4.8 | 221 × 240 | bent damaged street lamp |
| 119 | lamp_down.png | 쓰러진 가로등 | 6 × 1.7 | 300 × 84 | fallen street lamp lying on ground |
| 120 | trash_can.png | 금속 쓰레기통 → 파손 시 bin_burnt | 0.8 × 0.9 | 125 × 150 | metal trash can |
| 121 | wheelie_bin.png | 바퀴 쓰레기통 → 파손 시 bin_tipped | 1 × 1.1 | 131 × 150 | wheelie bin |
| 122 | dumpster.png | 대형 덤스터 | 2.7 × 1.5 | 150 × 84 | large metal dumpster |
| 123 | burn_drum.png | 오픈 드럼통 | 0.8 × 0.9 | 216 × 250 | open burn drum |
| 124 | bin_tipped.png | 쓰러진 쓰레기통 | 1.4 × 0.6 | 150 × 69 | tipped over bin with spilled rubbish |
| 125 | bin_burnt.png | 불탄 쓰레기통 | 1.7 × 1 | 150 × 88 | burnt trash bin |
| 126 | sedan.png | 소형 승용차 → 파손 시 sedan_dmg | 4.4 × 1.5 | 220 × 75 | 1980s small sedan car |
| 127 | old_sedan.png | 구형 세단 → 파손 시 old_sedan_dmg | 4.7 × 1.6 | 235 × 78 | 1970s large sedan car |
| 128 | pickup.png | 픽업트럭 → 파손 시 pickup_dmg | 5 × 1.7 | 250 × 87 | 1980s pickup truck |
| 129 | van.png | 화물밴 → 파손 시 van_dmg | 4.2 × 1.9 | 210 × 92 | 1980s cargo van |
| 130 | taxi.png | 택시 → 파손 시 taxi_burnt | 4.4 × 1.6 | 220 × 78 | 1980s Kuwait taxi sedan |
| 131 | sedan_dmg.png | 승용차 (파손) | 4.4 × 1.4 | 220 × 72 | damaged sedan, broken glass |
| 132 | old_sedan_dmg.png | 세단 (방치) | 4.7 × 1.4 | 235 × 72 | abandoned stripped sedan |
| 133 | pickup_dmg.png | 픽업트럭 (손상) | 5 × 1.6 | 250 × 78 | damaged pickup truck |
| 134 | taxi_burnt.png | 전소 차량 | 4.4 × 1.2 | 220 × 60 | burnt out car wreck |
| 135 | market_a.png | 시장 단지 A (파노라마) | 73.1 × 9.9 | 3654 × 495 | long souq market panorama facade |
| 136 | market_b.png | 시장 단지 B (파노라마) | 40.9 × 6.6 | 2045 × 329 | souq market panorama facade |
| 137 | shop_garage.png | 상점 (셔터) | 6.1 × 4 | 304 × 200 | shop with roller shutter |
| 138 | shop_awning.png | 상점 (차양) | 5.3 × 4.2 | 264 × 211 | shop front with awning |
| 139 | shop_clothes.png | 상점 (의류) | 6 × 5 | 300 × 250 | clothes shop front |
| 140 | shop_elec.png | 상점 (전자) | 5.1 × 5 | 254 × 250 | electronics shop front |
| 141 | van_dmg.png | 화물밴 (손상) | 4.2 × 1.5 | 210 × 74 | damaged cargo van |

## 5. 식생·바위·둔덕 (`assets/sprites/city/`, .webp)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 142 | bush1.webp | 관목 1 | 1.9 × 0.8 | 150 × 64 | dry desert shrub |
| 143 | bush2.webp | 관목 2 | 1.8 × 1.3 | 150 × 107 | desert shrub, grey-green |
| 144 | bush3.webp | 관목 3 | 1.2 × 1.1 | 150 × 134 | dry thorny bush |
| 145 | bush4.webp | 관목 4 | 1.7 × 1.4 | 150 × 126 | saltbush clump |
| 146 | bush5.webp | 관목 5 | 1.3 × 1.1 | 150 × 128 | dry desert shrub, sparse |
| 147 | bush6.webp | 관목 6 | 1.5 × 1.1 | 150 × 110 | desert shrub with dead branches |
| 148 | bush7.webp | 관목 7 | 1.4 × 1 | 150 × 107 | small dry bush |
| 149 | tree.webp | 나무  | 4.8 × 3.4 | 239 × 170 | desert acacia tree |
| 150 | grass1.webp | 마른 풀 1 | 1.1 × 0.8 | 150 × 114 | dry desert grass tuft |
| 151 | grass2.webp | 마른 풀 2 | 1 × 0.7 | 150 × 102 | dry grass tuft |
| 152 | grass3.webp | 마른 풀 3 | 0.6 × 0.6 | 150 × 140 | small dry grass tuft |
| 153 | grass4.webp | 마른 풀 4 | 0.7 × 0.6 | 150 × 128 | sparse dry grass |
| 154 | grass5.webp | 마른 풀 5 | 1.3 × 0.5 | 150 × 57 | tiny dry grass tuft |
| 155 | rock1.webp | 바위 1 | 2 × 0.9 | 150 × 67 | desert limestone rock, weathered |
| 156 | rock2.webp | 바위 2 | 1.6 × 0.5 | 150 × 47 | desert limestone rock, weathered |
| 157 | rock3.webp | 바위 3 | 3.9 × 0.9 | 194 × 45 | desert limestone rock, weathered |
| 158 | rock4.webp | 바위 4 | 1.6 × 0.4 | 150 × 37 | desert limestone rock, weathered |
| 159 | rock5.webp | 바위 5 | 2.9 × 0.6 | 150 × 31 | desert limestone rock, weathered |
| 160 | rock6.webp | 바위 6 | 2.4 × 0.6 | 150 × 34 | desert limestone rock, weathered |
| 161 | rock7.webp | 바위 7 | 2.5 × 0.8 | 150 × 46 | desert limestone rock, weathered |
| 162 | dune1.webp | 모래둔덕 1 | 5.3 × 1.4 | 263 × 70 | small sand drift mound |
| 163 | dune2.webp | 모래둔덕 2 | 6.2 × 1.5 | 310 × 75 | small sand dune hummock |

## 6. 건물 잔해 (`assets/sprites/city/`, .webp — 게임이 0.3–0.9 m로 줄여 흩뿌림)

| # | 파일명 | 내용 | 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 164 | pile1.webp | 콘크리트 잔해 더미 1 | ≈0.9 × 0.4 | 250 × 103 | pile of concrete rubble |
| 165 | pile2.webp | 콘크리트 잔해 더미 2 | ≈0.9 × 0.3 | 250 × 92 | pile of concrete rubble |
| 166 | pile3.webp | 콘크리트 잔해 더미 3 | ≈0.9 × 0.3 | 250 × 91 | pile of concrete rubble |
| 167 | pile4.webp | 콘크리트 잔해 더미 4 | ≈0.9 × 0.4 | 250 × 100 | pile of concrete rubble |
| 168 | pile5.webp | 콘크리트 잔해 더미 5 | ≈0.9 × 0.3 | 250 × 97 | pile of concrete rubble |
| 169 | conc1.webp | 콘크리트 조각 1 | ≈0.9 × 0.7 | 250 × 190 | broken concrete chunk |
| 170 | conc2.webp | 콘크리트 조각 2 | ≈0.9 × 0.5 | 250 × 144 | broken concrete chunk |
| 171 | conc3.webp | 콘크리트 조각 3 | ≈0.9 × 0.6 | 250 × 161 | broken concrete chunk |
| 172 | conc4.webp | 콘크리트 조각 4 | ≈0.9 × 0.7 | 250 × 184 | broken concrete chunk |
| 173 | conc5.webp | 콘크리트 조각 5 | ≈0.9 × 0.6 | 250 × 178 | broken concrete chunk |
| 174 | conc6.webp | 콘크리트 조각 6 | ≈0.9 × 1 | 231 × 250 | broken concrete chunk |
| 175 | conc7.webp | 콘크리트 조각 7 | ≈0.9 × 1 | 228 × 250 | broken concrete chunk |
| 176 | brick1.webp | 벽돌 조각 1 | ≈0.9 × 0.6 | 250 × 167 | broken bricks |
| 177 | brick2.webp | 벽돌 조각 2 | ≈0.9 × 0.6 | 250 × 175 | broken bricks |
| 178 | brick3.webp | 벽돌 조각 3 | ≈0.9 × 0.4 | 250 × 118 | broken bricks |
| 179 | grit1.webp | 자갈·부스러기 1 | ≈0.9 × 0.6 | 250 × 159 | gravel and grit spill |
| 180 | grit2.webp | 자갈·부스러기 2 | ≈0.9 × 0.2 | 250 × 59 | gravel and grit spill |
| 181 | wall1.webp | 벽 파편 1 | ≈0.9 × 0.5 | 250 × 151 | broken wall fragment |
| 182 | wall2.webp | 벽 파편 2 | ≈0.9 × 0.7 | 250 × 206 | broken wall fragment |
| 183 | wall3.webp | 벽 파편 3 | ≈0.9 × 0.6 | 250 × 162 | broken wall fragment |
| 184 | wall4.webp | 벽 파편 4 | ≈0.9 × 0.5 | 250 × 135 | broken wall fragment |
| 185 | wall5.webp | 벽 파편 5 | ≈0.9 × 1.5 | 155 × 250 | broken wall fragment |
| 186 | slab1.webp | 바닥 슬래브 조각 1 | ≈0.9 × 1 | 234 × 250 | broken floor slab |
| 187 | block1.webp | 블록 조각 1 | ≈0.9 × 0.7 | 250 × 195 | concrete block piece |
| 188 | block2.webp | 블록 조각 2 | ≈0.9 × 0.6 | 250 × 159 | concrete block piece |
| 189 | col1.webp | 부러진 기둥 1 | ≈0.9 × 1.4 | 165 × 250 | broken concrete column |
| 190 | col2.webp | 부러진 기둥 2 | ≈0.9 × 0.6 | 250 × 171 | broken concrete column |
| 191 | arch.webp | 아치 조각  | ≈0.9 × 0.5 | 250 × 130 | broken arch piece |
| 192 | pillar.webp | 부러진 기둥  | ≈0.9 × 1.5 | 154 × 250 | broken pillar |
| 193 | rebar1.webp | 휜 철근 1 | ≈0.9 × 0.5 | 250 × 152 | twisted rebar |
| 194 | rebar2.webp | 휜 철근 2 | ≈0.9 × 0.6 | 250 × 167 | twisted rebar |
| 195 | rebar3.webp | 휜 철근 3 | ≈0.9 × 1.2 | 193 × 250 | twisted rebar |
| 196 | rebar4.webp | 휜 철근 4 | ≈0.9 × 0.8 | 250 × 222 | twisted rebar |
| 197 | beam1.webp | 철골 보 1 | ≈0.9 × 0.4 | 150 × 75 | broken steel beam |
| 198 | beam2.webp | 철골 보 2 | ≈0.9 × 0.4 | 150 × 72 | broken steel beam |
| 199 | sheet1.webp | 휜 함석판 1 | ≈0.9 × 0.5 | 250 × 138 | bent corrugated metal sheet |
| 200 | sheet2.webp | 휜 함석판 2 | ≈0.9 × 0.4 | 250 × 121 | bent corrugated metal sheet |
| 201 | sheet3.webp | 휜 함석판 3 | ≈0.9 × 0.3 | 250 × 81 | bent corrugated metal sheet |
| 202 | sheet4.webp | 휜 함석판 4 | ≈0.9 × 0.3 | 250 × 92 | bent corrugated metal sheet |
| 203 | pipe.webp | 파이프  | ≈0.9 × 0.3 | 250 × 81 | broken pipe |
| 204 | sack1.webp | 찢어진 자루 1 | ≈0.9 × 0.4 | 250 × 112 | torn sandbag |
| 205 | sack2.webp | 찢어진 자루 2 | ≈0.9 × 0.4 | 250 × 101 | torn sandbag |
| 206 | sack3.webp | 찢어진 자루 3 | ≈0.9 × 0.5 | 250 × 129 | torn sandbag |
| 207 | wood1.webp | 부서진 목재 1 | ≈0.9 × 0.4 | 250 × 121 | broken timber |
| 208 | wood2.webp | 부서진 목재 2 | ≈0.9 × 0.5 | 250 × 127 | broken timber |
| 209 | wood3.webp | 부서진 목재 3 | ≈0.9 × 0.4 | 250 × 101 | broken timber |
| 210 | burnt1.webp | 탄 잔해 1 | ≈0.9 × 0.5 | 250 × 129 | charred debris |
| 211 | burnt2.webp | 탄 잔해 2 | ≈0.9 × 0.4 | 250 × 121 | charred debris |
| 212 | burnt3.webp | 탄 잔해 3 | ≈0.9 × 0.4 | 250 × 113 | charred debris |
| 213 | burnt4.webp | 탄 잔해 4 | ≈0.9 × 0.4 | 250 × 110 | charred debris |
| 214 | barrel.webp | 찌그러진 드럼통  | ≈0.9 × 1.1 | 207 × 250 | dented drum |
| 215 | barrel2.webp | 찌그러진 드럼통 2 | ≈0.9 × 0.5 | 250 × 131 | dented drum |
| 216 | barrel3.webp | 찌그러진 드럼통 3 | ≈0.9 × 0.6 | 250 × 153 | dented drum |
| 217 | crate.webp | 부서진 상자  | ≈0.9 × 0.7 | 250 × 183 | broken crate |
| 218 | crate2.webp | 부서진 상자 2 | ≈0.9 × 0.5 | 250 × 133 | broken crate |
| 219 | glass1.webp | 깨진 유리 1 | ≈0.9 × 0.3 | 250 × 85 | shattered glass shards |
| 220 | glass2.webp | 깨진 유리 2 | ≈0.9 × 0.4 | 250 × 102 | shattered glass shards |
| 221 | glass3.webp | 깨진 유리 3 | ≈0.9 × 0.4 | 250 × 104 | shattered glass shards |
| 222 | gravel.webp | 자갈 더미  | ≈0.9 × 0.2 | 250 × 68 | gravel heap |
| 223 | mixed1.webp | 섞인 잔해 1 | ≈0.9 × 0.4 | 250 × 103 | mixed building debris |
| 224 | mixed2.webp | 섞인 잔해 2 | ≈0.9 × 0.4 | 250 × 100 | mixed building debris |
| 225 | mixed3.webp | 섞인 잔해 3 | ≈0.9 × 0.3 | 250 × 95 | mixed building debris |
| 226 | mixed4.webp | 섞인 잔해 4 | ≈0.9 × 0.4 | 250 × 114 | mixed building debris |

## 7. 지면 텍스처 (`assets/sprites/ground/`, .jpg — 위에서 내려다본 면, **반복 타일링**, 지금은 256 px)

| # | 파일명 | 내용 | 실제 범위 | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 227 | road.jpg | 갈라진 아스팔트 도로면 | 8 × 8 m 반복 | 1024 × 1024 | top-down cracked worn asphalt, dusty, seamless tileable |
| 228 | alley1.jpg | 보도·골목 바닥 (다진 흙, 잔돌) | 6 × 6 m 반복 | 1024 × 1024 | top-down packed beige dirt with small pebbles, seamless |
| 229 | alley2.jpg | 낡은 포장면 (회색 흙·자갈 섞임) | 6 × 6 m 반복 | 1024 × 1024 | top-down worn grey gravel and dirt paving with sand patches, seamless |
| 230 | lot1.jpg | 공터 (모래·잔돌) | 8 × 8 m 반복 | 1024 × 1024 | top-down vacant lot gravel and sand, seamless |
| 231 | lot2.jpg | 공터 (바퀴 자국 난 모래) | 8 × 8 m 반복 | 1024 × 1024 | top-down sandy lot with tyre tracks and pebbles, seamless |
