const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1200;
canvas.height = 600;

const GAME = {
    running: false, // Start false for menu
    paused: true,
    gravity: 0.5,
    cameraX: 0,
    player: null,
    enemies: [],
    bullets: [],
    walls: [],
    particles: [],
    missionComplete: false,
    death: false,
    editorMode: false,
    editorItem: 'WALL',
    editorClass: 'ASSAULT',
    selectedMapName: null
};

const keys = {};
let mouse = { x: 0, y: 0, pressed: false };

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
window.addEventListener('mousedown', () => mouse.pressed = true);
window.addEventListener('mouseup', () => mouse.pressed = false);

const WEAPONS = {
    SNIPER_RIFLE: { name: 'M24 SNIPER', fireRate: 1500, ammo: 5, magSize: 5, totalAmmo: 20, damage: 100, reloadTime: 2500, recoil: 0.5, spread: 0.005 },
    ASSAULT_RIFLE: { name: 'HK416 ASSAULT', fireRate: 150, ammo: 30, magSize: 30, totalAmmo: 120, damage: 20, reloadTime: 1800, recoil: 0.08, spread: 0.04 },
    SMG: { name: 'MP7 MERCENARY', fireRate: 80, ammo: 40, magSize: 40, totalAmmo: 160, damage: 12, reloadTime: 1200, recoil: 0.05, spread: 0.1 },
    LMG: { name: 'M249 HEAVY', fireRate: 60, ammo: 100, magSize: 100, totalAmmo: 200, damage: 18, reloadTime: 4000, recoil: 0.12, spread: 0.15 }
};

const CLASSES = {
    SNIPER: { weapon: WEAPONS.SNIPER_RIFLE, health: 80, speed: 3.5, color: '#3e4a3e' },
    ASSAULT: { weapon: WEAPONS.ASSAULT_RIFLE, health: 100, speed: 4.5, color: '#2c3e50' },
    MERCENARY: { weapon: WEAPONS.SMG, health: 90, speed: 5.5, color: '#7f8c8d' },
    HEAVY: { weapon: WEAPONS.LMG, health: 150, speed: 2.5, color: '#444' }
};

let DEFAULT_MAPS = {};

// Fetch maps from the unified JSON database via Flask
async function loadHQMissions() {
    try {
        const response = await fetch('/api/maps');
        DEFAULT_MAPS = await response.json();
        return true;
    } catch (e) {
        // Fallback for local testing without Flask
        const response = await fetch('maps.json?v=' + Date.now());
        DEFAULT_MAPS = await response.json();
        return true;
    }
}

// UI & Map Logic
const UI = {
    showMainMenu: () => {
        GAME.paused = true;
        GAME.running = false;
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('map-list-screen').classList.add('hidden');
    },
    showMapList: () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('map-list-screen').classList.remove('hidden');
        UI.renderMapList();
    },
    renderMapList: async () => {
        const container = document.getElementById('map-items');
        container.innerHTML = 'LOADING TACTICAL DATABASE...';

        await loadHQMissions();
        container.innerHTML = '';

        Object.keys(DEFAULT_MAPS).forEach(name => {
            const item = document.createElement('div');
            item.className = 'map-item';
            // Mark default/hq maps if needed, but here we treat all as unified
            const isHQ = name.includes(':');
            item.innerHTML = `<span style="color: ${isHQ ? '#666' : '#900'};">[DATA]</span> ${name}`;
            item.onclick = () => UI.loadMap(DEFAULT_MAPS[name]);

            // Add Right-Click support
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Stop click from reaching window immediately
                UI.showContextMenu(e.clientX, e.clientY, name);
            };

            container.appendChild(item);
        });

        // Add "Create New Mission" button at the end
        const addItem = document.createElement('div');
        addItem.className = 'map-item add-map';
        addItem.innerHTML = `<span style="color: #0f0; font-size: 1.2rem;">+</span> CREATE NEW MISSION`;
        addItem.onclick = () => UI.startEditor();
        container.appendChild(addItem);
    },
    loadMap: (mapData) => {
        document.getElementById('map-list-screen').classList.add('hidden');
        initLevel(mapData);
        GAME.paused = false;
        GAME.running = true;
    },
    startEditor: () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('map-list-screen').classList.add('hidden'); // Fix: hide map list
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('editor-ui').classList.remove('hidden');
        GAME.editorMode = true;
        GAME.running = true;
        GAME.paused = false;
        initLevel(null); // start fresh
    },
    resume: () => {
        if (GAME.player) {
            document.getElementById('main-menu').classList.add('hidden');
            GAME.paused = false;
        }
    },
    openSaveDialog: () => {
        document.getElementById('save-map-dialog').classList.remove('hidden');
    },
    closeSaveDialog: () => {
        document.getElementById('save-map-dialog').classList.add('hidden');
    },
    saveCustomMap: async () => {
        const name = document.getElementById('map-name-input').value.trim();
        if (!name) return alert("Enter sector name!");

        const mapData = {
            walls: GAME.walls,
            enemies: GAME.enemies.map(e => ({ x: e.x, y: e.y, className: e.className }))
        };

        try {
            const response = await fetch('/api/save_map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, data: mapData })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                UI.closeSaveDialog();
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            alert("SERVER ERROR: Could not save to disk. Make sure app.py is running!");
            // Fallback to local storage if server is down
            const maps = JSON.parse(localStorage.getItem('sierra_maps') || '{}');
            maps[name] = mapData;
            localStorage.setItem('sierra_maps', JSON.stringify(maps));
        }
    }
};

