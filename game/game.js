/**
 * DINO RUSH EXTREME – JURASSIC SURVIVOR (ELITE EDITION)
 * Senior Game Dev Implementation (Three.js + WebGL)
 */
'use strict';

const LANES = [-4, 0, 4];
const PLAYER_START_Z = 0;
const WORLD_SPEED = 0.65;
const GRAVITY = -0.012;
const JUMP_FORCE = 0.32;
const DOUBLE_JUMP_FORCE = 0.28;
const CROUCH_SCALE = 0.5;

// --- Three.js & Engine Globals ---
let scene, camera, renderer, composer, clock;
let particles; 
let players = { shaun: null, dean: null };
let pools = { MINE: [], BIRD: [], POWERUP: [] };
let activeObs = [];
let gameState = 'lobby';
let myRole = 'spectator', myLane = 1;
let isReady = false, wss = null;
let score = 0, bestScore = 0;

// --- Assets ---
const loader = new THREE.TextureLoader();
const TEX = {
    bg: loader.load('static/jungle.png'),
    shaun: loader.load('static/shaun_3d.png'),
    dean: loader.load('static/dean_3d.png'),
    mine: loader.load('static/mine_3d.png'),
    spark: loader.load('https://threejs.org/examples/textures/sprites/spark1.png'),
};

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3')
};
SOUNDS.roar.volume = 0.4;

// --- Canvas Texture Helpers ---
function createDinoTex(emoji, color, label) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 560;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 512, 560);
    x.shadowColor = color; x.shadowBlur = 60;
    x.font = '380px serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(emoji, 256, 240);
    x.shadowBlur = 15;
    x.font = 'bold 76px Arial';
    x.fillStyle = color;
    x.strokeStyle = '#000';
    x.lineWidth = 5;
    x.strokeText(label, 256, 490);
    x.fillText(label, 256, 490);
    return new THREE.CanvasTexture(c);
}

function createObsTex(emoji) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 256);
    x.font = '200px serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(emoji, 128, 145);
    return new THREE.CanvasTexture(c);
}

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a1a06, 0.007);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 9, 15);
    camera.lookAt(0, 3, -5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('three-container').appendChild(renderer.domElement);

    // --- Post-Processing (Bloom & Glow) ---
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.8;
    bloomPass.strength = 0.4;
    bloomPass.radius = 0.3;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(10, 20, 10);
    scene.add(sun);
    
    const lavaGlow = new THREE.PointLight(0xff4d00, 4, 100);
    lavaGlow.position.set(0, 5, -20);
    scene.add(lavaGlow);

    // --- Jungle Background Wall ---
    TEX.bg.wrapS = TEX.bg.wrapT = THREE.ClampToEdgeWrapping;
    const bgGeo = new THREE.PlaneGeometry(250, 90);
    const bgMat = new THREE.MeshBasicMaterial({ map: TEX.bg });
    const bgWall = new THREE.Mesh(bgGeo, bgMat);
    bgWall.position.set(0, 28, -75);
    scene.add(bgWall);

    // --- Jungle Floor ---
    const floorGeo = new THREE.PlaneGeometry(40, 1000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a3d0a, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // --- Emoji Dino & Obstacle Textures ---
    TEX.shaun = createDinoTex('🦕', '#00ff88', 'שון');
    TEX.dean  = createDinoTex('🦖', '#ff8800', 'דין');
    TEX.obsMine  = createObsTex('🪨');
    TEX.obsBird  = createObsTex('🦅');
    TEX.obsLava  = createObsTex('🌋');
    TEX.obsPower = createObsTex('⭐');

    // --- Particles (Forest Dust) ---
    initParticles();

    setupControls();
    clock = new THREE.Clock();
    
    document.getElementById('loading-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
    
    requestAnimationFrame(animate);
}

function initParticles() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 500; i++) {
        pos.push((Math.random()-0.5)*20, Math.random()*2, (Math.random()-0.5)*50);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.07, map: TEX.spark, transparent: true, blending: THREE.AdditiveBlending, color: 0x44ff88 });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

// --- Gameplay & Controls ---
function setupControls() {
    window.addEventListener('keydown', e => {
        if (gameState !== 'playing') return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeLane(-1);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLane(1);
        if (e.code === 'ArrowUp' || e.code === 'Space') jump();
        if (e.code === 'ArrowDown' || e.code === 'KeyS') crouch();
    });

    let tsX = 0, tsY = 0;
    window.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; });
    window.addEventListener('touchend', e => {
        if (gameState !== 'playing') return;
        const dx = e.changedTouches[0].clientX - tsX;
        const dy = e.changedTouches[0].clientY - tsY;
        if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 30) changeLane(dx > 0 ? 1 : -1); }
        else { if (Math.abs(dy) > 30) { if (dy < 0) jump(); else crouch(); } }
    });
}

