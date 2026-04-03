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
let lavaLights = [];
let players = { shaun: null, dean: null };
let activeObs = [];
let gameState = 'lobby';
let myRole = 'spectator', myLane = 1;
let isReady = false, wss = null;
let score = 0, bestScore = 0;

// --- Assets ---
const loader = new THREE.TextureLoader();
const TEX = {
    bg:          loader.load('static/jungle.png'),
    shaun:       loader.load('static/raptor.png'),
    dean:        loader.load('static/dino.png'),
    bird:        loader.load('static/pterodactyl.png'),
    spark:       loader.load('https://threejs.org/examples/textures/sprites/spark1.png'),
};

// Flip dean (T-Rex) to face the same direction as raptor
TEX.dean.wrapS = THREE.RepeatWrapping;
TEX.dean.repeat.set(-1, 1);
TEX.dean.offset.set(1, 0);

const SOUNDS = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    dead: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    roar: new Audio('https://assets.mixkit.co/active_storage/sfx/1206/1206-preview.mp3')
};
SOUNDS.roar.volume = 0.4;

// --- Lava Boulder Texture (canvas-drawn) ---
function createLavaTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 118);
    g.addColorStop(0,   '#fff7e6');
    g.addColorStop(0.2, '#ffab00');
    g.addColorStop(0.55,'#ff3d00');
    g.addColorStop(0.85,'#8b0000');
    g.addColorStop(1,   'rgba(60,0,0,0)');
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 55;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(128, 15);  ctx.lineTo(218, 58);
    ctx.lineTo(240, 140); ctx.lineTo(205, 218);
    ctx.lineTo(125, 242); ctx.lineTo(45, 215);
    ctx.lineTo(18, 132);  ctx.lineTo(42, 52);
    ctx.closePath();
    ctx.fill();
    // cracks
    ctx.strokeStyle = '#ffff66'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(128,128); ctx.lineTo(85,72);
    ctx.moveTo(128,128); ctx.lineTo(180,78);
    ctx.moveTo(128,128); ctx.lineTo(178,182);
    ctx.moveTo(128,128); ctx.lineTo(75,185);
    ctx.stroke();
    return new THREE.CanvasTexture(c);
}

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010501);
    scene.fog = new THREE.FogExp2(0x050800, 0.006);

    // SIDE-VIEW CAMERA (right side, looking left across Z axis)
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(20, 7, 2);
    camera.lookAt(0, 4, -8);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.getElementById('three-container').appendChild(renderer.domElement);

    // --- Post-Processing (Bloom) ---
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.55;
    bloomPass.strength  = 0.9;
    bloomPass.radius    = 0.5;
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0x2a4a1a, 2.5));
    const sun = new THREE.DirectionalLight(0xffcc88, 1.2);
    sun.position.set(-5, 20, 5);
    scene.add(sun);

    // Lava atmospheric glow from below
    const lavaAtmos = new THREE.PointLight(0xff3300, 3, 80);
    lavaAtmos.position.set(0, 0, -30);
    scene.add(lavaAtmos);

    // Moving lava crack lights (2 lights that scroll with the world)
    for (let i = 0; i < 3; i++) {
        const ll = new THREE.PointLight(0xff4400, 2.5, 18);
        ll.position.set(
            (Math.random() - 0.5) * 8,
            0.3,
            -15 - i * 25
        );
        scene.add(ll);
        lavaLights.push(ll);
    }

    // --- Jungle Background Wall ---
    TEX.bg.wrapS = THREE.ClampToEdgeWrapping;
    const bgGeo = new THREE.PlaneGeometry(260, 90);
    const bgMat = new THREE.MeshBasicMaterial({ map: TEX.bg });
    const bgWall = new THREE.Mesh(bgGeo, bgMat);
    bgWall.position.set(0, 28, -72);
    scene.add(bgWall);

    // --- Ground (dark cracked earth) ---
    const floorGeo = new THREE.PlaneGeometry(40, 1000);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0d0800, roughness: 1.0, metalness: 0.0
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Lava crack overlay (subtle orange glow on ground)
    const crackGeo = new THREE.PlaneGeometry(40, 1000);
    const crackMat = new THREE.MeshBasicMaterial({
        color: 0xff2200, transparent: true, opacity: 0.07
    });
    const crackFloor = new THREE.Mesh(crackGeo, crackMat);
    crackFloor.rotation.x = -Math.PI / 2;
    crackFloor.position.y = 0.02;
    scene.add(crackFloor);

    // Lava boulder texture stored on TEX
    TEX.lavaBoulder = createLavaTex();

    // --- Particles (rising lava embers) ---
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
    for (let i = 0; i < 600; i++) {
        pos.push(
            (Math.random() - 0.5) * 30,
            Math.random() * 12,
            (Math.random() - 0.5) * 120
        );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.13, map: TEX.spark, transparent: true,
        blending: THREE.AdditiveBlending, color: 0xff5500,
        depthWrite: false
    });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

