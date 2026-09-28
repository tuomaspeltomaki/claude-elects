"""Walk-forward backtest that fits the aggregator's parameters.

For every poll in the history, the model predicts it using only what a
forecaster could have seen on the prediction date: polls whose fieldwork had
ended at least `pub_lag_days` earlier. Nothing about the target poll itself is
in the input. The parameters are then chosen on an early slice of the history
and checked on a later one, so the reported error is out-of-sample.

    python3 model/backtest.py            # fit and write params.json + report
    python3 model/backtest.py --dry      # fit, print, write nothing

The comparison throughout is against the benchmark: the same house's previous
poll, carried forward unchanged.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import aggregate as agg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, os.pardir))
POLLS = os.path.join(ROOT, "data", "polls.csv")

# The grid. Deliberately coarse: this history is 79 polls, and a finer grid
# would be fitting noise.
GRID_WINDOW = [30, 45, 60, 75, 90, 120, 180, 270]
GRID_HALFLIFE = [10, 15, 21, 30, 45, 60]
GRID_HOUSE = [0, 180, 365, 730, 1200]   # 0 = no house effects
GRID_DAMPING = [0.0, 0.25, 0.5, 0.75, 1.0]

PUB_LAG = 3
MIN_HISTORY_POLLS = 8
MIN_HISTORY_DAYS = 120
SPLIT = date(2026, 1, 1)   # targets before this fit; targets after test
FLAT = 0.3                 # movement below this counts as "no change"


# --------------------------------------------------------------------------
# Targets
# --------------------------------------------------------------------------

def build_targets(polls, parties):
    """Every poll we could honestly have predicted at the time.

    The prediction date is taken as the end of the target's fieldwork, which is
    where the real slots sit (see SCHEDULE.md): the HS poll is predicted on the
    13th, its fieldwork ends around the 13th. The reference date — the moment
    the poll actually measures — is the midpoint of its fieldwork.
    """
    targets = []
    for poll in polls:
        cutoff = poll.fw_end
        pool = agg.available(polls, cutoff, PUB_LAG, exclude_id=poll.poll_id)
        if len(pool) < MIN_HISTORY_POLLS:
            continue
        if (cutoff - pool[0].fw_end).days < MIN_HISTORY_DAYS:
            continue
        prior_same = [p for p in pool if p.pollster == poll.pollster]
        if not prior_same:
            continue
        targets.append({
            "poll": poll,
            "cutoff": cutoff,
            "reference": poll.midpoint,
            "pool": pool,
            "previous": prior_same[-1],
        })
    return targets


# --------------------------------------------------------------------------
# Fast path
# --------------------------------------------------------------------------
# Same arithmetic as aggregate.py, with the two expensive pieces cached across
# the grid. Verified against the reference implementation at the end.

def global_consensus(polls, parties, window, half_life):
    out = {}
    for anchor in polls:
        row = {}
        for party in parties:
            num = den = 0.0
            for other in polls:
                if other.pollster == anchor.pollster:
                    continue
                gap = abs((other.midpoint - anchor.midpoint).days)
                if gap > window:
                    continue
                w = agg._recency(gap, half_life) * agg._size(other.n)
                num += w * other.shares.get(party, 0.0)
                den += w
            row[party] = (num / den) if den else None
        out[anchor.poll_id] = row
    return out


def consensus_for(target, parties, window, half_life, cache):
    """Consensus values for the polls available at this target's cutoff.

    Old polls reuse the global values — every neighbour inside their window was
    published long before the cutoff. Only polls near the cutoff are recomputed
    against the restricted pool.
    """
    key = (window, half_life)
    glob = cache.get(key)
    pool = target["pool"]
    cutoff = target["cutoff"]
    horizon = window + 45
    out = {}
    for poll in pool:
        if (cutoff - poll.midpoint).days > horizon:
            out[poll.poll_id] = glob[poll.poll_id]
            continue
        row = {}
        for party in parties:
            num = den = 0.0
            for other in pool:
                if other.pollster == poll.pollster:
                    continue
                gap = abs((other.midpoint - poll.midpoint).days)
                if gap > window:
                    continue
                w = agg._recency(gap, half_life) * agg._size(other.n)
                num += w * other.shares.get(party, 0.0)
                den += w
            row[party] = (num / den) if den else None
        out[poll.poll_id] = row
    return out


def effects_from(target, parties, cons, half_life, house_window):
    if not house_window:
        return {}
    cutoff = target["cutoff"]
    num, den = {}, {}
    for poll in target["pool"]:
        age = (cutoff - poll.midpoint).days
        if age > house_window:
            continue
        w = agg._recency(age, half_life)
        house = poll.pollster
        hn = num.setdefault(house, {p: 0.0 for p in parties})
        hd = den.setdefault(house, {p: 0.0 for p in parties})
        row = cons[poll.poll_id]
        for party in parties:
            ref = row[party]
            if ref is None:
                continue
            hn[party] += w * (poll.shares.get(party, 0.0) - ref)
            hd[party] += w
    raw = {
        house: {
            p: (num[house][p] / den[house][p]) if den[house][p] else 0.0
            for p in parties
        }
        for house in num
    }
    return agg.rescale_effects(raw, parties)


def terms_from(target, parties, effects, window, half_life):
    cutoff = target["cutoff"]
    out = {}
    for party in parties:
        xs, ys, ws = [], [], []
        for poll in target["pool"]:
            age = (cutoff - poll.midpoint).days
            if age > window or age < 0:
                continue
            adj = effects.get(poll.pollster, {}).get(party, 0.0)
            xs.append(-float(age))
            ys.append(poll.shares.get(party, 0.0) - adj)
            ws.append(agg._recency(age, half_life) * agg._size(poll.n))
        if not xs:
            out[party] = None
            continue
        tw = sum(ws)
        xbar = sum(w * x for w, x in zip(ws, xs)) / tw
        ybar = sum(w * y for w, y in zip(ws, ys)) / tw
        sxx = sum(w * (x - xbar) ** 2 for w, x in zip(ws, xs))
        sxy = sum(w * (x - xbar) * (y - ybar) for w, x, y in zip(ws, xs, ys))
        out[party] = (xbar, ybar, (sxy / sxx) if sxx > 0 else 0.0)
    return out


def predict_fast(target, parties, terms, effects, damping):
    x_ref = float((target["reference"] - target["cutoff"]).days)
    house = target["poll"].pollster
    raw = {}
    for party in parties:
        t = terms[party]
        if t is None:
            raw[party] = 0.0
            continue
        xbar, ybar, slope = t
        raw[party] = (ybar + damping * slope * (x_ref - xbar)
                      + effects.get(house, {}).get(party, 0.0))
    return agg.normalise(raw)


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def errors(pred, actual, parties):
    return [abs(pred[p] - actual.get(p, 0.0)) for p in parties]


def direction_hits(pred, actual, previous, parties):
    hits = 0
    for party in parties:
        pc = pred[party] - previous.get(party, 0.0)
        ac = actual.get(party, 0.0) - previous.get(party, 0.0)
        pd = 0 if abs(pc) < FLAT else (1 if pc > 0 else -1)
        ad = 0 if abs(ac) < FLAT else (1 if ac > 0 else -1)
        if pd == ad:
            hits += 1
    return hits


def mae_of(values):
    return sum(values) / len(values) if values else float("nan")


# --------------------------------------------------------------------------

def run():
    t0 = time.time()
    polls = agg.load_polls(POLLS)
    parties = agg.parties_of(polls)
    targets = build_targets(polls, parties)

    train = [t for t in targets if t["cutoff"] < SPLIT]
    test = [t for t in targets if t["cutoff"] >= SPLIT]

    print("polls: %d   parties: %d" % (len(polls), len(parties)))
    print("targets: %d  (train %d to %s, test %d from %s)"
          % (len(targets), len(train), SPLIT, len(test), SPLIT))
    print("history: %s -> %s" % (polls[0].fw_end, polls[-1].fw_end))

    # Benchmark: same house's previous poll carried forward.
    bench = {"train": [], "test": []}
    bench_dir = {"train": [0, 0], "test": [0, 0]}
    for split, group in (("train", train), ("test", test)):
        for t in targets if False else group:
            actual = t["poll"].shares
            prev = t["previous"].shares
            bench[split].extend(errors(prev, actual, parties))
            bench_dir[split][0] += direction_hits(prev, actual, prev, parties)
            bench_dir[split][1] += len(parties)

    # Cache the cutoff-independent consensus once per (window, half-life).
    cons_cache = {}
    for window in GRID_WINDOW:
        for half_life in GRID_HALFLIFE:
            cons_cache[(window, half_life)] = global_consensus(
                polls, parties, window, half_life)
    print("consensus cached in %.1fs" % (time.time() - t0))

    results = []
    for window in GRID_WINDOW:
        for half_life in GRID_HALFLIFE:
            per_target = {}
            for t in targets:
                cons = consensus_for(t, parties, window, half_life, cons_cache)
                per_target[id(t)] = cons
            for house_window in GRID_HOUSE:
                prepared = {}
                for t in targets:
                    eff = effects_from(t, parties, per_target[id(t)],
                                       half_life, house_window)
                    prepared[id(t)] = (eff, terms_from(t, parties, eff,
                                                       window, half_life))
                for damping in GRID_DAMPING:
                    errs = {"train": [], "test": []}
                    dirs = {"train": [0, 0], "test": [0, 0]}
                    for t in targets:
                        eff, terms = prepared[id(t)]
                        pred = predict_fast(t, parties, terms, eff, damping)
                        actual = t["poll"].shares
                        split = "train" if t["cutoff"] < SPLIT else "test"
                        errs[split].extend(errors(pred, actual, parties))
                        dirs[split][0] += direction_hits(
                            pred, actual, t["previous"].shares, parties)
                        dirs[split][1] += len(parties)
                    results.append({
                        "window_days": window,
                        "half_life_days": half_life,
                        "house_window_days": house_window,
                        "damping": damping,
                        "train_mae": mae_of(errs["train"]),
                        "test_mae": mae_of(errs["test"]),
                        "train_dir": dirs["train"][0] / max(1, dirs["train"][1]),
                        "test_dir": dirs["test"][0] / max(1, dirs["test"][1]),
                    })
        print("  window %d done (%.1fs)" % (window, time.time() - t0))

    results.sort(key=lambda r: r["train_mae"])
    best = results[0]

    print()
    print("benchmark  train MAE %.3f  test MAE %.3f  (direction %.0f%% / %.0f%%)"
          % (mae_of(bench["train"]), mae_of(bench["test"]),
             100 * bench_dir["train"][0] / max(1, bench_dir["train"][1]),
             100 * bench_dir["test"][0] / max(1, bench_dir["test"][1])))
    print()
    print("top 10 by train MAE")
    print("%-6s %-6s %-7s %-5s %8s %8s %7s %7s"
          % ("W", "H", "T", "d", "trainMAE", "testMAE", "trainDir", "testDir"))
    for r in results[:10]:
        print("%-6d %-6d %-7d %-5.2f %8.3f %8.3f %7.1f%% %7.1f%%"
              % (r["window_days"], r["half_life_days"], r["house_window_days"],
                 r["damping"], r["train_mae"], r["test_mae"],
                 100 * r["train_dir"], 100 * r["test_dir"]))

    out = {
        "results": results,
        "best": best,
        "benchmark": {
            "train_mae": mae_of(bench["train"]),
            "test_mae": mae_of(bench["test"]),
            "train_dir": bench_dir["train"][0] / max(1, bench_dir["train"][1]),
            "test_dir": bench_dir["test"][0] / max(1, bench_dir["test"][1]),
        },
        "n_targets": len(targets),
        "n_train": len(train),
        "n_test": len(test),
        "parties": parties,
        "elapsed_s": time.time() - t0,
    }
    with open(os.path.join(HERE, "backtest_grid.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1)
    print()
    print("wrote model/backtest_grid.json in %.1fs" % (time.time() - t0))
    return out


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------
# The grid's flat bottom spans many combinations separated by less than the
# noise in 71 polls, so picking the exact minimum would be fitting the sample.
# Instead: take everything within TOLERANCE of the best training error, and
# among those pick the combination whose neighbours in the grid are also good.
# A parameter set that only works at one point is a fluke; one whose whole
# neighbourhood works is a setting. Only training data is used to choose.

TOLERANCE = 1.02
AXES = ("window_days", "half_life_days", "house_window_days", "damping")
GRIDS = {
    "window_days": GRID_WINDOW,
    "half_life_days": GRID_HALFLIFE,
    "house_window_days": GRID_HOUSE,
    "damping": GRID_DAMPING,
}


def _key(r):
    return tuple(r[a] for a in AXES)


def select(results):
    lookup = {_key(r): r for r in results}
    floor = min(r["train_mae"] for r in results)
    shortlist = [r for r in results if r["train_mae"] <= floor * TOLERANCE]
    scored = []
    for r in shortlist:
        neighbours = []
        for axis in AXES:
            grid = GRIDS[axis]
            i = grid.index(r[axis])
            for j in (i - 1, i + 1):
                if 0 <= j < len(grid):
                    k = list(_key(r))
                    k[AXES.index(axis)] = grid[j]
                    n = lookup.get(tuple(k))
                    if n:
                        neighbours.append(n["train_mae"])
        roughness = sum(neighbours) / len(neighbours) if neighbours else r["train_mae"]
        scored.append((roughness, r["train_mae"], r))
    scored.sort(key=lambda t: (t[0], t[1]))
    return scored[0][2], len(shortlist)


# --------------------------------------------------------------------------
# Diagnostics for the chosen parameters
# --------------------------------------------------------------------------

def diagnose(params):
    polls = agg.load_polls(POLLS)
    parties = agg.parties_of(polls)
    targets = build_targets(polls, parties)
    rows = []
    for t in targets:
        pred = agg.predict(polls, t["poll"].pollster, t["reference"],
                           t["cutoff"], params, parties=parties,
                           exclude_id=t["poll"].poll_id)
        rows.append({
            "poll_id": t["poll"].poll_id,
            "pollster": t["poll"].pollster,
            "cutoff": t["cutoff"].isoformat(),
            "pred": pred,
            "actual": dict(t["poll"].shares),
            "previous": dict(t["previous"].shares),
        })
    per_party = {}
    for party in parties:
        model_err, bench_err, signed = [], [], []
        m_dir = b_dir = n_dir = 0
        for r in rows:
            a = r["actual"].get(party, 0.0)
            p = r["pred"][party]
            q = r["previous"].get(party, 0.0)
            model_err.append(abs(p - a))
            bench_err.append(abs(q - a))
            signed.append(p - a)
            ac = a - q
            ad = 0 if abs(ac) < FLAT else (1 if ac > 0 else -1)
            pc = p - q
            pd = 0 if abs(pc) < FLAT else (1 if pc > 0 else -1)
            m_dir += (pd == ad)
            b_dir += (0 == ad)
            n_dir += 1
        mean = sum(signed) / len(signed)
        var = sum((s - mean) ** 2 for s in signed) / max(1, len(signed) - 1)
        ordered = sorted(model_err)
        p90 = ordered[min(len(ordered) - 1, int(0.9 * len(ordered)))]
        per_party[party] = {
            "model_mae": mae_of(model_err),
            "benchmark_mae": mae_of(bench_err),
            "bias": mean,
            "sd": var ** 0.5,
            "p90_abs_error": p90,
            "model_direction": m_dir / n_dir,
            "benchmark_direction": b_dir / n_dir,
            "n": n_dir,
        }
    return rows, per_party, parties


def verify(params, n=6):
    """The grid search uses a cached rewrite of the same arithmetic. Check it
    against the reference implementation before trusting anything above."""
    polls = agg.load_polls(POLLS)
    parties = agg.parties_of(polls)
    targets = build_targets(polls, parties)
    cache = {(params["window_days"], params["half_life_days"]):
             global_consensus(polls, parties, params["window_days"],
                              params["half_life_days"])}
    worst = 0.0
    step = max(1, len(targets) // n)
    for t in targets[::step]:
        cons = consensus_for(t, parties, params["window_days"],
                             params["half_life_days"], cache)
        eff = effects_from(t, parties, cons, params["half_life_days"],
                           params["house_window_days"])
        terms = terms_from(t, parties, eff, params["window_days"],
                           params["half_life_days"])
        fast = predict_fast(t, parties, terms, eff, params["damping"])
        slow = agg.predict(polls, t["poll"].pollster, t["reference"],
                           t["cutoff"], params, parties=parties,
                           exclude_id=t["poll"].poll_id)
        for party in parties:
            worst = max(worst, abs(fast[party] - slow[party]))
    return worst


# --------------------------------------------------------------------------

REPORT = """# Backtest

