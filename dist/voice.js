/* Voice patterns: seeded demo recordings and the rules that turn them into bands, baselines and status chips.
   Everything shown in the UI (band, baseline, chips, counts) is computed here from the generated recordings,
   so swapping the generator for real measurements leaves the rules unchanged. */
(function (root) {
  const DAY = 86400000;
  const BASELINE_N = 14;      // recordings needed before any band or chip is shown
  const WINDOW = 7;           // days in the rolling median
  const MIN_IN_WINDOW = 3;    // recordings needed in a window for its median to count
  const RUN_DAYS = 7;         // consecutive days outside the band before a measure is flagged
  const CLEAR_DAYS = 14;      // consecutive days back inside the band before the flag clears

  const METRICS = {
    pace: {
      label: 'Speaking pace', short: 'Pace', unit: 'wpm', digits: 0, noise: 0.07,
      higher: 'faster', lower: 'slower',
      info: 'Words per minute of speech time, from word timestamps in the transcript, leaving out silences longer than 2 seconds. The transcription version is pinned so numbers stay comparable over time.'
    },
    pause: {
      label: 'Average pause', short: 'Pause', unit: 'sec', digits: 2, noise: 0.10,
      higher: 'longer', lower: 'shorter',
      info: 'Mean silent gap between words, counting gaps of 250 milliseconds or more.'
    },
    latency: {
      label: 'Response latency', short: 'Latency', unit: 'sec', digits: 1, noise: 0.20,
      higher: 'longer', lower: 'shorter',
      info: 'Time from the end of the app’s question to the first speech. Only measured for question prompts, so it shows n/a for free storytelling.'
    },
    pitch: {
      label: 'Pitch variation', short: 'Pitch variation', unit: 'semitones', digits: 1, noise: 0.06,
      higher: 'more varied', lower: 'flatter',
      info: 'Spread of voice pitch (fundamental frequency) in semitones. It holds up in connected speech and reflects how flat or expressive the voice sounds.'
    }
  };
  const ORDER = ['pace', 'pause', 'latency', 'pitch'];

  const START = Date.UTC(2026, 0, 5);
  const END = Date.UTC(2026, 8, 30);

  const SCENARIOS = {
    typical: {
      label: 'Typical', seed: 450,
      base: { pace: 130, pause: 0.8, latency: 1.3, pitch: 3.0 }
    },
    gradual: {
      label: 'Gradual change', seed: 3056,
      base: { pace: 118, pause: 0.9, latency: 1.6, pitch: 2.8 },
      end: { pace: 105, pause: 1.2, latency: 2.4, pitch: 2.8 },
      curve: { pace: 'easeOut', pause: 'linear', latency: 'linear', pitch: 'linear' },
      driftStart: Date.UTC(2026, 2, 16)
    }
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0;
    while (!u) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }
  function median(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function mad(a) {
    const m = median(a);
    return median(a.map(v => Math.abs(v - m)));
  }
  const ease = { linear: t => t, easeOut: t => 1 - Math.pow(1 - t, 2) };

  const cache = {};
  function generate(key) {
    if (cache[key]) return cache[key];
    const sc = SCENARIOS[key], r = mulberry32(sc.seed), recs = [];
    let id = 0;
    for (let d = START; d <= END; d += DAY) {
      const dow = new Date(d).getUTCDay();
      if (dow === 0) continue;                    // no recording on Sundays
      if (dow === 3 && r() < 0.4) continue;       // sometimes skip a Wednesday: 5 to 6 a week
      const type = r() < 0.96 ? 'qa' : 'story';    // question prompt or free storytelling
      const device = r() < 0.97 ? 'phone' : 'tablet';
      const lowQuality = r() < 0.04;
      const values = {};
      ORDER.forEach(m => {
        let mean = sc.base[m];
        if (sc.end) {
          const t = Math.min(1, Math.max(0, (d - sc.driftStart) / (END - sc.driftStart)));
          mean = sc.base[m] + (sc.end[m] - sc.base[m]) * ease[sc.curve[m]](t);
        }
        values[m] = Math.max(0.05, mean * (1 + METRICS[m].noise * gauss(r)));
      });
      recs.push({ id: id++, date: d, type, device, lowQuality, values });
    }
    cache[key] = recs;
    return recs;
  }

  const eligible = rec => !rec.lowQuality && rec.type === 'qa' && rec.device === 'phone';

  // Everything the UI needs, as of a given day.
  function analyze(key, asOf) {
    asOf = Math.min(END, Math.max(START, asOf || END));
    const all = generate(key).filter(r => r.date <= asOf);
    const ok = all.filter(eligible);
    const out = { key, asOf, total: all.length, n: ok.length, excluded: all.length - ok.length, recs: ok, ready: ok.length >= BASELINE_N, metrics: {} };
    const first = ok.slice(0, BASELINE_N);
    out.baselineDate = out.ready ? first[BASELINE_N - 1].date : null;
    ORDER.forEach(m => {
      const mm = { daily: [], band: null, baseline: null, status: 'building', since: null };
      if (out.ready) {
        const vals = first.map(r => r.values[m]);
        const base = median(vals);
        // Typical spread of a 7-day median: sigma from the baseline (1.4826 x MAD), the median's
        // efficiency factor (1.2533), and the number of qualifying recordings a week actually holds.
        const span = (first[BASELINE_N - 1].date - first[0].date) / DAY + 1;
        const perWindow = Math.max(MIN_IN_WINDOW, (BASELINE_N / span) * WINDOW);
        const se = (1.2533 * 1.4826 * mad(vals)) / Math.sqrt(perWindow);
        mm.baseline = base;
        mm.band = [base - 2 * se, base + 2 * se];
      }
      // 7-day rolling median for every day with enough recordings, carried forward across short gaps
      let last = null;
      for (let d = ok.length ? ok[0].date : asOf; d <= asOf; d += DAY) {
        const win = ok.filter(r => r.date <= d && r.date > d - WINDOW * DAY).map(r => r.values[m]);
        if (win.length >= MIN_IN_WINDOW) last = median(win);
        if (last !== null) mm.daily.push({ date: d, value: last });
      }
      if (out.ready) {
        // Status changes only after a steady run: RUN_DAYS outside the band to flag, CLEAR_DAYS back inside to clear.
        const outside = p => p.value < mm.band[0] || p.value > mm.band[1];
        let state = 'typical', run = 0, runStart = null, spanStart = null;
        mm.spans = [];
        mm.daily.filter(p => p.date >= out.baselineDate).forEach(pt => {
          const o = outside(pt);
          if (state === 'typical') {
            if (o) { if (!run) runStart = pt.date; run++; if (run >= RUN_DAYS) { state = 'different'; spanStart = runStart; mm.since = runStart; mm.direction = pt.value > mm.band[1] ? 'higher' : 'lower'; run = 0; } }
            else run = 0;
          } else {
            if (!o) { run++; if (run >= CLEAR_DAYS) { mm.spans.push([spanStart, pt.date - CLEAR_DAYS * DAY]); state = 'typical'; mm.since = null; run = 0; } }
            else run = 0;
          }
        });
        if (state === 'different') mm.spans.push([spanStart, asOf]);
        mm.status = state;
      }
      mm.current = mm.daily.length ? mm.daily[mm.daily.length - 1].value : null;
      out.metrics[m] = mm;
    });
    return out;
  }

  // Positions of the whole series, used so the chart scale stays steady while scrubbing through dates.
  function range(key, m) {
    const v = generate(key).filter(eligible).map(r => r.values[m]);
    return [Math.min.apply(null, v), Math.max.apply(null, v)];
  }

  const api = { METRICS, ORDER, SCENARIOS, START, END, DAY, BASELINE_N, WINDOW, RUN_DAYS, CLEAR_DAYS, generate, analyze, range, median, mad, eligible };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VOICE = api;
})(typeof window !== 'undefined' ? window : this);
