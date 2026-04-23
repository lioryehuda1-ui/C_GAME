// =============================
//  DINO RUNNER - Din & Shon
// =============================

const CANVAS_W = 700;
const CANVAS_H = 220;
const GROUND_Y = 165;
const HUD_H = 60;

const CHARACTERS = {
  din: {
    name: 'דין',
    color: '#4CAF50',
    darkColor: '#2e7d32',
    eyeColor: '#fff',
    ability: 'doubleJump',
    jumpForce: -13,
    gravity: 0.6,
    description: 'קפיצה כפולה!'
  },
  shon: {
    name: 'שון',
    color: '#FF7043',
    darkColor: '#bf360c',
    eyeColor: '#fff',
    ability: 'highJump',
    jumpForce: -16,
    gravity: 0.7,
    description: 'קפיצה גבוהה!'
  }
};

// ---- Game State ----
let state = 'SELECT'; // SELECT | PLAYING | DEAD
let selectedChar = null;
let score = 0;
let hiScore = { din: 0, shon: 0 };
let lives = 3;
let maxLives = 5;
let speed = 4;
let frameCount = 0;
let invincible = 0; // frames of invincibility after hit
let lastLifeBonus = 0;

// ---- Player ----
let player = {
  x: 80,
  y: GROUND_Y,
  vy: 0,
  jumpsLeft: 0,
  maxJumps: 1,
  isOnGround: true,
  w: 38,
  h: 48,
};

// ---- Obstacles ----
let obstacles = [];
let nextObstacle = 80;

// ---- Clouds ----
let clouds = [
  { x: 100, y: 30, r: 18 },
  { x: 300, y: 20, r: 14 },
  { x: 550, y: 40, r: 20 },
];

// ---- Stars ----
let stars = [];
for (let i = 0; i < 30; i++) {
  stars.push({ x: Math.random() * CANVAS_W, y: Math.random() * 80 });
}

// ---- Load high scores ----
function loadScores() {
  try {
    const s = JSON.parse(localStorage.getItem('dinoHi') || '{}');
    hiScore.din = s.din || 0;
    hiScore.shon = s.shon || 0;
  } catch (e) {}
}

function saveScore(charKey, val) {
  try {
    hiScore[charKey] = Math.max(hiScore[charKey], val);
    localStorage.setItem('dinoHi', JSON.stringify(hiScore));
  } catch (e) {}
}

// ---- Init player for character ----
function initPlayer(charKey) {
  const ch = CHARACTERS[charKey];
  player.x = 80;
  player.y = GROUND_Y;
  player.vy = 0;
  player.isOnGround = true;
  player.maxJumps = ch.ability === 'doubleJump' ? 2 : 1;
  player.jumpsLeft = player.maxJumps;
}

function startGame(charKey) {
  selectedChar = charKey;
  state = 'PLAYING';
  score = 0;
  lives = 3;
  speed = 4;
  frameCount = 0;
  obstacles = [];
  nextObstacle = 80;
  invincible = 0;
  lastLifeBonus = 0;
  initPlayer(charKey);
}

// ---- Jump ----
function jump() {
  if (state === 'SELECT') return;
  if (state === 'DEAD') {
    startGame(selectedChar);
    return;
  }
  if (player.jumpsLeft > 0) {
    player.vy = CHARACTERS[selectedChar].jumpForce;
    player.jumpsLeft--;
    player.isOnGround = false;
  }
}

// ---- Obstacle generation ----
function spawnObstacle() {
  const types = ['rock', 'tree', 'egg'];
  const type = types[Math.floor(Math.random() * types.length)];
  let w, h, y;
  if (type === 'rock') {
    w = 28 + Math.random() * 16;
    h = 22 + Math.random() * 12;
    y = GROUND_Y + 48 - h;
  } else if (type === 'tree') {
    w = 18;
    h = 50 + Math.random() * 20;
    y = GROUND_Y + 48 - h;
  } else {
    w = 26;
    h = 26;
    y = GROUND_Y + 48 - h;
  }
  obstacles.push({ type, x: CANVAS_W + 10, y, w, h });
}

