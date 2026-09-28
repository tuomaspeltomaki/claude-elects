// Poll trend chart: every party's share over time, with a small number of
// parties carried at full colour and the rest muted back.
//
// The layout is deliberately split: the chart is SVG, but the headline,
// subhead and source line are ordinary HTML above and below it. That is what
// lets the type behave like type -- real wrapping, mixed weights, a party name
// coloured inline mid-sentence -- instead of being cramped SVG <text>.

import { partyChartColor } from '../lib/theme.mjs';

export function trendPage({ ledger, config, size, fontCss }) {
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
  } = config;

  const partyNames = Object.fromEntries(
    [...ledger.partyMeta].map(([code, p]) => [code, lang === 'fi' ? p.name_fi : p.name_en]),
  );
  // Short forms for end-of-line labels; the full name is too long to sit there.
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
      party: p.party, share: p.share, date: +p.date, pollster: p.pollster, type: p.type,
    })),
    predictions: ledger.predictions.map((p) => ({
      party: p.party, share: p.share, date: +p.date, track: p.track,
    })),
    focus, partyNames, shortNames, yMax, labelParties,
    scale: Math.sqrt(size.w * size.h) / Math.sqrt(1080 * 1350),
    dec: lang === 'fi' ? ',' : '.',
    electionLabel: lang === 'fi' ? 'Vaalit 2023' : '2023 election',
  };

  // Type scales on the canvas AREA, not its width. Keying off width alone
  // means a 1600x900 landscape frame gets 1.48x type in 0.67x the height, and
  // the headline swallows the chart.
  const S = Math.sqrt(size.w * size.h) / Math.sqrt(1080 * 1350);
  const pad = 64 * S;
  const contentW = size.w - pad * 2;
  // Wider canvas, wider measure -- but never the full width, which would give
  // an unreadably long line.
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
h1 em { font-style: normal; }

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

const pts = DATA.points.map(d => ({...d, date: new Date(d.date)}));
const preds = DATA.predictions.map(d => ({...d, date: new Date(d.date)}));
const focus = new Set(DATA.focus);
const labelSet = DATA.labelParties ? new Set(DATA.labelParties) : null;

const M = { top: 18 * S, right: 208 * S, bottom: 44 * S, left: 46 * S };
const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
if (ih < 200 * S || iw < 300 * S) {
  console.error('chart area too small: ' + Math.round(iw) + 'x' + Math.round(ih)
    + ' — shorten the headline or use a taller size');
}

const allDates = pts.map(d => d.date);
const x = d3.scaleUtc()
  .domain([d3.min(allDates), d3.max(allDates)])
  .range([M.left, M.left + iw]);

// Round up just past the highest poll rather than to the next multiple of
// five -- with a maximum of 25.4, a ceiling of 30 throws away a sixth of the
// plot height on empty space.
const maxShare = DATA.yMax ?? Math.ceil(d3.max(pts, d => d.share) + 1.5);
const y = d3.scaleLinear().domain([0, maxShare]).range([M.top + ih, M.top]);

const svg = d3.select('#chart').append('svg')
  .attr('width', W).attr('height', H)
  .attr('font-family', "'Libre Franklin', Arial, sans-serif");

// ---- grid + y axis -------------------------------------------------------
// Horizontal hairlines only, one shade off the surface. The unit sits on the
// top tick alone; repeating "%" down the axis is noise.
const ticks = y.ticks(5);
const g = svg.append('g');
g.selectAll('line.grid').data(ticks).join('line')
  .attr('class', 'grid')
  .attr('x1', M.left).attr('x2', M.left + iw)
  .attr('y1', d => y(d)).attr('y2', d => y(d))
  .attr('stroke', d => d === 0 ? RULE : GRID)
  .attr('stroke-width', 1 * S);

// Outside the plot and right-aligned. Sitting them on top of the gridline
// inside the plot area reads well on a sparse chart and turns to mush on a
// dense one -- eleven lines cross the left edge here.
g.selectAll('text.ytick').data(ticks).join('text')
  .attr('class', 'ytick')
  .attr('x', M.left - 12 * S).attr('y', d => y(d))
  .attr('dominant-baseline', 'middle')
  .attr('text-anchor', 'end')
  .attr('fill', INK3)
  .attr('font-size', 15 * S)
  .attr('font-weight', 400)
  .style('font-variant-numeric', 'tabular-nums')
  .text((d, i) => i === ticks.length - 1 ? d + ' %' : d);

