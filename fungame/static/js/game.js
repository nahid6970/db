// Theme color definitions
const THEMES = {
    cyberpunk: {
        bg: '#0b0f19',
        panelBg: 'rgba(15, 23, 42, 0.65)',
        gridColor: 'rgba(236, 72, 153, 0.05)',
        colors: ['#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308']
    },
    matrix: {
        bg: '#050705',
        panelBg: 'rgba(10, 20, 10, 0.7)',
        gridColor: 'rgba(34, 197, 94, 0.05)',
        colors: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']
    },
    glacier: {
        bg: '#030712',
        panelBg: 'rgba(17, 24, 39, 0.7)',
        gridColor: 'rgba(6, 182, 212, 0.05)',
        colors: ['#0c4a6e', '#0369a1', '#0284c7', '#0099ff', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc']
    },
    monochrome: {
        bg: '#0f172a',
        panelBg: 'rgba(30, 41, 59, 0.7)',
        gridColor: 'rgba(255, 255, 255, 0.03)',
        colors: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9', '#ffffff']
    },
    rainbow: {
        bg: '#09090b',
        panelBg: 'rgba(20, 20, 25, 0.7)',
        gridColor: 'rgba(255, 255, 255, 0.03)',
        colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3', '#ff007f']
    }
};

// Main Simulation State
const state = {
    canvas: null,
    ctx: null,
    
    // Zoom and Pan
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    
    // Configuration
    steps: 5,
    minBoxes: 1,
    maxBoxes: 4,
    boxSize: 20,
    interval: 300,
    theme: 'cyberpunk',
    
    // Simulation logic
    grid: new Map(), // key: "x,y" -> value: { step, colorIndex }
    endpoints: [],  // list of active endpoints { x, y, incomingDir }
    currentStep: 0,
    isRunning: false,
    timerId: null,
    totalBoxes: 1,
};

// Initialize elements
window.addEventListener('DOMContentLoaded', () => {
    state.canvas = document.getElementById('simulation-canvas');
    state.ctx = state.canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupControls();
    setupInteraction();
    
    // Initial reset to render start state
    resetSimulation();
});

function resizeCanvas() {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
    
    // Center pan on resize only if it's the initial load or after reset
    if (state.panX === 0 && state.panY === 0) {
        recenterView();
    }
    
    draw();
}

function recenterView() {
    state.panX = state.canvas.width / 2;
    state.panY = state.canvas.height / 2;
    state.zoom = 1;
    draw();
}

// Map DOM controls to state variables
function setupControls() {
    const stepsInput = document.getElementById('steps-input');
    const stepsVal = document.getElementById('steps-val');
    stepsInput.addEventListener('input', (e) => {
        state.steps = parseInt(e.target.value);
        stepsVal.textContent = state.steps;
    });

    const minBoxesInput = document.getElementById('min-boxes');
    const minVal = document.getElementById('min-val');
    minBoxesInput.addEventListener('input', (e) => {
        state.minBoxes = parseInt(e.target.value);
        if (state.minBoxes > state.maxBoxes) {
            state.maxBoxes = state.minBoxes;
            document.getElementById('max-boxes').value = state.maxBoxes;
            document.getElementById('max-val').textContent = state.maxBoxes;
        }
        minVal.textContent = state.minBoxes;
    });

    const maxBoxesInput = document.getElementById('max-boxes');
    const maxVal = document.getElementById('max-val');
    maxBoxesInput.addEventListener('input', (e) => {
        state.maxBoxes = parseInt(e.target.value);
        if (state.maxBoxes < state.minBoxes) {
            state.minBoxes = state.maxBoxes;
            document.getElementById('min-boxes').value = state.minBoxes;
            document.getElementById('min-val').textContent = state.minBoxes;
        }
        maxVal.textContent = state.maxBoxes;
    });

    const boxSizeInput = document.getElementById('box-size');
    const sizeVal = document.getElementById('size-val');
    boxSizeInput.addEventListener('input', (e) => {
        state.boxSize = parseInt(e.target.value);
        sizeVal.textContent = state.boxSize;
        draw();
    });

    const speedInput = document.getElementById('speed-input');
    const speedVal = document.getElementById('speed-val');
    speedInput.addEventListener('input', (e) => {
        state.interval = parseInt(e.target.value);
        speedVal.textContent = state.interval;
        if (state.isRunning) {
            pauseSimulation();
            startSimulation();
        }
    });

    const themeSelect = document.getElementById('theme-select');
    themeSelect.addEventListener('change', (e) => {
        state.theme = e.target.value;
        applyThemeStyles();
        draw();
    });

    // Action buttons
    const btnRun = document.getElementById('btn-run');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');

    btnRun.addEventListener('click', () => {
        if (!state.isRunning) {
            if (state.currentStep >= state.steps) {
                resetSimulation();
            }
            startSimulation();
        }
    });

    btnPause.addEventListener('click', () => {
        if (state.isRunning) {
            pauseSimulation();
        }
    });

    btnReset.addEventListener('click', () => {
        resetSimulation();
    });

    // Zoom Buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => adjustZoom(1.2));
    document.getElementById('btn-zoom-out').addEventListener('click', () => adjustZoom(1 / 1.2));
    document.getElementById('btn-zoom-reset').addEventListener('click', recenterView);

    // Initial theme styling
    applyThemeStyles();
}

function applyThemeStyles() {
    const selectedTheme = THEMES[state.theme];
    document.documentElement.style.setProperty('--bg-color', selectedTheme.bg);
    document.documentElement.style.setProperty('--panel-bg', selectedTheme.panelBg);
    
    // Choose primary & secondary accents from theme palette
    const primaryAccent = selectedTheme.colors[selectedTheme.colors.length - 1];
    const secondaryAccent = selectedTheme.colors[Math.floor(selectedTheme.colors.length / 2)];
    
    document.documentElement.style.setProperty('--accent-primary', primaryAccent);
    document.documentElement.style.setProperty('--accent-secondary', secondaryAccent);
    document.documentElement.style.setProperty('--accent-glow', primaryAccent + '66'); // 40% alpha
}

// Track mouse/touch for pan & zoom
function setupInteraction() {
    const canvas = state.canvas;

    canvas.addEventListener('mousedown', (e) => {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.isDragging) return;
        state.panX = e.clientX - state.startX;
        state.panY = e.clientY - state.startY;
        draw();
    });

    window.addEventListener('mouseup', () => {
        state.isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        
        // Zoom toward mouse pointer
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        state.panX = mouseX - (mouseX - state.panX) * zoomFactor;
        state.panY = mouseY - (mouseY - state.panY) * zoomFactor;
        state.zoom *= zoomFactor;
        
        draw();
    }, { passive: false });

    // Double click to zoom in at mouse position
    canvas.addEventListener('dblclick', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const zoomFactor = 1.5;
        
        state.panX = mouseX - (mouseX - state.panX) * zoomFactor;
        state.panY = mouseY - (mouseY - state.panY) * zoomFactor;
        state.zoom *= zoomFactor;
        
        draw();
    });
}

