// Missions: start position, enemy positions (checked for line of sight on terrain seed 7), conditions.
// env.visibility: metres of sight through dust (0 = clear); env.night: 0..1; env.wind: m/s (+ = toward +x).
window.DS = window.DS || {};
DS.MISSIONS = [
  {
    id: 'breach', name: '국경 돌파', date: '1991년 2월 24일 06:40',
    brief: '국경 방벽을 넘은 직후, 둔덕 진지에 배치된 이라크군 전차 소대와 마주쳤다. 사구 뒤에 한 대가 더 있다. 레이저로 거리를 재고 한 대씩 격파하라.',
    cond: '맑음 · 시정 양호 · 바람 2.5 m/s', start: 60,
    env: { visibility: 0, wind: 2.5, time: '06:40' },   // time: local clock at the start (the sun follows, src/world/Sky.js)
    enemies: [['t55', 700, 'T-55'], ['t72', 911, 'T-72 #1 (진지)'], ['t62', 975, 'T-62'], ['t72', 2150, 'T-72 #2 (사구 뒤)']],
  },
  {
    id: 'storm', name: '모래폭풍 속 조우전', date: '1991년 2월 26일 16:10',
    brief: '모래폭풍으로 맨눈 시정이 수백 m로 떨어졌다. 열상 조준경(T)은 먼지를 더 멀리 꿰뚫어 본다. 적은 아직 우리를 보지 못했다. 먼저 발견하고 먼저 쏴라.',
    cond: '모래폭풍 · 시정 약 700 m · 바람 9 m/s', start: 1300,
    env: { visibility: 700, wind: 9, time: '16:10' },
    enemies: [['t72', 2100, 'T-72 #1'], ['t62', 2260, 'T-62'], ['t72', 2420, 'T-72 #2'], ['t55', 2620, 'T-55'], ['t72', 2800, 'T-72 #3']],
  },
  {
    id: 'night', name: '야간 기동', date: '1991년 2월 27일 01:20',
    brief: '달 없는 밤이다. 적의 적외선 조준경은 800 m 안쪽만 본다. 열상 조준경(T)으로 엔진 열을 찾아 원거리에서 끝내라. 발포하면 섬광으로 위치가 드러난다.',
    cond: '야간 · 월광 없음 · 바람 1 m/s', start: 3000,
    env: { visibility: 0, wind: 1, time: '01:20', moonless: true },      // (the brief's moonless night: the moon is left out)
    enemies: [['t55', 3500, 'T-55'], ['t62', 3660, 'T-62'], ['t72', 4250, 'T-72 #1'], ['t72', 4380, 'T-72 #2']],
  },
];
// the last mission
DS.MISSIONS.push(
  // Kuwait: the advance on the town map (data/town.js) from its west end. Forces as the user set them; the
  // scenario (phases, objectives) comes later. Iraqi platoons of three, Soviet fashion.
  //   friends: [vehicle, x, label, ai options]  (the first is the player's)   enemies: [vehicle, x, label, mode]
  {
    id: 'kuwait', name: '쿠웨이트 진격', date: '1991년 2월 25일 05:30', map: 'town',
    brief: '미 해병 전차대대가 국경 장애물 지대를 넘어 쿠웨이트시 외곽으로 들어선다. M60A1 2개 소대가 전진하고 AH-1W 코브라 2기가 뒤에서 엄호한다. 외곽 검문소와 창고 지대에 T-55 3개 소대, 도심 교차로에 T-62 2개 소대와 T-72가 있다. (시나리오 추후)',
    cond: '새벽 · 맑음 · 바람 3 m/s', start: 520,
    env: { visibility: 0, wind: 3, time: '05:30' },
    player: 'm60a1',
    friends: [
      ['m60a1', 520, '1소대 1호 (나)'], ['m60a1', 495, '1소대 2호'], ['m60a1', 470, '1소대 3호'], ['m60a1', 445, '1소대 4호'],
      ['m60a1', 400, '2소대 1호'], ['m60a1', 375, '2소대 2호'], ['m60a1', 350, '2소대 3호'], ['m60a1', 325, '2소대 4호'],
      ['ah1w', 0, '코브라 1', { heli: true, back: 600, alt: 45 }], ['ah1w', 0, '코브라 2', { heli: true, back: 850, alt: 35 }],
    ],
    enemies: [
      ['t55', 2300, 'T-55 1소대 1호', 'hold'], ['t55', 2328, 'T-55 1소대 2호', 'hold'], ['t55', 2356, 'T-55 1소대 3호', 'hold'],
      ['t55', 3400, 'T-55 2소대 1호', 'hold'], ['t55', 3426, 'T-55 2소대 2호', 'hold'], ['t55', 3452, 'T-55 2소대 3호', 'hold'],
      ['t55', 4500, 'T-55 3소대 1호', 'hold'], ['t55', 4526, 'T-55 3소대 2호', 'hold'], ['t55', 4552, 'T-55 3소대 3호', 'hold'],
      ['t62', 11500, 'T-62 1소대 1호', 'hold'], ['t62', 11528, 'T-62 1소대 2호', 'hold'], ['t62', 11556, 'T-62 1소대 3호', 'hold'],
      ['t62', 12800, 'T-62 2소대 1호', 'hold'], ['t62', 12828, 'T-62 2소대 2호', 'hold'], ['t62', 12856, 'T-62 2소대 3호', 'hold'],
      ['t72', 13500, 'T-72 1호', 'combat'], ['t72', 13530, 'T-72 2호', 'combat'],
    ],
  }
);
