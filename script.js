let roundNumber = 1; // İhale sayısı
const suits = ['♥', '♠', '♦', '♣'];
const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];

// 48 kartlık deste (her karttan iki tane)
function createDeck() {
    let deck = [];
    for (let d = 0; d < 2; d++) { // iki deste
        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ suit, rank });
            }
        }
    }
    return deck;
}

// Deste karıştırma (Fisher-Yates)
function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 4 oyuncuya 4'erli gruplar halinde 12'şer kart dağıt
function dealCards(deck) {
    const players = [[], [], [], []];
    let cardIndex = 0;
    for (let round = 0; round < 3; round++) { // 3 turda 4'er kart
        for (let p = 0; p < 4; p++) {
            for (let k = 0; k < 4; k++) {
                players[p].push(deck[cardIndex++]);
            }
        }
    }
    return players;
}

// Kart büyüklük sırası (A > 10 > K > Q > J > 9)
const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
const suitOrder = ['♥', '♠', '♦', '♣'];
const suitClass = {
    '♥': 'hearts',
    '♦': 'diamonds',
    '♠': 'spades',
    '♣': 'clubs',
};

function sortPlayerCards(cards) {
    // Önce suit'e göre, sonra rankOrder'a göre sırala
    return cards.slice().sort((a, b) => {
        const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        if (suitDiff !== 0) return suitDiff;
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
}

function renderPlayers(players) {
    for (let i = 0; i < 4; i++) {
        const cardsDiv = document.querySelector(`#player${i+1} .cards`);
        cardsDiv.innerHTML = '';
        // Her suit için bir satır
        for (const suit of suitOrder) {
            const rowDiv = document.createElement('div');
            rowDiv.style.marginBottom = '2px';
            const suitCards = sortPlayerCards(players[i]).filter(card => card.suit === suit);
            suitCards.forEach(card => {
                const cardDiv = document.createElement('span');
                cardDiv.className = 'card ' + suitClass[card.suit];
                cardDiv.textContent = card.rank + card.suit;
                rowDiv.appendChild(cardDiv);
            });
            cardsDiv.appendChild(rowDiv);
        }
    }
}

// İhale değişkenleri
let auctionActive = false;
let auctionPlayers = [0, 1, 2, 3]; // Oyuncu indexleri
let auctionBids = [null, null, null, null];
let auctionPasses = [false, false, false, false];
let auctionCurrent = 0;
let auctionHighestBid = 0;
let auctionWinner = null;
let auctionTurns = 0;
let trumpSuit = null;

// Dağıtıcı sırası (0=1. oyuncu, 1=2. oyuncu, 2=3. oyuncu, 3=4. oyuncu)
let currentDealer = 3; // İlk eli 4. oyuncu dağıtır
let consecutiveBozCount = 0; // Ard arda boz sayısı

// Samandağ Pinaki özel değişkenleri
let sordumKonusMode = false; // Sordum/Konuş modunda mı?
let sordumPlayer = null; // Sordum diyen oyuncu
let konusPlayer = null; // Konuş diyen oyuncu

// Oyuncu index mapping'i - her round'da güncellenir
let playerIndexMapping = {
    0: 1, // index 0 = Oyuncu 1
    1: 2, // index 1 = Oyuncu 2  
    2: 3, // index 2 = Oyuncu 3
    3: 4  // index 3 = Oyuncu 4
};

let botPlayers = [false, false, false, false];

function configureBots(botConfig) {
    if (!Array.isArray(botConfig) || botConfig.length !== 4) {
        botPlayers = [false, false, false, false];
        return;
    }
    botPlayers = botConfig.map(Boolean);
    updatePlayerLabels();
}

function isBotPlayerIndex(index) {
    return !!botPlayers[index];
}

function getBotHandStrength(hand) {
    if (!hand || !hand.length) return 0;
    let score = 0;
    for (const card of hand) {
        const weight = { 'A': 18, '10': 14, 'K': 12, 'Q': 9, 'J': 6, '9': 2 }[card.rank] || 0;
        score += weight;
        if (['A', '10', 'K', 'Q', 'J'].includes(card.rank)) score += 2;
    }
    // Aynı renkte çok sayıda yüksek kart varsa daha güçlü sayılır.
    const suitCounts = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
    for (const card of hand) suitCounts[card.suit] += 1;
    score += Object.values(suitCounts).filter(count => count >= 4).length * 8;
    return score;
}

function getBotPreferredSuit(hand) {
    const suitTotals = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
    const suitWeights = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };

    for (const card of hand || []) {
        const suit = card.suit;
        suitTotals[suit] += 1;
        const rankWeight = { 'A': 15, '10': 12, 'K': 10, 'Q': 8, 'J': 6, '9': 1 };
        suitWeights[suit] += rankWeight[card.rank] || 0;
    }

    const suits = Object.keys(suitTotals);
    return suits.sort((a, b) => {
        const diff = suitTotals[b] - suitTotals[a];
        if (diff !== 0) return diff;
        return suitWeights[b] - suitWeights[a];
    })[0];
}

function chooseBotTrumpSuit(seatIndex) {
    const hand = playersGlobal && playersGlobal[seatIndex] ? playersGlobal[seatIndex] : [];
    if (!hand.length) return '♥';

    const suitScores = {};
    for (const suit of suits) {
        const cards = hand.filter(card => card.suit === suit);
        if (!cards.length) {
            suitScores[suit] = -999;
            continue;
        }

        let score = cards.length * 5;
        for (const card of cards) {
            const weight = { 'A': 14, '10': 12, 'K': 10, 'Q': 8, 'J': 6, '9': 3 }[card.rank] || 0;
            score += weight;
        }

        const highCards = cards.filter(card => ['A', '10', 'K', 'Q', 'J'].includes(card.rank)).length;
        score += highCards * 4;
        suitScores[suit] = score;
    }

    return Object.keys(suitScores).sort((a, b) => suitScores[b] - suitScores[a])[0];
}

function getBotBidSuggestion(seatIndex) {
    const hand = playersGlobal && playersGlobal[seatIndex] ? playersGlobal[seatIndex] : [];
    if (!hand.length) return 0;

    let strength = 0;
    for (const card of hand) {
        const weight = { 'A': 14, '10': 12, 'K': 10, 'Q': 8, 'J': 6, '9': 2 }[card.rank] || 0;
        strength += weight;
    }

    const highCount = hand.filter(card => ['A', '10', 'K', 'Q', 'J'].includes(card.rank)).length;
    const longSuitCount = Object.values(
        hand.reduce((acc, card) => {
            acc[card.suit] = (acc[card.suit] || 0) + 1;
            return acc;
        }, { '♥': 0, '♠': 0, '♦': 0, '♣': 0 })
    ).filter(count => count >= 4).length;

    const bid = 150 + Math.max(0, strength - 60) + highCount * 10 + longSuitCount * 10;
    return Math.min(250, Math.round(bid / 10) * 10);
}

function getTeamPartnerIndex(index) {
    return (index + 2) % 4;
}

function getBotAuctionIntent(seatIndex) {
    const hand = playersGlobal && playersGlobal[seatIndex] ? playersGlobal[seatIndex] : [];
    const partnerIndex = getTeamPartnerIndex(seatIndex);
    const partnerBid = auctionBids[partnerIndex];
    const strength = getBotHandStrength(hand);

    if (partnerBid !== null && partnerBid !== 'PASS') {
        return { aggressiveness: 0.8, maxBid: Math.max(160, partnerBid + 20) };
    }
    if (strength >= 140) {
        return { aggressiveness: 1.0, maxBid: 220 };
    }
    if (strength >= 110) {
        return { aggressiveness: 0.8, maxBid: 190 };
    }
    if (strength >= 90) {
        return { aggressiveness: 0.5, maxBid: 170 };
    }
    return { aggressiveness: 0.2, maxBid: 150 };
}

function chooseBotLeadCard(hand) {
    const preferredSuit = getBotPreferredSuit(hand);
    const suitCards = hand.filter(card => card.suit === preferredSuit);
    if (suitCards.length) {
        return suitCards.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
    }
    return hand.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
}

function cardBeats(candidate, currentBest, leadSuit) {
    if (!currentBest) return true;
    const trump = trumpSuit;

    if (trump && candidate.suit === trump && currentBest.suit !== trump) return true;
    if (trump && candidate.suit !== trump && currentBest.suit === trump) return false;
    if (candidate.suit !== currentBest.suit) {
        if (leadSuit && candidate.suit === leadSuit && currentBest.suit !== leadSuit && currentBest.suit !== trump) {
            return true;
        }
        return false;
    }
    return rankOrder.indexOf(candidate.rank) < rankOrder.indexOf(currentBest.rank);
}

function getCurrentTrickWinningCard() {
    if (!playedCards.length) return null;
    let best = playedCards[0].card;
    for (let i = 1; i < playedCards.length; i++) {
        const candidate = playedCards[i].card;
        if (cardBeats(candidate, best, playedCards[0].card.suit)) {
            best = candidate;
        }
    }
    return best;
}

function getAllowedCardsForSeat(seatIndex) {
    if (seatIndex === null || seatIndex === undefined) return [];
    const hand = playersGlobal[seatIndex] || [];
    if (!playedCards.length) return hand.slice();

    const leadSuit = playedCards[0].card.suit;
    const hasLeadSuit = hand.some(card => card.suit === leadSuit);
    const hasTrump = trumpSuit && hand.some(card => card.suit === trumpSuit);

    if (hasLeadSuit) {
        return hand.filter(card => card.suit === leadSuit);
    }
    if (hasTrump) {
        return hand.filter(card => card.suit === trumpSuit);
    }

    return hand.slice();
}

function chooseBotCardForSeat(seatIndex) {
    const hand = playersGlobal && playersGlobal[seatIndex] ? playersGlobal[seatIndex] : [];
    const validCards = getAllowedCardsForSeat(seatIndex);
    if (!validCards.length) return null;

    if (playedCards.length > 0) {
        const currentBest = getCurrentTrickWinningCard();
        const winningMoves = validCards.filter(card => cardBeats(card, currentBest, playedCards[0].card.suit));
        if (winningMoves.length) {
            return winningMoves.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
        }
    }

    if (playedCards.length === 0) {
        const bestSuit = getBotPreferredSuit(hand);
        const suitCards = validCards.filter(card => card.suit === bestSuit);
        if (suitCards.length) {
            return suitCards.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
        }
    }

    return validCards.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
}

function updatePlayerLabels() {
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i + 1}`);
        if (!playerDiv) continue;
        const title = playerDiv.querySelector('h4');
        if (title) {
            title.textContent = `Oyuncu ${i + 1}${isBotPlayerIndex(i) ? ' [BOT]' : ' [İnsan]'}`;
        }
    }
}

// Her round'da oyuncu index mapping'ini güncelle
function updatePlayerIndexMapping() {
    // Masa sırası sabit: 1-2-3-4. Sadece dağıtıcı değişir.
    playerIndexMapping = {0: 1, 1: 2, 2: 3, 3: 4};
}

function advanceDealer() {
    currentDealer = (currentDealer + 1) % 4;
}

// Index'ten oyuncu numarasını al
function getPlayerNumberFromIndex(index) {
    return index + 1;
}

// Oyuncu numarasından index'i al
function getIndexFromPlayerNumber(playerNumber) {
    return playerNumber - 1;
}

function updateAuctionHighestBid() {
    const div = document.getElementById('auction-highest-bid');
    if (auctionHighestBid > 0) {
        // En yüksek teklifi veren oyuncuyu bul
        let highestBidderIndex = -1;
        for (let i = 0; i < auctionBids.length; i++) {
            if (auctionBids[i] === auctionHighestBid) {
                highestBidderIndex = i;
                break;
            }
        }
        
        if (highestBidderIndex !== -1) {
            const highestBidderNumber = getCurrentPlayerNumber(highestBidderIndex, roundNumber);
            div.textContent = `En Yüksek Teklif: ${auctionHighestBid} (Oyuncu ${highestBidderNumber})`;
        } else {
            div.textContent = `En Yüksek Teklif: ${auctionHighestBid}`;
        }
    } else {
        div.textContent = 'En Yüksek Teklif: 0';
    }
}
// Her ihalede oyunculara dinamik index atama
function getPlayerIndex(playerNumber, roundNumber) {
    return (playerNumber + roundNumber - 1) % 4;
}

// Her ihalede hangi oyuncunun hangi index'e sahip olduğunu göster
function getPlayerIndexes(roundNumber) {
    const indexes = {};
    for (let i = 1; i <= 4; i++) {
        indexes[i] = getPlayerIndex(i, roundNumber);
    }
    return indexes;
}
function startAuction() {
    auctionActive = true;
    auctionBids = [null, null, null, null];
    auctionPasses = [false, false, false, false];
    
    // Oyuncu index mapping'ini güncelle
    updatePlayerIndexMapping();
    
    auctionCurrent = (currentDealer + 1) % 4; // Dağıtıcıdan sonraki seat index
    
    auctionHighestBid = 0; // Başlangıçta henüz teklif yok
    auctionWinner = null;
    auctionTurns = 0;
    // Koz seçimini sıfırla
    trumpSuit = null;
    // Samandağ Pinaki değişkenlerini sıfırla
    sordumKonusMode = false;
    sordumPlayer = null;
    konusPlayer = null;
    
    // Debug için console.log ekle
    console.log(`Round ${roundNumber} başladı. Oyuncu mapping:`, playerIndexMapping);
    console.log(`Dağıtıcı: index ${currentDealer} (Oyuncu ${getPlayerNumberFromIndex(currentDealer)})`);
    console.log(`İhale başlangıcı: index ${auctionCurrent} (Oyuncu ${getPlayerNumberFromIndex(auctionCurrent)})`);
    
    const dealerPlayerNumber = getCurrentPlayerNumber(currentDealer, roundNumber);
    document.getElementById('auction-status').textContent = `İhale başladı! (En az 150) - Dağıtıcı: Oyuncu ${dealerPlayerNumber}`;
    document.getElementById('auction-controls').style.display = '';
    updateAuctionHighestBid();
    
    // Tüm oyuncu kutularından parlaklık efektlerini kaldır
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('active-player', 'auction-active');
        }
    }
    
    nextAuctionTurn();
}

function nextAuctionTurn() {
    // Sordum/Konuş modunda değilse normal ihale bitiş kontrolü yap
    if (!sordumKonusMode && auctionTurns >= 4) {
        // İhale bittiğinde tüm kutulardan kaldır
        for (let i = 0; i < 4; i++) {
            document.getElementById(`player${i+1}`).classList.remove('auction-active');
        }

        endAuction();
        return;
    }
    // Sıradaki oyuncu
    const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
    document.getElementById('auction-player').textContent = `Oyuncu ${currentPlayerNumber} sırada: `;
    document.getElementById('bid-input').value = '';
    if (!isBotPlayerIndex(auctionCurrent)) {
        document.getElementById('bid-input').focus();
    }
    // Tüm kutulardan kaldır, sadece teklif sırası gelen oyuncuya ekle
    for (let i = 0; i < 4; i++) {
        const div = document.getElementById(`player${i+1}`);
        if (i === auctionCurrent) div.classList.add('auction-active');
        else div.classList.remove('auction-active');
    }
    
    // Samandağ Pinaki kuralı: Buton görünürlüğünü yönet
    const sordumBtn = document.getElementById('sordum-btn');
    const konusBtn = document.getElementById('konus-btn');
    const bozBtn = document.getElementById('boz-btn');
    const bidBtn = document.getElementById('bid-btn');
    const passBtn = document.getElementById('pass-btn');
    
    // Tüm butonları gizle
    sordumBtn.style.display = 'none';
    konusBtn.style.display = 'none';
    bozBtn.style.display = 'none';
    bidBtn.style.display = 'inline-block';
    passBtn.style.display = 'inline-block';
    
    if (sordumKonusMode) {
        const waitingForKonus = konusPlayer === null;
        const responseSeat = konusPlayer !== null && (
            auctionCurrent === sordumPlayer || auctionCurrent === konusPlayer
        );

        // Sordum sonrası sıradaki oyuncu: Konuş/Boz
        // Konuş sonrası cevap veren oyuncu: Teklif Ver/Pas
        if (waitingForKonus) {
            konusBtn.style.display = 'inline-block';
            bozBtn.style.display = 'inline-block';
            bidBtn.style.display = 'none';
            passBtn.style.display = 'none';
            sordumBtn.style.display = 'none';
        } else if (responseSeat) {
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'inline-block';
            konusBtn.style.display = 'none';
            bozBtn.style.display = 'none';
            sordumBtn.style.display = 'none';
        } else {
            bidBtn.style.display = 'none';
            passBtn.style.display = 'none';
            konusBtn.style.display = 'none';
            bozBtn.style.display = 'none';
            sordumBtn.style.display = 'none';
        }
    } else {
        // Normal ihale modunda - Round'a göre dinamik buton gösterimi
        const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
        
        // Debug için console.log ekle
        console.log(`Round: ${roundNumber}, auctionCurrent: ${auctionCurrent}, currentPlayerNumber: ${currentPlayerNumber}`);
        console.log(`auctionBids:`, auctionBids);
        
                // Tüm oyuncular için Sordum butonu kontrolü
        let canShowSordum = false;
        let hasAnyBid = false; // hasAnyBid'i burada tanımla
    
        // auctionCurrent >= 2 olmalı (en az 2 oyuncu sırası gelmiş olmalı)
        if (auctionCurrent >= 2) {
            // ÖNEMLİ: Hiç teklif verilip verilmediğini kontrol et
            for (let i = 0; i < auctionBids.length; i++) {
                if (auctionBids[i] !== null && auctionBids[i] !== 'PASS') {
                    hasAnyBid = true;
                    break;
                }
            }
            
            // Eğer hiç teklif verilmemişse, ard arda 2 PASS kontrolü yap
            if (!hasAnyBid) {
                // Tüm array'de ard arda 2 PASS kontrolü
                let consecutivePasses = 0;
                for (let i = 0; i < auctionBids.length; i++) {
                    if (auctionBids[i] === 'PASS') {
                        consecutivePasses++;
                        if (consecutivePasses >= 2) {
                            canShowSordum = true;
                            break;
                        }
                    } else if (auctionBids[i] !== null) {
                        // Gerçek bir teklif verilmişse sayacı sıfırla
                        consecutivePasses = 0;
                    }
                    // null ise sayacı sıfırlama (henüz sırası gelmemiş)
                }
                
                // Eğer hala bulunamadıysa, son 2 oyuncunun PASS olup olmadığını kontrol et
                if (!canShowSordum && auctionCurrent >= 3) {
                    let lastTwoPasses = 0;
                    for (let i = Math.max(0, auctionCurrent - 2); i < auctionCurrent; i++) {
                        if (auctionBids[i] === 'PASS') {
                            lastTwoPasses++;
                        }
                    }
                    if (lastTwoPasses >= 2) {
                        canShowSordum = true;
                    }
                }
            }
            // Eğer herhangi bir teklif verilmişse, canShowSordum = false kalır
        }
        
        // Debug için console.log ekle
        console.log(`Round ${roundNumber}, auctionCurrent ${auctionCurrent}: Sordum butonu gösterilebilir mi? ${canShowSordum}`);
        console.log(`Kontrol edilen auctionBids:`, auctionBids.slice(0, auctionCurrent));
        console.log(`Hiç teklif verildi mi? ${hasAnyBid}`);
        
        if (canShowSordum && !sordumKonusMode && !konusPlayer) {
            // Ard arda 2 oyuncu pas derse VE Sordum/Konuş modunda değilse VE Konuş oyuncusu yoksa: Sadece Teklif ve Sordum (Pas butonu yok)
            sordumBtn.style.display = 'inline-block';
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'none'; // Pas butonu gizli
            konusBtn.style.display = 'none';
            bozBtn.style.display = 'none';
        } else {
            // Ard arda 2 oyuncu pas değilse VEYA Sordum/Konuş modundaysa VEYA Konuş oyuncusu varsa: Sadece Pas ve Teklif
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'inline-block';
            sordumBtn.style.display = 'none';
            konusBtn.style.display = 'none';
            bozBtn.style.display = 'none';
        }
    }

    if (auctionActive && isBotPlayerIndex(auctionCurrent)) {
        maybeAutoBotAuctionTurn();
    }
}

function endAuction() {
    auctionActive = false;
    document.getElementById('auction-controls').style.display = 'none';
    updateAuctionHighestBid();
    
    // İhale bittiğinde mavi ışığı kapat
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('auction-active');
        }
    }
    
    // En yüksek teklifi veren oyuncuyu bul
    let maxBid = -1;
    let winner = null;
    for (let i = 0; i < 4; i++) {
        if (auctionBids[i] !== null && auctionBids[i] > maxBid) {
            maxBid = auctionBids[i];
            winner = i;
        }
    }
    auctionHighestBid = maxBid;
    auctionWinner = winner;
    if (auctionWinner !== null) {
        const winnerPlayerNumber = getCurrentPlayerNumber(auctionWinner, roundNumber);
        document.getElementById('auction-status').textContent = `İhaleyi Oyuncu ${winnerPlayerNumber} kazandı! Teklif: ${auctionHighestBid}`;
        speakText(`İhaleyi Oyuncu ${winnerPlayerNumber} kazandı. Teklif: ${auctionHighestBid}`);
        showTrumpSelect();
        if (isBotPlayerIndex(auctionWinner)) {
            maybeAutoBotTrumpSelect();
        }
    } else {
        document.getElementById('auction-status').textContent = 'İhalede kimse teklif vermedi.';
    }
}

function showTrumpSelect() {
    const trumpSelect = document.getElementById('trump-select');
    const trumpPlayer = document.getElementById('trump-player');
    
    if (trumpSelect) {
        trumpSelect.style.display = '';
    }
    
    if (trumpPlayer) {
        const trumpPlayerNumber = getCurrentPlayerNumber(auctionWinner, roundNumber);
        trumpPlayer.textContent = `Kozu seçme hakkı: Oyuncu ${trumpPlayerNumber}`;
    } else {
        console.error('trump-player elementi bulunamadı');
    }
}

function hideTrumpSelect() {
    document.getElementById('trump-select').style.display = 'none';
}

let playedCards = [];
let currentPlayer = null; // Sırası gelen oyuncu
let firstPlayerOfTrick = null; // Elin ilk oyuncusu

function enableFirstPlay() {
    firstPlayerOfTrick = auctionWinner;
    currentPlayer = auctionWinner;
    
    // Koz seçildikten sonra ihale sürecindeki mavi ışığı kapat
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('auction-active');
        }
    }
    
    renderPlayersWithClick(currentPlayer);
    maybeAutoBotPlayTurn();
}

function maybeAutoBotAuctionTurn() {
    if (!auctionActive || !isBotPlayerIndex(auctionCurrent)) return;
    setTimeout(() => {
        if (!auctionActive || !isBotPlayerIndex(auctionCurrent)) return;

        const bidButton = document.getElementById('bid-btn');
        const passButton = document.getElementById('pass-btn');
        const sordumButton = document.getElementById('sordum-btn');
        const konusButton = document.getElementById('konus-btn');
        const hand = playersGlobal && playersGlobal[auctionCurrent] ? playersGlobal[auctionCurrent] : [];
        const handStrength = getBotHandStrength(hand);
        const suggestedBid = getBotBidSuggestion(auctionCurrent);
        const auctionIntent = getBotAuctionIntent(auctionCurrent);

        if (sordumKonusMode) {
            if (konusPlayer === null && sordumPlayer !== null && auctionCurrent !== sordumPlayer) {
                if (handStrength >= 90) {
                    if (konusButton) konusButton.click();
                } else if (passButton) {
                    passButton.click();
                }
                return;
            }

            if (auctionCurrent === sordumPlayer) {
                const nextBid = Math.max(auctionHighestBid + 10, 150);
                if (handStrength >= 100 && nextBid <= auctionIntent.maxBid && nextBid <= 220) {
                    const bidInput = document.getElementById('bid-input');
                    if (bidInput) bidInput.value = nextBid;
                    if (bidButton) bidButton.click();
                    return;
                }
            }

            if (passButton) passButton.click();
            return;
        }

        const hasAnyBid = auctionBids.some(b => b !== null && b !== 'PASS');
        let consecutivePasses = 0;
        for (let i = 0; i < auctionBids.length; i++) {
            if (auctionBids[i] === 'PASS') consecutivePasses++;
            else if (auctionBids[i] !== null) consecutivePasses = 0;
        }

        if (!hasAnyBid && consecutivePasses >= 2) {
            if (handStrength >= 75 && sordumButton) {
                sordumButton.click();
                return;
            }
        }

        if (auctionHighestBid === 0 && handStrength >= 110) {
            const bidInput = document.getElementById('bid-input');
            if (bidInput) bidInput.value = 150;
            if (bidButton) bidButton.click();
            return;
        }

        if (auctionHighestBid > 0 && suggestedBid > auctionHighestBid && handStrength >= auctionIntent.aggressiveness * 110) {
            const nextBid = Math.min(250, Math.max(auctionHighestBid + 10, suggestedBid));
            const bidInput = document.getElementById('bid-input');
            if (bidInput) bidInput.value = nextBid;
            if (bidButton) bidButton.click();
            return;
        }

        if (passButton) passButton.click();
    }, 700);
}

function maybeAutoBotTrumpSelect() {
    if (auctionWinner === null || auctionWinner === undefined) return;
    if (!isBotPlayerIndex(auctionWinner)) return;
    const trumpButtons = Array.from(document.querySelectorAll('.trump-btn'));
    if (!trumpButtons.length) return;
    setTimeout(() => {
        if (!trumpButtons.length || !document.getElementById('trump-select') || document.getElementById('trump-select').style.display === 'none') return;
        const hand = playersGlobal && playersGlobal[auctionWinner] ? playersGlobal[auctionWinner] : [];
        const chosenSuit = chooseBotTrumpSuit(auctionWinner);
        const chosen = document.querySelector(`.trump-btn[data-suit="${chosenSuit}"]`);
        if (chosen) chosen.click();
        else if (hand.length) {
            const fallback = trumpButtons[0];
            if (fallback) fallback.click();
        }
    }, 700);
}

function maybeAutoBotPlayTurn() {
    if (currentPlayer === null || currentPlayer === undefined) return;
    if (!isBotPlayerIndex(currentPlayer)) return;
    setTimeout(() => {
        if (currentPlayer === null || currentPlayer === undefined || !isBotPlayerIndex(currentPlayer)) return;
        const hand = playersGlobal[currentPlayer] || [];
        const validCards = getAllowedCardsForSeat(currentPlayer);
        if (!validCards.length) return;

        let chosenCard = chooseBotCardForSeat(currentPlayer);
        if (!chosenCard) return;

        if (playedCards.length === 0) {
            chosenCard = chooseBotLeadCard(hand);
        } else {
            const currentBest = getCurrentTrickWinningCard();
            const winningMove = validCards.filter(card => cardBeats(card, currentBest, playedCards[0].card.suit));
            if (winningMove.length) {
                chosenCard = winningMove.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
            } else {
                chosenCard = validCards.slice().sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))[0];
            }
        }

        const cardIndex = hand.findIndex(c => c.suit === chosenCard.suit && c.rank === chosenCard.rank);
        if (cardIndex >= 0) {
            playCard(currentPlayer, chosenCard, chosenCard.suit, cardIndex);
        }
    }, 700);
}

function renderPlayersWithClick(activePlayer) {
    let leadSuit = playedCards.length > 0 ? playedCards[0].card.suit : null;
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i + 1}`);
        if (activePlayer === i) {
            playerDiv.classList.add('active-player');
        } else {
            playerDiv.classList.remove('active-player');
        }
        const cardsDiv = playerDiv.querySelector('.cards');
        cardsDiv.innerHTML = '';

        let allowedCards = null;
        if (i === activePlayer && leadSuit) {
            const hand = playersGlobal[i];
            const hasLeadSuit = hand.some(c => c.suit === leadSuit);
            const hasTrump = trumpSuit && hand.some(c => c.suit === trumpSuit);

            if (leadSuit === trumpSuit && hasTrump) {
                const playedTrumps = playedCards.filter(pc => pc.card.suit === trumpSuit).map(pc => pc.card);
                let maxTrumpRankIdx = -1;
                if (playedTrumps.length > 0) {
                    maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
                }
                const higherTrumps = hand.filter(c => c.suit === trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
                if (playedTrumps.length > 0 && higherTrumps.length > 0) {
                    allowedCards = higherTrumps;
                } else {
                    allowedCards = hand.filter(c => c.suit === trumpSuit);
                }
            } else if (hasLeadSuit) {
                allowedCards = hand.filter(c => c.suit === leadSuit);
            } else if (hasTrump) {
                const playedTrumps = playedCards.filter(pc => pc.card.suit === trumpSuit).map(pc => pc.card);
                let maxTrumpRankIdx = -1;
                if (playedTrumps.length > 0) {
                    maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
                }
                const higherTrumps = hand.filter(c => c.suit === trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
                if (playedTrumps.length > 0 && higherTrumps.length > 0) {
                    allowedCards = higherTrumps;
                } else {
                    allowedCards = hand.filter(c => c.suit === trumpSuit);
                }
            } else {
                allowedCards = hand;
            }
        }

        for (const suit of suitOrder) {
            const rowDiv = document.createElement('div');
            rowDiv.style.marginBottom = '2px';
            const suitCards = sortPlayerCards(playersGlobal[i]).filter(card => card.suit === suit);
            suitCards.forEach((card, idx) => {
                const cardDiv = document.createElement('span');
                cardDiv.className = 'card ' + suitClass[card.suit];
                cardDiv.textContent = card.rank + card.suit;

                if (activePlayer === null || i === activePlayer) {
                    let canPlay = true;
                    if (i === activePlayer && leadSuit) {
                        canPlay = allowedCards.some(c => c.suit === card.suit && c.rank === card.rank);
                    }
                    if (canPlay) {
                        cardDiv.style.cursor = 'pointer';
                        cardDiv.title = 'Bu kartı oyna';
                        cardDiv.addEventListener('click', () => {
                            playCard(i, card, suit, idx);
                        });
                    } else {
                        cardDiv.style.opacity = 0.5;
                        cardDiv.title = 'Bu kartı oynayamazsın';
                    }
                }

                rowDiv.appendChild(cardDiv);
            });
            cardsDiv.appendChild(rowDiv);
        }
    }
}

