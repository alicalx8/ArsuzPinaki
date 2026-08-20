const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Game rooms storage
const gameRooms = new Map();
const playerSockets = new Map();
const ROOM_STORE_KEY = 'pinaki:rooms:v1';
let redis = null;

async function restoreRooms() {
  if (!redis) return;
  const savedRooms = await redis.get(ROOM_STORE_KEY);
  if (!savedRooms) return;
  for (const room of JSON.parse(savedRooms)) {
    room.players = room.players.map((player) => ({ ...player, socketId: null, id: null, ready: false }));
    gameRooms.set(room.id, room);
  }
  console.log(`Restored ${gameRooms.size} room(s) from Redis.`);
}

function persistRooms() {
  if (!redis) return;
  redis.set(ROOM_STORE_KEY, JSON.stringify([...gameRooms.values()])).catch((error) => {
    console.error('Redis room persistence failed:', error.message);
  });
}

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
  const subscriber = redis.duplicate();
  io.adapter(createAdapter(redis, subscriber));
  redis.on('error', (error) => console.error('Redis error:', error.message));
}

const VALID_SUITS = new Set(['♥', '♠', '♦', '♣']);

function getRoomPlayer(room, socketId) {
  return room?.players.find((player) => player.socketId === socketId) || null;
}

function reject(socket, message) {
  socket.emit('error', { message });
  return false;
}

function requireRoomPlayer(socket, roomId) {
  const room = gameRooms.get(roomId);
  const player = getRoomPlayer(room, socket.id);
  if (!room || !player) {
    reject(socket, 'Bu oda için yetkiniz yok.');
    return null;
  }
  return { room, player };
}

// Shared game state never contains cards. Every socket gets only its own hand.
function publicGameState(gameState) {
  if (!gameState) return gameState;
  const { playerCards, ...publicState } = gameState;
  return {
    ...publicState,
    handSizes: Array.isArray(playerCards) ? playerCards.map((hand) => hand.length) : [0, 0, 0, 0]
  };
}

function emitGameState(room, event, extra = {}) {
  room.players.forEach((player) => {
    io.to(player.socketId).emit(event, {
      ...extra,
      gameState: publicGameState(room.gameState),
      playerIndex: player.position,
      cards: room.gameState?.playerCards?.[player.position] || []
    });
  });
}

// Yardımcı fonksiyonlar
function createDeck() {
  const suits = ['♥', '♠', '♦', '♣']; // script.js ile aynı sıra
  const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  // 48 kartlık deste (her karttan iki tane)
  for (let d = 0; d < 2; d++) { // iki deste
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }
  
  return deck;
}

function shuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dealCards(deck) {
  const players = [[], [], [], []];
  let cardIndex = 0;
  
  // 4 oyuncuya 4'erli gruplar halinde 12'şer kart dağıt
  for (let round = 0; round < 3; round++) { // 3 turda 4'er kart
    for (let p = 0; p < 4; p++) {
      for (let k = 0; k < 4; k++) {
        players[p].push(deck[cardIndex++]);
      }
    }
  }
  
  return players;
}

function determineAuctionWinner(bids) {
  let highestBid = 0;
  let winner = null; // Initialize winner as null

  // Array formatında kontrol et
  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    if (bid !== null && bid !== 'PASS' && bid > highestBid) {
      highestBid = bid;
      winner = i;
    }
  }
  
  // Hiç teklif verilmemişse boz durumu
  if (winner === null) {
    return { winner: null, highestBid: 0, isBoz: true };
  }
  
  return { winner, highestBid, isBoz: false };
}

function determineTrickWinner(playedCards, trumpSuit) {
  if (!playedCards || playedCards.length !== 4) {
    return 0;
  }
  
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
      // Düşük index = yüksek rank (A=0, 9=5)
      if (getCardRank(c) < getCardRank(bestCard)) {
        bestIdx = i;
        bestCard = c;
      }
    }
  }
  
  const winner = playedCards[bestIdx].player;
  console.log(`�?� El kazananı belirlendi: Oyuncu ${winner}, En yüksek kart: ${bestCard.rank}${bestCard.suit}, Koz var: ${trumpSuit ? 'Evet' : 'Hayır'}`);
  return winner;
}

// Kart büyüklük sırası (A > 10 > K > Q > J > 9)
const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
const suitOrder = ['♥', '♠', '♦', '♣'];

function getCardRank(card) {
  return rankOrder.indexOf(card.rank);
}

function calculateEndGameScores(gameState) {
  // Basit skor hesaplama - gerçek oyunda daha karmaşık olacak
  const scores = [0, 0, 0, 0];
  
  // Her el için 10 puan
  scores[0] = gameState.team1Tricks * 10;
  scores[1] = gameState.team1Tricks * 10;
  scores[2] = gameState.team2Tricks * 10;
  scores[3] = gameState.team2Tricks * 10;
  
  return scores;
}

