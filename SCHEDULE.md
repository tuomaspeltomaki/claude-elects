# Schedule

When every prediction is made. Fixed in advance, for the same reason the method
is: a slot that moves to suit the news is not a forecast, it is a comment.

Target: the Finnish parliamentary election of **Sunday 18 April 2027**.

## The three standing slots

| Slot | When | Predicts | News cutoff |
|---|---|---|---|
| **HS / Verian** | 13th of each month | the next Verian poll | end of the 13th |
| **Yle / Taloustutkimus** | last day of each month | the next Taloustutkimus poll | end of that day |
| **Election** | 7th of each month | the 18 April result | end of the 7th |

Plus one extra election forecast on **13 April 2027**, the day advance voting
closes. That is the final one, and the number the account is judged on.

Every slot produces both Claude tracks, `polls_only` and `plus_news`, written
together. `benchmark` is computed for the same target, not predicted.

## Why these dates

Verian publishes in HS on the 15th or later, roughly two days after fieldwork
closes. Taloustutkimus publishes at Yle in the first days of the month, roughly
three days after fieldwork closes. Each slot sits just before the corresponding
fieldwork window shuts, so the prediction is locked while the last interviews
are still being taken and cannot be contaminated by the poll's own coverage.

### The slots run early — by about three days

Measured against the 79 polls in `data/polls.csv`, over the most recent twelve
rounds of each pollster:

| Pollster | Fieldwork runs past its slot by | Range | Typical fieldwork length |
|---|---|---|---|
| Verian | **median 3 days** | −1 to +7 days | 27–34 days |
| Taloustutkimus | **median 3 days** | +1 to +30 days | 22–29 days |

So roughly the last three days of each fieldwork window fall after the news
cutoff. This is a known, deliberate bias, not an accident: it makes the
prediction strictly harder and keeps the cutoff on a fixed calendar date rather
than on a fieldwork end that is only announced after publication.

It is recorded here so it can be corrected for in scoring rather than
discovered later. The actual fieldwork window goes into `data/polls.csv` on
publication, so the real gap is checkable for every single prediction.

The Taloustutkimus range has a 30-day outlier: the pollster occasionally skips a
month, and the slot then sits a full cycle early. When a month is skipped, the
prediction still stands and is scored against whatever poll eventually arrives.

## Every prediction day

21 days, 22 predictions, 44 logged forecasts.

### 2026

| Date | Slot |
|---|---|
| Wed 30 Sep | Yle / Taloustutkimus |
| Wed 7 Oct | Election |
| Tue 13 Oct | HS / Verian |
| Sat 31 Oct | Yle / Taloustutkimus |
| Sat 7 Nov | Election |
| Fri 13 Nov | HS / Verian |
| Mon 30 Nov | Yle / Taloustutkimus |
| Mon 7 Dec | Election |
| Sun 13 Dec | HS / Verian |
| Thu 31 Dec | Yle / Taloustutkimus |

### 2027

| Date | Slot |
|---|---|
| Thu 7 Jan | Election |
| Wed 13 Jan | HS / Verian |
| Sun 31 Jan | Yle / Taloustutkimus |
| Sun 7 Feb | Election |
| Sat 13 Feb | HS / Verian |
| Sun 28 Feb | Yle / Taloustutkimus |
| Sun 7 Mar | Election |
| Sat 13 Mar | HS / Verian |
| Wed 31 Mar | Yle / Taloustutkimus — last regular round |
| Wed 7 Apr | Election — advance voting opens |
| **Tue 13 Apr** | **Election, final** · and HS / Verian, final poll |
| Sun 18 Apr | Election day |
| Mon 19 Apr | Full scorecard |

13 April carries two predictions and therefore four forecasts. Nine of the 21
days fall on a weekend; 7 December and 31 December are holiday-adjacent.

## Fixed dates in the election

| Date | Event |
|---|---|
| Tue 9 Mar 2027, 16:00 | Candidate lists submitted (40 days out) |
| Thu 18 Mar 2027 | Candidate lists confirmed, numbers drawn (31 days out) |
| Fri 26 – Mon 29 Mar 2027 | Easter, inside the April fieldwork window |
| Wed 7 Apr 2027 | Advance voting opens, in Finland and abroad |
| Sat 10 Apr 2027 | Advance voting abroad closes |
| Tue 13 Apr 2027 | Advance voting in Finland closes |
| Sun 18 Apr 2027 | Election day |

Advance voting matters to the forecast, not just to the calendar. From 7 April
a growing share of the electorate has already voted and cannot be moved by
later news, which is the main reason the two tracks should converge at the end.

## Scoring points

Each Taloustutkimus poll is scored when it publishes, in the first week of the
month; each Verian poll around the 15th to the 17th. Scoring is Phase 0 of the
next cycle, per [METHOD.md](METHOD.md) — no prediction is made before the
outstanding ones are scored.

## Rules for the schedule itself

1. **The slot date is the news cutoff.** Nothing after it enters that forecast,
   even if it happens before the poll is published. Stated in every post.
2. **Log before posting.** The prediction is committed here first, then posted.
3. **Slots do not move.** If a prediction is late, it is logged late and marked
   late, rather than backdated.
4. **Extra polls are ad hoc.** Both pollsters tend to add rounds near the
   election. Predict them, but tag them separately so the 14 scheduled poll
   forecasts stay a clean comparable series.
