// Game State
let ammoCount = 1;
let chambers = [0, 0, 0, 0, 0, 0];
let currentChamber = 0;
let survived = 0;
let deaths = 0;
let isSpinning = false;
let totalRotation = 0;

// Hold to spin logic
let spinHoldStart = 0;
let spinInterval = null;

// DOM Elements
const cylinder = document.getElementById('cylinder');
const ammoDisplay = document.getElementById('ammoCount');
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const spinBtn = document.getElementById('spinBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const pullTriggerBtn = document.getElementById('pullTriggerBtn');
const statusText = document.getElementById('statusText');
const survivedDisplay = document.getElementById('survivedCount');
const deathDisplay = document.getElementById('deathCount');
const modal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultDesc = document.getElementById('resultDesc');
const closeModal = document.getElementById('closeModal');

// Audio
const audioSpin = document.getElementById('audioSpin');
const audioClick = document.getElementById('audioClick');
const audioShot = document.getElementById('audioShot');

// Initialize
updateAmmoUI();
randomizeChambers();

// Event Listeners
btnUp.addEventListener('click', () => {
    if (ammoCount < 6) {
        ammoCount++;
        updateAmmoUI();
    }
});

btnDown.addEventListener('click', () => {
    if (ammoCount > 1) {
        ammoCount--;
        updateAmmoUI();
    }
});

randomizeBtn.addEventListener('click', () => {
    randomizeChambers();
    statusText.innerText = "CHAMBERS RANDOMIZED.";
});

// Hold to Spin Events
spinBtn.addEventListener('mousedown', startSpinHold);
spinBtn.addEventListener('mouseup', endSpinHold);
spinBtn.addEventListener('mouseleave', endSpinHold);

// Touch support
spinBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startSpinHold();
});
spinBtn.addEventListener('touchend', endSpinHold);

pullTriggerBtn.addEventListener('click', pullTrigger);
closeModal.addEventListener('click', () => modal.classList.remove('show'));

function updateAmmoUI() {
    ammoDisplay.innerText = ammoCount;
    statusText.innerText = "LOADED " + ammoCount + " BULLETS. PRESS RANDOMIZE TO SHUFFLE.";

    // Fill chambers linearly so the user sees the bullets being added/removed
    chambers = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < ammoCount; i++) {
        chambers[i] = 1;
    }

    // Update chamber visuals immediately
    const chamberElements = document.querySelectorAll('.chamber');
    chamberElements.forEach((el, index) => {
        el.classList.toggle('loaded', chambers[index] === 1);
    });
}

function randomizeChambers() {
    chambers = [0, 0, 0, 0, 0, 0];
    const positions = [0, 1, 2, 3, 4, 5];
    shuffle(positions);
    for (let i = 0; i < ammoCount; i++) {
        chambers[positions[i]] = 1;
    }

    // Update chamber visuals
    const chamberElements = document.querySelectorAll('.chamber');
    chamberElements.forEach((el, index) => {
        el.classList.toggle('loaded', chambers[index] === 1);
    });
}

function startSpinHold() {
    if (isSpinning || spinBtn.disabled) return;
    spinHoldStart = Date.now();
    statusText.innerText = "CHARGING SPIN...";
    spinBtn.classList.add('charging');
}

function endSpinHold() {
    if (spinHoldStart === 0 || isSpinning) return;

    const holdDuration = Date.now() - spinHoldStart;
    spinHoldStart = 0;
    spinBtn.classList.remove('charging');

    // Duration-based power
    // Max power reached at 2 seconds (2000ms)
    const power = Math.min(holdDuration / 2000, 1.0);
    executeSpin(power);
}

function executeSpin(power) {
    isSpinning = true;
    spinBtn.disabled = true;
    randomizeBtn.disabled = true;
    pullTriggerBtn.disabled = true;

    // Calculate rotation based on power
    // Base spin is 2 full rotations, max power adds up to 10 more
    const baseRotations = 2;
    const extraRotations = 10 * power;
    const randomChamber = Math.floor(Math.random() * 6);
    const rotationAmount = (baseRotations + extraRotations) * 360 + randomChamber * 60;

    totalRotation += rotationAmount;

    // Update current chamber index based on final rotation
    // Since each 60deg is a chamber, we find final position mod 360
    const finalOffset = totalRotation % 360;
    currentChamber = Math.round(finalOffset / 60) % 6;

    statusText.innerText = "SPINNING...";

    // Play spin sound
    audioSpin.currentTime = 0;
    audioSpin.play().catch(e => { });

    // Apply CSS transition
    cylinder.style.transition = `transform ${1.5 + (power * 3)}s cubic-bezier(0.15, 0, 0.15, 1)`;
    cylinder.style.transform = `rotate(-${totalRotation}deg)`;

    setTimeout(() => {
        isSpinning = false;
        spinBtn.disabled = false;
        randomizeBtn.disabled = false;
        pullTriggerBtn.disabled = false;
        statusText.innerText = "READY. PULL THE TRIGGER.";
    }, 1500 + (power * 3000));
}

function pullTrigger() {
    if (isSpinning) return;

    audioClick.currentTime = 0;
    audioClick.play().catch(e => { });

    const isLoaded = chambers[currentChamber];

    if (isLoaded) {
        gameOver(true);
    } else {
        gameOver(false);
    }
}

function gameOver(dead) {
    spinBtn.disabled = true;
    randomizeBtn.disabled = true;
    pullTriggerBtn.disabled = true;

    if (dead) {
        deaths++;
        deathDisplay.innerText = deaths;
        statusText.innerText = "BANG!";
        resultTitle.innerText = "FATAL!";
        resultTitle.style.color = "var(--accent-red)";
        resultDesc.innerText = "The bullet found its target.";
        audioShot.currentTime = 0;
        audioShot.play().catch(e => { });
        document.body.classList.add('shot-fired');
        setTimeout(() => document.body.classList.remove('shot-fired'), 500);
    } else {
        survived++;
        survivedDisplay.innerText = survived;
        statusText.innerText = "CLICK...";
        resultTitle.innerText = "SAFE";
        resultTitle.style.color = "var(--accent-gold)";
        resultDesc.innerText = "The chamber was empty.";
    }

    setTimeout(() => {
        modal.classList.add('show');
        spinBtn.disabled = false;
        randomizeBtn.disabled = false;
    }, 600);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[array[j]]] = [array[array[j]], array[i]];
    }
}