// WebSocket event handlers
io.on('connection', (socket) => {
  console.log(`Oyuncu bağlandı: ${socket.id}`);

  // Oyuncu odaya katılma
  socket.on('joinRoom', (data) => {
    const { roomId, username } = data;
    
    if (!username || username.trim() === '') {
      socket.emit('joinRoomError', { message: 'Kullanıcı adı gerekli!' });
      return;
    }
    
    if (!gameRooms.has(roomId)) {
      socket.emit('joinRoomError', { message: 'Oda bulunamadı!' });
      return;
    }
    
    const room = gameRooms.get(roomId);
    
    // Redis'ten geri yüklenen oyuncu aynı kullanıcı adıyla koltuğuna dönebilir.
    const existingPlayer = room.players.find(p => p.username === username.trim());
    if (existingPlayer) {
      if (existingPlayer.socketId) {
        socket.emit('joinRoomError', { message: 'Bu kullanıcı adı zaten odada kullanılıyor!' });
        return;
      }
      existingPlayer.id = socket.id;
      existingPlayer.socketId = socket.id;
      existingPlayer.ready = false;
      playerSockets.set(socket.id, { roomId, player: existingPlayer });
      socket.join(roomId);
      io.to(roomId).emit('roomUpdate', { roomId, room, message: `${existingPlayer.username} odaya yeniden bağlandı!` });
      socket.emit('joinRoomSuccess', { roomId, room, message: 'Odaya yeniden bağlandınız!' });
      persistRooms();
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('joinRoomError', { message: 'Oda dolu!' });
      return;
    }
    
    // Oyuncuyu odaya ekle
    const player = {
      id: socket.id,
      username: username.trim(),
      socketId: socket.id,
      ready: false,
      position: room.players.length
    };
    
    room.players.push(player);
    playerSockets.set(socket.id, { roomId, player });
    
    // Odaya katıl
    socket.join(roomId);
    
    // Odadaki tüm oyunculara güncel durumu gönder
    io.to(roomId).emit('roomUpdate', {
      roomId: roomId,
      room: room,
      message: `${player.username} odaya katıldı!`
    });
    
    // Katılan oyuncuya başarı mesajı gönder
    socket.emit('joinRoomSuccess', { roomId, room, message: 'Odaya başarıyla katıldınız!' });
    
    // Oda listesini güncelle
    const roomsList = Array.from(gameRooms.values()).map(room => ({
      id: room.id,
      players: room.players,
      status: room.status,
      createdAt: room.createdAt,
      createdBy: room.createdBy
    }));
    io.emit('roomsList', roomsList);
    
    console.log(`${player.username} ${roomId} odasına katıldı`);
  });

  // Oyuncu hazır olma durumu
  socket.on('playerReady', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.ready = true;
        
        // Tüm oyuncular hazır mı kontrol et
        const allReady = room.players.length === 4 && room.players.every(p => p.ready);
        
        if (allReady) {
          room.status = 'ready';
          io.to(roomId).emit('gameReady', { message: 'Tüm oyuncular hazır! Oyun başlayabilir.' });
        }
        
        io.to(roomId).emit('roomUpdate', { roomId: roomId, room: room });
      }
    }
  });

  // Oyun başlatma
  socket.on('startGame', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (room && room.players.length >= 2) {
      if (room.players.length !== 4) { reject(socket, 'Oyun için dört oyuncu gerekli.'); return; }
      if (room.createdBy !== getRoomPlayer(room, socket.id)?.username) { reject(socket, 'Oyunu yaln�zca oda sahibi ba�latabilir.'); return; } // En az 2 oyuncu olmalı
      room.status = 'playing';
      
      // Dağıtıcıyı belirle (Oyuncu 4 - index 3)
      const dealerIndex = 3;
      const initialDealer = room.players[dealerIndex];
      
      if (!initialDealer) {
        socket.emit('error', { message: 'Dağıtıcı bulunamadı!' });
        return;
      }
      
      // Oyun durumunu başlat (kartlar henüz dağıtılmadı)
      room.gameState = {
        roundNumber: 1,
        currentDealer: 3, // Oyuncu 4 (index 3) dağıtıcı
        dealerUsername: room.players[3].username, // Dağıtıcının kullanıcı adı
        gamePhase: 'waiting', // waiting -> auction -> playing -> ended
        auctionActive: false,
        trumpSuit: null,
        currentPlayer: null, // Kartlar dağıtılmadan önce null olmalı
        playerCards: null, // Kartlar henüz dağıtılmadı
        playedCards: [],
        auctionBids: {},
        auctionPasses: {},
        auctionHighestBid: 0,
        auctionWinner: null,
        team1Tricks: 0,
        team2Tricks: 0,
        gameScores: [0, 0, 0, 0],
        cumulativeTeamScores: [0, 0],
        canDealCards: false, // Kart dağıtma yetkisi kontrolü
        auctionCurrent: 0 // İhale sırasını takip etmek için
      };
      
      // Boş kart array'i oluştur (henüz kartlar dağıtılmadı)
      const emptyPlayerCards = [[], [], [], []];
      
      // Her oyuncuya kendi index'i ile birlikte gameStarted mesajı gönder
      room.players.forEach((player, playerIndex) => {
        if (player.socketId) {
          console.log(`📤 Oyuncu ${playerIndex} (${player.username}) için gameStarted gönderiliyor`);
          io.to(player.socketId).emit('gameStarted', { 
            room: room,
            gameState: publicGameState(room.gameState),
            playerIndex: playerIndex, // Her oyuncunun kendi index'i
            message: 'Oyun başladı! Dağıtıcı kartları dağıtabilir.'
          });
        }
      });
      
      // Oyun başladıktan sonra güncel oda durumunu gönder
      io.to(roomId).emit('roomUpdate', { 
        roomId: roomId,
        room: room,
        message: 'Oyun başladı!'
      });
      
      // Dağıtıcıya kart dağıtma yetkisi ver
      room.gameState.canDealCards = true;
      
      // Dağıtıcıya özel mesaj gönder
      const currentDealerPlayer = room.players.find(p => p.position === room.gameState.currentDealer);
      if (currentDealerPlayer) {
        io.to(currentDealerPlayer.socketId).emit('dealerTurn', {
          message: 'Sıra sizde! Kartları dağıtabilirsiniz.',
          gameState: room.gameState
        });
      }
    }
  });

  // Kartları dağıtma
  socket.on('dealCards', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (room && room.gameState) {
      if (room.gameState.gamePhase !== 'waiting' || !room.gameState.canDealCards) { reject(socket, 'Kartlar şu anda dağıtılamaz.'); return; }
      // Sadece dağıtıcı kartları dağıtabilir
      const currentPlayer = room.players.find(p => p.socketId === socket.id);
      if (!currentPlayer || currentPlayer.position !== room.gameState.currentDealer) {
        socket.emit('error', { message: 'Sadece dağıtıcı kartları dağıtabilir!' });
        return;
      }
      
      // Kartları dağıt
      const deck = createDeck();
      const shuffledDeck = shuffle(deck);
      const playerCards = dealCards(shuffledDeck);
      
      // Oyun durumunu güncelle
      room.gameState.playerCards = playerCards;
      room.gameState.canDealCards = false; // Kart dağıtma yetkisini kapat
      
      // Her oyuncuya kartlarını gönder
      room.players.forEach((player, index) => {
        console.log(`📤 Oyuncu ${index} (${player.username}) için dealCards gönderiliyor`);
        io.to(player.socketId).emit('dealCards', {
          cards: playerCards[index],
          playerIndex: index,
          gameState: publicGameState(room.gameState),
        });
      });
      
      // Her oyuncuya kartların dağıtıldığını bildir
      room.players.forEach((player, playerIndex) => {
        if (player.socketId) {
          console.log(`📤 Oyuncu ${playerIndex} (${player.username}) için cardsDealt gönderiliyor`);
          io.to(player.socketId).emit('cardsDealt', {
            gameState: publicGameState(room.gameState),
            playerIndex: playerIndex,
            message: 'Kartlar dağıtıldı!'
          });
        }
      });
      
      // İhaleyi otomatik başlat
      room.gameState.gamePhase = 'auction';
      room.gameState.auctionActive = true;
      room.gameState.auctionCurrent = (room.gameState.currentDealer + 1) % 4; // Dağıtıcıdan sonraki oyuncu
      room.gameState.auctionBids = [null, null, null, null];
      room.gameState.auctionPasses = [false, false, false, false];
      room.gameState.auctionHighestBid = 0;
      
      // İhale başladı mesajı gönder
      console.log(`🚀 İhale başlatılıyor - Oda: ${roomId}, Sıra: ${room.players[room.gameState.auctionCurrent].username}`);
      console.log(`📊 GameState:`, room.gameState);
      console.log(`�?� allPlayerCards:`, room.gameState.playerCards);
      
      // Her oyuncuya kendi index'i ile birlikte özel mesaj gönder
      room.players.forEach((player, playerIndex) => {
        if (player.socketId) {
          console.log(`📤 Oyuncu ${playerIndex} (${player.username}) için auctionStarted gönderiliyor`);
          io.to(player.socketId).emit('auctionStarted', {
            gameState: publicGameState(room.gameState),
            playerIndex: playerIndex, // Her oyuncunun kendi index'i
            playerCards: room.gameState.playerCards[playerIndex], // Sadece kendi kartları
            message: `İhale başladı! Sıra: ${room.players[room.gameState.auctionCurrent].username}`
          });
        }
      });
      
      console.log(`✅ auctionStarted event'i tüm oyunculara gönderildi`);
      
      // Dağıtıcı sırasını güncelle (bir sonraki round için)
      room.gameState.currentDealer = (room.gameState.currentDealer + 1) % 4;
    }
  });

  // İhale teklifi
  socket.on('placeBid', (data) => {
    const { roomId, bidAmount } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;
    
    console.log(`�?� placeBid event'i alındı:`, { roomId, bidAmount, playerIndex });
    
    if (room && room.gameState) {
      if (room.gameState.gamePhase !== 'auction' || room.gameState.auctionCurrent !== playerIndex) { reject(socket, 'Sıra sizde değil.'); return; }
      if (!Number.isInteger(bidAmount) || bidAmount < 150 || bidAmount % 10 !== 0 || bidAmount <= room.gameState.auctionHighestBid) { reject(socket, 'Geçersiz teklif.'); return; }
      console.log(`📊 Önceki auctionCurrent: ${room.gameState.auctionCurrent}`);
      
      // İhale durumunu başlat (eğer başlamamışsa)
      if (!room.gameState.auctionActive) {
        room.gameState.auctionActive = true;
        room.gameState.auctionCurrent = 0; // İlk oyuncudan başla
        room.gameState.auctionBids = [null, null, null, null];
        room.gameState.auctionPasses = [false, false, false, false];
        room.gameState.auctionHighestBid = 0;
        room.gameState.auctionWinner = null;
        room.gameState.sordumKonusMode = false;
        room.gameState.sordumPlayer = null;
        room.gameState.konusPlayer = null;
      }
      
      room.gameState.auctionBids[playerIndex] = bidAmount;
      room.gameState.auctionPasses[playerIndex] = false;
      room.gameState.auctionHighestBid = Math.max(room.gameState.auctionHighestBid, bidAmount);
      
      // Sonraki oyuncuya geç
      room.gameState.auctionCurrent = (playerIndex + 1) % 4;
      
      console.log(`🔄 Sonraki oyuncuya geçildi: ${room.gameState.auctionCurrent}`);
      console.log(`📊 Güncel gameState:`, room.gameState);
      
      // Tüm oyunculara güncel durumu gönder
      console.log(`📤 auctionUpdate event'i gönderiliyor...`);
      io.to(roomId).emit('auctionUpdate', {
        gameState: publicGameState(room.gameState),
        playerIndex: room.gameState.auctionCurrent, // Sıradaki oyuncunun index'ini gönder
        message: `${room.players[playerIndex].username} teklif verdi: ${bidAmount}`
      });
      console.log(`✅ auctionUpdate event'i gönderildi`);
      
      // İhale tamamlandı mı kontrol et (4 oyuncu da teklif verdi veya pas geçti)
      const totalActions = room.gameState.auctionBids.filter(bid => bid !== null).length;
      console.log(`�? İhale kontrolü: totalActions = ${totalActions}, auctionBids = ${room.gameState.auctionBids}`);
      if (totalActions === 4) {
        console.log(`✅ İhale tamamlandı! 4 oyuncu da işlem yaptı`);
        const auctionResult = determineAuctionWinner(room.gameState.auctionBids);
        console.log(`�?� Auction result:`, auctionResult);
        room.gameState.auctionWinner = auctionResult.winner;
        room.gameState.auctionHighestBid = auctionResult.highestBid;
        room.gameState.auctionActive = false;
        
        if (auctionResult.isBoz) {
          // Tüm oyuncular pas geçti - Boz durumu
          room.gameState.auctionWinner = room.gameState.currentDealer; // Dağıtıcı alır
          room.gameState.auctionHighestBid = 150; // 150 puan
          room.gameState.currentPlayer = room.gameState.currentDealer; // Dağıtıcı başlar
          room.gameState.gamePhase = 'playing'; // Oyun fazına geç
          
          console.log(`�?� İhale tamamlandı! BOZ oldu. Dağıtıcı (${room.players[room.gameState.currentDealer].username}) 150'ye aldı.`);
          io.to(roomId).emit('auctionEnded', {
            gameState: publicGameState(room.gameState),
            winner: room.gameState.currentDealer,
            winnerUsername: room.players[room.gameState.currentDealer].username,
            highestBid: 150,
            isBoz: true,
            message: `Tüm oyuncular pas geçti. İhaleyi dağıtıcı ${room.players[room.gameState.currentDealer].username} 150'ye aldı!`
          });
        } else {
          // Normal ihale kazananı
          room.gameState.currentPlayer = auctionResult.winner; // İhale kazananı ilk kartı atacak
          room.gameState.gamePhase = 'trumpSelection'; // Koz seçim fazına geç
          
          console.log(`�?� İhale tamamlandı! Kazanan: ${room.players[auctionResult.winner].username} (${auctionResult.winner})`);
          console.log(`📤 auctionEnded event'i gönderiliyor... Room ID: ${roomId}`);
          io.to(roomId).emit('auctionEnded', {
            gameState: publicGameState(room.gameState),
            winner: auctionResult.winner,
            winnerUsername: room.players[auctionResult.winner].username,
            highestBid: auctionResult.highestBid,
            isBoz: false,
            message: `İhale kazananı: ${room.players[auctionResult.winner].username} (${auctionResult.highestBid} puan)`
          });
          console.log(`✅ auctionEnded event'i gönderildi`);
        }
      }
    } else {
      console.log(`�?� Room veya gameState bulunamadı:`, { room: !!room, gameState: !!(room && room.gameState) });
    }
  });

  // İhale pas
  socket.on('passBid', (data) => {
    const { roomId } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;
    
    console.log(`🚫 passBid event'i alındı:`, { roomId, playerIndex });
    
    if (room && room.gameState) {
      if (room.gameState.gamePhase !== 'auction' || room.gameState.auctionCurrent !== playerIndex) { reject(socket, 'Sıra sizde değil.'); return; }
      console.log(`📊 Önceki auctionCurrent: ${room.gameState.auctionCurrent}`);
      
      // İhale durumunu başlat (eğer başlamamışsa)
      if (!room.gameState.auctionActive) {
        room.gameState.auctionActive = true;
        room.gameState.auctionCurrent = 0; // İlk oyuncudan başla
        room.gameState.auctionBids = [null, null, null, null];
        room.gameState.auctionPasses = [false, false, false, false];
        room.gameState.auctionHighestBid = 0;
        room.gameState.auctionWinner = null;
        room.gameState.sordumKonusMode = false;
        room.gameState.sordumPlayer = null;
        room.gameState.konusPlayer = null;
      }
      
      room.gameState.auctionPasses[playerIndex] = true;
      room.gameState.auctionBids[playerIndex] = 'PASS';
      
      // Sordum/Konuş modunda özel kontrol
      console.log(`�? Sordum/Konuş kontrolü:`, {
        sordumKonusMode: room.gameState.sordumKonusMode,
        konusPlayer: room.gameState.konusPlayer,
        playerIndex: playerIndex,
        auctionCurrent: room.gameState.auctionCurrent
      });
      
      if (room.gameState.sordumKonusMode && room.gameState.konusPlayer !== null) {
        // Konuş sonrası önceki oyuncu pas dedi - ihale Konuş diyen oyuncuya 150'ye kalır
        console.log(`�?� Sordum/Konuş modunda önceki oyuncu pas dedi! İhale ${room.players[room.gameState.konusPlayer].username}ya 150'ye kaldı.`);
        
        room.gameState.auctionWinner = room.gameState.konusPlayer;
        room.gameState.auctionHighestBid = Math.max(room.gameState.auctionHighestBid, 150);
        room.gameState.auctionActive = false; // İhale bitti
        room.gameState.sordumKonusMode = false;
        room.gameState.currentPlayer = room.gameState.konusPlayer; // Konuş diyen oyuncu koz seçecek
        room.gameState.gamePhase = 'trumpSelection'; // Koz seçim fazına geç
        
        // Tüm oyunculara ihale sonucunu gönder
        console.log(`📤 auctionEnded event'i gönderiliyor (Sordum/Konuş sonrası)...`);
        io.to(roomId).emit('auctionEnded', {
          gameState: {
            ...room.gameState,
            sordumKonusMode: false,
            sordumPlayer: null,
            konusPlayer: null
          },
          winner: room.gameState.konusPlayer,
          winnerUsername: room.players[room.gameState.konusPlayer].username,
          highestBid: 150,
          isBoz: false,
          message: `Sordum/Konuş sonrası önceki oyuncu pas geçti. İhaleyi ${room.players[room.gameState.konusPlayer].username} 150'ye aldı!`
        });
        console.log(`✅ auctionEnded event'i gönderildi`);
        return; // İşlemi sonlandır
      }
      
      // Sonraki oyuncuya geç
      room.gameState.auctionCurrent = (playerIndex + 1) % 4;
      
      console.log(`🔄 Sonraki oyuncuya geçildi: ${room.gameState.auctionCurrent}`);
      console.log(`📊 Güncel gameState:`, room.gameState);
      
      // Tüm oyunculara güncel durumu gönder
      console.log(`📤 auctionUpdate event'i gönderiliyor...`);
      io.to(roomId).emit('auctionUpdate', {
        gameState: publicGameState(room.gameState),
        playerIndex: room.gameState.auctionCurrent, // Sıradaki oyuncunun index'ini gönder
        message: `${room.players[playerIndex].username} pas geçti`
      });
      console.log(`✅ auctionUpdate event'i gönderildi`);
      
      // İhale tamamlandı mı kontrol et (4 oyuncu da teklif verdi veya pas geçti)
      const totalActions = room.gameState.auctionBids.filter(bid => bid !== null).length;
      console.log(`�? İhale kontrolü: totalActions = ${totalActions}, auctionBids = ${room.gameState.auctionBids}`);
      if (totalActions === 4) {
        console.log(`✅ İhale tamamlandı! 4 oyuncu da işlem yaptı`);
        const auctionResult = determineAuctionWinner(room.gameState.auctionBids);
        console.log(`�?� Auction result:`, auctionResult);
        room.gameState.auctionWinner = auctionResult.winner;
        room.gameState.auctionHighestBid = auctionResult.highestBid;
        room.gameState.auctionActive = false;
        
        if (auctionResult.isBoz) {
          // Tüm oyuncular pas geçti - Boz durumu
          room.gameState.auctionWinner = room.gameState.currentDealer; // Dağıtıcı alır
          room.gameState.auctionHighestBid = 150; // 150 puan
          room.gameState.currentPlayer = room.gameState.currentDealer; // Dağıtıcı başlar
          room.gameState.gamePhase = 'playing'; // Oyun fazına geç
          
          console.log(`�?� İhale tamamlandı! BOZ oldu. Dağıtıcı (${room.players[room.gameState.currentDealer].username}) 150'ye aldı.`);
          io.to(roomId).emit('auctionEnded', {
            gameState: {
              ...room.gameState,
              sordumKonusMode: false,
              sordumPlayer: null,
              konusPlayer: null
            },
            winner: room.gameState.currentDealer,
            winnerUsername: room.players[room.gameState.currentDealer].username,
            highestBid: 150,
            isBoz: true,
            message: `Tüm oyuncular pas geçti. İhaleyi dağıtıcı ${room.players[room.gameState.currentDealer].username} 150'ye aldı!`
          });
        } else {
          // Normal ihale kazananı
          room.gameState.currentPlayer = auctionResult.winner; // İhale kazananı ilk kartı atacak
          room.gameState.gamePhase = 'trumpSelection'; // Koz seçim fazına geç
          
          console.log(`�?� İhale tamamlandı! Kazanan: ${room.players[auctionResult.winner].username} (${auctionResult.winner})`);
          console.log(`📤 auctionEnded event'i gönderiliyor...`);
          io.to(roomId).emit('auctionEnded', {
            gameState: {
              ...room.gameState,
              sordumKonusMode: false,
              sordumPlayer: null,
              konusPlayer: null
            },
            winner: auctionResult.winner,
            winnerUsername: room.players[auctionResult.winner].username,
            highestBid: auctionResult.highestBid,
            isBoz: false,
            message: `İhale kazananı: ${room.players[auctionResult.winner].username} (${auctionResult.highestBid} puan)`
          });
          console.log(`✅ auctionEnded event'i gönderildi`);
        }
      }
    } else {
      console.log(`�?� Room veya gameState bulunamadı:`, { room: !!room, gameState: !!(room && room.gameState) });
    }
  });

  // Sordum event'i
  socket.on('sordum', (data) => {
    const { roomId } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;
    
    console.log(`�? sordum event'i alındı:`, { roomId, playerIndex });
    
    if (room && room.gameState) {
      if (room.gameState.gamePhase !== 'auction' || room.gameState.auctionCurrent !== playerIndex) { reject(socket, 'Sıra sizde değil.'); return; }
      // Sordum/Konuş modunu aktif et
      room.gameState.sordumKonusMode = true;
      room.gameState.sordumPlayer = playerIndex;
      room.gameState.auctionTurns = (room.gameState.auctionTurns || 0) + 1;
      
      // Sıra sonraki oyuncuya geçer (Sordum sonrası kural)
      room.gameState.auctionCurrent = (playerIndex + 1) % 4;
      
      console.log(`🔄 Sordum sonrası sıra: ${room.gameState.auctionCurrent}`);
      console.log(`📊 Güncel gameState:`, room.gameState);
      
      // Tüm oyunculara güncel durumu gönder
      console.log(`📤 auctionUpdate event'i gönderiliyor...`);
      io.to(roomId).emit('auctionUpdate', {
        gameState: publicGameState(room.gameState),
        playerIndex: room.gameState.auctionCurrent, // Sıradaki oyuncunun index'ini gönder
        message: `${room.players[playerIndex].username} sordum dedi`
      });
      console.log(`✅ auctionUpdate event'i gönderildi`);
    }
  });

  // Konuş event'i
  socket.on('konus', (data) => {
    const { roomId } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;
    
    console.log(`💬 konus event'i alındı:`, { roomId, playerIndex });
    
    if (room && room.gameState) {
      if (room.gameState.gamePhase !== 'auction' || room.gameState.auctionCurrent !== playerIndex) { reject(socket, 'Sıra sizde değil.'); return; }
      if (playerIndex === 2 && !room.gameState.sordumKonusMode) {
        // 3. oyuncu direkt konuş diyor
        room.gameState.auctionTurns = (room.gameState.auctionTurns || 0) + 1;
        room.gameState.auctionCurrent = (playerIndex + 1) % 4;
      } else if (room.gameState.sordumKonusMode) {
        // Sordum/Konuş modunda: Konuş sonrası sıra önceki oyuncuya döner
        room.gameState.konusPlayer = playerIndex;
        
        // Sıra önceki oyuncuya döner
        room.gameState.auctionCurrent = (playerIndex - 1 + 4) % 4;
      }
      
      console.log(`🔄 Konuş sonrası sıra: ${room.gameState.auctionCurrent}`);
      console.log(`📊 Güncel gameState:`, room.gameState);
      
      // Tüm oyunculara güncel durumu gönder
      console.log(`📤 auctionUpdate event'i gönderiliyor...`);
      io.to(roomId).emit('auctionUpdate', {
        gameState: publicGameState(room.gameState),
        playerIndex: room.gameState.auctionCurrent, // Sıradaki oyuncunun index'ini gönder
        message: `${room.players[playerIndex].username} konuş dedi`
      });
      console.log(`✅ auctionUpdate event'i gönderildi`);
    }
  });

  // Boz event'i
  socket.on('boz', (data) => {
    const { roomId } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;
    
    console.log(`💥 boz event'i alındı:`, { roomId, playerIndex });
    
    if (room && room.gameState && room.gameState.auctionCurrent === 3 && room.gameState.sordumKonusMode) {
      if (playerIndex !== 3) { reject(socket, 'Bu hamle için yetkiniz yok.'); return; }
      // Boz sayısını artır
      room.gameState.consecutiveBozCount = (room.gameState.consecutiveBozCount || 0) + 1;
      
      // 3 kez ard arda boz olduysa dağıtıcı değişir
      if (room.gameState.consecutiveBozCount >= 3) {
        room.gameState.currentDealer = (room.gameState.currentDealer + 1) % 4;
        room.gameState.consecutiveBozCount = 0;
      }
      
      // Yeni kartlar dağıt
      const newDeck = createDeck();
      const shuffledDeck = shuffle(newDeck);
      const newPlayers = dealCards(shuffledDeck);
      
      // GameState'i sıfırla ama bazı değerleri koru
      room.gameState = {
        ...room.gameState,
        players: newPlayers,
        currentDealer: room.gameState.currentDealer,
        consecutiveBozCount: room.gameState.consecutiveBozCount,
        isBoz: true,
        gamePhase: 'waiting',
        auctionActive: false,
        auctionBids: [null, null, null, null],
        auctionPasses: [false, false, false, false],
        auctionCurrent: 0,
        auctionHighestBid: 0,
        auctionWinner: null,
        sordumKonusMode: false,
        sordumPlayer: null,
        konusPlayer: null
      };
      
      console.log(`💥 Boz sonrası yeni kartlar dağıtıldı. Dağıtıcı: ${room.players[room.gameState.currentDealer].username}`);
      
      // Tüm oyunculara yeni durumu gönder
      io.to(roomId).emit('auctionUpdate', {
        gameState: publicGameState(room.gameState),
        playerIndex: room.gameState.auctionCurrent, // Sıradaki oyuncunun index'ini gönder
        message: `${room.players[playerIndex].username} boz dedi. Yeni kartlar dağıtıldı.`
      });
    }
  });

  // Koz seçimi
  socket.on('selectTrump', (data) => {
    const { roomId, trumpSuit } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    if (room.gameState?.gamePhase !== 'trumpSelection' || player.position !== room.gameState.auctionWinner || !VALID_SUITS.has(trumpSuit)) { reject(socket, 'Koz seçme yetkiniz yok.'); return; }
    {
      room.gameState.trumpSuit = trumpSuit;
      room.gameState.currentPlayer = room.gameState.auctionWinner;
      room.gameState.gamePhase = 'playing'; // Oyun aşamasına geç
      
      console.log(`�?� Koz seçildi: ${trumpSuit} - İlk kartı atacak: ${room.players[room.gameState.auctionWinner].username}`);
      
      io.to(roomId).emit('trumpSelected', {
        gameState: publicGameState(room.gameState),
        trumpSuit: trumpSuit,
        winnerUsername: room.players[room.gameState.auctionWinner].username,
        message: `Koz seçildi: ${trumpSuit} - İlk kartı ${room.players[room.gameState.auctionWinner].username} atacak`
      });
    }
  });

  // Kart oynama
  socket.on('playCard', (data) => {
    const { roomId, cardIndex } = data;
    const access = requireRoomPlayer(socket, roomId);
    if (!access) return;
    const { room, player } = access;
    const playerIndex = player.position;

    if (room.gameState?.gamePhase !== 'playing' || room.gameState.currentPlayer !== playerIndex) {
      reject(socket, 'Sıra sizde değil.');
      return;
    }
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= room.gameState.playerCards[playerIndex].length) {
      reject(socket, 'Geçersiz kart.');
      return;
    }

    {
      const card = room.gameState.playerCards[playerIndex][cardIndex];
      
      // Kartı oyuncunun elinden çıkar
      room.gameState.playerCards[playerIndex].splice(cardIndex, 1);
      
      // Kartı masaya ekle
      room.gameState.playedCards.push({
        player: playerIndex,
        card: card
      });
      
      // Sıra sonraki oyuncuya geçer (sadece kart atıldıktan sonra)
      room.gameState.currentPlayer = (playerIndex + 1) % 4;
      
      // Tüm oyunculara güncel durumu gönder
      emitGameState(room, 'cardPlayed', {
        playedCard: { player: playerIndex, card },
        message: 'Kart oynandı.'
      });
      
      // 4 kart oynandı mı kontrol et
      if (room.gameState.playedCards.length === 4) {
        const winner = determineTrickWinner(room.gameState.playedCards, room.gameState.trumpSuit);
        room.gameState.currentPlayer = winner;
        
        // Takım el sayısını güncelle
        if (winner % 2 === 0) {
          room.gameState.team1Tricks++;
        } else {
          room.gameState.team2Tricks++;
        }
        
        // Oynanan kartları temizle
        room.gameState.playedCards = [];
        
        emitGameState(room, 'trickEnded', { winner, message: 'El tamamlandı.' });
        
        // Oyun bitti mi kontrol et
        if (room.gameState.playerCards[0].length === 0) {
          const finalScores = calculateEndGameScores(room.gameState);
          room.gameState.gameScores = finalScores;
          
          io.to(roomId).emit('gameEnded', {
            gameState: publicGameState(room.gameState),
            finalScores: finalScores,
            message: 'Oyun bitti!'
          });
        }
      }
    }
  });

  // Oda listesi isteme
  socket.on('getRooms', () => {
    const roomsList = Array.from(gameRooms.values()).map(room => ({
      id: room.id,
      players: room.players,
      status: room.status,
      createdAt: room.createdAt,
      createdBy: room.createdBy
    }));
    
    socket.emit('roomsList', roomsList);
  });

  // Oda oluşturma
  socket.on('createRoom', (data) => {
    const { username } = data;
    
    if (!username || username.trim() === '') {
      socket.emit('error', { message: 'Kullanıcı adı gerekli!' });
      return;
    }
    
    // Daha kısa ve okunabilir oda ID'si oluştur
    const generateRoomId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Benzersiz oda ID'si oluştur
    let roomId;
    do {
      roomId = generateRoomId();
    } while (gameRooms.has(roomId));
    
    const room = {
      id: roomId,
      players: [],
      gameState: null,
      status: 'waiting',
      createdAt: Date.now(),
      createdBy: username // Odayı oluşturan oyuncu
    };
    
    gameRooms.set(roomId, room);
    
    // Oda oluşturuldu - oyuncu henüz katılmadı
    socket.emit('roomCreated', { roomId, room });
    
    // Oda oluşturan oyuncuyu otomatik olarak odaya ekle
    const player = {
      id: socket.id,
      username: username.trim(),
      socketId: socket.id,
      ready: false,
      position: 0
    };
    
    room.players.push(player);
    playerSockets.set(socket.id, { roomId, player });
    
    // Odaya katıl
    socket.join(roomId);
    
    // Odadaki tüm oyunculara güncel durumu gönder
    io.to(roomId).emit('roomUpdate', {
      roomId: roomId,
      room: room,
      message: `${player.username} odaya katıldı!`
    });
    
    // Oda listesini güncelle
    const roomsList = Array.from(gameRooms.values()).map(room => ({
      id: room.id,
      players: room.players,
      status: room.status,
      createdAt: room.createdAt,
      createdBy: room.createdBy
    }));
    io.emit('roomsList', roomsList);
    
    console.log(`${username} ${roomId} odasını oluşturdu ve odaya katıldı`);
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    console.log(`Oyuncu ayrıldı: ${socket.id}`);
    
    const playerInfo = playerSockets.get(socket.id);
    if (playerInfo) {
      const { roomId, player } = playerInfo;
      const room = gameRooms.get(roomId);
      
      if (room) {
        // Oyuncuyu odadan çıkar
        room.players = room.players.filter(p => p.socketId !== socket.id);
        
        // Oda boşsa sil
        if (room.players.length === 0) {
          gameRooms.delete(roomId);
          console.log(`${roomId} odası silindi`);
        } else {
          // Kalan oyunculara güncel durumu gönder
          io.to(roomId).emit('roomUpdate', {
            roomId: roomId,
            room: room,
            message: `${player.username} oyundan ayrıldı`
          });
          
          // Oda listesini güncelle
          const roomsList = Array.from(gameRooms.values()).map(room => ({
            id: room.id,
            players: room.players,
            status: room.status,
            createdAt: room.createdAt,
            createdBy: room.createdBy
          }));
          io.emit('roomsList', roomsList);
        }
      }
      
      playerSockets.delete(socket.id);
    }
  });
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Pinaki Game Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/game-info', (req, res) => {
  res.json({
    name: 'Pinaki - Samandağ İskambil Oyunu',
    description: 'Geleneksel Türk iskambil oyunu',
    rules: '4 oyunculu, 48 kartlık deste, ihale sistemi',
    version: '1.0.0'
  });
});

app.get('/api/rooms', (req, res) => {
  const roomsList = Array.from(gameRooms.values()).map(room => ({
    id: room.id,
    players: room.players,
    status: room.status,
    createdAt: room.createdAt,
    createdBy: room.createdBy
  }));
  
  res.json(roomsList);
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

async function startServer() {
  await restoreRooms();
  setInterval(persistRooms, 5000).unref();
  server.listen(PORT, () => {
  console.log(`🚀 Pinaki Game Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`�? Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

module.exports = app;