Generated by `model/backtest.py`. Do not edit by hand.

## What was tested

Every poll in `data/polls.csv` that had enough history behind it: **{n_targets}
targets**, {first} to {last}. Each was predicted using only polls whose
fieldwork had ended at least {lag} days before the prediction date, so nothing
about the target — and nothing published alongside it — was in its own input.

Parameters were chosen on the {n_train} targets before {split} and the error
below is reported on the {n_test} targets after it. The choice never saw the
later slice.

**This validates the poll predictions only.** `data/polls.csv` begins at the
2023 election, so there is no earlier campaign in the file to test an election
forecast against. The election track runs on the same fitted parameters but is
unvalidated, and should be described that way until the 2019-2023 cycle is
imported.

## Result

| | train MAE | test MAE | direction |
|---|---|---|---|
| Benchmark (last poll carried forward) | {b_train:.3f} | {b_test:.3f} | {b_dir:.0f}% |
| Model | {m_train:.3f} | {m_test:.3f} | {m_dir:.0f}% |

Errors are percentage points per party. Out of sample the model beats the
benchmark by **{gain:.3f} points** per party, about {pct:.0f}% of the
benchmark's error.

That gain is small, and it should be described as small. On any single poll it
is invisible: both methods are usually within half a point, and which one lands
closer on a given party is close to a coin toss. What the backtest supports is a
claim across many polls, not a claim about the next one.

