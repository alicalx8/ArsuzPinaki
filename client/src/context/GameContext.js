import React, { createContext, useContext, useReducer, useMemo, useEffect, useCallback } from 'react';

const GameContext = createContext();

// Initial state
const initialState = {
  roundNumber: 1,
  players: [[], [], [], []],
  playerNames: ['Oyuncu 1', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4'], // Oyuncu isimleri
  auctionActive: false,
  auctionCurrent: 0,
  auctionBids: [null, null, null, null],
  auctionPasses: [false, false, false, false],
  auctionHighestBid: 0,
  auctionWinner: null,
  auctionTurns: 0,
  trumpSuit: null,
  playedCards: [],
  currentPlayer: null,
  firstPlayerOfTrick: null,
  team1Tricks: [],
  team2Tricks: [],
  lastTrickWinnerTeam: null,
  cumulativeTeam1Score: 0,
  cumulativeTeam2Score: 0,
  consecutiveBozCount: 0,
  sordumKonusMode: false,
  sordumPlayer: null,
  konusPlayer: null,
  currentDealer: 3,
  playerIndexMapping: {0: 1, 1: 2, 2: 3, 3: 4},
  gameScores: [0, 0, 0, 0], // Başlangıç puanları
  gameEnded: false,
  gameWinner: null,
  gameStarted: false, // Oyun başladı mı
  gamePhase: 'waiting', // Oyun fazı: waiting, auction, trumpSelection, playing, ended
  isBoz: false, // Boz durumu (tüm oyuncular pas geçti)
  
  // Round sonu state'leri
  roundEnded: false,
  roundNumber: 1,
  roundTeam1Score: 0,
  roundTeam2Score: 0,
  kabbut: false,
  oyunBatti: false,
  
  // Multiplayer state
  isMultiplayer: false,
  multiplayerCards: null, // Multiplayer'da alınan kartlar
  multiplayerPlayerIndex: null,
  handSizes: [0, 0, 0, 0]
};

// Action types
const actionTypes = {
  DEAL_CARDS: 'DEAL_CARDS',
  START_AUCTION: 'START_AUCTION',
  PLACE_BID: 'PLACE_BID',
  PASS_BID: 'PASS_BID',
  SORDUM: 'SORDUM',
  KONUS: 'KONUS',
  BOZ: 'BOZ',
  SELECT_TRUMP: 'SELECT_TRUMP',
  PLAY_CARD: 'PLAY_CARD',
  END_TRICK: 'END_TRICK',
  END_ROUND: 'END_ROUND',
  CALCULATE_SCORES: 'CALCULATE_SCORES',
  END_GAME: 'END_GAME',
  RESET_GAME: 'RESET_GAME',
  SET_PLAYER_NAMES: 'SET_PLAYER_NAMES',
  SET_MULTIPLAYER_MODE: 'SET_MULTIPLAYER_MODE',
  SET_MULTIPLAYER_CARDS: 'SET_MULTIPLAYER_CARDS',
  SET_MULTIPLAYER_PLAYER_INDEX: 'SET_MULTIPLAYER_PLAYER_INDEX',
  SET_GAME_STARTED: 'SET_GAME_STARTED',
  SET_GAME_PHASE: 'SET_GAME_PHASE',
  SET_IS_BOZ: 'SET_IS_BOZ',
  SET_AUCTION_BIDS: 'SET_AUCTION_BIDS',
  SET_ROUND_END: 'SET_ROUND_END',
  RESET_ROUND_END: 'RESET_ROUND_END'
};

// Game logic functions
const createDeck = () => {
  const suits = ['♥', '♠', '♦', '♣'];
  const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];
  for (let d = 0; d < 2; d++) {
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }
  return deck;
};

const shuffle = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const dealCards = (deck) => {
  const players = [[], [], [], []];
  let cardIndex = 0;
  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < 4; p++) {
      for (let k = 0; k < 4; k++) {
        players[p].push(deck[cardIndex++]);
      }
    }
  }
  return players;
};

// İhale sonunda kazanan belirleme fonksiyonu
const determineAuctionWinner = (bids) => {
  let highestBid = 0;
  let winner = null;
  
  for (let i = 0; i < bids.length; i++) {
    if (bids[i] !== null && bids[i] !== 'PASS' && bids[i] > highestBid) {
      highestBid = bids[i];
      winner = i;
    }
  }
  
  return { winner, highestBid };
};

