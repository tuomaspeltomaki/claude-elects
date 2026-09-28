"""The polls-only model for claude_elects.

Reference implementation of the aggregator described in METHOD.md. It reads
nothing but data/polls.csv: no news, no judgement, no arguments beyond the
target. Same data in, same numbers out.

Usage as a library:

    polls  = load_polls("data/polls.csv")
    shares = predict(polls, "Verian", reference_date, cutoff, PARAMS)

Usage from the shell:

    python3 model/aggregate.py Verian 2026-10-13
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from datetime import date, timedelta

# --------------------------------------------------------------------------
# Parameters
# --------------------------------------------------------------------------
# Fitted by model/backtest.py and then frozen for the season. Do not tune these
# by hand between cycles: add a new version instead, and run both to the end.

HERE = os.path.dirname(os.path.abspath(__file__))
PARAMS_PATH = os.path.join(HERE, "params.json")

FALLBACK_PARAMS = {
    "method_version": "unfitted",
    "window_days": 120,
    "half_life_days": 30,
    "house_window_days": 730,
    "damping": 0.5,
    "pub_lag_days": 3,
}


def load_params(path: str = PARAMS_PATH) -> dict:
    """The frozen parameter set. Falls back to placeholders if not yet fitted."""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return dict(FALLBACK_PARAMS)


# --------------------------------------------------------------------------
# Data
# --------------------------------------------------------------------------

class Poll:
    __slots__ = ("poll_id", "pollster", "fw_start", "fw_end", "n", "shares")

    def __init__(self, poll_id, pollster, fw_start, fw_end, n):
        self.poll_id = poll_id
        self.pollster = pollster
        self.fw_start = fw_start
        self.fw_end = fw_end
        self.n = n
        self.shares = {}

    @property
    def midpoint(self) -> date:
        return self.fw_start + (self.fw_end - self.fw_start) / 2

    def __repr__(self):
        return "<Poll %s %s>" % (self.poll_id, self.fw_end)


def _parse_date(value: str) -> date:
    return date(*(int(part) for part in value.split("-")))


def load_polls(path: str) -> list:
    """Published polls only, sorted by end of fieldwork. Election results are
    anchors for charting, not model input, so they are dropped here."""
    polls = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["type"] != "poll":
                continue
            poll = polls.get(row["poll_id"])
            if poll is None:
                try:
                    n = int(row["sample_size"])
                except (ValueError, KeyError, TypeError):
                    n = 1000
                poll = Poll(
                    row["poll_id"],
                    row["pollster"],
                    _parse_date(row["fieldwork_start"]),
                    _parse_date(row["fieldwork_end"]),
                    n,
                )
                polls[row["poll_id"]] = poll
            poll.shares[row["party"]] = float(row["share"])
    return sorted(polls.values(), key=lambda p: (p.fw_end, p.poll_id))


def parties_of(polls: list) -> list:
    seen = set()
    for poll in polls:
        seen.update(poll.shares)
    return sorted(seen)


def available(polls: list, cutoff: date, pub_lag_days: int, exclude_id=None) -> list:
    """Polls a forecaster could actually have seen on the cutoff date.

    A poll is public only after its fieldwork ends plus the publication lag, so
    a poll still in the field on the prediction date is not input to it.
    """
    limit = cutoff - timedelta(days=pub_lag_days)
    return [
        p for p in polls
        if p.fw_end <= limit and p.poll_id != exclude_id
    ]


# --------------------------------------------------------------------------
# Weights
# --------------------------------------------------------------------------

def _recency(age_days: float, half_life: float) -> float:
    return 0.5 ** (age_days / half_life)


def _size(n: int) -> float:
    return math.sqrt(max(n, 1) / 1000.0)


# --------------------------------------------------------------------------
# House effects
# --------------------------------------------------------------------------

def consensus_at(polls: list, anchor: Poll, party: str, params: dict):
    """Where the other houses had this party around `anchor`'s fieldwork.

    The anchor's own house is excluded, otherwise a house is partly compared
    against itself and its house effect is pulled toward zero.
    """
    half_life = params["half_life_days"]
    window = params["window_days"]
    num = den = 0.0
    for other in polls:
        if other.pollster == anchor.pollster:
            continue
        gap = abs((other.midpoint - anchor.midpoint).days)
        if gap > window:
            continue
        w = _recency(gap, half_life) * _size(other.n)
        num += w * other.shares.get(party, 0.0)
        den += w
    return (num / den) if den else None


def house_effects(polls: list, cutoff: date, parties: list, params: dict) -> dict:
    """Per house, per party: the average signed gap to the other houses.

    Estimated only from polls available at the cutoff, over a trailing window,
    weighted toward recent evidence.
    """
    trailing = params["house_window_days"]
    half_life = params["half_life_days"]
    if not trailing:
        return {}
    effects = {}
    houses = {p.pollster for p in polls}
    for house in houses:
        num = {party: 0.0 for party in parties}
        den = {party: 0.0 for party in parties}
        for poll in polls:
            if poll.pollster != house:
                continue
            age = (cutoff - poll.midpoint).days
            if age > trailing:
                continue
            w = _recency(age, half_life)
            for party in parties:
                ref = consensus_at(polls, poll, party, params)
                if ref is None:
                    continue
                num[party] += w * (poll.shares.get(party, 0.0) - ref)
                den[party] += w
        effects[house] = {
            party: (num[party] / den[party]) if den[party] else 0.0
            for party in parties
        }
    return rescale_effects(effects, parties)


def rescale_effects(effects: dict, parties: list) -> dict:
    """Convert gaps-to-the-other-houses into deviations from the consensus.

    `consensus_at` excludes the house being measured, so what comes back is the
    gap to everyone else, not the gap to the middle. With k houses that gap is
    k/(k-1) times too large: with the two Finnish houses it is exactly double,
    and subtracting it whole would swap the two houses rather than align them.
    Scaling by (k-1)/k fixes it, and centring afterwards keeps the de-housed
    series on the same level as the polls themselves.
    """
    k = len(effects)
    if k < 2:
        return {house: {p: 0.0 for p in parties} for house in effects}
    factor = (k - 1) / float(k)
    scaled = {
        house: {p: effects[house][p] * factor for p in parties}
        for house in effects
    }
    for party in parties:
        mean = sum(scaled[h][party] for h in scaled) / k
        for h in scaled:
            scaled[h][party] -= mean
    return scaled


# --------------------------------------------------------------------------
# Trend
# --------------------------------------------------------------------------

def trend_terms(polls: list, cutoff: date, party: str, effects: dict, params: dict):
    """Weighted level and slope of the de-housed series, in points per day.

    x is days relative to the cutoff (negative in the past). Returns the
    weighted mean x, the weighted mean level, and the slope.
    """
    half_life = params["half_life_days"]
    window = params["window_days"]
    xs, ys, ws = [], [], []
    for poll in polls:
        age = (cutoff - poll.midpoint).days
        if age > window or age < 0:
            continue
        adj = effects.get(poll.pollster, {}).get(party, 0.0)
        xs.append(-float(age))
        ys.append(poll.shares.get(party, 0.0) - adj)
        ws.append(_recency(age, half_life) * _size(poll.n))
    if not xs:
        return None
    tw = sum(ws)
    xbar = sum(w * x for w, x in zip(ws, xs)) / tw
    ybar = sum(w * y for w, y in zip(ws, ys)) / tw
    sxx = sum(w * (x - xbar) ** 2 for w, x in zip(ws, xs))
    sxy = sum(w * (x - xbar) * (y - ybar) for w, x, y in zip(ws, xs, ys))
    slope = (sxy / sxx) if sxx > 0 else 0.0
    return xbar, ybar, slope


# --------------------------------------------------------------------------
# Rounding
# --------------------------------------------------------------------------

def normalise(shares: dict, total: float = 100.0) -> dict:
    """Scale to `total`, then round to one decimal by largest remainder so the
    published set still sums to `total` exactly."""
    clean = {k: max(0.0, v) for k, v in shares.items()}
    s = sum(clean.values())
    if s <= 0:
        return {k: 0.0 for k in clean}
    scaled = {k: v * total / s for k, v in clean.items()}
    tenths = {k: int(math.floor(v * 10)) for k, v in scaled.items()}
    short = int(round(total * 10)) - sum(tenths.values())
    order = sorted(
        scaled,
        key=lambda k: (-(scaled[k] * 10 - tenths[k]), k),
    )
    for k in order[:max(0, short)]:
        tenths[k] += 1
    return {k: tenths[k] / 10.0 for k in tenths}


# --------------------------------------------------------------------------
# Prediction
# --------------------------------------------------------------------------

def predict(polls: list, target_pollster, reference_date: date, cutoff: date,
            params: dict, parties=None, apply_house: bool = True,
            exclude_id=None) -> dict:
    """Predicted shares for one poll, or for the election.

    `target_pollster` is the house whose next poll is being predicted, or None
    for the election, where no house effect is added back: the aim there is the
    result, not any house's version of it.
    """
    pool = available(polls, cutoff, params["pub_lag_days"], exclude_id=exclude_id)
    if not pool:
        raise ValueError("no polls available at %s" % cutoff)
    if parties is None:
        parties = parties_of(pool)

    effects = house_effects(pool, cutoff, parties, params)
    x_ref = float((reference_date - cutoff).days)
    damping = params["damping"]

    raw = {}
    for party in parties:
        terms = trend_terms(pool, cutoff, party, effects, params)
        if terms is None:
            raw[party] = 0.0
            continue
        xbar, ybar, slope = terms
        value = ybar + damping * slope * (x_ref - xbar)
        if apply_house and target_pollster:
            value += effects.get(target_pollster, {}).get(party, 0.0)
        raw[party] = value
    return normalise(raw)


def benchmark(polls: list, target_pollster, cutoff: date, params: dict,
              exclude_id=None):
    """The honest baseline: that house's previous poll, carried forward."""
    pool = [
        p for p in available(polls, cutoff, params["pub_lag_days"], exclude_id)
        if p.pollster == target_pollster
    ]
    if not pool:
        return None
    return dict(pool[-1].shares)


# --------------------------------------------------------------------------

def main(argv):
    if len(argv) < 3:
        print(__doc__.strip())
        return 1
    pollster = argv[1] if argv[1].lower() != "election" else None
    reference = _parse_date(argv[2])
    cutoff = _parse_date(argv[3]) if len(argv) > 3 else date.today()
    params = load_params()
    polls = load_polls(os.path.join(HERE, os.pardir, "data", "polls.csv"))
    shares = predict(polls, pollster, reference, cutoff, params)
    print("method_version: %s" % params.get("method_version"))
    print("cutoff: %s   reference: %s" % (cutoff, reference))
    for party, value in sorted(shares.items(), key=lambda kv: -kv[1]):
        print("%-6s %5.1f" % (party, value))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