let playersGlobal = null;
// Oyun sonu puanlama için takımların topladığı kartlar
let team1Tricks = [];
let team2Tricks = [];
let lastTrickWinnerTeam = null;

// Birikimli takım puanları (2000 puana ulaşma için)
let cumulativeTeam1Score = 0;
let cumulativeTeam2Score = 0;

function playCard(playerIdx, card, suit, idxInSuit) {
    // Kartı oyuncunun elinden çıkar
    const hand = playersGlobal[playerIdx];
    for (let i = 0; i < hand.length; i++) {
        if (hand[i].suit === card.suit && hand[i].rank === card.rank) {
            hand.splice(i, 1);
            break;
        }
    }
    // Masaya ekle
    playedCards.push({ player: playerIdx, card });
    renderCenterCards();
    // Sıradaki oyuncuya geç
    if (playedCards.length < 4) {
        currentPlayer = (currentPlayer + 1) % 4;
        renderPlayersWithClick(currentPlayer);
        if (isBotPlayerIndex(currentPlayer)) {
            maybeAutoBotPlayTurn();
        }
    } else {
        // 4 kart atıldıysa, 1 saniye bekle, masayı temizle ve yeni eli başlat
        setTimeout(() => {
            const winner = findTrickWinner();
            const trickCards = playedCards.map(pc => pc.card);
            const winnerTeam = (winner % 2 === 0) ? 1 : 2; // 0 ve 2: Takım 1, 1 ve 3: Takım 2
            // Son trick ise, lastTrickWinnerTeam'i set et ve kartları ekle
            if (
                playersGlobal[0].length === 0 &&
                playersGlobal[1].length === 0 &&
                playersGlobal[2].length === 0 &&
                playersGlobal[3].length === 0
            ) {
                lastTrickWinnerTeam = winnerTeam;
                if (winnerTeam === 1) team1Tricks.push(...trickCards);
                else team2Tricks.push(...trickCards);
                calculateEndGameScores();
            } else {
                if (winnerTeam === 1) team1Tricks.push(...trickCards);
                else team2Tricks.push(...trickCards);
            }
            playedCards = [];
            renderCenterCards();
            firstPlayerOfTrick = winner;
            currentPlayer = winner;
            renderPlayersWithClick(currentPlayer);
            maybeAutoBotPlayTurn();
        }, 1000);
    }
}