// El kazananını belirleme fonksiyonu
const determineTrickWinner = (playedCards, trumpSuit) => {
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
      if (getCardRank(c.rank) < getCardRank(bestCard.rank)) {
        bestIdx = i;
        bestCard = c;
      }
    }
  }
  
  return playedCards[bestIdx].player;
};

// Kart sıralaması (A > 10 > K > Q > J > 9)
const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
const suitOrder = ['♥', '♠', '♦', '♣'];
const suitClass = {
  '♥': 'hearts',
  '♦': 'diamonds', 
  '♠': 'spades',
  '♣': 'clubs',
};

const getCardRank = (rank) => {
  return rankOrder.indexOf(rank);
};

// Oyuncu index mapping güncelleme
const updatePlayerIndexMapping = (roundNumber) => {
  if (roundNumber === 1) {
    return {0: 1, 1: 2, 2: 3, 3: 4};
  } else if (roundNumber === 2) {
    return {0: 2, 1: 3, 2: 4, 3: 1};
  } else if (roundNumber === 3) {
    return {0: 3, 1: 4, 2: 1, 3: 2};
  } else if (roundNumber === 4) {
    return {0: 4, 1: 1, 2: 2, 3: 3};
  }
  return {0: 1, 1: 2, 2: 3, 3: 4};
};

// Index'ten oyuncu numarasını al
const getPlayerNumberFromIndex = (index, mapping) => {
  return mapping[index];
};

// Kart sıralama fonksiyonu
const sortPlayerCards = (cards) => {
  // null kartları filtrele
  const validCards = cards.filter(card => card && card.suit && card.rank);
  
  return validCards.sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
  });
};