// ---- x axis --------------------------------------------------------------
// Only whole years that actually fall inside the data window. A tick for
// January 2023 would sit off the left edge and get clipped by the page.
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

// ---- election marker -----------------------------------------------------
// The 2023 result is the leftmost point in the series, so a vertical rule
// there just doubles the y-axis. Label it on the time axis instead, where it
// reads as "the series starts at the election".
const electionPt = pts.find(d => d.type === 'election_result');
if (electionPt) {
  svg.append('text')
    .attr('x', x(electionPt.date)).attr('y', M.top + ih + 26 * S)
    .attr('fill', INK2).attr('font-size', 15 * S).attr('font-weight', 600)
    .attr('text-anchor', 'start')
    .text(DATA.electionLabel);
}

// ---- lines ---------------------------------------------------------------
const byParty = d3.group(pts, d => d.party);
const line = d3.line().x(d => x(d.date)).y(d => y(d.share)).curve(d3.curveMonotoneX);

// Two pollsters alternate, and each has a house effect. Joining their readings
// into one line turns that systematic gap into a sawtooth that looks like
// support lurching back and forth every fortnight. It isn't. So: every poll is
// drawn as its own dot, and the line through them is a weighted moving average
// over a five-poll window. The dots keep the chart honest about spread; the
// line carries the trend.
const SMOOTH_WINDOW = 5;
function smooth(series) {
  const half = Math.floor(SMOOTH_WINDOW / 2);
  return series.map((d, i) => {
    let num = 0, den = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(series.length - 1, i + half); j++) {
      // Triangular weights: the poll at the centre counts most.
      const w = half + 1 - Math.abs(i - j);
      num += series[j].share * w;
      den += w;
    }
    return { date: d.date, share: num / den };
  });
}

// Muted parties first, so focus lines sit on top of them.
const order = [...byParty.keys()].sort((a, b) => (focus.has(a) ? 1 : 0) - (focus.has(b) ? 1 : 0));

for (const party of order) {
  const series = byParty.get(party).sort((a, b) => a.date - b.date);
  const isFocus = focus.size === 0 || focus.has(party);
  const color = isFocus ? CHART_COLOR[party] : MUTED_LINE;

  // Individual polls, focus parties only. Eleven parties' worth of dots would
  // be a cloud; three parties' worth reads as spread around the trend.
  if (isFocus) {
    svg.append('g').selectAll('circle').data(series).join('circle')
      .attr('cx', d => x(d.date)).attr('cy', d => y(d.share))
      .attr('r', 2.6 * S)
      .attr('fill', color)
      .attr('opacity', 0.26);
  }

  svg.append('path')
    .datum(smooth(series))
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', (isFocus ? 3 : 1.5) * S)
    .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
    .attr('d', line);

  // The most recent poll gets a solid marker: it is the number in the label.
  if (isFocus) {
    const last = series[series.length - 1];
    svg.append('circle')
      .attr('cx', x(last.date)).attr('cy', y(last.share))
      .attr('r', 5.5 * S)
      .attr('fill', color)
      .attr('stroke', '#fff').attr('stroke-width', 2.5 * S);
  }
}

// ---- prediction overlay --------------------------------------------------
// Dashed continuation from the last poll to the predicted value. Draws
// nothing while predictions.csv is still just a header row.
if (preds.length) {
  const byPredParty = d3.group(preds.filter(p => p.track === 'polls_only'), d => d.party);
  for (const [party, list] of byPredParty) {
    const isFocus = focus.size === 0 || focus.has(party);
    if (!isFocus) continue;
    const series = byParty.get(party).sort((a, b) => a.date - b.date);
    const last = series[series.length - 1];
    const target = list.sort((a, b) => a.date - b.date)[list.length - 1];
    svg.append('path')
      .attr('fill', 'none')
      .attr('stroke', CHART_COLOR[party])
      .attr('stroke-width', 2.2 * S)
      .attr('stroke-dasharray', (5 * S) + ' ' + (5 * S))
      .attr('d', line([last, { date: target.date, share: target.share }]));
    svg.append('circle')
      .attr('cx', x(target.date)).attr('cy', y(target.share))
      .attr('r', 5 * S)
      .attr('fill', '#fff')
      .attr('stroke', CHART_COLOR[party]).attr('stroke-width', 2.4 * S);
  }
}

