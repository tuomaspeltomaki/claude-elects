# Method

How every prediction in this repo is made. The point of writing it down is that
it does not change between cycles — otherwise nobody can tell whether Claude is
improving or the prompt is.

Target: the Finnish parliamentary election of **18 April 2027**, and each
upcoming poll from the two monthly pollsters:

| Pollster | Client | Code |
|---|---|---|
| Taloustutkimus | Yle | `TT` |
| Verian (Kantar Public before the 2023 rebrand) | Helsingin Sanomat | `VER` |

They alternate, so a new poll appears roughly every two weeks.

This file fixes *how* a prediction is made. [SCHEDULE.md](SCHEDULE.md) fixes
*when*, and records how far each slot sits ahead of the fieldwork it predicts.

## The cycle

**Phase 0 — read the ledger.** Read `data/predictions.csv` and `data/polls.csv`
before anything else. Score any prediction whose poll has since been published.

**Phase 1 — polls only.** Fetch the latest polls. Predict, for each party:
the next poll from whichever pollster is due, and the election result. No news
input at all in this phase. Write both to the ledger.

**Phase 2 — plus news.** Only now, check the news covering the target poll's
estimated fieldwork window. Adjust the Phase 1 numbers where a real shock
justifies it, and write the adjusted set as a second track. Every adjustment
gets a line in `data/news_log.csv` saying which event, which party, how much,
and why — otherwise the track cannot be audited afterwards.

Phase 1 is locked before Phase 2 begins. It is never revised in light of the news.

### What counts as news

Only events that happened **before or during** the fieldwork window can move a
poll. An event after fieldwork closes belongs to the *next* cycle.

Fieldwork runs three to four weeks and the dates are not announced until
publication, so the window is estimated from the pollster's past pattern. An
event in the final days of the window reached only part of the sample, so its
effect is scaled down accordingly.

Looked at: government crises, party leader changes, scandals, major budget
decisions, strikes, security shocks. Not looked at: social media sentiment.
It measures who is loud, not who votes.

## The three tracks

| Track | What it is |
|---|---|
| `polls_only` | Phase 1. Recent polls and house effects, nothing else. |
| `plus_news` | Phase 2. Phase 1 adjusted for shocks during fieldwork. |
| `benchmark` | The same pollster's previous poll, carried forward unchanged. |

The benchmark is the honest baseline. If neither Claude track beats it, that is
the finding, and it gets reported.

## Resolution

One decimal, matching what the pollsters and the official results publish.
Two decimals would be precision that can never be checked.

Party shares in a prediction sum to 100. `MUUT` (others) is a line of its own.

## Scoring

1. **Mean absolute error** — average miss per party, in percentage points.
   This is the headline number.
2. **Direction of change** — right or wrong, measured only against the *same
   pollster's* previous poll. Movements under 0.3 points count as "no change",
   so a flat party does not hand out a coin-flip hit.
3. **Rank order** — did the predicted finishing order match?

## The election prediction

Made on the 7th of every month, so the forecast can be charted as it drifts,
with one extra round on **13 April 2027**, the day advance voting closes. That
last one is the real one, and the number the account is judged on. Dates for
every prediction are in [SCHEDULE.md](SCHEDULE.md).

Unlike the poll predictions, which track one pollster each, the election
prediction draws on all credible published polling.

## Ledger rules

- Append-only. Rows are added, never edited or deleted. Corrections go in as new
  rows with a later `made_at`.
- A prediction is written before the target poll is published, and the commit
  timestamp shows it. Commit dates can be forged, so a social post before
  publication remains the stronger proof.
- Fieldwork periods overlap between pollsters. When predicting one pollster,
  the other's already-published polls covering the same period are fair input —
  they are public.

## Files

| File | Contents |
|---|---|
| `data/polls.csv` | Published polls, one row per party. Anchored by the 2023 election result. |
| `data/predictions.csv` | Every prediction, one row per party per track. |
| `data/news_log.csv` | Why `plus_news` differs from `polls_only`. |
| `data/parties.csv` | Party codes, names, provisional chart colours. |
