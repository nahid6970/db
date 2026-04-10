const config = {
    numbers: [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
        5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ],
    redNumbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
    blackNumbers: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
    colors: {
        red: '#e74c3c',
        black: '#1a1a1a',
        green: '#27ae60',
        gold: '#d4af37',
        cyan: '#00d2ff',
        bg: '#0d0d12'
    }
};

let balances = { p1: 10000, p2: 10000 };
let currentBets = { p1: {}, p2: {} };
let currentPlayer = 'p1'; // The one betting this round
let isSpinning = false;
let wheelRotation = 0;
let history = [];
let selectedChip = 10;
let scores = { p1: 0, p2: 0 };
let playerNames = { p1: 'PLAYER 1', p2: 'PLAYER 2' };

const canvas = document.getElementById('roulette-wheel');
const ctx = canvas.getContext('2d');
const p1BalanceEl = document.getElementById('p1-balance');
const p2BalanceEl = document.getElementById('p2-balance');
const p1Container = document.getElementById('p1-container');
const p2Container = document.getElementById('p2-container');
const totalBetEl = document.getElementById('total-bet');
const spinBtn = document.getElementById('spin-button');
const boardEl = document.getElementById('betting-board');
const historyDotsEl = document.getElementById('history-dots');
const winOverlay = document.getElementById('win-overlay');
const winAmountEl = document.getElementById('win-amount');
const resultDisplay = document.getElementById('result-display');
const winnerNumberEl = document.getElementById('winner-number');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsToggle = document.getElementById('settings-toggle');
const p1NameInput = document.getElementById('p1-name-input');
const p2NameInput = document.getElementById('p2-name-input');
const saveSettingsBtn = document.getElementById('save-settings');

const conflicts = {
    'red': 'black',
    'black': 'red',
    'even': 'odd',
    'odd': 'even',
    '1to18': '19to36',
    '19to36': '1to18'
};

function init() {
    setupBoard();
    drawWheel(0);
    setupEventListeners();
    updateUI();
}

function setupBoard() {
    boardEl.innerHTML = '';
    const zeroTile = createTile(0, 'green');
    boardEl.appendChild(zeroTile);

    const numbersContainer = document.createElement('div');
    numbersContainer.style.display = 'grid';
    numbersContainer.style.gridTemplateColumns = 'repeat(12, 1fr)';
    numbersContainer.style.gridTemplateRows = 'repeat(3, 1fr)';
    numbersContainer.style.gridColumn = 'span 12';
    numbersContainer.style.gap = '4px';

    for (let col = 1; col <= 12; col++) {
        for (let row = 3; row >= 1; row--) {
            const num = (col - 1) * 3 + row;
            const color = config.redNumbers.includes(num) ? 'red' : 'black';
            const tile = createTile(num, color);
            tile.style.gridRow = 4 - row;
            tile.style.gridColumn = col;
            numbersContainer.appendChild(tile);
        }
    }
    boardEl.appendChild(numbersContainer);
}

function createTile(num, color) {
    const div = document.createElement('div');
    div.className = `bet-tile ${color}`;
    div.dataset.bet = num;
    div.textContent = num;
    div.onclick = () => placeBet(num);
    return div;
}

function updateUI() {
    p1BalanceEl.textContent = `$${Math.max(0, balances.p1).toLocaleString()}`;
    p2BalanceEl.textContent = `$${Math.max(0, balances.p2).toLocaleString()}`;

    // Highlight turn: Bettor vs Banker
    p1Container.classList.toggle('player-1-active', currentPlayer === 'p1');
    p2Container.classList.toggle('player-2-active', currentPlayer === 'p2');

    // Add labels
    const p1Label = p1Container.querySelector('.label');
    const p2Label = p2Container.querySelector('.label');
    p1Label.textContent = currentPlayer === 'p1' ? `${playerNames.p1} (BETTING)` : `${playerNames.p1} (BANKING)`;
    p2Label.textContent = currentPlayer === 'p2' ? `${playerNames.p2} (BETTING)` : `${playerNames.p2} (BANKING)`;

    const total = Object.values(currentBets[currentPlayer]).reduce((a, b) => a + b, 0);
    totalBetEl.textContent = `$${total.toLocaleString()}`;
    spinBtn.disabled = total === 0 || isSpinning;
}