// ---- direct labels -------------------------------------------------------
// Identity never rests on colour here: every visible line gets its name at the
// right-hand end. Labels are pushed apart vertically so nothing overlaps --
// this pass is the difference between a chart that looks generated and one
// that looks edited.
// A short canvas cannot carry eleven labels. Work out how many will fit at a
// legible spacing and, if there are too many, keep the focus parties and the
// largest of the rest -- rather than squeezing every label until the stack
// overflows the plot and the leader lines turn into spaghetti.
const MIN_LEGIBLE_GAP = 19 * S;
let keep = order.filter(p => !labelSet || labelSet.has(p));
const capacity = Math.floor(ih / MIN_LEGIBLE_GAP);
if (keep.length > capacity) {
  const latest = p => byParty.get(p).slice().sort((a, b) => a.date - b.date).at(-1).share;
  const focused = keep.filter(p => focus.has(p));
  const rest = keep.filter(p => !focus.has(p)).sort((a, b) => latest(b) - latest(a));
  keep = [...focused, ...rest.slice(0, Math.max(0, capacity - focused.length))];
}
const keepSet = new Set(keep);

const labels = order
  .filter(p => keepSet.has(p))
  .map(party => {
    const series = byParty.get(party).sort((a, b) => a.date - b.date);
    const last = series[series.length - 1];
    return {
      party,
      isFocus: focus.size === 0 || focus.has(party),
      value: last.share,
      yIdeal: y(last.share),
      y: y(last.share),
    };
  })
  .sort((a, b) => a.yIdeal - b.yIdeal);

// Gaps are per-pair, not uniform: muted labels are set smaller than focus
// labels, so they need less room. Charging every pair the focus-sized gap
// inflates the stack by enough to shove the top label off its own line.
const gapBetween = (a, b) => ((a.isFocus || b.isFocus) ? 26 : 20) * S;

// Push down through the stack, then settle back up, so the block stays
// centred on where the lines actually end rather than drifting downward.
for (let i = 1; i < labels.length; i++) {
  const g = gapBetween(labels[i - 1], labels[i]);
  if (labels[i].y - labels[i - 1].y < g) labels[i].y = labels[i - 1].y + g;
}
for (let i = labels.length - 2; i >= 0; i--) {
  const g = gapBetween(labels[i], labels[i + 1]);
  if (labels[i + 1].y - labels[i].y < g) labels[i].y = labels[i + 1].y - g;
}

// Only shift the block if it actually escapes the plot, and never so far that
// it escapes the other end.
const topBound = M.top + 6 * S, botBound = M.top + ih;
const overTop = Math.max(0, topBound - labels[0].y);
const overBot = Math.max(0, labels[labels.length - 1].y - botBound);
const shift = overTop - overBot;
if (shift !== 0) labels.forEach(l => { l.y += shift; });

const lx = M.left + iw + 14 * S;
for (const l of labels) {
  const color = l.isFocus ? CHART_COLOR[l.party] : MUTED_LABEL;

  // Leader from the line end to the label, when the label had to move.
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
    .attr('font-weight', l.isFocus ? 700 : 500)
    .attr('fill', l.isFocus ? INK : MUTED_LABEL);

  t.append('tspan')
    .attr('fill', color)
    .style('font-variant-numeric', 'tabular-nums')
    .text(l.value.toFixed(1).replace('.', DATA.dec) + ' ');
  t.append('tspan')
    .attr('fill', l.isFocus ? INK2 : MUTED_LABEL)
    .attr('font-weight', l.isFocus ? 600 : 400)
    .text(DATA.shortNames[l.party] || l.party);
}
document.body.dataset.ready = '1';
</script>
</html>`;
}
