// =========================================================
//  SNAKE XENZIA — REMASTERED EDITION
//  Full game engine with levels, power-ups, skins, settings
// =========================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- Settings / Config ----
let cfg = {
  quality: 'high',
  difficulty: 'normal',
  skin: 'neon',
  boardTheme: 'dark',
  speed: 5,
  gridSize: 'medium',
  lives: 3,
  foodCount: 2,
  powerups: 'on',
  wallMode: 'wrap',
  showGrid: 'on',
  playerName: 'PLAYER'
};

const GRID_SIZES = { small: 20, medium: 30, large: 40 };
let COLS, ROWS, CELL;

// ---- Game State ----
let snake, dir, nextDir, foods, powerItems, particles;
let score, hiScore, level, lives, combo, comboTimer;
let gameRunning, gamePaused, gameLoop, startTime, elapsed;
let activePowerups; // {type, endTime}
let frameCount = 0;

// hi-score from localStorage
let hiScores = JSON.parse(localStorage.getItem('snakeXHiScores') || '[]');

// ---- Skin Definitions ----
const SKINS = {
  neon:    { head: '#00ff88', body1: '#00dd77', body2: '#00bb55', tail: '#009944', glow: 'rgba(0,255,136,0.6)' },
  fire:    { head: '#ff6600', body1: '#ff4400', body2: '#dd2200', tail: '#aa1100', glow: 'rgba(255,102,0,0.6)' },
  ice:     { head: '#00cfff', body1: '#00aadd', body2: '#0088bb', tail: '#006699', glow: 'rgba(0,207,255,0.6)' },
  gold:    { head: '#ffd700', body1: '#ffbb00', body2: '#dd9900', tail: '#aa7700', glow: 'rgba(255,215,0,0.6)' },
  rainbow: { head: null, body1: null, body2: null, tail: null, glow: 'rgba(255,255,255,0.4)' },
  classic: { head: '#111', body1: '#222', body2: '#333', tail: '#444', glow: 'none' }
};

const FOOD_TYPES = [
  { emoji: '🍎', value: 10, color: '#ff4444', glow: '#ff0000', size: 0.7 },
  { emoji: '🍊', value: 20, color: '#ff8800', glow: '#ff6600', size: 0.65 },
  { emoji: '💎', value: 50, color: '#00cfff', glow: '#00aaff', size: 0.6 },
  { emoji: '⭐', value: 100, color: '#ffd700', glow: '#ffaa00', size: 0.65 },
];

const POWERUP_TYPES = [
  { type: 'speed',  emoji: '⚡', color: '#ffff00', label: 'SPEED BOOST', duration: 5000 },
  { type: 'ghost',  emoji: '👻', color: '#ccccff', label: 'GHOST MODE',  duration: 6000 },
  { type: 'shield', emoji: '🛡️', color: '#00ff88', label: 'SHIELD',      duration: 8000 },
  { type: 'magnet', emoji: '🧲', color: '#ff88ff', label: 'MAGNET',      duration: 5000 },
  { type: 'slow',   emoji: '🐢', color: '#88ff44', label: 'SLOW-MO',     duration: 5000 },
];

// ---- Init ----
function init() {
  const gs = GRID_SIZES[cfg.gridSize];
  COLS = ROWS = gs;
  CELL = Math.floor(Math.min(
    (window.innerWidth < 800 ? window.innerWidth - 32 : Math.min(window.innerWidth - 400, 680)) / COLS,
    (window.innerHeight - 200) / ROWS
  ));
  CELL = Math.max(12, Math.min(CELL, 24));
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
  loadHiScore();
  renderLeaderboard();
}

function resetGame() {
  snake = [];
  const midX = Math.floor(COLS / 2);
  const midY = Math.floor(ROWS / 2);
  for (let i = 0; i < 5; i++) {
  snake.push({ x: midX - i, y: midY });
  }
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  foods = [];
  powerItems = [];
  particles = [];
  score = 0;
  level = 1;
  lives = cfg.lives;
  combo = 1;
  comboTimer = 0;
  activePowerups = {};
  frameCount = 0;
  startTime = Date.now();
  elapsed = 0;
  spawnFoods();
  updateUI();
}

