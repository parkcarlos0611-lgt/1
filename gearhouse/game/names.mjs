// Name suggestions (dice button next to every name field). Plain words and invented compounds only: no real makes, marques or
// model names are in these lists. Players may still type anything they like.
const pick = a => a[Math.floor(Math.random() * a.length)];
const EN = {
  model: ['KESTREL', 'MERIDIAN', 'HALCYON', 'LODESTAR', 'NORTHWIND', 'BEACON', 'RIDGEWAY', 'SILVERLINE', 'HARROW', 'STARLING', 'SEAFARER', 'HIGHGATE', 'WESTWIND', 'VOYAGEUR', 'BRIARWOOD', 'MILEPOST', 'TOWNSMAN', 'AURORA LINE', 'GREYHAWK', 'SUNDOWNER'],
  suffix: ['', '', 'SIX', 'EIGHT', 'TOURER', 'SALOON', 'STANDARD', 'GRAND'],
  engine: ['IRONHEART', 'STEADFAST', 'TORRENT', 'HAMMERHEAD', 'GREYSTONE', 'RIVERFLOW', 'STORMCREST', 'ANVIL', 'BULWARK', 'TEMPO'],
  gearbox: ['SURESHIFT', 'STEADYGEAR', 'QUIETMESH', 'TRUEMESH', 'EASYLEVER'],
  platform: ['ATLAS', 'KEEL', 'SPINE', 'GIRDER', 'BEDROCK'],
  body: ['CLIFFLINE', 'SWEEP', 'GLIDE', 'CRESCENT', 'TIDE', 'FALLOW'],
  colour: ['MIDNIGHT BLUE', 'HARBOUR GREY', 'FOREST GREEN', 'CLARET', 'CREAM', 'OXBLOOD', 'SLATE', 'SAND', 'COPPER', 'COAL BLACK'],
  company: ['MERIDIAN MOTOR WORKS', 'NORTHGATE CARRIAGE CO.', 'HALCYON AUTOMOBILE CO.', 'IRONVALE MOTORS', 'BRIDGEWATER MOTOR CO.'] };
const KO = {
  model: ['은하', '새벽', '한빛', '다솜', '누리', '가람', '미르', '별빛', '바람', '한결', '온누리', '해오름', '여울', '푸른솔'],
  suffix: ['', '', '6', '8', '투어러', '세단', '그랜드'],
  engine: ['천둥', '강철심장', '바위', '불꽃', '여울', '든든'], gearbox: ['부드러운', '한결', '튼튼'], platform: ['대들보', '등뼈', '용골'], body: ['물결', '초승달', '바람결'],
  colour: ['한밤 청색', '항구 회색', '숲 녹색', '포도주색', '크림색', '자주', '석판 회색', '모래색', '구리색', '석탄 검정'],
  company: ['한빛 자동차', '누리 모터스', '가람 차량 제작소', '미르 자동차 공업'] };
export function suggest(kind, ko = false) { const L = ko ? KO : EN; if (kind === 'model') { const s = pick(L.suffix); return (pick(L.model) + (s ? ' ' + s : '')).slice(0, 16); } return pick(L[kind] || L.model); }
