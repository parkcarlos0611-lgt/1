// World data: macro-economy, markets, regulations and historical events (1946–2035).
// Figures are approximations of real historical series (US CPI, prime rate, gasoline,
// new light-vehicle sales by region) so that the economy behaves like the real one.
(function (MW) {
  const U = MW.U, D = MW.data;
  D.START_YEAR = 1946;
  // US CPI-U (annual avg). Prices/wages are nominal and scale with this.
  D.CPI = [[1946, 19.5], [1950, 24.1], [1955, 26.8], [1960, 29.6], [1965, 31.5], [1970, 38.8], [1973, 44.4], [1975, 53.8], [1978, 65.2], [1980, 82.4], [1982, 96.5], [1985, 107.6], [1990, 130.7], [1995, 152.4], [2000, 172.2], [2005, 195.3], [2008, 215.3], [2010, 218.1], [2015, 237.0], [2020, 258.8], [2022, 292.7], [2025, 320], [2035, 400]];
  D.cpi = y => U.table(D.CPI, y) / 19.5; // multiplier vs 1946 dollars
  // prime lending rate %
  D.PRIME = [[1946, 1.5], [1950, 2.1], [1955, 3.2], [1960, 4.8], [1965, 4.5], [1970, 7.9], [1974, 10.8], [1977, 6.8], [1980, 15.3], [1981, 18.9], [1983, 10.8], [1985, 9.9], [1990, 10.0], [1993, 6.0], [2000, 9.2], [2003, 4.1], [2007, 8.1], [2009, 3.25], [2015, 3.3], [2019, 5.3], [2020, 3.5], [2023, 8.2], [2025, 7.5], [2035, 6]];
  // regular gasoline $/US gal, nominal (Europe multiplies by its tax factor)
  D.FUEL = [[1946, .21], [1950, .27], [1960, .31], [1970, .36], [1973, .39], [1974, .53], [1978, .63], [1979, .86], [1980, 1.19], [1981, 1.31], [1986, .93], [1990, 1.16], [1998, 1.06], [2000, 1.51], [2005, 2.30], [2008, 3.27], [2009, 2.35], [2012, 3.62], [2015, 2.45], [2020, 2.17], [2022, 3.95], [2025, 3.2], [2035, 3.8]];
  // gasoline octane typically available (RON). Leaded premium peaked in the late 60s.
  D.OCTANE = [[1946, 80], [1955, 92], [1965, 99], [1972, 99], [1975, 95], [1985, 95], [2000, 96], [2035, 97]];
  D.REGIONS = [
    { id: 'na', name: '북미', wageCurve: [[1946, 1], [2035, 1]], fuelTax: 1.0, roadSpeed: 1.0, sizePref: 1.25,
      // new light-vehicle sales, millions / year
      market: [[1946, 2.5], [1950, 7.5], [1955, 9], [1958, 5.5], [1960, 7.6], [1965, 10.5], [1970, 10.2], [1973, 14], [1975, 10.7], [1978, 15], [1980, 11.5], [1982, 10.5], [1985, 15.7], [1990, 14.1], [1995, 15.1], [2000, 17.4], [2005, 17], [2008, 13.2], [2009, 10.4], [2012, 14.5], [2015, 17.4], [2019, 17], [2020, 14.5], [2022, 13.7], [2025, 16], [2035, 16.5]],
      income: [[1946, 1], [2035, 1]], tariff: [[1946, .10], [1960, .03], [2018, .03], [2025, .15]] },
    { id: 'eu', name: '서유럽', wageCurve: [[1946, .45], [1970, .7], [1990, 1.05], [2035, .95]], fuelTax: 2.3, roadSpeed: 1.1, sizePref: .9,
      market: [[1946, .3], [1950, 1.2], [1955, 2.5], [1960, 4.4], [1965, 6.5], [1970, 8], [1975, 8.5], [1980, 9.8], [1985, 11], [1990, 13.5], [1993, 11.5], [2000, 14.8], [2007, 15.9], [2009, 14.5], [2013, 12], [2019, 15.8], [2020, 11.9], [2025, 13], [2035, 13.5]],
      income: [[1946, .35], [1960, .55], [1980, .8], [2000, .78], [2035, .78]], tariff: [[1946, .3], [1960, .22], [1970, .11], [1990, .10], [2035, .10]] },
    { id: 'ea', name: '동아시아', wageCurve: [[1946, .08], [1970, .2], [1990, .55], [2005, .35], [2025, .5], [2035, .6]], fuelTax: 1.6, roadSpeed: .85, sizePref: .75,
      market: [[1946, .02], [1955, .07], [1960, .4], [1965, 1], [1970, 3], [1975, 3.5], [1980, 4.3], [1985, 5], [1990, 8], [1995, 7.5], [2000, 8.5], [2005, 12], [2010, 24], [2015, 30], [2020, 30], [2025, 34], [2035, 36]],
      income: [[1946, .08], [1960, .15], [1970, .3], [1985, .55], [1995, .5], [2005, .3], [2015, .35], [2025, .45], [2035, .55]], tariff: [[1946, .5], [1970, .4], [1980, .2], [2000, .25], [2018, .15], [2035, .15]] },
    { id: 'em', name: '신흥시장', wageCurve: [[1946, .1], [2000, .12], [2035, .22]], fuelTax: 1.2, roadSpeed: .75, sizePref: .8,
      market: [[1946, .1], [1960, .4], [1970, 1], [1980, 2], [1990, 2.5], [2000, 4], [2010, 10], [2020, 12], [2025, 15], [2035, 20]],
      income: [[1946, .12], [1980, .15], [2000, .14], [2025, .22], [2035, .3]], tariff: [[1946, .6], [1990, .45], [2010, .3], [2035, .25]] }
  ];
  // US median household income, nominal $/yr
  D.INCOME_US = [[1946, 2600], [1950, 3300], [1960, 5600], [1970, 9870], [1980, 17700], [1990, 29900], [2000, 42000], [2010, 49400], [2020, 67500], [2025, 80000], [2035, 98000]];
  // factory wage, $/h incl. benefits, US auto worker
  D.WAGE_US = [[1946, 1.25], [1950, 1.85], [1960, 3.1], [1970, 5.8], [1980, 17], [1990, 30], [2000, 44], [2007, 70], [2010, 58], [2020, 63], [2025, 72], [2035, 85]];
  D.wage = (y, region) => U.table(D.WAGE_US, y) * U.table(region.wageCurve, y);
  D.income = (y, region) => U.table(D.INCOME_US, y) * U.table(region.income, y);

  // Market segments. w = buyer weights on car ratings; price = target price as multiple of regional median income
  D.SEGMENTS = [
    { id: 'econ', name: '이코노미', price: .38, w: { price: .30, economy: .20, reliability: .14, practicality: .10, drivability: .08, comfort: .06, safety: .06, performance: .02, prestige: .02, utility: .02 } },
    { id: 'family', name: '패밀리 세단', price: .55, w: { price: .20, practicality: .16, comfort: .14, reliability: .13, safety: .11, economy: .10, drivability: .08, performance: .04, prestige: .04 } },
    { id: 'wagon', name: '왜건/MPV', price: .58, w: { price: .16, practicality: .24, utility: .12, comfort: .12, reliability: .12, safety: .12, economy: .08, drivability: .04 } },
    { id: 'lux', name: '고급 세단', price: 1.25, w: { prestige: .24, comfort: .22, performance: .12, safety: .12, reliability: .10, drivability: .08, price: .07, practicality: .05 } },
    { id: 'sport', name: '스포츠카', price: .8, w: { performance: .30, drivability: .18, sportiness: .20, prestige: .10, price: .12, reliability: .06, comfort: .04 } },
    { id: 'muscle', name: 'GT/머슬', price: .65, w: { performance: .32, prestige: .14, sportiness: .12, price: .16, comfort: .10, drivability: .08, reliability: .08 } },
    { id: 'truck', name: '픽업/상용', price: .52, w: { utility: .32, reliability: .20, price: .18, practicality: .10, economy: .08, comfort: .06, safety: .06 } },
    { id: 'suv', name: 'SUV', price: .7, w: { utility: .18, practicality: .18, safety: .14, comfort: .14, prestige: .10, reliability: .10, price: .10, performance: .06 } },
    { id: 'super', name: '슈퍼카', price: 5.0, w: { performance: .36, prestige: .30, sportiness: .20, drivability: .08, price: .03, reliability: .03 } }
  ];
  // segment share of the market by region, keyed by year. Columns in SEGMENTS order.
  D.SEG_SHARE = {
    na: [[1946, [.10, .45, .12, .07, .02, .02, .20, .01, .002]], [1960, [.12, .44, .13, .08, .02, .03, .16, .01, .002]], [1968, [.10, .38, .12, .08, .03, .09, .15, .02, .003]], [1975, [.22, .34, .10, .08, .03, .04, .15, .03, .002]], [1985, [.18, .33, .09, .09, .03, .03, .19, .05, .002]], [1995, [.13, .28, .06, .09, .02, .02, .20, .19, .003]], [2005, [.09, .24, .05, .10, .02, .03, .19, .27, .004]], [2020, [.04, .13, .03, .09, .02, .02, .21, .45, .005]], [2035, [.04, .10, .02, .09, .02, .01, .20, .50, .005]]],
    eu: [[1946, [.40, .32, .10, .08, .05, .00, .04, .00, .002]], [1960, [.42, .30, .12, .07, .05, .01, .03, .00, .002]], [1975, [.38, .32, .13, .08, .05, .00, .03, .01, .002]], [1990, [.34, .30, .15, .09, .05, .00, .03, .03, .003]], [2005, [.30, .26, .15, .10, .04, .00, .03, .11, .004]], [2020, [.24, .16, .10, .10, .03, .00, .03, .33, .005]], [2035, [.22, .13, .08, .10, .03, .00, .03, .38, .005]]],
    ea: [[1946, [.50, .25, .05, .08, .01, .00, .11, .00, .001]], [1970, [.48, .30, .05, .06, .02, .00, .09, .00, .001]], [1990, [.35, .35, .08, .09, .03, .00, .07, .03, .002]], [2005, [.30, .35, .07, .10, .02, .00, .05, .11, .002]], [2020, [.18, .28, .06, .10, .02, .00, .04, .32, .003]], [2035, [.16, .24, .05, .11, .02, .00, .04, .38, .003]]],
    em: [[1946, [.45, .20, .05, .05, .01, .00, .24, .00, .001]], [1980, [.48, .22, .05, .04, .01, .00, .20, .00, .001]], [2000, [.45, .23, .04, .04, .01, .00, .18, .05, .001]], [2020, [.33, .20, .05, .05, .01, .00, .14, .22, .001]], [2035, [.28, .18, .05, .06, .01, .00, .14, .28, .001]]]
  };
  D.segShare = (y, rid) => {
    const t = D.SEG_SHARE[rid]; let a = t[0], b = t[t.length - 1];
    for (let i = 0; i < t.length - 1; i++) if (y >= t[i][0] && y <= t[i + 1][0]) { a = t[i]; b = t[i + 1]; break; }
    const f = a === b ? 0 : U.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    const v = a[1].map((x, i) => U.lerp(x, b[1][i], f)); const s = U.sum(v); return v.map(x => x / s);
  };

  // Era expectations used to normalise ratings ("good for its time")
  D.EXPECT = {
    accel: [[1946, 22], [1955, 17], [1965, 13], [1975, 14], [1985, 11.5], [1995, 10], [2005, 8.8], [2015, 7.8], [2025, 6.8], [2035, 6]],       // 0-100 km/h, s, typical family car
    economy: [[1946, 15], [1960, 14], [1973, 16], [1980, 11], [1990, 9], [2000, 8.5], [2010, 7.5], [2020, 6.5], [2035, 5.5]],               // L/100km
    safety: [[1946, 5], [1960, 12], [1970, 25], [1980, 40], [1990, 55], [2000, 70], [2010, 82], [2020, 90], [2035, 95]],
    comfort: [[1946, 25], [1960, 30], [1980, 38], [2000, 46], [2020, 54], [2035, 58]]
  };

  // Emission standards (index; lower is stricter). Engines above the limit cannot be sold in that region.
  D.EMISSION_LIMIT = {
    na: [[1946, 999], [1967, 999], [1968, 120], [1975, 60], [1981, 25], [1994, 14], [2004, 6], [2017, 3], [2027, 1.8]],
    eu: [[1946, 999], [1971, 160], [1983, 90], [1993, 30], [1996, 20], [2000, 12], [2005, 7], [2009, 4.5], [2014, 2.8], [2021, 2.2], [2027, 1.6]],
    ea: [[1946, 999], [1973, 150], [1978, 50], [1990, 30], [2000, 14], [2010, 6], [2020, 2.8], [2027, 1.8]],
    em: [[1946, 999], [1990, 200], [2000, 60], [2010, 20], [2020, 8], [2030, 4]]
  };
  // Mandatory equipment by year: safety.feature -> {region: year}
  D.MANDATES = [
    { key: 'belts', min: 1, name: '좌석벨트 의무화', at: { na: 1968, eu: 1970, ea: 1975, em: 1995 } },
    { key: 'belts', min: 2, name: '3점식 벨트 의무화', at: { na: 1974, eu: 1976, ea: 1985, em: 2005 } },
    { key: 'airbag', min: 1, name: '운전석 에어백 의무화', at: { na: 1995, eu: 2000, ea: 2005, em: 2014 } },
    { key: 'airbag', min: 2, name: '측면 에어백 의무화', at: { na: 2008, eu: 2008, ea: 2012, em: 2022 } },
    { key: 'abs', min: 1, name: 'ABS 의무화', at: { na: 2012, eu: 2004, ea: 2012, em: 2020 } },
    { key: 'esc', min: 1, name: 'ESC 의무화', at: { na: 2012, eu: 2014, ea: 2014, em: 2022 } },
    { key: 'cat', min: 1, name: '촉매 변환기 필요', at: { na: 1975, eu: 1993, ea: 1978, em: 2000 } },
    { key: 'adas', min: 1, name: '자동긴급제동(AEB) 의무화', at: { na: 2029, eu: 2024, ea: 2026, em: 2032 } }
  ];

  // Historical shocks. demand = market multiplier, fuel spikes are already in D.FUEL.
  D.EVENTS = [
    { y: 1950.5, len: 36, name: '한국전쟁 — 원자재(철강) 통제', steel: 1.25, demand: .95 },
    { y: 1957.7, len: 12, name: '1958년 경기침체', demand: .8 },
    { y: 1973.8, len: 8, name: '제1차 오일쇼크 — 소형차 수요 급증', fuelShock: 1, demand: .82 },
    { y: 1979.3, len: 40, name: '제2차 오일쇼크 + 고금리 불황', fuelShock: 1, demand: .82 },
    { y: 1990.6, len: 10, name: '걸프전 / 1991년 경기침체', demand: .9 },
    { y: 1997.6, len: 18, name: '아시아 외환위기', demand: .9, region: 'ea' },
    { y: 2001.2, len: 9, name: '닷컴 버블 붕괴', demand: .95 },
    { y: 2008.7, len: 15, name: '세계 금융위기 — 신용경색', demand: .72, credit: 1 },
    { y: 2020.2, len: 4, name: 'COVID-19 봉쇄', demand: .55 },
    { y: 2020.9, len: 24, name: '반도체 공급난', chip: 1, demand: 1.0 }
  ];
  D.eventsAt = t => D.EVENTS.filter(e => t >= e.y && t < e.y + e.len / 12);
})(window.MW);