// ---- Food & Powerup Spawning ----
function spawnFoods() {
  while (foods.length < cfg.foodCount) {
    const pos = randomEmpty();
    if (!pos) break;
    // Weight food types by level
    const pool = level < 3 ? [0,0,0,1] : level < 5 ? [0,0,1,1,2] : [0,1,2,2,3];
    const typeIdx = pool[Math.floor(Math.random() * pool.length)];
    foods.push({ ...pos, ...FOOD_TYPES[typeIdx], id: Math.random(), pulse: 0 });
  }
}

function maybeSpawnPowerup() {
  if (cfg.powerups === 'off') return;
  if (powerItems.length >= 2) return;
  if (Math.random() < 0.015) {
    const pos = randomEmpty();
    if (!pos) return;
    const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerItems.push({ ...pos, ...t, id: Math.random(), pulse: 0, spawnTime: Date.now(), lifetime: 8000 });
  }
}

function randomEmpty() {
  const occupied = new Set([
    ...snake.map(s => `${s.x},${s.y}`),
    ...foods.map(f => `${f.x},${f.y}`),
    ...powerItems.map(p => `${p.x},${p.y}`)
  ]);
  const empties = [];
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      if (!occupied.has(`${x},${y}`)) empties.push({ x, y });
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : null;
}

// ---- Game Loop ----
function startGame() {
  hideOverlay('startOverlay');
  resetGame();
  gameRunning = true;
  gamePaused = false;
  scheduleNext();
}

function scheduleNext() {
  if (!gameRunning) return;
  const fps = getGameSpeed();
  if (gameLoop) clearTimeout(gameLoop);
  gameLoop = setTimeout(() => {
    if (!gamePaused && gameRunning) tick();
    scheduleNext();
  }, 1000 / fps);
}

function getGameSpeed() {
  let base = cfg.speed + (level - 1) * 0.8;
  if (activePowerups.speed) base *= 2.0;
  if (activePowerups.slow)  base *= 0.5;
  const diffMult = { easy: 0.7, normal: 1, hard: 1.3, extreme: 1.6 };
  return Math.min(base * (diffMult[cfg.difficulty] || 1), 25);
}

function tick() {
  frameCount++;
  elapsed = Math.floor((Date.now() - startTime) / 1000);

  // Expire power-ups
  const now = Date.now();
  for (const [type, data] of Object.entries(activePowerups)) {
    if (now > data.endTime) {
      delete activePowerups[type];
      updatePowerupUI();
    }
  }

  // Expire power-items on board
  powerItems = powerItems.filter(p => now - p.spawnTime < p.lifetime);

  // Decay combo
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) combo = 1; }

  // Move snake
  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall handling
  if (cfg.wallMode === 'wrap' || activePowerups.ghost) {
    head.x = (head.x + COLS) % COLS;
    head.y = (head.y + ROWS) % ROWS;
  } else {
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      handleDeath();
      return;
    }
  }

  // Self-collision FIX
if (!activePowerups.ghost && !activePowerups.shield) {

  // Ignore the tail because it moves away in the same frame
  const bodyToCheck = snake.slice(0, snake.length - 1);

  const hit = bodyToCheck.some(s => s.x === head.x && s.y === head.y);

  if (hit) {
    handleDeath();
    return;
  }
}
  snake.unshift(head);

  // Check food
  let ate = false;
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    let fx = f.x, fy = f.y;
    // Magnet: attract food
    if (activePowerups.magnet) {
      const dx = head.x - fx, dy = head.y - fy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 5 && dist > 1) {
        fx = Math.round(fx + dx * 0.5);
        fy = Math.round(fy + dy * 0.5);
        foods[i].x = Math.max(0, Math.min(COLS-1, fx));
        foods[i].y = Math.max(0, Math.min(ROWS-1, fy));
      }
    }
    if (head.x === foods[i].x && head.y === foods[i].y) {
      spawnParticles(head.x, head.y, foods[i].color, 12);
      const pts = foods[i].value * combo * level;
      score += pts;
      combo = Math.min(combo + 1, 8);
      comboTimer = 15;
      foods.splice(i, 1);
      ate = true;
      // Level up check
      const nextLevelScore = level * level * 100;
      if (score >= nextLevelScore) levelUp();
      break;
    }
  }

  // Check powerup pickup
  for (let i = powerItems.length - 1; i >= 0; i--) {
    if (head.x === powerItems[i].x && head.y === powerItems[i].y) {
      collectPowerup(powerItems[i]);
      powerItems.splice(i, 1);
    }
  }

  if (!ate) snake.pop();
  spawnFoods();
  maybeSpawnPowerup();
  updateUI();
  render();
}