// Elin kazananını bul (ilk atılan kartın rengine bak, en büyük kartı atan kazanır, koz varsa koza bakılır)
function findTrickWinner() {
    if (playedCards.length !== 4) return null;
    const leadSuit = playedCards[0].card.suit;
    let bestIdx = 0;
    let bestCard = playedCards[0].card;
    for (let i = 1; i < 4; i++) {
        const c = playedCards[i].card;
        // Önce koz var mı bak
        if (trumpSuit && c.suit === trumpSuit && bestCard.suit !== trumpSuit) {
            bestIdx = i;
            bestCard = c;
        } else if (c.suit === bestCard.suit) {
            // Aynı renktense büyüklüğe bak
            if (rankOrder.indexOf(c.rank) < rankOrder.indexOf(bestCard.rank)) {
                bestIdx = i;
                bestCard = c;
            }
        }
    }
    return playedCards[bestIdx].player;
}

function renderCenterCards() {
    const centerDiv = document.getElementById('center-cards');
    centerDiv.innerHTML = '';
    playedCards.forEach(play => {
        const cardDiv = document.createElement('span');
        cardDiv.className = 'card ' + suitClass[play.card.suit];
        cardDiv.textContent = play.card.rank + play.card.suit;
        cardDiv.title = `Oyuncu ${play.player + 1}`;
        centerDiv.appendChild(cardDiv);
    });
}

