# Method

This file explains how every prediction in this project is made. It is written
down and kept fixed so that, months from now, nobody has to wonder whether the
predictions got better because Claude improved or because the rules quietly
changed.

When predictions are made is in [SCHEDULE.md](SCHEDULE.md).

## What is being predicted

The Finnish parliamentary election on **18 April 2027**, and every poll from the
two pollsters that publish monthly:

| Pollster | Published by | Code |
|---|---|---|
| Taloustutkimus | Yle | `TT` |
| Verian (called Kantar Public until 2023) | Helsingin Sanomat | `VER` |

The two take turns, so a new poll comes out roughly every two weeks.

## Two predictions, made two different ways

Every prediction comes in two versions, and they are made in completely
different ways on purpose.

**Polls only** is made by a computer program. It reads the published polls and
nothing else, and does the same arithmetic every time. Anyone can download this
project, run the program and get exactly the same numbers. Claude wrote the
program, but does not change its answers.

**Plus news** starts from the program's numbers and adds Claude's judgement of
what the news has done that the polls haven't picked up yet. Claude checks the
news every day and writes down a new plus-news figure every day.

Both are compared against a third figure, **the lazy guess**: assume the next
poll will be exactly the same as that pollster's last one. That is harder to
beat than it sounds, because most of the movement between polls is chance.

So the series asks two questions. Does the arithmetic beat the lazy guess? And
does reading the news beat the arithmetic?

Claude never overrides the program in the polls-only version. If the program
gets something badly wrong, that gets reported. It does not get fixed by hand.

## Polls only: the program

The program is `model/aggregate.py`.

### What it does

1. **It takes the recent polls.** Every published poll from the last 75 days,
   from both pollsters. When predicting a Verian poll, the latest Taloustutkimus
   poll is used too: it is public information about the same weeks.

2. **Newer polls count for more.** A poll's weight halves for every 45 days of
   age. Polls with bigger samples also count a little more.

3. **It corrects for each pollster's lean.** Taloustutkimus and Verian measure
   the same parties slightly differently, and consistently so. At the moment,
   for example, Taloustutkimus has the Finns Party about 0.9 points higher than
   Verian does. Before averaging, the program moves both pollsters onto common
   ground, so that this gap is not mistaken for real movement.

4. **It barely extends trends.** If a party has been rising, the program assumes
   only a quarter of that rise continues. Testing showed that extending trends
   further made the predictions worse: most apparent trends are chance.

5. **It puts the pollster's lean back.** When predicting a Verian poll, the
   answer is moved back onto Verian's scale. The aim is to predict what Verian
   will publish, not some neutral truth. For the election there is no pollster,
   so the lean is left out.

6. **It rounds.** To one decimal, adding up to exactly 100.

### How the settings were chosen

The numbers above (75 days, 45 days, a quarter of the trend) were not picked by
feel. The program was run backwards over every poll since the 2023 election:
for each one, it predicted it using only the polls published before it, and the
result was compared with what was actually published. That is 71 polls.

The settings were chosen using the polls up to the end of 2025. They were then
checked on the 2026 polls, which played no part in choosing them. The settings
are now locked for the rest of the season. They are stored in
`model/params.json`, and the full test results are in `model/backtest_results.md`.

### What the test found

- **The program beats the lazy guess, but only just.** On the 2026 polls, its
  typical miss was 0.34 points per party, against 0.37 for the lazy guess. That
  is a real difference, but a small one, and it should always be described as
  small. It gets the direction of change right 58% of the time, against 52%.
- **Correcting for each pollster's lean does almost all the work.** Without it,
  the program is no better than the lazy guess.
- **Verian is much easier to predict than Taloustutkimus.** Across all 71 polls,
  the typical miss was 0.29 points for Verian and 0.54 for Taloustutkimus.
- **The poll predictions are tested. The election prediction is not.** The poll
  file only goes back to the 2023 election, so there is no earlier campaign to
  test an election forecast against. Until older polls are added, the election
  forecast must be described as untested.

### Changing the program

The program is not edited during the season. If something has to change, a new
version is added alongside the old one, the reason is written down, and both run
until the election, so the original series is never broken. Every prediction
records which version made it.

## Plus news: the daily run

### What happens every day

Every morning, a scheduled job:

1. Checks whether a new poll has been published, and if so adds it to the poll
   file and reruns the program.
2. Reads the Finnish political news since the last run.
3. Decides whether anything happened that will move party support. If so, it
   writes it into the news log (`data/news_log.csv`) as a numbered item.