// ---- Update ----
function update() {
  if (state !== 'PLAYING') return;
  frameCount++;
  score = Math.floor(frameCount / 6);

  // Life bonus every 1000 pts
  const bonusThreshold = Math.floor(score / 1000);
  if (bonusThreshold > lastLifeBonus) {
    lastLifeBonus = bonusThreshold;
    if (lives < maxLives) lives++;
  }

  // Speed up
  speed = 4 + Math.floor(score / 300) * 0.5;
  if (speed > 14) speed = 14;

  // Gravity
  const ch = CHARACTERS[selectedChar];
  player.vy += ch.gravity;
  player.y += player.vy;

  const groundLine = GROUND_Y;
  if (player.y >= groundLine) {
    player.y = groundLine;
    player.vy = 0;
    player.isOnGround = true;
    player.jumpsLeft = player.maxJumps;
  }

  // Move clouds
  clouds.forEach(c => {
    c.x -= 0.4;
    if (c.x < -40) c.x = CANVAS_W + 40;
  });

  // Obstacles
  nextObstacle--;
  if (nextObstacle <= 0) {
    spawnObstacle();
    nextObstacle = 55 + Math.floor(Math.random() * 60) - Math.floor(speed * 2);
    if (nextObstacle < 35) nextObstacle = 35;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].x + obstacles[i].w < 0) {
      obstacles.splice(i, 1);
      continue;
    }

    // Collision
    if (invincible <= 0) {
      const px = player.x + 4;
      const py = player.y - player.h + 4;
      const pw = player.w - 8;
      const ph = player.h - 4;
      const ob = obstacles[i];

      if (
        px < ob.x + ob.w &&
        px + pw > ob.x &&
        py < ob.y + ob.h &&
        py + ph > ob.y
      ) {
        lives--;
        invincible = 90;
        obstacles.splice(i, 1);
        if (lives <= 0) {
          state = 'DEAD';
          saveScore(selectedChar, score);
        }
      }
    }
  }

  if (invincible > 0) invincible--;
}

// ---- Drawing Utilities ----
function drawRoundRect(ctx, x, y, w, h, r, fill, stroke) {
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
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// ---- Draw Dino ----
function drawDino(ctx, x, y, w, h, charKey, walking, hit) {
  const ch = CHARACTERS[charKey];
  const color = hit ? '#fff' : ch.color;
  const dark = hit ? '#ccc' : ch.darkColor;

  // Body
  drawRoundRect(ctx, x + w * 0.15, y + h * 0.3, w * 0.6, h * 0.55, 6, color);

  // Head
  drawRoundRect(ctx, x + w * 0.3, y, w * 0.55, h * 0.42, 8, color);

  // Snout
  drawRoundRect(ctx, x + w * 0.7, y + h * 0.12, w * 0.28, h * 0.22, 4, dark);

  // Eye
  ctx.beginPath();
  ctx.arc(x + w * 0.62, y + h * 0.14, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.62 - 1.5, y + h * 0.14 - 1.5, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Nostril
  ctx.beginPath();
  ctx.arc(x + w * 0.88, y + h * 0.2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = dark;
  ctx.fill();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.55);
  ctx.quadraticCurveTo(x - w * 0.1, y + h * 0.45, x, y + h * 0.35);
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Legs (walking animation)
  const legOff = walking ? Math.sin(frameCount * 0.25) * 5 : 0;
  // Front leg
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.82);
  ctx.lineTo(x + w * 0.65 + legOff, y + h);
  ctx.lineWidth = 7;
  ctx.strokeStyle = dark;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Back leg
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y + h * 0.82);
  ctx.lineTo(x + w * 0.4 - legOff, y + h);
  ctx.stroke();

  // Arm
  ctx.beginPath();
  ctx.moveTo(x + w * 0.68, y + h * 0.45);
  ctx.lineTo(x + w * 0.85, y + h * 0.52);
  ctx.lineWidth = 5;
  ctx.strokeStyle = dark;
  ctx.stroke();

  // Spikes on back (for שון T-Rex)
  if (charKey === 'shon') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w * (0.3 + i * 0.12), y + h * 0.3);
      ctx.lineTo(x + w * (0.34 + i * 0.12), y + h * 0.12);
      ctx.lineTo(x + w * (0.38 + i * 0.12), y + h * 0.3);
      ctx.fillStyle = dark;
      ctx.fill();
    }
  }

  // Long neck for דין Diplodocus
  if (charKey === 'din') {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, y + h * 0.1);
    ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.2, x + w * 0.75, y - h * 0.1);
    ctx.lineWidth = 10;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