function calculateAndShowScores() {
    const scores = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const hand = playersGlobal[i];
        let sritKoz = false;
        // 1. Kozda srit var mı? (Koz ile aynı renkte A+10+K+Q+J = 150 puan)
        if (trumpSuit &&
            hand.filter(c => c.suit === trumpSuit && c.rank === 'A').length > 0 &&
            hand.filter(c => c.suit === trumpSuit && c.rank === '10').length > 0 &&
            hand.filter(c => c.suit === trumpSuit && c.rank === 'K').length > 0 &&
            hand.filter(c => c.suit === trumpSuit && c.rank === 'Q').length > 0 &&
            hand.filter(c => c.suit === trumpSuit && c.rank === 'J').length > 0) {
            sritKoz = true;
            scores[i] += 150;
        }
        // 2. Koz renginde toplam K ve Q sayısı
        let kozKCount = hand.filter(c => c.suit === trumpSuit && c.rank === 'K').length;
        let kozQCount = hand.filter(c => c.suit === trumpSuit && c.rank === 'Q').length;
        // Srit için bir K ve bir Q kullanıldıysa, fazladan kalan çiftler için 40 puan ekle
        let extraKozEvli = 0;
        if (kozKCount > 0 && kozQCount > 0) {
            let usedK = sritKoz ? 1 : 0;
            let usedQ = sritKoz ? 1 : 0;
            let kalanK = kozKCount - usedK;
            let kalanQ = kozQCount - usedQ;
            extraKozEvli = Math.min(kalanK, kalanQ);
            scores[i] += extraKozEvli * 40;
        }
        // 3. Diğer renklerdeki her K+Q çifti için 20 puan
        for (const suit of suitOrder) {
            if (suit === trumpSuit) continue;
            let kCount = hand.filter(c => c.suit === suit && c.rank === 'K').length;
            let qCount = hand.filter(c => c.suit === suit && c.rank === 'Q').length;
            let evliCount = Math.min(kCount, qCount);
            scores[i] += evliCount * 20;
        }
        // 4. Farklı renklerden 4 J
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'J'))) {
            scores[i] += 40;
        }
        // 5. Farklı renklerden 4 Q
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'Q'))) {
            scores[i] += 60;
        }
        // 6. Farklı renklerden 4 K
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'K'))) {
            scores[i] += 80;
        }
        // 7. Farklı renklerden 4 As
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'A'))) {
            scores[i] += 100;
        }
        // 8. Q♠ + J♦
        if (hand.some(c => c.suit === '♠' && c.rank === 'Q') && hand.some(c => c.suit === '♦' && c.rank === 'J')) {
            scores[i] += 40;
        }
        // 9. Sadece koz renginde srit var (A+10+K+Q+J = 150 puan)
        // Diğer renklerde srit puanı yok - sadece koz renginde srit 150 puan
        // 10. Koz ile aynı renkteki 9'lar (her biri 10 puan)
        if (trumpSuit) {
            const nines = hand.filter(c => c.suit === trumpSuit && c.rank === '9').length;
            scores[i] += nines * 10;
        }
    }
    // Tabloyu oluştur
    const tableDiv = document.getElementById('score-table');
    let html = '<table style="width:100%;background:#fff;color:#222;border-radius:8px;text-align:center;font-size:18px;"><tr><th>Oyuncu</th><th>Puan</th></tr>';
    for (let i = 0; i < 4; i++) {
        html += `<tr><td>Oyuncu ${i+1}</td><td>${scores[i]}</td></tr>`;
    }
    // Takım puanlarını ekle
    const team1 = scores[0] + scores[2];
    const team2 = scores[1] + scores[3];
    html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 1 (1 & 3)</td><td>${team1}</td></tr>`;
    html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 2 (2 & 4)</td><td>${team2}</td></tr>`;
    html += '</table>';
    tableDiv.innerHTML = html;
    tableDiv.style.display = '';
}
// Koz seçimi butonunda, koz seçildikten sonra puanları göster
Array.from(document.getElementsByClassName('trump-btn')).forEach(btn => {
    btn.addEventListener('click', function() {
        if (auctionWinner === null) return;
        trumpSuit = this.getAttribute('data-suit');
        // Kozun Türkçe adını belirle
        let kozAd = '';
        switch(trumpSuit) {
            case '♥': kozAd = 'Kupa'; break;
            case '♠': kozAd = 'Maça'; break;
            case '♦': kozAd = 'Karo'; break;
            case '♣': kozAd = 'Sinek'; break;
            default: kozAd = trumpSuit;
        }
        speakText(`Seçilen koz: ${kozAd}`);
        hideTrumpSelect();
        document.getElementById('auction-status').textContent += ` | Koz: ${trumpSuit}`;
        // Koz seçildikten sonra ilk kart atımı başlasın
        enableFirstPlay();
        calculateAndShowScores();
    });
});