// --- Gameplay & Controls ---
function setupControls() {
    window.addEventListener('keydown', e => {
        if (gameState !== 'playing') return;
        if (e.code === 'ArrowLeft'  || e.code === 'KeyA') changeLane(-1);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLane(1);
        if (e.code === 'ArrowUp'   || e.code === 'Space') jump();
        if (e.code === 'ArrowDown' || e.code === 'KeyS')  crouch();
    });

    let tsX = 0, tsY = 0;
    window.addEventListener('touchstart', e => {
        tsX = e.touches[0].clientX; tsY = e.touches[0].clientY;
    });
    window.addEventListener('touchend', e => {
        if (gameState !== 'playing') return;
        const dx = e.changedTouches[0].clientX - tsX;
        const dy = e.changedTouches[0].clientY - tsY;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) changeLane(dx > 0 ? 1 : -1);
        } else {
            if (Math.abs(dy) > 30) { if (dy < 0) jump(); else crouch(); }
        }
    });
}

function changeLane(dir) {
    const next = Math.max(0, Math.min(2, myLane + dir));
    if (next !== myLane) {
        myLane = next;
        new TWEEN.Tween(players[myRole].mesh.position)
            .to({ x: LANES[myLane] }, 180)
            .easing(TWEEN.Easing.Quadratic.Out).start();
        sendWS({ type: 'lane_change', lane: myLane });
    }
}

function jump() {
    const p = players[myRole];
    if (!p.isJumping) {
        p.vy = JUMP_FORCE; p.isJumping = true;
        sendWS({ type: 'jump' });
        SOUNDS.jump.cloneNode().play().catch(() => {});
    } else if (p.jumps < 2) {
        p.vy = DOUBLE_JUMP_FORCE; p.jumps++;
        sendWS({ type: 'jump', double: true });
        SOUNDS.jump.cloneNode().play().catch(() => {});
    }
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
    players.dean  = createPlayerSprite('dean',  2);
    document.getElementById('card-shaun').classList.toggle('active', role === 'shaun');
    document.getElementById('card-dean').classList.toggle('active', role === 'dean');
    document.getElementById('lobby-actions').classList.remove('hidden');
    SOUNDS.roar.play().catch(() => {});
    connectWS();
}

function createPlayerSprite(role, laneIndex) {
    // shaun = green-tinted raptor, dean = orange-tinted T-Rex
    const tint = role === 'shaun' ? 0x99ffbb : 0xffbb66;
    const mat  = new THREE.SpriteMaterial({ map: TEX[role], transparent: true, color: tint });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 10, 1);
    sprite.position.set(LANES[laneIndex], 5.0, PLAYER_START_Z);
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
            if (msg.type === 'lane_change')
                new TWEEN.Tween(other.mesh.position).to({ x: LANES[msg.lane] }, 180).start();
            else if (msg.type === 'jump')   { other.vy = JUMP_FORCE; other.isJumping = true; }
            else if (msg.type === 'crouch') other.mesh.scale.y = msg.active ? 10 * CROUCH_SCALE : 10;
        }
        if      (msg.type === 'spawn')          msg.data.forEach(d => spawnObs(d));
        else if (msg.type === 'start_countdown') startCountdown(msg.delay);
        else if (msg.type === 'lobby_update')    updateLobbyUI(msg);
        else if (msg.type === 'ready_update')    updateLobbyUI(msg);
        else if (msg.type === 'remote_game_over') endGame();
    };
}

function toggleReady() {
    isReady = !isReady;
    document.getElementById('ready-btn').innerText = isReady ? 'מבוטל' : 'אני מוכן!';
    sendWS({ type: 'ready', status: isReady });
}

function updateLobbyUI(msg) {
    const s = msg.ready.includes('shaun');
    const d = msg.ready.includes('dean');
    document.getElementById('ready-status-shaun').innerText =
        s ? 'מוכן לצאת!' : (msg.players && msg.players.includes('shaun') ? 'מחובר' : 'טרם התחבר');
    document.getElementById('ready-status-dean').innerText  =
        d ? 'מוכן לצאת!' : (msg.players && msg.players.includes('dean')  ? 'מחובר' : 'טרם התחבר');
    document.getElementById('ready-status-shaun').style.color = s ? '#00ff88' : 'white';
    document.getElementById('ready-status-dean').style.color  = d ? '#00ff88' : 'white';
}

function sendWS(data) {
    if (wss && wss.readyState === WebSocket.OPEN) wss.send(JSON.stringify(data));
}