function adjustZoom(factor) {
    const centerX = state.canvas.width / 2;
    const centerY = state.canvas.height / 2;
    
    state.panX = centerX - (centerX - state.panX) * factor;
    state.panY = centerY - (centerY - state.panY) * factor;
    state.zoom *= factor;
    draw();
}

// Reset the grid and endpoint list
function resetSimulation() {
    pauseSimulation();
    
    state.grid.clear();
    state.currentStep = 0;
    
    // Add central root box
    const rootBox = { x: 0, y: 0, step: 0, direction: 'root' };
    state.grid.set("0,0", rootBox);
    
    // Step 1 endpoints are the root itself
    state.endpoints = [rootBox];
    state.totalBoxes = 1;
    
    updateStats();
    
    // Recenter view to follow the new growth
    recenterView();
}

function startSimulation() {
    state.isRunning = true;
    document.getElementById('btn-run').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    
    runNextStep();
}

function pauseSimulation() {
    state.isRunning = false;
    if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
    }
    document.getElementById('btn-run').disabled = false;
    document.getElementById('btn-pause').disabled = true;
}

function updateStats() {
    document.getElementById('stat-step').textContent = `${state.currentStep} / ${state.steps}`;
    document.getElementById('stat-boxes').textContent = state.totalBoxes;
}

