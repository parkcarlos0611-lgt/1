// Missions: start position, enemy positions (checked for line of sight on terrain seed 7), conditions.
// env.visibility: metres of sight through dust (0 = clear); env.night: 0..1; env.wind: m/s (+ = toward +x).
window.DS = window.DS || {};
DS.MISSIONS = [
  {
    id: 'breach', name: '국경 돌파', date: '1991년 2월 24일 06:40',
    brief: '국경 방벽을 넘은 직후, 둔덕 진지에 배치된 이라크군 전차 소대와 마주쳤다. 사구 뒤에 한 대가 더 있다. 레이저로 거리를 재고 한 대씩 격파하라.',
    cond: '맑음 · 시정 양호 · 바람 2.5 m/s', start: 60,
    env: { visibility: 0, night: 0, wind: 2.5, sun: { el: 14, side: 1 } },   // sun: elevation (deg), side +1 = from +x
    enemies: [['t55', 700, 'T-55'], ['t72', 911, 'T-72 #1 (진지)'], ['t62', 975, 'T-62'], ['t72', 2150, 'T-72 #2 (사구 뒤)']],
  },
  {
    id: 'storm', name: '모래폭풍 속 조우전', date: '1991년 2월 26일 16:10',
    brief: '모래폭풍으로 맨눈 시정이 수백 m로 떨어졌다. 열상 조준경(T)은 먼지를 더 멀리 꿰뚫어 본다. 적은 아직 우리를 보지 못했다. 먼저 발견하고 먼저 쏴라.',
    cond: '모래폭풍 · 시정 약 700 m · 바람 9 m/s', start: 1300,
    env: { visibility: 700, night: 0, wind: 9, sun: { el: 22, side: -1 } },
    enemies: [['t72', 2100, 'T-72 #1'], ['t62', 2260, 'T-62'], ['t72', 2420, 'T-72 #2'], ['t55', 2620, 'T-55'], ['t72', 2800, 'T-72 #3']],
  },
  {
    id: 'night', name: '야간 기동', date: '1991년 2월 27일 01:20',
    brief: '달 없는 밤이다. 적의 적외선 조준경은 800 m 안쪽만 본다. 열상 조준경(T)으로 엔진 열을 찾아 원거리에서 끝내라. 발포하면 섬광으로 위치가 드러난다.',
    cond: '야간 · 월광 없음 · 바람 1 m/s', start: 3000,
    env: { visibility: 0, night: 1, wind: 1, sun: null },
    enemies: [['t55', 3500, 'T-55'], ['t62', 3660, 'T-62'], ['t72', 4250, 'T-72 #1'], ['t72', 4380, 'T-72 #2']],
  },
];
