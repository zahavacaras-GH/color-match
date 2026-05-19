/* ============================================================
   COLOR MATCH GAME — script.js
   Vanilla JavaScript game logic
   ============================================================ */

'use strict';

// ============================================================
// CONFIGURATION
// ============================================================

/** Curated palettes inspired by Coolors.co — each sub-array is [r, g, b] */
const COOLORS_PALETTES = [
  // Sunrise
  [[255,99,72],[255,159,28],[255,206,86],[255,244,174],[254,222,141]],
  // Ocean
  [[0,119,182],[0,150,199],[0,180,216],[72,202,228],[144,224,239]],
  // Neon Night
  [[255,0,110],[255,75,43],[251,176,59],[100,220,58],[0,230,118]],
  // Lavender Dream
  [[155,93,229],[241,91,181],[254,228,64],[0,187,249],[0,245,212]],
  // Earth Tones
  [[99,57,23],[162,94,47],[205,149,93],[235,203,155],[247,232,202]],
  // Berry
  [[90,24,154],[130,40,175],[195,70,210],[240,113,224],[255,196,237]],
  // Forest
  [[19,78,74],[17,94,89],[13,148,136],[45,212,191],[167,243,208]],
  // Fire
  [[155,23,23],[197,41,41],[229,81,62],[255,137,86],[255,189,133]],
  // Space
  [[10,10,35],[30,15,80],[75,20,130],[130,50,200],[200,100,255]],
  // Candy
  [[255,183,195],[255,222,89],[182,255,240],[182,187,255],[255,182,255]],
];

/** Difficulty config */
const DIFFICULTY_CONFIG = {
  easy: {
    hideSliderValues: false,
    randomize: () => getRandomFromPalette(),
  },
  normal: {
    hideSliderValues: false,
    randomize: () => getFullyRandom(),
  },
  hard: {
    hideSliderValues: true,
    randomize: () => getFullyRandom(),
  },
};

// ============================================================
// STATE
// ============================================================
let state = {
  targetR: 0, targetG: 0, targetB: 0,
  playerR: 128, playerG: 128, playerB: 128,
  streak: 0,
  bestScore: parseInt(localStorage.getItem('cm_best') || '0', 10),
  difficulty: 'normal',
  wheelBrightness: 0.5,      // 0=black, 1=white, 0.5=full hue
  isAnimating: false,
};

// ============================================================
// DOM REFS
// ============================================================
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  loadingScreen:    $('loading-screen'),
  app:              $('app'),
  targetSwatch:     $('target-swatch'),
  swatchGlow:       $('swatch-glow'),
  swatchQuestion:   $('swatch-question'),
  colorWheel:       $('color-wheel'),
  wheelCursor:      $('wheel-cursor'),
  brightnessSlider: $('brightness-slider'),
  rSlider:          $('r-slider'),
  gSlider:          $('g-slider'),
  bSlider:          $('b-slider'),
  rValue:           $('r-value'),
  gValue:           $('g-value'),
  bValue:           $('b-value'),
  previewSwatch:    $('preview-swatch'),
  matchBtn:         $('match-btn'),
  streakDisplay:    $('streak-display'),
  bestDisplay:      $('best-display'),
  scoreOverlay:     $('score-overlay'),
  scoreTitle:       $('score-title'),
  scoreNumber:      $('score-number'),
  scoreBarFill:     $('score-bar-fill'),
  compareTarget:    $('compare-target'),
  comparePlayer:    $('compare-player'),
  compareTargetHex: $('compare-target-hex'),
  comparePlayerHex: $('compare-player-hex'),
  playAgainBtn:     $('play-again-btn'),
  confettiContainer:$('confetti-container'),
  particlesCanvas:  $('particles-canvas'),
  fireBar:          $('fire-bar'),
  shareScoreBtn:    $('share-score-btn'),
  copyToast:        $('copy-toast'),
  // Leaderboard
  lbOpenBtn:        $('lb-open-btn'),
  lbModal:          $('lb-modal'),
  lbList:           $('lb-list'),
  lbEmpty:          $('lb-empty'),
  lbCloseBtn:       $('lb-close-btn'),
  lbPrompt:         $('lb-prompt'),
  lbPromptScore:    $('lb-prompt-score'),
  lbNameInput:      $('lb-name-input'),
  lbSaveBtn:        $('lb-save-btn'),
  lbSkipBtn:        $('lb-skip-btn'),
};

