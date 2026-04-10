const state = {
    score: 0,
    ammo: 10,
    maxAmmo: 10,
    isZoomed: false,
    fireMode: 'SEMI', // SEMI or AUTO
    lastShotTime: 0,
    isReloading: false,
    targets: [],
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight / 2,
    recoilY: 0,
    safeHouseHP: 100,
    playerHP: 100, // New: Player health
    wave: 1,
    enemiesInWave: 1, // Total for current wave
    enemiesSpawned: 0, // Count spawned so far
    lastSpawnTime: 0
};


const elements = {
    world: document.getElementById('world'),
    targetsLayer: document.getElementById('targets-layer'),
    scopeOverlay: document.getElementById('scope-overlay'),
    scope: document.querySelector('.sniper-scope'),
    score: document.getElementById('score'),
    ammoCurrent: document.getElementById('ammo-current'),
    ammoMax: document.getElementById('ammo-max'),
    fireMode: document.getElementById('fire-mode'),
    muzzleFlash: document.getElementById('muzzle-flash'),
    feedbackLayer: document.getElementById('feedback-layer'),
    feedbackLayer: document.getElementById('feedback-layer'),
    safeHouseBar: document.getElementById('safe-house-hp-bar'),
    playerHpBar: document.getElementById('player-hp-bar') // New Element
};

// --- CONFIG ---
const CONFIG = {
    ZOOM_LEVEL: 4,
    SEMI_DELAY: 200,
    AUTO_DELAY: 100,
    RECOIL_FORCE: 20,
    RECOIL_RECOVERY: 1,
    SPAWN_RATE: 2000
};

// --- INITIALIZATION ---
function init() {
    resize();
    renderHUD();
    gameLoop();
    // spawnTarget(); // Handled by loop

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleZoom();
    });
    window.addEventListener('keydown', onKeyDown);
}

function resize() {
    // Keep things responsive if needed
}

// --- INPUT HANDLING ---
function onMouseMove(e) {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
    updateScopePosition();
}

let isFiring = false;
let autoFireInterval = null;

function onMouseDown(e) {
    if (e.button === 0) { // LMB
        if (state.fireMode === 'AUTO') {
            isFiring = true;
            tryShoot(); // Immediate first shot
            // Clear any existing interval just in case
            if (autoFireInterval) clearInterval(autoFireInterval);
            autoFireInterval = setInterval(tryShoot, CONFIG.AUTO_DELAY);
        } else {
            tryShoot();
        }
    }
}

function onMouseUp(e) {
    if (e.button === 0) {
        isFiring = false;
        if (autoFireInterval) {
            clearInterval(autoFireInterval);
            autoFireInterval = null;
        }
    }
}

function onKeyDown(e) {
    if (e.key.toLowerCase() === 'f') toggleFireMode();
    if (e.key.toLowerCase() === 'r') reload();
}

// --- CORE MECHANICS ---
function toggleZoom() {
    state.isZoomed = !state.isZoomed;
    document.body.classList.toggle('zoomed', state.isZoomed);

    // Smooth transition logic is handled in render
    // adjust scope visual
    if (state.isZoomed) {
        elements.scope.style.borderWidth = '900px';
        elements.scope.style.opacity = '1';
    } else {
        elements.scope.style.borderWidth = '0px'; // No tunnel vision
        elements.scope.style.opacity = '0.5'; // Faint crosshair
    }
}

function toggleFireMode() {
    state.fireMode = state.fireMode === 'SEMI' ? 'AUTO' : 'SEMI';
    renderHUD();
}

function reload() {
    if (state.isReloading || state.ammo === state.maxAmmo) return;
    state.isReloading = true;
    elements.ammoCurrent.innerText = 'RELOADING...';

    setTimeout(() => {
        state.ammo = state.maxAmmo;
        state.isReloading = false;
        renderHUD();
    }, 2000);
}

function tryShoot() {
    const now = Date.now();
    if (state.isReloading) return;
    if (state.ammo <= 0) {
        playSound('dryfire');
        reload();
        return;
    }

    // Rate limit for semi
    if (state.fireMode === 'SEMI' && now - state.lastShotTime < CONFIG.SEMI_DELAY) return;

    shoot();
    state.lastShotTime = now;
}

