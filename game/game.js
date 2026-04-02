// ===== JURASSIC PARK: DUO EDITION - MULTIPLAYER =====
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

let localPlayer = null;
let remotePlayer = null;
let ws = null;
let myRole = null; // 'shaun' or 'dean'
let isHost = false;

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3')
};
SOUNDS.roar.volume = 0.3;

class Player {
    constructor(id, x, isLocal = false) {
        this.id = id; this.x = x; this.y = GROUND_Y; this.vy = 0;
        this.lives = 3; this.isJumping = false; this.jumps = 0; this.isDucking = false;
        this.invincible = 0; this.trail = [];
        this.isLocal = isLocal;
    }
    update() {
        if (gameState !== 'playing') return;
        
        if (this.isLocal) {
            this.vy += GRAVITY; this.y += this.vy;
            if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; this.isJumping = false; this.jumps = 0; }
            this.isDucking = (keys['KeyS'] || keys['ArrowDown']);
            
            // Send position periodic sync (every 2 frames)
            if (frameCount % 2 === 0 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'state',
                    y: Math.round(this.y), vy: this.vy, 
                    ducking: this.isDucking, lives: this.lives, score: Math.round(score)
                }));
            }
        }
        
        if (this.invincible > 0) this.invincible--;
        
        if (frameCount % 4 === 0) {
            this.trail.unshift({x: this.x, y: this.y});
            if (this.trail.length > 5) this.trail.pop();
        }
    }
    draw() {
        if (this.invincible > 0 && Math.floor(frameCount / 5) % 2 === 0) return;
        ctx.save();
        this.trail.forEach((t, i) => {
            ctx.globalAlpha = (5 - i) / 20;
            this.drawCharacter(t.x - i*5, t.y);
        });
        ctx.globalAlpha = 1;
        this.drawCharacter(this.x, this.y);
        ctx.restore();
    }
    drawCharacter(x, y) {
        const scale = this.isDucking ? 0.6 : 0.8;
        const w = 110 * scale, h = 100 * scale;
        if (IMAGES.dino.complete && IMAGES.dino.naturalWidth !== 0) {
            ctx.drawImage(IMAGES.dino, x - 10, y - h, w, h);
        } else {
            ctx.fillStyle = (this.id === 'shaun' ? '#4ade80' : '#f59c28');
            ctx.fillRect(x, y-h, 40, h);
        }
    }
    jump() {
        if (this.jumps < 2) {
            this.vy = (this.jumps === 0 ? JUMP_FORCE : DOUBLE_JUMP_FORCE);
            this.isJumping = true; this.jumps++; this.isDucking = false;
            try { SOUNDS.jump.currentTime = 0; SOUNDS.jump.play(); } catch(e){}
            
            if (this.isLocal && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'event', action: 'jump' }));
            }
        }
    }
    hit() {
        if (this.invincible > 0 || this.lives <= 0) return;
        this.lives--; this.invincible = 90; screenShake = 15;
        flashRed(); try { SOUNDS.roar.play(); } catch(e){}
        updateHUD();
        if (this.lives <= 0 && (!remotePlayer || remotePlayer.lives <= 0)) endGame();
    }
}

window.onload = () => {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => { 
        keys[e.code] = true; 
        if (gameState === 'playing' && localPlayer) {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                localPlayer.jump();
            }
        }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    
    // Touch support (simple)
    window.addEventListener('touchstart', (e) => {
        if (gameState === 'playing' && localPlayer) localPlayer.jump();
    });

    resize();
    showScreen('menu-screen');
};

function joinAs(role) {
    myRole = role;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/jurassic-park/${role}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log("Connected as", role);
        startMultiplayer();
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };
}

function handleServerMessage(data) {
    if (data.type === 'joined') {
        // If I'm alone, I might be host
        if (data.players.length === 1) isHost = true;
    }
    
    if (data.type === 'room_info') {
        // If others already in room
        const others = data.players.filter(p => p !== myRole);
        if (others.length > 0 && !remotePlayer) {
            setupRemotePlayer(others[0]);
        }
        if (data.players.length === 1) isHost = true;
    }

    if (data.type === 'state') {
        if (!remotePlayer && data.player) setupRemotePlayer(data.player);
        if (remotePlayer && data.player === remotePlayer.id) {
            remotePlayer.y = data.y;
            remotePlayer.vy = data.vy;
            remotePlayer.isDucking = data.ducking;
            remotePlayer.lives = data.lives;
            if (data.score > score) score = data.score; // sync score to whatever is higher
            updateHUD();
        }
    }
    
    if (data.type === 'event') {
        if (remotePlayer && data.player === remotePlayer.id) {
            if (data.action === 'jump') remotePlayer.jump();
        }
    }

    if (data.type === 'spawn') {
        if (!isHost) {
            obstacles.push({
                x: data.x, y: data.y,
                w: data.w, h: data.h, emoji: data.emoji
            });
        }
    }
}