function handleDeath() {
  spawnParticles(snake[0].x, snake[0].y, '#ff4466', 20);
  lives--;
  updateUI();
  if (lives <= 0) {
    gameOver();
  } else {
    // Respawn
    showToast(`💀 LIFE LOST — ${lives} remaining`);
    const mid = Math.floor(COLS / 2);
    snake = [];
    for (let i = 4; i >= 0; i--) snake.push({ x: mid - i, y: mid });
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    activePowerups = {};
    updatePowerupUI();
  }
}

function gameOver() {
  gameRunning = false;
  clearTimeout(gameLoop);
  // Save score
  const entry = { name: cfg.playerName, score, level, date: new Date().toLocaleDateString() };
  hiScores.push(entry);
  hiScores.sort((a, b) => b.score - a.score);
  hiScores = hiScores.slice(0, 5);
  localStorage.setItem('snakeXHiScores', JSON.stringify(hiScores));
  hiScore = hiScores[0]?.score || 0;
  renderLeaderboard();
  document.getElementById('finalScoreText').innerHTML =
    `Score: ${score}<br>Level: ${level}<br>Length: ${snake.length}<br>Time: ${formatTime(elapsed)}`;
  showOverlay('gameOverOverlay');
  render();
}

function levelUp() {
  level++;
  const overlay = document.getElementById('levelUpOverlay');
  document.getElementById('levelUpText').innerHTML =
    `LEVEL ${level}<br>Speed increased!<br>+${level * 50} bonus pts`;
  score += level * 50;
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 2000);
  showToast(`🏆 LEVEL ${level}!`);
}

function collectPowerup(pu) {
  const endTime = Date.now() + pu.duration;
  activePowerups[pu.type] = { endTime, ...pu };
  updatePowerupUI();
  spawnParticles(pu.x, pu.y, pu.color, 15);
  showToast(`${pu.emoji} ${pu.label}!`);
}

// ---- Rendering ----
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  if (cfg.showGrid === 'on' && cfg.quality !== 'low') drawGrid();
  drawParticles();
  drawPowerItems();
  drawFoods();
  drawSnake();
}

function drawBoard() {
  const themes = {
    dark:   { bg: '#0a0a0f', line: 'rgba(255,255,255,0.02)' },
    matrix: { bg: '#000a00', line: 'rgba(0,255,0,0.05)' },
    retro:  { bg: '#8bac0f', line: 'rgba(0,0,0,0.1)' },
    neon:   { bg: '#050010', line: 'rgba(0,100,255,0.05)' },
  };
  const theme = themes[cfg.boardTheme] || themes.dark;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Vignette
  if (cfg.quality !== 'low') {
    const grad = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, 0,
      canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/1.5
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = cfg.boardTheme === 'retro'
    ? 'rgba(0,0,0,0.08)'
    : 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(canvas.width, y * CELL);
    ctx.stroke();
  }
}

