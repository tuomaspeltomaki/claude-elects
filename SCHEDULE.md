# Schedule

When every prediction is made. Fixed in advance, for the same reason the method
is: a slot that moves to suit the news is not a forecast, it is a comment.

Target: the Finnish parliamentary election of **Sunday 18 April 2027**.

## The three standing slots

| Slot | When | Predicts | News cutoff |
|---|---|---|---|
| **Yle / Taloustutkimus** | Tuesday, 2 days before the 1st Thursday of the month | that Thursday's poll | end of the Tuesday |
| **HS / Verian** | Monday, 2 days before the 3rd Wednesday of the month | that Wednesday's poll | end of the Monday |
| **Election** | 7th of each month | the 18 April result | end of the 7th |

Plus one extra election forecast on **13 April 2027**, the day advance voting
closes. That is the final one, and the number the account is judged on. It also
stands in for that month's HS / Verian slot — see below.

Every slot produces both Claude tracks, `polls_only` and `plus_news`, written
together. `benchmark` is computed for the same target, not predicted.

## Why these dates

Yle and HS set these publication dates, not the pollsters — Taloustutkimus and
Verian field their surveys backward from a fixed editorial slot, not the other
way round. The pattern, checked against how these polls have actually run:

- **Taloustutkimus, at Yle, publishes on the first Thursday of the month.**
- **Verian, at HS, publishes on the third Wednesday of the month.**
- Fieldwork for both closes by the weekend before publication.

The Claude slot sits two days before that publication date — Tuesday for
Taloustutkimus, Monday for Verian. Since fieldwork is already closed (or all
but closed) by then, the two-day gap isn't there to beat fieldwork; it's there
to beat the *release*. Nothing about either poll's actual numbers is public
when the slot falls, only that fieldwork has wrapped.

Because the slot is pinned to a weekday two days before another fixed weekday,
it is itself always the same weekday: every Taloustutkimus slot is a Tuesday,
every Verian slot is a Monday. Neither ever falls on a weekend.

### Fieldwork closes at or before the slot, not after

Measured against the 79 polls in `data/polls.csv`, over the most recent twelve
rounds of each pollster:

| Pollster | Fieldwork runs past its slot by | Range | Typical fieldwork length |
|---|---|---|---|
| Taloustutkimus | **median 0 days** | −1 to +7 days | 21–34 days |
| Verian | **median 0 days** | −1 to +7 days | 27–34 days (one outlier excluded, see below) |

Fieldwork wraps at or just before the slot in most rounds — consistent with
"fieldwork closes by the previous weekend." The one exception for each
pollster is April 2026, when both ran seven days over: Taloustutkimus's slot
(31 Mar) preceded a fieldwork close of 7 Apr, and Verian's slot (13 Apr)
preceded a close of 20 Apr — plausibly the Easter/May Day period compressing
that month's survey calendar for both at once.

It is recorded here so it can be corrected for in scoring rather than
discovered later. The actual fieldwork window goes into `data/polls.csv` on
publication, so the real gap is checkable for every single prediction.

Verian's fieldwork length has its own outlier, excluded from the typical range
above: the round fielded 5 December 2025 to 19 January 2026 ran 45 days,
spanning the Christmas and New Year break. Its overrun was still 0 days,
inside the stated range, since the slot itself did not move.

## Every prediction day

21 days, 22 predictions, 44 logged forecasts.

### 2026

| Date | Slot | Predicts |
|---|---|---|
| Tue 29 Sep | Yle / Taloustutkimus | Thu 1 Oct |
| Wed 7 Oct | Election | — |
| Mon 19 Oct | HS / Verian | Wed 21 Oct |
| Tue 3 Nov | Yle / Taloustutkimus | Thu 5 Nov |
| Sat 7 Nov | Election | — |
| Mon 16 Nov | HS / Verian | Wed 18 Nov |
| Tue 1 Dec | Yle / Taloustutkimus | Thu 3 Dec |
| Mon 7 Dec | Election | — |
| Mon 14 Dec | HS / Verian | Wed 16 Dec |

### 2027

| Date | Slot | Predicts |
|---|---|---|
| Tue 5 Jan | Yle / Taloustutkimus | Thu 7 Jan |
| Thu 7 Jan | Election | — |
| Mon 18 Jan | HS / Verian | Wed 20 Jan |
| Tue 2 Feb | Yle / Taloustutkimus | Thu 4 Feb |
| Sun 7 Feb | Election | — |
| Mon 15 Feb | HS / Verian | Wed 17 Feb |
| Tue 2 Mar | Yle / Taloustutkimus | Thu 4 Mar |
| Sun 7 Mar | Election | — |
| Mon 15 Mar | HS / Verian — last regular round | Wed 17 Mar |
| Tue 30 Mar | Yle / Taloustutkimus — last regular round | Thu 1 Apr |
| Wed 7 Apr | Election — advance voting opens | — |
| **Tue 13 Apr** | **Election, final** · and HS / Verian, final poll | — |
| Sun 18 Apr | Election day | — |
| Mon 19 Apr | Full scorecard | — |

13 April carries two predictions and therefore four forecasts. Three of the 21
days fall on a weekend, all of them Election slots (7 Nov, 7 Feb, 7 Mar) —
Taloustutkimus and Verian slots never do, by construction.

Verian's regular monthly cycle would next fall on 19 April, after election day,
so it is dropped: the 13 April final forecast covers it instead, timed to the
day advance voting closes rather than to a Wednesday that never comes.

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

Each Taloustutkimus poll is scored when it publishes, on the first Thursday of
the month; each Verian poll on the third Wednesday, typically the 15th to the
21st. Scoring is Phase 0 of the next cycle, per [METHOD.md](METHOD.md) — no
prediction is made before the outstanding ones are scored.

## Rules for the schedule itself

1. **The slot date is the news cutoff.** Nothing after it enters that forecast,
   even if it happens before the poll is published. Stated in every post.
2. **Log before posting.** The prediction is committed here first, then posted.
3. **Slots do not move.** If a prediction is late, it is logged late and marked
   late, rather than backdated. In practice this only ever affects the Election
   slot, since the poll slots never land on a weekend.
4. **Extra polls are ad hoc.** Both pollsters tend to add rounds near the
   election. Predict them, but tag them separately so the 14 scheduled poll
   forecasts stay a clean comparable series.
