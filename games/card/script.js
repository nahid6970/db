// Game Constants
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const NUM_PLAYERS = 4;

// Game State
let deck = [];
let players = []; // { hand: [], balance: 1000, bet: 0, status: 'playing'/'bust'/'blackjack', id: 0 }
let dealerHand = [];
let currentPlayerIndex = 0; // The player currently acting
let bettingPlayerIndex = 0; // The player currently placing a bet
let gameState = 'betting'; // 'betting', 'playing', 'dealer-turn', 'ended'

// DOM Elements
const balanceEl = document.getElementById('balance');
const currentBetEl = document.getElementById('current-bet');
const dealerScoreEl = document.getElementById('dealer-score');
const dealerCardsEl = document.getElementById('dealer-cards');
const gameMessageEl = document.getElementById('game-message');
const bettingControls = document.getElementById('betting-controls');
const actionControls = document.getElementById('action-controls');
const dealBtn = document.getElementById('deal-btn');
const clearBtn = document.getElementById('clear-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const playAgainBtn = document.getElementById('play-again-btn');

// Initialize Players
function initPlayers() {
    players = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        players.push({
            id: i,
            hand: [],
            balance: 1000,
            bet: 0,
            status: 'betting',
            isKicked: false
        });
    }
}

// Initialize Game
function init() {
    initPlayers();
    updateUI();
    updateSeats();

    dealBtn.addEventListener('click', startDeal);
    clearBtn.addEventListener('click', clearBet);
    hitBtn.addEventListener('click', playerHit);
    standBtn.addEventListener('click', playerStand);
    doubleBtn.addEventListener('click', playerDouble);
    playAgainBtn.addEventListener('click', resetGame);

    gameMessageEl.textContent = `Player 1: Place your bet`;
}

// Deck Functions
function createDeck() {
    let newDeck = [];
    for (let i = 0; i < 4; i++) { // Use 4 decks for multiplayer
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                newDeck.push({ suit, rank, isRed: suit === '♥' || suit === '♦' });
            }
        }
    }
    return newDeck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 11;
    return parseInt(card.rank);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        if (card.rank === 'A') aces++;
        score += getCardValue(card);
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

// Betting Logic
window.placeBet = function (amount) {
    if (gameState !== 'betting') return;

    let p = players[bettingPlayerIndex];
    if (amount <= p.balance) {
        p.bet += amount;
        p.balance -= amount;
        updateUI();
        updateSeats();
        checkBettingProgress();
    }
};

function clearBet() {
    if (gameState !== 'betting') return;
    let p = players[bettingPlayerIndex];
    p.balance += p.bet;
    p.bet = 0;
    updateUI();
    updateSeats();
}

function checkBettingProgress() {
    let p = players[bettingPlayerIndex];
    if (p.bet > 0) {
        dealBtn.disabled = false;
        dealBtn.textContent = bettingPlayerIndex < NUM_PLAYERS - 1 ? "NEXT PLAYER" : "DEAL";
    }
}

function moveToNextBettor() {
    bettingPlayerIndex++;

    // Check if we've cycled through all players
    if (bettingPlayerIndex >= NUM_PLAYERS) {
        const totalBets = players.reduce((sum, p) => sum + p.bet, 0);
        if (totalBets > 0) {
            actualStartDeal();
        } else {
            gameMessageEl.textContent = "All players are out! Game Reset.";
            setTimeout(resetGame, 2000);
        }
        return;
    }

    const p = players[bettingPlayerIndex];

    // Auto-kick if no money and no active bet
    if (p.balance <= 0 && p.bet === 0) {
        p.isKicked = true;
        updateSeats();
        moveToNextBettor();
        return;
    }

    gameMessageEl.textContent = `Player ${bettingPlayerIndex + 1}: Place your bet`;
    dealBtn.disabled = p.bet === 0;
    dealBtn.textContent = bettingPlayerIndex < NUM_PLAYERS - 1 ? "NEXT PLAYER" : "DEAL";
    updateUI();
    updateSeats();
}