function changeLane(dir) {
    const next = Math.max(0, Math.min(2, myLane + dir));
    if (next !== myLane) {
        myLane = next;
        new TWEEN.Tween(players[myRole].mesh.position).to({ x: LANES[myLane] }, 180).easing(TWEEN.Easing.Quadratic.Out).start();
        sendWS({ type: 'lane_change', lane: myLane });
    }
}

function jump() {
    const p = players[myRole];
    if (!p.isJumping) { p.vy = JUMP_FORCE; p.isJumping = true; sendWS({ type: 'jump' }); SOUNDS.jump.cloneNode().play().catch(()=>{}); }
    else if (p.jumps < 2) { p.vy = DOUBLE_JUMP_FORCE; p.jumps++; sendWS({ type: 'jump', double: true }); SOUNDS.jump.cloneNode().play().catch(()=>{}); }
}

function crouch() {
    const p = players[myRole];
    if (p.isCrouching) return;
    p.isCrouching = true;
    p.mesh.scale.y *= CROUCH_SCALE;
    p.mesh.position.y -= 2;
    sendWS({ type: 'crouch', active: true });
    setTimeout(() => {
        p.isCrouching = false;
        p.mesh.scale.y /= CROUCH_SCALE;
        p.mesh.position.y += 2;
        sendWS({ type: 'crouch', active: false });
    }, 800);
}

// --- Multiplayer Hub ---
function joinAs(role) {
    myRole = role;
    myLane = role === 'shaun' ? 0 : 2;
    players.shaun = createPlayerSprite('shaun', 0);
    players.dean = createPlayerSprite('dean', 2);
    document.getElementById('card-shaun').classList.toggle('active', role === 'shaun');
    document.getElementById('card-dean').classList.toggle('active', role === 'dean');
    document.getElementById('lobby-actions').classList.remove('hidden');
    SOUNDS.roar.play().catch(()=>{});
    connectWS();
}

function createPlayerSprite(role, laneIndex) {
    const mat = new THREE.SpriteMaterial({ map: TEX[role], transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(8, 8, 1);
    sprite.position.set(LANES[laneIndex], 4.5, PLAYER_START_Z);
    scene.add(sprite);
    return { mesh: sprite, lane: laneIndex, vy: 0, isJumping: false, jumps: 0, lives: 3, invul: 0 };
}

function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wss = new WebSocket(`${protocol}//${window.location.host}/ws/jurassic-lobby-1/${myRole}`);
    wss.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.player && msg.player !== myRole) {
            const other = players[msg.player];
            if (!other) return;
            if (msg.type === 'lane_change') new TWEEN.Tween(other.mesh.position).to({ x: LANES[msg.lane] }, 180).start();
            else if (msg.type === 'jump') { other.vy = JUMP_FORCE; other.isJumping = true; }
            else if (msg.type === 'crouch') other.mesh.scale.y = msg.active ? 8 * CROUCH_SCALE : 8;
        }
        if (msg.type === 'spawn') msg.data.forEach(d => spawnObs(d));
        else if (msg.type === 'start_countdown') startCountdown(msg.delay);
        else if (msg.type === 'lobby_update') updateLobbyUI(msg);
        else if (msg.type === 'ready_update') updateLobbyUI(msg);
        else if (msg.type === 'remote_game_over') endGame();
    };
}

function toggleReady() {
    isReady = !isReady;
    document.getElementById('ready-btn').innerText = isReady ? "מבוטל" : "אני מוכן!";
    sendWS({ type: 'ready', status: isReady });
}

function updateLobbyUI(msg) {
    document.getElementById('ready-status-shaun').innerText = msg.ready.includes('shaun') ? "מוכן לצאת!" : (msg.players.includes('shaun') ? "מחובר" : "טרם התחבר");
    document.getElementById('ready-status-dean').innerText = msg.ready.includes('dean') ? "מוכן לצאת!" : (msg.players.includes('dean') ? "מחובר" : "טרם התחבר");
    
    if (msg.ready.includes('shaun')) document.getElementById('ready-status-shaun').style.color = '#00ff88';
    else document.getElementById('ready-status-shaun').style.color = 'white';
    
    if (msg.ready.includes('dean')) document.getElementById('ready-status-dean').style.color = '#00ff88';
    else document.getElementById('ready-status-dean').style.color = 'white';
}