// Calculate the simulation's next branching step
function runNextStep() {
    if (!state.isRunning) return;
    
    if (state.currentStep >= state.steps) {
        pauseSimulation();
        return;
    }
    
    state.currentStep++;
    const nextEndpoints = [];
    
    // We branch out from each of the active endpoints
    for (const ep of state.endpoints) {
        // Define standard directions
        const directions = {
            up: { dx: 0, dy: -1, opposite: 'down' },
            down: { dx: 0, dy: 1, opposite: 'up' },
            left: { dx: -1, dy: 0, opposite: 'right' },
            right: { dx: 1, dy: 0, opposite: 'left' }
        };
        
        // Determine branch options (excluding the reverse direction we came from)
        const allowedDirs = [];
        for (const dir in directions) {
            if (ep.direction === 'root' || dir !== directions[ep.direction].opposite) {
                allowedDirs.push({ name: dir, ...directions[dir] });
            }
        }
        
        // For each allowed direction, try to branch
        for (const dirObj of allowedDirs) {
            // Random length for this branch segment
            const branchLen = Math.floor(Math.random() * (state.maxBoxes - state.minBoxes + 1)) + state.minBoxes;
            
            let currentX = ep.x;
            let currentY = ep.y;
            let actualBranchLength = 0;
            
            // Build the branch box by box
            for (let i = 1; i <= branchLen; i++) {
                const nextX = currentX + dirObj.dx;
                const nextY = currentY + dirObj.dy;
                const key = `${nextX},${nextY}`;
                
                // If collision or already occupied, stop branch expansion in this direction
                if (state.grid.has(key)) {
                    break;
                }
                
                // Save box in grid
                state.grid.set(key, {
                    x: nextX,
                    y: nextY,
                    step: state.currentStep,
                    direction: dirObj.name
                });
                
                currentX = nextX;
                currentY = nextY;
                actualBranchLength++;
                state.totalBoxes++;
            }
            
            // If the branch succeeded in placing at least one box, its end becomes a new active endpoint
            if (actualBranchLength > 0) {
                nextEndpoints.push({
                    x: currentX,
                    y: currentY,
                    step: state.currentStep,
                    direction: dirObj.name
                });
            }
        }
    }
    
    // Update endpoints to the new frontier
    state.endpoints = nextEndpoints;
    updateStats();
    draw();
    
    // Schedule next step if still running and steps remaining
    if (state.currentStep < state.steps && state.isRunning) {
        state.timerId = setTimeout(runNextStep, state.interval);
    } else {
        pauseSimulation();
    }
}

// Rendering Logic
function draw() {
    const ctx = state.ctx;
    const canvas = state.canvas;
    const theme = THEMES[state.theme];
    
    // Clear screen
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Apply pan & zoom transformations
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    
    // Draw background Grid
    drawGrid(ctx, theme.gridColor);
    
    // Draw all boxes stored in grid map
    const boxSize = state.boxSize;
    
    state.grid.forEach((box) => {
        // Pick color based on creation step
        const colorPalette = theme.colors;
        const color = colorPalette[box.step % colorPalette.length];
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        
        // Draw main glowing block
        ctx.fillRect(
            box.x * boxSize + 1,
            box.y * boxSize + 1,
            boxSize - 2,
            boxSize - 2
        );
        
        // Draw inner accent block for premium look
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(
            box.x * boxSize + 3,
            box.y * boxSize + 3,
            boxSize - 6,
            boxSize - 6
        );
    });
    
    ctx.restore();
}

function drawGrid(ctx, gridColor) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    
    const size = state.boxSize;
    const range = 100; // grid boundary range in blocks
    
    ctx.beginPath();
    for (let i = -range; i <= range; i++) {
        // Vertical lines
        ctx.moveTo(i * size, -range * size);
        ctx.lineTo(i * size, range * size);
        
        // Horizontal lines
        ctx.moveTo(-range * size, i * size);
        ctx.lineTo(range * size, i * size);
    }
    ctx.stroke();
}