// ============================================================
// COLOR UTILITIES
// ============================================================

/** Convert r,g,b to hex string */
function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
}

/** RGB distance (Euclidean in 3D color space) */
function rgbDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

/** Convert distance to a 0–100 accuracy score */
function distanceToScore(distance) {
  const maxDist = Math.sqrt(255*255 + 255*255 + 255*255); // ≈ 441.67
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

/** Pick a color from a random palette entry */
function getRandomFromPalette() {
  const palette = COOLORS_PALETTES[Math.floor(Math.random() * COOLORS_PALETTES.length)];
  const color = palette[Math.floor(Math.random() * palette.length)];
  return { r: color[0], g: color[1], b: color[2] };
}

/** Fully random vivid color */
function getFullyRandom() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

/** Determine text color (black or white) for contrast on a background */
function contrastColor(r, g, b) {
  const luminance = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/** HSV → RGB conversion */
function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}

// ============================================================
// COLOR WHEEL CANVAS
// ============================================================

/**
 * Draw the HSL color wheel on the canvas.
 * Outer ring = full hue spectrum, inner = mixed with black/white
 * based on brightness slider.
 */
function drawColorWheel() {
  const canvas = dom.colorWheel;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw hue wheel by sweeping tiny arcs
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const startAngle = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const endAngle   = ((i + 1) / steps) * Math.PI * 2 - Math.PI / 2;

    // Radial gradient: center to edge, brightness controls saturation
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const hue = i;
    const brightness = state.wheelBrightness;

    // Center color: interpolate between black/white based on brightness
    const centerR = brightness < 0.5
      ? Math.round(brightness * 2 * 255)
      : 255;
    const centerG = centerR;
    const centerB = centerR;

    gradient.addColorStop(0,   `rgb(${centerR},${centerG},${centerB})`);
    gradient.addColorStop(1,   `hsl(${hue}, 100%, ${30 + brightness * 20}%)`);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Overlay a cleaner saturation gradient (white to transparent radially)
  const satGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const brt = state.wheelBrightness;
  satGrad.addColorStop(0,   brt > 0.5
    ? `rgba(255,255,255,${(brt-0.5)*2})`
    : `rgba(0,0,0,${(0.5-brt)*2})`);
  satGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
  satGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = satGrad;
  ctx.fill();
}

/**
 * Sample a pixel color from the wheel canvas.
 * Returns [r, g, b] or null if outside the circle.
 */
function sampleWheel(x, y) {
  const canvas = dom.colorWheel;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 2;

  const dx = x - cx;
  const dy = y - cy;
  if (Math.sqrt(dx*dx + dy*dy) > radius) return null;

  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return [pixel[0], pixel[1], pixel[2]];
}

/** Handle click/drag on the color wheel */
function onWheelInteract(e) {
  const canvas = dom.colorWheel;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const color = sampleWheel(x, y);

  if (color) {
    state.playerR = color[0];
    state.playerG = color[1];
    state.playerB = color[2];
    syncSlidersFromState();
    updatePlayerPreview();

    // Move cursor dot
    const pct = (x / canvas.width) * 100;
    const pctY = (y / canvas.height) * 100;
    dom.wheelCursor.style.left = `${(x / canvas.width) * 100}%`;
    dom.wheelCursor.style.top  = `${(y / canvas.height) * 100}%`;

    playSound('tick');
  }
}

// ============================================================
// PLAYER COLOR
// ============================================================

/** Read sliders and update state + UI */
function readSliders() {
  state.playerR = parseInt(dom.rSlider.value, 10);
  state.playerG = parseInt(dom.gSlider.value, 10);
  state.playerB = parseInt(dom.bSlider.value, 10);
  updatePlayerPreview();
}

/** Push state r,g,b → sliders and value labels */
function syncSlidersFromState() {
  dom.rSlider.value = state.playerR;
  dom.gSlider.value = state.playerG;
  dom.bSlider.value = state.playerB;
  updateValueLabels();
}

/** Update R/G/B value labels next to sliders */
function updateValueLabels() {
  dom.rValue.textContent = state.playerR;
  dom.gValue.textContent = state.playerG;
  dom.bValue.textContent = state.playerB;
}

/** Refresh the live preview circle */
function updatePlayerPreview() {
  const { playerR: r, playerG: g, playerB: b } = state;
  const hex = toHex(r, g, b);
  dom.previewSwatch.querySelector('.preview-inner').style.background = hex;
  dom.previewSwatch.style.boxShadow = `0 0 24px ${hex}60`;
  updateValueLabels();
}

// ============================================================
// TARGET COLOR
// ============================================================

/** Generate a new target and apply it to the UI */
function generateTarget() {
  const gen = DIFFICULTY_CONFIG[state.difficulty].randomize();
  state.targetR = gen.r;
  state.targetG = gen.g;
  state.targetB = gen.b;

  const hex = toHex(gen.r, gen.g, gen.b);
  dom.targetSwatch.style.background = hex;
  dom.swatchGlow.style.background = hex;
  dom.swatchQuestion.style.display = 'flex';
  dom.swatchQuestion.style.opacity = '1';
}

// ============================================================
// SCORING & REVEAL
// ============================================================

/** Called when the player presses MATCH COLOR */
function handleMatchColor() {
  if (state.isAnimating) return;

  playSound('submit');

  const { targetR, targetG, targetB, playerR, playerG, playerB } = state;
  const distance = rgbDistance(targetR, targetG, targetB, playerR, playerG, playerB);
  const score = distanceToScore(distance);
  state.score = score;

  // Update streak and best
  if (score >= 60) {
    state.streak++;
  } else {
    state.streak = 0;
  }

  if (score > state.bestScore) {
    state.bestScore = score;
    localStorage.setItem('cm_best', score);
    playSound('highscore');
  }

  updateStatsDisplay();
  updateFireBar();
  showScoreReveal(score);
}

function updateFireBar() {
  if (!dom.fireBar) return;
  if (state.streak >= 3) {
    dom.fireBar.classList.remove('hidden');
  } else {
    dom.fireBar.classList.add('hidden');
  }
}

/** Show the cinematic score overlay */
function showScoreReveal(score) {
  state.isAnimating = true;

  const { targetR, targetG, targetB, playerR, playerG, playerB } = state;
  const targetHex = toHex(targetR, targetG, targetB);
  const playerHex = toHex(playerR, playerG, playerB);

  // Reveal target hex on the swatch
  dom.swatchQuestion.style.opacity = '0';

  // Populate overlay
  dom.compareTarget.style.background = targetHex;
  dom.comparePlayer.style.background = playerHex;
  dom.compareTargetHex.textContent = targetHex;
  dom.comparePlayerHex.textContent = playerHex;
  dom.compareTarget.style.boxShadow = `0 0 20px ${targetHex}80`;
  dom.comparePlayer.style.boxShadow = `0 0 20px ${playerHex}80`;

  // Score grade
  let title;
  if (score >= 95)      title = '🎯 PERFECT MATCH!';
  else if (score >= 80) title = '✨ AMAZING!';
  else if (score >= 60) title = '👍 PRETTY CLOSE!';
  else                  title = '💪 TRY AGAIN!';
  dom.scoreTitle.textContent = title;

  // Score bar color
  let barColor;
  if (score >= 80)      barColor = 'linear-gradient(90deg, #4ade80, #22c55e)';
  else if (score >= 60) barColor = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
  else                  barColor = 'linear-gradient(90deg, #f87171, #ef4444)';
  dom.scoreBarFill.style.background = barColor;

  // Show overlay
  dom.scoreOverlay.classList.remove('hidden');
  dom.scoreOverlay.classList.add('visible');

  // Animate score number counting up
  dom.scoreNumber.textContent = '0';
  dom.scoreBarFill.style.width = '0%';

  let current = 0;
  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.round(eased * score);
    dom.scoreNumber.textContent = current;
    dom.scoreBarFill.style.width = `${eased * score}%`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      dom.scoreNumber.textContent = score;
      dom.scoreBarFill.style.width = `${score}%`;
      playSound('reveal');

      if (score >= 80) {
        triggerCelebration();
      }
      qualifiesForLeaderboard(score).then(q => {
        if (q) setTimeout(() => showLeaderboardPrompt(score), 900);
      });
    }
  }

  requestAnimationFrame(tick);
}