function spawnObs(d) {
    let tex, scaleW = 10, scaleH = 10, obsY = 5.5;
    if (d.type === 'BIRD') {
        tex = TEX.bird; scaleW = 11; scaleH = 8; obsY = 9;
    } else {
        tex = TEX.lavaBoulder; scaleW = 9; scaleH = 9; obsY = 5.0;
    }
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const s   = new THREE.Sprite(mat);
    s.scale.set(scaleW, scaleH, 1);
    s.position.set(d.lane, obsY, d.z);
    scene.add(s);

    // Glow light for lava obstacles
    if (d.type !== 'BIRD') {
        const glow = new THREE.PointLight(0xff4400, 4, 14);
        glow.position.copy(s.position);
        scene.add(glow);
        activeObs.push({ mesh: s, glow, lane: d.lane, type: d.type });
    } else {
        activeObs.push({ mesh: s, glow: null, lane: d.lane, type: d.type });
    }
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

    // Embers rise upward
    if (particles) {
        const posAttr = particles.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setY(i, posAttr.getY(i) + 0.018);
            if (posAttr.getY(i) > 14) posAttr.setY(i, 0);
        }
        posAttr.needsUpdate = true;
    }

    composer.render();
    requestAnimationFrame(animate);
}

function updateGame(dt) {
    score += Math.floor(WORLD_SPEED * 10);
    document.getElementById('hud-score').innerText = score;

    const t = Date.now();

    // Animate lava floor lights (scroll toward camera)
    lavaLights.forEach(ll => {
        ll.position.z += WORLD_SPEED * 1.6;
        if (ll.position.z > 12) {
            ll.position.z = -60;
            ll.position.x = (Math.random() - 0.5) * 8;
            // Flicker intensity
            ll.intensity = 1.5 + Math.random() * 2;
        }
        ll.intensity += (Math.sin(t * 0.005 + ll.position.z) * 0.3);
    });

    for (let r in players) {
        const p = players[r]; if (!p) continue;
        p.vy += GRAVITY;
        p.mesh.position.y += p.vy;
        const ground = p.isCrouching ? 3.5 : 5.0;
        if (p.mesh.position.y < ground) {
            p.mesh.position.y = ground; p.vy = 0; p.isJumping = false; p.jumps = 0;
        }
        // Running bounce + slight forward lean
        if (!p.isJumping && !p.isCrouching) {
            p.mesh.position.y = ground + Math.abs(Math.sin(t * 0.018)) * 0.4;
            p.mesh.material.rotation = Math.sin(t * 0.018) * 0.1;
        } else if (p.isJumping) {
            p.mesh.material.rotation = 0.2;
        } else {
            p.mesh.material.rotation = 0;
        }
    }

    for (let i = activeObs.length - 1; i >= 0; i--) {
        const o = activeObs[i];
        o.mesh.position.z += WORLD_SPEED * 1.6;
        if (o.glow) o.glow.position.z = o.mesh.position.z;
        // Rotate lava boulders
        if (o.type !== 'BIRD') o.mesh.material.rotation += 0.02;
        if (o.mesh.position.z > 22) {
            scene.remove(o.mesh);
            if (o.glow) scene.remove(o.glow);
            activeObs.splice(i, 1);
        }
    }
}

function checkCollisions() {
    const me = players[myRole];
    if (!me) return;
    if (me.invul > 0) {
        me.invul--;
        me.mesh.material.opacity = (Math.sin(Date.now() * 0.05) > 0 ? 1 : 0.3);
        return;
    }
    me.mesh.material.opacity = 1;

    activeObs.forEach(o => {
        if (Math.abs(o.mesh.position.z - me.mesh.position.z) < 2.5
            && o.lane === LANES[myLane]
            && Math.abs(o.mesh.position.y - me.mesh.position.y) < 4.5) {
            onHit();
        }
    });
}

function onHit() {
    const me = players[myRole];
    me.lives--; me.invul = 120;
    updateHUD();
    document.getElementById('damage-flash').classList.add('flashing');
    SOUNDS.roar.cloneNode().play().catch(() => {});
    setTimeout(() => document.getElementById('damage-flash').classList.remove('flashing'), 300);
    if (me.lives <= 0) endGame();
}

function updateHUD() {
    document.getElementById('p1-lives').innerText = '🥩'.repeat(Math.max(0, players.shaun.lives));
    document.getElementById('p2-lives').innerText = '🥩'.repeat(Math.max(0, players.dean.lives));
}

function endGame() {
    if (gameState === 'over') return;
    gameState = 'over';
    sendWS({ type: 'game_over', score: score });
    document.getElementById('gameover-screen').classList.add('active');
    document.getElementById('final-score').innerText = score;
    SOUNDS.dead.play().catch(() => {});
    const best = localStorage.getItem('best_dino') || 0;
    if (score > best) localStorage.setItem('best_dino', score);
    document.getElementById('best-score').innerText = Math.max(score, best);
}

window.onload = init;
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
