// ===== JURASSIC MULTIPLAYER: INSTANT PHONE-TO-PHONE SYNC =====
'use strict';

const CANVAS_W = 1000, CANVAS_H = 400, GROUND_Y = 320;
const GRAVITY = 0.6, JUMP_FORCE = -14;
const BASE_SPEED = 6.5, SPEED_INC = 0.0006;

// Assets
const IMAGES = { 
    bg: new Image(), dino: new Image(), p1: new Image(), p2: new Image(), bat: new Image() 
};
IMAGES.bg.src = 'static/jungle.png';
IMAGES.dino.src = 'static/dino.png';
IMAGES.p1.src = 'static/shaun.png';
IMAGES.p2.src = 'static/dean.png';
IMAGES.bat.src = 'static/bat.png';

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3'),
    screech: new Audio('https://assets.mixkit.co/active_storage/sfx/1210/1210-preview.mp3')
};

// State
let canvas, ctx, animId = null, wss = null;
let gameState = 'menu', myRole = 'spectator', speed = BASE_SPEED, score = 0, frameCount = 0;
let obstacles = [], scares = [], keys = {}, screenShake = 0;

let players = {
    shaun: { x: 150, y: GROUND_Y-150, w: 150, h: 150, vy: 0, jumps: 0, lives: 3, invincible: 0, isDucking: false },
    dean: { x: 250, y: GROUND_Y-150, w: 150, h: 150, vy: 0, jumps: 0, lives: 3, invincible: 0, isDucking: false }
};

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    showScreen('menu-screen');
}

function joinAs(role) {
    myRole = role;
    connectWSS();
    gameState = 'playing';
    SOUNDS.roar.play().catch(() => {});
    showScreen('game-screen');
    if (!animId) loop();
}

function connectWSS() {
    // SocketsBay public relay for instant multiplayer
    wss = new WebSocket('wss://socketsbay.com/wss/v2/1/jurassic-shaun-dean/');
    wss.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.role && data.role !== myRole) {
                players[data.role] = { ...players[data.role], ...data.state };
                if (data.type === 'jump') SOUNDS.jump.cloneNode().play().catch(() => {});
                if (data.type === 'scare') spawnScare(data.scareType);
            }
        } catch(err) {}
    };
}

function sendState(type = 'state') {
    if (wss && wss.readyState === WebSocket.OPEN) {
        wss.send(JSON.stringify({
            role: myRole, type: type,
            state: { x: players[myRole].x, y: players[myRole].y, vy: players[myRole].vy, lives: players[myRole].lives, isDucking: players[myRole].isDucking }
        }));
    }
}

function update() {
    if (gameState !== 'playing') return;
    frameCount++;
    score = Math.floor(frameCount / 10);
    speed += SPEED_INC;

    // SCARY SCATTER - Random Bat
    if (frameCount % 400 === 0 && Math.random() > 0.5) triggerScare();

    const me = players[myRole];
    if (me) {
        // Jump / Controls
        if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && me.y >= GROUND_Y - me.h) {
            me.vy = JUMP_FORCE; sendState('jump');
            SOUNDS.jump.cloneNode().play().catch(() => {});
        }
        me.isDucking = keys['KeyS'] || keys['ArrowDown'];
        me.h = me.isDucking ? 100 : 150;
        me.y = me.isDucking && me.y >= GROUND_Y - me.h ? GROUND_Y - me.h : me.y;

        // Physics
        me.vy += GRAVITY;
        me.y += me.vy;
        if (me.y + me.h > GROUND_Y) { me.y = GROUND_Y - me.h; me.vy = 0; }
        
        if (me.invincible > 0) me.invincible--;
        sendState();
    }

    // Master (Shaun) generates obstacles
    if (myRole === 'shaun' && frameCount % 120 === 0) {
        obstacles.push({ x: CANVAS_W, y: GROUND_Y - 40, w: 40, h: 40 });
    }

    // Sync obstacles? For a simple relay, let's keep it simple: each phone has own obstacles or Shaun relays.
    // Simplifying: Local obstacles for now to ensure NO LAG, but players see each other.
    obstacles.forEach(obs => {
        obs.x -= speed;
        [players.shaun, players.dean].forEach(p => {
            if (p.invincible === 0 && checkCollision(p, obs)) {
                if (p === me) { p.lives--; p.invincible = 90; screenShake = 15; }
            }
        });
    });
    obstacles = obstacles.filter(o => o.x + o.w > 0);

    // Update Scares
    scares.forEach(s => { s.x += s.vx; s.y += s.vy; s.opacity -= 0.005; });
    scares = scares.filter(s => s.opacity > 0);
    if (screenShake > 0) screenShake--;
    if (me && me.lives <= 0) gameOver();
}

function triggerScare() { 
    spawnScare('bat');
    if (wss && wss.readyState === WebSocket.OPEN) wss.send(JSON.stringify({ role: myRole, type: 'scare', scareType: 'bat' }));
}

function spawnScare(type) {
    if (type === 'bat') {
        scares.push({ x: CANVAS_W + 100, y: 50, w: 200, h: 100, vx: -12, vy: 1, opacity: 1 });
        SOUNDS.screech.cloneNode().play().catch(() => {});
    }
}

function checkCollision(p, o) {
    return p.x < o.x + o.w - 10 && p.x + p.w - 10 > o.x && p.y < o.y + o.h - 10 && p.y + p.h - 10 > o.y;
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const bgX = -(frameCount * (speed/2)) % CANVAS_W;
    ctx.drawImage(IMAGES.bg, bgX, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(IMAGES.bg, bgX + CANVAS_W, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CANVAS_W, GROUND_Y); ctx.stroke();

    // Draw Players
    for (let role in players) {
        const p = players[role];
        ctx.save();
        if (p.invincible % 10 < 5 && p.invincible > 0) ctx.globalAlpha = 0.3;
        ctx.drawImage(IMAGES.dino, p.x, p.y, p.w, p.h);
        ctx.restore();
    }

    obstacles.forEach(o => { ctx.fillStyle = '#4caf50'; ctx.font = '30px serif'; ctx.fillText('🌵', o.x, o.y + 30); });

    // Draw Scares
    scares.forEach(s => {
        ctx.save(); ctx.globalAlpha = s.opacity; ctx.drawImage(IMAGES.bat, s.x, s.y, s.w, s.h); ctx.restore();
    });

    document.getElementById('hud-score').innerText = score;
    updateLives('p1-lives', players.shaun.lives); updateLives('p2-lives', players.dean.lives);
}

function updateLives(id, count) {
    let html = ''; for(let i=0; i<3; i++) html += i < count ? '❤️' : '🖤';
    document.getElementById(id).innerHTML = html;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function loop() { update(); draw(); animId = requestAnimationFrame(loop); }
function gameOver() { gameState = 'gameover'; document.getElementById('go-run-score').innerText = score; showScreen('gameover-screen'); SOUNDS.dead.play().catch(() => {}); }
function restartGame() { window.location.reload(); }
function goToMenu() { window.location.reload(); }
window.onload = init;
