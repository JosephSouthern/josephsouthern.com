// MusicHelper - Guitar-Centric Songwriting Engine, Fretboard & Strummer

(function () {
  'use strict';

  // --- 1. ACOUSTIC GUITAR AUDIO ENGINE (Web Audio API) ---
  class GuitarAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.isMuted = false;
      this.bodyFilter = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Acoustic guitar body resonance cavity simulation (approx 190 Hz peak)
        this.bodyFilter = this.ctx.createBiquadFilter();
        this.bodyFilter.type = 'peaking';
        this.bodyFilter.frequency.value = 195;
        this.bodyFilter.Q.value = 2.5;
        this.bodyFilter.gain.value = 5.0; // Warm wooden soundboard resonance

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
        
        this.bodyFilter.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    setVolume(val) {
      if (!this.ctx) return;
      const v = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : v, this.ctx.currentTime);
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
      }
      return this.isMuted;
    }

    midiToFreq(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // Physical model approximation of a plucked acoustic guitar string
    pluckString(midi, duration = 1.8, timeOffset = 0, velocity = 0.8) {
      this.init();
      const startTime = this.ctx.currentTime + timeOffset;
      const freq = this.midiToFreq(midi);

      // Lowpass filter modeling string damping over time
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Initial bright pick attack, then decay into warm fundamental
      filter.frequency.setValueAtTime(Math.min(freq * 5.0, 7500), startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.8, 1200), startTime + duration);

      // Gain Envelope
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, startTime);
      // Fast pick attack (3ms)
      gainNode.gain.linearRampToValueAtTime(velocity * 0.42, startTime + 0.003);
      // Body decay
      gainNode.gain.exponentialRampToValueAtTime(velocity * 0.16, startTime + 0.35);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      // Primary string oscillator (warm triangle + slight sawtooth)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startTime);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, startTime);

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.18, startTime);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      // Pick transient noise burst (adds realistic acoustic plectrum 'thump')
      const noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.012), this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.003));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08 * velocity, startTime);
      noise.connect(noiseGain);
      noiseGain.connect(filter);

      osc1.connect(filter);
      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bodyFilter);

      noise.start(startTime);
      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration + 0.05);
      osc2.stop(startTime + duration + 0.05);
    }

    // Authentic guitar strum using exact string frets [E6, A5, D4, G3, B2, E1]
    strumGuitarChord(frets, duration = 1.8, direction = 'down', strumSpeed = 0.018, openMidis = [40, 45, 50, 55, 59, 64]) {
      this.init();
      // Collect played strings (fret >= 0)
      const playedStrings = [];
      frets.forEach((fret, strIdx) => {
        if (fret >= 0) {
          playedStrings.push({
            strIdx,
            midi: openMidis[strIdx] + fret
          });
        }
      });

      if (direction === 'up') {
        playedStrings.reverse();
      }

      playedStrings.forEach((item, pickOrder) => {
        const offset = pickOrder * strumSpeed;
        const vel = 0.85 - (pickOrder * 0.02);
        this.pluckString(item.midi, duration, offset, vel);
      });
    }

    // Play a sequence of scale notes
    playScaleSequence(midis, noteDuration = 0.26, onNoteCallback = null) {
      this.init();
      midis.forEach((midi, idx) => {
        const offset = idx * noteDuration;
        this.pluckString(midi, noteDuration * 1.3, offset, 0.85);
        if (onNoteCallback) {
          setTimeout(() => onNoteCallback(midi, idx), offset * 1000);
        }
      });
      if (onNoteCallback) {
        setTimeout(() => onNoteCallback(null, -1), midis.length * noteDuration * 1000);
      }
    }
  }

  const audio = new GuitarAudioEngine();

  // --- 2. GUITAR TUNINGS ---
  const TUNINGS = {
    standard: { name: 'Standard (E A D G B E)', midis: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
    drop_d:   { name: 'Drop D (D A D G B E)',   midis: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'] },
    dadgad:   { name: 'DADGAD (Celtic / Folk)', midis: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'] },
    open_d:   { name: 'Open D (D A D F# A D)',  midis: [38, 45, 50, 54, 57, 62], names: ['D', 'A', 'D', 'F#', 'A', 'D'] },
    open_g:   { name: 'Open G (D G D G B D)',   midis: [38, 43, 50, 55, 59, 62], names: ['D', 'G', 'D', 'G', 'B', 'D'] }
  };

  // --- 3. GUITAR CHORD VOICING DICTIONARY (6 strings: E6, A5, D4, G3, B2, E1) ---
  // -1 = muted 'x', 0 = open 'o', 1..15 = fret number
  const GUITAR_VOICINGS = {
    // MAJOR CHORDS
    'C':   { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1, fingers: [-1, 3, 2, 0, 1, 0], name: 'C' },
    'C#':  { frets: [-1, 4, 6, 6, 6, 4], baseFret: 4, barre: 4, name: 'C#' },
    'Db':  { frets: [-1, 4, 6, 6, 6, 4], baseFret: 4, barre: 4, name: 'D♭' },
    'D':   { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1, fingers: [-1, -1, 0, 1, 3, 2], name: 'D' },
    'D#':  { frets: [-1, 6, 8, 8, 8, 6], baseFret: 6, barre: 6, name: 'D#' },
    'Eb':  { frets: [-1, 6, 8, 8, 8, 6], baseFret: 6, barre: 6, name: 'E♭' },
    'E':   { frets: [0, 2, 2, 1, 0, 0], baseFret: 1, fingers: [0, 2, 3, 1, 0, 0], name: 'E' },
    'F':   { frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: 1, fingers: [1, 3, 4, 2, 1, 1], name: 'F' },
    'F#':  { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: 2, name: 'F#' },
    'Gb':  { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: 2, name: 'G♭' },
    'G':   { frets: [3, 2, 0, 0, 0, 3], baseFret: 1, fingers: [2, 1, 0, 0, 0, 3], name: 'G' },
    'G#':  { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: 4, name: 'G#' },
    'Ab':  { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: 4, name: 'A♭' },
    'A':   { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1, fingers: [-1, 0, 1, 2, 3, 0], name: 'A' },
    'A#':  { frets: [-1, 1, 3, 3, 3, 1], baseFret: 1, barre: 1, name: 'A#' },
    'Bb':  { frets: [-1, 1, 3, 3, 3, 1], baseFret: 1, barre: 1, name: 'B♭' },
    'B':   { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: 2, name: 'B' },

    // MINOR CHORDS
    'Cm':  { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3, barre: 3, name: 'Cm' },
    'C#m': { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4, barre: 4, name: 'C#m' },
    'Dbm': { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4, barre: 4, name: 'D♭m' },
    'Dm':  { frets: [-1, -1, 0, 2, 3, 1], baseFret: 1, fingers: [-1, -1, 0, 2, 3, 1], name: 'Dm' },
    'D#m': { frets: [-1, 6, 8, 8, 7, 6], baseFret: 6, barre: 6, name: 'D#m' },
    'Ebm': { frets: [-1, 6, 8, 8, 7, 6], baseFret: 6, barre: 6, name: 'E♭m' },
    'Em':  { frets: [0, 2, 2, 0, 0, 0], baseFret: 1, fingers: [0, 2, 3, 0, 0, 0], name: 'Em' },
    'Fm':  { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: 1, name: 'Fm' },
    'F#m': { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: 2, name: 'F#m' },
    'Gbm': { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: 2, name: 'G♭m' },
    'Gm':  { frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: 3, name: 'Gm' },
    'G#m': { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: 4, name: 'G#m' },
    'Abm': { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: 4, name: 'A♭m' },
    'Am':  { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1, fingers: [-1, 0, 2, 3, 1, 0], name: 'Am' },
    'A#m': { frets: [-1, 1, 3, 3, 2, 1], baseFret: 1, barre: 1, name: 'A#m' },
    'Bbm': { frets: [-1, 1, 3, 3, 2, 1], baseFret: 1, barre: 1, name: 'B♭m' },
    'Bm':  { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: 2, name: 'Bm' },

    // DIMINISHED & m7b5 CHORDS
    'Bdim': { frets: [-1, 2, 3, 4, 3, -1], baseFret: 2, name: 'Bdim' },
    'Bm7b5':{ frets: [-1, 2, 3, 2, 3, -1], baseFret: 2, name: 'Bm7♭5' },
    'C#dim':{ frets: [-1, 4, 5, 6, 5, -1], baseFret: 4, name: 'C#dim' },
    'Ddim': { frets: [-1, -1, 0, 1, 3, 1], baseFret: 1, name: 'Ddim' },
    'Edim': { frets: [0, 1, 2, 0, -1, -1], baseFret: 1, name: 'Edim' },
    'F#dim':{ frets: [2, 3, 4, 2, -1, -1], baseFret: 1, name: 'F#dim' },
    'G#dim':{ frets: [4, 5, 6, 4, -1, -1], baseFret: 4, name: 'G#dim' },

    // 7TH CHORDS
    'C7':   { frets: [-1, 3, 2, 3, 1, 0], baseFret: 1, name: 'C7' },
    'Cmaj7':{ frets: [-1, 3, 2, 0, 0, 0], baseFret: 1, name: 'Cmaj7' },
    'D7':   { frets: [-1, -1, 0, 2, 1, 2], baseFret: 1, name: 'D7' },
    'Dmaj7':{ frets: [-1, -1, 0, 2, 2, 2], baseFret: 1, name: 'Dmaj7' },
    'Dm7':  { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1, name: 'Dm7' },
    'E7':   { frets: [0, 2, 0, 1, 0, 0], baseFret: 1, name: 'E7' },
    'Emaj7':{ frets: [0, 2, 1, 1, 0, 0], baseFret: 1, name: 'Emaj7' },
    'Em7':  { frets: [0, 2, 0, 0, 0, 0], baseFret: 1, name: 'Em7' },
    'F7':   { frets: [1, 3, 1, 2, 1, 1], baseFret: 1, barre: 1, name: 'F7' },
    'Fmaj7':{ frets: [-1, -1, 3, 2, 1, 0], baseFret: 1, name: 'Fmaj7' },
    'G7':   { frets: [3, 2, 0, 0, 0, 1], baseFret: 1, name: 'G7' },
    'Gmaj7':{ frets: [3, 2, 0, 0, 0, 2], baseFret: 1, name: 'Gmaj7' },
    'A7':   { frets: [-1, 0, 2, 0, 2, 0], baseFret: 1, name: 'A7' },
    'Amaj7':{ frets: [-1, 0, 2, 1, 2, 0], baseFret: 1, name: 'Amaj7' },
    'Am7':  { frets: [-1, 0, 2, 0, 1, 0], baseFret: 1, name: 'Am7' },
    'B7':   { frets: [-1, 2, 1, 2, 0, 2], baseFret: 1, name: 'B7' },
    'Bm7':  { frets: [-1, 2, 4, 2, 3, 2], baseFret: 2, barre: 2, name: 'Bm7' },
    'Bb7':  { frets: [-1, 1, 3, 1, 3, 1], baseFret: 1, barre: 1, name: 'B♭7' },

    // EXTENSIONS (Acoustic Singer-Songwriter Staples)
    'Cadd9':{ frets: [-1, 3, 2, 0, 3, 3], baseFret: 1, name: 'Cadd9' },
    'Csus2':{ frets: [-1, 3, 0, 0, 1, -1], baseFret: 1, name: 'Csus2' },
    'Csus4':{ frets: [-1, 3, 3, 0, 1, 1], baseFret: 1, name: 'Csus4' },
    'C6':   { frets: [-1, 3, 2, 2, 1, 0], baseFret: 1, name: 'C6' },
    'Dsus2':{ frets: [-1, -1, 0, 2, 3, 0], baseFret: 1, name: 'Dsus2' },
    'Dsus4':{ frets: [-1, -1, 0, 2, 3, 3], baseFret: 1, name: 'Dsus4' },
    'Dadd9':{ frets: [-1, 5, 4, 2, 3, 0], baseFret: 2, name: 'Dadd9' },
    'Gsus4':{ frets: [3, 3, 0, 0, 1, 3], baseFret: 1, name: 'Gsus4' },
    'G6':   { frets: [3, 2, 0, 0, 0, 0], baseFret: 1, name: 'G6' },
    'Asus2':{ frets: [-1, 0, 2, 2, 0, 0], baseFret: 1, name: 'Asus2' },
    'Asus4':{ frets: [-1, 0, 2, 2, 3, 0], baseFret: 1, name: 'Asus4' },
    'Esus4':{ frets: [0, 2, 2, 2, 0, 0], baseFret: 1, name: 'Esus4' }
  };

  // Movable shapes as fret offsets from the root fret (-1 = muted).
  // E-shapes put the root on string 6, A-shapes put it on string 5.
  const MOVABLE_SHAPES = {
    'maj':     { E: [0, 2, 2, 1, 0, 0],   A: [-1, 0, 2, 2, 2, 0] },
    'm':       { E: [0, 2, 2, 0, 0, 0],   A: [-1, 0, 2, 2, 1, 0] },
    '7':       { E: [0, 2, 0, 1, 0, 0],   A: [-1, 0, 2, 0, 2, 0] },
    'maj7':    { E: [0, -1, 1, 1, 0, -1], A: [-1, 0, 2, 1, 2, 0] },
    'm7':      { E: [0, 2, 0, 0, 0, 0],   A: [-1, 0, 2, 0, 1, 0] },
    'm7b5':    { E: [0, 1, 2, 0, 3, 0],   A: [-1, 0, 1, 0, 1, -1] },
    'dim':     { E: [0, 1, 2, 0, -1, -1], A: [-1, 0, 1, 2, 1, -1] },
    'dim7':    { E: [0, 1, 2, 0, 2, 0],   A: [-1, 0, 1, 2, 1, 2] },
    'aug':     { E: [0, 3, 2, 1, 1, 0],   A: [-1, 0, 3, 2, 2, 1] },
    'sus2':    { E: [0, 2, 4, 4, 0, 0],   A: [-1, 0, 2, 2, 0, 0] },
    'sus4':    { E: [0, 2, 2, 2, 0, 0],   A: [-1, 0, 2, 2, 3, 0] },
    'add9':    { E: [0, 2, 4, 1, 0, 0],   A: [-1, 0, 2, 4, 2, 0] },
    '6':       { E: [0, 2, 2, 1, 2, 0],   A: [-1, 0, 2, 2, 2, 2] },
    'm6':      { E: [0, 2, 2, 0, 2, 0],   A: [-1, 0, 2, 2, 1, 2] },
    'm(maj7)': { E: [0, 2, 1, 0, 0, 0],   A: [-1, 0, 2, 1, 1, 0] },
    'maj7#5':  { E: [0, 3, 1, 1, 1, 0],   A: [-1, 0, 3, 1, 2, 1] }
  };

  const SUFFIX_ALIASES = { '': 'maj', 'min': 'm', '+': 'aug', 'mmaj7': 'm(maj7)', '°': 'dim', 'ø': 'm7b5' };

  // Split a chord name like "Ebmaj7" or "F##dim" into root text and suffix
  function parseChordName(chordName) {
    const clean = chordName.replace(/♭/g, 'b').replace(/♯/g, '#');
    const match = clean.match(/^([A-G](?:##|bb|#|b)?)(.*)$/);
    if (!match) return { root: clean, suffix: '' };
    return { root: match[1], suffix: match[2] };
  }

  function normalizeChordSuffix(suffix) {
    const s = suffix.trim();
    if (MOVABLE_SHAPES[s]) return s;
    if (SUFFIX_ALIASES[s] !== undefined) return SUFFIX_ALIASES[s];
    return s.startsWith('m') && !s.startsWith('maj') ? 'm' : 'maj';
  }

  // Helper to retrieve or calculate a guitar voicing
  function getGuitarVoicing(chordName, rootPitch) {
    // 1. Direct dictionary lookup
    const cleanName = chordName.replace(/♭/g, 'b');
    if (GUITAR_VOICINGS[cleanName]) return GUITAR_VOICINGS[cleanName];
    if (GUITAR_VOICINGS[chordName]) return GUITAR_VOICINGS[chordName];

    // 2. Movable CAGED shape fallback: use whichever of the E- or A-shape sits lower on the neck
    const shapes = MOVABLE_SHAPES[normalizeChordSuffix(parseChordName(cleanName).suffix)];
    const candidates = [
      { offsets: shapes.E, rootFret: (rootPitch - 4 + 12) % 12 }, // low E string pitch is 4
      { offsets: shapes.A, rootFret: (rootPitch - 9 + 12) % 12 }  // A string pitch is 9
    ];
    const best = candidates[0].rootFret <= candidates[1].rootFret ? candidates[0] : candidates[1];

    const frets = best.offsets.map(o => (o < 0 ? -1 : best.rootFret + o));
    const fretted = frets.filter(f => f > 0);
    const maxFret = fretted.length ? Math.max(...fretted) : 0;
    const baseFret = maxFret <= 4 ? 1 : Math.min(...fretted);
    const barre = best.rootFret > 0 && frets.filter(f => f === best.rootFret).length >= 2 ? best.rootFret : null;

    return { frets, baseFret, barre, name: chordName };
  }

  // Generate crisp SVG Guitar Chord Diagram
  function generateChordDiagramSVG(voicing) {
    const { frets, baseFret = 1, barre } = voicing;
    const width = 110;
    const startX = 22;
    const startY = 24;
    const stringGap = 13;
    const fretGap = 17;
    // Show 4 frets, or more when a stretch voicing reaches further
    const relFrets = frets.filter(f => f > 0).map(f => (baseFret === 1 ? f : f - baseFret + 1));
    const totalFrets = Math.max(4, ...relFrets);
    const height = startY + totalFrets * fretGap + 8;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chord-svg" xmlns="http://www.w3.org/2000/svg">`;

    // Nut line (if baseFret == 1) or fret position label
    if (baseFret === 1) {
      svg += `<line x1="${startX - 1}" y1="${startY}" x2="${startX + stringGap * 5 + 1}" y2="${startY}" stroke="#fde68a" stroke-width="4.5" stroke-linecap="round"/>`;
    } else {
      svg += `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * 5}" y2="${startY}" stroke="#94a3b8" stroke-width="1.5"/>`;
      svg += `<text x="6" y="${startY + 13}" fill="#fbbf24" font-size="10" font-weight="800" font-family="monospace">${baseFret}fr</text>`;
    }

    // 5 Horizontal Fret Lines
    for (let f = 1; f <= totalFrets; f++) {
      const y = startY + f * fretGap;
      svg += `<line x1="${startX}" y1="${y}" x2="${startX + stringGap * 5}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>`;
    }

    // 6 Vertical String Lines
    for (let s = 0; s < 6; s++) {
      const x = startX + s * stringGap;
      const strokeW = (s === 0 || s === 1) ? '1.8' : (s >= 4 ? '1.0' : '1.3');
      svg += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + totalFrets * fretGap}" stroke="rgba(255,255,255,0.45)" stroke-width="${strokeW}"/>`;
    }

    // Barre pill if applicable
    if (barre && baseFret > 1) {
      const barreY = startY + (barre - baseFret + 0.5) * fretGap;
      svg += `<rect x="${startX - 2}" y="${barreY - 5}" width="${stringGap * 5 + 4}" height="10" rx="5" fill="#d97706" opacity="0.85"/>`;
    }

    // String Markers (X / O) & Fret Finger Dots
    frets.forEach((fretVal, strIdx) => {
      const x = startX + strIdx * stringGap;

      if (fretVal === -1) {
        // Muted string 'X'
        svg += `<text x="${x}" y="${startY - 8}" fill="#ef4444" font-size="11" font-weight="900" text-anchor="middle" font-family="sans-serif">✕</text>`;
      } else if (fretVal === 0) {
        // Open string 'O'
        svg += `<circle cx="${x}" cy="${startY - 10}" r="4.5" fill="none" stroke="#fbbf24" stroke-width="1.8"/>`;
      } else {
        // Fretted note dot
        const relFret = baseFret === 1 ? fretVal : (fretVal - baseFret + 1);
        if (relFret >= 1 && relFret <= totalFrets) {
          const y = startY + (relFret - 0.5) * fretGap;
          // Highlight root notes or accents
          const isBassString = strIdx === 0 || strIdx === 1;
          const dotFill = isBassString ? '#f59e0b' : '#38bdf8';
          svg += `<circle cx="${x}" cy="${y}" r="5.2" fill="${dotFill}" stroke="#ffffff" stroke-width="1.2"/>`;
        }
      }
    });

    svg += `</svg>`;
    return svg;
  }

  // --- 4. MUSIC THEORY CORE & SCALES ---
  const PITCH_CLASSES = [
    { nameSharp: 'C',  nameFlat: 'C' },
    { nameSharp: 'C#', nameFlat: 'Db' },
    { nameSharp: 'D',  nameFlat: 'D' },
    { nameSharp: 'D#', nameFlat: 'Eb' },
    { nameSharp: 'E',  nameFlat: 'E' },
    { nameSharp: 'F',  nameFlat: 'F' },
    { nameSharp: 'F#', nameFlat: 'Gb' },
    { nameSharp: 'G',  nameFlat: 'G' },
    { nameSharp: 'G#', nameFlat: 'Ab' },
    { nameSharp: 'A',  nameFlat: 'A' },
    { nameSharp: 'A#', nameFlat: 'Bb' },
    { nameSharp: 'B',  nameFlat: 'B' }
  ];

  const NATURAL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PITCHES = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

  const SCALE_TYPES = {
    major: {
      name: 'Major (Ionian)',
      short: 'Major',
      intervals: [0, 2, 4, 5, 7, 9, 11],
      degreeRoman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      degreeRoles: ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading Tone'],
      chordQualities: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
      seventhQualities: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
      vibe: 'Uplifting, resolute, bright, and foundational for pop, folk, country, and rock.'
    },
    minor: {
      name: 'Natural Minor (Aeolian)',
      short: 'Minor',
      intervals: [0, 2, 3, 5, 7, 8, 10],
      degreeRoman: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'],
      degreeRoles: ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Subtonic'],
      chordQualities: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
      seventhQualities: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
      vibe: 'Emotional, moody, introspective, dramatic. The classic guitar ballad sound.'
    },
    dorian: {
      name: 'Dorian',
      short: 'Dorian',
      intervals: [0, 2, 3, 5, 7, 9, 10],
      degreeRoman: ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'],
      degreeRoles: ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Subtonic'],
      chordQualities: ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
      seventhQualities: ['m7', 'm7', 'maj7', '7', 'm7', 'm7b5', 'maj7'],
      vibe: 'Soulful minor with a bright, lifted 6th. Santana, Pink Floyd, funk, and blues grooves.'
    },
    mixolydian: {
      name: 'Mixolydian',
      short: 'Mixolydian',
      intervals: [0, 2, 4, 5, 7, 9, 10],
      degreeRoman: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', '♭VII'],
      degreeRoles: ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Subtonic'],
      chordQualities: ['maj', 'min', 'dim', 'maj', 'min', 'min', 'maj'],
      seventhQualities: ['7', 'm7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7'],
      vibe: 'Classic rock swagger (Grateful Dead, AC/DC, Lynyrd Skynyrd). Lowers the 7th for jam vibes.'
    },
    harmonic_minor: {
      name: 'Harmonic Minor',
      short: 'Harmonic Min',
      intervals: [0, 2, 3, 5, 7, 8, 11],
      degreeRoman: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'],
      degreeRoles: ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading Tone'],
      chordQualities: ['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'],
      seventhQualities: ['m(maj7)', 'm7b5', 'maj7#5', 'm7', '7', 'maj7', 'dim7'],
      vibe: 'Spanish guitar flair, dramatic neoclassical tension with major V7 resolving to minor i.'
    }
  };

  function spellNote(pitchClass, targetLetter = null, preference = 'auto') {
    pitchClass = (pitchClass % 12 + 12) % 12;

    if (targetLetter) {
      const basePitch = LETTER_PITCHES[targetLetter];
      let diff = pitchClass - basePitch;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;

      if (diff === 0) return targetLetter;
      if (diff === 1) return targetLetter + '#';
      if (diff === 2) return targetLetter + '##';
      if (diff === -1) return targetLetter + 'b';
      if (diff === -2) return targetLetter + 'bb';
    }

    const info = PITCH_CLASSES[pitchClass];
    if (preference === 'flats') return info.nameFlat;
    if (preference === 'sharps') return info.nameSharp;
    return [1, 3, 6, 8, 10].includes(pitchClass) ? info.nameFlat : info.nameSharp;
  }

  function getNaturalKeyPreference(rootPitch) {
    if ([5, 10, 3, 8, 1].includes(rootPitch)) return 'flats';
    if ([7, 2, 9, 4, 11, 6].includes(rootPitch)) return 'sharps';
    return 'sharps';
  }

  function getDiatonicScaleSpelling(rootPitch, scaleKey, accidentalPref = 'auto') {
    const scale = SCALE_TYPES[scaleKey] || SCALE_TYPES.major;
    const pref = accidentalPref === 'auto' ? getNaturalKeyPreference(rootPitch) : accidentalPref;

    let rootName = spellNote(rootPitch, null, pref);
    let rootLetter = rootName[0];
    let startIdx = NATURAL_LETTERS.indexOf(rootLetter);

    const spelledNotes = [];
    const pitchClasses = [];

    scale.intervals.forEach((step, idx) => {
      const pc = (rootPitch + step) % 12;
      pitchClasses.push(pc);
      const letter = NATURAL_LETTERS[(startIdx + idx) % 7];
      spelledNotes.push(spellNote(pc, letter, pref));
    });

    return { spelledNotes, pitchClasses, pref };
  }

  // --- 5. CAPO CALCULATOR & RECOMMENDATIONS ---
  // Returns recommended capo fret & play shapes for any given key
  function getCapoRecommendations(rootPitch, scaleKey) {
    const suggestions = [];
    if (scaleKey === 'major') {
      // Easy open shapes: C(0), G(7), D(2), A(9), E(4)
      const easyRoots = [
        { name: 'C', pitch: 0 },
        { name: 'G', pitch: 7 },
        { name: 'D', pitch: 2 },
        { name: 'A', pitch: 9 },
        { name: 'E', pitch: 4 }
      ];

      easyRoots.forEach(shape => {
        let fret = (rootPitch - shape.pitch + 12) % 12;
        if (fret > 0 && fret <= 7) {
          suggestions.push({
            fret: fret,
            shapeName: shape.name,
            desc: `Capo Fret ${fret} (Play "${shape.name}" open chord shapes)`
          });
        }
      });
    }
    return suggestions.sort((a, b) => a.fret - b.fret);
  }

  // --- 6. APPLICATION STATE & SONG DATA MODEL ---
  const state = {
    rootPitch: 0, // C = 0
    scaleKey: 'major',
    accidentalPref: 'auto',
    capoFret: 0, // 0 = No Capo
    currentTuningKey: 'standard',
    fretboardDisplayMode: 'notes', // 'notes' or 'degrees'
    pentatonicBoxFilter: 'all', // 'all', '1', '2', '3', '4', '5'
    showSevenths: false,
    currentView: 'arranger', // 'arranger' or 'sheet'
    bpm: 95,

    // Playback state
    isPlaying: false, // true if either section or full song is playing
    playbackMode: 'section', // 'section' or 'full_song'
    playbackTimer: null,
    currentChordIndex: -1,
    fullSongSectionIndex: 0,

    // Song Data Model
    song: {
      title: 'My Acoustic Song',
      activeSectionId: 'verse_1',
      sections: []
    }
  };

  // DOM Elements
  const DOM = {
    rootSelect: document.getElementById('rootSelect'),
    scaleSelect: document.getElementById('scaleSelect'),
    capoSelect: document.getElementById('capoSelect'),
    tuningSelect: document.getElementById('tuningSelect'),
    accidentalBtns: document.querySelectorAll('.segment-btn[data-acc]'),
    quickKeyBtns: document.getElementById('quickKeyBtns'),
    toggleSevenths: document.getElementById('toggleSevenths'),

    heroKeyTitle: document.getElementById('heroKeyTitle'),
    heroSubtitle: document.getElementById('heroSubtitle'),
    heroNotes: document.getElementById('heroNotes'),
    heroRelKey: document.getElementById('heroRelKey'),
    heroMood: document.getElementById('heroMood'),
    capoTipBanner: document.getElementById('capoTipBanner'),
    capoTipText: document.getElementById('capoTipText'),

    chordGrid: document.getElementById('chordGrid'),
    scalesGrid: document.getElementById('scalesGrid'),
    flavorGrid: document.getElementById('flavorGrid'),
    guitarFretboard: document.getElementById('guitarFretboard'),
    fretDisplayModeSelect: document.getElementById('fretDisplayModeSelect'),
    pentatonicBoxSelect: document.getElementById('pentatonicBoxSelect'),

    // Song Arranger & Studio Elements
    songTitleInput: document.getElementById('songTitleInput'),
    songStructureSelect: document.getElementById('songStructureSelect'),
    btnViewArranger: document.getElementById('btnViewArranger'),
    btnViewSheet: document.getElementById('btnViewSheet'),
    visualArrangerView: document.getElementById('visualArrangerView'),
    songSheetView: document.getElementById('songSheetView'),
    songSheetContainer: document.getElementById('songSheetContainer'),
    sectionTabsStrip: document.getElementById('sectionTabsStrip'),
    activeSectionHint: document.getElementById('activeSectionHint'),
    sectionNameInput: document.getElementById('sectionNameInput'),
    btnDupSection: document.getElementById('btnDupSection'),
    btnMoveLeft: document.getElementById('btnMoveLeft'),
    btnMoveRight: document.getElementById('btnMoveRight'),
    btnDeleteSection: document.getElementById('btnDeleteSection'),
    progressionStrip: document.getElementById('progressionStrip'),
    btnPlayProgression: document.getElementById('btnPlayProgression'),
    btnPlayFullSong: document.getElementById('btnPlayFullSong'),
    bpmSlider: document.getElementById('bpmSlider'),
    bpmValue: document.getElementById('bpmValue'),
    btnClearProg: document.getElementById('btnClearProg'),
    btnCopyProg: document.getElementById('btnCopyProg'),
    btnTransposeUp: document.getElementById('btnTransposeUp'),
    btnTransposeDown: document.getElementById('btnTransposeDown'),
    targetSectionSelect: document.getElementById('targetSectionSelect'),

    btnCopySongSheet: document.getElementById('btnCopySongSheet'),
    btnExportSongJson: document.getElementById('btnExportSongJson'),
    importSongFileInput: document.getElementById('importSongFileInput'),

    btnMute: document.getElementById('btnMute'),
    toast: document.getElementById('toast')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => DOM.toast.classList.remove('show'), 2400);
  }

  // --- 7. SONG DATA HELPERS & LOCAL STORAGE ---
  function getActiveSection() {
    const s = state.song.sections.find(sec => sec.id === state.song.activeSectionId);
    return s || state.song.sections[0] || null;
  }

  function setActiveSection(id) {
    state.song.activeSectionId = id;
    const sec = getActiveSection();
    if (!sec) return;

    if (DOM.sectionNameInput) DOM.sectionNameInput.value = sec.name;
    if (DOM.activeSectionHint) DOM.activeSectionHint.textContent = `Editing: ${sec.name}`;
    if (DOM.targetSectionSelect) DOM.targetSectionSelect.value = sec.id;

    renderSectionTabs();
    renderProgressionStrip();
    saveSongToLocalStorage();
  }

  function createProgressionItem(rootPitch, name, roman, intervals) {
    const voicing = getGuitarVoicing(name, rootPitch);
    return {
      name,
      roman,
      rootPitch,
      intervals,
      voicing,
      tabStr: formatTabFrets(voicing.frets)
    };
  }

  function formatTabFrets(frets) {
    return frets.map(f => (f === -1 ? 'x' : f)).join(' ');
  }

  // Rebuild a song loaded from storage or a file, keeping only well-formed fields
  function normalizeLoadedSong(raw) {
    if (!raw || !Array.isArray(raw.sections)) return null;
    const isValidFrets = (frets) => Array.isArray(frets) && frets.length === 6 &&
      frets.every(f => Number.isInteger(f) && f >= -1 && f <= 24);

    const sections = raw.sections
      .filter(sec => sec && typeof sec === 'object')
      .map((sec, idx) => {
        const chords = (Array.isArray(sec.chords) ? sec.chords : [])
          .filter(c => c && typeof c.name === 'string' && c.voicing && isValidFrets(c.voicing.frets))
          .map(c => {
            const baseFret = Number.isInteger(c.voicing.baseFret) && c.voicing.baseFret > 0 ? c.voicing.baseFret : 1;
            const barre = Number.isInteger(c.voicing.barre) ? c.voicing.barre : null;
            const voicing = { frets: c.voicing.frets.slice(), baseFret, barre, name: c.name };
            return {
              name: c.name,
              roman: typeof c.roman === 'string' ? c.roman : '',
              rootPitch: Number.isInteger(c.rootPitch) ? ((c.rootPitch % 12) + 12) % 12 : 0,
              voicing,
              tabStr: formatTabFrets(voicing.frets)
            };
          });
        return {
          id: typeof sec.id === 'string' && sec.id ? sec.id : `sec_${Date.now()}_${idx}`,
          name: typeof sec.name === 'string' && sec.name ? sec.name : `Section ${idx + 1}`,
          chords,
          lyrics: typeof sec.lyrics === 'string' ? sec.lyrics : ''
        };
      });

    if (sections.length === 0) return null;
    const activeSectionId = sections.some(sec => sec.id === raw.activeSectionId) ? raw.activeSectionId : sections[0].id;
    return {
      title: typeof raw.title === 'string' && raw.title ? raw.title : 'My Acoustic Song',
      activeSectionId,
      sections
    };
  }

  function saveSongToLocalStorage() {
    try {
      localStorage.setItem('guitar_song_helper_data', JSON.stringify({
        title: state.song.title,
        activeSectionId: state.song.activeSectionId,
        sections: state.song.sections,
        bpm: state.bpm,
        rootPitch: state.rootPitch,
        scaleKey: state.scaleKey,
        capoFret: state.capoFret
      }));
    } catch (e) {
      // LocalStorage unavailable or full
    }
  }

  function loadSongFromLocalStorage() {
    try {
      const data = localStorage.getItem('guitar_song_helper_data');
      if (data) {
        const parsed = JSON.parse(data);
        const song = normalizeLoadedSong(parsed);
        if (song) {
          state.song = song;
          if (Number.isInteger(parsed.bpm) && parsed.bpm >= 60 && parsed.bpm <= 180) state.bpm = parsed.bpm;
          if (Number.isInteger(parsed.rootPitch) && parsed.rootPitch >= 0 && parsed.rootPitch <= 11) state.rootPitch = parsed.rootPitch;
          if (SCALE_TYPES[parsed.scaleKey]) state.scaleKey = parsed.scaleKey;
          if (Number.isInteger(parsed.capoFret) && parsed.capoFret >= 0 && parsed.capoFret <= 7) state.capoFret = parsed.capoFret;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function initDefaultSongStructure() {
    const { spelledNotes, pitchClasses } = getDiatonicScaleSpelling(state.rootPitch, state.scaleKey);
    const getDeg = (degree1Index, isSeventh = false) => {
      const idx = degree1Index - 1;
      const p = pitchClasses[idx];
      const scale = SCALE_TYPES[state.scaleKey];
      const nameRoot = spelledNotes[idx];
      const quality = scale.chordQualities[idx];
      const roman = scale.degreeRoman[idx];
      let fullName = nameRoot;
      if (quality === 'min') fullName += 'm';
      else if (quality === 'dim') fullName += 'dim';
      if (isSeventh) fullName += scale.seventhQualities[idx];
      return createProgressionItem(p, fullName, roman, [0, 4, 7]);
    };

    // Intro, Verse 1, Chorus, Bridge, Outro
    const introChords = [getDeg(1), getDeg(4)];
    const verseChords = [getDeg(1), getDeg(5), getDeg(6), getDeg(4)];
    const chorusChords = [getDeg(4), getDeg(5), getDeg(1), getDeg(6)];
    
    // Bridge with a borrowed chord
    const bVI_pitch = (state.rootPitch + 8) % 12;
    const bVI_name = spellNote(bVI_pitch);
    const bVI_item = createProgressionItem(bVI_pitch, bVI_name, '♭VI', [0, 4, 7]);
    const bridgeChords = [bVI_item, getDeg(4), getDeg(5), getDeg(1)];
    const outroChords = [getDeg(4), getDeg(1)];

    state.song.title = 'My Acoustic Song';
    state.song.sections = [
      { id: 'intro', name: 'Intro', chords: introChords, lyrics: '' },
      { id: 'verse_1', name: 'Verse 1', chords: verseChords, lyrics: 'Walking down this open road\nCarrying an acoustic load\nLooking for the melodies that linger in the air' },
      { id: 'chorus', name: 'Chorus', chords: chorusChords, lyrics: 'Sing it out into the night\nEvery chord is feeling right\nLet the acoustic rhythm fly' },
      { id: 'bridge', name: 'Bridge', chords: bridgeChords, lyrics: 'When the shadows start to grow\nThat is when the colors show' },
      { id: 'outro', name: 'Outro', chords: outroChords, lyrics: 'Fade away into the dawn...' }
    ];
    state.song.activeSectionId = 'verse_1';
  }

  // --- 8. INITIALIZATION & CONTROLLERS ---
  function init() {
    setupEventListeners();
    renderQuickKeyBar();

    const loaded = loadSongFromLocalStorage();
    if (!loaded) {
      initDefaultSongStructure();
    }

    if (DOM.songTitleInput) DOM.songTitleInput.value = state.song.title;
    if (DOM.bpmSlider) DOM.bpmSlider.value = state.bpm;
    if (DOM.bpmValue) DOM.bpmValue.textContent = `${state.bpm} BPM`;
    if (DOM.capoSelect) DOM.capoSelect.value = state.capoFret;
    if (DOM.rootSelect) DOM.rootSelect.value = state.rootPitch;
    if (DOM.scaleSelect) DOM.scaleSelect.value = state.scaleKey;

    updateAll();
  }

  function renderQuickKeyBar() {
    DOM.quickKeyBtns.innerHTML = '';
    const roots = [
      { name: 'C', pitch: 0 },
      { name: 'C♯/D♭', pitch: 1 },
      { name: 'D', pitch: 2 },
      { name: 'D♯/E♭', pitch: 3 },
      { name: 'E', pitch: 4 },
      { name: 'F', pitch: 5 },
      { name: 'F♯/G♭', pitch: 6 },
      { name: 'G', pitch: 7 },
      { name: 'G♯/A♭', pitch: 8 },
      { name: 'A', pitch: 9 },
      { name: 'A♯/B♭', pitch: 10 },
      { name: 'B', pitch: 11 }
    ];

    roots.forEach(r => {
      const btn = document.createElement('button');
      btn.className = `key-pill-btn ${r.pitch === state.rootPitch ? 'active' : ''}`;
      btn.textContent = r.name;
      btn.addEventListener('click', () => {
        state.rootPitch = r.pitch;
        DOM.rootSelect.value = r.pitch;
        updateAll();
      });
      DOM.quickKeyBtns.appendChild(btn);
    });
  }

  function setupEventListeners() {
    DOM.rootSelect.addEventListener('change', (e) => {
      state.rootPitch = parseInt(e.target.value, 10);
      updateAll();
    });

    DOM.scaleSelect.addEventListener('change', (e) => {
      state.scaleKey = e.target.value;
      updateAll();
    });

    DOM.capoSelect.addEventListener('change', (e) => {
      state.capoFret = parseInt(e.target.value, 10);
      updateAll();
    });

    DOM.tuningSelect.addEventListener('change', (e) => {
      state.currentTuningKey = e.target.value;
      renderFretboard();
    });

    DOM.fretDisplayModeSelect.addEventListener('change', (e) => {
      state.fretboardDisplayMode = e.target.value;
      renderFretboard();
    });

    DOM.pentatonicBoxSelect.addEventListener('change', (e) => {
      state.pentatonicBoxFilter = e.target.value;
      renderFretboard();
    });

    DOM.accidentalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.accidentalBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.accidentalPref = btn.dataset.acc;
        updateAll();
      });
    });

    DOM.toggleSevenths.addEventListener('change', (e) => {
      state.showSevenths = e.target.checked;
      renderChords();
    });

    // Song Title Input
    DOM.songTitleInput.addEventListener('input', (e) => {
      state.song.title = e.target.value || 'Untitled Song';
      saveSongToLocalStorage();
    });

    // Song Structure Presets
    DOM.songStructureSelect.addEventListener('change', (e) => {
      const presetKey = e.target.value;
      // Reset so the same preset can be picked again later
      e.target.value = '';
      if (!presetKey) return;
      const hasWork = state.song.sections.some(sec => sec.chords.length > 0 || (sec.lyrics && sec.lyrics.trim()));
      if (hasWork && !confirm('Loading a song form preset replaces all current sections, chords and lyrics. Continue?')) return;
      stopPlayback();
      loadSongFormPreset(presetKey);
    });

    // View Switcher (Arranger vs Lyrics Sheet)
    DOM.btnViewArranger.addEventListener('click', () => switchSongView('arranger'));
    DOM.btnViewSheet.addEventListener('click', () => switchSongView('sheet'));

    // Section Renaming
    DOM.sectionNameInput.addEventListener('input', (e) => {
      const sec = getActiveSection();
      if (sec) {
        sec.name = e.target.value || 'Section';
        DOM.activeSectionHint.textContent = `Editing: ${sec.name}`;
        renderSectionTabs();
        saveSongToLocalStorage();
      }
    });

    // Section Tools
    DOM.btnDupSection.addEventListener('click', () => {
      const current = getActiveSection();
      if (!current) return;
      const newId = 'sec_' + Date.now();
      const newName = `${current.name} (Copy)`;
      const dupChords = JSON.parse(JSON.stringify(current.chords));
      const currIdx = state.song.sections.findIndex(s => s.id === current.id);
      state.song.sections.splice(currIdx + 1, 0, {
        id: newId,
        name: newName,
        chords: dupChords,
        lyrics: current.lyrics || ''
      });
      setActiveSection(newId);
      showToast(`Duplicated ${current.name}`);
    });

    DOM.btnMoveLeft.addEventListener('click', () => {
      const currIdx = state.song.sections.findIndex(s => s.id === state.song.activeSectionId);
      if (currIdx > 0) {
        const [moved] = state.song.sections.splice(currIdx, 1);
        state.song.sections.splice(currIdx - 1, 0, moved);
        renderSectionTabs();
        saveSongToLocalStorage();
      }
    });

    DOM.btnMoveRight.addEventListener('click', () => {
      const currIdx = state.song.sections.findIndex(s => s.id === state.song.activeSectionId);
      if (currIdx < state.song.sections.length - 1) {
        const [moved] = state.song.sections.splice(currIdx, 1);
        state.song.sections.splice(currIdx + 1, 0, moved);
        renderSectionTabs();
        saveSongToLocalStorage();
      }
    });

    DOM.btnDeleteSection.addEventListener('click', () => {
      if (state.song.sections.length <= 1) {
        return showToast('Your song must have at least one section!');
      }
      const current = getActiveSection();
      const currIdx = state.song.sections.findIndex(s => s.id === current.id);
      state.song.sections.splice(currIdx, 1);
      const nextActive = state.song.sections[Math.max(0, currIdx - 1)];
      setActiveSection(nextActive.id);
      showToast(`Deleted section`);
    });

    // Target Section Select above Chords
    DOM.targetSectionSelect.addEventListener('change', (e) => {
      setActiveSection(e.target.value);
    });

    // Playback Controls
    DOM.btnPlayProgression.addEventListener('click', togglePlaySection);
    DOM.btnPlayFullSong.addEventListener('click', togglePlayFullSong);

    DOM.bpmSlider.addEventListener('input', (e) => {
      state.bpm = parseInt(e.target.value, 10);
      DOM.bpmValue.textContent = `${state.bpm} BPM`;
      saveSongToLocalStorage();
      if (state.isPlaying) restartPlaybackTimer();
    });

    DOM.btnClearProg.addEventListener('click', () => {
      stopPlayback();
      const sec = getActiveSection();
      if (sec) {
        sec.chords = [];
        renderProgressionStrip();
        renderSectionTabs();
        renderSongSheetView();
        saveSongToLocalStorage();
        showToast(`Cleared chords in ${sec.name}`);
      }
    });

    DOM.btnCopyProg.addEventListener('click', () => {
      const sec = getActiveSection();
      if (!sec || sec.chords.length === 0) return showToast('Add chords to this section first!');
      const text = `${sec.name}: ` + sec.chords.map(c => `${c.name} [${c.tabStr}]`).join('  –  ');
      navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied ${sec.name} tabs!`);
      }).catch(() => showToast(text));
    });

    DOM.btnTransposeUp.addEventListener('click', () => transposeActiveSection(1));
    DOM.btnTransposeDown.addEventListener('click', () => transposeActiveSection(-1));

    // Full Song Sheet Exports
    DOM.btnCopySongSheet.addEventListener('click', copyFullSongSheet);
    DOM.btnExportSongJson.addEventListener('click', exportSongAsJson);
    DOM.importSongFileInput.addEventListener('change', importSongFromJson);

    DOM.btnMute.addEventListener('click', () => {
      const muted = audio.toggleMute();
      DOM.btnMute.textContent = muted ? '🔇' : '🔊';
      showToast(muted ? 'Guitar Audio Muted' : 'Guitar Audio Active');
    });
  }

  function switchSongView(view) {
    state.currentView = view;
    if (view === 'arranger') {
      DOM.btnViewArranger.classList.add('active');
      DOM.btnViewSheet.classList.remove('active');
      DOM.visualArrangerView.style.display = 'block';
      DOM.songSheetView.style.display = 'none';
      renderProgressionStrip();
    } else {
      DOM.btnViewArranger.classList.remove('active');
      DOM.btnViewSheet.classList.add('active');
      DOM.visualArrangerView.style.display = 'none';
      DOM.songSheetView.style.display = 'block';
      renderSongSheetView();
    }
  }

  // --- 9. MASTER UPDATE ---
  function updateAll() {
    const pills = DOM.quickKeyBtns.querySelectorAll('.key-pill-btn');
    pills.forEach((p, idx) => p.classList.toggle('active', idx === state.rootPitch));

    const scaleData = SCALE_TYPES[state.scaleKey];
    const { spelledNotes, pitchClasses, pref } = getDiatonicScaleSpelling(state.rootPitch, state.scaleKey, state.accidentalPref);
    const rootName = spelledNotes[0];

    // Hero title & Capo indicator
    if (state.capoFret > 0) {
      DOM.heroKeyTitle.innerHTML = `<span>🎸</span> ${rootName} ${scaleData.short} <span class="capo-chip" style="font-size:0.9rem; margin-left:0.5rem;">Capo Fret ${state.capoFret}</span>`;
    } else {
      DOM.heroKeyTitle.innerHTML = `<span>🎸</span> ${rootName} ${scaleData.short}`;
    }

    DOM.heroSubtitle.textContent = scaleData.vibe;
    DOM.heroNotes.textContent = spelledNotes.join('  •  ');

    // Relative key
    if (state.scaleKey === 'major') {
      const relPitch = (state.rootPitch + 9) % 12;
      const relName = spellNote(relPitch, spelledNotes[5][0], pref);
      DOM.heroRelKey.textContent = `${relName} Minor (vi)`;
    } else if (state.scaleKey === 'minor') {
      const relPitch = (state.rootPitch + 3) % 12;
      const relName = spellNote(relPitch, spelledNotes[2][0], pref);
      DOM.heroRelKey.textContent = `${relName} Major (♭III)`;
    } else {
      DOM.heroRelKey.textContent = 'Modal Tonality';
    }

    DOM.heroMood.textContent = scaleData.degreeRoles[0];

    // Capo Recommendations
    const capoRecs = getCapoRecommendations(state.rootPitch, state.scaleKey);
    if (capoRecs.length > 0 && state.scaleKey === 'major') {
      DOM.capoTipBanner.style.display = 'flex';
      const best = capoRecs[0];
      DOM.capoTipText.innerHTML = `💡 <strong>Acoustic Capo Trick:</strong> Put a capo on <strong>Fret ${best.fret}</strong> to play this key using easy <strong>"${best.shapeName}" open chord shapes</strong>!`;
    } else {
      DOM.capoTipBanner.style.display = 'none';
    }

    // Refresh Subsections
    renderSectionTabs();
    renderChords();
    renderScales(spelledNotes, pitchClasses, pref);
    renderFlavorChords(rootName, state.rootPitch, pref);
    renderFretboard();
    renderProgressionStrip();
    if (state.currentView === 'sheet') renderSongSheetView();
    saveSongToLocalStorage();
  }

  // --- 10. SECTION TABS & TARGET BAR ---
  function renderSectionTabs() {
    DOM.sectionTabsStrip.innerHTML = '';
    DOM.targetSectionSelect.innerHTML = '';

    state.song.sections.forEach((sec, idx) => {
      const isActive = sec.id === state.song.activeSectionId;
      const isPlayingNow = state.isPlaying && state.playbackMode === 'full_song' && state.fullSongSectionIndex === idx;

      // Tab pill in Arranger ribbon
      const pill = document.createElement('button');
      pill.className = `section-tab-pill ${isActive ? 'active' : ''} ${isPlayingNow ? 'playing-now' : ''}`;
      pill.innerHTML = `
        <span>${escapeHtml(sec.name)}</span>
        <span class="section-count-badge">${sec.chords.length}</span>
      `;
      pill.addEventListener('click', () => setActiveSection(sec.id));
      DOM.sectionTabsStrip.appendChild(pill);

      // Option in Target Section select above Chords
      const opt = document.createElement('option');
      opt.value = sec.id;
      opt.textContent = `${sec.name} (${sec.chords.length} chords)`;
      opt.selected = isActive;
      DOM.targetSectionSelect.appendChild(opt);
    });

    // Add Section button
    const btnAdd = document.createElement('button');
    btnAdd.className = 'add-section-btn';
    btnAdd.innerHTML = `<span>+</span> Add Section`;
    btnAdd.addEventListener('click', promptAddNewSection);
    DOM.sectionTabsStrip.appendChild(btnAdd);

    const activeSec = getActiveSection();
    if (activeSec) {
      if (DOM.sectionNameInput) DOM.sectionNameInput.value = activeSec.name;
      if (DOM.activeSectionHint) DOM.activeSectionHint.textContent = `Editing: ${activeSec.name}`;
    }
  }

  function promptAddNewSection() {
    const defaultNames = ['Verse 2', 'Chorus 2', 'Bridge', 'Pre-Chorus', 'Solo', 'Outro', 'Intro'];
    const existingNames = state.song.sections.map(s => s.name);
    const suggested = defaultNames.find(n => !existingNames.includes(n)) || `Section ${state.song.sections.length + 1}`;
    
    const name = prompt('Enter a name for the new section (e.g. Verse 2, Bridge, Solo):', suggested);
    if (name && name.trim()) {
      const newId = 'sec_' + Date.now();
      state.song.sections.push({
        id: newId,
        name: name.trim(),
        chords: [],
        lyrics: ''
      });
      setActiveSection(newId);
      showToast(`Created section: ${name.trim()}`);
    }
  }

  // --- 11. PROGRESSION STRIP (ACTIVE SECTION) ---
  function renderProgressionStrip() {
    DOM.progressionStrip.innerHTML = '';
    const sec = getActiveSection();
    if (!sec || sec.chords.length === 0) {
      DOM.progressionStrip.innerHTML = `
        <div class="progression-placeholder">
          <strong>${escapeHtml(sec ? sec.name : 'Section')}</strong> has no chords yet. Click <strong>+</strong> on any chord box below to add chords to this section!
        </div>
      `;
      return;
    }

    sec.chords.forEach((chord, idx) => {
      const isCurrentStep = state.isPlaying && (
        (state.playbackMode === 'section' && state.currentChordIndex === idx) ||
        (state.playbackMode === 'full_song' && state.song.sections[state.fullSongSectionIndex]?.id === sec.id && state.currentChordIndex === idx)
      );

      const item = document.createElement('div');
      item.className = `prog-chord-item ${isCurrentStep ? 'active-step' : ''}`;
      item.draggable = true;
      item.dataset.index = idx;

      item.innerHTML = `
        <button class="btn-remove-prog-chord" title="Remove chord">✕</button>
        <span class="prog-roman">${escapeHtml(chord.roman)}</span>
        <span class="prog-name">${escapeHtml(chord.name)}</span>
        <div class="prog-mini-diagram">${generateChordDiagramSVG(chord.voicing)}</div>
        <span class="prog-notes">${escapeHtml(chord.tabStr)}</span>
      `;

      item.querySelector('.btn-remove-prog-chord').addEventListener('click', (e) => {
        e.stopPropagation();
        sec.chords.splice(idx, 1);
        renderProgressionStrip();
        renderSectionTabs();
        renderSongSheetView();
        saveSongToLocalStorage();
      });

      item.addEventListener('click', () => {
        audio.strumGuitarChord(chord.voicing.frets, 1.8, 'down', 0.02, getCurrentTuningMidis());
        highlightChordOnFretboard(chord.voicing.frets);
      });

      // Drag and drop reordering inside this section
      item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', idx));
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.style.borderColor = 'var(--guitar-gold)';
      });
      item.addEventListener('dragleave', () => item.style.borderColor = '');
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.style.borderColor = '';
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(fromIdx) && fromIdx !== idx) {
          const [moved] = sec.chords.splice(fromIdx, 1);
          sec.chords.splice(idx, 0, moved);
          renderProgressionStrip();
          renderSongSheetView();
          saveSongToLocalStorage();
        }
      });

      DOM.progressionStrip.appendChild(item);
    });
  }

  // --- 12. FULL SONG SHEET & LYRICS VIEW ---
  function renderSongSheetView() {
    DOM.songSheetContainer.innerHTML = '';

    state.song.sections.forEach((sec) => {
      const card = document.createElement('div');
      card.className = 'sheet-section-card';

      const chordTags = sec.chords.length > 0 ? sec.chords.map(c => `
        <span class="sheet-chord-tag" title="Click to strum ${escapeHtml(c.name)}">
          <span>${escapeHtml(c.name)}</span>
          <span class="sheet-roman">${escapeHtml(c.roman)}</span>
          <span class="sheet-tab">${escapeHtml(c.tabStr)}</span>
        </span>
      `).join('') : '<span style="font-size:0.8rem; color:var(--text-dim); font-style:italic;">No chords added yet</span>';

      card.innerHTML = `
        <div class="sheet-section-header">
          <div class="sheet-section-title">
            <span>🎸</span> ${escapeHtml(sec.name)}
          </div>
          <button class="btn-section-tool btn-edit-this-sec" style="font-size:0.75rem;">Edit Chords in Arranger</button>
        </div>
        <div class="sheet-chord-flow">${chordTags}</div>
        <textarea class="sheet-lyrics-textarea" placeholder="Type lyrics for ${escapeHtml(sec.name)} here..."></textarea>
      `;

      // Jump to editor button
      card.querySelector('.btn-edit-this-sec').addEventListener('click', () => {
        setActiveSection(sec.id);
        switchSongView('arranger');
      });

      // Chord pill strum on click
      card.querySelectorAll('.sheet-chord-tag').forEach((pill, cIdx) => {
        pill.addEventListener('click', () => {
          const chord = sec.chords[cIdx];
          if (chord) {
            audio.strumGuitarChord(chord.voicing.frets, 1.8, 'down', 0.02, getCurrentTuningMidis());
            highlightChordOnFretboard(chord.voicing.frets);
          }
        });
      });

      // Auto-save lyrics input
      const textarea = card.querySelector('.sheet-lyrics-textarea');
      textarea.value = sec.lyrics || '';
      textarea.addEventListener('input', (e) => {
        sec.lyrics = e.target.value;
        saveSongToLocalStorage();
      });

      DOM.songSheetContainer.appendChild(card);
    });
  }

  // Copy Full Song Sheet Formatted Text
  function copyFullSongSheet() {
    const scale = SCALE_TYPES[state.scaleKey];
    const rootName = spellNote(state.rootPitch);
    let output = `=====================================================\n`;
    output += `SONG: ${state.song.title.toUpperCase()}\n`;
    output += `Key: ${rootName} ${scale.short} | Capo: ${state.capoFret > 0 ? `Fret ${state.capoFret}` : 'No Capo'} | Tempo: ${state.bpm} BPM\n`;
    output += `=====================================================\n\n`;

    state.song.sections.forEach(sec => {
      output += `[${sec.name}]\n`;
      if (sec.chords.length > 0) {
        output += `Chords: ` + sec.chords.map(c => c.name).join('   ') + `\n`;
        output += `Tabs:   ` + sec.chords.map(c => `[${c.tabStr}]`).join(' ') + `\n`;
      }
      if (sec.lyrics && sec.lyrics.trim()) {
        output += sec.lyrics.trim() + `\n`;
      }
      output += `\n`;
    });

    navigator.clipboard.writeText(output).then(() => {
      showToast('Copied complete Song Lyrics & Chords Sheet!');
    }).catch(() => showToast('Song Sheet copied!'));
  }

  function exportSongAsJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.song, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    const safeTitle = state.song.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    dlAnchor.setAttribute("download", `${safeTitle}.json`);
    dlAnchor.click();
    showToast('Exported song backup JSON file!');
  }

  function importSongFromJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const song = normalizeLoadedSong(JSON.parse(evt.target.result));
        if (song) {
          stopPlayback();
          state.song = song;
          if (DOM.songTitleInput) DOM.songTitleInput.value = state.song.title;
          setActiveSection(state.song.sections[0].id);
          updateAll();
          showToast(`Loaded song: "${state.song.title}"`);
        } else {
          showToast('Invalid song file format');
        }
      } catch (err) {
        showToast('Error reading song file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- 13. PLAYBACK ENGINES (SECTION LOOP vs FULL SONG) ---
  function togglePlaySection() {
    if (state.isPlaying && state.playbackMode === 'section') {
      stopPlayback();
    } else {
      stopPlayback();
      startPlaySection();
    }
  }

  function startPlaySection() {
    const sec = getActiveSection();
    if (!sec || sec.chords.length === 0) return showToast('Add chords to this section first!');
    audio.init();
    state.isPlaying = true;
    state.playbackMode = 'section';
    state.currentChordIndex = -1;
    DOM.btnPlayProgression.classList.add('playing');
    DOM.btnPlayProgression.innerHTML = '<span>⏹</span> Stop Strumming';
    stepPlayback();
    restartPlaybackTimer();
  }

  function togglePlayFullSong() {
    if (state.isPlaying && state.playbackMode === 'full_song') {
      stopPlayback();
    } else {
      stopPlayback();
      startPlayFullSong();
    }
  }

  function startPlayFullSong() {
    // Check if song has any chords
    const totalChords = state.song.sections.reduce((acc, s) => acc + s.chords.length, 0);
    if (totalChords === 0) return showToast('Add chords to your song first!');
    audio.init();
    state.isPlaying = true;
    state.playbackMode = 'full_song';
    state.fullSongSectionIndex = 0;
    state.currentChordIndex = -1;
    DOM.btnPlayFullSong.classList.add('playing');
    DOM.btnPlayFullSong.innerHTML = '<span>⏹</span> Stop Song';
    stepPlayback();
    restartPlaybackTimer();
  }

  function stopPlayback() {
    state.isPlaying = false;
    clearTimeout(state.playbackTimer);
    state.currentChordIndex = -1;
    state.fullSongSectionIndex = 0;
    DOM.btnPlayProgression.classList.remove('playing');
    DOM.btnPlayProgression.innerHTML = '<span>🎸</span> Loop Section';
    DOM.btnPlayFullSong.classList.remove('playing');
    DOM.btnPlayFullSong.innerHTML = '<span>▶▶</span> Play Full Song';
    clearFretboardChordHighlights();
    renderSectionTabs();
    renderProgressionStrip();
  }

  function restartPlaybackTimer() {
    clearTimeout(state.playbackTimer);
    if (!state.isPlaying) return;
    const intervalMs = (60 / state.bpm) * 2000; // 2 beats per chord
    state.playbackTimer = setInterval(stepPlayback, intervalMs);
  }

  function stepPlayback() {
    if (!state.isPlaying) return;

    if (state.playbackMode === 'section') {
      const sec = getActiveSection();
      if (!sec || sec.chords.length === 0) return stopPlayback();
      state.currentChordIndex = (state.currentChordIndex + 1) % sec.chords.length;

      const chord = sec.chords[state.currentChordIndex];
      const direction = state.currentChordIndex % 2 === 0 ? 'down' : 'up';
      audio.strumGuitarChord(chord.voicing.frets, 1.8, direction, 0.018, getCurrentTuningMidis());
      highlightChordOnFretboard(chord.voicing.frets);
      renderProgressionStrip();
    } else {
      // Full Song Playback: advance to the next chord, skipping any empty sections
      const sections = state.song.sections;
      let sectionIdx = state.fullSongSectionIndex;
      let chordIdx = state.currentChordIndex + 1;
      while (sectionIdx < sections.length && chordIdx >= sections[sectionIdx].chords.length) {
        sectionIdx++;
        chordIdx = 0;
      }

      if (sectionIdx >= sections.length) {
        stopPlayback();
        showToast('Finished full song playback!');
        return;
      }

      const sec = sections[sectionIdx];
      state.fullSongSectionIndex = sectionIdx;
      state.currentChordIndex = chordIdx;
      // Follow along in the arranger view
      if (sec.id !== state.song.activeSectionId) setActiveSection(sec.id);

      const chord = sec.chords[state.currentChordIndex];
      const direction = state.currentChordIndex % 2 === 0 ? 'down' : 'up';
      audio.strumGuitarChord(chord.voicing.frets, 1.8, direction, 0.018, getCurrentTuningMidis());
      highlightChordOnFretboard(chord.voicing.frets);
      renderSectionTabs();
      renderProgressionStrip();
    }
  }

  function transposeActiveSection(semitones) {
    const sec = getActiveSection();
    if (!sec || sec.chords.length === 0) return;
    sec.chords.forEach(c => {
      c.rootPitch = (c.rootPitch + semitones + 12) % 12;
      const rootStr = spellNote(c.rootPitch);
      const suffix = parseChordName(c.name).suffix;
      c.name = rootStr + suffix;
      c.voicing = getGuitarVoicing(c.name, c.rootPitch);
      c.tabStr = formatTabFrets(c.voicing.frets);
    });
    renderProgressionStrip();
    renderSongSheetView();
    saveSongToLocalStorage();
    showToast(`Transposed ${sec.name} ${semitones > 0 ? '+1' : '-1'} semitone`);
  }

  // Load Popular Multi-Section Song Forms
  function loadSongFormPreset(presetKey) {
    if (!presetKey) return;
    const { spelledNotes, pitchClasses } = getDiatonicScaleSpelling(state.rootPitch, state.scaleKey);
    const getDeg = (deg) => {
      const idx = deg - 1;
      const p = pitchClasses[idx];
      const scale = SCALE_TYPES[state.scaleKey];
      const name = spelledNotes[idx] + (scale.chordQualities[idx] === 'min' ? 'm' : (scale.chordQualities[idx] === 'dim' ? 'dim' : ''));
      return createProgressionItem(p, name, scale.degreeRoman[idx], [0, 4, 7]);
    };

    const bVI_pitch = (state.rootPitch + 8) % 12;
    const bVI_name = spellNote(bVI_pitch);
    const bVI_chord = createProgressionItem(bVI_pitch, bVI_name, '♭VI', [0, 4, 7]);

    const bVII_pitch = (state.rootPitch + 10) % 12;
    const bVII_name = spellNote(bVII_pitch);
    const bVII_chord = createProgressionItem(bVII_pitch, bVII_name, '♭VII', [0, 4, 7]);

    if (presetKey === 'pop_rock_full') {
      state.song.sections = [
        { id: 'intro', name: 'Intro', chords: [getDeg(1), getDeg(4)], lyrics: '' },
        { id: 'verse_1', name: 'Verse 1', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' },
        { id: 'pre_ch', name: 'Pre-Chorus', chords: [getDeg(2), getDeg(4), getDeg(5), getDeg(5)], lyrics: '' },
        { id: 'chorus_1', name: 'Chorus', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' },
        { id: 'verse_2', name: 'Verse 2', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' },
        { id: 'bridge', name: 'Bridge', chords: [bVI_chord, bVII_chord, getDeg(1), getDeg(1)], lyrics: '' },
        { id: 'chorus_2', name: 'Final Chorus', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' },
        { id: 'outro', name: 'Outro', chords: [getDeg(4), getDeg(1)], lyrics: '' }
      ];
    } else if (presetKey === 'singer_songwriter_full') {
      state.song.sections = [
        { id: 'intro', name: 'Intro', chords: [getDeg(1), getDeg(1)], lyrics: '' },
        { id: 'verse_1', name: 'Verse 1', chords: [getDeg(1), getDeg(4), getDeg(6), getDeg(5)], lyrics: '' },
        { id: 'chorus_1', name: 'Chorus', chords: [getDeg(4), getDeg(5), getDeg(1), getDeg(6)], lyrics: '' },
        { id: 'verse_2', name: 'Verse 2', chords: [getDeg(1), getDeg(4), getDeg(6), getDeg(5)], lyrics: '' },
        { id: 'bridge', name: 'Bridge', chords: [getDeg(6), getDeg(4), getDeg(1), getDeg(5)], lyrics: '' },
        { id: 'outro', name: 'Outro', chords: [getDeg(1), getDeg(4), getDeg(1)], lyrics: '' }
      ];
    } else if (presetKey === 'folk_storyteller') {
      state.song.sections = [
        { id: 'verse_1', name: 'Verse 1', chords: [getDeg(1), getDeg(4), getDeg(1), getDeg(5)], lyrics: '' },
        { id: 'verse_2', name: 'Verse 2', chords: [getDeg(1), getDeg(4), getDeg(1), getDeg(5)], lyrics: '' },
        { id: 'chorus_1', name: 'Chorus', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' },
        { id: 'verse_3', name: 'Verse 3', chords: [getDeg(1), getDeg(4), getDeg(1), getDeg(5)], lyrics: '' },
        { id: 'outro', name: 'Outro', chords: [getDeg(1), getDeg(5), getDeg(1)], lyrics: '' }
      ];
    } else if (presetKey === 'quick_jam') {
      state.song.sections = [
        { id: 'verse', name: 'Verse', chords: [getDeg(1), getDeg(4)], lyrics: '' },
        { id: 'chorus', name: 'Chorus', chords: [getDeg(1), getDeg(5), getDeg(6), getDeg(4)], lyrics: '' }
      ];
    }

    state.song.activeSectionId = state.song.sections[0].id;
    updateAll();
    showToast(`Loaded ${presetKey.replace(/_/g, ' ')} template!`);
  }

  // --- 14. ADDING CHORDS TO ACTIVE SECTION ---
  function addChordToProgression(item) {
    const sec = getActiveSection();
    if (!sec) return;
    sec.chords.push(item);
    renderSectionTabs();
    renderProgressionStrip();
    if (state.currentView === 'sheet') renderSongSheetView();
    saveSongToLocalStorage();
    showToast(`Added ${item.name} to ${sec.name}`);
  }

  // --- 15. RENDER DIATONIC GUITAR CHORDS ---
  function renderChords() {
    DOM.chordGrid.innerHTML = '';
    const scale = SCALE_TYPES[state.scaleKey];
    const { spelledNotes, pitchClasses } = getDiatonicScaleSpelling(state.rootPitch, state.scaleKey, state.accidentalPref);

    scale.intervals.forEach((step, idx) => {
      const rootNoteName = spelledNotes[idx];
      const chordRootPitch = pitchClasses[idx];
      const roman = scale.degreeRoman[idx];
      const role = scale.degreeRoles[idx];

      const triadQuality = scale.chordQualities[idx];
      const seventhQuality = scale.seventhQualities[idx];

      let chordDisplayName = '';
      let seventhSuffix = '';

      if (!state.showSevenths) {
        if (triadQuality === 'maj') chordDisplayName = rootNoteName;
        else if (triadQuality === 'min') chordDisplayName = `${rootNoteName}m`;
        else if (triadQuality === 'dim') chordDisplayName = `${rootNoteName}dim`;
        else if (triadQuality === 'aug') chordDisplayName = `${rootNoteName}aug`;
      } else {
        if (seventhQuality === 'maj7') {
          chordDisplayName = rootNoteName;
          seventhSuffix = 'maj7';
        } else if (seventhQuality === 'm7') {
          chordDisplayName = `${rootNoteName}m`;
          seventhSuffix = '7';
        } else if (seventhQuality === '7') {
          chordDisplayName = rootNoteName;
          seventhSuffix = '7';
        } else if (seventhQuality === 'm7b5') {
          chordDisplayName = rootNoteName;
          seventhSuffix = 'm7♭5';
        } else {
          chordDisplayName = rootNoteName;
          seventhSuffix = seventhQuality;
        }
      }

      const fullChordName = chordDisplayName + seventhSuffix;
      const voicing = getGuitarVoicing(fullChordName, chordRootPitch);

      let category = 'subdominant';
      if (idx === 0) category = 'tonic';
      else if (idx === 4) category = 'dominant';
      else if (triadQuality === 'dim') category = 'diminished';
      else if (idx === 5 && state.scaleKey === 'major') category = 'tonic';

      let capoShapeText = '';
      if (state.capoFret > 0) {
        const capoShapePitch = (chordRootPitch - state.capoFret + 12) % 12;
        const shapeRoot = spellNote(capoShapePitch);
        const shapeQuality = triadQuality === 'min' ? 'm' : (triadQuality === 'dim' ? 'dim' : '');
        capoShapeText = `<span class="capo-grip-hint" title="Finger shape relative to capo">Play "${shapeRoot}${shapeQuality}" shape</span>`;
      }

      const card = document.createElement('div');
      card.className = `chord-card ${category}`;
      card.innerHTML = `
        <div class="chord-card-header">
          <span class="roman-badge">${roman}</span>
          <span class="role-tag">${role}</span>
        </div>
        <div class="chord-title-row">
          <div class="chord-name">
            <span>${chordDisplayName}</span><span class="chord-seventh">${seventhSuffix}</span>
          </div>
          ${capoShapeText}
        </div>
        <div class="chord-box-wrap" title="Click to strum guitar chord">
          ${generateChordDiagramSVG(voicing)}
          <div class="chord-tab-snippet">${formatTabFrets(voicing.frets)}</div>
        </div>
        <div class="chord-actions">
          <button class="btn-play-chord" title="Strum acoustic guitar">
            <span>🎸</span> Strum
          </button>
          <button class="btn-add-progression" title="Add to current section">+</button>
        </div>
        <button class="btn-variations-toggle">
          <span>Acoustic Variations</span>
          <span class="toggle-icon">▾</span>
        </button>
        <div class="variations-panel">
          <div class="variation-tag-group">
            ${getGuitarVariationChips(rootNoteName, chordRootPitch, triadQuality)}
          </div>
          <div class="typical-moves">
            <strong>Typical Moves:</strong> ${getTypicalMoves(idx, scale.degreeRoman)}
          </div>
        </div>
      `;

      const playAction = (e) => {
        if (e) e.stopPropagation();
        audio.strumGuitarChord(voicing.frets, 1.8, 'down', 0.02, getCurrentTuningMidis());
        highlightChordOnFretboard(voicing.frets);
      };

      card.querySelector('.chord-box-wrap').addEventListener('click', playAction);
      card.querySelector('.btn-play-chord').addEventListener('click', playAction);

      card.querySelector('.btn-add-progression').addEventListener('click', (e) => {
        e.stopPropagation();
        addChordToProgression(createProgressionItem(chordRootPitch, fullChordName, roman, [0, 4, 7]));
      });

      const btnToggle = card.querySelector('.btn-variations-toggle');
      const panel = card.querySelector('.variations-panel');
      const icon = card.querySelector('.toggle-icon');
      btnToggle.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        icon.textContent = isOpen ? '▴' : '▾';
      });

      card.querySelectorAll('.chord-variation-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const varName = chip.dataset.name;
          const varVoicing = getGuitarVoicing(varName, chordRootPitch);
          audio.strumGuitarChord(varVoicing.frets, 1.8, 'down', 0.02, getCurrentTuningMidis());
          highlightChordOnFretboard(varVoicing.frets);
          addChordToProgression({
            name: varName,
            roman: roman,
            rootPitch: chordRootPitch,
            voicing: varVoicing,
            tabStr: formatTabFrets(varVoicing.frets)
          });
        });
      });

      card.addEventListener('mouseenter', () => highlightChordOnFretboard(voicing.frets));
      card.addEventListener('mouseleave', () => clearFretboardChordHighlights());

      DOM.chordGrid.appendChild(card);
    });
  }

  function getGuitarVariationChips(rootName, rootPitch, quality) {
    const list = [];
    if (quality === 'maj') {
      list.push(`${rootName}sus2`, `${rootName}sus4`, `${rootName}add9`, `${rootName}6`);
    } else if (quality === 'min') {
      list.push(`${rootName}sus2`, `${rootName}m7`);
    } else if (quality === 'dim') {
      list.push(`${rootName}m7b5`);
    }

    return list.map(name => {
      return `<button class="chord-variation-chip" data-name="${name}">+ ${name}</button>`;
    }).join('');
  }

  function getTypicalMoves(degreeIdx, romanList) {
    if (degreeIdx === 0) return `${romanList[0]} → ${romanList[3]} or ${romanList[4]}`;
    if (degreeIdx === 1) return `${romanList[1]} → ${romanList[4]} → ${romanList[0]} (ii–V–I)`;
    if (degreeIdx === 2) return `${romanList[2]} → ${romanList[5]} or ${romanList[3]}`;
    if (degreeIdx === 3) return `${romanList[3]} → ${romanList[4]} or ${romanList[0]} (Plagal)`;
    if (degreeIdx === 4) return `${romanList[4]} → ${romanList[0]} (Resolution) or → ${romanList[5]} (Deceptive)`;
    if (degreeIdx === 5) return `${romanList[5]} → ${romanList[3]} or ${romanList[1]} (Melancholy)`;
    if (degreeIdx === 6) return `${romanList[6]} → ${romanList[0]} (Leading Tone)`;
    return 'Resolves freely';
  }

  // --- 16. FRETBOARD WORKSTATION ---
  const GUITAR_FRETS_TOTAL = 15;

  function getCurrentTuningMidis() {
    const tuning = TUNINGS[state.currentTuningKey] || TUNINGS.standard;
    return tuning.midis;
  }

  // Pentatonic box positions: each box plays two consecutive pentatonic notes per string,
  // starting from the nth pentatonic note on the lowest string. Returns a Set of "string:fret" keys.
  function getPentatonicBoxPositions(boxNum, openMidis) {
    const scaleIntervals = SCALE_TYPES[state.scaleKey].intervals;
    const pentaIntervals = scaleIntervals.includes(4) ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
    const rootPitch = state.rootPitch;

    // Ascending pentatonic MIDI notes from the root on the lowest string
    const rootFret = (rootPitch - openMidis[0] % 12 + 12) % 12;
    const rootMidi = openMidis[0] + rootFret;
    const noteAt = (i) => rootMidi + Math.floor(i / 5) * 12 + pentaIntervals[i % 5];

    const positions = [];
    let noteIdx = boxNum - 1;
    openMidis.forEach((openMidi, strIdx) => {
      for (let n = 0; n < 2; n++) {
        positions.push({ strIdx, fret: noteAt(noteIdx) - openMidi });
        noteIdx++;
      }
    });

    // Slide the whole box by octaves so it sits on the neck
    const minFret = Math.min(...positions.map(p => p.fret));
    const maxFret = Math.max(...positions.map(p => p.fret));
    let shift = 0;
    if (minFret < 0) shift = 12;
    else if (maxFret > GUITAR_FRETS_TOTAL && minFret >= 12) shift = -12;

    const keys = new Set();
    positions.forEach(p => {
      const f = p.fret + shift;
      keys.add(`${p.strIdx}:${f}`);
      // Repeat the box an octave up when it fits on the neck too
      if (f + 12 <= GUITAR_FRETS_TOTAL) keys.add(`${p.strIdx}:${f + 12}`);
    });
    return keys;
  }

  function renderFretboard() {
    DOM.guitarFretboard.innerHTML = '';
    const tuning = TUNINGS[state.currentTuningKey] || TUNINGS.standard;
    const rootPitch = state.rootPitch;
    const { spelledNotes, pitchClasses: scalePitchClasses } = getDiatonicScaleSpelling(rootPitch, state.scaleKey, state.accidentalPref);
    const noteNameForPc = (pc) => {
      const idx = scalePitchClasses.indexOf(pc);
      return idx >= 0 ? spelledNotes[idx] : spellNote(pc);
    };

    // Frets here are counted from the capo, so the box is built from the capoed open strings
    const capoedMidis = tuning.midis.map(m => m + state.capoFret);
    const boxPositions = state.pentatonicBoxFilter === 'all'
      ? null
      : getPentatonicBoxPositions(parseInt(state.pentatonicBoxFilter, 10), capoedMidis);

    const fretboardContainer = document.createElement('div');
    fretboardContainer.className = 'fretboard';

    const stringsWrap = document.createElement('div');
    stringsWrap.className = 'fret-strings';

    const stringOrder = [5, 4, 3, 2, 1, 0];

    stringOrder.forEach((tIdx, displayIdx) => {
      const openMidi = tuning.midis[tIdx] + state.capoFret;
      const strName = tuning.names[tIdx];

      const stringRow = document.createElement('div');
      stringRow.className = 'guitar-string';
      stringRow.dataset.string = displayIdx;

      const openNut = document.createElement('div');
      openNut.className = 'string-open-note';
      openNut.textContent = state.capoFret > 0 ? `${strName}+${state.capoFret}` : strName;
      openNut.title = `Open ${strName} string (Click to pluck)`;
      openNut.addEventListener('click', () => audio.pluckString(openMidi, 1.8, 0, 0.9));
      stringRow.appendChild(openNut);

      const fretCells = document.createElement('div');
      fretCells.className = 'fret-cells';

      for (let f = 1; f <= GUITAR_FRETS_TOTAL; f++) {
        const cell = document.createElement('div');
        cell.className = 'fret-cell';
        const midi = openMidi + f;
        const pc = midi % 12;
        const inScale = scalePitchClasses.includes(pc);
        const isRoot = pc === rootPitch;

        if (displayIdx === 2 && [3, 5, 7, 9, 15].includes(f)) {
          const dot = document.createElement('div');
          dot.className = 'fret-marker-dot';
          cell.appendChild(dot);
        } else if (f === 12 && (displayIdx === 1 || displayIdx === 3)) {
          const dot = document.createElement('div');
          dot.className = 'fret-marker-dot';
          cell.appendChild(dot);
        }

        const inPentatonicBox = !boxPositions || boxPositions.has(`${tIdx}:${f}`);

        if (inScale) {
          const pill = document.createElement('div');
          let cls = `fret-note-pill in-scale ${isRoot ? 'root-note' : ''}`;
          if (!inPentatonicBox) cls += ' dimmed';
          pill.className = cls;
          pill.dataset.pc = pc;
          pill.dataset.midi = midi;
          pill.dataset.string = tIdx;
          pill.dataset.fret = f;

          if (state.fretboardDisplayMode === 'degrees') {
            const degIdx = scalePitchClasses.indexOf(pc);
            pill.textContent = isRoot ? 'R' : (degIdx + 1);
          } else {
            pill.textContent = noteNameForPc(pc);
          }

          pill.title = `${noteNameForPc(pc)} (Fret ${f}) - Click to pluck`;
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            audio.pluckString(midi, 1.8, 0, 0.95);
          });

          cell.appendChild(pill);
        }

        cell.addEventListener('click', () => audio.pluckString(midi, 1.8, 0, 0.9));
        fretCells.appendChild(cell);
      }

      stringRow.appendChild(fretCells);
      stringsWrap.appendChild(stringRow);
    });

    fretboardContainer.appendChild(stringsWrap);

    const numRow = document.createElement('div');
    numRow.className = 'fret-number-row';
    for (let f = 1; f <= GUITAR_FRETS_TOTAL; f++) {
      const num = document.createElement('div');
      const isMajorMarker = [3, 5, 7, 9, 12, 15].includes(f);
      num.className = `fret-num ${isMajorMarker ? 'major-marker' : ''}`;
      num.textContent = f === 12 ? '12 ●●' : (isMajorMarker ? `${f} ●` : f);
      numRow.appendChild(num);
    }
    fretboardContainer.appendChild(numRow);

    DOM.guitarFretboard.appendChild(fretboardContainer);
  }

  function highlightChordOnFretboard(frets) {
    clearFretboardChordHighlights();
    frets.forEach((fret, strIdx) => {
      if (fret > 0) {
        const selector = `.fret-note-pill[data-string="${strIdx}"][data-fret="${fret}"]`;
        const pill = DOM.guitarFretboard.querySelector(selector);
        if (pill) pill.classList.add('chord-note');
      }
    });
  }

  function clearFretboardChordHighlights() {
    DOM.guitarFretboard.querySelectorAll('.chord-note').forEach(p => p.classList.remove('chord-note'));
  }

  // --- 17. SCALES & SOLOING SECTION ---
  function renderScales(spelledNotes, pitchClasses, pref) {
    DOM.scalesGrid.innerHTML = '';
    const rootName = spelledNotes[0];
    const isMajor = state.scaleKey === 'major';

    const primaryScale = {
      title: `${rootName} ${SCALE_TYPES[state.scaleKey].short} Scale`,
      badge: 'Full Scale',
      cardClass: 'primary',
      desc: 'All 7 notes across the fretboard. Use for full melodies and guitar arpeggios.',
      formula: isMajor ? '1 - 2 - 3 - 4 - 5 - 6 - 7' : '1 - 2 - ♭3 - 4 - 5 - ♭6 - ♭7',
      pitches: pitchClasses,
      spelled: spelledNotes,
      specialIdx: []
    };

    let pentatonicPitches = [];
    let pentatonicSpelled = [];
    let pentatonicTitle = '';
    let pentatonicFormula = '';

    if (isMajor) {
      pentatonicTitle = `${rootName} Major Pentatonic`;
      pentatonicFormula = '1 - 2 - 3 - 5 - 6 (The "Country & Southern Rock" scale)';
      const pentaIndices = [0, 1, 2, 4, 5];
      pentatonicPitches = pentaIndices.map(i => pitchClasses[i]);
      pentatonicSpelled = pentaIndices.map(i => spelledNotes[i]);
    } else {
      pentatonicTitle = `${rootName} Minor Pentatonic`;
      pentatonicFormula = '1 - ♭3 - 4 - 5 - ♭7 (The iconic rock guitar Box 1 scale)';
      const pentaIndices = [0, 2, 3, 4, 6];
      pentatonicPitches = pentaIndices.map(i => pitchClasses[i]);
      pentatonicSpelled = pentaIndices.map(i => spelledNotes[i]);
    }

    const pentatonicScale = {
      title: pentatonicTitle,
      badge: 'Guitar Pentatonic',
      cardClass: 'pentatonic',
      desc: 'The #1 scale in guitar history. Zero clashing half-steps—every note rings out cleanly.',
      formula: pentatonicFormula,
      pitches: pentatonicPitches,
      spelled: pentatonicSpelled,
      specialIdx: []
    };

    let bluesPitches = [];
    let bluesSpelled = [];
    let bluesSpecial = [];
    let bluesTitle = '';
    let bluesFormula = '';

    if (isMajor) {
      bluesTitle = `${rootName} Major Blues`;
      bluesFormula = '1 - 2 - ♭3(blue) - 3 - 5 - 6';
      const bluePitch = (state.rootPitch + 3) % 12;
      bluesPitches = [pitchClasses[0], pitchClasses[1], bluePitch, pitchClasses[2], pitchClasses[4], pitchClasses[5]];
      bluesSpelled = [spelledNotes[0], spelledNotes[1], spellNote(bluePitch, null, pref), spelledNotes[2], spelledNotes[4], spelledNotes[5]];
      bluesSpecial = [2];
    } else {
      bluesTitle = `${rootName} Minor Blues`;
      bluesFormula = '1 - ♭3 - 4 - ♭5(blue) - 5 - ♭7';
      const bluePitch = (state.rootPitch + 6) % 12;
      bluesPitches = [pitchClasses[0], pitchClasses[2], pitchClasses[3], bluePitch, pitchClasses[4], pitchClasses[6]];
      bluesSpelled = [spelledNotes[0], spelledNotes[2], spelledNotes[3], spellNote(bluePitch, null, pref), spelledNotes[4], spelledNotes[6]];
      bluesSpecial = [3];
    }

    const bluesScale = {
      title: bluesTitle,
      badge: 'Blues & Soul Box',
      cardClass: 'blues',
      desc: 'Adds the tension-filled Blue Note (♭5). Instant Hendrix, Clapton, and Stevie Ray Vaughan attitude.',
      formula: bluesFormula,
      pitches: bluesPitches,
      spelled: bluesSpelled,
      specialIdx: bluesSpecial
    };

    let modalScale = null;
    if (isMajor) {
      const mixoNotes = getDiatonicScaleSpelling(state.rootPitch, 'mixolydian', pref);
      modalScale = {
        title: `${rootName} Mixolydian Rock Mode`,
        badge: 'Classic Rock',
        cardClass: 'modal',
        desc: 'Flattens the 7th for endless classic rock riffs (Allman Brothers, Tom Petty, AC/DC).',
        formula: '1 - 2 - 3 - 4 - 5 - 6 - ♭7',
        pitches: mixoNotes.pitchClasses,
        spelled: mixoNotes.spelledNotes,
        specialIdx: [6]
      };
    } else {
      const dorianNotes = getDiatonicScaleSpelling(state.rootPitch, 'dorian', pref);
      modalScale = {
        title: `${rootName} Dorian Mode`,
        badge: 'Santana / Funk',
        cardClass: 'modal',
        desc: 'Brightens minor with a natural 6th. The signature sound of Carlos Santana and Daft Punk.',
        formula: '1 - 2 - ♭3 - 4 - 5 - 6 - ♭7',
        pitches: dorianNotes.pitchClasses,
        spelled: dorianNotes.spelledNotes,
        specialIdx: [5]
      };
    }

    [primaryScale, pentatonicScale, bluesScale, modalScale].forEach(scale => {
      const card = document.createElement('div');
      card.className = `scale-card ${scale.cardClass}`;

      const notesBubbles = scale.spelled.map((note, idx) => {
        const isRoot = idx === 0;
        const isBlue = scale.specialIdx.includes(idx);
        let cls = 'note-bubble';
        if (isRoot) cls += ' root-note';
        if (isBlue) cls += ' blue-note';
        return `<div class="${cls}" data-pitch="${scale.pitches[idx]}" title="${isRoot ? 'Root Note' : (isBlue ? 'Blue Note' : 'Scale Note')}">${note}</div>`;
      }).join('');

      card.innerHTML = `
        <div class="scale-card-header">
          <div class="scale-title-group">
            <h3>${scale.title}</h3>
          </div>
          <span class="scale-badge">${scale.badge}</span>
        </div>
        <p class="scale-desc">${scale.desc}</p>
        <div class="scale-notes-row">${notesBubbles}</div>
        <div class="scale-footer">
          <span class="scale-formula">${scale.formula}</span>
          <button class="btn-play-scale"><span>🎸</span> Pluck Scale</button>
        </div>
      `;

      card.querySelector('.btn-play-scale').addEventListener('click', () => {
        const baseMidi = 52 + scale.pitches[0];
        let currentMidi = baseMidi;
        const sequence = [currentMidi];

        for (let i = 1; i < scale.pitches.length; i++) {
          let stepDiff = scale.pitches[i] - (currentMidi % 12);
          if (stepDiff <= 0) stepDiff += 12;
          currentMidi += stepDiff;
          sequence.push(currentMidi);
        }
        sequence.push(sequence[0] + 12);

        const bubbles = card.querySelectorAll('.note-bubble');
        audio.playScaleSequence(sequence, 0.28, (activeMidi, stepIdx) => {
          bubbles.forEach(b => b.style.transform = '');
          if (stepIdx >= 0 && stepIdx < bubbles.length) {
            bubbles[stepIdx].style.transform = 'scale(1.25)';
          }
        });
      });

      card.querySelectorAll('.note-bubble').forEach(b => {
        b.addEventListener('click', () => {
          const p = parseInt(b.dataset.pitch, 10);
          audio.pluckString(52 + p, 1.6, 0, 0.9);
        });
      });

      DOM.scalesGrid.appendChild(card);
    });
  }

  // --- 18. THE SPICE BOX ---
  function renderFlavorChords(rootName, rootPitch, pref) {
    DOM.flavorGrid.innerHTML = '';
    const flavors = [];

    if (state.scaleKey === 'major') {
      const bVII_pitch = (rootPitch + 10) % 12;
      const bVII_name = spellNote(bVII_pitch, null, pref);
      flavors.push({
        type: 'Modal Interchange',
        roman: '♭VII',
        name: bVII_name,
        rootPitch: bVII_pitch,
        vibe: 'Classic rock & acoustic power move (Beatles, Tom Petty, Lynyrd Skynyrd). Relieves leading-tone tension with triumphant swagger.'
      });

      const bVI_pitch = (rootPitch + 8) % 12;
      const bVI_name = spellNote(bVI_pitch, null, pref);
      flavors.push({
        type: 'Modal Interchange',
        roman: '♭VI',
        name: bVI_name,
        rootPitch: bVI_pitch,
        vibe: 'Goosebump-inducing, cinematic drama borrowed from the parallel minor (Hans Zimmer, Radiohead).'
      });

      const iv_pitch = (rootPitch + 5) % 12;
      const iv_name = `${spellNote(iv_pitch, null, pref)}m`;
      flavors.push({
        type: 'Modal Interchange',
        roman: 'iv',
        name: iv_name,
        rootPitch: iv_pitch,
        vibe: 'The ultimate bittersweet tearjerker chord (Radiohead "Creep", Billie Eilish). Resolves IV → iv → I.'
      });

      const v_of_vi_pitch = (rootPitch + 4) % 12;
      const v_of_vi_name = `${spellNote(v_of_vi_pitch, null, pref)}7`;
      flavors.push({
        type: 'Secondary Dominant',
        roman: 'V / vi',
        name: v_of_vi_name,
        rootPitch: v_of_vi_pitch,
        vibe: 'Magnetic pull launching straight into the relative minor (vi chord).'
      });
    } else {
      const V_pitch = (rootPitch + 7) % 12;
      const V_name = `${spellNote(V_pitch, null, pref)}7`;
      flavors.push({
        type: 'Harmonic Minor Lift',
        roman: 'V7',
        name: V_name,
        rootPitch: V_pitch,
        vibe: 'Replacing natural minor v with major V7 gives Spanish acoustic urgency pulling home to i.'
      });

      const IV_pitch = (rootPitch + 5) % 12;
      const IV_name = spellNote(IV_pitch, null, pref);
      flavors.push({
        type: 'Dorian Lift',
        roman: 'IV',
        name: IV_name,
        rootPitch: IV_pitch,
        vibe: 'Major IV lifts minor darkness into a vibrant acoustic shimmer (Pink Floyd "Breathe").'
      });
    }

    flavors.forEach(f => {
      const card = document.createElement('div');
      card.className = 'flavor-card';
      const voicing = getGuitarVoicing(f.name, f.rootPitch);

      card.innerHTML = `
        <div class="flavor-header">
          <span class="flavor-type-tag">${f.type}</span>
          <span class="roman-badge" style="background:var(--borrowed-bg); color:var(--borrowed-color);">${f.roman}</span>
        </div>
        <div class="flavor-content">
          <div class="flavor-name">${f.name}</div>
          <p class="flavor-vibe">${f.vibe}</p>
        </div>
        <div class="chord-box-wrap" title="Click to strum">
          ${generateChordDiagramSVG(voicing)}
          <div class="chord-tab-snippet">${formatTabFrets(voicing.frets)}</div>
        </div>
        <div class="chord-actions">
          <button class="btn-play-chord"><span>🎸</span> Strum</button>
          <button class="btn-add-progression" title="Add to current section">+</button>
        </div>
      `;

      const playAction = () => {
        audio.strumGuitarChord(voicing.frets, 1.8, 'down', 0.02, getCurrentTuningMidis());
        highlightChordOnFretboard(voicing.frets);
      };

      card.querySelector('.chord-box-wrap').addEventListener('click', playAction);
      card.querySelector('.btn-play-chord').addEventListener('click', playAction);

      card.querySelector('.btn-add-progression').addEventListener('click', () => {
        addChordToProgression({
          name: f.name,
          roman: f.roman,
          rootPitch: f.rootPitch,
          voicing,
          tabStr: formatTabFrets(voicing.frets)
        });
      });

      DOM.flavorGrid.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
