// Chart presets. This is the file to edit per post: the headline, the subhead,
// which parties carry colour, and which sizes to render.
//
// Everything else -- scales, label placement, typography -- is handled by the
// chart module, so a new post is a few lines here and a re-run.

const SOURCE_FI = '<strong>Lähde:</strong> Yle/Taloustutkimus ja HS/Verian, '
  + 'huhtikuu 2023 – syyskuu 2026. Kukin piste on yhden kyselyn kenttätyöjakson päätös.';
const SOURCE_EN = '<strong>Source:</strong> Yle/Taloustutkimus and HS/Verian polls, '
  + 'April 2023 – September 2026. Each point marks the close of one poll\'s fieldwork.';

export const presets = {
  'trend-fi': {
    type: 'trend',
    lang: 'fi',
    sizes: ['ig', 'x'],
    kicker: 'Claude Elects · Puoluekannatus',
    headline: 'Kolme vuotta vaaleista: SDP edellä, '
      + 'perussuomalaiset menettänyt neljänneksen kannatuksestaan',
    subhead: 'Kevään 2023 vaaleissa kolme suurinta puoluetta mahtui yhden prosenttiyksikön sisään. '
      + 'Syyskuussa 2026 ero SDP:n ja perussuomalaisten välillä on <b>8,4 prosenttiyksikköä</b>.',
    focus: ['SDP', 'KOK', 'PS'],
    source: SOURCE_FI,
    note: 'Pisteet ovat yksittäisiä kyselyitä. Viiva on viiden kyselyn painotettu liukuva keskiarvo, '
      + 'joka tasoittaa laitosten välisiä eroja.',
  },

  'trend-en': {
    type: 'trend',
    lang: 'en',
    sizes: ['x'],
    kicker: 'Claude Elects · Party support',
    headline: 'Three years from the election, the Finns Party has lost a quarter of its support',
    subhead: 'In April 2023 the top three parties finished within one point of each other. '
      + 'By September 2026 the gap between the Social Democrats and the Finns Party is '
      + '<b>8.4 points</b>.',
    focus: ['SDP', 'KOK', 'PS'],
    source: SOURCE_EN,
    note: 'Dots are individual polls. The line is a weighted five-poll moving average, '
      + 'which smooths the gap between the two pollsters\' house effects.',
  },
};

// --- backtest -------------------------------------------------------------
// The model run backwards over every poll since the 2023 election. The line is
// the prediction, the dots are what the pollsters published, and the hairline
// between them at each poll is the miss.

const BACKTEST_SOURCE_FI = '<strong>Lähde:</strong> Yle/Taloustutkimus ja HS/Verian, '
  + 'syyskuu 2023 – syyskuu 2026, 71 kyselyä. Ennusteet: claude_elects, malli poll-model-1.';
const BACKTEST_SOURCE_EN = '<strong>Source:</strong> Yle/Taloustutkimus and HS/Verian polls, '
  + 'September 2023 – September 2026, 71 polls. Predictions: claude_elects, model poll-model-1.';

presets['backtest-fi'] = {
  type: 'backtest',
  lang: 'fi',
  sizes: ['ig', 'x'],
  kicker: 'Claude Elects · Mallin testi',
  headline: 'Näin lähelle malli osui: keskimäärin 0,4 prosenttiyksikköä',
  subhead: 'Jokainen vuoden 2023 vaalien jälkeinen kysely ennustettiin etukäteen, '
    + 'pelkästään sitä ennen julkaistujen kyselyiden perusteella. Yhteensä <b>71 kyselyä</b>.',
  focus: ['SDP', 'KOK', 'PS'],
  splitDate: '2026-01-01',
  splitLabel: 'Asetukset lyöty lukkoon',
  keyActual: 'Toteutuneet kyselyt',
  keyPredicted: 'Ennuste',
  keyLatest: 'Viimeisin ennuste',
  source: BACKTEST_SOURCE_FI,
  note: 'Viiva on julkaistut kyselyt sellaisinaan, ilman tasoitusta: ennuste tehdään aina '
    + 'yhdelle laitokselle kerrallaan, joten vertailukohtana on oltava juuri se kysely. '
    + 'Ohut pystyviiva on ennusteen ja toteutuneen ero. Mallin asetukset valittiin '
    + 'tammikuuta 2026 edeltävällä aineistolla: sen oikealla puolella malli ei ollut '
    + 'nähnyt mitään ennustamastaan.',
};