// ---- Draw Face (HUD) ----
function drawFace(ctx, x, y, size, charKey, active) {
  const ch = CHARACTERS[charKey];
  const border = active ? ch.color : '#555';

  // Card background
  drawRoundRect(ctx, x, y, size, size, 8, '#1a1a2e', border);
  if (active) {
    ctx.shadowColor = ch.color;
    ctx.shadowBlur = 10;
  }

  // Face circle
  const cx = x + size / 2;
  const cy = y + size * 0.42;
  const r = size * 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ch.color;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dino head bumps
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = ch.darkColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.3, cy - r, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = ch.darkColor;
  ctx.fill();

  // Eyes
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  // Eye shine
  ctx.beginPath();
  ctx.arc(cx - r * 0.35 - 2, cy - r * 0.1 - 2, r * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.35 - 2, cy - r * 0.1 - 2, r * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Smile
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.25, r * 0.35, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Name
  ctx.fillStyle = active ? '#fff' : '#888';
  ctx.font = `bold ${size * 0.22}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(ch.name, cx, y + size * 0.9);
}

// ---- Draw Heart ----
function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.beginPath();
  const s = size * 0.4;
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(-s * 1.2, -s * 0.9, -s * 2.2, s * 0.4, 0, s * 1.4);
  ctx.bezierCurveTo(s * 2.2, s * 0.4, s * 1.2, -s * 0.9, 0, s * 0.3);
  ctx.fillStyle = filled ? '#e53935' : '#333';
  ctx.fill();
  if (filled) {
    ctx.shadowColor = '#ff5252';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// ---- Draw Obstacle ----
function drawObstacle(ctx, ob) {
  if (ob.type === 'rock') {
    const grd = ctx.createRadialGradient(
      ob.x + ob.w * 0.4, ob.y + ob.h * 0.3, 2,
      ob.x + ob.w * 0.5, ob.y + ob.h * 0.5, ob.w
    );
    grd.addColorStop(0, '#9e9e9e');
    grd.addColorStop(1, '#424242');
    drawRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 6, null, null);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (ob.type === 'tree') {
    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(ob.x + ob.w * 0.3, ob.y + ob.h * 0.55, ob.w * 0.4, ob.h * 0.45);
    // Foliage layers
    const leafColor = '#2e7d32';
    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.moveTo(ob.x + ob.w * 0.5, ob.y);
    ctx.lineTo(ob.x + ob.w, ob.y + ob.h * 0.45);
    ctx.lineTo(ob.x, ob.y + ob.h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#388e3c';
    ctx.beginPath();
    ctx.moveTo(ob.x + ob.w * 0.5, ob.y + ob.h * 0.15);
    ctx.lineTo(ob.x + ob.w * 0.95, ob.y + ob.h * 0.6);
    ctx.lineTo(ob.x + ob.w * 0.05, ob.y + ob.h * 0.6);
    ctx.closePath();
    ctx.fill();
  } else {
    // Egg
    ctx.save();
    ctx.translate(ob.x + ob.w / 2, ob.y + ob.h / 2);
    ctx.scale(1, 1.25);
    ctx.beginPath();
    ctx.arc(0, 0, ob.w / 2, 0, Math.PI * 2);
    const grd = ctx.createRadialGradient(-ob.w * 0.15, -ob.h * 0.2, 1, 0, 0, ob.w / 2);
    grd.addColorStop(0, '#fff9c4');
    grd.addColorStop(1, '#f9a825');
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Spots
    ctx.fillStyle = '#ff6f00';
    [[-.2, -.1], [.2, .1], [-.1, .2]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx * ob.w, dy * ob.w, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

// ---- Draw Background ----
function drawBackground(ctx, timeOfDay) {
  // Sky gradient
  const skyGrd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (score < 500) {
    skyGrd.addColorStop(0, '#1a237e');
    skyGrd.addColorStop(1, '#283593');
  } else if (score < 1500) {
    skyGrd.addColorStop(0, '#4a148c');
    skyGrd.addColorStop(1, '#7b1fa2');
  } else {
    skyGrd.addColorStop(0, '#b71c1c');
    skyGrd.addColorStop(1, '#e53935');
  }
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // Stars
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  });

  // Clouds
  clouds.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.arc(c.x + c.r, c.y - c.r * 0.4, c.r * 0.75, 0, Math.PI * 2);
    ctx.arc(c.x - c.r, c.y - c.r * 0.3, c.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
  });

  // Ground
  const groundGrd = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 55);
  groundGrd.addColorStop(0, '#4e342e');
  groundGrd.addColorStop(0.3, '#3e2723');
  groundGrd.addColorStop(1, '#1a0c09');
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 55);

  // Ground line
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);
}

// ---- Draw HUD ----
function drawHUD(ctx) {
  const hudY = CANVAS_H + 1;

  // HUD background
  const hudGrd = ctx.createLinearGradient(0, hudY, 0, hudY + HUD_H);
  hudGrd.addColorStop(0, '#0d0d1a');
  hudGrd.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = hudGrd;
  ctx.fillRect(0, hudY, CANVAS_W, HUD_H);

  // Top separator
  ctx.fillStyle = selectedChar ? CHARACTERS[selectedChar].color : '#444';
  ctx.fillRect(0, hudY, CANVAS_W, 2);

  if (!selectedChar) return;

  const ch = CHARACTERS[selectedChar];

  // Character face
  const faceSize = 44;
  const faceX = 8;
  const faceY = hudY + (HUD_H - faceSize) / 2;
  drawFace(ctx, faceX, faceY, faceSize, selectedChar, true);

  // Lives
  const heartSize = 20;
  const heartsStartX = faceX + faceSize + 12;
  const heartsY = hudY + (HUD_H - heartSize) / 2;
  for (let i = 0; i < maxLives; i++) {
    drawHeart(ctx, heartsStartX + i * (heartSize + 4), heartsY, heartSize, i < lives);
  }

  // Score
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${score}`, CANVAS_W - 12, hudY + 24);

  ctx.fillStyle = '#90a4ae';
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`שיא: ${hiScore[selectedChar]}`, CANVAS_W - 12, hudY + 42);

  // Speed indicator
  const speedLabel = speed < 7 ? '🐢' : speed < 11 ? '🦕' : '🔥';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#80cbc4';
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`מהירות: ${speedLabel}`, heartsStartX, hudY + 44);
}