/** Dismiss overlay and start a new round */
function playAgain() {
  state.isAnimating = false;

  dom.scoreOverlay.classList.remove('visible');
  dom.scoreOverlay.classList.add('hidden');
  dom.scoreBarFill.style.width = '0%';
  dom.confettiContainer.innerHTML = '';

  // Reset player color
  state.playerR = 128;
  state.playerG = 128;
  state.playerB = 128;
  syncSlidersFromState();
  updatePlayerPreview();

  // Generate new target
  generateTarget();
  playSound('tick');
}

// ============================================================
// CONFETTI
// ============================================================

/** Drop colorful confetti pieces for high scores */
function triggerConfetti() {
  const colors = [
    '#a855f7','#3b82f6','#ec4899','#06b6d4',
    '#fbbf24','#4ade80','#f87171','#ffffff',
  ];
  const count = 80;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width  = `${6 + Math.random() * 10}px`;
    piece.style.height = `${6 + Math.random() * 10}px`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration  = `${1.5 + Math.random() * 2}s`;
    piece.style.animationDelay     = `${Math.random() * 0.5}s`;
    piece.style.opacity = `${0.6 + Math.random() * 0.4}`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    dom.confettiContainer.appendChild(piece);
  }

  // Clean up after animation
  setTimeout(() => {
    dom.confettiContainer.innerHTML = '';
  }, 4000);
}