function drawSnake() {
  const skin = SKINS[cfg.skin];
  const isGhost = !!activePowerups.ghost;
  const isShield = !!activePowerups.shield;
  const baseAlpha = isGhost ? 0.45 : 1;

  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    const t = i / snake.length;
    const x = s.x * CELL + 1;
    const y = s.y * CELL + 1;
    const w = CELL - 2;

    let fillColor;
    if (cfg.skin === 'rainbow') {
      const hue = ((i * 10) + frameCount * 3) % 360;
      fillColor = `hsl(${hue},100%,55%)`;
    } else if (cfg.skin === 'classic') {
      fillColor = '#222';
    } else {
      // gradient from head to tail
      const colors = [skin.head, skin.body1, skin.body2, skin.tail];
      const idx = Math.min(Math.floor(t * 3), 2);
      fillColor = lerpColor(colors[idx], colors[idx+1], (t*3) - idx);
    }

    ctx.save();
    ctx.globalAlpha = baseAlpha;

    // Glow on head
    if (i === 0 && cfg.quality !== 'low') {
      ctx.shadowBlur = cfg.quality === 'ultra' ? 20 : 12;
      ctx.shadowColor = cfg.skin === 'rainbow'
        ? `hsl(${frameCount*3%360},100%,60%)`
        : (skin.glow || 'rgba(0,255,136,0.6)');
    }

    // Shield ring
    if (i === 0 && isShield) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ff88';
      roundRect(ctx, s.x * CELL - 2, s.y * CELL - 2, CELL + 4, CELL + 4, CELL/2 + 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Body segment
    ctx.fillStyle = fillColor;
    const radius = i === 0 ? CELL * 0.45 : CELL * 0.35;
    roundRect(ctx, x, y, w, w, radius);
    ctx.fill();

    // Head details (eyes)
    if (i === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const eyeOffset = CELL * 0.25;
      const eyeR = CELL * 0.13;
      let e1x, e1y, e2x, e2y;
      if (dir.x === 1)  { e1x = x+w*0.75; e1y = y+w*0.25; e2x = x+w*0.75; e2y = y+w*0.7; }
      else if (dir.x === -1) { e1x = x+w*0.25; e1y = y+w*0.25; e2x = x+w*0.25; e2y = y+w*0.7; }
      else if (dir.y === -1) { e1x = x+w*0.25; e1y = y+w*0.25; e2x = x+w*0.7; e2y = y+w*0.25; }
      else                   { e1x = x+w*0.25; e1y = y+w*0.75; e2x = x+w*0.7; e2y = y+w*0.75; }
      ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e1x+1, e1y+1, eyeR*0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x+1, e2y+1, eyeR*0.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawFoods() {
  for (const f of foods) {
    f.pulse = (f.pulse + 0.08) % (Math.PI * 2);
    const scale = 1 + Math.sin(f.pulse) * 0.1;
    const cx = f.x * CELL + CELL / 2;
    const cy = f.y * CELL + CELL / 2;
    const r = (CELL * f.size * scale) / 2;

    ctx.save();
    if (cfg.quality !== 'low') {
      ctx.shadowBlur = cfg.quality === 'ultra' ? 18 : 10;
      ctx.shadowColor = f.glow;
    }

    // Glow circle
    if (cfg.quality === 'ultra') {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5);
      grad.addColorStop(0, f.color + '33');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Emoji on top
    ctx.shadowBlur = 0;
    ctx.font = `${Math.floor(r * 1.5)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.emoji, cx, cy);
    ctx.restore();
  }
}

function drawPowerItems() {
  const now = Date.now();
  for (const p of powerItems) {
    p.pulse = (p.pulse || 0) + 0.1;
    const age = now - p.spawnTime;
    const remaining = p.lifetime - age;
    const alpha = remaining < 2000 ? remaining / 2000 : 1;
    const scale = 1 + Math.sin(p.pulse) * 0.15;
    const cx = p.x * CELL + CELL / 2;
    const cy = p.y * CELL + CELL / 2;
    const r = (CELL * 0.65 * scale) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (cfg.quality !== 'low') {
      ctx.shadowBlur = 16;
      ctx.shadowColor = p.color;
    }

    // Spinning ring
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, p.pulse * 2, p.pulse * 2 + Math.PI * 1.5);
    ctx.stroke();

    ctx.fillStyle = p.color + '22';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.font = `${Math.floor(r * 1.4)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, cx, cy);
    ctx.restore();
  }
}

function drawParticles() {
  if (cfg.quality === 'low') { particles = []; return; }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= 0.04;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    if (cfg.quality !== 'medium') {
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnParticles(gx, gy, color, count) {
  if (cfg.quality === 'low') return;
  const cx = gx * CELL + CELL / 2;
  const cy = gy * CELL + CELL / 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = Math.random() * 3 + 1;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      r: Math.random() * 4 + 2,
      color,
      life: 1
    });
  }
}

// ---- UI Updates ----
function updateUI() {
  document.getElementById('scoreDisplay').textContent = score;
  document.getElementById('hiScoreDisplay').textContent = Math.max(hiScore, score);
  document.getElementById('levelDisplay').textContent = level;
  document.getElementById('lengthDisplay').textContent = snake.length;
  document.getElementById('speedDisplay').textContent = getGameSpeed().toFixed(1);
  document.getElementById('comboDisplay').textContent = `x${combo}`;
  document.getElementById('timeDisplay').textContent = formatTime(elapsed);
  // Lives
  const hearts = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, cfg.lives - lives));
  document.getElementById('livesDisplay').textContent = hearts || '☠️';
  // Level bar
  const pct = Math.min(100, (score / (level * level * 100)) * 100);
  document.getElementById('levelBar').style.width = pct + '%';
}

