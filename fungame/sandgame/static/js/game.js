// Simulation configuration
const CONFIG = {
    cols: 280,
    rows: 160,
    elements: {
        air: 0,
        sand: 1,
        water: 2,
        wood: 3,
        fire: 4,
        oil: 5,
        acid: 6,
        wall: 7,
        smoke: 8
    }
};

// Static color arrays for persistent pixel texture
const SHADES = {
    [CONFIG.elements.sand]: ['#f59e0b', '#d97706', '#b45309', '#fbbf24', '#fef08a'],
    [CONFIG.elements.water]: ['#2563eb', '#1d4ed8', '#1e40af', '#3b82f6', '#60a5fa'],
    [CONFIG.elements.wood]: ['#78350f', '#92400e', '#b45309', '#854d0e'],
    [CONFIG.elements.oil]: ['#1e293b', '#0f172a', '#334155', '#475569'],
    [CONFIG.elements.acid]: ['#22c55e', '#16a34a', '#4ade80', '#15803d'],
    [CONFIG.elements.wall]: ['#4b5563', '#374151', '#1f2937', '#6b7280']
};

const state = {
    canvas: null,
    ctx: null,
    grid: [], // Grid cell element types
    metaGrid: [], // Extra data: shade index for solids, lifetime for fire/smoke
    updatedThisFrame: [], // Double-buffering flag
    
    // UI controls
    activeElement: 'sand',
    brushSize: 4,
    gravity: 'down',
    isPaused: false,
    isMouseDown: false,
    
    // FPS stats
    fps: 0,
    lastFrameTime: 0,
    frameCount: 0,
    fpsTimer: 0
};

window.addEventListener('DOMContentLoaded', () => {
    state.canvas = document.getElementById('sand-canvas');
    state.ctx = state.canvas.getContext('2d');
    
    initGrid();
    setupControls();
    setupInteraction();
    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(gameLoop);
});

function initGrid() {
    state.grid = Array(CONFIG.cols).fill(null).map(() => Array(CONFIG.rows).fill(CONFIG.elements.air));
    state.metaGrid = Array(CONFIG.cols).fill(null).map(() => Array(CONFIG.rows).fill(0));
    state.updatedThisFrame = Array(CONFIG.cols).fill(null).map(() => Array(CONFIG.rows).fill(false));
}

function resizeCanvas() {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
}

function setupControls() {
    const brushInput = document.getElementById('brush-size');
    const brushVal = document.getElementById('brush-val');
    brushInput.addEventListener('input', (e) => {
        state.brushSize = parseInt(e.target.value);
        brushVal.textContent = state.brushSize;
    });

    const gravitySelect = document.getElementById('gravity-select');
    gravitySelect.addEventListener('change', (e) => {
        state.gravity = e.target.value;
    });

    const btnPause = document.getElementById('btn-pause');
    btnPause.addEventListener('click', () => {
        state.isPaused = !state.isPaused;
        btnPause.textContent = state.isPaused ? 'Resume' : 'Pause';
        btnPause.classList.toggle('primary', state.isPaused);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        initGrid();
    });

    // Add support for selecting the newly added Smoke element if needed (or keep UI elements clean)
    const elButtons = document.querySelectorAll('.el-btn');
    elButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeElement = btn.getAttribute('data-element');
        });
    });
}