function placeBet(type) {
    if (isSpinning) return;

    const myBets = currentBets[currentPlayer];

    if (conflicts[type] && myBets[conflicts[type]]) {
        const opposite = conflicts[type];
        balances[currentPlayer] += myBets[opposite];
        delete myBets[opposite];
    }

    if (balances[currentPlayer] < selectedChip) {
        const el = currentPlayer === 'p1' ? p1BalanceEl : p2BalanceEl;
        el.classList.add('no-funds');
        setTimeout(() => el.classList.remove('no-funds'), 500);
        return;
    }

    balances[currentPlayer] -= selectedChip;
    myBets[type] = (myBets[type] || 0) + selectedChip;

    updateUI();
    renderChips();
    playBipSound();
}

function renderChips() {
    document.querySelectorAll('.chip-on-tile').forEach(c => c.remove());
    Object.entries(currentBets[currentPlayer]).forEach(([type, amount]) => {
        if (amount <= 0) return;
        const target = document.querySelector(`[data-bet="${type}"]`);
        if (target) {
            const chip = document.createElement('div');
            chip.className = `chip-on-tile ${currentPlayer}`;
            chip.textContent = amount >= 1000 ? (amount / 1000) + 'k' : amount;
            target.appendChild(chip);
        }
    });
}

function spin() {
    if (isSpinning) return;
    isSpinning = true;
    updateUI();
    resultDisplay.classList.add('hidden');

    const spinDuration = 4000;
    const startRotation = wheelRotation;
    const extraSpins = 6 + Math.random() * 4;
    const targetRotation = startRotation + (Math.PI * 2 * extraSpins);
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        wheelRotation = startRotation + (targetRotation - startRotation) * ease;
        drawWheel(wheelRotation);
        if (progress < 1) requestAnimationFrame(animate);
        else resolveSpin();
    }
    requestAnimationFrame(animate);
}

function resolveSpin() {
    isSpinning = false;
    const normalizedRotation = (wheelRotation % (Math.PI * 2));
    const sliceAngle = (Math.PI * 2) / config.numbers.length;
    let index = Math.floor(((Math.PI * 1.5) - normalizedRotation + (Math.PI * 2 * 100)) / sliceAngle) % config.numbers.length;
    const winner = config.numbers[index];

    winnerNumberEl.textContent = winner;
    resultDisplay.classList.remove('hidden');

    let colorClass = 'green';
    if (config.redNumbers.includes(winner)) colorClass = 'red';
    else if (config.blackNumbers.includes(winner)) colorClass = 'black';
    resultDisplay.style.borderColor = config.colors[colorClass];

    addToHistory(colorClass);

    const opponent = currentPlayer === 'p1' ? 'p2' : 'p1';
    let totalWin = 0;
    let totalBet = 0;

    Object.entries(currentBets[currentPlayer]).forEach(([bet, amount]) => {
        totalBet += amount;
        totalWin += calculateWinnings(bet, amount, winner);
    });

    // Zero-Sum Logic:
    // 1. Banker gets the initial bet
    balances[opponent] += totalBet;

    // 2. If bettor wins, banker pays out directly
    if (totalWin > 0) {
        balances[currentPlayer] += totalWin;
        balances[opponent] -= totalWin;
        scores[currentPlayer]++;
    } else {
        scores[opponent]++;
    }

    showWins(totalWin, totalBet, winner);

    // Swap turns
    currentPlayer = opponent;
    currentBets = { p1: {}, p2: {} };

    setTimeout(() => {
        renderChips();
        updateUI();
    }, 2000);
}

