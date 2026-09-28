// Loads the claude_elects ledger CSVs and reshapes them for charting.
// Everything here is pure: no drawing, no DOM.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Character-scanning CSV split. Handles quoted fields, doubled quotes inside
// them, and -- the case that matters here -- empty fields, which the ledger has
// wherever sample_size is unknown (every election-result row).
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cells.push(cur); cur = '';
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    head.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

export function loadLedger(dataDir, modelDir = null) {
  const read = (f) => parseCsv(readFileSync(join(dataDir, f), 'utf8'));

  const parties = read('parties.csv');
  const polls = read('polls.csv');
  let predictions = [];
  try { predictions = read('predictions.csv'); } catch { /* not created yet */ }

  const partyMeta = new Map(parties.map((p) => [p.code, p]));

  // One record per poll, with a share per party.
  const pollMap = new Map();
  for (const r of polls) {
    if (!pollMap.has(r.poll_id)) {
      pollMap.set(r.poll_id, {
        pollId: r.poll_id,
        type: r.type,
        pollster: r.pollster,
        client: r.client,
        date: new Date(r.fieldwork_end),
        fieldworkStart: r.fieldwork_start ? new Date(r.fieldwork_start) : null,
        sampleSize: r.sample_size ? Number(r.sample_size) : null,
        shares: {},
      });
    }
    pollMap.get(r.poll_id).shares[r.party] = Number(r.share);
  }

  const pollList = [...pollMap.values()].sort((a, b) => a.date - b.date);

  // Long form, one point per party per poll -- what the line mark consumes.
  const points = [];
  for (const p of pollList) {
    for (const [party, share] of Object.entries(p.shares)) {
      points.push({
        party, share,
        date: p.date,
        pollId: p.pollId,
        pollster: p.pollster,
        type: p.type,
      });
    }
  }

  // Predictions, same shape, tagged by track so they can be drawn separately.
  const predPoints = predictions
    .filter((r) => r.party && r.share)
    .map((r) => ({
      party: r.party,
      share: Number(r.share),
      date: new Date(r.expected_publish || r.made_at),
      madeAt: new Date(r.made_at),
      track: r.track,
      targetPollId: r.target_poll_id,
      targetType: r.target_type,
      predId: r.pred_id,
    }));

  // Backtest output: what the model would have said about each past poll.
  // Kept apart from `predictions` on purpose -- those were made before their
  // poll was published, these after. See model/backtest.py.
  let backtest = [];
  if (modelDir) {
    try {
      const rows = parseCsv(readFileSync(join(modelDir, 'backtest_predictions.csv'), 'utf8'));
      backtest = rows
        .filter((r) => r.party && r.predicted)
        .map((r) => ({
          party: r.party,
          predicted: Number(r.predicted),
          actual: Number(r.actual),
          date: new Date(r.date),
          pollId: r.target_poll_id,
          pollster: r.pollster,
          methodVersion: r.method_version,
        }));
    } catch { /* not run yet */ }
  }

  return { partyMeta, parties, polls: pollList, points, predictions: predPoints, backtest };
}

// Latest value per party, and the change since a reference poll.
export function summary(points, { partyOrder } = {}) {
  const byParty = new Map();
  for (const pt of points) {
    if (!byParty.has(pt.party)) byParty.set(pt.party, []);
    byParty.get(pt.party).push(pt);
  }
  const out = [];
  for (const [party, list] of byParty) {
    list.sort((a, b) => a.date - b.date);
    const first = list[0];
    const last = list[list.length - 1];
    out.push({
      party,
      first: first.share,
      last: last.share,
      lastDate: last.date,
      change: +(last.share - first.share).toFixed(1),
      series: list,
    });
  }
  out.sort((a, b) => (partyOrder ? partyOrder.indexOf(a.party) - partyOrder.indexOf(b.party) : b.last - a.last));
  return out;
}
