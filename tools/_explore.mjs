import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const P = s.protocols;
const isPre = (p) => p.mcap_usd == null && p.gecko_id == null && p.symbol == null;
const pre = P.filter(isPre);
const live = P.filter((p) => !isPre(p));
console.log('total', P.length, 'pre', pre.length, 'live', live.length, 'watchlist', s.watchlist.length);
const combos = {};
for (const p of P) {
  const k = (p.mcap_usd == null ? '-' : 'M') + (p.gecko_id == null ? '-' : 'G') + (p.symbol == null ? '-' : 'S');
  combos[k] = (combos[k] || 0) + 1;
}
console.log('mcap/gecko/symbol combos', combos);
const usable = live.filter((p) => typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0);
console.log('live with mcap>0 & tvl>0', usable.length);
const mult = usable.map((p) => p.mcap_usd / p.tvl_usd).sort((a, b) => a - b);
console.log('median', mult[Math.floor(mult.length / 2)], mult[Math.floor((mult.length - 1) / 2)], 'min', mult[0], 'max', mult.at(-1));
console.log('extremes', usable.filter((p) => p.mcap_usd / p.tvl_usd > 20 || p.mcap_usd / p.tvl_usd < 0.005).map((p) => [p.name, p.category, p.tvl_usd, p.mcap_usd]));
console.log('mcap==0', live.filter((p) => p.mcap_usd === 0).length, 'tvl<=0', P.filter((p) => p.tvl_usd <= 0).length);
const cats = {};
for (const p of usable) (cats[p.category] ??= []).push(p.mcap_usd / p.tvl_usd);
console.log(Object.entries(cats).map(([c, v]) => [c, v.length]).sort((a, b) => b[1] - a[1]));
const pc = {};
for (const p of pre) pc[p.category] = (pc[p.category] || 0) + 1;
console.log('pre cats', Object.entries(pc).sort((a, b) => b[1] - a[1]));
const preSlugs = new Set(pre.map((p) => p.slug));
console.log('watch in pre', s.watchlist.filter((w) => preSlugs.has(w)).length, 'watch not pre', s.watchlist.filter((w) => !preSlugs.has(w)));