// ---- Draw Select Screen ----
function drawSelectScreen(ctx) {
  // Background
  const bgGrd = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bgGrd.addColorStop(0, '#1a237e');
  bgGrd.addColorStop(1, '#283593');
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  });

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = '#7c4dff';
  ctx.shadowBlur = 15;
  ctx.fillText('🦕 DINO RUNNER 🦖', CANVAS_W / 2, 45);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#b0bec5';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText('בחר את הדמות שלך', CANVAS_W / 2, 72);

  // Character cards
  const cardW = 190;
  const cardH = 110;
  const gap = 40;
  const totalW = cardW * 2 + gap;
  const startX = (CANVAS_W - totalW) / 2;
  const cardY = 85;

  ['din', 'shon'].forEach((key, i) => {
    const ch = CHARACTERS[key];
    const cx = startX + i * (cardW + gap);

    // Card
    const hover = false;
    drawRoundRect(ctx, cx, cardY, cardW, cardH, 12,
      `rgba(${key === 'din' ? '76,175,80' : '255,112,67'},0.15)`,
      ch.color);

    ctx.shadowColor = ch.color;
    ctx.shadowBlur = 8;

    // Draw mini dino
    drawDino(ctx, cx + 12, cardY + 8, 60, 75, key, true, false);
    ctx.shadowBlur = 0;

    // Character name
    ctx.fillStyle = ch.color;
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, cx + cardW * 0.68, cardY + 30);

    // Ability
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(ch.description, cx + cardW * 0.68, cardY + 50);

    // High score
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`שיא: ${hiScore[key]}`, cx + cardW * 0.68, cardY + 72);

    // Click hint
    ctx.fillStyle = '#80cbc4';
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('לחץ לבחירה', cx + cardW * 0.68, cardY + 92);

    // Store card bounds for click detection
    CHAR_CARDS[key] = { x: cx, y: cardY, w: cardW, h: cardH };
  });

  // Ground
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 55);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);
}