// ============================================================
// CELEBRATION (random effect for scores >= 80%)
// ============================================================

let lastCelebrationIdx = -1;
function triggerCelebration() {
  const effects = [triggerStreamers, triggerStrawberries, triggerFireworks];
  let idx;
  do {
    idx = Math.floor(Math.random() * effects.length);
  } while (idx === lastCelebrationIdx);
  lastCelebrationIdx = idx;
  effects[idx]();
}

function triggerStreamers() {
  const colors = ['#a855f7','#3b82f6','#ec4899','#06b6d4','#fbbf24','#4ade80','#f87171','#ffffff'];
  const count = 35;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'streamer-piece';
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.width  = `${4 + Math.random() * 6}px`;
    s.style.height = `${70 + Math.random() * 90}px`;
    s.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    s.style.animationDelay    = `${Math.random() * 0.6}s`;
    s.style.setProperty('--wobble', `${(Math.random() * 80 - 40)}px`);
    s.style.opacity = `${0.7 + Math.random() * 0.3}`;
    dom.confettiContainer.appendChild(s);
  }
  setTimeout(() => { dom.confettiContainer.innerHTML = ''; }, 5000);
}

function triggerStrawberries() {
  const count = 30;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'strawberry-piece';
    s.textContent = '🍓';
    s.style.left = `${Math.random() * 100}%`;
    s.style.fontSize = `${22 + Math.random() * 22}px`;
    s.style.animationDuration = `${2 + Math.random() * 2}s`;
    s.style.animationDelay    = `${Math.random() * 0.6}s`;
    s.style.opacity = `${0.85 + Math.random() * 0.15}`;
    s.style.setProperty('--spin', `${Math.random() > 0.5 ? 1 : -1}`);
    dom.confettiContainer.appendChild(s);
  }
  setTimeout(() => { dom.confettiContainer.innerHTML = ''; }, 5000);
}

