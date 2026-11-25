# makefun-token-radar-c

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/toannhu96/makefun-token-radar-c/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/toannhu96/makefun-token-radar-c/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads the sealed DefiLlama snapshot, ranks pre-token
protocols by an implied value, and gives each one a farming plan. The multiple
is calibrated from the live tokens in the same snapshot, per category, with a
TVL power law, instead of the starter's flat 0.25. Every row carries its sample
size, a reliability label and a value band, so the board says which prices rest
on data and which fell back to the all-category median. The dashboard is static:
no framework and no network.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Then open `out/dashboard/index.html`.

## How the model is fitted

`tools/fit.mjs` builds the calibration set from the snapshot's own live tokens
(`mcap_usd > 0`, `tvl_usd > 0`), fits
`log10(multiple) = intercept + slope * log10(tvl)` globally and per category,
and measures the growth correlation. It writes `lib/fit.json`, which
`lib/model.ts` reads. Nothing is hard-coded from outside the snapshot.

Measured on the sealed snapshot: 116 usable live samples, global slope -0.34
(r = -0.36), seven-day growth correlation r = 0.04, global median multiple
0.263. A category with fewer than three live samples never drives its own
price; those rows fall back to the all-category median and the board says so.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