function shoot() {
    state.ammo--;
    renderHUD();

    // Visual FX
    elements.muzzleFlash.style.opacity = '0.4';
    setTimeout(() => elements.muzzleFlash.style.opacity = '0', 50);

    state.recoilY = CONFIG.RECOIL_FORCE;

    // Hit Detection
    // When unzoomed, we shoot at mouseX, mouseY relative to screen
    // When zoomed, the world is scaled. 
    // elementFromPoint works on Screen Space, which matches our "Crosshair" logic perfectly.
    // However, we need to ignore the SCOPE overlay elements.
    // The scope overlay has pointer-events: none, so it should be fine.

    // To ensure we don't hit the scope lens or other UI, we've set them to pointer-events: none.

    const hitEl = document.elementFromPoint(state.mouseX, state.mouseY);

    // Debug
    // console.log('Hit:', hitEl);

    if (hitEl) {
        if (hitEl.classList.contains('t-head') || hitEl.classList.contains('t-body') ||
            hitEl.classList.contains('t-arm') || hitEl.classList.contains('t-leg')) {
            registerHit(hitEl);
        } else if (hitEl.classList.contains('target')) {
            // Hit the wrapper? Treat as body shot.
            // But wrapper is container, might be empty space?
            // Wrapper is 40x100.
            // Let's assume body hit for forgiveness.
            // We need to pass a "part" to registerHit, let's look for a child body or head.
            const body = hitEl.querySelector('.t-body');
            if (body) registerHit(body);
        }
    }
}

function registerHit(part) {
    const target = part.parentElement;
    if (!target.classList.contains('target')) return;
    if (target.dataset.dead === 'true') return;

    // Critical hit?
    const isHeadshot = part.classList.contains('t-head');
    const damage = isHeadshot ? 100 : 50;

    let hp = parseInt(target.dataset.hp || '100');
    hp -= damage;
    target.dataset.hp = hp;

    state.score += (damage > 50 ? 50 : 10); // Simple scoring
    renderHUD();

    // Feedback
    showFloatingText(isHeadshot ? "HEADSHOT!" : `HIT -${damage}`, state.mouseX, state.mouseY, isHeadshot ? '#f00' : '#fff');

    // Check Death
    if (hp <= 0) {
        state.score += 100; // Bonus for kill
        target.style.transition = 'transform 0.5s, opacity 0.5s';
        target.style.transform += ' rotate(90deg) translate(20px, 50px)';
        target.style.opacity = '0';
        target.dataset.dead = 'true';

        // Remove from list immediately from logic perspective, but visual remains briefly
        // Actually we remove from array when element is removed.
        const idx = state.targets.indexOf(target);
        if (idx !== -1) state.targets.splice(idx, 1);

        setTimeout(() => {
            if (target.parentNode) target.parentNode.removeChild(target);
        }, 1000);
    } else {
        // Flinch animation
        target.style.transform = `translateX(-5px)`;
        setTimeout(() => target.style.transform = `translateX(0)`, 100);
    }
}