const CHAR_CARDS = {};

// ---- Draw Dead Screen ----
function drawDeadScreen(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350';
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = '#b71c1c';
  ctx.shadowBlur = 20;
  ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);
  ctx.shadowBlur = 0;

  const ch = CHARACTERS[selectedChar];
  ctx.fillStyle = '#fff';
  ctx.font = '18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${ch.name} רץ ${score} מטרים!`, CANVAS_W / 2, CANVAS_H / 2 + 4);

  if (score >= hiScore[selectedChar]) {
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('🏆 שיא חדש!', CANVAS_W / 2, CANVAS_H / 2 + 28);
  }

  ctx.fillStyle = '#80cbc4';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('לחץ Space / לחץ כפיצה לנסות שוב', CANVAS_W / 2, CANVAS_H / 2 + 52);
}

// ---- Main Draw ----
function draw(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H + HUD_H);

  if (state === 'SELECT') {
    drawSelectScreen(ctx);
    drawHUD(ctx);
    return;
  }

  drawBackground(ctx);

  // Obstacles
  obstacles.forEach(ob => drawObstacle(ctx, ob));

  // Player (blink when invincible)
  if (invincible <= 0 || Math.floor(invincible / 6) % 2 === 0) {
    drawDino(
      ctx,
      player.x,
      player.y - player.h,
      player.w,
      player.h,
      selectedChar,
      player.isOnGround,
      invincible > 0
    );
  }

  if (state === 'DEAD') drawDeadScreen(ctx);

  drawHUD(ctx);
}

// ---- Main Loop ----
function gameLoop(ctx) {
  update();
  draw(ctx);
  requestAnimationFrame(() => gameLoop(ctx));
}

// ---- Input Handlers ----
function handleClick(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = (CANVAS_H + HUD_H) / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  if (state === 'SELECT') {
    for (const [key, card] of Object.entries(CHAR_CARDS)) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        startGame(key);
        return;
      }
    }
  } else {
    jump();
  }
}

function handleTouch(e, canvas) {
  e.preventDefault();
  const touch = e.changedTouches[0];
  handleClick(touch, canvas);
}

// ---- Bootstrap ----
function init(canvasId) {
  loadScores();
  const canvas = document.getElementById(canvasId);
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H + HUD_H;
  const ctx = canvas.getContext('2d');

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'SELECT') return;
      jump();
    }
  });

  canvas.addEventListener('click', e => handleClick(e, canvas));
  canvas.addEventListener('touchstart', e => handleTouch(e, canvas), { passive: false });

  gameLoop(ctx);
}
