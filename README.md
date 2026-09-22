# claude-elects

Open data behind a social media series in which Claude predicts the **Finnish
parliamentary election of 18 April 2027** and each upcoming poll from
Taloustutkimus (Yle) and Verian (Helsingin Sanomat).

Every prediction is written here before the poll it predicts is published, then
scored against the result. Both are fixed in advance: [METHOD.md](METHOD.md) sets
out how a prediction is made, [SCHEDULE.md](SCHEDULE.md) sets out when — every
slot from 30 September 2026 to the final forecast on 13 April 2027.

## Data

All files are long format — one row per party — so they can be charted directly.

| File | Rows | Contents |
|---|---|---|
| [`data/polls.csv`](data/polls.csv) | 800 | 79 published polls since the 2023 election, plus the 2023 result |
| [`data/predictions.csv`](data/predictions.csv) | — | Every prediction, per party, per track |
| [`data/news_log.csv`](data/news_log.csv) | — | Each news adjustment and its reasoning |
| [`data/parties.csv`](data/parties.csv) | 10 | Party codes and names |

### Party codes

`KOK` National Coalition · `PS` Finns Party · `SDP` Social Democrats ·
`KESK` Centre · `VIHR` Greens · `VAS` Left Alliance · `RKP` Swedish People's
Party · `KD` Christian Democrats · `LIIK` Movement Now · `MUUT` Others

### Three tracks

`polls_only` — polls and house effects alone.
`plus_news` — the above, adjusted for news during the poll's fieldwork.
`benchmark` — the previous poll carried forward, as a baseline to beat.

## Sources

Poll figures are transcribed from
[Wikipedia's poll table](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2027_Finnish_parliamentary_election),
which compiles the releases from Yle and Helsingin Sanomat. Fieldwork dates and
sample sizes come with them.

Only Taloustutkimus and Verian are tracked, since those are the two the series
predicts. Other pollsters appearing in the Wikipedia table are not included.

## Caveats

- Poll shares are of respondents who named a party. The share who would not say
  is large in Finland and is not in this data.
- Fieldwork windows for the two pollsters overlap, so their polls are not
  independent snapshots of different weeks.
- Chart colours in `parties.csv` are provisional and not yet checked for
  contrast or colour-blind safety.