document.getElementById('bid-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    const bid = parseInt(document.getElementById('bid-input').value, 10);
    // İlk teklif mi? (Hiç teklif verilmemişse, sadece PASS'ler varsa)
    const hasAnyBid = auctionBids.some(b => b !== null && b !== 'PASS');
    const isFirstBid = !hasAnyBid;
    if (
        isNaN(bid) ||
        bid < 150 ||
        bid % 10 !== 0 ||
        (!isFirstBid && bid <= auctionHighestBid) ||
        (!isFirstBid && bid < auctionHighestBid + 10)
    ) {
        alert('Teklif, mevcut en yüksekten en az 10 fazla, en az 150 ve 10\'un katı olmalı!');
        return;
    }
    auctionBids[auctionCurrent] = bid;
    auctionTurns++;
    auctionHighestBid = bid;
    updateAuctionHighestBid();
    const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
    speakText(`Oyuncu ${currentPlayerNumber} teklif verdi: ${bid}`);

    // Sordum/Konuş sonrası: ilk cevap 150/Pas gelirse sırayı konuş yapan oyuncuya geçir.
    if (sordumKonusMode && konusPlayer !== null && auctionCurrent === sordumPlayer) {
        auctionCurrent = konusPlayer;
        nextAuctionTurn();
        return;
    }
    if (sordumKonusMode && konusPlayer !== null && auctionCurrent === konusPlayer) {
        sordumKonusMode = false;
        konusPlayer = null;
        sordumPlayer = null;
        auctionWinner = sordumPlayer;
        speakText(`İhale Oyuncu ${getCurrentPlayerNumber(sordumPlayer ?? auctionCurrent, roundNumber)}'a kaldı. Teklif: ${auctionHighestBid}`);
        endAuction();
        return;
    }
    auctionCurrent = (auctionCurrent + 1) % 4;
    nextAuctionTurn();
});