4. Works out the day's plus-news figure for every party, for two targets: the
   next poll due, and the election.
5. Writes those figures to `data/daily.csv` and stops.

Nothing is posted automatically. The numbers are written every day, and what gets
published, and when, is decided by a person.

On a scheduled prediction date (see [SCHEDULE.md](SCHEDULE.md)), that day's
plus-news figure is the one entered in `data/predictions.csv` as the official
prediction.

If a day is missed, the next run covers it and records the gap. If the news
could not be checked (for example, a search failed), that is recorded too. A
missing check is never silently treated as a quiet day.

### What goes in the log

Each item records: when it happened, when it was logged, what kind of event it
was, how many points it moves each party, a link to the source, and the
reasoning.

**Most days, nothing is logged.** Most days in politics do not move how people
vote. If the log gets an entry nearly every day, something is wrong.

**Every item names who gains as well as who loses.** Support moves between
parties; it does not appear from nowhere. An item's numbers always add up to
zero. If there is no obvious winner, the loss is spread across the other parties
in proportion to their size, and the item says so.

**Items are sized using fixed bands**, so that similar events get similar
numbers from one day to the next:

| Kind of event | Typical size |
|---|---|
| Ordinary political noise, a bad interview, a rough week | 0.1–0.2 points |
| A minister resigns, a real policy U-turn | 0.3–0.5 points |
| A party leader falls | 0.6–1.0 points |
| Anything bigger | Only with a written argument for why |

**The log is read as a whole, not added up blindly.** When Claude logs something
new, it sizes it in light of everything already in the log: a second bad week
for a party that has already had one is not simply stacked on top. If an earlier
item now looks bigger or smaller than first thought, Claude writes a new row
correcting it. Old rows are never changed or deleted.

**What counts as news:** government crises, party leader changes, scandals, big
budget decisions, strikes, security events. Social media mood does not count.
It measures who is loud, not who votes.

### The number stays put unless something changes

Every day's run starts fresh, with no memory of yesterday except what is written
in the files. If Claude re-judged the same unchanged news from scratch each
morning, the number would wander about for no reason.

So: **if nothing was logged, today's figure follows from yesterday's by
arithmetic alone** (the fading and catching-up rules below). Claude's judgement
only comes in when something new has happened. Any movement in the daily line
can always be traced to a cause.

### News fades

A scandal that costs a party half a point in October is not still costing it
half a point in April. Every item fades, at a speed set by the kind of event:

| Kind of event | Its effect halves every |
|---|---|
| Ordinary scandal, a bad week | 45 days |
| Budget decision, policy U-turn | 90 days |
| Party leader changes | 120 days |
| Government falls | 180 days |

Claude can argue in writing that a particular item should fade differently. A
leader change that has clearly reshaped a party, for instance, might not fade at
all.

### When the polls catch up

This is the rule that stops the same news being counted twice.

Once an event has happened, pollsters start measuring its effect, and the
program picks that up by itself. If the news log kept adding the event on top,
it would be counted twice. So each item switches off as the polls catch up with
it.

The polls catch up gradually, not all at once. A poll counts as having seen the
event if its interviews were done after it. A poll that was partly in the field
before the event and partly after has seen the part after. The program averages
several polls, so the item only fully switches off once every poll the program
is using has seen it.

An example. A scandal really does cost Kokoomus one point, from 18 to 17. For
simplicity, it does not fade. The program is averaging the last three polls,
with roughly 40%, 35% and 25% weight from newest to oldest.

| Moment | Last three polls | Program says | News adds | Plus news |
|---|---|---|---|---|
| Scandal breaks | 18, 18, 18 | 18.0 | −1.0 | **17.0** |
| First poll after it | **17**, 18, 18 | 17.6 | −0.6 | **17.0** |
| Second poll after it | **17, 17**, 18 | 17.3 | −0.3 | **17.0** |
| Third poll after it | **17, 17, 17** | 17.0 | 0 | **17.0** |

The plus-news figure stays at 17 throughout. What changes is how much of it comes
from the program and how much from the news log. When the log's part reaches
zero, the item no longer affects poll predictions.

This is arithmetic, not judgement: the program already knows how much weight
each poll carries.

### One rule for both targets

For every item in the log, the plus-news adjustment is:

> **how much of the event will be in the thing being predicted**,
> **minus how much of it is already in the polls the program is reading.**

