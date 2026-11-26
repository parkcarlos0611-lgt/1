# 시험 주행 사이드샷 — 이미지 요청 목록 (초안, 계획 §24와 같이 승인)

형식은 Desert Steel(`tank/docs/P1_IMAGES.md`)의 요청서를 따릅니다. 파일명을 그대로 쓰면 코드가 바로 읽습니다.
넣을 곳: `gearhouse/assets/drive/원본/` (원본은 커밋하지 않음, §24-6 참고). 게임에 쓰는 결과물은 도구가 `gearhouse/assets/drive/`에 만듭니다.

## 공통 규격 (모든 장)

- **시점:** 정측면(입면). 원근은 거의 없게, 눈높이 1.5 m. 지붕이나 윗면이 아주 조금 보이는 정도.
- **배경:** 완전 투명. 투명이 안 되는 생성기는 **순수 마젠타(#FF00FF) 단색 배경**. 이미지 하나에 물체 하나(묶음 항목은 예외).
- **접지선:** 물체 바닥이 이미지 맨 아래에 수평으로 닿게 합니다.
- **그림자:** 바닥 그림자 없음(게임이 해 위치에 따라 그림). 물체 자체 음영은 있음.
- **조명:** 왼쪽 위 45°의 부드러운 한낮 햇빛으로 통일합니다(게임이 시각별로 색만 바꿈). 석양·밤·역광은 쓰지 않습니다.
- **해상도:** 실제 1 m = 50 px 기준입니다. 권장 px보다 크면 괜찮습니다. 게임은 1 m = 40 px(차 그림과 같은 25 mm/px)로 줄여서 씁니다.
- **글자·상표 금지:** 간판, 광고판, 번호판, 차·주유소·타이어 회사 이름과 로고는 모두 빼 주세요. 글자 자리는 빈 판이나 무늬로 둡니다.
- **시대:** 항목마다 적은 시대를 지킵니다. 시대 표기가 없으면 1930–1960년 미국·유럽 시골.
- **이어 붙이기:** "타일"이라고 적은 것은 좌우 끝이 이어지게(seamless left-right) 만듭니다.

영어 프롬프트 공통 꼬리말:
`orthographic side elevation view, photorealistic, 1930s-1950s countryside, soft midday sunlight from upper left, isolated on transparent background, no ground shadow, no text, no logos, full object visible, flat ground line at bottom`

---

## 1. 하늘·원경 레이어 (타일, 배경 투명 아님) — 8장

화면 전체 폭을 덮는 띠입니다. 맨 아래가 지평선입니다.

| # | 파일명 | 내용 | 권장 px | 프롬프트 |
|---|---|---|---|---|
| 1 | sky_clear.png | 맑은 하늘, 위는 짙고 지평선 쪽은 옅음, 흰 구름 몇 점 | 3840 × 1080 | clear summer sky gradient with a few small cumulus clouds, seamless left-right |
| 2 | sky_overcast.png | 흐린 하늘, 낮은 회색 구름층 | 3840 × 1080 | overcast grey sky, low stratus, seamless left-right |
| 3 | far_hills.png | 먼 산줄기, 푸르고 흐림(대기 원근). 하늘 부분 투명 | 3840 × 500 | distant blue hazy mountain range silhouette, seamless left-right, transparent sky |
| 4 | far_plain.png | 먼 평야와 띄엄띄엄 농가·나무 실루엣. 하늘 투명 | 3840 × 300 | distant farmland with tiny farmhouses and tree lines, hazy, seamless, transparent sky |
| 5 | mid_hills.png | 중경 언덕, 밭과 수풀, 원경보다 선명. 하늘 투명 | 3840 × 600 | rolling green hills with fields and hedgerows, mid distance, seamless, transparent sky |
| 6 | mid_woods.png | 중경 숲 가장자리. 하늘 투명 | 3840 × 500 | edge of a deciduous forest at mid distance, seamless, transparent sky |
| 7 | mid_desert.png | 중경 사막 고원과 메사(시험장 2용). 하늘 투명 | 3840 × 600 | arid plateau with mesas, mid distance, seamless, transparent sky |
| 8 | far_city.png | 먼 공장 지대 실루엣과 굴뚝(간판 없음). 하늘 투명 | 3840 × 450 | distant 1930s industrial town silhouette with smokestacks, hazy, no signs, seamless |

## 2. 노면·지면 단면 (타일) — 7장

도로 면과 그 아래 흙 단면입니다. 위쪽 1/4이 노면, 아래가 흙입니다.

| # | 파일명 | 내용 | 실제 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 9 | gnd_tar.png | 아스팔트 노면 단면, 아래 자갈 기층과 흙 | 8 × 2 | 400 × 100 | cross-section of an asphalt road: tar surface, gravel base, soil below, seamless left-right |
| 10 | gnd_concrete.png | 콘크리트 판 노면, 이음매 6 m 간격 | 12 × 2 | 600 × 100 | cross-section of concrete slab road with expansion joint, seamless |
| 11 | gnd_gravel.png | 자갈길, 굵은 돌 | 8 × 2 | 400 × 100 | cross-section of a loose gravel road, seamless |
| 12 | gnd_dirt.png | 다져진 흙길, 바퀴 자국 | 8 × 2 | 400 × 100 | cross-section of a packed dirt road with ruts, seamless |
| 13 | gnd_sand.png | 고운 모래(사막 시험장) | 8 × 2 | 400 × 100 | cross-section of fine desert sand, wind ripples on top, seamless |
| 14 | gnd_brick.png | 벽돌 포장(1930년대 시내) | 8 × 2 | 400 × 100 | cross-section of a brick-paved street, seamless |
| 15 | gnd_grass.png | 풀 둔덕(길섶), 위쪽 풀 끝은 투명 | 8 × 1.5 | 400 × 75 | grassy roadside verge, tufts on top, transparent above, seamless |

## 3. 길가 소품 — 시험 도로·시골 (24장)

| # | 파일명 | 내용 | 실제 크기 (폭×높이 m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 16 | tree_oak1.png | 다 자란 참나무 | 10 × 12 | 500 × 600 | mature oak tree, full canopy |
| 17 | tree_oak2.png | 참나무, 한쪽이 성김 | 9 × 11 | 450 × 550 | oak tree with uneven canopy |
| 18 | tree_poplar1.png | 미루나무(가로수), 가늘고 높음 | 3 × 16 | 150 × 800 | lombardy poplar, tall and narrow |
| 19 | tree_poplar2.png | 미루나무, 약간 휨 | 3 × 15 | 150 × 750 | lombardy poplar, slightly leaning |
| 20 | tree_pine1.png | 소나무 | 6 × 13 | 300 × 650 | scots pine tree |
| 21 | tree_dead1.png | 마른 나무 | 6 × 8 | 300 × 400 | dead leafless tree |
| 22 | bush1.png | 낮은 덤불 | 3 × 1.5 | 150 × 75 | low roadside shrub |
| 23 | bush2.png | 산울타리 조각, 타일 | 6 × 1.6 | 300 × 80 | trimmed hedgerow, seamless left-right |
| 24 | pole_tele1.png | 나무 전신주, 가로대 2개와 애자 | 1.6 × 8 | 80 × 400 | wooden telegraph pole with two crossarms and glass insulators |
| 25 | pole_tele2.png | 전신주, 기울어짐 | 1.6 × 8 | 80 × 400 | leaning wooden telegraph pole |
| 26 | fence_rail.png | 흰 나무 난간 울타리, 타일 | 6 × 1.2 | 300 × 60 | white painted wooden rail fence, seamless |
| 27 | fence_wire.png | 철조망 목장 울타리, 타일 | 6 × 1.3 | 300 × 65 | barbed wire farm fence with wooden posts, seamless |
| 28 | wall_stone.png | 돌담, 타일 | 6 × 1.1 | 300 × 55 | dry stone wall, seamless |
| 29 | barn1.png | 붉은 헛간(글자 없음) | 14 × 9 | 700 × 450 | red wooden barn, no text |
| 30 | farmhouse1.png | 농가 | 12 × 8 | 600 × 400 | 1930s farmhouse with porch |
| 31 | windmill1.png | 양수용 풍차 | 3 × 10 | 150 × 500 | farm water-pumping windmill |
| 32 | silo1.png | 곡물 사일로 | 5 × 14 | 250 × 700 | grain silo, weathered |
| 33 | haystack1.png | 건초 더미 | 4 × 3 | 200 × 150 | haystack |
| 34 | post_mile.png | 거리 표지석(글자 없음) | 0.4 × 0.8 | 20 × 40 | stone mile marker, blank |
| 35 | sign_blank1.png | 길가 경고 표지판 판(무늬만, 글자 없음) | 0.8 × 2.4 | 40 × 120 | roadside warning sign on post, blank face, no text |
| 36 | bridge_stone.png | 작은 돌다리 난간(길과 같은 높이), 타일 | 10 × 1.5 | 500 × 75 | low stone bridge parapet, seamless |
| 37 | culvert.png | 길 밑 배수로 입구(단면 레이어 앞) | 2 × 1.5 | 100 × 75 | stone culvert opening |
| 38 | rock1.png | 길가 바위 | 2 × 1.2 | 100 × 60 | roadside boulder |
| 39 | rock_small.png | 작은 돌·자갈 묶음 | 1.5 × 0.4 | 75 × 20 | scattered small stones |

## 4. 시험장·서킷 소품 (16장)

| # | 파일명 | 내용 | 실제 크기 (m) | 권장 px | 프롬프트 |
|---|---|---|---|---|---|
| 40 | stand_wood.png | 나무 관중석, 관중 없음 | 30 × 8 | 1500 × 400 | 1930s wooden grandstand, empty, no text |
| 41 | stand_crowd.png | 같은 관중석, 관중 있음(같은 캔버스) | 30 × 8 | 1500 × 400 | same grandstand full of 1930s spectators |
| 42 | pit_shed.png | 피트 창고 줄, 타일(글자 없음) | 20 × 5 | 1000 × 250 | row of wooden pit garages, no text, seamless |
| 43 | timing_tower.png | 계시탑(숫자판 빈칸) | 4 × 10 | 200 × 500 | race timing tower with blank board |
| 44 | hay_bales.png | 코너 바깥 짚단 방호벽, 타일 | 6 × 1.2 | 300 × 60 | straw bale barrier, seamless |
| 45 | rail_steel.png | 철제 방호 레일, 타일 | 6 × 0.9 | 300 × 45 | steel guard rail, seamless |
| 46 | bank_wall.png | 경사 오벌 바깥 콘크리트 벽(경사면은 게임이 그림) | 10 × 3 | 500 × 150 | concrete banking retaining wall, seamless |
| 47 | marshal_post.png | 진행요원 초소 | 3 × 3 | 150 × 150 | small marshal hut |
| 48 | flag_pole.png | 깃대(깃발은 게임이 그림) | 0.3 × 6 | 15 × 300 | flag pole |
| 49 | test_gantry.png | 측정 구간 문(계측 시작·끝) | 12 × 6 | 600 × 300 | steel timing gantry over a test track, no text |
| 50 | water_tank.png | 급수탑 | 5 × 12 | 250 × 600 | water tower on steel legs |
| 51 | factory_shed.png | 공장 시험장 창고(톱니 지붕) | 30 × 10 | 1500 × 500 | 1930s factory shed with sawtooth roof, no signs |
| 52 | ford_water.png | 얕은 여울(물 표면 단면), 타일 | 8 × 0.6 | 400 × 30 | shallow ford water surface cross-section, seamless |
| 53 | mud_patch.png | 진흙 웅덩이 단면 | 6 × 0.5 | 300 × 25 | muddy puddle cross-section |
| 54 | cactus1.png | 사막 덤불·선인장(시험장 2) | 2 × 3 | 100 × 150 | desert shrub and saguaro cactus |
| 55 | mesa_near.png | 가까운 바위 절벽(시험장 2, 길 뒤) | 30 × 15 | 1500 × 750 | near sandstone cliff face, transparent sky |

## 5. 앞쪽 전경 (차 앞을 지나가는 것, 반투명 처리) — 5장

| # | 파일명 | 내용 | 권장 px | 프롬프트 |
|---|---|---|---|---|
| 56 | fg_grass.png | 가까운 키 큰 풀, 타일 | 800 × 200 | tall grass very close to camera, blurred, seamless |
| 57 | fg_post.png | 가까운 울타리 기둥 | 60 × 400 | wooden fence post close to camera, slightly blurred |
| 58 | fg_reeds.png | 가까운 갈대 | 600 × 300 | reeds close to camera, blurred |
| 59 | fg_rocks.png | 가까운 돌무더기 | 600 × 150 | rocks close to camera, blurred |
| 60 | fg_bales.png | 가까운 짚단 | 400 × 200 | straw bales close to camera, blurred |

**합계 60장.** 시대별(1960–2000) 판과 도시 구간은 2차 요청으로 따로 정리합니다.
