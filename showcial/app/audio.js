/* Showcial audio engine — every song is synthesized on the device from a seed.
   No audio files, so artists play (and download) fully offline. */
(function () {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10];

  const GENRES = {
    pop:     { label: 'Pop',     emoji: '💫', bpm: 116, scale: MAJ, root: 60, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x..x..x.', bassWave: 'triangle', pad: 'stab',  prog: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4]] },
    hiphop:  { label: 'Hip-Hop', emoji: '🎤', bpm: 90,  scale: MIN, root: 57, kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', bass: 'x.....x...x.....', bassWave: 'sine',     pad: 'keys',  prog: [[0, 5, 3, 4], [0, 0, 5, 6], [0, 3, 5, 4]], glide: true },
    rnb:     { label: 'R&B',     emoji: '🌙', bpm: 76,  scale: DOR, root: 58, kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bass: 'x......x..x...x.', bassWave: 'sine',     pad: 'pad',   prog: [[0, 3, 1, 4], [1, 4, 0, 5], [0, 5, 3, 4]] },
    edm:     { label: 'EDM',     emoji: '⚡', bpm: 126, scale: MIN, root: 57, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '..x...x...x...x.', bassWave: 'sawtooth', pad: 'stab',  prog: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 6]] },
    rock:    { label: 'Rock',    emoji: '🎸', bpm: 140, scale: [0, 3, 5, 7, 10], root: 52, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.', bassWave: 'sawtooth', pad: 'chug', prog: [[0, 3, 4, 0], [0, 2, 3, 1], [0, 4, 3, 2]] },
    country: { label: 'Country', emoji: '🤠', bpm: 104, scale: MAJ, root: 55, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', bassWave: 'triangle', pad: 'arp',   prog: [[0, 3, 4, 0], [0, 4, 5, 3], [0, 3, 0, 4]], alt: true },
    latin:   { label: 'Latin',   emoji: '🔥', bpm: 96,  scale: MIN, root: 57, kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x..x..x.', bassWave: 'sine',     pad: 'stab',  prog: [[0, 5, 2, 6], [0, 3, 6, 4], [5, 6, 0, 0]] },
    lofi:    { label: 'Lo-fi',   emoji: '☕', bpm: 72,  scale: MAJ, root: 60, kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.xxx.x.x.x.x.xx', bass: 'x.....x...x.....', bassWave: 'sine',     pad: 'keys',  prog: [[1, 4, 0, 5], [3, 2, 1, 0], [0, 5, 1, 4]], lofi: true }
  };

  const VOICES = {
    silky:   { label: 'Silky',   wave: 'sine',     cut: 3200, oct: 0,   vib: 5,  att: 0.03 },
    airy:    { label: 'Airy',    wave: 'triangle', cut: 7000, oct: 12,  vib: 6,  att: 0.05 },
    raspy:   { label: 'Raspy',   wave: 'sawtooth', cut: 1700, oct: 0,   vib: 4,  att: 0.01 },
    robotic: { label: 'Robotic', wave: 'square',   cut: 2400, oct: 0,   vib: 0,  att: 0.005 },
    deep:    { label: 'Deep',    wave: 'sine',     cut: 1400, oct: -12, vib: 3,  att: 0.04 },
    choir:   { label: 'Choir',   wave: 'sawtooth', cut: 2100, oct: 0,   vib: 5,  att: 0.08, layer: true }
  };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const noiseCache = new WeakMap();
  function noise(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ctx, b);
    }
    return b;
  }

  function degree(song, deg, octave) {
    const s = song.g.scale, n = s.length;
    const o = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return song.root + s[i] + 12 * (o + (octave || 0));
  }

  function buildSong(opts) {
    const g = GENRES[opts.genre] || GENRES.pop;
    const v = VOICES[opts.voice] || VOICES.silky;
    const r = rng(opts.seed || 1);
    const bpm = g.bpm + Math.round((r() - 0.5) * 8);
    const step = 60 / bpm / 4;
    const song = { g, v, bpm, step, barDur: step * 16, root: g.root + Math.floor(r() * 5) - 2, prog: g.prog[Math.floor(r() * g.prog.length)] };
    const motif = () => {
      const out = []; let deg = Math.floor(r() * 5), i = 0;
      while (i < 32) {
        const strong = i % 4 === 0;
        if (r() < (strong ? 0.7 : 0.32)) {
          const len = [1, 2, 2, 3, 4][Math.floor(r() * 5)];
          deg += Math.round((r() - 0.5) * 4);
          deg = Math.max(-2, Math.min(9, deg));
          out.push({ s: i, d: Math.min(len, 32 - i), deg });
          i += len;
        } else i++;
      }
      return out;
    };
    song.A = motif(); song.B = motif();
    return song;
  }

  function env(g, t, peak, att, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.setValueAtTime(peak, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(ctx, out, o) {
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = o.type; osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.t + o.dur * 0.6);
    f.type = 'lowpass'; f.frequency.value = o.cut || 4000; f.Q.value = o.q || 0.7;
    env(g, o.t, o.vol, o.att || 0.01, o.dur, o.rel || 0.08);
    osc.connect(f); f.connect(g); g.connect(out);
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.freq * 0.012;
      l.connect(lg); lg.connect(osc.frequency); l.start(o.t); l.stop(o.t + o.dur + 0.05);
    }
    osc.start(o.t); osc.stop(o.t + o.dur + 0.05);
  }

  function kick(ctx, out, t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, vol, 0.002, 0.32, 0.25); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
  }
  function hiss(ctx, out, t, vol, hp, dur) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx); f.type = 'highpass'; f.frequency.value = hp;
    env(g, t, vol, 0.002, dur, dur * 0.8); s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function snare(ctx, out, t, vol) {
    hiss(ctx, out, t, vol, 1400, 0.16);
    tone(ctx, out, { type: 'triangle', freq: 190, t, dur: 0.08, vol: vol * 0.5, cut: 2000 });
  }

  function chord(song, bar) { return song.prog[bar % 4]; }

  function scheduleBar(ctx, out, song, bar, t0) {
    const { g, v, step } = song;
    const section = Math.floor(bar / 4) % 4; // 0 intro-ish, 1 verse, 2 hook, 3 verse
    const deg = chord(song, bar);
    const sw = i => (i % 2 ? step * 0.08 * (g.lofi || g === GENRES.hiphop ? 1 : 0) : 0);
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * step + sw(i);
      if (g.kick[i] === 'x') kick(ctx, out, t, 0.9);
      if (g.snare[i] === 'x' && (bar > 0 || i > 7)) snare(ctx, out, t, 0.45);
      if (g.hat[i] === 'x') hiss(ctx, out, t, g === GENRES.edm ? 0.18 : 0.1, 7000, g === GENRES.edm ? 0.09 : 0.04);
      if (g.bass[i] === 'x') {
        let n = degree(song, deg, -2);
        if (g.alt && i >= 8) n = degree(song, deg + 4, -2);
        const len = g.glide ? step * 6 : step * (g === GENRES.rock ? 1.8 : 2.5);
        tone(ctx, out, { type: g.bassWave, freq: mtof(n), t, dur: len, vol: g.glide ? 0.55 : 0.3, cut: g.bassWave === 'sawtooth' ? 600 : 1200, glideTo: g.glide && i === 10 ? mtof(n - 2) : 0 });
      }
    }
    // harmony
    const tri = [0, 2, 4].map(x => degree(song, deg + x, 0));
    if (g.pad === 'pad' || g.pad === 'keys') {
      tri.forEach((n, k) => tone(ctx, out, { type: g.pad === 'keys' ? 'sine' : 'triangle', freq: mtof(n), t: t0 + k * 0.01, dur: song.barDur * 0.95, vol: 0.06, att: g.pad === 'pad' ? 0.25 : 0.01, rel: 0.4, cut: g.lofi ? 1200 : 2500, vib: g.lofi ? 4 : 0 }));
    } else if (g.pad === 'stab') {
      [2, 6, 10, 14].forEach(i => tri.forEach(n => tone(ctx, out, { type: 'sawtooth', freq: mtof(n), t: t0 + i * step, dur: step * 1.2, vol: 0.035, cut: 2600, detune: 7 })));
    } else if (g.pad === 'chug') {
      for (let i = 0; i < 16; i += 2) [0, 7, 12].forEach(x => tone(ctx, out, { type: 'sawtooth', freq: mtof(tri[0] - 12 + x), t: t0 + i * step, dur: step * 1.4, vol: 0.05, cut: 1100, q: 2 }));
    } else if (g.pad === 'arp') {
      for (let i = 0; i < 16; i += 2) tone(ctx, out, { type: 'triangle', freq: mtof(tri[(i / 2) % 3] + 12), t: t0 + i * step, dur: step * 1.6, vol: 0.06, cut: 3500 });
    }
    // lead "vocal" — rests on the very first bar so the beat lands first
    if (bar === 0) return;
    const m = section === 2 ? song.B : song.A;
    const half = bar % 2;
    m.forEach(n => {
      if (Math.floor(n.s / 16) !== half) return;
      const t = t0 + (n.s % 16) * step;
      const f = mtof(degree(song, n.deg, 1) + v.oct);
      const dur = n.d * step * 0.95;
      tone(ctx, out, { type: v.wave, freq: f, t, dur, vol: 0.13, cut: v.cut, att: v.att, vib: v.vib, rel: 0.06 });
      if (v.layer) {
        tone(ctx, out, { type: v.wave, freq: f, t, dur, vol: 0.07, cut: v.cut, att: v.att, detune: 14 });
        tone(ctx, out, { type: 'sine', freq: f / 2, t, dur, vol: 0.06, att: v.att });
      }
    });
  }

  function chain(ctx, dest, song) {
    const g = ctx.createGain(); g.gain.value = 0.85;
    if (song.g.lofi) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3800;
      g.connect(f); f.connect(dest);
    } else g.connect(dest);
    return g;
  }

  const Player = {
    ctx: null, cur: null, listeners: [],
    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(fn => { try { fn(this.cur); } catch (e) { } }); },
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14; this.comp.ratio.value = 4;
        this.an = this.ctx.createAnalyser(); this.an.fftSize = 128;
        this.buf = new Uint8Array(this.an.frequencyBinCount);
        this.comp.connect(this.an); this.an.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    play(opts, meta) {
      meta = meta || {};
      this.stop(true);
      const ctx = this.ensure(), song = buildSong(opts), bars = meta.bars || 8, loop = !!meta.loop;
      const input = chain(ctx, this.comp, song);
      let bar = 0, t = ctx.currentTime + 0.08;
      const cur = { id: meta.id, meta, song, input, start: t, dur: bars * song.barDur, loop, paused: false };
      const pump = () => {
        if (this.cur !== cur) return;
        while (t < ctx.currentTime + 1.0 && (loop || bar < bars)) { scheduleBar(ctx, input, song, loop ? bar % 16 : bar, t); t += song.barDur; bar++; }
        if (!loop && bar >= bars && ctx.currentTime > t + 0.3) { this.stop(); return; }
        cur.timer = setTimeout(pump, 200);
      };
      this.cur = cur; pump(); this.emit();
    },
    stop(silent) {
      const c = this.cur; if (!c) return;
      clearTimeout(c.timer);
      try { c.input.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03); setTimeout(() => c.input.disconnect(), 400); } catch (e) { }
      this.cur = null; if (!silent) this.emit();
    },
    level() {
      if (!this.cur || !this.an) return 0;
      this.an.getByteFrequencyData(this.buf);
      let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i];
      return Math.min(1, s / this.buf.length / 120);
    },
    progress() {
      if (!this.cur || this.cur.loop) return 0;
      return Math.max(0, Math.min(1, (this.ctx.currentTime - this.cur.start) / this.cur.dur));
    }
  };

  async function renderWav(opts, bars) {
    bars = bars || 16;
    const song = buildSong(opts), sr = 44100, len = Math.ceil((bars * song.barDur + 1.2) * sr);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(2, len, sr);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    const input = chain(ctx, comp, song);
    for (let b = 0; b < bars; b++) scheduleBar(ctx, input, song, b, 0.05 + b * song.barDur);
    const buf = await ctx.startRendering();
    return toWav(buf);
  }

  function toWav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2;
    const dv = new DataView(new ArrayBuffer(bytes));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true);
    dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return new Blob([dv], { type: 'audio/wav' });
  }

  window.SC_AUDIO = { GENRES, VOICES, Player, renderWav, rng, buildSong };
})();