// Oynanabilir kartları belirleme
const getAllowedCards = (hand, playedCards, trumpSuit) => {
  if (playedCards.length === 0) {
    // İlk kart, herhangi bir kart atılabilir
    return hand;
  }
  
  const leadSuit = playedCards[0].card.suit;
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  const hasTrump = trumpSuit && hand.some(c => c.suit === trumpSuit);
  
  // Eğer açılan kart koz ise, koz yükseltme zorunluluğu uygula
  if (leadSuit === trumpSuit && hasTrump) {
    const playedTrumps = playedCards.filter(pc => pc.card.suit === trumpSuit).map(pc => pc.card);
    let maxTrumpRankIdx = -1;
    if (playedTrumps.length > 0) {
      maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
    }
    // Elinde daha yüksek koz var mı?
    const higherTrumps = hand.filter(c => c.suit === trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
    if (playedTrumps.length > 0 && higherTrumps.length > 0) {
      return higherTrumps;
    } else {
      return hand.filter(c => c.suit === trumpSuit);
    }
  } else if (hasLeadSuit) {
    // Açılan renk varsa o rengi at
    return hand.filter(c => c.suit === leadSuit);
  } else if (hasTrump) {
    // Açılan renk yoksa ve koz varsa koz at
    const playedTrumps = playedCards.filter(pc => pc.card.suit === trumpSuit).map(pc => pc.card);
    let maxTrumpRankIdx = -1;
    if (playedTrumps.length > 0) {
      maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
    }
    // Elinde daha yüksek koz var mı?
    const higherTrumps = hand.filter(c => c.suit === trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
    if (playedTrumps.length > 0 && higherTrumps.length > 0) {
      return higherTrumps;
    } else {
      return hand.filter(c => c.suit === trumpSuit);
    }
  } else {
    // Ne açılan renk ne de koz varsa herhangi bir kart
    return hand;
  }
};

// Başlangıç puanları hesaplama
const calculateStartingScores = (players, trumpSuit) => {
  const scores = [0, 0, 0, 0];
  
  for (let i = 0; i < 4; i++) {
    const hand = players[i];
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
    
    // 8. Q♠ + J♦ (Pinaki)
    if (hand.some(c => c.suit === '♠' && c.rank === 'Q') && hand.some(c => c.suit === '♦' && c.rank === 'J')) {
      scores[i] += 40;
    }
    
    // 9. Koz ile aynı renkteki 9'lar (her biri 10 puan)
    if (trumpSuit) {
      const nines = hand.filter(c => c.suit === trumpSuit && c.rank === '9').length;
      scores[i] += nines * 10;
    }
  }
  
  return scores;
};

// Oyun sonu puanları hesaplama
const calculateTrickPoints = (cards) => {
  let points = 0;
  for (const c of cards) {
    if (c.rank === 'A' || c.rank === '10') points += 10;
    else if (c.rank === 'K' || c.rank === 'Q') points += 5;
  }
  return points;
};

// Oyun sonu hesaplamaları
const calculateEndGameScores = (state) => {
  const t1 = calculateTrickPoints(state.team1Tricks);
  const t2 = calculateTrickPoints(state.team2Tricks);
  
  // Son eli alan takıma 10 bonus puan
  let team1TrickPoints = t1;
  let team2TrickPoints = t2;
  if (state.lastTrickWinnerTeam === 1) team1TrickPoints += 10;
  else if (state.lastTrickWinnerTeam === 2) team2TrickPoints += 10;
  
  // Başlangıç puanları
  const team1Start = state.gameScores[0] + state.gameScores[2];
  const team2Start = state.gameScores[1] + state.gameScores[3];
  
  let team1Total = team1Start + team1TrickPoints;
  let team2Total = team2Start + team2TrickPoints;
  
  // Kabbut kontrolü
  let kabbut = false;
  let kazananTakim = null;
  if (state.auctionWinner === 0 || state.auctionWinner === 2) kazananTakim = 1;
  if (state.auctionWinner === 1 || state.auctionWinner === 3) kazananTakim = 2;
  
  if (kazananTakim === 1 && team2TrickPoints === 0) {
    team2Total = 0;
    kabbut = true;
  } else if (kazananTakim === 2 && team1TrickPoints === 0) {
    team1Total = 0;
    kabbut = true;
  }
  
  // Oyun Battı kontrolü
  let oyunBatti = false;
  let cezaPuan = 0;
  const teklif = state.auctionHighestBid;
  
  if (kazananTakim && teklif) {
    if (kazananTakim === 1 && team1Total < teklif) {
      oyunBatti = true;
      cezaPuan = teklif;
      team1Total = -cezaPuan;
    } else if (kazananTakim === 2 && team2Total < teklif) {
      oyunBatti = true;
      cezaPuan = teklif;
      team2Total = -cezaPuan;
    }
  }
  
  // Birikimli puanları güncelle
  let newCumulativeTeam1Score = state.cumulativeTeam1Score;
  let newCumulativeTeam2Score = state.cumulativeTeam2Score;
  
  if (oyunBatti) {
    if (kazananTakim === 1) {
      newCumulativeTeam1Score -= cezaPuan;
      newCumulativeTeam2Score += team2Total;
    } else if (kazananTakim === 2) {
      newCumulativeTeam2Score -= cezaPuan;
      newCumulativeTeam1Score += team1Total;
    }
  } else {
    newCumulativeTeam1Score += team1Total;
    newCumulativeTeam2Score += team2Total;
  }
  
  // 2000 puana ulaşma kontrolü
  let gameWinner = null;
  if (newCumulativeTeam1Score >= 2000) {
    gameWinner = 1;
  } else if (newCumulativeTeam2Score >= 2000) {
    gameWinner = 2;
  }
  
  return {
    team1TrickPoints,
    team2TrickPoints,
    team1Total,
    team2Total,
    newCumulativeTeam1Score,
    newCumulativeTeam2Score,
    kabbut,
    oyunBatti,
    cezaPuan,
    gameWinner,
    kazananTakim
  };
};

// Reducer
function gameReducer(state, action) {
  switch (action.type) {
    case actionTypes.DEAL_CARDS:
      const deck = createDeck();
      const shuffledDeck = shuffle(deck);
      const newPlayers = dealCards(shuffledDeck);
      return {
        ...state,
        players: newPlayers,
        playedCards: [],
        team1Tricks: [],
        team2Tricks: [],
        auctionActive: false,
        trumpSuit: null,
        currentPlayer: null,
        auctionBids: [null, null, null, null],
        auctionHighestBid: 0,
        auctionWinner: null,
        firstPlayerOfTrick: null,
        gameStarted: true, // Oyun başladı
        gamePhase: 'waiting' // İhale başlatılana kadar bekle
      };

    case actionTypes.START_AUCTION:
      const newMapping = updatePlayerIndexMapping(state.roundNumber);
      let startingPlayer = 0;
      
      // Dağıtıcıdan sonraki oyuncu ihale başlatır
      if (state.roundNumber === 1) {
        startingPlayer = 0; // Oyuncu 1
      } else if (state.roundNumber === 2) {
        startingPlayer = 1; // Oyuncu 2
      } else if (state.roundNumber === 3) {
        startingPlayer = 2; // Oyuncu 3
      } else if (state.roundNumber === 4) {
        startingPlayer = 3; // Oyuncu 4
      }
      
      return {
        ...state,
        auctionActive: true,
        auctionBids: [null, null, null, null],
        auctionPasses: [false, false, false, false],
        auctionHighestBid: 0,
        auctionWinner: null,
        auctionCurrent: startingPlayer,
        auctionTurns: 0,
        playerIndexMapping: newMapping,
        sordumKonusMode: false,
        sordumPlayer: null,
        konusPlayer: null,
        gamePhase: 'auction' // İhale fazına geç
      };

    case actionTypes.PLACE_BID:
      const { bid } = action.payload;
      const newBids = [...state.auctionBids];
      newBids[state.auctionCurrent] = bid;
      
      // Sordum/Konuş modunda özel kontrol
      if (state.sordumKonusMode && state.konusPlayer !== null) {
        // Konuş sonrası önceki oyuncu teklif verdi - sıra Konuş diyen oyuncuya döner
        return {
          ...state,
          auctionBids: newBids,
          auctionHighestBid: Math.max(state.auctionHighestBid, bid),
          auctionCurrent: state.konusPlayer, // Sıra Konuş diyen oyuncuya döner
          sordumKonusMode: false // Normal ihale moduna dön
        };
      }
      
      // Tüm oyuncular teklif verdiyse ihale sonucunu belirle
      const allBidsComplete = newBids.every(bid => bid !== null);
      let auctionWinner = null;
      let auctionHighestBid = Math.max(state.auctionHighestBid, bid);
      
      if (allBidsComplete) {
        const result = determineAuctionWinner(newBids);
        auctionWinner = result.winner;
        auctionHighestBid = result.highestBid;
      }
      
      return {
        ...state,
        auctionBids: newBids,
        auctionHighestBid,
        auctionWinner,
        auctionCurrent: (state.auctionCurrent + 1) % 4,
        auctionActive: !allBidsComplete // Tüm teklifler tamamlandıysa ihaleyi kapat
      };

    case actionTypes.PASS_BID:
      const passBids = [...state.auctionBids];
      passBids[state.auctionCurrent] = 'PASS';
      
      // Sordum/Konuş modunda özel kontrol
      if (state.sordumKonusMode && state.konusPlayer !== null) {
        // Konuş sonrası önceki oyuncu pas dedi - ihale Konuş diyen oyuncuya 150'ye kalır
        return {
          ...state,
          auctionBids: passBids,
          auctionWinner: state.konusPlayer,
          auctionHighestBid: Math.max(state.auctionHighestBid, 150),
          auctionActive: false, // İhale bitti
          sordumKonusMode: false
        };
      }
      
      // Tüm oyuncular teklif verdiyse ihale sonucunu belirle
      const allPassBidsComplete = passBids.every(bid => bid !== null);
      let passAuctionWinner = null;
      let passAuctionHighestBid = state.auctionHighestBid;
      
      if (allPassBidsComplete) {
        const result = determineAuctionWinner(passBids);
        passAuctionWinner = result.winner;
        passAuctionHighestBid = result.highestBid;
      }
      
      return {
        ...state,
        auctionBids: passBids,
        auctionWinner: passAuctionWinner,
        auctionHighestBid: passAuctionHighestBid,
        auctionCurrent: (state.auctionCurrent + 1) % 4,
        auctionActive: !allPassBidsComplete // Tüm teklifler tamamlandıysa ihaleyi kapat
      };

    case actionTypes.SELECT_TRUMP:
      const selectedTrumpSuit = action.payload.suit;
      const startingScores = calculateStartingScores(state.players, selectedTrumpSuit);
      
      return {
        ...state,
        trumpSuit: selectedTrumpSuit,
        auctionActive: false, // İhale bitti
        currentPlayer: state.auctionWinner, // İhaleyi kazanan oyuncu ilk kartı atar
        firstPlayerOfTrick: state.auctionWinner, // İlk elin başlangıcı
        gameScores: startingScores, // Başlangıç puanlarını hesapla
        gamePhase: 'playing' // Oyun fazını oynama fazına çek
      };

    case actionTypes.PLAY_CARD:
      const { playerIndex, card } = action.payload;
      
      // Oynanabilir kart kontrolü
      const allowedCards = getAllowedCards(state.players[playerIndex], state.playedCards, state.trumpSuit);
      const canPlayCard = allowedCards.some(c => c.suit === card.suit && c.rank === card.rank);
      
      if (!canPlayCard) {
        // Geçersiz kart hamlesi, state'i değiştirme
        console.warn(`Geçersiz kart hamlesi: Oyuncu ${playerIndex} ${card.suit}${card.rank} kartını oynayamaz`);
        return state;
      }
      
      console.log(`Kart atıldı: Oyuncu ${playerIndex} ${card.suit}${card.rank} kartını attı`);
      
      const newPlayedCards = [...state.playedCards, { player: playerIndex, card }];
      const newPlayersState = [...state.players];
      
      // Kartı oyuncunun elinden çıkar
      const cardIndex = newPlayersState[playerIndex].findIndex(
        c => c.suit === card.suit && c.rank === card.rank
      );
      if (cardIndex > -1) {
        newPlayersState[playerIndex].splice(cardIndex, 1);
      }
      
      // 4 kart atıldıysa el kazananını belirle
      if (newPlayedCards.length === 4) {
        const trickWinner = determineTrickWinner(newPlayedCards, state.trumpSuit);
        const winnerTeam = (trickWinner % 2 === 0) ? 1 : 2; // 0 ve 2: Takım 1, 1 ve 3: Takım 2
        const trickCards = newPlayedCards.map(pc => pc.card);
        
        const newTeam1Tricks = winnerTeam === 1 ? [...state.team1Tricks, ...trickCards] : state.team1Tricks;
        const newTeam2Tricks = winnerTeam === 2 ? [...state.team2Tricks, ...trickCards] : state.team2Tricks;
        
        // Son el mi kontrol et (tüm kartlar bitti mi?)
        const allCardsPlayed = newPlayersState.every(hand => hand.length === 0);
        
        if (allCardsPlayed) {
          // Oyun sonu - puanları hesapla
          const endGameResults = calculateEndGameScores({
            ...state,
            players: newPlayersState,
            team1Tricks: newTeam1Tricks,
            team2Tricks: newTeam2Tricks,
            lastTrickWinnerTeam: winnerTeam
          });
          
          return {
            ...state,
            players: newPlayersState,
            playedCards: [],
            team1Tricks: newTeam1Tricks,
            team2Tricks: newTeam2Tricks,
            lastTrickWinnerTeam: winnerTeam,
            cumulativeTeam1Score: endGameResults.newCumulativeTeam1Score,
            cumulativeTeam2Score: endGameResults.newCumulativeTeam2Score,
            gameEnded: endGameResults.gameWinner !== null,
            gameWinner: endGameResults.gameWinner,
            currentPlayer: null,
            gamePhase: 'ended' // Oyun bitti
          };
        } else {
          // Normal el sonu - yeni el başlat
          return {
            ...state,
            players: newPlayersState,
            playedCards: [],
            team1Tricks: newTeam1Tricks,
            team2Tricks: newTeam2Tricks,
            currentPlayer: trickWinner,
            firstPlayerOfTrick: trickWinner
          };
        }
      }
      
      // Henüz 4 kart atılmadıysa sıradaki oyuncuya geç
      return {
        ...state,
        players: newPlayersState,
        playedCards: newPlayedCards,
        currentPlayer: (state.currentPlayer + 1) % 4
      };

    case actionTypes.END_TRICK:
      // El kazananını belirle ve yeni eli başlat
      const trickWinner = determineTrickWinner(state.playedCards, state.trumpSuit);
      if (trickWinner !== null) {
        return {
          ...state,
          playedCards: [],
          currentPlayer: trickWinner,
          firstPlayerOfTrick: trickWinner
        };
      }
      return state;

    case actionTypes.SORDUM:
      return {
        ...state,
        sordumKonusMode: true,
        sordumPlayer: state.auctionCurrent,
        auctionTurns: state.auctionTurns + 1,
        auctionCurrent: (state.auctionCurrent + 1) % 4
      };

    case actionTypes.KONUS:
      if (state.auctionCurrent === 2 && !state.sordumKonusMode) {
        // 3. oyuncu direkt konuş diyor
        return {
          ...state,
          auctionTurns: state.auctionTurns + 1,
          auctionCurrent: (state.auctionCurrent + 1) % 4
        };
      } else if (state.sordumKonusMode) {
        // Sordum/Konuş modunda: Konuş sonrası sıra önceki oyuncuya döner
        // VE ihale Konuş diyen oyuncuya 150'ye kalır
        return {
          ...state,
          konusPlayer: state.auctionCurrent,
          auctionCurrent: (state.auctionCurrent - 1 + 4) % 4,
          auctionBids: state.auctionBids.map((bid, index) => 
            index === state.auctionCurrent ? 150 : bid
          ),
          auctionHighestBid: Math.max(state.auctionHighestBid, 150)
        };
      }
      return state;

    case actionTypes.BOZ:
      if (state.auctionCurrent !== 3 || !state.sordumKonusMode) return state;
      
      // Boz sayısını artır
      const newConsecutiveBozCount = state.consecutiveBozCount + 1;
      let newCurrentDealer = state.currentDealer;
      
      // 3 kez ard arda boz olduysa dağıtıcı değişir
      if (newConsecutiveBozCount >= 3) {
        newCurrentDealer = (state.currentDealer + 1) % 4;
      }
      
      // Yeni kartlar dağıt
      const bozDeck = createDeck();
      const shuffledBozDeck = shuffle(bozDeck);
      const bozPlayers = dealCards(shuffledBozDeck);
      
      return {
        ...initialState,
        roundNumber: state.roundNumber,
        players: bozPlayers,
        currentDealer: newCurrentDealer,
        consecutiveBozCount: newConsecutiveBozCount >= 3 ? 0 : newConsecutiveBozCount,
        cumulativeTeam1Score: state.cumulativeTeam1Score,
        cumulativeTeam2Score: state.cumulativeTeam2Score,
        isBoz: true, // Boz durumunu aktif et
        gamePhase: 'waiting' // Boz sonrası bekleme fazına geç
      };

    case actionTypes.END_ROUND:
      return {
        ...state,
        roundNumber: state.roundNumber >= 4 ? 1 : state.roundNumber + 1,
        trumpSuit: null,
        currentPlayer: null,
        consecutiveBozCount: 0, // Normal el oynandığında boz sayısını sıfırla
        currentDealer: (state.currentDealer + 1) % 4, // Dağıtıcı sırasını değiştir
        isBoz: false, // Boz durumunu devre dışı bırak
        gamePhase: 'waiting' // Normal el sonrası bekleme fazına geç
      };

    case actionTypes.RESET_GAME:
      return {
        ...initialState,
        roundNumber: 1
      };

    case actionTypes.SET_PLAYER_NAMES:
      return {
        ...state,
        playerNames: action.payload.playerNames
      };

    case actionTypes.SET_MULTIPLAYER_MODE:
      return {
        ...state,
        isMultiplayer: action.payload.isMultiplayer
      };

    case actionTypes.SET_MULTIPLAYER_CARDS:
      console.log('🔄 SET_MULTIPLAYER_CARDS action tetiklendi:', {
        allPlayerCards: action.payload.allPlayerCards,
        players: action.payload.players,
        gameState: action.payload.gameState,
        payload: action.payload
      });
      
      const newState = {
        ...state,
        players: action.payload.cards && action.payload.playerIndex !== null
          ? [0, 1, 2, 3].map((index) => index === action.payload.playerIndex ? action.payload.cards : [])
          : (action.payload.allPlayerCards || action.payload.players || state.players),
        multiplayerCards: action.payload.cards,
        multiplayerPlayerIndex: action.payload.playerIndex !== null ? action.payload.playerIndex : state.multiplayerPlayerIndex, // Null ise mevcut değeri koru
        currentDealer: action.payload.gameState?.currentDealer || state.currentDealer, // Dağıtıcıyı set et
        currentPlayer: action.payload.gameState?.currentPlayer !== undefined ? action.payload.gameState.currentPlayer : state.currentPlayer, // 0 değeri için explicit check
        auctionCurrent: action.payload.gameState?.auctionCurrent || state.auctionCurrent, // İhale sırasını set et
        auctionBids: Array.isArray(action.payload.gameState?.auctionBids) ? action.payload.gameState.auctionBids : state.auctionBids,
        auctionPasses: Array.isArray(action.payload.gameState?.auctionPasses) ? action.payload.gameState.auctionPasses : state.auctionPasses,
        auctionHighestBid: action.payload.gameState?.auctionHighestBid || state.auctionHighestBid,
        auctionWinner: action.payload.gameState?.auctionWinner || state.auctionWinner,
        sordumKonusMode: action.payload.gameState?.sordumKonusMode || state.sordumKonusMode,
        sordumPlayer: action.payload.sordumPlayer !== undefined ? action.payload.sordumPlayer : state.sordumPlayer,
        konusPlayer: action.payload.konusPlayer !== undefined ? action.payload.konusPlayer : state.konusPlayer,
        gameStarted: action.payload.gameState?.gameStarted !== undefined ? action.payload.gameState.gameStarted : state.gameStarted,
        gamePhase: action.payload.gameState?.gamePhase || state.gamePhase, // Oyun fazını senkronize et
        isBoz: action.payload.gameState?.isBoz || state.isBoz, // Boz durumunu senkronize et
        playedCards: action.payload.gameState?.playedCards || state.playedCards, // Oynanan kartları senkronize et
        trumpSuit: action.payload.gameState?.trumpSuit || state.trumpSuit,
        handSizes: action.payload.gameState?.handSizes || state.handSizes
      };
      
      console.log('🔄 SET_MULTIPLAYER_CARDS sonrası yeni state:', {
        players: newState.players,
        currentPlayer: newState.currentPlayer,
        playedCards: newState.playedCards,
        playersLength: newState.players?.map(p => p?.length || 0),
        multiplayerPlayerIndex: newState.multiplayerPlayerIndex,
        oldMultiplayerPlayerIndex: state.multiplayerPlayerIndex
      });
      
      return newState;

    case actionTypes.SET_MULTIPLAYER_PLAYER_INDEX:
      return {
        ...state,
        multiplayerPlayerIndex: action.payload.playerIndex
      };

    case actionTypes.SET_GAME_STARTED:
      return {
        ...state,
        gameStarted: action.payload.gameStarted
      };

    case actionTypes.SET_GAME_PHASE:
      return {
        ...state,
        gamePhase: action.payload.gamePhase
      };

    case actionTypes.SET_IS_BOZ:
      return {
        ...state,
        isBoz: action.payload.isBoz
      };

    case actionTypes.SET_AUCTION_BIDS:
      const auctionState = {
        ...state,
        auctionBids: action.payload.auctionBids || state.auctionBids,
        auctionPasses: action.payload.auctionPasses || state.auctionPasses,
        auctionHighestBid: action.payload.auctionHighestBid || state.auctionHighestBid,
        auctionWinner: action.payload.auctionWinner !== undefined ? action.payload.auctionWinner : state.auctionWinner,
        auctionCurrent: action.payload.auctionCurrent || state.auctionCurrent,
        auctionActive: action.payload.auctionActive !== undefined ? action.payload.auctionActive : state.auctionActive,
        // Sordum/Konuş modu durumunu da güncelle
        sordumKonusMode: action.payload.sordumKonusMode !== undefined ? action.payload.sordumKonusMode : state.sordumKonusMode,
        sordumPlayer: action.payload.sordumPlayer !== undefined ? action.payload.sordumPlayer : state.sordumPlayer,
        konusPlayer: action.payload.konusPlayer !== undefined ? action.payload.konusPlayer : state.konusPlayer
      };
      
      // Eğer auctionWinner varsa ve gamePhase auction ise, trumpSelection'a geç
      if (auctionState.auctionWinner !== null && auctionState.auctionWinner !== undefined && 
          auctionState.gamePhase === 'auction' && !auctionState.isBoz) {
        auctionState.gamePhase = 'trumpSelection';
        console.log('�?� SET_AUCTION_BIDS: auctionWinner var, gamePhase trumpSelection olarak güncellendi');
      }
      
      return auctionState;

    case actionTypes.SET_ROUND_END:
      return {
        ...state,
        roundEnded: true,
        roundNumber: action.payload.roundNumber || state.roundNumber,
        roundTeam1Score: action.payload.roundTeam1Score || 0,
        roundTeam2Score: action.payload.roundTeam2Score || 0,
        cumulativeTeam1Score: action.payload.cumulativeTeam1Score || state.cumulativeTeam1Score,
        cumulativeTeam2Score: action.payload.cumulativeTeam2Score || state.cumulativeTeam2Score,
        kabbut: action.payload.kabbut || false,
        oyunBatti: action.payload.oyunBatti || false,
        gameWinner: action.payload.gameWinner || null
      };

    case actionTypes.RESET_ROUND_END:
      return {
        ...state,
        roundEnded: false,
        roundTeam1Score: 0,
        roundTeam2Score: 0,
        kabbut: false,
        oyunBatti: false
      };

    case actionTypes.CALCULATE_SCORES:
      const endGameResults = calculateEndGameScores({
        team1Tricks: state.team1Tricks,
        team2Tricks: state.team2Tricks,
        cumulativeTeam1Score: state.cumulativeTeam1Score,
        cumulativeTeam2Score: state.cumulativeTeam2Score
      });
      
      return {
        ...state,
        cumulativeTeam1Score: endGameResults.newCumulativeTeam1Score,
        cumulativeTeam2Score: endGameResults.newCumulativeTeam2Score,
        gameEnded: endGameResults.oyunBatti,
        gameWinner: endGameResults.gameWinner
      };

    default:
      return state;
  }
}

// Provider component
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Oyun durumu değişikliklerini takip et
  useEffect(() => {
    // Oyun fazı değişikliklerini sessizce takip et
  }, [state.gameStarted, state.auctionActive, state.auctionCurrent, state.gamePhase]);

  // Oyun sonu kontrolü
  useEffect(() => {
    // Oyun sonu durumunu sessizce takip et
  }, [state.gameEnded, state.gameWinner]);

  const actions = useMemo(() => ({
    dealCards: () => dispatch({ type: actionTypes.DEAL_CARDS }),
    startAuction: () => dispatch({ type: actionTypes.START_AUCTION }),
    placeBid: (bid) => dispatch({ type: actionTypes.PLACE_BID, payload: { bid } }),
    passBid: () => dispatch({ type: actionTypes.PASS_BID }),
    sordum: () => dispatch({ type: actionTypes.SORDUM }),
    konus: () => dispatch({ type: actionTypes.KONUS }),
    boz: () => dispatch({ type: actionTypes.BOZ }),
    selectTrump: (suit) => dispatch({ type: actionTypes.SELECT_TRUMP, payload: { suit } }),
    playCard: (playerIndex, card) => dispatch({ type: actionTypes.PLAY_CARD, payload: { playerIndex, card } }),
    endTrick: () => dispatch({ type: actionTypes.END_TRICK }),
    endRound: () => dispatch({ type: actionTypes.END_ROUND }),
    calculateScores: () => dispatch({ type: actionTypes.CALCULATE_SCORES }),
    endGame: () => dispatch({ type: actionTypes.END_GAME }),
    resetGame: () => dispatch({ type: actionTypes.RESET_GAME }),
    setPlayerNames: (playerNames) => dispatch({ type: actionTypes.SET_PLAYER_NAMES, payload: { playerNames } }),
    setMultiplayerMode: (isMultiplayer) => dispatch({ type: actionTypes.SET_MULTIPLAYER_MODE, payload: { isMultiplayer } }),
    setMultiplayerCards: (cards, playerIndex, players, gameState) => dispatch({ type: actionTypes.SET_MULTIPLAYER_CARDS, payload: { cards, playerIndex, players, gameState } }),
    setMultiplayerPlayerIndex: (playerIndex) => dispatch({ type: actionTypes.SET_MULTIPLAYER_PLAYER_INDEX, payload: { playerIndex } }),
    setGameStarted: (gameStarted) => dispatch({ type: actionTypes.SET_GAME_STARTED, payload: { gameStarted } }),
    setGamePhase: (gamePhase) => dispatch({ type: actionTypes.SET_GAME_PHASE, payload: { gamePhase } }),
    setIsBoz: (isBoz) => dispatch({ type: actionTypes.SET_IS_BOZ, payload: { isBoz } }),
    setAuctionBids: (auctionBids, auctionPasses, auctionHighestBid, auctionWinner, auctionCurrent, auctionActive, sordumKonusMode, sordumPlayer, konusPlayer) => dispatch({ type: actionTypes.SET_AUCTION_BIDS, payload: { auctionBids, auctionPasses, auctionHighestBid, auctionWinner, auctionCurrent, auctionActive, sordumKonusMode, sordumPlayer, konusPlayer } }),
    setRoundEnd: (roundData) => dispatch({ type: actionTypes.SET_ROUND_END, payload: roundData }),
    resetRoundEnd: () => dispatch({ type: actionTypes.RESET_ROUND_END })
  }), [dispatch]);

  const value = {
    state,
    dispatch,
    actions,
    // Utility functions
    utils: {
      getPlayerNumberFromIndex: (index) => getPlayerNumberFromIndex(index, state.playerIndexMapping),
      getAllowedCards: (playerIndex) => getAllowedCards(state.players[playerIndex], state.playedCards, state.trumpSuit),
      sortPlayerCards: (cards) => sortPlayerCards(cards),
      getSuitClass: (suit) => suitClass[suit] || '',
      rankOrder,
      suitOrder
    }
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Custom hook
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}