// Global context menu handler
UI.showContextMenu = (x, y, name) => {
    const menu = document.getElementById('map-context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
    GAME.selectedMapName = name;
};

UI.contextEdit = () => {
    const name = GAME.selectedMapName;
    const mapData = DEFAULT_MAPS[name];
    if (mapData) {
        document.getElementById('map-list-screen').classList.add('hidden');
        document.getElementById('map-context-menu').classList.add('hidden');
        document.getElementById('editor-ui').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        GAME.editorMode = true;
        GAME.running = true;
        GAME.paused = false;
        initLevel(mapData);
    }
};

UI.contextDelete = async () => {
    const name = GAME.selectedMapName;
    if (!confirm(`DELETE ${name}? THIS CANNOT BE UNDONE.`)) return;

    try {
        const response = await fetch('/api/delete_map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const result = await response.json();
        if (result.status === 'success') {
            document.getElementById('map-context-menu').classList.add('hidden');
            UI.renderMapList();
        } else {
            alert(result.error);
        }
    } catch (e) {
        alert("SERVER ERROR: Could not delete from disk.");
    }
};

// Close context menu on any click (with small timeout to allow menu interactions)
window.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('map-context-menu');
    if (!menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0; this.color = color;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.05; }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 2, 2);
        ctx.globalAlpha = 1;
    }
}

class Bullet {
    constructor(x, y, angle, owner, damage) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * 20;
        this.vy = Math.sin(angle) * 20;
        this.owner = owner; this.damage = damage;
        this.active = true;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        GAME.walls.forEach(wall => {
            if (this.x > wall.x && this.x < wall.x + wall.w && this.y > wall.y && this.y < wall.y + wall.h) {
                this.active = false;
                if (wall.destructible) {
                    wall.health -= this.damage;
                    for (let i = 0; i < 3; i++) GAME.particles.push(new Particle(this.x, this.y, '#444'));
                } else {
                    for (let i = 0; i < 5; i++) GAME.particles.push(new Particle(this.x, this.y, '#666'));
                }
            }
        });
        if (this.x < -1000 || this.x > 4000 || this.y < -1000 || this.y > 1000) this.active = false;
    }
    draw() {
        ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(this.x - GAME.cameraX, this.y);
        ctx.lineTo(this.x - GAME.cameraX - this.vx * 0.5, this.y - this.vy * 0.5);
        ctx.stroke();
    }
}