function startDeal() {
    moveToNextBettor();
}

function actualStartDeal() {
    gameState = 'playing';
    deck = createDeck();
    shuffleDeck(deck);

    bettingControls.classList.add('hidden');
    actionControls.classList.remove('hidden');
    gameMessageEl.textContent = "Dealing...";

    let delay = 0;
    for (let round = 0; round < 2; round++) {
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (players[i].bet > 0) {
                setTimeout(() => dealCardToPlayer(i), delay);
                delay += 250;
            }
        }
        setTimeout(() => dealCardToDealer(round === 1), delay);
        delay += 250;
    }

    setTimeout(() => {
        currentPlayerIndex = 0;
        moveToNextValidPlayer();
    }, delay);
}

function dealCardToPlayer(playerIdx) {
    const card = deck.pop();
    players[playerIdx].hand.push(card);

    const cardEl = createCardElement(card);
    document.getElementById(`player-cards-${playerIdx}`).appendChild(cardEl);
    setTimeout(() => cardEl.classList.remove('dealing'), 50);

    updateScores();
}

function dealCardToDealer(isHidden = false) {
    const card = deck.pop();
    dealerHand.push(card);

    const cardEl = createCardElement(card, isHidden);
    dealerCardsEl.appendChild(cardEl);
    setTimeout(() => cardEl.classList.remove('dealing'), 50);

    updateScores();
}

function createCardElement(card, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.isRed ? 'red' : ''} dealing`;
    if (isHidden) cardEl.classList.add('flipped');

    cardEl.innerHTML = `
        <div class="rank">${card.rank}</div>
        <div class="suit">${card.suit}</div>
        <div class="rank" style="transform: rotate(180deg)">${card.rank}</div>
    `;
    return cardEl;
}

function moveToNextValidPlayer() {
    if (currentPlayerIndex >= NUM_PLAYERS) {
        dealerTurn();
        return;
    }

    const p = players[currentPlayerIndex];
    if (p.bet === 0) {
        currentPlayerIndex++;
        moveToNextValidPlayer();
        return;
    }

    updateSeats();
    gameMessageEl.textContent = `Player ${currentPlayerIndex + 1}'s Turn`;

    const score = calculateScore(p.hand);
    if (score === 21) {
        p.status = 'blackjack';
        playerStand(); // Automatic stand on Blackjack
    } else {
        doubleBtn.disabled = p.balance < p.bet;
    }
}

function playerHit() {
    dealCardToPlayer(currentPlayerIndex);
    const score = calculateScore(players[currentPlayerIndex].hand);
    doubleBtn.disabled = true;

    if (score > 21) {
        players[currentPlayerIndex].status = 'bust';
        setTimeout(playerStand, 500);
    } else if (score === 21) {
        setTimeout(playerStand, 500);
    }
}

function playerStand() {
    currentPlayerIndex++;
    moveToNextValidPlayer();
}

function playerDouble() {
    const p = players[currentPlayerIndex];
    p.balance -= p.bet;
    p.bet *= 2;
    updateUI();
    updateSeats();

    dealCardToPlayer(currentPlayerIndex);
    playerStand();
}

async function dealerTurn() {
    gameState = 'dealer-turn';
    revealDealer();

    // Check if any player didn't bust
    const activePlayers = players.filter(p => p.status !== 'bust' && p.status !== 'blackjack' && p.bet > 0);

    if (activePlayers.length > 0) {
        let dScore = calculateScore(dealerHand);
        while (dScore < 17) {
            await new Promise(r => setTimeout(r, 600));
            dealCardToDealer();
            dScore = calculateScore(dealerHand);
        }
    }

    determineWinners();
}

function revealDealer() {
    const hiddenCard = dealerCardsEl.querySelector('.card.flipped');
    if (hiddenCard) hiddenCard.classList.remove('flipped');
    updateScores();
}