document.getElementById('pass-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
    speakText(`Oyuncu ${currentPlayerNumber} pas`);
    auctionPasses[auctionCurrent] = true;
    auctionBids[auctionCurrent] = 'PASS'; // Pas geçen oyuncunun teklifini PASS olarak işaretle
    auctionTurns++;

    // Sordum/Konuş sonrası 3. oyuncu konuş sonrası pas derse, ihale 4. oyuncuya 150'ye kalır
    if (auctionCurrent === 2 && sordumKonusMode && konusPlayer === 3) {
        auctionBids[3] = 150;
        auctionHighestBid = 150;
        auctionWinner = 3;
        speakText(`İhale Oyuncu 4'e 150'ye kaldı`);
        sordumKonusMode = false;
        endAuction();
        return;
    }
    // Sordum/Konuş sonrası 4. oyuncu pas derse ihale 3. oyuncuya kalır ve biter
    if (auctionCurrent === 3 && sordumKonusMode && konusPlayer === 3 && auctionBids[2] !== null) {
        auctionWinner = 2;
        auctionHighestBid = auctionBids[2];
        speakText(`İhale Oyuncu 3'e kaldı. Teklif: ${auctionHighestBid}`);
        sordumKonusMode = false;
        konusPlayer = null;
        sordumPlayer = null;
        endAuction();
        return;
    }
    // Sordum/Konuş sonrası: ilk cevap pas gelirse sırayı konuş yapan oyuncuya geçir.
    if (sordumKonusMode && konusPlayer !== null && auctionCurrent === sordumPlayer) {
        auctionCurrent = konusPlayer;
        nextAuctionTurn();
        return;
    }
    if (sordumKonusMode && konusPlayer !== null && auctionCurrent === konusPlayer) {
        sordumKonusMode = false;
        konusPlayer = null;
        sordumPlayer = null;
        auctionWinner = sordumPlayer;
        speakText(`İhale Oyuncu ${getCurrentPlayerNumber(sordumPlayer ?? auctionCurrent, roundNumber)}'a kaldı. Teklif: ${auctionHighestBid}`);
        endAuction();
        return;
    }
    auctionCurrent = (auctionCurrent + 1) % 4;
    nextAuctionTurn();
    updateAuctionHighestBid();
});

// Samandağ Pinaki - Sordum butonu
document.getElementById('sordum-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
    // Sordum dendiğinde sesli okuma
    speakText(`Oyuncu ${currentPlayerNumber} sordum dedi`);
    sordumKonusMode = true;
    sordumPlayer = auctionCurrent;
    auctionTurns++;
    
    // Sıra sonraki oyuncuya geçer (Sordum sonrası kural)
    auctionCurrent = (auctionCurrent + 1) % 4;
    
    nextAuctionTurn();
});

// Samandağ Pinaki - Konuş butonu
document.getElementById('konus-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    
    if (auctionCurrent === 2 && !sordumKonusMode) {
        // 3. oyuncu direkt konuş diyor
        const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
        speakText(`Oyuncu ${currentPlayerNumber} konuş dedi`);
        auctionTurns++;
        auctionCurrent = (auctionCurrent + 1) % 4;
        nextAuctionTurn();
    } else if (sordumKonusMode) {
        // Sordum/Konuş modunda: Konuş sonrası sıra, sordum sahibine döner.
        const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
        speakText(`Oyuncu ${currentPlayerNumber} konuş dedi`);
        konusPlayer = auctionCurrent;
        auctionCurrent = sordumPlayer;
        nextAuctionTurn();
    }
});

// Samandağ Pinaki - Boz butonu
document.getElementById('boz-btn').addEventListener('click', () => {
    if (!auctionActive || auctionCurrent !== 3 || !sordumKonusMode) return;
    const currentPlayerNumber = getCurrentPlayerNumber(auctionCurrent, roundNumber);
    // Boz dendiğinde sesli okuma
    speakText(`Oyuncu ${currentPlayerNumber} boz dedi`);
    
    // İhale durumunu sıfırla
    auctionActive = false;
    
    // İhale ve koz ekranlarını sıfırla
    document.getElementById('auction-controls').style.display = 'none';
    document.getElementById('trump-select').style.display = 'none';
    document.getElementById('auction-status').textContent = 'Kartlar dağıtıldıktan sonra ihale başlayacak.';
    
    // Pota kutusunu temizle
    const potaMessages = document.getElementById('pota-chat-messages');
    const potaInput = document.getElementById('pota-chat-input');
    if (potaMessages) {
        potaMessages.innerHTML = '';
    }
    if (potaInput) {
        potaInput.value = '';
    }
    if (window.potaChatLog) {
        window.potaChatLog = [];
    }
    
    // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
    const tableDiv = document.getElementById('score-table');
    if (tableDiv) {
        let html = '<table style="width:100%;background:#fff;color:#222;border-radius:8px;text-align:center;font-size:18px;"><tr><th>Oyuncu</th><th>Puan</th></tr>';
        for (let i = 0; i < 4; i++) {
            html += `<tr><td>Oyuncu ${i+1}</td><td>0</td></tr>`;
        }
        html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 1 (1 & 3)</td><td>0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 2 (2 & 4)</td><td>0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td>Birikimli Takım 1</td><td>${cumulativeTeam1Score}</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td>Birikimli Takım 2</td><td>${cumulativeTeam2Score}</td></tr>`;
        html += '</table>';
        tableDiv.innerHTML = html;
        tableDiv.style.display = '';
    }
    
    // Oyun sonu sonucu sıfırla
    const resultDiv = document.getElementById('endgame-result');
    if (resultDiv) resultDiv.innerHTML = '';
    
    // Sağ alt köşedeki game-result kutusunu gizle
    const gameResultDiv = document.getElementById('game-result');
    if (gameResultDiv) {
        gameResultDiv.style.display = 'none';
    }
    
    // Ard arda boz sayısını artır
    consecutiveBozCount++;
    
    // Eğer 3 kez ard arda boz olduysa, dağıtıcı sırasını değiştir
    if (consecutiveBozCount >= 3) {
        currentDealer = (currentDealer + 1) % 4;
        consecutiveBozCount = 0; // Sayacı sıfırla
    }
    // 3'ten az boz varsa aynı oyuncu dağıtmaya devam eder
    
    // Tüm oyuncu kutularından parlaklık efektlerini kaldır
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('active-player', 'auction-active');
        }
    }
    
    // Dağıtıcı sırasına göre butonu güncelle
    updateDealButton();
    
    // Kartları yeniden dağıt
    let deck = createDeck();
    deck = shuffle(deck);
    const players = dealCards(deck);
    playersGlobal = players;
    playedCards = [];
    team1Tricks = [];
    team2Tricks = [];
    lastTrickWinnerTeam = null;
    renderPlayers(players);
    renderCenterCards();
    
    // İhaleyi sıfırla ve yeniden başlat
    startAuction();
});

// Kartlar dağıtıldıktan sonra ihale başlat
const oldDealBtnHandler = document.getElementById('dealBtn').onclick;
document.getElementById('dealBtn').addEventListener('click', () => {
    // --- EK: Skor ve pota kutusu sıfırlama ---
    // Birikimli puanları sıfırlama - artık saklanıyor
    // cumulativeTeam1Score = 0; // Bu satırı kaldırdık
    // cumulativeTeam2Score = 0; // Bu satırı kaldırdık
    
    // İhale ve koz ekranlarını sıfırla
    document.getElementById('auction-controls').style.display = 'none';
    document.getElementById('trump-select').style.display = 'none';
    document.getElementById('auction-status').textContent = 'Kartlar dağıtıldıktan sonra ihale başlayacak.';
    
    // Pota kutusunu temizle
    const potaMessages = document.getElementById('pota-chat-messages');
    const potaInput = document.getElementById('pota-chat-input');
    if (potaMessages) {
        potaMessages.innerHTML = '';
    }
    if (potaInput) {
        potaInput.value = '';
    }
    if (window.potaChatLog) {
        window.potaChatLog = [];
    }
    
    // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
    const tableDiv = document.getElementById('score-table');
    if (tableDiv) {
        let html = '<table style="width:100%;background:#fff;color:#222;border-radius:8px;text-align:center;font-size:18px;"><tr><th>Oyuncu</th><th>Puan</th></tr>';
        for (let i = 0; i < 4; i++) {
            html += `<tr><td>Oyuncu ${i+1}</td><td>0</td></tr>`;
        }
        html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 1 (1 & 3)</td><td>0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#eee;'><td>Takım 2 (2 & 4)</td><td>0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td>Birikimli Takım 1</td><td>${cumulativeTeam1Score}</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td>Birikimli Takım 2</td><td>${cumulativeTeam2Score}</td></tr>`;
        html += '</table>';
        tableDiv.innerHTML = html;
        tableDiv.style.display = '';
    }
    // Oyun sonu sonucu sıfırla
    const resultDiv = document.getElementById('endgame-result');
    if (resultDiv) resultDiv.innerHTML = '';
    // Sağ alt köşedeki game-result kutusunu gizle
    const gameResultDiv = document.getElementById('game-result');
    if (gameResultDiv) {
        gameResultDiv.style.display = 'none';
    }
    // Pota kutusunu temizle
    const potaChatMessages = document.getElementById('pota-chat-messages');
    if (potaChatMessages) potaChatMessages.innerHTML = '';
    if (window.potaChatLog) window.potaChatLog = [];
    // Normal el oynandığında ard arda boz sayısını sıfırla
    consecutiveBozCount = 0;
    // Dağıtıcı sırasını değiştirme - el tamamlanana kadar aynı oyuncu dağıtmalı
    
    // Tüm oyuncu kutularından parlaklık efektlerini kaldır
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('active-player', 'auction-active');
        }
    }
    
    // --- mevcut kart dağıt kodu ---
    let deck = createDeck();
    deck = shuffle(deck);
    const players = dealCards(deck);
    playersGlobal = players;
    playedCards = [];
    team1Tricks = [];
    team2Tricks = [];
    lastTrickWinnerTeam = null;
    renderPlayers(players);
    renderCenterCards();
    startAuction();
});