function updatePowerupUI() {
  const slots = document.getElementById('powerupSlots').children;
  const types = ['speed', 'ghost', 'shield', 'magnet'];
  for (let i = 0; i < slots.length; i++) {
    slots[i].classList.toggle('active', !!activePowerups[types[i]]);
  }
}

function loadHiScore() {
  hiScores = JSON.parse(localStorage.getItem('snakeXHiScores') || '[]');
  hiScore = hiScores[0]?.score || 0;
}

function renderLeaderboard() {
  const lb = document.getElementById('leaderboard');
  if (!hiScores.length) {
    lb.innerHTML = '<div style="font-size:8px;color:var(--muted)">No runs yet</div>';
    return;
  }
  lb.innerHTML = hiScores.slice(0, 5).map((e, i) =>
    `<div class="lb-row">
      <span class="lb-rank">#${i+1}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-score">${e.score}</span>
    </div>`
  ).join('');
}

// ---- Controls ----
const KEY_MAP = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
  W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT'
};

document.addEventListener('keydown', e => {
  const mapped = KEY_MAP[e.key];
  if (mapped) { setDir(mapped); e.preventDefault(); }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  if (e.key === ' ') {
    if (!gameRunning) startGame();
    e.preventDefault();
  }
});

function setDir(d) {
  if (!gameRunning || gamePaused) return;
  const map = {
    UP:    { x: 0, y: -1 },
    DOWN:  { x: 0, y: 1 },
    LEFT:  { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };
  const nd = map[d];
  // Prevent reversing
  if (nd.x === -dir.x && nd.y === -dir.y) return;
  nextDir = nd;
}

function mobileDir(d) {
  setDir(d);
  const btn = document.getElementById('btn' + d[0] + d.slice(1).toLowerCase());
  if (btn) btn.classList.add('pressed');
}
function mobileRelease(d) {
  const btn = document.getElementById('btn' + d[0] + d.slice(1).toLowerCase());
  if (btn) btn.classList.remove('pressed');
}

// Touch swipe on canvas
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDir(dx > 0 ? 'RIGHT' : 'LEFT');
  } else {
    setDir(dy > 0 ? 'DOWN' : 'UP');
  }
  touchStart = null;
  e.preventDefault();
}, { passive: false });

// ---- Game Control Functions ----
function togglePause() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  if (gamePaused) {
    showOverlay('pauseOverlay');
  } else {
    hideOverlay('pauseOverlay');
    scheduleNext();
  }
}

function resumeGame() {
  if (gamePaused) togglePause();
}

function restartGame() {
  gameRunning = false;
  clearTimeout(gameLoop);
  hideAllOverlays();
  startGame();
}

