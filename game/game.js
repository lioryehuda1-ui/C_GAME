// ===== JURASSIC PARK: DUO EDITION - LOCAL VERSUS =====
'use strict';

const CANVAS_W = 1000, CANVAS_H = 400, GROUND_Y = 320;
const GRAVITY = 0.6, JUMP_FORCE = -14, DOUBLE_JUMP_FORCE = -11;
const BASE_SPEED = 6.5, SPEED_INC = 0.0006;

const IMAGES = { bg: new Image(), dino: new Image(), p1: new Image(), p2: new Image() };
IMAGES.bg.src = 'static/jungle.png';
IMAGES.dino.src = 'static/dino.png';
IMAGES.p1.src = 'static/shaun.png';
IMAGES.p2.src = 'static/dean.png';

let canvas, ctx, animId = null;
let gameState = 'menu', speed = BASE_SPEED, score = 0, frameCount = 0;
let obstacles = [], keys = {}, screenShake = 0;

let player1 = null;
let player2 = null;

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3')
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

        // Draw Dino Body
        ctx.drawImage(IMAGES.dino, -this.w/2, -this.h/2, this.w, this.h);

        // Overlay Player Face (Higher and slightly forward for T-Rex)
        const faceImg = this.id === 'p1' ? IMAGES.p1 : IMAGES.p2;
        if (faceImg.complete && faceImg.naturalWidth !== 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(5, -28, 22, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(faceImg, -18, -50, 46, 46);
            ctx.restore();
        }
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
    
    player1 = new Player('p1', 'שון', '#4caf50', 150);
    player2 = new Player('p2', 'דין', '#2196f3', 250);
    
    // Grace period
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

    // Handle Input P1 (Shaun): W/Space/S
    if ((keys['KeyW'] || keys['Space']) && !player1.isJumping) {
        player1.vy = JUMP_FORCE;
        player1.isJumping = true;
        SOUNDS.jump.cloneNode().play().catch(() => {});
    }
    player1.isDucking = keys['KeyS'];
    player1.h = player1.isDucking ? 80 : 130;
    player1.y = player1.isDucking && !player1.isJumping ? GROUND_Y - 80 : player1.y;
    player1.update();

    // Handle Input P2 (Dean): Arrows
    if (keys['ArrowUp'] && !player2.isJumping) {
        player2.vy = JUMP_FORCE;
        player2.isJumping = true;
        SOUNDS.jump.cloneNode().play().catch(() => {});
    }
    player2.isDucking = keys['ArrowDown'];
    player2.h = player2.isDucking ? 80 : 130;
    player2.y = player2.isDucking && !player2.isJumping ? GROUND_Y - 80 : player2.y;
    player2.update();

    // Obstacles
    if (frameCount % Math.max(60, Math.floor(100 - speed * 2)) === 0) {
        obstacles.push({
            x: CANVAS_W,
            y: GROUND_Y - 40,
            w: 40,
            h: 40,
            type: Math.random() > 0.7 ? 'vulture' : 'cactus'
        });
    }

    obstacles.forEach((obs, idx) => {
        obs.x -= speed;
        if (obs.type === 'vulture') obs.y = GROUND_Y - 80 + Math.sin(frameCount/10)*20;

        // Collision Check
        [player1, player2].forEach(p => {
            if (p.invincible === 0 && checkCollision(p, obs)) {
                p.lives--;
                p.invincible = 90;
                screenShake = 15;
                document.getElementById('damage-flash').style.opacity = '1';
                setTimeout(() => document.getElementById('damage-flash').style.opacity = '0', 200);
            }
        });
    });

    obstacles = obstacles.filter(o => o.x + o.w > 0);
    
    if (player1.lives <= 0 || player2.lives <= 0) gameOver();
    if (screenShake > 0) screenShake--;
}

function checkCollision(p, o) {
    return p.x < o.x + o.w - 10 && p.x + p.w - 10 > o.x &&
           p.y < o.y + o.h - 10 && p.y + p.h - 10 > o.y;
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    
    // Parallax Background
    const bgX = -(frameCount * (speed/2)) % CANVAS_W;
    ctx.drawImage(IMAGES.bg, bgX, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(IMAGES.bg, bgX + CANVAS_W, 0, CANVAS_W, CANVAS_H);

    // Ground Line
    ctx.strokeStyle = '#3d2b1f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CANVAS_W, GROUND_Y); ctx.stroke();

    // Characters
    player1.draw();
    player2.draw();

    // Obstacles
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.type === 'vulture' ? '#ff5722' : '#4caf50';
        ctx.font = '30px serif';
        ctx.fillText(obs.type === 'vulture' ? '🦅' : '🌵', obs.x, obs.y + 30);
    });

    // Update HUD
    document.getElementById('hud-score').innerText = score;
    updateLives('p1-lives', player1.lives);
    updateLives('p2-lives', player2.lives);
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

function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
}

function gameOver() {
    gameState = 'gameover';
    document.getElementById('go-run-score').innerText = score;
    showScreen('gameover-screen');
    SOUNDS.dead.play().catch(() => {});
}

function restartGame() {
    startVSMode();
}

function goToMenu() {
    gameState = 'menu';
    showScreen('menu-screen');
}

window.onload = init;