// Oyun sonu puanlaması: Her As ve 10'lu 10 puan, K ve Q 5 puan, son eli alan takım 10 puan
function calculateEndGameScores() {
    function trickPoints(cards) {
        let points = 0;
        for (const c of cards) {
            if (c.rank === 'A' || c.rank === '10') points += 10;
            else if (c.rank === 'K' || c.rank === 'Q') points += 5;
        }
        return points;
    }
    let t1 = trickPoints(team1Tricks);
    let t2 = trickPoints(team2Tricks);
    // Bonus 10 puan sadece son eli kazanan takıma eklenmeli
    if (lastTrickWinnerTeam === 1) t1 += 10;
    else if (lastTrickWinnerTeam === 2) t2 += 10;
    
    // Takımların başlangıç puanlarını score-table'dan çek
    const s1 = parseInt(document.querySelector('#score-table tr:nth-child(2) td:last-child').textContent, 10);
    const s2 = parseInt(document.querySelector('#score-table tr:nth-child(3) td:last-child').textContent, 10);
    const s3 = parseInt(document.querySelector('#score-table tr:nth-child(4) td:last-child').textContent, 10);
    const s4 = parseInt(document.querySelector('#score-table tr:nth-child(5) td:last-child').textContent, 10);
    let team1Start = s1 + s3;
    let team2Start = s2 + s4;
    let kabbut = false;
    let oyunBatti = false;
    let cezaPuan = 0;
    
    // Kabbut kontrolü: ihaleyi kazanan takım tüm elleri aldıysa
    let kazananTakim = null;
    if (auctionWinner === 0 || auctionWinner === 2) kazananTakim = 1;
    if (auctionWinner === 1 || auctionWinner === 3) kazananTakim = 2;
    if (kazananTakim === 1 && t2 === 0) {
        team2Start = 0;
        kabbut = true;
    } else if (kazananTakim === 2 && t1 === 0) {
        team1Start = 0;
        kabbut = true;
    }
    
    let team1Total = team1Start + t1;
    let team2Total = team2Start + t2;
    let teklif = auctionHighestBid;
    
    // Oyun Battı kontrolü
    if (kazananTakim && teklif) {
        if ((kazananTakim === 1 && team1Total < teklif)) {
            oyunBatti = true;
            cezaPuan = teklif;
            team1Start = 0;
            team1Total = -cezaPuan;
        } else if ((kazananTakim === 2 && team2Total < teklif)) {
            oyunBatti = true;
            cezaPuan = teklif;
            team2Start = 0;
            team2Total = -cezaPuan;
        }
    }
    
    // Birikimli puanları güncelle - her iki takımın da toplam puanları biriktirilir
    if (oyunBatti) {
        // Oyun battığında, battan takımın birikimli puanından ihale teklif puanı çıkarılır
        if (kazananTakim === 1) {
            cumulativeTeam1Score -= cezaPuan;
        } else if (kazananTakim === 2) {
            cumulativeTeam2Score -= cezaPuan;
        }
        // Diğer takımın puanı normal şekilde biriktirilir
        if (kazananTakim === 1) {
            cumulativeTeam2Score += team2Total;
        } else if (kazananTakim === 2) {
            cumulativeTeam1Score += team1Total;
        }
    } else {
        // Normal durumda her iki takımın da toplam puanlarını biriktir
        cumulativeTeam1Score += team1Total;
        cumulativeTeam2Score += team2Total;
    }
    
    // 2000 puana ulaşma kontrolü
    let gameWinner = null;
    if (cumulativeTeam1Score >= 2000) {
        gameWinner = 1;
    } else if (cumulativeTeam2Score >= 2000) {
        gameWinner = 2;
    }
    
    // Sonucu ekrana yaz
    const resultDiv = document.getElementById('endgame-result');
    resultDiv.innerHTML = `Oyun Sonu Sonuçları:<br>
    Takım 1 (1 & 3): <b>${t1}</b> puan<br>
    Takım 2 (2 & 4): <b>${t2}</b> puan<br>
    1. Takımın Toplam Puanı: <b>${team1Start} + ${t1} = ${team1Total}</b><br>
    2. Takımın Toplam Puanı: <b>${team2Start} + ${t2} = ${team2Total}</b><br>
    <br><strong>Birikimli Puanlar:</strong><br>
    Takım 1: <b>${cumulativeTeam1Score}</b> puan<br>
    Takım 2: <b>${cumulativeTeam2Score}</b> puan`
    + (kabbut ? `<br><span style='color:#ff4444;font-weight:bold;'>Kabbut! Rakip takımın puanı sıfırlandı.</span>` : '')
    + (oyunBatti ? `<br><span style='color:#ff2222;font-weight:bold;'>Oyun Battı! Takımın puanı sıfırlandı ve -${cezaPuan} ceza puanı verildi.</span>` : '')
    + (gameWinner ? `<br><span style='color:#00ff00;font-weight:bold;font-size:24px;'>🎉 TAKIM ${gameWinner} OYUNU KAZANDI! 🎉</span>` : '');

    // Sonucu sağ alt köşeye yaz
    const gameResultDiv = document.getElementById('game-result');
    if (gameResultDiv) {
        if (gameWinner) {
            gameResultDiv.textContent = `Takım ${gameWinner} oyunu kazandı!`;
            gameResultDiv.style.display = '';
        } else if (kazananTakim && teklif) {
            if (oyunBatti) {
                gameResultDiv.textContent = 'Oyun Battı!';
            } else if (team1Total >= teklif && kazananTakim === 1) {
                gameResultDiv.textContent = 'Oyunu kazandınız.';
            } else if (team2Total >= teklif && kazananTakim === 2) {
                gameResultDiv.textContent = 'Oyunu kazandınız.';
            } else {
                gameResultDiv.textContent = 'Oyunu kaybettiniz.';
            }
            gameResultDiv.style.display = '';
        } else {
            gameResultDiv.style.display = 'none';
        }
    }
    
    // Sonuç tablosunu görünür yap
    document.getElementById('score-table').style.display = '';

    // --- EK: Pota kutusunu ve skor tablosunu sıfırla ---
    // Pota kutusunu temizle
    const potaChatMessages = document.getElementById('pota-chat-messages');
    if (potaChatMessages) potaChatMessages.innerHTML = '';
    if (window.potaChatLog) window.potaChatLog = [];
    // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
    const tableDiv2 = document.getElementById('score-table');
    if (tableDiv2) {
        let html2 = '<table style="width:100%;background:#fff;color:#222;border-radius:8px;text-align:center;font-size:18px;"><tr><th>Oyuncu</th><th>Puan</th></tr>';
        for (let i = 0; i < 4; i++) {
            html2 += `<tr><td>Oyuncu ${i+1}</td><td>0</td></tr>`;
        }
        html2 += `<tr style='font-weight:bold;background:#eee;'><td>Takım 1 (1 & 3)</td><td>0</td></tr>`;
        html2 += `<tr style='font-weight:bold;background:#eee;'><td>Takım 2 (2 & 4)</td><td>0</td></tr>`;
        html2 += '</table>';
        tableDiv2.innerHTML = html2;
    }
    
    // Normal el oynandığında ard arda boz sayısını sıfırla
    consecutiveBozCount = 0;
    
    // Round değişiminde Sordum/Konuş modunu sıfırla
    sordumKonusMode = false;
    sordumPlayer = null;
    konusPlayer = null;
    
    // İhale sayısını artır
    roundNumber++; // İhale sayısını artır
    if (roundNumber > 4) roundNumber = 1; // 4'ten sonra 1'e dön

    // Dağıtıcıyı bir sonraki oyuncuya geçir
    advanceDealer();

    // Oyuncu index mapping'ini güncelle
    updatePlayerIndexMapping();
    
    // Oyun bittiğinde oyun durumunu sıfırla ki buton aktif olsun
    currentPlayer = null;
    auctionActive = false;
    
    updateDealButton(); // Dağıtıcı sırasına göre butonu güncelle
}