**For the next poll**, "how much will be in it" depends on timing. A poll's
interviews run over three to four weeks. If an event happens with eight of
twenty-eight fieldwork days left, only the people interviewed in those eight
days had heard of it: about 29% of the sample. So the event counts at 29% for
that poll.

**For the election**, "how much will be in it" is how much of the effect is
still left on 18 April, after fading. This is why the whole log, from the first
day, matters for the election forecast, including items the polls have long
since absorbed:

- **An event the polls have not seen yet** is added, at the size it will have
  faded to by election day.
- **An event the polls have already absorbed** is still in today's polls at
  today's strength, but by April it will have faded further. The program assumes
  today's level lasts, so the difference is added back: the election forecast
  expects that effect to wear off.

So for the election, a party that took a hit from a scandal this autumn will
usually be forecast to recover some of it by April. How much depends on how
quickly that kind of event fades.

## Getting the poll numbers

The program is only as good as the poll file, `data/polls.csv`.

- Poll numbers come from the pollster's own publication, Yle for Taloustutkimus
  and HS for Verian, checked against Wikipedia's table of 2027 election polls.
- A poll that cannot be confirmed from a second source is not entered.
- Fieldwork dates are recorded as published. If a pollster has not published
  them, they are estimated from its usual pattern and marked as estimated.
- If a new poll cannot be found before a prediction date, the prediction goes
  ahead on the polls that are available, and says so. Prediction dates are
  never moved.

Claude's own background knowledge of Finnish politics is not used. It stops at
a fixed date and nobody can check it. Everything the program sees comes from the
poll file, and everything the news track uses is in the news log, with sources.

## The election forecast

A new election forecast is made on the 7th of every month, so its movement over
time can be charted. One last forecast is made on **13 April 2027**, the day
advance voting closes. That is the one the account is judged on. The daily run
also writes an election figure every day, so the monthly forecasts are that
day's figure, not a separate calculation.

The election forecast uses all credible published polls, not only the two
monthly pollsters.

Seats are not predicted. Turning national support into seats needs assumptions
about each electoral district that national polls cannot support. If a seat
projection is ever published, it will be a separate, clearly labelled exercise
and will not be scored as part of this series.

## Scoring

When a poll is published, every prediction for it is scored on three things:

1. **The typical miss.** The average distance between predicted and actual
   support, per party, in percentage points. This is the main number.
2. **Direction.** Did each party go up, down or stay the same compared with that
   pollster's previous poll? A move of less than 0.3 points counts as staying
   the same, so a party that barely moved cannot give a free hit.
3. **Order.** Did the parties finish in the predicted order?

All three predictions, polls only, plus news and the lazy guess, are scored the
same way, by a program (`model/score.py`). Claude does not mark its own work.

The daily plus-news line also allows a question the fixed predictions cannot
answer: when news moved a party, did the daily figure move in the right
direction before the polls confirmed it?

Results are given to one decimal place, as the pollsters and the official
results are. Party figures add up to 100, with "others" (`MUUT`) as its own line.

## Rules for the records

- **Nothing is ever edited or deleted.** Corrections go in as new rows with a
  later date.
- **Predictions are written down before the poll is published**, and the time
  they were saved shows it. Save times can be faked, so a social media post made
  before publication is the stronger proof.
- **Every prediction records which version of the method made it.**
- **Test results are kept separate from real predictions.** The backwards test
  made its predictions after the fact, so they live in
  `model/backtest_predictions.csv`, never in `data/predictions.csv`.

## Files

| File | What it holds | Status |
|---|---|---|
| `data/polls.csv` | Every published poll, one row per party, starting from the 2023 election result. | In use |
| `data/predictions.csv` | Every official prediction, made on the scheduled dates. | In use |
| `data/news_log.csv` | Every news item: what happened, its size per party, its fading speed, source and reasoning. | Columns to be updated for the daily run |
| `data/daily.csv` | The daily figures: polls only, the news adjustment, and plus news, for every party, for the next poll and the election. | To be built |
| `data/parties.csv` | Party codes, names and colours. | In use |
| `model/aggregate.py` | The polls-only program. | In use |
| `model/params.json` | Its locked settings. | In use |
| `model/backtest.py` | The backwards test that chose the settings. | In use |
| `model/backtest_results.md` | What the test found. | In use |
| `model/backtest_predictions.csv` | The test's after-the-fact predictions, for charts. | In use |
| `model/news.py` | The arithmetic for fading and catching up. | To be built |
| `model/score.py` | Scoring. | To be built |
| `chart/` | Makes the published graphics from the same files. | In use |