function setupInteraction() {
    const drawParticles = (e) => {
        if (!state.isMouseDown) return;
        
        const rect = state.canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (clientX === undefined || clientY === undefined) return;
        
        const scaleX = CONFIG.cols / rect.width;
        const scaleY = CONFIG.rows / rect.height;
        
        const gridX = Math.floor((clientX - rect.left) * scaleX);
        const gridY = Math.floor((clientY - rect.top) * scaleY);
        
        const radius = state.brushSize;
        const targetElement = CONFIG.elements[state.activeElement];
        
        for (let xOffset = -radius; xOffset <= radius; xOffset++) {
            for (let yOffset = -radius; yOffset <= radius; yOffset++) {
                if (xOffset * xOffset + yOffset * yOffset <= radius * radius) {
                    const drawX = gridX + xOffset;
                    const drawY = gridY + yOffset;
                    
                    if (isValidGrid(drawX, drawY)) {
                        // Protect bedrock from being overwritten unless using Eraser
                        if (state.grid[drawX][drawY] !== CONFIG.elements.wall || targetElement === CONFIG.elements.air) {
                            state.grid[drawX][drawY] = targetElement;
                            
                            // Initialize meta information
                            if (targetElement === CONFIG.elements.fire) {
                                state.metaGrid[drawX][drawY] = 25 + Math.floor(Math.random() * 20); // Lifetime
                            } else if (targetElement === CONFIG.elements.smoke) {
                                state.metaGrid[drawX][drawY] = 30 + Math.floor(Math.random() * 20); // Lifetime
                            } else if (SHADES[targetElement]) {
                                // Assign random persistent shade index
                                state.metaGrid[drawX][drawY] = Math.floor(Math.random() * SHADES[targetElement].length);
                            } else {
                                state.metaGrid[drawX][drawY] = 0;
                            }
                        }
                    }
                }
            }
        }
    };

    state.canvas.addEventListener('mousedown', (e) => {
        state.isMouseDown = true;
        drawParticles(e);
    });

    window.addEventListener('mousemove', drawParticles);
    window.addEventListener('mouseup', () => { state.isMouseDown = false; });

    state.canvas.addEventListener('touchstart', (e) => {
        state.isMouseDown = true;
        drawParticles(e);
    }, { passive: true });

    window.addEventListener('touchmove', drawParticles, { passive: true });
    window.addEventListener('touchend', () => { state.isMouseDown = false; });
}

function isValidGrid(x, y) {
    return x >= 0 && x < CONFIG.cols && y >= 0 && y < CONFIG.rows;
}

function isEmpty(x, y) {
    return isValidGrid(x, y) && state.grid[x][y] === CONFIG.elements.air;
}

function gameLoop(timestamp) {
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    const delta = timestamp - state.lastFrameTime;
    state.lastFrameTime = timestamp;
    
    state.frameCount++;
    state.fpsTimer += delta;
    if (state.fpsTimer >= 1000) {
        state.fps = Math.round((state.frameCount * 1000) / state.fpsTimer);
        document.getElementById('stat-fps').textContent = `${state.fps} FPS`;
        state.frameCount = 0;
        state.fpsTimer = 0;
    }
    
    if (!state.isPaused) {
        updateSimulation();
    }
    
    render();
    requestAnimationFrame(gameLoop);
}

function updateSimulation() {
    for (let x = 0; x < CONFIG.cols; x++) {
        for (let y = 0; y < CONFIG.rows; y++) {
            state.updatedThisFrame[x][y] = false;
        }
    }
    
    let xStart = 0, xEnd = CONFIG.cols, xStep = 1;
    let yStart = 0, yEnd = CONFIG.rows, yStep = 1;
    
    if (state.gravity === 'down') {
        yStart = CONFIG.rows - 1; yEnd = -1; yStep = -1;
    } else if (state.gravity === 'up') {
        yStart = 0; yEnd = CONFIG.rows; yStep = 1;
    } else if (state.gravity === 'right') {
        xStart = CONFIG.cols - 1; xEnd = -1; xStep = -1;
    } else if (state.gravity === 'left') {
        xStart = 0; xEnd = CONFIG.cols; xStep = 1;
    }
    
    for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep) {
            if (state.updatedThisFrame[x][y]) continue;
            
            const el = state.grid[x][y];
            if (el === CONFIG.elements.air || el === CONFIG.elements.wall || el === CONFIG.elements.wood) continue;
            
            updateElement(x, y, el);
        }
    }
}