function triggerFireworks() {
  const colors = ['#fbbf24','#ec4899','#06b6d4','#a855f7','#4ade80','#f87171','#3b82f6','#ffffff'];
  const bursts = 5;
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const cx = 10 + Math.random() * 80;
      const cy = 8 + Math.random() * 45;
      const burstColor = colors[Math.floor(Math.random() * colors.length)];
      const sparks = 24;
      for (let i = 0; i < sparks; i++) {
        const angle = (i / sparks) * Math.PI * 2;
        const dist = 80 + Math.random() * 90;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const s = document.createElement('div');
        s.className = 'firework-spark';
        s.style.left = `${cx}%`;
        s.style.top  = `${cy}%`;
        s.style.background = burstColor;
        s.style.boxShadow  = `0 0 8px ${burstColor}`;
        s.style.setProperty('--dx', `${dx}px`);
        s.style.setProperty('--dy', `${dy}px`);
        s.style.animationDuration = `${0.9 + Math.random() * 0.4}s`;
        dom.confettiContainer.appendChild(s);
      }
    }, b * 350);
  }
  setTimeout(() => { dom.confettiContainer.innerHTML = ''; }, 4500);
}

// ============================================================
// SHARE SCORE
// ============================================================

function generateScoreImage() {
  const { targetR, targetG, targetB, playerR, playerG, playerB, score } = state;
  const targetHex = toHex(targetR, targetG, targetB);
  const playerHex = toHex(playerR, playerG, playerB);

  const W = 800, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a0a2e');
  bg.addColorStop(1, '#2d1b4e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎨 COLOR MATCH', W / 2, 100);

  let scoreColor = '#f87171';
  if (score >= 80) scoreColor = '#4ade80';
  else if (score >= 60) scoreColor = '#fbbf24';
  ctx.fillStyle = scoreColor;
  ctx.font = '900 180px "Orbitron", sans-serif';
  ctx.fillText(`${score}%`, W / 2, 290);

  ctx.fillStyle = playerHex;
  ctx.fillRect(W / 2 - 240, 360, 200, 200);
  ctx.fillStyle = targetHex;
  ctx.fillRect(W / 2 + 40, 360, 200, 200);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.strokeRect(W / 2 - 240, 360, 200, 200);
  ctx.strokeRect(W / 2 + 40, 360, 200, 200);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 24px "Inter", sans-serif';
  ctx.fillText('Your color', W / 2 - 140, 600);
  ctx.fillText('Target', W / 2 + 140, 600);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 18px "Inter", sans-serif';
  ctx.fillText(playerHex, W / 2 - 140, 630);
  ctx.fillText(targetHex, W / 2 + 140, 630);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 36px "Orbitron", sans-serif';
  ctx.fillText('Can you beat my score?', W / 2, 720);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function showCopyToast(msg) {
  if (!dom.copyToast) return;
  dom.copyToast.textContent = msg || '✅ Copied to clipboard!';
  dom.copyToast.classList.remove('hidden');
  clearTimeout(showCopyToast._t);
  showCopyToast._t = setTimeout(() => {
    dom.copyToast.classList.add('hidden');
  }, 2200);
}

async function shareScore() {
  const score = state.score;
  const url = window.location.origin;
  const text = `I scored ${score}% on Color Match! Can you beat my score? ${url}`;

  let blob;
  try {
    blob = await generateScoreImage();
  } catch (err) {
    console.warn('Image generation failed:', err);
  }

  if (blob && navigator.canShare) {
    const file = new File([blob], 'color-match-score.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Color Match',
          text: `I scored ${score}% on Color Match! Can you beat my score?`,
          url,
          files: [file],
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Color Match',
        text: `I scored ${score}% on Color Match! Can you beat my score?`,
        url,
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showCopyToast('✅ Link copied to clipboard!');
  } catch {
    showCopyToast('Could not copy. Sorry!');
  }

  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `color-match-${score}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}

// ============================================================
// STATS DISPLAY
// ============================================================

function updateStatsDisplay() {
  const streakEl = dom.streakDisplay;
  streakEl.textContent = state.streak;
  streakEl.classList.remove('streak-bump');
  void streakEl.offsetWidth; // Force reflow
  if (state.streak > 0) streakEl.classList.add('streak-bump');

  dom.bestDisplay.textContent = `${state.bestScore}%`;
}

// ============================================================
// DIFFICULTY
// ============================================================

function setDifficulty(diff) {
  state.difficulty = diff;

  // Update button states
  $$('.diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === diff);
  });

  // Toggle hard mode class
  document.body.classList.toggle('hard-mode', diff === 'hard');

  // Generate a new target for the new difficulty
  generateTarget();
  playSound('tick');
}

// ============================================================
// SOUND EFFECTS  (Web Audio API — no external files needed)
// ============================================================

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Synthesized sound effects using Web Audio API oscillators.
 * @param {string} type - 'tick' | 'submit' | 'reveal' | 'highscore'
 */
function playSound(type) {
  try {
    const ctx = getAudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.12;
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'tick') {
      // Short high blip
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.08);

    } else if (type === 'submit') {
      // Rising swoosh
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(g); g.connect(masterGain);
      osc.start(now); osc.stop(now + 0.35);

    } else if (type === 'reveal') {
      // Score reveal chord
      [440, 554, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.06);
        g.gain.linearRampToValueAtTime(0.1, now + i * 0.06 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
        osc.connect(g); g.connect(masterGain);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.5);
      });

    } else if (type === 'highscore') {
      // Celebratory ascending arpeggio
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
        osc.connect(g); g.connect(masterGain);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    }
  } catch (e) {
    // Sound not supported or blocked — silent fallback
  }
}

// ============================================================
// FLOATING PARTICLES
// ============================================================

(function initParticles() {
  const canvas = dom.particlesCanvas;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  const PARTICLE_COUNT = 50;
  const particles = [];

  const COLORS = [
    'rgba(168,85,247,',
    'rgba(59,130,246,',
    'rgba(236,72,153,',
    'rgba(6,182,212,',
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.2 + Math.random() * 0.5),
      alpha: 0.1 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
      }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.fill();
    });

    requestAnimationFrame(animateParticles);
  }

  animateParticles();
})();

// ============================================================
// RIPPLE EFFECT ON BUTTON
// ============================================================

function addRipple(e) {
  const btn = dom.matchBtn;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top  - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width  = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left   = `${x}px`;
  ripple.style.top    = `${y}px`;
  btn.appendChild(ripple);

  ripple.addEventListener('animationend', () => ripple.remove());
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function bindEvents() {
  // Color wheel — click and drag
  let isDragging = false;

  dom.colorWheel.addEventListener('mousedown', (e) => {
    isDragging = true;
    onWheelInteract(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) onWheelInteract(e);
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  // Touch support
  dom.colorWheel.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onWheelInteract(e);
  }, { passive: false });

  dom.colorWheel.addEventListener('touchmove', (e) => {
    e.preventDefault();
    onWheelInteract(e);
  }, { passive: false });

  // Brightness slider
  dom.brightnessSlider.addEventListener('input', () => {
    state.wheelBrightness = parseInt(dom.brightnessSlider.value, 10) / 100;
    drawColorWheel();
  });

  // RGB sliders
  [dom.rSlider, dom.gSlider, dom.bSlider].forEach((slider, i) => {
    slider.addEventListener('input', () => {
      state.playerR = parseInt(dom.rSlider.value, 10);
      state.playerG = parseInt(dom.gSlider.value, 10);
      state.playerB = parseInt(dom.bSlider.value, 10);
      updatePlayerPreview();
    });
  });

  // Match button
  dom.matchBtn.addEventListener('click', (e) => {
    addRipple(e);
    handleMatchColor();
  });

  // Play again
  dom.playAgainBtn.addEventListener('click', () => {
    playSound('tick');
    playAgain();
  });

  // Difficulty buttons
  $$('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setDifficulty(btn.dataset.diff);
    });
  });

  // Keyboard shortcut: Enter to submit, R to restart
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !state.isAnimating) handleMatchColor();
    if ((e.key === 'r' || e.key === 'R') && state.isAnimating) playAgain();
  });

  // Share score
  if (dom.shareScoreBtn) {
    dom.shareScoreBtn.addEventListener('click', () => {
      playSound('tick');
      shareScore();
    });
  }

  // Leaderboard
  if (dom.lbOpenBtn) {
    dom.lbOpenBtn.addEventListener('click', () => {
      playSound('tick');
      openLeaderboard();
    });
  }
  if (dom.lbCloseBtn) {
    dom.lbCloseBtn.addEventListener('click', () => {
      playSound('tick');
      closeLeaderboard();
    });
  }
  if (dom.lbModal) {
    dom.lbModal.addEventListener('click', (e) => {
      if (e.target === dom.lbModal) closeLeaderboard();
    });
  }
  if (dom.lbSaveBtn) {
    dom.lbSaveBtn.addEventListener('click', saveLeaderboardEntry);
  }
  if (dom.lbSkipBtn) {
    dom.lbSkipBtn.addEventListener('click', hideLeaderboardPrompt);
  }
  if (dom.lbNameInput) {
    dom.lbNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveLeaderboardEntry();
    });
  }
}

// ============================================================
// GLOBAL LEADERBOARD
// ============================================================

let leaderboardCache = [];
let pendingLbScore = null;

async function fetchTopScores() {
  try {
    const res = await fetch('/api/scores', { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    leaderboardCache = Array.isArray(data.scores) ? data.scores : [];
    return leaderboardCache;
  } catch (err) {
    console.warn('Leaderboard fetch failed:', err);
    return [];
  }
}

async function submitScore(name, score, hex) {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, hex }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Score submit failed:', err);
    return false;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderLeaderboard(scores) {
  dom.lbList.innerHTML = '';
  if (!scores || scores.length === 0) {
    dom.lbList.appendChild(dom.lbEmpty);
    dom.lbEmpty.style.display = 'block';
    return;
  }
  dom.lbEmpty.style.display = 'none';
  scores.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    const swatch = entry.hex
      ? `<span class="lb-swatch" style="background:${entry.hex}"></span>`
      : '';
    row.innerHTML = `
      <span class="lb-rank">#${idx + 1}</span>
      <span class="lb-name">${escapeHtml(entry.name)}</span>
      ${swatch}
      <span class="lb-score">${entry.score}%</span>
    `;
    dom.lbList.appendChild(row);
  });
}

async function qualifiesForLeaderboard(score) {
  const top = await fetchTopScores();
  if (top.length < 10) return true;
  return score > top[top.length - 1].score;
}

function showLeaderboardPrompt(score) {
  pendingLbScore = score;
  dom.lbPromptScore.textContent = `${score}%`;
  dom.lbNameInput.value = '';
  dom.lbPrompt.classList.remove('hidden');
  setTimeout(() => dom.lbNameInput.focus(), 100);
}

function hideLeaderboardPrompt() {
  dom.lbPrompt.classList.add('hidden');
  pendingLbScore = null;
}

async function saveLeaderboardEntry() {
  if (pendingLbScore == null) return;
  const name = dom.lbNameInput.value.trim();
  if (!name) {
    dom.lbNameInput.focus();
    return;
  }
  const hex = toHex(state.playerR, state.playerG, state.playerB);
  const ok = await submitScore(name, pendingLbScore, hex);
  hideLeaderboardPrompt();
  if (ok) await openLeaderboard();
}

async function openLeaderboard() {
  await fetchTopScores();
  renderLeaderboard(leaderboardCache);
  dom.lbModal.classList.remove('hidden');
}

function closeLeaderboard() {
  dom.lbModal.classList.add('hidden');
}

// ============================================================
// INIT
// ============================================================

function init() {
  // Draw wheel
  drawColorWheel();

  // Set initial player color
  syncSlidersFromState();
  updatePlayerPreview();

  // Generate first target
  generateTarget();

  // Update stats from localStorage
  updateStatsDisplay();

  // Bind all events
  bindEvents();
}

/** Boot sequence with loading animation */
function boot() {
  // Show loading screen, then fade out and reveal app
  setTimeout(() => {
    dom.loadingScreen.classList.add('fade-out');

    setTimeout(() => {
      dom.loadingScreen.style.display = 'none';
      dom.app.classList.remove('hidden');
      dom.app.classList.add('fade-in');
      init();
    }, 600);
  }, 1800);
}

// Start the game
boot();