// Global speakText fonksiyonu
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.lang = 'tr-TR';
        window.speechSynthesis.speak(utter);
    }
}

// Round'a göre oyuncu numarasını hesaplayan global fonksiyon
function getCurrentPlayerNumber(playerIndex, roundNumber) {
    // Round dışında kalan tüm çağrılarda mapping varsa kullan; aksi yoksa eski davranışa dön.
    if (playerIndexMapping && Object.prototype.hasOwnProperty.call(playerIndexMapping, playerIndex)) {
        return playerIndexMapping[playerIndex];
    }
    return getPlayerNumberFromIndex(playerIndex);
}

function maybeAutoBotDeal() {
    if (auctionActive || currentPlayer !== null) return;
    if (!isBotPlayerIndex(currentDealer)) return;

    const dealBtn = document.getElementById('dealBtn');
    if (!dealBtn || dealBtn.disabled) return;

    setTimeout(() => {
        if (!auctionActive && currentPlayer === null && !dealBtn.disabled && isBotPlayerIndex(currentDealer)) {
            dealBtn.click();
        }
    }, 600);
}

// Dağıtıcı sırasına göre "Kart Dağıt" butonunu güncelle
function updateDealButton() {
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        const dealerPlayerNumber = getCurrentPlayerNumber(currentDealer, roundNumber);
        dealBtn.textContent = `Kartları Dağıt (Oyuncu ${dealerPlayerNumber})`;
        dealBtn.title = `Sadece Oyuncu ${dealerPlayerNumber} kartları dağıtabilir`;

        if (auctionActive || (typeof currentPlayer !== 'undefined' && currentPlayer !== null)) {
            dealBtn.disabled = true;
            dealBtn.style.opacity = '0.5';
            dealBtn.style.cursor = 'not-allowed';
        } else {
            dealBtn.disabled = false;
            dealBtn.style.opacity = '1';
            dealBtn.style.cursor = 'pointer';
        }

        maybeAutoBotDeal();
        console.log(`Deal Button Status: disabled=${dealBtn.disabled}, auctionActive=${auctionActive}, currentPlayer=${currentPlayer}`);
    }
}

window.onload = function() {
    // Sayfa yüklendiğinde dağıtıcı sırasına göre butonu güncelle
    updateDealButton();
    updatePlayerLabels();

    const botMenuToggle = document.getElementById('bot-menu-toggle');
    const botMenu = document.getElementById('bot-menu');
    const botMenuClose = document.getElementById('bot-menu-close');

    if (botMenuToggle && botMenu) {
        botMenuToggle.addEventListener('click', () => {
            botMenu.style.display = botMenu.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (botMenuClose && botMenu) {
        botMenuClose.addEventListener('click', () => {
            botMenu.style.display = 'none';
        });
    }

    document.querySelectorAll('[data-bot-seat]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const selected = Array.from(document.querySelectorAll('[data-bot-seat]')).map((el) => el.checked);
            configureBots(selected);
            maybeAutoBotDeal();
            botMenu.style.display = 'none';
        });
    });
    
    // Pota iletişim kutusu işlevselliği
    const potaChatMessages = document.getElementById('pota-chat-messages');
    const potaChatInput = document.getElementById('pota-chat-input');
    const potaChatSend = document.getElementById('pota-chat-send');
    window.potaChatLog = [];

    function getCurrentPlayerNumberForChat() {
        if (typeof auctionActive !== 'undefined' && auctionActive) return getCurrentPlayerNumber(auctionCurrent, roundNumber);
        if (typeof currentPlayer !== 'undefined' && currentPlayer !== null) return currentPlayer + 1;
        return '?';
    }

    function addPotaMessage(msg, playerNum) {
        window.potaChatLog.push({msg, playerNum});
        const lastMsgs = window.potaChatLog.slice(-10);
        potaChatMessages.innerHTML = lastMsgs.map(m => `<div><b>Oyuncu ${m.playerNum}:</b> ${m.msg}</div>`).join('');
        potaChatMessages.scrollTop = potaChatMessages.scrollHeight;
    }

    potaChatSend.addEventListener('click', () => {
        const text = potaChatInput.value.trim();
        if (!text) return;
        
        const playerNum = getCurrentPlayerNumberForChat();
        addPotaMessage(text, playerNum);
        speakText(`Oyuncu ${playerNum}: ${text}`);
        potaChatInput.value = '';
        potaChatInput.focus();
        
        // Pota chat artık sadece sohbet amaçlı, oyun akışını hiç etkilemez
        // Oyuncu sırası değişmez, sadece mesaj gönderilir
    });

    // Enter tuşu ile de mesaj gönder
    potaChatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            potaChatSend.click();
        }
    });

    // Nasıl Oynanır butonu işlevselliği
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    if (howToPlayBtn) {
        howToPlayBtn.addEventListener('click', () => {
            // README.md dosyasını yeni sekmede aç
            window.open('README.md', '_blank');
        });
    }
};