function determineWinners() {
    gameState = 'ended';
    const dScore = calculateScore(dealerHand);
    let totalWon = 0;
    let results = [];

    players.forEach((p, i) => {
        if (p.bet === 0) return;

        const pScore = calculateScore(p.hand);
        let winAmount = 0;
        let outcome = "";

        if (p.status === 'blackjack') {
            if (dScore === 21 && dealerHand.length === 2) {
                winAmount = p.bet; // Push
                outcome = "Push";
            } else {
                winAmount = Math.floor(p.bet * 2.5);
                outcome = "Blackjack!";
            }
        } else if (p.status === 'bust') {
            winAmount = 0;
            outcome = "Bust";
        } else if (dScore > 21) {
            winAmount = p.bet * 2;
            outcome = "Win (Dealer Bust)";
        } else if (pScore > dScore) {
            winAmount = p.bet * 2;
            outcome = "Win";
        } else if (pScore < dScore) {
            winAmount = 0;
            outcome = "Lose";
        } else {
            winAmount = p.bet;
            outcome = "Push";
        }

        p.balance += winAmount;
        totalWon += winAmount;
        if (winAmount > 0) results.push(`P${i + 1}: ${outcome}`);
    });

    setTimeout(() => {
        overlayTitle.textContent = totalWon > 0 ? "ROUND OVER" : "HOUSE WINS";
        overlaySubtitle.textContent = results.length > 0 ? results.join(" | ") : "Better luck next time!";
        overlay.classList.remove('hidden');
        updateUI();
        updateSeats();
    }, 1000);
}

function updateScores() {
    dealerScoreEl.textContent = (gameState === 'playing' && dealerHand.length === 2)
        ? getCardValue(dealerHand[0])
        : calculateScore(dealerHand);

    players.forEach((p, i) => {
        document.getElementById(`player-score-${i}`).textContent = calculateScore(p.hand);
    });
}

function updateSeats() {
    players.forEach((p, i) => {
        const seat = document.getElementById(`seat-${i}`);

        // Hide kicked players
        if (p.isKicked) {
            seat.style.opacity = "0.2";
            seat.style.pointerEvents = "none";
            seat.style.filter = "grayscale(1)";
        } else {
            seat.style.opacity = "1";
            seat.style.pointerEvents = "auto";
            seat.style.filter = "none";
        }

        seat.classList.toggle('active', (gameState === 'betting' && bettingPlayerIndex === i) || (gameState === 'playing' && currentPlayerIndex === i));
        document.getElementById(`bet-${i}`).textContent = `$${p.bet}`;
    });
}

function updateUI() {
    // Show current betting player's balance in the header
    const p = players[bettingPlayerIndex];
    balanceEl.textContent = `$${p.balance.toLocaleString()}`;
    currentBetEl.textContent = `$${p.bet.toLocaleString()}`;
}

function resetGame() {
    gameState = 'betting';
    bettingPlayerIndex = 0;
    currentPlayerIndex = 0;
    dealerHand = [];

    players.forEach(p => {
        p.hand = [];
        p.bet = 0;
        p.status = 'betting';
        if (p.balance <= 0) p.isKicked = true;

        document.getElementById(`player-cards-${p.id}`).innerHTML = '';
        document.getElementById(`player-score-${p.id}`).textContent = '0';
    });

    dealerCardsEl.innerHTML = '';
    dealerScoreEl.textContent = '0';

    overlay.classList.add('hidden');
    bettingControls.classList.remove('hidden');
    actionControls.classList.add('hidden');
    dealBtn.disabled = true;
    dealBtn.textContent = "NEXT PLAYER";

    updateUI();
    updateSeats();

    // If player 1 is kicked, move to next available
    if (players[0].isKicked) {
        moveToNextBettor();
    } else {
        gameMessageEl.textContent = "Player 1: Place your bet";
    }
}

init();