function setupRemotePlayer(role) {
    const rx = (role === 'shaun') ? 110 : 230;
    remotePlayer = new Player(role, rx, false);
}

function startMultiplayer() {
    const lx = (myRole === 'shaun') ? 110 : 230;
    localPlayer = new Player(myRole, lx, true);
    
    score = 0; speed = BASE_SPEED; frameCount = 0; obstacles = [];
    gameState = 'playing';
    showScreen('game-screen');
    document.getElementById('vs-header').classList.remove('hidden');
    updateHUD();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameState !== 'playing') return;
    update(); draw();
    frameCount++;
    animId = requestAnimationFrame(gameLoop);
}

function update() {
    if (screenShake > 0) screenShake *= 0.9;
    speed = BASE_SPEED + (frameCount * SPEED_INC);
    
    localPlayer?.update();
    remotePlayer?.update();

    // Only host spawns obstacles to ensure they are the same
    if (isHost && frameCount % Math.floor(120 - speed * 3) === 0) {
        const obs = spawnObstacle();
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'spawn', ...obs }));
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i]; o.x -= speed;
        if (o.x < -100) { obstacles.splice(i, 1); continue; }
        
        if (localPlayer && localPlayer.lives > 0 && checkCollision(localPlayer, o)) {
            localPlayer.hit();
        }
    }

    // Progress track markers
    const sPos = (myRole === 'shaun' ? score : (remotePlayer?.score || score));
    const dPos = (myRole === 'dean' ? score : (remotePlayer?.score || score));
    
    document.getElementById('vp-shaun').style.left = Math.min(95, (sPos / 1.5) % 100) + '%';
    document.getElementById('vp-dean').style.left = Math.min(95, (dPos / 1.5) % 100) + '%';
    document.getElementById('hud-score').textContent = Math.round(score);
}

function draw() {
    ctx.save();
    if (screenShake > 1) ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    
    // Background parallax
    if (IMAGES.bg.complete) {
        ctx.drawImage(IMAGES.bg, -(frameCount * speed * 0.5) % CANVAS_W, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(IMAGES.bg, (-(frameCount * speed * 0.5) % CANVAS_W) + CANVAS_W, 0, CANVAS_W, CANVAS_H);
    } else {
        ctx.fillStyle = '#0a1b0a'; ctx.fillRect(0,0,CANVAS_W, CANVAS_H);
    }
    
    ctx.fillStyle = 'rgba(0,12,0,0.4)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#4ade8055'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CANVAS_W, GROUND_Y); ctx.stroke();
    
    // Draw obstacles
    obstacles.forEach(o => { ctx.font = '40px serif'; ctx.fillText(o.emoji, o.x, o.y + o.h); });
    
    localPlayer?.draw();
    remotePlayer?.draw();
    
    ctx.restore();
}

function spawnObstacle() {
    const isBird = Math.random() > 0.65;
    const obs = {
        x: CANVAS_W + 50, y: isBird ? GROUND_Y - 110 : GROUND_Y - 45,
        w: 35, h: 40, emoji: isBird ? '🦅' : '🌵'
    };
    obstacles.push(obs);
    return obs;
}

function checkCollision(p, o) {
    const ph = p.isDucking ? 40 : 80, pw = 60;
    return p.x < o.x + o.w && p.x + pw > o.x && p.y - ph < o.y + o.h && p.y > o.y;
}

function updateHUD() {
    const sLives = (myRole === 'shaun' ? localPlayer?.lives : remotePlayer?.lives) ?? 3;
    const dLives = (myRole === 'dean' ? localPlayer?.lives : remotePlayer?.lives) ?? 3;
    renderLives('p1-lives', sLives);
    renderLives('p2-lives', dLives);
}

function renderLives(id, count) {
    const el = document.getElementById(id);
    if (!el) return; el.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const s = document.createElement('span'); s.textContent = (i >= count ? '🦴' : '🥩');
        if (i >= count) s.className = 'lost';
        el.appendChild(s);
    }
}

function flashRed() {
    const f = document.getElementById('damage-flash');
    if (f) { f.classList.add('flashing'); setTimeout(() => f.classList.remove('flashing'), 180); }
}

function endGame() {
    gameState = 'gameover';
    showScreen('gameover-screen');
    document.getElementById('go-run-score').textContent = Math.round(score);
    try { SOUNDS.dead.play(); } catch(e){}
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
}

function resize() {
    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;
    const w = wrapper.clientWidth, h = wrapper.clientHeight;
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    let dw = w, dh = w * (CANVAS_H / CANVAS_W);
    if (dh > h) { dh = h; dw = h * (CANVAS_W / CANVAS_H); }
    canvas.style.width = dw + 'px'; canvas.style.height = dh + 'px';
}

function restartGame() { window.location.reload(); }
function goToMenu() { window.location.reload(); }
