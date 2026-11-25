// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures, calibrated on its live tokens
// (tools/fit.mjs writes lib/fit.json from the snapshot; nothing below is typed in from a report):
//
//   multiple   = 10^(intercept + slope x log10(clamp(tvl)) + category_offset)
//                category_offset is the category's median residual around the pooled TVL power law when it
//                has at least MIN_SAMPLES live tokens; otherwise the all-category median residual (a fall back
//                the row records). The TVL is clamped to the calibration set's 5th..95th percentile only
//                inside the exponent, so a giant is never priced off the shape of a small sample.
//   growthMult = 1 + clamp(change_7d, -50, 50) / 100 x GROWTH_WEIGHT        (at most +/-5%)
//   implied    = max(1, round(tvl x multiple x growthMult))
//
// Age is not in the model: its correlation with the calibration residual is about zero (fit.json
// age_resid_r). No protocol name is ever special-cased: the same function scores every row.

import { readFileSync } from 'node:fs';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One category of the calibration set, as tools/fit.mjs measured it. */
export interface FitCategory {
  name: string;
  n: number;
  median_multiple: number;
  median_tvl: number;
  min_tvl: number;
  max_tvl: number;
  log_offset: number;
  own_price: boolean;
}

/** lib/fit.json: what tools/fit.mjs measured on the snapshot's live tokens. */
export interface Fit {
  samples: number;
  usable_before_trim: number;
  multiple_trim: [number, number];
  tvl_range_log10: [number, number];
  age_resid_r: number;
  growth_spearman_rho: number;
  global_log_offset: number;
  min_samples: number;
  global_median_multiple: number;
  global_median_tvl: number;
  power_law: { intercept: number; slope: number; r: number };
  growth_pearson_r: number;
  band_log10: { own: [number, number]; fallback: [number, number] };
  categories: FitCategory[];
}

export const FIT: Fit = JSON.parse(readFileSync(new URL('./fit.json', import.meta.url), 'utf8')) as Fit;

/** The model's constants: the fitted ones come from FIT, the two growth ones are a design choice. */
export interface ModelConstants {
  intercept: number;
  slope: number;
  global_log_offset: number;
  min_samples: number;
  measured_samples: number;
  tvl_range_log10: [number, number];
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
}

export const MODEL: ModelConstants = {
  intercept: FIT.power_law.intercept,
  slope: FIT.power_law.slope,
  global_log_offset: FIT.global_log_offset,
  min_samples: FIT.min_samples,
  measured_samples: 8,
  tvl_range_log10: FIT.tvl_range_log10,
  growth_weight: 0.1,
  growth_floor: -50,
  growth_cap: 50,
};

