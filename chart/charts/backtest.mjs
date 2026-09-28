// Backtest chart: what the model would have predicted for every poll since the
// 2023 election, drawn against what the pollsters actually published.
//
// Same page skeleton as the trend chart -- HTML type above and below, SVG for
// the plot alone. The line is what the pollsters actually published; the faint
// dots are what the model predicted for each of those polls, before it came
// out. The gap between a dot and the line is the miss, and each poll gets a
// hairline drawing it. The most recent prediction is solid: on a live chart
// that is the one still waiting to be judged.
//
// The line is NOT smoothed, unlike the trend chart's. There the smoothing
// hides a sawtooth caused by two pollsters alternating. Here that sawtooth is
// the thing being predicted -- each prediction targets one named pollster's
// next poll -- so the comparison has to be against the raw reading.
//
// Set `pollster` in the preset to draw one house only. That is the better
// chart: the sawtooth disappears by itself, because it was never movement in
// support, only the gap between two houses. The model still reads both houses
// whichever one is drawn.

import { partyChartColor } from '../lib/theme.mjs';

export function backtestPage({ ledger, config, size, fontCss }) {
  const {
    kicker = 'CLAUDE ELECTS',
    headline,
    subhead,
    focus = [],
    source,
    note,
    lang = 'fi',
    yMax = null,
    labelParties = null,
    splitDate = null,
    splitLabel = '',
    keyActual = '',
    keyPredicted = '',
    keyLatest = '',
    pollster = null,
  } = config;

  const shortNames = {
    KOK: lang === 'fi' ? 'Kokoomus' : 'NCP',
    PS: lang === 'fi' ? 'Perussuomalaiset' : 'Finns Party',
    SDP: 'SDP',
    KESK: lang === 'fi' ? 'Keskusta' : 'Centre',
    VIHR: lang === 'fi' ? 'Vihreät' : 'Greens',
    VAS: lang === 'fi' ? 'Vasemmistoliitto' : 'Left Alliance',
    RKP: 'RKP',
    KD: 'KD',
    LIIK: lang === 'fi' ? 'Liike Nyt' : 'Movement Now',
    MUUT: lang === 'fi' ? 'Muut' : 'Others',
  };

  const payload = {
    points: ledger.points.map((p) => ({
      party: p.party, share: p.share, date: +p.date, type: p.type, pollster: p.pollster,
    })),
    backtest: (ledger.backtest || []).map((b) => ({
      party: b.party, predicted: b.predicted, actual: b.actual, date: +b.date,
      pollster: b.pollster,
    })),
    focus, shortNames, yMax, labelParties,
    splitDate: splitDate ? +new Date(splitDate) : null,
    splitLabel, keyActual, keyPredicted, keyLatest, pollster,
    scale: Math.sqrt(size.w * size.h) / Math.sqrt(1080 * 1350),
    dec: lang === 'fi' ? ',' : '.',
  };

  const S = Math.sqrt(size.w * size.h) / Math.sqrt(1080 * 1350);
  const pad = 64 * S;
  const contentW = size.w - pad * 2;
  const headMax = Math.min(980 * S, contentW * 0.74);
  const subMax = Math.min(860 * S, contentW * 0.68);

  return `<!doctype html>
<html lang="${lang}">
<meta charset="utf-8">
<style>
${fontCss}

:root {
  --ink: #121212; --ink-2: #454545; --ink-3: #6E6E6E; --faint: #9B9B9B;
  --rule: #DADADA; --surface: #FFFFFF;
  --s: ${S};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: var(--surface); }
body {
  width: ${size.w}px; height: ${size.h}px;
  font-family: 'Libre Franklin', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex; flex-direction: column;
  padding: ${pad}px ${pad}px ${48 * S}px;
}

.kicker {
  font-family: 'Roboto Mono', monospace;
  font-size: ${15 * S}px; font-weight: 500;
  letter-spacing: ${1.6 * S}px; text-transform: uppercase;
  color: var(--ink-3);
  display: flex; align-items: center; gap: ${10 * S}px;
  margin-bottom: ${20 * S}px;
}
.kicker::before {
  content: ''; width: ${26 * S}px; height: ${3 * S}px;
  background: var(--ink); display: block;
}

h1 {
  font-size: ${54 * S}px; font-weight: 800;
  line-height: 1.08; letter-spacing: ${-1.1 * S}px;
  color: var(--ink);
  max-width: ${headMax}px;
  margin-bottom: ${16 * S}px;
}

.subhead {
  font-size: ${23 * S}px; font-weight: 400;
  line-height: 1.42; color: var(--ink-2);
  max-width: ${subMax}px;
  margin-bottom: ${8 * S}px;
}
.subhead b { font-weight: 600; }

.chart { flex: 1; min-height: ${260 * S}px; margin-top: ${14 * S}px; }
.chart svg { display: block; overflow: visible; }

footer {
  border-top: ${1 * S}px solid var(--rule);
  padding-top: ${16 * S}px; margin-top: ${20 * S}px;
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: ${28 * S}px;
}
.src {
  font-size: ${15 * S}px; line-height: 1.5; color: var(--ink-3);
  max-width: ${720 * S}px;
}
.src strong { color: var(--ink-2); font-weight: 600; }
.mark {
  font-family: 'Roboto Mono', monospace;
  font-size: ${13 * S}px; font-weight: 500; letter-spacing: ${0.8 * S}px;
  color: var(--faint); text-transform: uppercase; white-space: nowrap;
  text-align: right; padding-top: ${2 * S}px;
}
</style>

<div class="kicker">${kicker}</div>
<h1>${headline}</h1>
<div class="subhead">${subhead}</div>
<div class="chart" id="chart"></div>
<footer>
  <div class="src">${source}${note ? `<br>${note}` : ''}</div>
  <div class="mark">claude&nbsp;elects</div>
</footer>

<script src="D3_SRC"></script>
<script src="PLOT_SRC"></script>
<script>
const DATA = ${JSON.stringify(payload)};
const CHART_COLOR = ${JSON.stringify(partyChartColor)};
const MUTED_LINE = '#C6C6C6', MUTED_LABEL = '#8A8A8A';
const INK = '#121212', INK2 = '#454545', INK3 = '#6E6E6E', GRID = '#EAEAEA', RULE = '#DADADA';

const S = DATA.scale;
const box = document.getElementById('chart');
const W = box.clientWidth, H = box.clientHeight;

// One house, or both. Drawing a single house is what makes the line readable:
// the fortnightly zigzag on a combined chart is the gap between two pollsters,
// not support moving. The 2023 election result stays in either way -- it is
// where both series start, and it anchors the left edge of the plot.
const house = DATA.pollster;
const pts = DATA.points
  .filter(d => !house || d.pollster === house || d.type === 'election_result')
  .map(d => ({...d, date: new Date(d.date)}));
const back = DATA.backtest
  .filter(d => !house || d.pollster === house)
  .map(d => ({...d, date: new Date(d.date)}));
const focus = new Set(DATA.focus);
const labelSet = DATA.labelParties ? new Set(DATA.labelParties) : null;

const M = { top: 34 * S, right: 208 * S, bottom: 44 * S, left: 46 * S };
const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
if (ih < 200 * S || iw < 300 * S) {
  console.error('chart area too small: ' + Math.round(iw) + 'x' + Math.round(ih));
}

const allDates = pts.map(d => d.date);
const x = d3.scaleUtc()
  .domain([d3.min(allDates), d3.max(allDates)])
  .range([M.left, M.left + iw]);

const maxShare = DATA.yMax ?? Math.ceil(d3.max(pts, d => d.share) + 1.5);
const y = d3.scaleLinear().domain([0, maxShare]).range([M.top + ih, M.top]);

const svg = d3.select('#chart').append('svg')
  .attr('width', W).attr('height', H)
  .attr('font-family', "'Libre Franklin', Arial, sans-serif");

// ---- grid + y axis -------------------------------------------------------
const ticks = y.ticks(5);
const g = svg.append('g');
g.selectAll('line.grid').data(ticks).join('line')
  .attr('class', 'grid')
  .attr('x1', M.left).attr('x2', M.left + iw)
  .attr('y1', d => y(d)).attr('y2', d => y(d))
  .attr('stroke', d => d === 0 ? RULE : GRID)
  .attr('stroke-width', 1 * S);

g.selectAll('text.ytick').data(ticks).join('text')
  .attr('class', 'ytick')
  .attr('x', M.left - 12 * S).attr('y', d => y(d))
  .attr('dominant-baseline', 'middle')
  .attr('text-anchor', 'end')
  .attr('fill', INK3)
  .attr('font-size', 15 * S)
  .style('font-variant-numeric', 'tabular-nums')
  .text((d, i) => i === ticks.length - 1 ? d + ' %' : d);

// ---- x axis --------------------------------------------------------------
const yearTicks = d3.utcYear
  .range(d3.utcYear.floor(x.domain()[0]), x.domain()[1])
  .filter(d => d >= x.domain()[0] && d <= x.domain()[1]);
svg.append('g').selectAll('text.xtick').data(yearTicks).join('text')
  .attr('class', 'xtick')
  .attr('x', d => x(d)).attr('y', M.top + ih + 26 * S)
  .attr('fill', INK3).attr('font-size', 15 * S)
  .attr('text-anchor', 'middle')
  .style('font-variant-numeric', 'tabular-nums')
  .text(d => d.getUTCFullYear());

// ---- the moment the settings were locked ---------------------------------
// Everything to the right of this rule was predicted with parameters chosen
// without seeing any of it. Saying so on the chart is the difference between
// a demonstration and a claim.
if (DATA.splitDate) {
  const sx = x(new Date(DATA.splitDate));
  svg.append('line')
    .attr('x1', sx).attr('x2', sx)
    .attr('y1', M.top - 10 * S).attr('y2', M.top + ih)
    .attr('stroke', '#B8B8B8').attr('stroke-width', 1 * S)
    .attr('stroke-dasharray', (4 * S) + ' ' + (4 * S));
  svg.append('text')
    .attr('x', sx + 8 * S).attr('y', M.top - 14 * S)
    .attr('fill', INK3).attr('font-size', 14 * S).attr('font-weight', 600)
    .text(DATA.splitLabel);
}

// ---- series --------------------------------------------------------------
const actualByParty = d3.group(pts, d => d.party);
const backByParty = d3.group(back, d => d.party);
const line = d3.line().x(d => x(d.date)).y(d => y(d.v)).curve(d3.curveMonotoneX);

const order = [...actualByParty.keys()]
  .sort((a, b) => (focus.has(a) ? 1 : 0) - (focus.has(b) ? 1 : 0));

const missOf = (party) => {
  const list = backByParty.get(party) || [];
  if (!list.length) return null;
  return d3.mean(list, d => Math.abs(d.predicted - d.actual));
};

for (const party of order) {
  const isFocus = focus.size === 0 || focus.has(party);
  const color = isFocus ? CHART_COLOR[party] : MUTED_LINE;
  const actual = (actualByParty.get(party) || []).slice().sort((a, b) => a.date - b.date);
  const series = (backByParty.get(party) || []).slice().sort((a, b) => a.date - b.date);

  // What was actually published. Raw readings, joined: see the note at the
  // top of this file for why this one is not smoothed.
  svg.append('path')
    .datum(actual.map(d => ({ date: d.date, v: d.share })))
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', (isFocus ? 2.6 : 1.4) * S)
    .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
    .attr('d', line);

  if (!series.length || !isFocus) continue;

  // The miss: a hairline from the prediction to the poll it was aiming at.
  // On this scale most of them are a pixel or two, which is the point.
  svg.append('g').selectAll('line').data(series).join('line')
    .attr('x1', d => x(d.date)).attr('x2', d => x(d.date))
    .attr('y1', d => y(d.predicted)).attr('y2', d => y(d.actual))
    .attr('stroke', color).attr('stroke-width', 1 * S)
    .attr('opacity', 0.42);

  // The predictions themselves, held back so the published line reads first.
  svg.append('g').selectAll('circle').data(series.slice(0, -1)).join('circle')
    .attr('cx', d => x(d.date)).attr('cy', d => y(d.predicted))
    .attr('r', 3.2 * S)
    .attr('fill', color)
    .attr('opacity', 0.32);

  // The latest prediction, solid. On a live chart this is the one that has not
  // been marked yet, and it should be the first thing the eye lands on.
  const latest = series[series.length - 1];
  svg.append('circle')
    .attr('cx', x(latest.date)).attr('cy', y(latest.predicted))
    .attr('r', 5.5 * S)
    .attr('fill', color)
    .attr('stroke', '#fff').attr('stroke-width', 2.5 * S);
}

// ---- key -----------------------------------------------------------------
// Two marks mean two different things here, and neither is a party. Colour is
// carrying party identity already, so the key has to explain shape instead.
const key = svg.append('g').attr('transform', 'translate(' + M.left + ',' + (M.top - 14 * S) + ')');
const KEY_Y = -4 * S;
const keyItems = [
  { kind: 'line', text: DATA.keyActual },
  { kind: 'ghost', text: DATA.keyPredicted },
  { kind: 'solid', text: DATA.keyLatest },
].filter((it) => it.text);

// Measured, not estimated. Guessing text width from character count works
// until a translation lands and the third item sits on top of the second.
let kx = 0;
for (const item of keyItems) {
  if (item.kind === 'line') {
    key.append('line')
      .attr('x1', kx).attr('x2', kx + 22 * S).attr('y1', KEY_Y).attr('y2', KEY_Y)
      .attr('stroke', INK2).attr('stroke-width', 2.6 * S).attr('stroke-linecap', 'round');
    kx += 30 * S;
  } else if (item.kind === 'ghost') {
    key.append('circle')
      .attr('cx', kx + 4 * S).attr('cy', KEY_Y).attr('r', 3.2 * S)
      .attr('fill', INK2).attr('opacity', 0.32);
    kx += 15 * S;
  } else {
    key.append('circle')
      .attr('cx', kx + 5 * S).attr('cy', KEY_Y).attr('r', 5.5 * S)
      .attr('fill', INK2).attr('stroke', '#fff').attr('stroke-width', 2.5 * S);
    kx += 18 * S;
  }
  const t = key.append('text')
    .attr('x', kx).attr('y', KEY_Y).attr('dominant-baseline', 'middle')
    .attr('fill', INK2).attr('font-size', 14 * S).attr('font-weight', 600)
    .text(item.text);
  kx += t.node().getComputedTextLength() + 26 * S;
}

// ---- direct labels -------------------------------------------------------
// The number in the label is the party's average miss, not its support: on
// this chart that is the quantity the reader came for.
const MIN_LEGIBLE_GAP = 19 * S;
let keep = order.filter(p => (!labelSet || labelSet.has(p)) && backByParty.has(p));
const capacity = Math.floor(ih / MIN_LEGIBLE_GAP);
if (keep.length > capacity) {
  const latest = p => (actualByParty.get(p) || []).slice().sort((a, b) => a.date - b.date).at(-1).share;
  const focused = keep.filter(p => focus.has(p));
  const rest = keep.filter(p => !focus.has(p)).sort((a, b) => latest(b) - latest(a));
  keep = [...focused, ...rest.slice(0, Math.max(0, capacity - focused.length))];
}
const keepSet = new Set(keep);

const labels = order
  .filter(p => keepSet.has(p))
  .map(party => {
    const actual = (actualByParty.get(party) || []).slice().sort((a, b) => a.date - b.date);
    const last = actual[actual.length - 1];
    return {
      party,
      isFocus: focus.size === 0 || focus.has(party),
      miss: missOf(party),
      yIdeal: y(last.share),
      y: y(last.share),
    };
  })
  .sort((a, b) => a.yIdeal - b.yIdeal);

const gapBetween = (a, b) => ((a.isFocus || b.isFocus) ? 26 : 20) * S;
for (let i = 1; i < labels.length; i++) {
  const gp = gapBetween(labels[i - 1], labels[i]);
  if (labels[i].y - labels[i - 1].y < gp) labels[i].y = labels[i - 1].y + gp;
}
for (let i = labels.length - 2; i >= 0; i--) {
  const gp = gapBetween(labels[i], labels[i + 1]);
  if (labels[i + 1].y - labels[i].y < gp) labels[i].y = labels[i + 1].y - gp;
}
const topBound = M.top + 6 * S, botBound = M.top + ih;
const overTop = Math.max(0, topBound - labels[0].y);
const overBot = Math.max(0, labels[labels.length - 1].y - botBound);
const shift = overTop - overBot;
if (shift !== 0) labels.forEach(l => { l.y += shift; });

const lx = M.left + iw + 14 * S;
for (const l of labels) {
  const color = l.isFocus ? CHART_COLOR[l.party] : MUTED_LABEL;

  if (Math.abs(l.y - l.yIdeal) > 2 * S) {
    svg.append('path')
      .attr('fill', 'none').attr('stroke', l.isFocus ? color : '#D6D6D6')
      .attr('stroke-width', 1 * S)
      .attr('d', 'M' + (M.left + iw + 4 * S) + ',' + l.yIdeal + ' L' + (lx - 5 * S) + ',' + l.y);
  }

  const t = svg.append('text')
    .attr('x', lx).attr('y', l.y)
    .attr('dominant-baseline', 'middle')
    .attr('font-size', (l.isFocus ? 17 : 15) * S)
    .attr('font-weight', l.isFocus ? 700 : 500);

  t.append('tspan')
    .attr('fill', color)
    .style('font-variant-numeric', 'tabular-nums')
    .text('±' + l.miss.toFixed(1).replace('.', DATA.dec) + ' ');
  t.append('tspan')
    .attr('fill', l.isFocus ? INK2 : MUTED_LABEL)
    .attr('font-weight', l.isFocus ? 600 : 400)
    .text(DATA.shortNames[l.party] || l.party);
}
document.body.dataset.ready = '1';
</script>
</html>`;
}