presets['backtest-en'] = {
  type: 'backtest',
  lang: 'en',
  sizes: ['x'],
  kicker: 'Claude Elects · Model test',
  headline: 'How close the model got: 0.4 points on average',
  subhead: 'Every poll since the 2023 election, predicted in advance from nothing but '
    + 'the polls published before it. <b>71 polls</b> in all.',
  focus: ['SDP', 'KOK', 'PS'],
  splitDate: '2026-01-01',
  splitLabel: 'Settings locked here',
  keyActual: 'Published polls',
  keyPredicted: 'Prediction',
  keyLatest: 'Latest prediction',
  source: BACKTEST_SOURCE_EN,
  note: 'The line is the published polls as they came, unsmoothed: each prediction targets '
    + 'one pollster\'s next poll, so it has to be judged against that poll rather than an '
    + 'average. The hairline at each poll is the gap between prediction and result. '
    + 'The model\'s settings were chosen on data before January 2026, so everything to '
    + 'the right of the rule was predicted blind.',
};

// One house at a time. The combined backtest chart above is honest but busy:
// the zigzag in its line is the gap between the two pollsters, not support
// moving. Split by house and the line settles down without hiding anything.

presets['backtest-ver-fi'] = {
  type: 'backtest',
  lang: 'fi',
  pollster: 'Verian',
  sizes: ['ig', 'x'],
  kicker: 'Claude Elects · Mallin testi · HS/Verian',
  headline: 'Näin lähelle malli osui HS:n kyselyissä: keskimäärin 0,3 prosenttiyksikköä',
  subhead: 'Jokainen HS:n ja Verianin kysely vuoden 2023 vaalien jälkeen ennustettiin '
    + 'etukäteen, pelkästään sitä ennen julkaistujen kyselyiden perusteella. '
    + 'Yhteensä <b>34 kyselyä</b>.',
  focus: ['SDP', 'KOK', 'PS'],
  splitDate: '2026-01-01',
  splitLabel: 'Asetukset lyöty lukkoon',
  keyActual: 'Toteutuneet kyselyt',
  keyPredicted: 'Ennuste',
  keyLatest: 'Viimeisin ennuste',
  source: '<strong>Lähde:</strong> HS/Verian, syyskuu 2023 – syyskuu 2026, 34 kyselyä. '
    + 'Ennusteet: claude_elects, malli poll-model-1.',
  note: 'Kuvassa vain HS/Verianin kyselyt. Malli käyttää syötteenään molempien '
    + 'laitosten kyselyitä, mutta ennustaa kerrallaan yhden laitoksen seuraavan '
    + 'kyselyn. Ohut pystyviiva on ennusteen ja toteutuneen ero. Mallin asetukset '
    + 'valittiin tammikuuta 2026 edeltävällä aineistolla: sen oikealla puolella malli '
    + 'ei ollut nähnyt mitään ennustamastaan.',
};

presets['backtest-ver-en'] = {
  type: 'backtest',
  lang: 'en',
  pollster: 'Verian',
  sizes: ['x'],
  kicker: 'Claude Elects · Model test · HS/Verian',
  headline: 'How close the model got on HS\'s polls: 0.3 points on average',
  subhead: 'Every HS/Verian poll since the 2023 election, predicted in advance from '
    + 'nothing but the polls published before it. <b>34 polls</b> in all.',
  focus: ['SDP', 'KOK', 'PS'],
  splitDate: '2026-01-01',
  splitLabel: 'Settings locked here',
  keyActual: 'Published polls',
  keyPredicted: 'Prediction',
  keyLatest: 'Latest prediction',
  source: '<strong>Source:</strong> HS/Verian, September 2023 – September 2026, 34 polls. '
    + 'Predictions: claude_elects, model poll-model-1.',
  note: 'This chart shows HS/Verian polls only. The model reads both pollsters, but '
    + 'predicts one house\'s next poll at a time. The hairline at each poll is the gap '
    + 'between prediction and result. The model\'s settings were chosen on data before '
    + 'January 2026, so everything to the right of the rule was predicted blind.',
};