function showFloatingText(text, x, y, color) {
    const el = document.createElement('div');
    el.className = 'hit-marker';
    el.innerText = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    elements.feedbackLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function renderHUD() {
    elements.score.innerText = state.score;
    elements.ammoCurrent.innerText = state.ammo;
    elements.fireMode.innerText = state.fireMode + "-AUTO";

    // HP Bars
    if (elements.safeHouseBar) {
        elements.safeHouseBar.style.width = state.safeHouseHP + '%';
    }
    if (elements.playerHpBar) {
        elements.playerHpBar.style.width = state.playerHP + '%';
        // Color shift for low HP
        elements.playerHpBar.style.backgroundColor = state.playerHP < 30 ? '#ff3333' : '#00ffcc';
    }
}

function playSound(type) {
    // Placeholder for sound
}

// --- SCOPE & CAMERA LOGIC ---
function updateScopePosition() {
    // Move the visual scope element
    // Centering the massive border circle
    elements.scope.style.left = state.mouseX + 'px';
    elements.scope.style.top = state.mouseY + 'px';
}

function updateWorldView() {
    // Recoil recovery
    if (state.recoilY > 0) state.recoilY -= CONFIG.RECOIL_RECOVERY;

    const baseScale = state.isZoomed ? CONFIG.ZOOM_LEVEL : 1;

    // If zoomed, we want the point under the mouse (in world space) to remain under the mouse (screen space).
    // Transformation: translate(tx, ty) scale(s)
    // S works around transform-origin center (which is 50% 50% of div).
    // Let's use specific transform origin for stability, or calculate offsets.

    // Easiest "Sniper" feel:
    // User points at screen (x, y). 
    // We want World(x,y) to be magnified.
    // So transform-origin should be x,y?
    // If we constantly change transform-origin, it jitters.

    // Sticking to: Transform Origin = Mouse Position?
    // Only update transform origin when NOT zoomed helps, but moving mouse while zoomed needs panning.

    // Better Logic:
    // Translate the world so that the point (mouseX, mouseY) moves to center, then scale? No.

    // Let's simply scale the world around the current mouse position.
    // CSS: transform-origin: mouseX mouseY.
    // This works perfectly for a "magnifying glass" effect at the cursor.

    if (state.isZoomed) {
        elements.world.style.transformOrigin = `${state.mouseX}px ${state.mouseY}px`;
        elements.world.style.transform = `scale(${baseScale}) translateY(${state.recoilY}px)`;
    } else {
        // Reset to center or normal
        elements.world.style.transformOrigin = `center center`;
        elements.world.style.transform = `scale(1) translateY(${state.recoilY}px)`;
    }
}

// --- TARGET SPAWNING & UPDATE ---


function spawnTarget() {
    // Check removed to allow waves

    const el = document.createElement('div');
    el.className = 'target';
    el.dataset.hp = 100;
    el.dataset.state = 'moving';

    // Spawn from LEFT only
    // Road is at bottom 15%.
    // Due to perspective logic, we need to lower the character to visually ground them.
    const groundLevelY = 8; // Lowered to 8% to ensuring grounding
    el.style.bottom = groundLevelY + '%';

    // Start off-screen LEFT
    const startX = -10;
    el.style.left = startX + '%';

    // Speed Logic: Base speed + Random Variance
    // 20% Chance for a "Sprinter"
    let baseSpeed = 0.03;
    let variance = 0.02;

    if (Math.random() < 0.2) {
        // Sprinter
        baseSpeed = 0.06;
        variance = 0.02;
        // Visual hint: maybe slightly different gear color handled by random char?
        // Or we could explicitly make them look lighter.
    }

    const speed = baseSpeed + Math.random() * variance;
    el.dataset.speed = speed;

    // Sniper Logic
    const isSniper = Math.random() < 0.20; // 20% Chance for Sniper
    let glintHTML = '';

    if (isSniper) {
        el.classList.add('sniper');
        el.dataset.type = 'sniper';
        el.dataset.stopPoint = 10 + Math.random() * 50; // Stop between 10% and 60%
        glintHTML = '<div class="sniper-glint"></div>';
    }

    el.innerHTML = `
        <div class="t-head"></div>
        <div class="t-body"></div>
        <div class="t-arm left"></div>
        <div class="t-arm right">
            <!-- Gun held by right arm -->
            <div class="t-gun">
                <div class="enemy-muzzle-flash"></div>
            </div>
            ${glintHTML}
        </div>
        <div class="t-leg left"></div>
        <div class="t-leg right"></div>
    `;

    elements.targetsLayer.appendChild(el);
    state.targets.push(el);
}

function updateTargets() {
    for (let i = state.targets.length - 1; i >= 0; i--) {
        const t = state.targets[i];
        if (t.dataset.dead === 'true') continue;

        // Attack Logic
        let left = parseFloat(t.style.left) || 0;
        let speed = parseFloat(t.dataset.speed);

        // Check if consistent range to attack Safe House (at ~85%)
        // Check limits
        const isSniper = t.dataset.type === 'sniper';
        const attackRange = isSniper ? (parseFloat(t.dataset.stopPoint) || 20) : 75;

        // Check if consistent range to attack
        if (left >= attackRange) {

            if (isSniper) {
                // Sniper Behavior
                if (t.dataset.state !== 'aiming') {
                    t.dataset.state = 'aiming'; // Stop Moving
                    t.classList.add('aiming'); // Trigger Glint anim

                    // Stop walking anim
                    t.querySelectorAll('.t-leg').forEach(l => l.style.animation = 'none');

                    // Aiming Timer (3s)
                    setTimeout(() => {
                        if (t.dataset.dead !== 'true') sniperFire(t);
                    }, 3000);
                }
            } else {
                // Normal Unit Behavior
                // Stop and Shoot
                if (t.dataset.state !== 'attacking') {
                    t.dataset.state = 'attacking';
                    t.classList.add('attacking'); // Trigger CSS

                    // Stop walking anim
                    t.querySelectorAll('.t-leg').forEach(l => l.style.animation = 'none');
                }

                // Fire Interval
                const lastFire = parseInt(t.dataset.lastFire || 0);
                const now = Date.now();
                if (now - lastFire > 1000) { // Fire every 1s
                    enemyFire(t);
                    t.dataset.lastFire = now;
                }
            }
        } else {
            // Keep Moving
            left += speed;
            t.style.left = left + '%';

            // Walking anim is default in CSS, but if we resume?
            // Currently they never resume.
        }
    }
}

function sniperFire(t) {
    if (t.dataset.dead === 'true') return;

    // SFX/Visuals
    t.classList.add('firing');
    setTimeout(() => t.classList.remove('firing'), 100);

    // Huge damage to Player
    playerHit(50);

    // Reload/Re-aim? 
    // Usually snipers shoot once then reload/wait.
    // Let's make them wait 5s before next shot?
    // Reset glint animation?
    t.classList.remove('aiming');

    // Force reflow/reset to restart css animation if we want continuous fire
    void t.offsetWidth;

    setTimeout(() => {
        if (t.dataset.dead !== 'true') {
            t.classList.add('aiming');
            setTimeout(() => sniperFire(t), 3000);
        }
    }, 2000); // 2s Cooldown before starting aim again
}

function playerHit(damage) {
    state.playerHP -= damage;
    if (state.playerHP < 0) state.playerHP = 0;
    renderHUD();

    // Damage Overlay
    document.body.classList.add('player-hit');
    setTimeout(() => document.body.classList.remove('player-hit'), 500);

    if (state.playerHP <= 0) {
        gameOver("YOU WERE KILLED IN ACTION.");
    }
}

function enemyFire(t) {
    // Visual
    const flash = t.querySelector('.enemy-muzzle-flash');
    t.classList.add('firing');
    setTimeout(() => t.classList.remove('firing'), 100);

    // Damage
    state.safeHouseHP -= 10;
    if (state.safeHouseHP < 0) state.safeHouseHP = 0;
    renderHUD();

    if (state.safeHouseHP <= 0) {
        gameOver();
    }
}

function gameOver(msg) {
    alert(msg || "SAFE HOUSE COMPROMISED! MISSION FAILED.");
    location.reload();
}

// --- WAVE LOGIC ---
function nextWave() {
    state.wave++;
    // Multiply enemies, cap at 15
    let nextCount = state.enemiesInWave * 2;
    if (nextCount > 15) nextCount = 15;

    state.enemiesInWave = nextCount;
    state.enemiesSpawned = 0;

    showFloatingText(`WAVE ${state.wave}`, window.innerWidth / 2, window.innerHeight / 3, '#0ff');
}

// --- MAIN LOOP ---
function gameLoop() {
    const now = Date.now();

    // Spawning Logic
    if (state.enemiesSpawned < state.enemiesInWave) {
        // Delay between individual enemy spawns in a wave
        if (now - state.lastSpawnTime > CONFIG.SPAWN_RATE) {
            spawnTarget();
            state.enemiesSpawned++;
            state.lastSpawnTime = now;
        }
    }
    // Wave Clear Logic
    else if (state.targets.length === 0) {
        // Wave Complete
        if (!state.waveTimer) {
            showFloatingText("WAVE COMPLETE", window.innerWidth / 2, window.innerHeight / 2, '#0f0');
            state.waveTimer = setTimeout(() => {
                nextWave();
                state.waveTimer = null;
            }, 3000);
        }
    }

    updateWorldView();
    updateTargets();
    requestAnimationFrame(gameLoop);
}

// BOOT
init();
// Note: Removed direct spawnTarget() call, gameLoop handles it.