/** How a row's price rests on data: measured (own category, enough samples), thin, or fell back. */
export type Reliability = 'measured' | 'thin' | 'fell_back' | 'no_data';

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  category_samples: number;
  reliability: Reliability;
  fell_back: boolean;
  implied_lo_usd: number;
  implied_hi_usd: number;
  model: {
    category_offset_log10: number;
    tvl_clamped: boolean;
    extrapolated: boolean;
    growth_pct: number;
    growth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  category_samples: number;
  reliability: Reliability;
  fell_back: boolean;
  implied_lo_usd: number;
  implied_hi_usd: number;
  growth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The method panel's figures: the calibration set and every category with its sample size. */
export interface Calibration {
  samples: number;
  usable_before_trim: number;
  multiple_trim: [number, number];
  global_median_multiple: number;
  power_law: { intercept: number; slope: number; r: number };
  growth_pearson_r: number;
  growth_spearman_rho: number;
  age_resid_r: number;
  band_log10: { own: [number, number]; fallback: [number, number] };
  categories: { name: string; n: number; median_multiple: number | null; own_price: boolean; rows_on_board: number }[];
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  calibration: Calibration;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** What one protocol is priced at, and how much of that price rests on data. */
export interface Priced {
  implied: number;
  lo: number;
  hi: number;
  multiple: number;
  samples: number;
  reliability: Reliability;
  fellBack: boolean;
  offset: number;
  tvlClamped: boolean;
  extrapolated: boolean;
  growthPct: number;
  growthMult: number;
  age: number | null;
}

const BY_CATEGORY = new Map(FIT.categories.map((c) => [c.name, c]));

/** The implied value one protocol gets under `model`, with its sample size, reliability and value band. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): Priced {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;

  const cat = protocol.category === null ? undefined : BY_CATEGORY.get(protocol.category);
  const samples = cat?.n ?? 0;
  const own = cat !== undefined && samples >= model.min_samples;
  const offset = own ? cat.log_offset : model.global_log_offset;

  const logTvl = Math.log10(Math.max(protocol.tvl_usd, 1));
  const [lo10, hi10] = model.tvl_range_log10;
  const clamped = Math.min(hi10, Math.max(lo10, logTvl));
  const multiple = 10 ** (model.intercept + model.slope * clamped + offset);

  // A price is extrapolated when the protocol is more than 10x outside the TVLs its category was measured at.
  const extrapolated = own && (protocol.tvl_usd > cat.max_tvl * 10 || protocol.tvl_usd < cat.min_tvl / 10);
  let reliability: Reliability;
  if (!own) reliability = samples === 0 ? 'no_data' : 'fell_back';
  else if (samples >= model.measured_samples && !extrapolated) reliability = 'measured';
  else reliability = 'thin';

  // The band is the 20th..80th percentile of the calibration residuals around the level this row used: its own
  // category's spread when it is priced from one, the pooled (wider) spread when it fell back, and the pooled
  // spread again when the price is thin, so a thin price never looks tighter than a fallback.
  const [bl, bh] = reliability === 'measured' ? FIT.band_log10.own : FIT.band_log10.fallback;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult));
  return {
    implied,
    lo: Math.max(1, Math.round(implied * 10 ** bl)),
    hi: Math.max(1, Math.round(implied * 10 ** bh)),
    multiple,
    samples,
    reliability,
    fellBack: !own,
    offset,
    tvlClamped: clamped !== logTvl,
    extrapolated,
    growthPct,
    growthMult,
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const priced = impliedValue(p, snapshot.as_of, model);
    return { p, implied: priced.implied, age: priced.age, priced };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    multiple: round4(s.priced.multiple),
    category_samples: s.priced.samples,
    reliability: s.priced.reliability,
    fell_back: s.priced.fellBack,
    implied_lo_usd: s.priced.lo,
    implied_hi_usd: s.priced.hi,
    model: {
      category_offset_log10: round4(s.priced.offset),
      tvl_clamped: s.priced.tvlClamped,
      extrapolated: s.priced.extrapolated,
      growth_pct: s.priced.growthPct,
      growth_multiplier: round4(s.priced.growthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    multiple: row.multiple,
    category_samples: row.category_samples,
    reliability: row.reliability,
    fell_back: row.fell_back,
    implied_lo_usd: row.implied_lo_usd,
    implied_hi_usd: row.implied_hi_usd,
    growth_multiplier: row.model.growth_multiplier,
  };
}

/** The calibration set and every category (measured, or on the board with no sample) with its sample size. */
export function calibration(board: BoardRow[]): Calibration {
  const onBoard = new Map<string, number>();
  for (const r of board) onBoard.set(r.category ?? 'Uncategorised', (onBoard.get(r.category ?? 'Uncategorised') ?? 0) + 1);
  const known = new Set(FIT.categories.map((c) => c.name));
  const categories = [
    ...FIT.categories.map((c) => ({ name: c.name, n: c.n, median_multiple: c.median_multiple, own_price: c.n >= MODEL.min_samples, rows_on_board: onBoard.get(c.name) ?? 0 })),
    ...[...onBoard.entries()].filter(([name]) => !known.has(name)).map(([name, rows]) => ({ name, n: 0, median_multiple: null, own_price: false, rows_on_board: rows })),
  ].sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));
  return {
    samples: FIT.samples,
    usable_before_trim: FIT.usable_before_trim,
    multiple_trim: FIT.multiple_trim,
    global_median_multiple: FIT.global_median_multiple,
    power_law: FIT.power_law,
    growth_pearson_r: FIT.growth_pearson_r,
    growth_spearman_rho: FIT.growth_spearman_rho,
    age_resid_r: FIT.age_resid_r,
    band_log10: FIT.band_log10,
    categories,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    calibration: calibration(board),
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