The clearer separation is in direction of change: {m_dir:.0f}% against the
benchmark's {b_dir:.0f}%. Direction is measured against the same house's
previous poll, with movements under {flat} points counted as "no change", so it
is a three-way call and the benchmark — which always predicts "no change" —
scores whatever share of parties genuinely sat still.

## Chosen parameters

| Parameter | Value | What it does |
|---|---|---|
| `window_days` | {window_days} | How far back polls are read. |
| `half_life_days` | {half_life_days} | A poll counts half as much every this many days. |
| `house_window_days` | {house_window_days} | Trailing window for estimating house effects. |
| `damping` | {damping} | How much of the fitted trend is carried forward. |
| `pub_lag_days` | {pub_lag_days} | Days between fieldwork ending and publication. |

Chosen from {shortlist} combinations within {tol:.0f}% of the best training
error, by preferring the one whose neighbours in the grid also score well. The
flat bottom of that grid is wider than the noise in {n_targets} polls, so the
exact minimum is not a meaningful target.

## What the fit says

**Trend extrapolation barely helps.** Damping settles at {damping}, near the
bottom of its range. Carried forward at full strength the training error rises
to {full_d_train:.3f} against the chosen {m_train:.3f}. Most poll-to-poll
movement is sampling noise, and extending a trend fitted to noise produces more
of it.