function updateElement(x, y, el) {
    let gDx = 0, gDy = 0;
    if (state.gravity === 'down') gDy = 1;
    else if (state.gravity === 'up') gDy = -1;
    else if (state.gravity === 'left') gDx = -1;
    else if (state.gravity === 'right') gDx = 1;
    
    const side1Dx = gDy, side1Dy = -gDx;
    const side2Dx = -gDy, side2Dy = gDx;
    
    const belowX = x + gDx, belowY = y + gDy;
    const belowLeftX = x + gDx + side1Dx, belowLeftY = y + gDy + side1Dy;
    const belowRightX = x + gDx + side2Dx, belowRightY = y + gDy + side2Dy;
    
    const leftX = x + side1Dx, leftY = y + side1Dy;
    const rightX = x + side2Dx, rightY = y + side2Dy;
    
    // --- SAND ---
    if (el === CONFIG.elements.sand) {
        if (isEmpty(belowX, belowY)) {
            moveCell(x, y, belowX, belowY);
        } else if (isEmpty(belowLeftX, belowLeftY)) {
            moveCell(x, y, belowLeftX, belowLeftY);
        } else if (isEmpty(belowRightX, belowRightY)) {
            moveCell(x, y, belowRightX, belowRightY);
        }
    }
    
    // --- WATER ---
    else if (el === CONFIG.elements.water) {
        if (isEmpty(belowX, belowY)) {
            moveCell(x, y, belowX, belowY);
        } else if (isEmpty(belowLeftX, belowLeftY)) {
            moveCell(x, y, belowLeftX, belowLeftY);
        } else if (isEmpty(belowRightX, belowRightY)) {
            moveCell(x, y, belowRightX, belowRightY);
        } else {
            const goLeft = Math.random() < 0.5;
            if (goLeft && isEmpty(leftX, leftY)) {
                moveCell(x, y, leftX, leftY);
            } else if (!goLeft && isEmpty(rightX, rightY)) {
                moveCell(x, y, rightX, rightY);
            } else if (isEmpty(leftX, leftY)) {
                moveCell(x, y, leftX, leftY);
            } else if (isEmpty(rightX, rightY)) {
                moveCell(x, y, rightX, rightY);
            }
        }
    }
    
    // --- OIL ---
    else if (el === CONFIG.elements.oil) {
        if (isEmpty(belowX, belowY)) {
            moveCell(x, y, belowX, belowY);
        } else if (Math.random() < 0.6) {
            if (isEmpty(belowLeftX, belowLeftY)) {
                moveCell(x, y, belowLeftX, belowLeftY);
            } else if (isEmpty(belowRightX, belowRightY)) {
                moveCell(x, y, belowRightX, belowRightY);
            } else {
                const goLeft = Math.random() < 0.5;
                if (goLeft && isEmpty(leftX, leftY)) {
                    moveCell(x, y, leftX, leftY);
                } else if (!goLeft && isEmpty(rightX, rightY)) {
                    moveCell(x, y, rightX, rightY);
                }
            }
        }
    }
    
    // --- ACID ---
    else if (el === CONFIG.elements.acid) {
        const neighbors = [
            {nx: belowX, ny: belowY},
            {nx: leftX, ny: leftY},
            {nx: rightX, ny: rightY},
            {nx: x - gDx, ny: y - gDy}
        ];
        
        let dissolved = false;
        for (const n of neighbors) {
            if (isValidGrid(n.nx, n.ny)) {
                const nel = state.grid[n.nx][n.ny];
                if (nel !== CONFIG.elements.air && nel !== CONFIG.elements.wall && nel !== CONFIG.elements.acid) {
                    state.grid[n.nx][n.ny] = CONFIG.elements.air;
                    state.grid[x][y] = CONFIG.elements.air;
                    dissolved = true;
                    // Spark smoke when acid eats stuff
                    if (Math.random() < 0.3) {
                        state.grid[x][y] = CONFIG.elements.smoke;
                        state.metaGrid[x][y] = 20 + Math.floor(Math.random() * 20);
                    }
                    break;
                }
            }
        }
        
        if (!dissolved) {
            if (isEmpty(belowX, belowY)) {
                moveCell(x, y, belowX, belowY);
            } else if (isEmpty(belowLeftX, belowLeftY)) {
                moveCell(x, y, belowLeftX, belowLeftY);
            } else if (isEmpty(belowRightX, belowRightY)) {
                moveCell(x, y, belowRightX, belowRightY);
            } else {
                const goLeft = Math.random() < 0.5;
                if (goLeft && isEmpty(leftX, leftY)) {
                    moveCell(x, y, leftX, leftY);
                } else if (isEmpty(rightX, rightY)) {
                    moveCell(x, y, rightX, rightY);
                }
            }
        }
    }
    
    // --- FIRE ---
    else if (el === CONFIG.elements.fire) {
        let lifetime = state.metaGrid[x][y];
        lifetime--;
        
        if (lifetime <= 0) {
            // Turn into smoke on extinction
            if (Math.random() < 0.2) {
                state.grid[x][y] = CONFIG.elements.smoke;
                state.metaGrid[x][y] = 20 + Math.floor(Math.random() * 20);
            } else {
                state.grid[x][y] = CONFIG.elements.air;
                state.metaGrid[x][y] = 0;
            }
            return;
        }
        
        state.metaGrid[x][y] = lifetime;
        
        // Burn wood and oil
        const fireNeighbors = [
            [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];
        for (const offset of fireNeighbors) {
            const cx = x + offset[0];
            const cy = y + offset[1];
            if (isValidGrid(cx, cy)) {
                const target = state.grid[cx][cy];
                if (target === CONFIG.elements.wood || target === CONFIG.elements.oil) {
                    state.grid[cx][cy] = CONFIG.elements.fire;
                    state.metaGrid[cx][cy] = 30 + Math.floor(Math.random() * 20);
                }
            }
        }
        
        // Rise up against gravity
        const riseX = x - gDx;
        const riseY = y - gDy;
        const floatX = Math.floor(Math.random() * 3) - 1;
        const floatY = Math.floor(Math.random() * 3) - 1;
        
        const targetX = riseX + floatX;
        const targetY = riseY + floatY;
        
        if (isEmpty(targetX, targetY)) {
            moveCell(x, y, targetX, targetY);
        } else if (Math.random() < 0.25 && isEmpty(x + floatX, y + floatY)) {
            moveCell(x, y, x + floatX, y + floatY);
        }
    }
    
    // --- SMOKE ---
    else if (el === CONFIG.elements.smoke) {
        let lifetime = state.metaGrid[x][y];
        lifetime--;
        
        if (lifetime <= 0) {
            state.grid[x][y] = CONFIG.elements.air;
            state.metaGrid[x][y] = 0;
            return;
        }
        
        state.metaGrid[x][y] = lifetime;
        
        // Smoke drifts opposite to gravity (rises)
        const riseX = x - gDx;
        const riseY = y - gDy;
        const driftX = Math.floor(Math.random() * 3) - 1;
        const driftY = Math.floor(Math.random() * 3) - 1;
        
        const targetX = riseX + driftX;
        const targetY = riseY + driftY;
        
        if (isEmpty(targetX, targetY)) {
            moveCell(x, y, targetX, targetY);
        } else if (Math.random() < 0.4 && isEmpty(x + driftX, y + driftY)) {
            moveCell(x, y, x + driftX, y + driftY);
        }
    }
}

function moveCell(fromX, fromY, toX, toY) {
    state.grid[toX][toY] = state.grid[fromX][fromY];
    state.metaGrid[toX][toY] = state.metaGrid[fromX][fromY];
    
    state.grid[fromX][fromY] = CONFIG.elements.air;
    state.metaGrid[fromX][fromY] = 0;
    
    state.updatedThisFrame[toX][toY] = true;
}

function render() {
    const ctx = state.ctx;
    const canvas = state.canvas;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cellWidth = canvas.width / CONFIG.cols;
    const cellHeight = canvas.height / CONFIG.rows;
    
    let activeParticlesCount = 0;
    
    for (let x = 0; x < CONFIG.cols; x++) {
        for (let y = 0; y < CONFIG.rows; y++) {
            const el = state.grid[x][y];
            if (el !== CONFIG.elements.air) {
                activeParticlesCount++;
                
                // Color computation
                if (el === CONFIG.elements.fire) {
                    const lifetime = state.metaGrid[x][y];
                    if (lifetime > 30) {
                        ctx.fillStyle = '#fffdf0'; // hot white-yellow
                    } else if (lifetime > 15) {
                        ctx.fillStyle = '#f97316'; // orange
                    } else {
                        ctx.fillStyle = '#ef4444'; // red
                    }
                } else if (el === CONFIG.elements.smoke) {
                    const lifetime = state.metaGrid[x][y];
                    const alpha = (lifetime / 45).toFixed(2);
                    ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
                } else if (SHADES[el]) {
                    const shadeIndex = state.metaGrid[x][y];
                    ctx.fillStyle = SHADES[el][shadeIndex % SHADES[el].length];
                }
                
                ctx.fillRect(
                    Math.floor(x * cellWidth),
                    Math.floor(y * cellHeight),
                    Math.ceil(cellWidth),
                    Math.ceil(cellHeight)
                );
            }
        }
    }
    
    document.getElementById('stat-particles').textContent = activeParticlesCount;
}