function goMenu() {
  gameRunning = false;
  clearTimeout(gameLoop);
  hideAllOverlays();
  showOverlay('startOverlay');
  renderBoard_static();
}

function renderBoard_static() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawGrid();
    // Draw decorative snake
    ctx.fillStyle = '#00ff8844';
    for (let i = 0; i < 8; i++) {
      roundRect(ctx, (i+3)*CELL+1, ROWS/2*CELL+1, CELL-2, CELL-2, CELL*0.4);
      ctx.fill();
    }
  }
}

// ---- Settings ----
function showSettings() {
  document.getElementById('settingsPanel').style.display = 'block';
  document.getElementById('settingsPanel').scrollIntoView({ behavior: 'smooth' });
}

function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

function applySettings() {
  cfg.quality     = document.getElementById('qualitySelect').value;
  cfg.difficulty  = document.getElementById('diffSelect').value;
  cfg.skin        = document.getElementById('skinSelect').value;
  cfg.boardTheme  = document.getElementById('boardThemeSelect').value;
  cfg.speed       = parseInt(document.getElementById('speedRange').value);
  cfg.gridSize    = document.getElementById('gridSelect').value;
  cfg.lives       = parseInt(document.getElementById('livesRange').value);
  cfg.foodCount   = parseInt(document.getElementById('foodRange').value);
  cfg.powerups    = document.getElementById('powerupSelect').value;
  cfg.wallMode    = document.getElementById('wallSelect').value;
  cfg.showGrid    = document.getElementById('gridLineSelect').value;
  cfg.playerName  = document.getElementById('playerNameInput').value.toUpperCase() || 'PLAYER';
  hideSettings();
  init();
  restartGame();
}

function resetSettings() {
  document.getElementById('qualitySelect').value   = 'high';
  document.getElementById('diffSelect').value      = 'normal';
  document.getElementById('skinSelect').value      = 'neon';
  document.getElementById('boardThemeSelect').value= 'dark';
  document.getElementById('speedRange').value      = '5';
  document.getElementById('speedVal').textContent  = '5';
  document.getElementById('gridSelect').value      = 'medium';
  document.getElementById('livesRange').value      = '3';
  document.getElementById('livesVal').textContent  = '3';
  document.getElementById('foodRange').value       = '2';
  document.getElementById('foodVal').textContent   = '2';
  document.getElementById('powerupSelect').value   = 'on';
  document.getElementById('wallSelect').value      = 'wrap';
  document.getElementById('gridLineSelect').value  = 'on';
  document.getElementById('playerNameInput').value = 'PLAYER';
  showToast('Settings reset to defaults');
}

// Range live update
document.getElementById('speedRange').addEventListener('input', function() {
  document.getElementById('speedVal').textContent = this.value;
});
document.getElementById('livesRange').addEventListener('input', function() {
  document.getElementById('livesVal').textContent = this.value;
});
document.getElementById('foodRange').addEventListener('input', function() {
  document.getElementById('foodVal').textContent = this.value;
});

// ---- Overlay helpers ----
function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}
function hideAllOverlays() {
  ['startOverlay','pauseOverlay','gameOverOverlay','levelUpOverlay'].forEach(hideOverlay);
}

// ---- Toast ----
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ---- Utilities ----
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lerpColor(a, b, t) {
  if (!a || !b) return a || b || '#00ff88';
  const ah = a.replace('#','');
  const bh = b.replace('#','');
  const ar = parseInt(ah.substring(0,2),16);
  const ag = parseInt(ah.substring(2,4),16);
  const ab = parseInt(ah.substring(4,6),16);
  const br = parseInt(bh.substring(0,2),16);
  const bg = parseInt(bh.substring(2,4),16);
  const bb = parseInt(bh.substring(4,6),16);
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

// ---- Resize handling ----
window.addEventListener('resize', () => {
  init();
  if (!gameRunning) renderBoard_static();
});

// ---- Boot ----
init();
renderBoard_static();
renderLeaderboard();