function showWins(win, bet, result) {
    const winTitle = winOverlay.querySelector('h2');
    const playerText = playerNames[currentPlayer];
    const opponentText = currentPlayer === 'p1' ? playerNames.p2 : playerNames.p1;
    const playerColor = currentPlayer === 'p1' ? config.colors.gold : config.colors.cyan;
    const opponentColor = currentPlayer === 'p1' ? config.colors.cyan : config.colors.gold;

    let title = "";
    let msg = "";

    if (win > 0) {
        title = `${playerText} WON!`;
        winTitle.style.color = playerColor;
        msg = `
            <div style="font-size: 1.5rem; margin-bottom: 10px;">
                Winner received: <span style="color:${playerColor}">+$${win.toLocaleString()}</span>
            </div>
            <div style="font-size: 1rem; opacity: 0.7;">
                Taken directly from ${opponentText}'s bank!
            </div>
        `;
    } else {
        title = `${playerText} LOST!`;
        winTitle.style.color = "#e74c3c";
        msg = `
            <div style="font-size: 1.5rem; margin-bottom: 10px;">
                Banker received: <span style="color:${opponentColor}">+$${bet.toLocaleString()}</span>
            </div>
            <div style="font-size: 1rem; opacity: 0.7;">
                ${opponentText} protected the vault!
            </div>
        `;
    }

    msg += `
        <div style="margin-top:20px; font-size:1rem; opacity:0.6; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
            Series Score: ${playerNames.p1} [${scores.p1}] - [${scores.p2}] ${playerNames.p2}
        </div>
    `;

    winTitle.textContent = title;
    winAmountEl.innerHTML = msg;
    winOverlay.classList.remove('hidden');
}

function calculateWinnings(bet, amount, winner) {
    if (!isNaN(bet) && parseInt(bet) === winner) return amount * 36;
    if (bet === 'red' && config.redNumbers.includes(winner)) return amount * 2;
    if (bet === 'black' && config.blackNumbers.includes(winner)) return amount * 2;
    if (winner !== 0) {
        if (bet === 'even' && winner % 2 === 0) return amount * 2;
        if (bet === 'odd' && winner % 2 !== 0) return amount * 2;
    }
    if (bet === '1to12' && winner >= 1 && winner <= 12) return amount * 3;
    if (bet === '13to24' && winner >= 13 && winner <= 24) return amount * 3;
    if (bet === '25to36' && winner >= 25 && winner <= 36) return amount * 3;
    if (bet === '1to18' && winner >= 1 && winner <= 18) return amount * 2;
    if (bet === '19to36' && winner >= 19 && winner <= 36) return amount * 2;
    return 0;
}

function drawWheel(rotation) {
    const size = 400;
    canvas.width = size; canvas.height = size;
    const centerX = size / 2, centerY = size / 2, radius = size / 2 - 10, innerRadius = radius * 0.6;
    ctx.clearRect(0, 0, size, size);
    const sliceAngle = (Math.PI * 2) / config.numbers.length;

    config.numbers.forEach((num, i) => {
        const startAngle = i * sliceAngle + rotation;
        const endAngle = (i + 1) * sliceAngle + rotation;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        let color = config.colors.black;
        if (num === 0) color = config.colors.green;
        else if (config.redNumbers.includes(num)) color = config.colors.red;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Outfit";
        ctx.fillText(num, radius - 15, 5);
        ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.bg;
    ctx.fill();
    ctx.strokeStyle = config.colors.gold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 20);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, config.colors.gold); grad.addColorStop(1, '#8a6d3b');
    ctx.fillStyle = grad; ctx.fill();
}

function addToHistory(color) {
    history.push(color);
    if (history.length > 5) history.shift();
    historyDotsEl.innerHTML = '';
    history.forEach(c => {
        const dot = document.createElement('div');
        dot.className = `dot ${c}`;
        historyDotsEl.appendChild(dot);
    });
}

function setupEventListeners() {
    spinBtn.onclick = spin;
    document.getElementById('clear-bets').onclick = () => {
        if (isSpinning) return;
        Object.values(currentBets[currentPlayer]).forEach(a => balances[currentPlayer] += a);
        currentBets[currentPlayer] = {};
        renderChips();
        updateUI();
    };
    document.getElementById('close-win-overlay').onclick = () => winOverlay.classList.add('hidden');

    settingsToggle.onclick = () => {
        p1NameInput.value = playerNames.p1;
        p2NameInput.value = playerNames.p2;
        settingsOverlay.classList.remove('hidden');
    };

    saveSettingsBtn.onclick = () => {
        if (p1NameInput.value.trim()) playerNames.p1 = p1NameInput.value.trim().toUpperCase();
        if (p2NameInput.value.trim()) playerNames.p2 = p2NameInput.value.trim().toUpperCase();
        settingsOverlay.classList.add('hidden');
        updateUI();
    };

    document.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedChip = parseInt(chip.dataset.value);
        };
    });
    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.onclick = () => placeBet(btn.dataset.bet);
    });
}

function playBipSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(currentPlayer === 'p1' ? 440 : 660, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
}

init();
