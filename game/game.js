// ===== JURASSIC PARK: DUO EDITION - LOCAL VERSUS + JUMP SCARES =====
'use strict';

const CANVAS_W = 1000, CANVAS_H = 400, GROUND_Y = 320;
const GRAVITY = 0.6, JUMP_FORCE = -14, DOUBLE_JUMP_FORCE = -11;
const BASE_SPEED = 6.5, SPEED_INC = 0.0006;

const IMAGES = { 
    bg: new Image(), dino: new Image(), p1: new Image(), p2: new Image(),
    pterodactyl: new Image(), raptor: new Image()
};
IMAGES.bg.src = 'static/jungle.png';
IMAGES.dino.src = 'static/dino.png';
IMAGES.p1.src = 'static/shaun.png';
IMAGES.p2.src = 'static/dean.png';
IMAGES.pterodactyl.src = 'static/pterodactyl.png';
IMAGES.raptor.src = 'static/raptor.png';

let canvas, ctx, animId = null;
let gameState = 'menu', speed = BASE_SPEED, score = 0, frameCount = 0;
let obstacles = [], scares = [], keys = {}, screenShake = 0;

let player1 = null;
let player2 = null;

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3'),
    screech: new Audio('https://assets.mixkit.co/active_storage/sfx/1210/1210-preview.mp3')
};

class Player {
    constructor(id, name, color, xOffset) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.x = xOffset;
        this.y = GROUND_Y - 130;
        this.w = 130;
        this.h = 130;
        this.vy = 0;
        this.isJumping = false;
        this.jumps = 0;
        this.isDucking = false;
        this.lives = 3;
        this.invincible = 0;
    }

    update() {
        if (this.invincible > 0) this.invincible--;
        this.vy += GRAVITY;
        this.y += this.vy;

        if (this.y + this.h > GROUND_Y) {
            this.y = GROUND_Y - this.h;
            this.vy = 0;
            this.isJumping = false;
            this.jumps = 0;
        }
    }

    draw() {
        ctx.save();
        if (this.invincible % 10 < 5 && this.invincible > 0) ctx.globalAlpha = 0.3;
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        if (this.vy < -2) ctx.rotate(-0.05);
        if (this.vy > 2) ctx.rotate(0.05);
        ctx.drawImage(IMAGES.dino, -this.w/2, -this.h/2, this.w, this.h);
        ctx.restore();
    }
}

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    showScreen('menu-screen');
}

function startVSMode() {
    gameState = 'playing';
    speed = BASE_SPEED;
    score = 0;
    frameCount = 0;
    obstacles = [];
    scares = [];
    player1 = new Player('p1', 'שון', '#4caf50', 150);
    player2 = new Player('p2', 'דין', '#2196f3', 250);
    player1.invincible = 120;
    player2.invincible = 120;
    SOUNDS.roar.play().catch(() => {});
    showScreen('game-screen');
    if (!animId) loop();
}

function update() {
    if (gameState !== 'playing') return;
    frameCount++;
    score = Math.floor(frameCount / 10);
    speed += SPEED_INC;

    // SCARY JUMP SCARES - Low probability trigger
    if (frameCount % (60 * 12) === 0 && Math.random() > 0.4) {
        triggerJumpScare();
    }

    // Input P1
    if ((keys['KeyW'] || keys['Space']) && !player1.isJumping) {
        player1.vy = JUMP_FORCE; player1.isJumping = true;
        SOUNDS.jump.cloneNode().play().catch(() => {});
    }
    player1.isDucking = keys['KeyS'];
    player1.h = player1.isDucking ? 80 : 130;
    player1.y = player1.isDucking && !player1.isJumping ? GROUND_Y - 80 : player1.y;
    player1.update();

    // Input P2
    if (keys['ArrowUp'] && !player2.isJumping) {
        player2.vy = JUMP_FORCE; player2.isJumping = true;
        SOUNDS.jump.cloneNode().play().catch(() => {});
    }
    player2.isDucking = keys['ArrowDown'];
    player2.h = player2.isDucking ? 80 : 130;
    player2.y = player2.isDucking && !player2.isJumping ? GROUND_Y - 80 : player2.y;
    player2.update();

    // Obstacles
    if (frameCount % Math.max(60, Math.floor(100 - speed * 2)) === 0) {
        obstacles.push({ x: CANVAS_W, y: GROUND_Y - 40, w: 40, h: 40, type: Math.random() > 0.7 ? 'vulture' : 'cactus' });
    }
    obstacles.forEach(obs => {
        obs.x -= speed;
        if (obs.type === 'vulture') obs.y = GROUND_Y - 80 + Math.sin(frameCount/10)*20;
        [player1, player2].forEach(p => {
            if (p.invincible === 0 && checkCollision(p, obs)) {
                p.lives--; p.invincible = 90; screenShake = 15;
                document.getElementById('damage-flash').style.opacity = '1';
                setTimeout(() => document.getElementById('damage-flash').style.opacity = '0', 200);
            }
        });
    });
    obstacles = obstacles.filter(o => o.x + o.w > 0);

    // Update Scares
    scares.forEach(s => { s.x += s.vx; s.y += s.vy; s.opacity -= 0.005; });
    scares = scares.filter(s => s.opacity > 0 && s.x < CANVAS_W + 200 && s.x > -200);

    if (player1.lives <= 0 || player2.lives <= 0) gameOver();
    if (screenShake > 0) screenShake--;
}

function triggerJumpScare() {
    const isRaptor = Math.random() > 0.5;
    if (isRaptor) {
        scares.push({ x: CANVAS_W + 100, y: GROUND_Y - 150, w: 200, h: 200, vx: -15, vy: -2, type: 'raptor', opacity: 1 });
        SOUNDS.roar.cloneNode().play().catch(() => {});
    } else {
        scares.push({ x: -200, y: 50, w: 250, h: 150, vx: 12, vy: 1, type: 'pterodactyl', opacity: 1 });
        SOUNDS.screech.cloneNode().play().catch(() => {});
    }
    screenShake = 10;
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

    player1.draw(); player2.draw();
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.type === 'vulture' ? '#ff5722' : '#4caf50'; ctx.font = '30px serif';
        ctx.fillText(obs.type === 'vulture' ? '🦅' : '🌵', obs.x, obs.y + 30);
    });

    // Draw Jump Scares
    scares.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.opacity;
        ctx.filter = `blur(${Math.max(0, 2 - s.opacity * 2)}px)`;
        const img = s.type === 'raptor' ? IMAGES.raptor : IMAGES.pterodactyl;
        ctx.drawImage(img, s.x, s.y, s.w, s.h);
        ctx.restore();
    });

    document.getElementById('hud-score').innerText = score;
    updateLives('p1-lives', player1.lives); updateLives('p2-lives', player2.lives);
}

function updateLives(id, count) {
    let html = '';
    for(let i=0; i<3; i++) html += i < count ? '❤️' : '🖤';
    document.getElementById(id).innerHTML = html;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function loop() { update(); draw(); animId = requestAnimationFrame(loop); }
function gameOver() { gameState = 'gameover'; document.getElementById('go-run-score').innerText = score; showScreen('gameover-screen'); SOUNDS.dead.play().catch(() => {}); }
function restartGame() { startVSMode(); }
function goToMenu() { gameState = 'menu'; showScreen('menu-screen'); }
window.onload = init;
