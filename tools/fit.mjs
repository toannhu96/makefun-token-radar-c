// Fits the model's calibration constants from the sealed snapshot.
//   node tools/fit.mjs <snapshot.json> [lib/fit.json]
// lib/model.ts reads the output, so every constant it uses traces back to this script and the snapshot.
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const isPre = (p) => p.mcap_usd == null && p.gecko_id == null && p.symbol == null;
// Calibration set: protocols that trade, with a usable market cap and TVL. A multiple outside
// [MULT_MIN, MULT_MAX] is a dust or stale market cap (Concentrator 0.001x) or a token that is not priced off
// TVL at all (Rain 400x), not a price the market pays for the protocol: those are set aside, and counted.
const MULT_MIN = 0.01;
const MULT_MAX = 50;
const usable = s.protocols.filter((p) => !isPre(p) && typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0);
const cal = usable
  .filter((p) => p.mcap_usd / p.tvl_usd >= MULT_MIN && p.mcap_usd / p.tvl_usd <= MULT_MAX)
  .map((p) => ({ cat: p.category ?? 'Uncategorised', tvl: p.tvl_usd, mult: p.mcap_usd / p.tvl_usd, g: p.change_7d }));

const median = (a) => {
  const v = [...a].sort((x, y) => x - y);
  const n = v.length;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
};
const quantile = (a, p) => {
  const v = [...a].sort((x, y) => x - y);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};
const ols = (xs, ys) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { slope: sxy / sxx, intercept: my - (sxy / sxx) * mx, r: sxy / Math.sqrt(sxx * syy) };
};

const MIN_SAMPLES = 3;
const lt = cal.map((c) => Math.log10(c.tvl));
const lm = cal.map((c) => Math.log10(c.mult));
const fit = ols(lt, lm); // log10(multiple) = intercept + slope * log10(tvl), all categories
const gs = cal.filter((c) => c.g != null);
const growthR = ols(gs.map((c) => c.g), gs.map((c) => c.mult)).r;

// A category's level is the median residual of its samples around the pooled power law, so it is read
// at the TVL the samples actually had rather than mixed up with size.
const resid = cal.map((c, i) => lm[i] - (fit.intercept + fit.slope * lt[i]));
const idxBy = {};
cal.forEach((c, i) => (idxBy[c.cat] ??= []).push(i));
const categories = Object.entries(idxBy)
  .map(([name, idx]) => ({
    name,
    n: idx.length,
    median_multiple: median(idx.map((i) => cal[i].mult)),
    median_tvl: median(idx.map((i) => cal[i].tvl)),
    min_tvl: Math.min(...idx.map((i) => cal[i].tvl)),
    max_tvl: Math.max(...idx.map((i) => cal[i].tvl)),
    log_offset: median(idx.map((i) => resid[i])),
    own_price: idx.length >= MIN_SAMPLES,
  }))
  .sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));

// Value band: the 20th..80th percentile of log residuals. Categories with their own price are judged
// against their own level; the fallback is judged against the pooled line, which is much wider.
const offsetOf = Object.fromEntries(categories.map((c) => [c.name, c]));
const within = [];
cal.forEach((c, i) => {
  const k = offsetOf[c.cat];
  if (k.own_price) within.push(resid[i] - k.log_offset);
});
// Age against the residual: does maturity explain anything the power law has not?
const ages = s.protocols.filter((p) => cal.length && p.listed_at);
const asOf = Date.parse(`${s.as_of}T00:00:00Z`);
const calP = usable.filter((p) => p.mcap_usd / p.tvl_usd >= MULT_MIN && p.mcap_usd / p.tvl_usd <= MULT_MAX);
const withAge = calP.map((p, i) => ({ age: p.listed_at ? (asOf - Date.parse(`${p.listed_at}T00:00:00Z`)) / 864e5 : null, r: resid[i] })).filter((x) => x.age != null);
const ageR = ols(withAge.map((x) => x.age), withAge.map((x) => x.r)).r;
// Rank correlation of growth against multiple, which a few extreme multiples cannot move.
const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = []; o.forEach(([, i], k) => (r[i] = k)); return r; };
const growthRho = ols(rank(gs.map((c) => c.g)), rank(gs.map((c) => c.mult))).r;
const tv = [...lt].sort((a, b) => a - b);
const out = {
  samples: cal.length,
  usable_before_trim: usable.length,
  multiple_trim: [MULT_MIN, MULT_MAX],
  tvl_range_log10: [tv[Math.floor(0.05 * tv.length)], tv[Math.min(tv.length - 1, Math.floor(0.95 * tv.length))]],
  age_resid_r: ageR,
  growth_spearman_rho: growthRho,
  global_log_offset: median(resid),
  min_samples: MIN_SAMPLES,
  global_median_multiple: median(cal.map((c) => c.mult)),
  global_median_tvl: median(cal.map((c) => c.tvl)),
  power_law: { intercept: fit.intercept, slope: fit.slope, r: fit.r },
  growth_pearson_r: growthR,
  band_log10: {
    own: [quantile(within, 0.2), quantile(within, 0.8)],
    fallback: [quantile(resid, 0.2), quantile(resid, 0.8)],
  },
  categories,
};
const text = `${JSON.stringify(out, null, 1)}\n`;
if (process.argv[3]) writeFileSync(process.argv[3], text);
else process.stdout.write(text);
console.error(`fit: ${cal.length} samples, slope ${fit.slope.toFixed(3)}, global median ${out.global_median_multiple.toFixed(3)}, growth r ${growthR.toFixed(3)}`);