class Player {
    constructor(x, y, className) {
        this.className = className;
        const config = CLASSES[this.className];
        this.x = x; this.y = y; this.w = 20; this.h = 50;
        this.vx = 0; this.vy = 0;
        this.maxHealth = config.health; this.health = config.health;
        this.weapon = { ...config.weapon }; this.ammo = this.weapon.ammo;
        this.speed = config.speed; this.color = config.color;
        this.lastFired = 0; this.reloading = false; this.crouching = false;
        this.facing = 1; this.grounded = false; this.jumpPower = -12;
        this.planting = false;
        this.plantProgress = 0;
        this.activeC4 = null; // {x, y, timer, wallRef}
    }
    update() {
        if (GAME.death || GAME.editorMode || GAME.paused) return;
        let speed = this.speed;
        if (keys['KeyA']) { this.vx = -speed; this.facing = -1; }
        else if (keys['KeyD']) { this.vx = speed; this.facing = 1; }
        else { this.vx *= 0.8; }
        this.crouching = keys['ControlLeft'] || keys['KeyC'];
        this.h = this.crouching ? 30 : 50;
        if (this.crouching) this.vx *= 0.5;
        this.vy += GAME.gravity; this.y += this.vy;
        this.grounded = false;
        // Vertical Resolve
        GAME.walls.forEach(wall => {
            if (this.x < wall.x + wall.w && this.x + this.w > wall.x && this.y < wall.y + wall.h && this.y + this.h > wall.y) {
                if (wall.type === 'RAMP_UP' || wall.type === 'RAMP_DOWN') return;
                if (this.vy > 0) { this.y = wall.y - this.h; this.vy = 0; this.grounded = true; }
                else if (this.vy < 0) { this.y = wall.y + wall.h; this.vy = 0; }
            }
        });

        // Slope Logic (Fixed)
        GAME.walls.forEach(wall => {
            if (this.x + this.w > wall.x && this.x < wall.x + wall.w) {
                let relX = (this.x + this.w / 2) - wall.x;
                relX = Math.max(0, Math.min(wall.w, relX));

                let floorY = null;
                if (wall.type === 'RAMP_UP') floorY = wall.y + (wall.h - (relX / wall.w) * wall.h);
                else if (wall.type === 'RAMP_DOWN') floorY = wall.y + (relX / wall.w) * wall.h;

                if (floorY !== null) {
                    if (this.y + this.h >= floorY - 10 && this.y + this.h <= floorY + 20 && this.vy >= 0) {
                        this.y = floorY - this.h;
                        this.vy = 0;
                        this.grounded = true;
                    }
                }
            }
        });

        if ((keys['Space'] || keys['KeyW']) && this.grounded && !this.crouching) { this.vy = this.jumpPower; this.grounded = false; }
        this.x += this.vx;

        // Horizontal Resolve
        GAME.walls.forEach(wall => {
            if (this.x < wall.x + wall.w && this.x + this.w > wall.x && this.y < wall.y + wall.h && this.y + this.h > wall.y) {
                if (wall.type === 'RAMP_UP' || wall.type === 'RAMP_DOWN') return;
                if (this.vx > 0) this.x = wall.x - this.w;
                if (this.vx < 0) this.x = wall.x + wall.w;
            }
        });
        if (keys['Digit1']) GAME.player = new Player(this.x, this.y, 'SNIPER');
        if (keys['Digit2']) GAME.player = new Player(this.x, this.y, 'ASSAULT');
        if (keys['Digit4']) GAME.player = new Player(this.x, this.y, 'HEAVY');

        // C4 Planting Logic
        let nearWall = null;
        const reach = 20;
        GAME.walls.forEach(w => {
            // Check if player is near any part of the wall rectangle
            const closeX = Math.max(w.x, Math.min(this.x + this.w / 2, w.x + w.w));
            const closeY = Math.max(w.y, Math.min(this.y + this.h / 2, w.y + w.h));
            const dist = Math.sqrt((this.x + this.w / 2 - closeX) ** 2 + (this.y + this.h / 2 - closeY) ** 2);
            if (dist < 50) nearWall = w;
        });

        if ((keys['KeyF'] || keys['F4']) && nearWall && this.grounded && !this.activeC4) {
            this.planting = true;
            this.plantProgress += 0.02;
            if (this.plantProgress >= 1) {
                this.activeC4 = { x: nearWall.x + nearWall.w / 2, y: nearWall.y + nearWall.h / 2, timer: 180, wall: nearWall };
                this.planting = false;
                this.plantProgress = 0;
            }
        } else {
            this.planting = false;
            this.plantProgress = 0;
        }

        // C4 Countdown Logic
        if (this.activeC4) {
            this.activeC4.timer--;
            if (this.activeC4.timer <= 0) {
                this.explodeC4();
            }
        }

        if (mouse.pressed && !this.reloading && this.ammo > 0) {
            let now = Date.now();
            if (now - this.lastFired > this.weapon.fireRate) { this.shoot(); this.lastFired = now; }
        }
        if (keys['KeyR'] && !this.reloading && this.ammo < this.weapon.magSize) { this.reload(); }

        const hud = document.getElementById('hud');
        if (GAME.editorMode) hud.classList.add('hidden');
        else hud.classList.remove('hidden');

        document.getElementById('ammo-count').innerText = `${this.ammo} / ${this.weapon.totalAmmo}`;
        document.getElementById('weapon-name').innerText = `${this.className}: ${this.weapon.name}`;
        GAME.cameraX = this.x - 400;
        if (GAME.cameraX < 0) GAME.cameraX = 0;
    }
    shoot() {
        let dx = (mouse.x + GAME.cameraX) - (this.x + this.w / 2);
        let dy = mouse.y - (this.y + 15);
        let angle = Math.atan2(dy, dx);
        angle += (Math.random() - 0.5) * this.weapon.spread;
        GAME.bullets.push(new Bullet(this.x + this.w / 2, this.y + 15, angle, 'player', this.weapon.damage));
        this.ammo--; this.y -= 2;
        for (let i = 0; i < 3; i++) GAME.particles.push(new Particle(this.x + this.w / 2, this.y + 15, '#aaaaaa'));
    }

