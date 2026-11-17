// Technology & parts catalogue. Every option has intro (first available, costly & unproven)
// and mass (mass-production year: cheap, mature). Costs are in 1946 dollars and are
// scaled by CPI at run time. Immature tech costs more and is less reliable.
(function (MW) {
  const U = MW.U, D = MW.data;
  D.maturity = (o, y) => {
    if (o.intro == null) return 1;
    if (y < o.intro) return 0; // unavailable
    const m = o.mp == null ? o.intro + 25 : o.mp;
    return U.clamp(0.25 + 0.75 * (y - o.intro) / Math.max(1, m - o.intro), 0.25, 1);
  };
  D.avail = (o, y) => (o.intro == null || y >= o.intro) && (o.end == null || y < o.end);
  D.techCost = (o, y) => (o.cost || 0) * (1 + 1.6 * (1 - D.maturity(o, y))); // immature = up to 2.2x
  D.techRel = (o, y) => -14 * (1 - D.maturity(o, y)); // reliability penalty, points
  D.byId = (list, id) => list.find(o => o.id === id) || list[0];
  D.list = (list, y) => list.filter(o => D.avail(o, y));

  // ── ENGINE ───────────────────────────────────────────────────────────────
  D.E = {};
  D.E.layouts = [
    { id: 'I', name: '직렬 (Inline)', cyls: [1, 2, 3, 4, 5, 6, 8], intro: 1900 },
    { id: 'V', name: 'V형', cyls: [2, 4, 6, 8, 10, 12, 16], angles: [45, 60, 72, 90, 120], intro: 1900 },
    { id: 'B', name: '수평대향 (Boxer)', cyls: [2, 4, 6, 8, 12], intro: 1900 },
    { id: 'W', name: 'W형', cyls: [8, 12, 16], intro: 1999, mp: 2010 }
  ];
  // primary/secondary balance & firing evenness → base smoothness 0..1
  D.E.balance = (lay, n, ang) => {
    const t = {
      I: { 1: .18, 2: .34, 3: .55, 4: .62, 5: .74, 6: .96, 8: .97 },
      V: { 2: .3, 4: .52, 6: ang === 60 || ang === 120 ? .82 : ang === 90 ? .68 : .74, 8: ang === 90 ? .9 : .72, 10: ang === 72 ? .9 : .8, 12: ang === 60 ? 1 : .95, 16: .99 },
      B: { 2: .58, 4: .8, 6: .98, 8: .96, 12: 1 },
      W: { 8: .86, 12: .97, 16: .98 }
    };
    return (t[lay] && t[lay][n]) || .5;
  };
  D.E.fuelTypes = [{ id: 'gas', name: '가솔린' }, { id: 'diesel', name: '디젤', intro: 1946 }];
  D.E.blockMat = [
    { id: 'iron', name: '주철', dens: 1, cost: 18, rel: 4, heat: 0 },
    { id: 'alu', name: '알루미늄 합금', dens: .52, cost: 46, rel: -2, heat: .04, intro: 1946, mp: 1995 },
    { id: 'cgi', name: 'CGI (컴팩티드 흑연주철)', dens: .85, cost: 40, rel: 6, heat: 0, intro: 1999, mp: 2010 }
  ];
  D.E.headMat = [
    { id: 'iron', name: '주철 헤드', dens: 1, cost: 8, knock: 0 },
    { id: 'alu', name: '알루미늄 헤드', dens: .5, cost: 18, knock: .6, intro: 1946, mp: 1965 }
  ];
  // valvetrain: ve = peak volumetric efficiency, rpm = practical valve-float limit
  D.E.heads = [
    { id: 'flat', name: '사이드밸브 (플랫헤드)', ve: .72, rpm: 4600, cost: 6, mass: 1, knock: -.6, emis: 1.25, valves: [2] },
    { id: 'ohv', name: 'OHV 푸시로드', ve: .83, rpm: 6600, cost: 10, mass: 1.04, knock: 0, emis: 1.0, valves: [2, 3, 4], intro: 1900 },
    { id: 'sohc', name: 'SOHC', ve: .87, rpm: 7400, cost: 16, mass: 1.03, knock: .2, emis: .95, valves: [2, 3, 4], intro: 1946, mp: 1970 },
    { id: 'dohc', name: 'DOHC', ve: .91, rpm: 8600, cost: 26, mass: 1.08, knock: .5, emis: .9, valves: [2, 4, 5], intro: 1946, mp: 1988 }
  ];
  D.E.valves = [
    { id: 2, name: '2밸브', ve: 0, rpm: 0, cost: 0 },
    { id: 3, name: '3밸브', ve: .03, rpm: 200, cost: 3, intro: 1975, mp: 1990 },
    { id: 4, name: '4밸브', ve: .07, rpm: 600, cost: 7, intro: 1946, mp: 1990 },
    { id: 5, name: '5밸브', ve: .08, rpm: 700, cost: 10, intro: 1989, mp: 2005 }
  ];
  // cap = air-flow capacity (m³/s per 1.0 of rating); bsfc multiplier; mixture precision
  D.E.fuelSys = [
    { id: 'carb1', name: '1배럴 카뷰레터', fuel: 'gas', cap: .045, ve: .94, bsfc: 1.12, emis: 1.25, cost: 3, prec: .3 },
    { id: 'carb2', name: '2배럴 카뷰레터', fuel: 'gas', cap: .09, ve: .96, bsfc: 1.1, emis: 1.2, cost: 5, prec: .35, intro: 1932, mp: 1950 },
    { id: 'carb4', name: '4배럴 카뷰레터', fuel: 'gas', cap: .19, ve: .97, bsfc: 1.12, emis: 1.25, cost: 8, prec: .35, intro: 1952, mp: 1960 },
    { id: 'carbm', name: '멀티 카뷰레터 (기통당)', fuel: 'gas', cap: .3, ve: 1.0, bsfc: 1.13, emis: 1.3, cost: 14, prec: .3, intro: 1946, mp: 1960, perCyl: 1 },
    { id: 'mech', name: '기계식 연료분사', fuel: 'gas', cap: .3, ve: 1.02, bsfc: 1.03, emis: 1.0, cost: 30, prec: .55, intro: 1954, mp: 1975 },
    { id: 'tbi', name: '전자식 스로틀바디 분사(TBI)', fuel: 'gas', cap: .2, ve: .98, bsfc: 1.0, emis: .7, cost: 14, prec: .75, intro: 1980, mp: 1985 },
    { id: 'mpfi', name: '다점분사 (MPFI)', fuel: 'gas', cap: .5, ve: 1.03, bsfc: .95, emis: .5, cost: 18, prec: .9, intro: 1983, mp: 1992 },
    { id: 'gdi', name: '직분사 (GDI)', fuel: 'gas', cap: .5, ve: 1.04, bsfc: .88, emis: .45, cost: 28, prec: 1, knock: 1.2, intro: 1997, mp: 2012 },
    { id: 'idi', name: '분사펌프 (간접분사 디젤)', fuel: 'diesel', cap: .25, ve: .95, bsfc: .98, emis: 1.4, cost: 22, prec: .5, intro: 1946, mp: 1975 },
    { id: 'tdi', name: '직분사 디젤 (분사펌프)', fuel: 'diesel', cap: .3, ve: .98, bsfc: .9, emis: 1.3, cost: 28, prec: .6, intro: 1989, mp: 1996 },
    { id: 'crdi', name: '커먼레일 디젤', fuel: 'diesel', cap: .5, ve: 1.0, bsfc: .85, emis: .7, cost: 38, prec: .95, intro: 1997, mp: 2004 }
  ];
  D.E.asp = [
    { id: 'na', name: '자연흡기', cost: 0, mass: 0 },
    { id: 'sc', name: '슈퍼차저 (루츠)', cost: 26, mass: 14, parasitic: .12, lag: 0, intro: 1946, mass: 14 },
    { id: 'turbo', name: '싱글 터보', cost: 30, mass: 16, parasitic: 0, lag: 1, intro: 1962, mp: 1990 },
    { id: 'twin', name: '트윈 터보', cost: 52, mass: 26, parasitic: 0, lag: .65, intro: 1986, mp: 2008 },
    { id: 'vgt', name: '가변형상 터보 (VGT)', cost: 44, mass: 18, parasitic: 0, lag: .45, intro: 1988, mp: 2012 }
  ];
  D.E.vvt = [
    { id: 'none', name: '없음', cost: 0, width: 0, low: 0 },
    { id: 'phase', name: '캠 위상 가변 (VVT)', cost: 8, width: .12, low: .04, intro: 1983, mp: 1998, needOHC: 1 },
    { id: 'vvl', name: '가변 밸브 리프트', cost: 14, width: .2, low: .06, intro: 1989, mp: 2005, needOHC: 1 },
    { id: 'full', name: '연속 가변 리프트+위상', cost: 20, width: .28, low: .09, intro: 2001, mp: 2014, needOHC: 1 }
  ];
  D.E.ignition = [
    { id: 'points', name: '포인트식 배전기', cost: 1, rel: -3, emis: 1.1, rpm: 0 },
    { id: 'elec', name: '전자 점화', cost: 3, rel: 2, emis: 1, rpm: 300, intro: 1963, mp: 1978 },
    { id: 'cop', name: '코일온플러그 (DIS)', cost: 5, rel: 4, emis: .92, rpm: 500, intro: 1987, mp: 2002 }
  ];
  D.E.crank = [
    { id: 'cast', name: '주철 크랭크', tq: 1, rpm: 0, cost: 4, mass: 1 },
    { id: 'forged', name: '단조강 크랭크', tq: 1.6, rpm: 900, cost: 9, mass: .95 },
    { id: 'billet', name: '빌렛 크랭크', tq: 2.2, rpm: 1600, cost: 26, mass: .9, intro: 1960, mp: 1990 }
  ];
  D.E.rods = [
    { id: 'cast', name: '주조 커넥팅로드', tq: 1, rpm: 0, cost: 2, mass: 1 },
    { id: 'forged', name: '단조강 로드', tq: 1.5, rpm: 800, cost: 5, mass: .95 },
    { id: 'ti', name: '티타늄 로드', tq: 1.7, rpm: 2000, cost: 40, mass: .6, intro: 1966, mp: 2000 }
  ];
  D.E.pistons = [
    { id: 'cast', name: '주조 피스톤', tq: 1, rpm: 0, cost: 2, heat: 0 },
    { id: 'hyper', name: '과공정 실리콘 피스톤', tq: 1.2, rpm: 300, cost: 3, heat: .3, intro: 1970, mp: 1985 },
    { id: 'forged', name: '단조 피스톤', tq: 1.6, rpm: 700, cost: 8, heat: .6 }
  ];
  D.E.exhaust = [
    { id: 'log', name: '주철 로그 매니폴드', ve: 0, cost: 2, noise: 0 },
    { id: 'tube', name: '튜블러 헤더', ve: .04, cost: 6, noise: .1, intro: 1946, mp: 1965 },
    { id: 'equal', name: '등장 헤더 + 듀얼', ve: .06, cost: 10, noise: .2, intro: 1950, mp: 1975 }
  ];
  D.E.cat = [
    { id: 'none', name: '없음', emis: 1, ve: 0, cost: 0, lvl: 0 },
    { id: '2way', name: '2원 촉매', emis: .45, ve: -.02, cost: 8, lvl: 1, intro: 1975, mp: 1977 },
    { id: '3way', name: '3원 촉매', emis: .18, ve: -.015, cost: 12, lvl: 2, intro: 1977, mp: 1985, needEFI: 1 },
    { id: 'cc', name: '근접 장착 3원 + 2차공기', emis: .08, ve: -.01, cost: 18, lvl: 3, intro: 1995, mp: 2002, needEFI: 1 },
    { id: 'gpf', name: '3원 + 입자필터 (GPF/DPF)', emis: .04, ve: -.02, cost: 26, lvl: 4, intro: 2004, mp: 2018, needEFI: 1 }
  ];

  // ── CHASSIS & BODY ──────────────────────────────────────────────────────
  D.C = {};
  D.C.chassis = [
    { id: 'ladder', name: '래더 프레임 (보디온프레임)', mass: 1.0, stiff: .35, safety: .35, utility: 1, cost: 70, labor: 18, comfort: .55 },
    { id: 'unibody', name: '스틸 모노코크 (유니바디)', mass: .72, stiff: .65, safety: .7, utility: .55, cost: 80, labor: 22, comfort: .7, intro: 1934, mp: 1960 },
    { id: 'tube', name: '튜브 스페이스프레임', mass: .6, stiff: .75, safety: .5, utility: .2, cost: 120, labor: 60, comfort: .4, intro: 1946 },
    { id: 'alumono', name: '알루미늄 모노코크', mass: .5, stiff: .8, safety: .78, utility: .45, cost: 320, labor: 34, comfort: .74, intro: 1990, mp: 2018 },
    { id: 'carbon', name: '카본 모노코크 터브', mass: .35, stiff: 1, safety: .9, utility: .1, cost: 1600, labor: 160, comfort: .55, intro: 1992, mp: 2040 }
  ];
  // Body panel sheet materials. grades = price tiers within each material (thickness / coating)
  D.C.sheet = [
    { id: 'mild', name: '냉간압연 연강판', dens: 7.85, cost: .14, labor: 1, tool: 1, corr: .25, stiff: .55, crash: .5, intro: 1900, tex: 'mild',
      grades: [{ id: 'A', name: '0.7mm 일반', t: .7, cm: .85, corr: -.05, fin: .45 }, { id: 'B', name: '0.9mm 표준', t: .9, cm: 1, corr: 0, fin: .6 }, { id: 'C', name: '1.1mm 고급 딥드로잉', t: 1.1, cm: 1.3, corr: .05, fin: .75 }] },
    { id: 'galv', name: '아연도금 강판', dens: 7.85, cost: .2, labor: 1.05, tool: 1, corr: .7, stiff: .56, crash: .52, intro: 1960, mp: 1985, tex: 'galv',
      grades: [{ id: 'A', name: '편면 도금 0.75mm', t: .75, cm: .9, corr: -.12, fin: .55 }, { id: 'B', name: '양면 용융도금 0.8mm', t: .8, cm: 1, corr: 0, fin: .65 }, { id: 'C', name: '전기아연도금 (GA) 0.85mm', t: .85, cm: 1.2, corr: .12, fin: .8 }] },
    { id: 'hsla', name: '고장력강 (HSLA)', dens: 7.85, cost: .25, labor: 1.1, tool: 1.15, corr: .72, stiff: .7, crash: .68, intro: 1976, mp: 1992, tex: 'hsla',
      grades: [{ id: 'A', name: '340MPa 0.7mm', t: .7, cm: .9, corr: 0, fin: .6 }, { id: 'B', name: '440MPa 0.7mm', t: .7, cm: 1, corr: 0, fin: .7 }, { id: 'C', name: '590MPa 도금 0.65mm', t: .65, cm: 1.25, corr: .1, fin: .8 }] },
    { id: 'ahss', name: '초고장력강 (AHSS / DP강)', dens: 7.85, cost: .34, labor: 1.2, tool: 1.3, corr: .75, stiff: .82, crash: .85, intro: 1995, mp: 2008, tex: 'ahss',
      grades: [{ id: 'A', name: 'DP780 0.65mm', t: .65, cm: .9, corr: 0, fin: .7 }, { id: 'B', name: 'DP980 0.6mm', t: .6, cm: 1, corr: 0, fin: .78 }, { id: 'C', name: 'TRIP1180 0.55mm', t: .55, cm: 1.3, corr: .05, fin: .85 }] },
    { id: 'uhss', name: '핫스탬핑 보론강 (UHSS)', dens: 7.85, cost: .48, labor: 1.4, tool: 1.6, corr: .78, stiff: .9, crash: 1, intro: 2004, mp: 2014, tex: 'uhss', needProc: 'hot',
      grades: [{ id: 'A', name: '1500MPa 0.6mm', t: .6, cm: .9, corr: 0, fin: .72 }, { id: 'B', name: '1500MPa Al-Si 코팅', t: .6, cm: 1, corr: .08, fin: .8 }, { id: 'C', name: '2000MPa 테일러드 블랭크', t: .55, cm: 1.35, corr: .1, fin: .88 }] },
    { id: 'alu', name: '알루미늄 판재', dens: 2.7, cost: .9, labor: 1.5, tool: 1.4, corr: .92, stiff: .62, crash: .7, intro: 1946, mp: 2015, tex: 'alu',
      grades: [{ id: 'A', name: '5xxx 1.2mm', t: 1.2, cm: .85, corr: 0, fin: .65 }, { id: 'B', name: '6xxx 1.0mm', t: 1.0, cm: 1, corr: 0, fin: .8 }, { id: 'C', name: '6xxx T4 외판 0.9mm', t: .9, cm: 1.25, corr: .03, fin: .9 }] },
    { id: 'frp', name: '유리섬유 (FRP)', dens: 1.8, cost: .45, labor: 2.6, tool: .2, corr: 1, stiff: .45, crash: .35, intro: 1953, mp: 1960, tex: 'frp',
      grades: [{ id: 'A', name: '핸드 레이업 3mm', t: 3, cm: .8, corr: 0, fin: .4 }, { id: 'B', name: 'SMC 프레스 2.5mm', t: 2.5, cm: 1, corr: 0, fin: .65 }, { id: 'C', name: '진공 성형 2.2mm', t: 2.2, cm: 1.3, corr: 0, fin: .78 }] },
    { id: 'cfrp', name: '탄소섬유 (CFRP)', dens: 1.55, cost: 10, labor: 4, tool: .6, corr: 1, stiff: 1, crash: .9, intro: 1992, mp: 2040, tex: 'cfrp',
      grades: [{ id: 'A', name: '습식 레이업', t: 1.6, cm: .7, corr: 0, fin: .6 }, { id: 'B', name: '프리프레그 오토클레이브', t: 1.2, cm: 1, corr: 0, fin: .9 }, { id: 'C', name: '드라이 카본 노출 마감', t: 1.1, cm: 1.5, corr: 0, fin: 1 }] }
  ];
  D.C.suspF = [
    { id: 'solid', name: '솔리드 액슬 + 판스프링', comfort: .35, handling: .3, cost: 10, mass: 60, utility: 1 },
    { id: 'kingpin', name: '킹핀 독립식 (코일)', comfort: .5, handling: .42, cost: 14, mass: 52, utility: .6 },
    { id: 'dwb', name: '더블 위시본', comfort: .66, handling: .7, cost: 22, mass: 50, utility: .7, intro: 1934, mp: 1955 },
    { id: 'mac', name: '맥퍼슨 스트럿', comfort: .62, handling: .58, cost: 14, mass: 40, utility: .5, intro: 1949, mp: 1970 },
    { id: 'multi', name: '멀티링크', comfort: .76, handling: .78, cost: 30, mass: 46, utility: .6, intro: 1982, mp: 2000 },
    { id: 'air', name: '에어 서스펜션', comfort: .9, handling: .55, cost: 70, mass: 58, utility: .6, intro: 1957, mp: 2010, rel: -6 },
    { id: 'adapt', name: '어댑티브 댐퍼 + 멀티링크', comfort: .88, handling: .85, cost: 80, mass: 50, utility: .6, intro: 1999, mp: 2016 }
  ];
  D.C.suspR = [
    { id: 'leaf', name: '리지드 액슬 + 판스프링', comfort: .38, handling: .32, cost: 8, mass: 70, utility: 1 },
    { id: 'coil', name: '리지드 액슬 + 코일 (4링크)', comfort: .5, handling: .42, cost: 12, mass: 62, utility: .8 },
    { id: 'swing', name: '스윙 액슬', comfort: .52, handling: .25, cost: 9, mass: 42, utility: .3 },
    { id: 'dedion', name: '드디옹 액슬', comfort: .55, handling: .55, cost: 18, mass: 55, utility: .5 },
    { id: 'semi', name: '세미 트레일링암', comfort: .6, handling: .52, cost: 14, mass: 44, utility: .4, intro: 1951, mp: 1965 },
    { id: 'beam', name: '토션빔', comfort: .55, handling: .48, cost: 8, mass: 36, utility: .5, intro: 1970, mp: 1980, ffOnly: 1 },
    { id: 'dwb', name: '더블 위시본', comfort: .66, handling: .7, cost: 22, mass: 50, utility: .6, intro: 1946, mp: 1965 },
    { id: 'multi', name: '멀티링크', comfort: .76, handling: .78, cost: 30, mass: 48, utility: .6, intro: 1982, mp: 2000 },
    { id: 'air', name: '에어 서스펜션', comfort: .9, handling: .55, cost: 70, mass: 60, utility: .7, intro: 1957, mp: 2010, rel: -6 }
  ];
  D.C.brakes = [
    { id: 'drum', name: '유압 드럼 (4륜)', mu: .72, fade: .55, cost: 8, mass: 40 },
    { id: 'disc', name: '전륜 디스크 / 후륜 드럼', mu: .82, fade: .72, cost: 14, mass: 36, intro: 1953, mp: 1972 },
    { id: 'disc4', name: '4륜 디스크', mu: .88, fade: .82, cost: 20, mass: 34, intro: 1955, mp: 1990 },
    { id: 'vent', name: '4륜 벤틸레이티드 디스크', mu: .92, fade: .9, cost: 28, mass: 38, intro: 1966, mp: 2000 },
    { id: 'ccb', name: '카본 세라믹 디스크', mu: 1.0, fade: 1, cost: 400, mass: 22, intro: 2001, mp: 2040 }
  ];
  D.C.tires = [
    { id: 'bias', name: '바이어스 타이어', grip: .7, comfort: .6, rr: 1.15, wear: .8, cost: 6 },
    { id: 'radial', name: '래디얼 타이어', grip: .82, comfort: .66, rr: 1.0, wear: 1.2, cost: 8, intro: 1948, mp: 1972 },
    { id: 'perf', name: '퍼포먼스 래디얼', grip: .95, comfort: .55, rr: 1.08, wear: .8, cost: 14, intro: 1970, mp: 1985 },
    { id: 'eco', name: '저구름저항 타이어', grip: .8, comfort: .7, rr: .8, wear: 1.3, cost: 11, intro: 1992, mp: 2008 },
    { id: 'semi', name: '세미 슬릭', grip: 1.12, comfort: .35, rr: 1.15, wear: .45, cost: 26, intro: 1985, mp: 2005 },
    { id: 'offroad', name: '올터레인/오프로드', grip: .72, comfort: .5, rr: 1.25, wear: 1.1, cost: 12, utility: .15 }
  ];
  D.C.gearbox = [
    { id: 'm3', name: '수동 3단', g: 3, eff: .94, cost: 14, mass: 38, shift: .9, comfort: .3, sport: .5, auto: 0 },
    { id: 'm4', name: '수동 4단', g: 4, eff: .94, cost: 18, mass: 42, shift: .8, comfort: .35, sport: .65, auto: 0, intro: 1930, mp: 1965 },
    { id: 'm5', name: '수동 5단', g: 5, eff: .95, cost: 24, mass: 45, shift: .7, comfort: .4, sport: .75, auto: 0, intro: 1948, mp: 1985 },
    { id: 'm6', name: '수동 6단', g: 6, eff: .95, cost: 32, mass: 50, shift: .6, comfort: .42, sport: .85, auto: 0, intro: 1989, mp: 2005 },
    { id: 'a2', name: '토크컨버터 자동 2단', g: 2, eff: .78, cost: 34, mass: 70, shift: 1.2, comfort: .62, sport: .1, auto: 1, intro: 1950, mp: 1955 },
    { id: 'a3', name: '토크컨버터 자동 3단', g: 3, eff: .82, cost: 34, mass: 68, shift: 1.0, comfort: .66, sport: .15, auto: 1, intro: 1953, mp: 1965 },
    { id: 'a4', name: '자동 4단 (오버드라이브, 록업)', g: 4, eff: .86, cost: 40, mass: 70, shift: .8, comfort: .72, sport: .2, auto: 1, intro: 1980, mp: 1990 },
    { id: 'a5', name: '전자제어 자동 5단', g: 5, eff: .88, cost: 46, mass: 72, shift: .6, comfort: .76, sport: .3, auto: 1, intro: 1990, mp: 2000 },
    { id: 'a6', name: '자동 6단', g: 6, eff: .9, cost: 52, mass: 74, shift: .45, comfort: .8, sport: .4, auto: 1, intro: 2002, mp: 2008 },
    { id: 'a8', name: '자동 8단', g: 8, eff: .92, cost: 62, mass: 76, shift: .3, comfort: .86, sport: .55, auto: 1, intro: 2007, mp: 2014 },
    { id: 'a10', name: '자동 10단', g: 10, eff: .93, cost: 70, mass: 78, shift: .25, comfort: .88, sport: .55, auto: 1, intro: 2017, mp: 2022 },
    { id: 'cvt', name: 'CVT (무단변속)', g: 0, eff: .87, cost: 44, mass: 70, shift: 0, comfort: .82, sport: .05, auto: 1, intro: 1987, mp: 2005, rel: -4 },
    { id: 'dct', name: '듀얼클러치 7단 (DCT)', g: 7, eff: .94, cost: 70, mass: 76, shift: .12, comfort: .7, sport: .95, auto: 1, intro: 2003, mp: 2014, rel: -3 }
  ];
  D.C.drive = [
    { id: 'FR', name: '앞엔진 후륜 (FR)', rear: .55, eff: .97, cabin: .9, cost: 0 },
    { id: 'FF', name: '앞엔진 전륜 (FF, 횡치)', rear: .38, eff: .98, cabin: 1.08, cost: 4, intro: 1959, mp: 1978 },
    { id: 'RR', name: '뒤엔진 후륜 (RR)', rear: .6, eff: .97, cabin: .95, cost: 0 },
    { id: 'MR', name: '미드십 후륜 (MR)', rear: .58, eff: .97, cabin: .6, cost: 10 },
    { id: '4WD', name: '파트타임 4WD', rear: .5, eff: .92, cabin: .85, cost: 40, utility: .3 },
    { id: 'AWD', name: '상시 AWD', rear: .5, eff: .93, cabin: .9, cost: 50, intro: 1980, mp: 2000, utility: .15 }
  ];
  D.C.interior = [
    { id: 'spartan', name: '최소 (철판 노출)', comfort: .15, prestige: .05, cost: 18, mass: 40, labor: 5 },
    { id: 'basic', name: '기본 (비닐)', comfort: .35, prestige: .2, cost: 35, mass: 65, labor: 9 },
    { id: 'std', name: '표준 (직물)', comfort: .55, prestige: .4, cost: 60, mass: 85, labor: 13 },
    { id: 'prem', name: '프리미엄 (부분 가죽)', comfort: .72, prestige: .65, cost: 120, mass: 100, labor: 18 },
    { id: 'lux', name: '럭셔리 (풀 가죽, 원목)', comfort: .88, prestige: .85, cost: 260, mass: 120, labor: 30 },
    { id: 'hand', name: '핸드크래프트 비스포크', comfort: .95, prestige: 1, cost: 700, mass: 125, labor: 90 }
  ];
  // features: each picked option adds cost/mass and affects ratings
  D.C.features = {
    radio: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: 'AM 진공관 라디오', cost: 8, comfort: .03 }, { id: 2, name: 'FM 트랜지스터', cost: 10, comfort: .04, intro: 1960 }, { id: 3, name: '카세트 스테레오', cost: 14, comfort: .05, intro: 1970 }, { id: 4, name: 'CD/멀티미디어', cost: 18, comfort: .06, intro: 1985 }, { id: 5, name: '터치 인포테인먼트+내비', cost: 40, comfort: .08, prestige: .04, intro: 2008, rel: -2 }],
    ac: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: '히터', cost: 4, comfort: .03 }, { id: 2, name: '에어컨', cost: 40, comfort: .08, mass: 25, intro: 1953 }, { id: 3, name: '풀오토 공조', cost: 60, comfort: .11, mass: 28, intro: 1980 }],
    steer: [{ id: 0, name: '수동 조향', cost: 0, drv: 0 }, { id: 1, name: '유압 파워스티어링', cost: 14, drv: .08, comfort: .04, intro: 1951 }, { id: 2, name: '전동 파워스티어링 (EPS)', cost: 18, drv: .1, comfort: .05, econ: .02, intro: 1999 }],
    belts: [{ id: 0, name: '없음', cost: 0, safety: 0 }, { id: 1, name: '2점식 벨트', cost: 2, safety: .08, intro: 1955 }, { id: 2, name: '3점식 벨트', cost: 4, safety: .16, intro: 1959 }],
    airbag: [{ id: 0, name: '없음', cost: 0, safety: 0 }, { id: 1, name: '운전석/조수석', cost: 30, safety: .12, intro: 1980 }, { id: 2, name: '+측면', cost: 50, safety: .18, intro: 1994 }, { id: 3, name: '+커튼/무릎 (풀)', cost: 75, safety: .23, intro: 2000 }],
    abs: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: 'ABS', cost: 30, safety: .06, brake: .05, intro: 1978 }],
    esc: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: '자세제어 (ESC)', cost: 24, safety: .08, drv: .05, intro: 1995 }],
    adas: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: 'AEB + 차선유지', cost: 60, safety: .07, drv: .03, intro: 2008, rel: -2 }, { id: 2, name: '레벨2 고속도로 주행보조', cost: 160, safety: .1, comfort: .04, prestige: .04, intro: 2015, rel: -3 }],
    crumple: [{ id: 0, name: '없음', cost: 0 }, { id: 1, name: '크럼플 존 설계', cost: 12, safety: .12, intro: 1959 }]
  };
  // featured mandatory map for regulations (key in car.features)
  D.C.mandateKey = { belts: 'belts', airbag: 'airbag', abs: 'abs', esc: 'esc', adas: 'adas' };

  // ── PRODUCTION PROCESSES ────────────────────────────────────────────────
  // hours = man-hours per car contributed by this stage at the reference design
  // defect = probability of a defect escaping (before QA); capex = $/unit/yr of capacity (1946$)
  D.P = {};
  D.P.stamping = [
    { id: 'hand', name: '수작업 판금 (해머/잉글리시 휠)', hours: 60, defect: .05, capex: 4, fit: .45, tool: .1 },
    { id: 'press', name: '단동 프레스 (수동 이송)', hours: 14, defect: .03, capex: 22, fit: .65, tool: 1 },
    { id: 'tandem', name: '탠덤 프레스 라인', hours: 7, defect: .02, capex: 30, fit: .75, tool: 1, intro: 1950, mp: 1960 },
    { id: 'transfer', name: '트랜스퍼 프레스 (자동 이송)', hours: 3, defect: .012, capex: 44, fit: .85, tool: 1.1, intro: 1972, mp: 1990 },
    { id: 'servo', name: '서보 프레스 + 핫스탬핑 셀', hours: 2.2, defect: .008, capex: 56, fit: .93, tool: 1.15, hot: 1, intro: 2003, mp: 2014 }
  ];
  D.P.welding = [
    { id: 'gas', name: '가스용접 + 리벳 (수작업)', hours: 30, defect: .06, capex: 4, stiff: .9 },
    { id: 'spot', name: '수동 스폿용접 건', hours: 14, defect: .035, capex: 14, stiff: 1 },
    { id: 'multi', name: '멀티 스폿 용접 지그', hours: 8, defect: .025, capex: 24, stiff: 1, intro: 1952, mp: 1962 },
    { id: 'robot', name: '스폿용접 로봇 라인', hours: 3.5, defect: .01, capex: 40, stiff: 1.05, intro: 1962, mp: 1985 },
    { id: 'laser', name: '레이저 용접 + 구조용 접착', hours: 2.5, defect: .006, capex: 55, stiff: 1.15, intro: 1993, mp: 2008 },
    { id: 'giga', name: '기가캐스팅 + 로봇 접합', hours: 1.6, defect: .008, capex: 70, stiff: 1.12, intro: 2020, mp: 2030 }
  ];
  D.P.paint = [
    { id: 'brush', name: '수동 스프레이 래커 (자연건조)', hours: 22, defect: .05, capex: 4, corr: .3, gloss: .5 },
    { id: 'enamel', name: '프라이머 침지 + 에나멜 오븐 베이크', hours: 9, defect: .035, capex: 14, corr: .45, gloss: .65, intro: 1946 },
    { id: 'ecoat', name: '전착 도장 (E-coat) + 스프레이', hours: 6, defect: .02, capex: 26, corr: .72, gloss: .72, intro: 1963, mp: 1975 },
    { id: 'robot', name: '로봇 도장 (베이스코트/클리어코트)', hours: 3, defect: .01, capex: 40, corr: .85, gloss: .88, intro: 1982, mp: 1995 },
    { id: 'water', name: '수성 도료 + 3-웨트 공정', hours: 2.4, defect: .007, capex: 48, corr: .9, gloss: .92, intro: 1998, mp: 2010 }
  ];
  D.P.assembly = [
    { id: 'stall', name: '정치식 조립 (장인 수작업)', hours: 90, defect: .04, capex: 6, rate: .3 },
    { id: 'line', name: '컨베이어 이동 조립 라인', hours: 28, defect: .03, capex: 20, rate: 1 },
    { id: 'lean', name: '린 생산 / JIT + 안돈', hours: 18, defect: .014, capex: 26, rate: 1.05, intro: 1965, mp: 1985 },
    { id: 'module', name: '모듈 조립 (공급사 모듈 납품)', hours: 13, defect: .01, capex: 30, rate: 1.1, intro: 1994, mp: 2005 },
    { id: 'auto', name: '고자동화 조립 + AGV', hours: 9, defect: .008, capex: 44, rate: 1.15, intro: 2012, mp: 2025 }
  ];
  D.P.qa = [
    { id: 'visual', name: '최종 육안 검사', hours: 1, catch: .4, capex: 1 },
    { id: 'spc', name: '통계적 공정관리 (SPC)', hours: 1.5, catch: .6, capex: 3, intro: 1950, mp: 1965 },
    { id: 'tqm', name: '전사적 품질경영 (TQM) + 품질분임조', hours: 2, catch: .75, capex: 5, intro: 1970, mp: 1990 },
    { id: 'vision', name: '머신비전 인라인 계측', hours: 1.2, catch: .86, capex: 9, intro: 2000, mp: 2012 },
    { id: 'ai', name: 'AI 결함 예측 + 디지털 트윈', hours: .8, catch: .93, capex: 14, intro: 2018, mp: 2028 }
  ];
  D.P.stages = [['stamping', '프레스 (강판 성형)'], ['welding', '차체 용접 (BIW)'], ['paint', '도장'], ['assembly', '의장/조립'], ['qa', '품질 검사']];
})(window.MW);