function sendWS(data) { if (wss && wss.readyState === WebSocket.OPEN) wss.send(JSON.stringify(data)); }

function spawnObs(d) {
    const texMap = { MINE: TEX.obsMine, BIRD: TEX.obsBird, LAVA_GAP: TEX.obsLava, POWERUP: TEX.obsPower };
    const mat = new THREE.SpriteMaterial({ map: texMap[d.type] || TEX.obsMine, transparent: true });
    const s = new THREE.Sprite(mat);
    const obsY = d.type === 'BIRD' ? 9 : 5.5;
    s.scale.set(10, 10, 1);
    s.position.set(d.lane, obsY, d.z);
    scene.add(s);
    activeObs.push({ mesh: s, lane: d.lane, type: d.type });
}

function startCountdown(sec) {
    gameState = 'countdown';
    const ui = document.getElementById('countdown-text');
    ui.classList.remove('hidden');
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('game-hud').classList.remove('hidden');
    let timer = sec;
    ui.innerText = timer;
    const itv = setInterval(() => {
        timer--;
        if (timer <= 0) { clearInterval(itv); ui.classList.add('hidden'); gameState = 'playing'; }
        else ui.innerText = timer;
    }, 1000);
}

// --- Main Loop ---
function animate(t) {
    const dt = clock.getDelta();
    TWEEN.update(t);

    if (gameState === 'playing') {
        updateGame(dt);
        checkCollisions();
    }
    
    // Animate Particles
    if (particles) {
        particles.position.z += WORLD_SPEED * 1.5;
        if (particles.position.z > 50) particles.position.z = -50;
    }

    composer.render();
    requestAnimationFrame(animate);
}

function updateGame(dt) {
    score += Math.floor(WORLD_SPEED * 10);
    document.getElementById('hud-score').innerText = score;

    const t = Date.now();
    for (let r in players) {
        const p = players[r]; if (!p) continue;
        p.vy += GRAVITY; p.mesh.position.y += p.vy;
        const ground = p.isCrouching ? 3.5 : 4.5;
        if (p.mesh.position.y < ground) { p.mesh.position.y = ground; p.vy = 0; p.isJumping = false; p.jumps = 0; }
        if (!p.isJumping && !p.isCrouching) {
            // Running bounce
            p.mesh.position.y = ground + Math.abs(Math.sin(t * 0.018)) * 0.5;
            // Running tilt
            p.mesh.material.rotation = Math.sin(t * 0.018) * 0.15;
        } else if (p.isJumping) {
            p.mesh.material.rotation = 0.25;
        } else {
            p.mesh.material.rotation = 0;
        }
    }

    for (let i = activeObs.length-1; i >= 0; i--) {
        const o = activeObs[i];
        o.mesh.position.z += WORLD_SPEED * 1.6;
        if (o.mesh.position.z > 20) { scene.remove(o.mesh); activeObs.splice(i, 1); }
    }
}

function checkCollisions() {
    const me = players[myRole];
    if (me.invul > 0) { me.invul--; me.mesh.material.opacity = (Math.sin(Date.now()*0.05)>0?1:0.4); return; }
    me.mesh.material.opacity = 1;

    activeObs.forEach(o => {
        if (Math.abs(o.mesh.position.z - me.mesh.position.z) < 2.5 && o.lane === LANES[myLane]) {
            if (Math.abs(o.mesh.position.y - me.mesh.position.y) < 5) onHit();
        }
    });
}

function onHit() {
    const me = players[myRole]; me.lives--; me.invul = 100;
    updateHUD();
    document.getElementById('damage-flash').classList.add('flashing');
    SOUNDS.roar.cloneNode().play().catch(()=>{});
    setTimeout(() => document.getElementById('damage-flash').classList.remove('flashing'), 300);
    if (me.lives <= 0) endGame();
}

function updateHUD() {
    document.getElementById('p1-lives').innerText = '🥩'.repeat(players.shaun.lives);
    document.getElementById('p2-lives').innerText = '🥩'.repeat(players.dean.lives);
}

function endGame() {
    if (gameState === 'over') return;
    gameState = 'over';
    sendWS({ type: 'game_over', score: score });
    document.getElementById('gameover-screen').classList.add('active');
    document.getElementById('final-score').innerText = score;
    SOUNDS.dead.play().catch(()=>{});
    const best = localStorage.getItem('best_dino') || 0;
    if (score > best) localStorage.setItem('best_dino', score);
    document.getElementById('best-score').innerText = Math.max(score, best);
}

window.onload = init;
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });
