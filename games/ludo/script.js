/**
 * Ludo Evolution - Core Game Logic
 */

const STATE = {
    playerCount: 4,
    currentPlayer: 0, // 0: Red, 1: Green, 2: Yellow, 3: Blue
    diceValue: 0,
    isDiceRolled: false,
    pieces: [
        // Each player has 4 pieces: {pos: -1 (base), 0-51 (main path), 52-57 (home path/finish)}
        [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }], // Player 0 (Red)
        [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }], // Player 1 (Green)
        [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }], // Player 2 (Yellow)
        [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }]  // Player 3 (Blue)
    ],
    playerNames: ["Red", "Green", "Yellow", "Blue"],
    colors: ["red", "green", "yellow", "blue"],
    gameOver: false
};

// Map of starting positions on the 52-cell main path
const START_POS = [1, 14, 27, 40];
const HOME_ENTRANCE = [51, 12, 25, 38]; // Cell before entering home path
const SAFE_CELLS = [1, 9, 14, 22, 27, 35, 40, 48];

// DOM Elements
const boardEl = document.getElementById('ludo-board');
const diceEl = document.getElementById('dice');
const rollBtn = document.getElementById('roll-btn');
const currentPlayerNameEl = document.getElementById('current-player-name');
const logsEl = document.getElementById('game-logs');
const setupModal = document.getElementById('setup-modal');
const winnerModal = document.getElementById('winner-modal');

/**
 * Initialize Board Cells
 */
function initBoard() {
    // Current layout implementation assumes standard 15x15 grid
    // We'll fill the paths (middle sections)

    // Clear paths if any (for restart)
    document.querySelectorAll('.cell').forEach(c => c.remove());

    // The grid is 15x15. Bases are 6x6. Center is 3x3.
    // Paths are rows/cols: 6,7,8 index (0-based)

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            // Skip bases and center
            if ((r < 6 || r > 8) && (c < 6 || c > 8)) continue;
            if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Assign ID to main path cells for easy mapping
            const pathId = getPathId(r, c);
            if (pathId !== null) {
                cell.dataset.pathId = pathId;
                if (SAFE_CELLS.includes(pathId)) cell.classList.add('safe');

                // Color home entry points
                if (pathId === 1) cell.classList.add('red-home-entry');
                if (pathId === 14) cell.classList.add('green-home-entry');
                if (pathId === 27) cell.classList.add('yellow-home-entry');
                if (pathId === 40) cell.classList.add('blue-home-entry');
            }

            // Assign Home Path IDs
            const homeId = getHomePathInfo(r, c);
            if (homeId) {
                cell.classList.add(`${homeId.color}-home`);
                cell.dataset.homePlayer = homeId.player;
                cell.dataset.homePos = homeId.pos;
            }

            // Positioning in grid
            cell.style.gridRow = r + 1;
            cell.style.gridColumn = c + 1;

            boardEl.appendChild(cell);
        }
    }
}

/**
 * Maps grid (r,c) to main path 0-51
 */
function getPathId(r, c) {
    // 52-cell main path sequence (Clockwise starting near Red Base)
    const actualPath = [
        [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], // Red path
        [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], // To Green
        [0, 7], [0, 8],
        [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], // Green path
        [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // To Yellow
        [7, 14], [8, 14],
        [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], // Yellow path
        [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], // To Blue
        [14, 6],
        [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], // Blue path
        [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0]
    ];

    for (let i = 0; i < actualPath.length; i++) {
        if (actualPath[i][0] === r && actualPath[i][1] === c) return i;
    }
    return null;
}

function getHomePathInfo(r, c) {
    if (r === 7 && c > 0 && c < 6) return { color: 'red', player: 0, pos: c - 1 };
    if (c === 7 && r > 0 && r < 6) return { color: 'green', player: 1, pos: r - 1 };
    if (r === 7 && c > 8 && c < 14) return { color: 'yellow', player: 2, pos: 13 - c };
    if (c === 7 && r > 8 && r < 14) return { color: 'blue', player: 3, pos: 13 - r };
    return null;
}

/**
 * Game Controller
 */
function log(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    logsEl.prepend(entry);
}

function rollDice() {
    if (STATE.isDiceRolled || STATE.gameOver) return;

    STATE.diceValue = Math.floor(Math.random() * 6) + 1;
    // diceValue = 6; // Debug

    // Animate Dice
    diceEl.className = 'dice-rolling';
    rollBtn.disabled = true;

    setTimeout(() => {
        STATE.isDiceRolled = true;
        updateDiceUI(STATE.diceValue);
        highlightMovablePieces();

        const movable = getMovablePieces();
        if (movable.length === 0) {
            log(`${STATE.playerNames[STATE.currentPlayer]} rolled a ${STATE.diceValue}. No moves possible.`);
            setTimeout(nextTurn, 1000);
        } else if (movable.length === 1 && STATE.diceValue !== 6) {
            // Auto move if only one choice and not a 6 (which might offer choice of getting out)
            // Actually, keep it interactive for better feel.
            log(`${STATE.playerNames[STATE.currentPlayer]} rolled a ${STATE.diceValue}.`);
        } else {
            log(`${STATE.playerNames[STATE.currentPlayer]} rolled a ${STATE.diceValue}. Select a piece.`);
        }
    }, 600);
}

function updateDiceUI(val) {
    diceEl.className = ''; // Stop rolling
    // Standard rotation for 3D dice to show correct face
    const rotations = {
        1: 'rotateY(0deg)',
        2: 'rotateY(180deg)',
        3: 'rotateY(90deg)',
        4: 'rotateY(-90deg)',
        5: 'rotateX(90deg)',
        6: 'rotateX(-90deg)'
    };
    diceEl.style.transform = rotations[val];
}

function getMovablePieces() {
    const playerPieces = STATE.pieces[STATE.currentPlayer];
    return playerPieces.filter((p, index) => canMove(STATE.currentPlayer, index));
}

function canMove(playerIdx, pieceIdx) {
    const piece = STATE.pieces[playerIdx][pieceIdx];
    const dice = STATE.diceValue;

    // Inside base: need a 6 to get out
    if (piece.pos === -1) {
        return dice === 6;
    }

    // Home stretch: pos 52 to 57 (finish)
    if (piece.pos >= 52) {
        return piece.pos + dice <= 57;
    }

    // Main path: always can move (unless we add complex block rules)
    return true;
}

function highlightMovablePieces() {
    clearHighlights();
    const movable = getMovablePieces();
    movable.forEach(p => {
        const pieceEl = document.querySelector(`.piece[data-player="${STATE.currentPlayer}"][data-piece-idx="${STATE.pieces[STATE.currentPlayer].indexOf(p)}"]`);
        if (pieceEl) pieceEl.classList.add('active');
    });
}

function clearHighlights() {
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('active'));
}

function movePiece(playerIdx, pieceIdx) {
    if (!STATE.isDiceRolled || playerIdx !== STATE.currentPlayer) return;
    if (!canMove(playerIdx, pieceIdx)) return;

    const piece = STATE.pieces[playerIdx][pieceIdx];
    const dice = STATE.diceValue;

    STATE.isDiceRolled = false;
    clearHighlights();

    let newPos;
    if (piece.pos === -1) {
        // Getting out of base
        newPos = START_POS[playerIdx];
        log(`${STATE.playerNames[playerIdx]} piece is out!`);
    } else {
        // General movement
        newPos = calculateNewPosition(playerIdx, piece.pos, dice);
    }

    // Capture logic Check (before updating state position)
    const captured = checkCapture(playerIdx, newPos);

    piece.pos = newPos;
    renderPieces();

    if (captured) {
        log(`BOOM! ${STATE.playerNames[playerIdx]} captured a piece! Extra turn!`);
        resetDice();
    } else if (dice === 6) {
        log(`${STATE.playerNames[playerIdx]} got a 6! Extra turn!`);
        resetDice();
    } else if (newPos === 57) {
        log(`${STATE.playerNames[playerIdx]} reached HOME! Extra turn!`);
        if (checkWin(playerIdx)) return;
        resetDice();
    } else {
        nextTurn();
    }
}

function calculateNewPosition(playerIdx, currentPos, steps) {
    if (currentPos >= 52) return currentPos + steps; // Home path

    let newPos = currentPos;
    for (let i = 0; i < steps; i++) {
        // If at entrance to THEIR home
        if (newPos === HOME_ENTRANCE[playerIdx]) {
            // Move into home path (52-57)
            newPos = 52 + (steps - i - 1);
            if (newPos > 57) return currentPos; // Should be handled by canMove
            return newPos;
        }

        newPos = (newPos + 1) % 52;
    }
    return newPos;
}