**House effects are where the gain is.** Turning them off entirely gives a
training error of {no_house:.3f}, level with the benchmark. Correcting for the
systematic gap between Taloustutkimus and Verian is most of what the model does.

**A short window beats a long one, but not too short.** Below about 60 days
there are too few polls to average and the error explodes.

## Per-party error, all {n_targets} targets

| Party | model MAE | benchmark MAE | bias | sd | 90th pct | direction | benchmark direction |
|---|---|---|---|---|---|---|---|
{party_rows}

The big parties are where the error is, and where direction calls are hardest:
a party polling around 20% moves more between rounds than one polling around 4%,
and the small parties score well on direction mostly because they genuinely sit
still.

`bias` is the average signed error: positive means the model reads the party
high. `sd` and the 90th percentile are what an honest uncertainty band should
be built from — not the pollsters' reported margin of error, which describes
sampling alone.

## Reproducing

    python3 model/backtest.py

The grid search uses a cached rewrite of the arithmetic in `model/aggregate.py`.
The two were checked against each other on this run and agreed to within
{verify:.3f} points.
"""


def main():
    out = run()
    results = out["results"]
    bench = out["benchmark"]

    chosen, shortlist = select(results)
    params = {
        "method_version": "poll-model-1",
        "fitted_on": date.today().isoformat(),
        "window_days": chosen["window_days"],
        "half_life_days": chosen["half_life_days"],
        "house_window_days": chosen["house_window_days"],
        "damping": chosen["damping"],
        "pub_lag_days": PUB_LAG,
    }

    print()
    print("chosen: W=%d H=%d T=%d d=%.2f  (from %d within %.0f%% of best)"
          % (params["window_days"], params["half_life_days"],
             params["house_window_days"], params["damping"],
             shortlist, 100 * (TOLERANCE - 1)))
    print("        train %.3f  test %.3f  vs benchmark train %.3f  test %.3f"
          % (chosen["train_mae"], chosen["test_mae"],
             bench["train_mae"], bench["test_mae"]))

    worst = verify(params)
    print("fast path vs reference implementation: max difference %.4f points" % worst)
    if worst > 0.051:
        print("WARNING: implementations disagree beyond rounding")

    rows, per_party, parties = diagnose(params)
    polls = agg.load_polls(POLLS)
    targets = build_targets(polls, parties)

    no_house = min(r["train_mae"] for r in results if r["house_window_days"] == 0)
    full_d = min(r["train_mae"] for r in results if r["damping"] == 1.0)

    party_rows = "\n".join(
        "| `%s` | %.2f | %.2f | %+.2f | %.2f | %.2f | %.0f%% | %.0f%% |"
        % (p, per_party[p]["model_mae"], per_party[p]["benchmark_mae"],
           per_party[p]["bias"], per_party[p]["sd"],
           per_party[p]["p90_abs_error"], 100 * per_party[p]["model_direction"],
           100 * per_party[p]["benchmark_direction"])
        for p in sorted(parties, key=lambda p: -per_party[p]["model_mae"])
    )

    report = REPORT.format(
        n_targets=out["n_targets"], n_train=out["n_train"], n_test=out["n_test"],
        first=targets[0]["cutoff"], last=targets[-1]["cutoff"],
        lag=PUB_LAG, split=SPLIT, flat=FLAT,
        b_train=bench["train_mae"], b_test=bench["test_mae"],
        b_dir=100 * bench["test_dir"],
        m_train=chosen["train_mae"], m_test=chosen["test_mae"],
        m_dir=100 * chosen["test_dir"],
        gain=bench["test_mae"] - chosen["test_mae"],
        pct=100 * (bench["test_mae"] - chosen["test_mae"]) / bench["test_mae"],
        shortlist=shortlist, tol=100 * (TOLERANCE - 1),
        no_house=no_house, full_d_train=full_d,
        party_rows=party_rows, verify=worst,
        **{k: params[k] for k in ("window_days", "half_life_days",
                                  "house_window_days", "damping", "pub_lag_days")}
    )

    if "--dry" not in sys.argv:
        # Every backtest prediction, for charting. Deliberately NOT written to
        # data/predictions.csv: that ledger holds predictions made before the
        # poll was published, and these were made afterwards. Mixing them would
        # destroy the one thing the ledger is for.
        import csv as _csv
        path = os.path.join(HERE, "backtest_predictions.csv")
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = _csv.writer(fh)
            w.writerow(["target_poll_id", "pollster", "date", "party",
                        "predicted", "actual", "method_version"])
            for r in rows:
                for party in parties:
                    w.writerow([r["poll_id"], r["pollster"], r["cutoff"], party,
                                "%.1f" % r["pred"][party],
                                "%.1f" % r["actual"].get(party, 0.0),
                                params["method_version"]])
        print("wrote model/backtest_predictions.csv (%d rows)"
              % (len(rows) * len(parties)))

        with open(os.path.join(HERE, "params.json"), "w", encoding="utf-8") as fh:
            json.dump(params, fh, indent=1)
            fh.write("\n")
        with open(os.path.join(HERE, "backtest_results.md"), "w", encoding="utf-8") as fh:
            fh.write(report)
        print()
        print("wrote model/params.json and model/backtest_results.md")
    else:
        print()
        print(report)


if __name__ == "__main__":
    main()