    explodeC4() {
        if (!this.activeC4) return;

        // Destroy target wall
        const wall = this.activeC4.wall;
        wall.health = -1; // Force destroy even if "indestructible"
        wall.destructible = true;

        // Big explosion effect
        for (let i = 0; i < 30; i++) {
            let p = new Particle(this.activeC4.x, this.activeC4.y, '#f60');
            p.vx *= 3; p.vy *= 3;
            GAME.particles.push(p);
        }

        // Damage nearby enemies
        GAME.enemies.forEach(e => {
            let d = Math.sqrt((e.x - this.activeC4.x) ** 2 + (e.y - this.activeC4.y) ** 2);
            if (d < 200) e.health -= 200;
        });

        this.activeC4 = null;
    }
    reload() {
        this.reloading = true;
        setTimeout(() => { this.ammo = this.weapon.magSize; this.reloading = false; }, this.weapon.reloadTime);
    }
    draw() {
        // Redetect nearWall for drawing visuals in the draw scope
        let nearWall = null;
        GAME.walls.forEach(w => {
            const closeX = Math.max(w.x, Math.min(this.x + this.w / 2, w.x + w.w));
            const closeY = Math.max(w.y, Math.min(this.y + this.h / 2, w.y + w.h));
            const dist = Math.sqrt((this.x + this.w / 2 - closeX) ** 2 + (this.y + this.h / 2 - closeY) ** 2);
            if (dist < 50) nearWall = w;
        });

        ctx.fillStyle = this.color; ctx.fillRect(this.x - GAME.cameraX, this.y, this.w, this.h);
        ctx.fillStyle = '#111'; ctx.fillRect(this.x - GAME.cameraX, this.y, this.w, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(this.x - GAME.cameraX, this.y + 15, this.w, 20);
        let dx = (mouse.x + GAME.cameraX) - (this.x + this.w / 2);
        let dy = mouse.y - (this.y + 15);
        let angle = Math.atan2(dy, dx);
        if (this.className === 'SNIPER') {
            let laserX = this.x + this.w / 2, laserY = this.y + 18, targetX = laserX + Math.cos(angle) * 1000, targetY = laserY + Math.sin(angle) * 1000;
            GAME.walls.forEach(wall => {
                for (let d = 0; d < 1000; d += 10) {
                    let px = laserX + Math.cos(angle) * d, py = laserY + Math.sin(angle) * d;
                    let hit = false;
                    if (wall.type === 'RAMP_UP') {
                        if (px > wall.x && px < wall.x + wall.w && py > wall.y + (wall.h - (px - wall.x) / wall.w * wall.h) && py < wall.y + wall.h) hit = true;
                    } else if (wall.type === 'RAMP_DOWN') {
                        if (px > wall.x && px < wall.x + wall.w && py > wall.y + ((px - wall.x) / wall.w * wall.h) && py < wall.y + wall.h) hit = true;
                    } else {
                        if (px > wall.x && px < wall.x + wall.w && py > wall.y && py < wall.y + wall.h) hit = true;
                    }
                    if (hit) { targetX = px; targetY = py; break; }
                }
            });
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.beginPath();
            ctx.moveTo(laserX - GAME.cameraX, laserY); ctx.lineTo(targetX - GAME.cameraX, targetY); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(this.x + this.w / 2 - GAME.cameraX, this.y + 20); ctx.rotate(angle); ctx.fillStyle = '#000'; ctx.fillRect(0, -2, 18, 4); ctx.restore();

        // Draw Planting UI
        if (nearWall && !this.activeC4 && !this.planting) {
            ctx.fillStyle = '#fff'; ctx.font = '10px Courier New';
            ctx.fillText("PRESS [F] TO BREACH", this.x - GAME.cameraX - 30, this.y - 10);
        }

        if (this.planting) {
            ctx.fillStyle = '#444'; ctx.fillRect(this.x - GAME.cameraX - 15, this.y - 20, 50, 5);
            ctx.fillStyle = '#0f0'; ctx.fillRect(this.x - GAME.cameraX - 15, this.y - 20, 50 * this.plantProgress, 5);
            ctx.fillStyle = '#fff'; ctx.font = '10px Courier New'; ctx.fillText("PLANTING C4", this.x - GAME.cameraX - 15, this.y - 25);
        }

        // Draw Active C4
        if (this.activeC4) {
            ctx.fillStyle = '#f00';
            let pulse = Math.sin(Date.now() / 100) * 2;
            ctx.beginPath();
            ctx.arc(this.activeC4.x - GAME.cameraX, this.activeC4.y, 4 + pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Courier New';
            ctx.fillText(Math.ceil(this.activeC4.timer / 60), this.activeC4.x - GAME.cameraX - 4, this.activeC4.y - 10);
        }
    }
}

class Enemy {
    constructor(x, y, className = 'ASSAULT') {
        this.className = className; const config = CLASSES[className];
        this.x = x; this.y = y; this.w = 20; this.h = 50;
        this.maxHealth = config.health * 0.6; this.health = this.maxHealth;
        this.weapon = { ...config.weapon }; this.state = 'PATROL';
        this.patrolStart = x; this.patrolEnd = x + 150; this.dir = 1;
        this.lastShot = 0; this.alertTimer = 0;
        this.vx = 0; this.vy = 0; this.grounded = false;
    }

    hasLineOfSight() {
        const startX = this.x + this.w / 2;
        const startY = this.y + 15;
        const endX = GAME.player.x + GAME.player.w / 2;
        const endY = GAME.player.y + 25;

        let dx = endX - startX;
        let dy = endY - startY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let steps = dist / 15; // Raycast resolution

        for (let i = 0; i < steps; i++) {
            let px = startX + (dx / steps) * i;
            let py = startY + (dy / steps) * i;

            for (let wall of GAME.walls) {
                if (px > wall.x && px < wall.x + wall.w && py > wall.y && py < wall.y + wall.h) {
                    return false; // Wall blocked view
                }
            }
        }
        return true;
    }

    update() {
        if (this.health <= 0 || GAME.paused || GAME.editorMode) return;

        // Gravity and Physics for Enemy
        this.vy += GAME.gravity;
        this.y += this.vy;
        this.grounded = false;
        GAME.walls.forEach(wall => {
            if (this.x < wall.x + wall.w && this.x + this.w > wall.x && this.y < wall.y + wall.h && this.y + this.h > wall.y) {
                if (wall.type === 'RAMP_UP' || wall.type === 'RAMP_DOWN') return;
                if (this.vy > 0) { this.y = wall.y - this.h; this.vy = 0; this.grounded = true; }
                else if (this.vy < 0) { this.y = wall.y + wall.h; this.vy = 0; }
            }
        });

        // Enemy Slope Logic (Fixed)
        GAME.walls.forEach(wall => {
            if (this.x + this.w > wall.x && this.x < wall.x + wall.w) {
                let relX = (this.x + this.w / 2) - wall.x;
                relX = Math.max(0, Math.min(wall.w, relX));

                let floorY = null;
                if (wall.type === 'RAMP_UP') floorY = wall.y + (wall.h - (relX / wall.w) * wall.h);
                else if (wall.type === 'RAMP_DOWN') floorY = wall.y + (relX / wall.w) * wall.h;

                if (floorY !== null) {
                    if (this.y + this.h >= floorY - 10 && this.y + this.h <= floorY + 20 && this.vy >= 0) {
                        this.y = floorY - this.h;
                        this.vy = 0;
                        this.grounded = true;
                    }
                }
            }
        });

        let dist = Math.abs(this.x - GAME.player.x);
        let viewDist = this.className === 'SNIPER' ? 1000 : 500;

        if (dist < viewDist && Math.abs(this.y - GAME.player.y) < 300) {
            if (this.hasLineOfSight()) {
                this.state = 'COMBAT';
            } else if (this.state === 'COMBAT') {
                this.state = 'ALERT';
                this.alertTimer = 180;
            }
        } else if (this.state === 'COMBAT') {
            this.state = 'ALERT';
            this.alertTimer = 180;
        }

        if (this.state === 'PATROL') {
            // Patrol movement
            let nextX = this.x + this.dir * 1;

            // Check for wall or ledge
            let hasFloor = false;
            GAME.walls.forEach(wall => {
                if (nextX + this.w / 2 > wall.x && nextX + this.w / 2 < wall.x + wall.w && this.y + this.h + 5 > wall.y && this.y + this.h + 5 < wall.y + wall.h) {
                    hasFloor = true;
                }
            });

            if (nextX > this.patrolEnd || nextX < this.patrolStart || !hasFloor) {
                this.dir *= -1;
            } else {
                this.x = nextX;
            }
        } else if (this.state === 'COMBAT') {
            this.dir = GAME.player.x > this.x ? 1 : -1;
            let now = Date.now();
            if (now - this.lastShot > this.weapon.fireRate * 2) { this.shoot(); this.lastShot = now; }
        } else if (this.state === 'ALERT') { if (--this.alertTimer <= 0) this.state = 'PATROL'; }

        // Wall collision for side movement
        GAME.walls.forEach(wall => {
            if (this.x < wall.x + wall.w && this.x + this.w > wall.x && this.y < wall.y + wall.h && this.y + this.h > wall.y) {
                if (this.dir > 0) this.x = wall.x - this.w;
                else if (this.dir < 0) this.x = wall.x + wall.w;
                this.dir *= -1; // Bounce
            }
        });

        GAME.bullets.forEach(b => {
            if (b.owner === 'player' && b.active && b.x > this.x && b.x < this.x + this.w && b.y > this.y && b.y < this.y + this.h) {
                this.health -= (b.y < this.y + 15) ? b.damage * 2 : b.damage;
                b.active = false;
                for (let i = 0; i < 8; i++) GAME.particles.push(new Particle(b.x, b.y, '#900'));
            }
        });
    }
    shoot() {
        let dx = GAME.player.x - this.x, dy = (GAME.player.y + 20) - (this.y + 15);
        let angle = Math.atan2(dy, dx);
        GAME.bullets.push(new Bullet(this.x + this.w / 2, this.y + 15, angle, 'enemy', 10));
    }
    draw() {
        if (this.health <= 0) { ctx.fillStyle = '#200'; ctx.fillRect(this.x - GAME.cameraX, this.y + this.h - 10, this.w + 10, 10); return; }
        ctx.fillStyle = '#300'; ctx.fillRect(this.x - GAME.cameraX, this.y, this.w, this.h);
        ctx.fillStyle = '#100'; ctx.fillRect(this.x - GAME.cameraX, this.y, this.w, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(this.x - GAME.cameraX, this.y + 15, this.w, 20);
        let dx = GAME.player.x - this.x, dy = (GAME.player.y + 20) - (this.y + 15), angle = Math.atan2(dy, dx);

        if (!GAME.editorMode) {
            if (this.className === 'SNIPER') {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; ctx.lineWidth = 1; ctx.beginPath();
                ctx.moveTo(this.x + this.w / 2 - GAME.cameraX, this.y + 18);
                ctx.lineTo(this.x + this.w / 2 - GAME.cameraX + Math.cos(angle) * 800, this.y + 18 + Math.sin(angle) * 800);
                ctx.stroke();
            }
            ctx.save(); ctx.translate(this.x + this.w / 2 - GAME.cameraX, this.y + 20); ctx.rotate(angle); ctx.fillStyle = '#000'; ctx.fillRect(0, -2, 14, 3); ctx.restore();
            if (this.state === 'COMBAT') { ctx.fillStyle = '#f00'; ctx.font = 'bold 16px Courier New'; ctx.fillText('!', this.x + this.w / 2 - GAME.cameraX - 4, this.y - 10); }
        } else {
            // Distinct "Editor Icon" for enemies
            ctx.fillStyle = '#f00';
            ctx.font = 'bold 12px Courier New';
            ctx.fillText(this.className[0], this.x + this.w / 2 - GAME.cameraX - 4, this.y + 30);
        }
    }
}

function initLevel(mapData) {
    GAME.bullets = []; GAME.particles = []; GAME.death = false; GAME.missionComplete = false;
    if (mapData) {
        GAME.walls = mapData.walls;
        GAME.enemies = mapData.enemies.map(e => new Enemy(e.x, e.y, e.className));
    } else {
        GAME.walls = [
            { x: -100, y: 550, w: 4000, h: 100, health: 1000, destructible: false },
            { x: -100, y: 0, w: 100, h: 600, health: 1000, destructible: false },
            { x: 3000, y: 0, w: 100, h: 600, health: 1000, destructible: false },
            { x: 400, y: 400, w: 200, h: 20, health: 100, destructible: true },
            { x: 600, y: 400, w: 20, h: 150, health: 150, destructible: true }
        ];
        GAME.enemies = [new Enemy(500, 340, 'SNIPER'), new Enemy(900, 490, 'HEAVY')];
    }
    GAME.player = new Player(50, 480, 'ASSAULT');
}

window.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
        if (GAME.editorMode) {
            GAME.editorMode = false;
            document.getElementById('editor-ui').classList.add('hidden');
            UI.showMainMenu();
        }
        else { GAME.paused = !GAME.paused; document.getElementById('main-menu').classList.toggle('hidden', !GAME.paused); }
    }
    if (e.code === 'Tab') {
        e.preventDefault();
        GAME.editorMode = !GAME.editorMode;
        document.getElementById('hud').classList.toggle('hidden', GAME.editorMode);
        document.getElementById('editor-ui').classList.toggle('hidden', !GAME.editorMode);
        document.body.style.cursor = GAME.editorMode ? 'crosshair' : 'default';
    }
    if (GAME.editorMode) {
        if (e.code === 'KeyZ') GAME.editorItem = 'WALL';
        if (e.code === 'KeyX') GAME.editorItem = 'COVER';
        if (e.code === 'KeyC') GAME.editorItem = 'ENEMY';
        if (e.code === 'KeyV') GAME.editorItem = 'RAMP_UP';
        if (e.code === 'KeyB') GAME.editorItem = 'RAMP_DOWN';
        if (e.code === 'Digit1') GAME.editorClass = 'SNIPER';
        if (e.code === 'Digit2') GAME.editorClass = 'ASSAULT';
        if (e.code === 'Digit3') GAME.editorClass = 'MERCENARY';
        if (e.code === 'Digit4') GAME.editorClass = 'HEAVY';
        if (e.code === 'KeyS') UI.openSaveDialog();
        if (e.code === 'Delete') { GAME.walls = []; GAME.enemies = []; }
    }
});

canvas.addEventListener('mousedown', e => {
    if (!GAME.editorMode) return;
    const rect = canvas.getBoundingClientRect();
    const ex = Math.floor((e.clientX - rect.left + GAME.cameraX) / 50) * 50;
    const ey = Math.floor((e.clientY - rect.top) / 50) * 50;
    if (GAME.editorItem === 'WALL') GAME.walls.push({ x: ex, y: ey, w: 50, h: 50, health: 1000, destructible: false });
    else if (GAME.editorItem === 'COVER') GAME.walls.push({ x: ex, y: ey, w: 50, h: 50, health: 100, destructible: true });
    else if (GAME.editorItem === 'ENEMY') GAME.enemies.push(new Enemy(ex + 15, ey, GAME.editorClass));
    else if (GAME.editorItem === 'RAMP_UP') GAME.walls.push({ x: ex, y: ey, w: 50, h: 50, type: 'RAMP_UP', health: 1000, destructible: false });
    else if (GAME.editorItem === 'RAMP_DOWN') GAME.walls.push({ x: ex, y: ey, w: 50, h: 50, type: 'RAMP_DOWN', health: 1000, destructible: false });
});

function update() {
    if (!GAME.running) return;

    if (GAME.editorMode) {
        if (keys['KeyA']) GAME.cameraX -= 15;
        if (keys['KeyD']) GAME.cameraX += 15;
        if (GAME.cameraX < 0) GAME.cameraX = 0;
        if (GAME.cameraX > 2000) GAME.cameraX = 2000;
        return; // Don't run game logic in editor
    }

    if (GAME.paused) return;

    GAME.player.update();
    GAME.bullets.forEach(b => {
        if (b.owner === 'enemy' && b.active && b.x > GAME.player.x && b.x < GAME.player.x + GAME.player.w && b.y > GAME.player.y && b.y < GAME.player.y + GAME.player.h) {
            GAME.player.health -= b.damage; b.active = false;
            for (let i = 0; i < 5; i++) GAME.particles.push(new Particle(b.x, b.y, '#f00'));
        }
    });
    if (GAME.player.health <= 0) { GAME.death = true; document.getElementById('death-screen').classList.remove('hidden'); }
    GAME.enemies.forEach(e => e.update());
    GAME.bullets.forEach(b => b.update());
    GAME.bullets = GAME.bullets.filter(b => b.active);
    GAME.walls = GAME.walls.filter(w => !w.destructible || w.health > 0);
    GAME.particles.forEach(p => p.update());
    GAME.particles = GAME.particles.filter(p => p.life > 0);
    if (GAME.enemies.length > 0 && GAME.enemies.every(e => e.health <= 0)) {
        GAME.missionComplete = true; document.getElementById('win-screen').classList.remove('hidden');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for (let x = -GAME.cameraX % 50; x < canvas.width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    GAME.walls.forEach(wall => {
        if (wall.type === 'RAMP_UP') {
            ctx.fillStyle = '#222'; ctx.strokeStyle = '#333';
            ctx.beginPath(); ctx.moveTo(wall.x - GAME.cameraX, wall.y + wall.h); ctx.lineTo(wall.x + wall.w - GAME.cameraX, wall.y); ctx.lineTo(wall.x + wall.w - GAME.cameraX, wall.y + wall.h); ctx.fill(); ctx.stroke();
        } else if (wall.type === 'RAMP_DOWN') {
            ctx.fillStyle = '#222'; ctx.strokeStyle = '#333';
            ctx.beginPath(); ctx.moveTo(wall.x - GAME.cameraX, wall.y); ctx.lineTo(wall.x + wall.w - GAME.cameraX, wall.y + wall.h); ctx.lineTo(wall.x - GAME.cameraX, wall.y + wall.h); ctx.fill(); ctx.stroke();
        } else {
            ctx.fillStyle = (wall.destructible && wall.health < 50) ? '#1a1a1a' : '#222';
            ctx.fillRect(wall.x - GAME.cameraX, wall.y, wall.w, wall.h);
            ctx.strokeStyle = wall.destructible ? '#444' : '#333'; ctx.strokeRect(wall.x - GAME.cameraX, wall.y, wall.w, wall.h);
        }
    });
    GAME.enemies.forEach(e => e.draw());
    if (GAME.player && !GAME.editorMode) GAME.player.draw();
    GAME.bullets.forEach(b => b.draw());
    GAME.particles.forEach(p => p.draw());

    if (GAME.editorMode) {
        // Update Editor UI Text
        document.getElementById('ed-item').innerText = GAME.editorItem;
        document.getElementById('ed-class').innerText = GAME.editorClass;

        // Ghost placement
        const gx = Math.floor((mouse.x + GAME.cameraX) / 50) * 50;
        const gy = Math.floor(mouse.y / 50) * 50;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(gx - GAME.cameraX, gy, 50, 50);
    } else if (GAME.player) {
        ctx.fillStyle = '#300'; ctx.fillRect(20, 560, 200, 20);
        ctx.fillStyle = '#f00'; ctx.fillRect(20, 560, (GAME.player.health / GAME.player.maxHealth) * 200, 20);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
UI.showMainMenu();
loop();