function checkCapture(playerIdx, newPos) {
    if (newPos >= 52 || SAFE_CELLS.includes(newPos)) return false;

    let captured = false;
    STATE.pieces.forEach((playerPieces, pIdx) => {
        if (pIdx === playerIdx) return;
        playerPieces.forEach(piece => {
            if (piece.pos === newPos) {
                piece.pos = -1; // Send back to base
                captured = true;
            }
        });
    });
    return captured;
}

function checkWin(playerIdx) {
    const allHome = STATE.pieces[playerIdx].every(p => p.pos === 57);
    if (allHome) {
        STATE.gameOver = true;
        winnerModal.classList.remove('hidden');
        document.getElementById('winner-text').textContent = `${STATE.playerNames[playerIdx]} Wins!`;
        document.getElementById('winner-text').style.color = `var(--${STATE.colors[playerIdx]})`;
        return true;
    }
    return false;
}

function nextTurn() {
    STATE.currentPlayer = (STATE.currentPlayer + 1) % STATE.playerCount;
    resetDice();
    updateTurnUI();
}

function resetDice() {
    STATE.isDiceRolled = false;
    STATE.diceValue = 0;
    rollBtn.disabled = false;
    // Reset dice visual if needed or just leave it at the last roll
}

function updateTurnUI() {
    currentPlayerNameEl.textContent = STATE.playerNames[STATE.currentPlayer];
    currentPlayerNameEl.style.color = `var(--${STATE.colors[STATE.currentPlayer]})`;

    document.querySelectorAll('.player-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.player-panel[data-player="${STATE.currentPlayer}"]`).classList.add('active');
}

/**
 * Rendering
 */
function renderPieces() {
    // Remove existing pieces from board/bases
    document.querySelectorAll('.piece').forEach(p => p.remove());

    STATE.pieces.forEach((playerPieces, pIdx) => {
        playerPieces.forEach((piece, pieceIdx) => {
            const pieceEl = document.createElement('div');
            pieceEl.className = `piece piece-${STATE.colors[pIdx]}`;
            pieceEl.dataset.player = pIdx;
            pieceEl.dataset.pieceIdx = pieceIdx;
            pieceEl.onclick = (e) => {
                e.stopPropagation();
                movePiece(pIdx, pieceIdx);
            };

            // Centralized transform for centering absolutely positioned piece
            let transform = 'translate(-50%, -50%)';

            if (piece.pos === -1) {
                // In base
                const slots = document.querySelectorAll(`.base-${STATE.colors[pIdx]} .piece-slot`);
                slots[pieceIdx].appendChild(pieceEl);
                pieceEl.style.transform = transform;
            } else if (piece.pos >= 52) {
                // In home path
                const homePos = piece.pos - 52;
                const cell = document.querySelector(`.cell[data-home-player="${pIdx}"][data-home-pos="${homePos}"]`);
                if (cell) {
                    const existing = cell.querySelectorAll('.piece').length;
                    if (existing > 0) {
                        transform = `translate(calc(-50% + ${existing * 4}px), calc(-50% + ${existing * 4}px))`;
                        pieceEl.style.zIndex = 10 + existing;
                    }
                    cell.appendChild(pieceEl);
                    pieceEl.style.transform = transform;
                }
            } else {
                // On main path
                const cell = document.querySelector(`.cell[data-path-id="${piece.pos}"]`);
                if (cell) {
                    const existing = cell.querySelectorAll('.piece').length;
                    if (existing > 0) {
                        transform = `translate(calc(-50% + ${existing * 4}px), calc(-50% + ${existing * 4}px))`;
                        pieceEl.style.zIndex = 10 + existing;
                    }
                    cell.appendChild(pieceEl);
                    pieceEl.style.transform = transform;
                }
            }
        });
    });
}

/**
 * Setup & Start
 */
document.getElementById('start-game-btn').onclick = () => {
    STATE.playerCount = parseInt(document.getElementById('player-count').value);
    setupModal.classList.add('hidden');

    // Disable unused player panels
    document.querySelectorAll('.player-panel').forEach((p, i) => {
        if (i >= STATE.playerCount) p.style.display = 'none';
    });

    initBoard();
    updateTurnUI();
    renderPieces();
    log("Game Started! Red goes first.");
};

rollBtn.onclick = rollDice;

// Initial call
// initBoard(); // Wait for start button
