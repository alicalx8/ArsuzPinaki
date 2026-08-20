import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import './AuctionPanel.css';

const AuctionPanel = ({ currentRoom }) => {
  const { state, actions, utils } = useGame();
  const [bidInput, setBidInput] = useState('');

  // Sesli okuma fonksiyonu
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  const handleBid = () => {
    const bid = parseInt(bidInput, 10);
    
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      // Multiplayer modda server'a gönder
      const currentPlayerIndex = state.multiplayerPlayerIndex;

      if (currentPlayerIndex !== null && currentPlayerIndex !== undefined) {
        socket.emit('placeBid', {
          roomId: currentRoom.id,
          bidAmount: bid,
          playerIndex: currentPlayerIndex
        });
        setBidInput('');
        return;
      }
    }
    
    // Single player mod (mevcut kod)
    // İlk teklif mi? (Hiç teklif verilmemişse, sadece PASS'ler varsa)
    const hasAnyBid = state.auctionBids.some(b => b !== null && b !== 'PASS');
    const isFirstBid = !hasAnyBid;
    
    if (
      isNaN(bid) ||
      bid < 150 ||
      bid % 10 !== 0 ||
      (!isFirstBid && bid <= state.auctionHighestBid) ||
      (!isFirstBid && bid < state.auctionHighestBid + 10)
    ) {
      alert('Teklif, mevcut en yüksekten en az 10 fazla, en az 150 ve 10\'un katı olmalı!');
      return;
    }
    
    actions.placeBid(bid);
    setBidInput('');
    
    // Sesli okuma - gerçek oyuncu ismi ile
    const currentPlayerName = state.playerNames[state.auctionCurrent] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionCurrent)}`;
    speakText(`${currentPlayerName} teklif verdi: ${bid}`);
  };

  const handlePass = () => {
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      // Multiplayer modda server'a gönder
      const currentPlayerIndex = state.multiplayerPlayerIndex;

      if (currentPlayerIndex !== null && currentPlayerIndex !== undefined) {
        socket.emit('passBid', {
          roomId: currentRoom.id,
          playerIndex: currentPlayerIndex
        });
        return;
      }
    }
    
    // Single player mod (mevcut kod)
    // Konuş sonrası pas durumu kontrolü
    const isKonusFollowUp = state.sordumKonusMode && state.konusPlayer !== null;
    
    actions.passBid();
    
    // Sesli okuma - gerçek oyuncu isimleri ile
    const currentPlayerName = state.playerNames[state.auctionCurrent] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionCurrent)}`;
    
    if (isKonusFollowUp) {
      const konusPlayerName = state.playerNames[state.konusPlayer] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.konusPlayer)}`;
      speakText(`${currentPlayerName} pas. İhale ${konusPlayerName}'ya 150'ye kaldı.`);
    } else {
      speakText(`${currentPlayerName} pas`);
    }
  };

  const handleSordum = () => {
    console.log('🔍 handleSordum çağrıldı:', {
      isMultiplayer: state.isMultiplayer,
      socket: !!window.socket,
      globalSocket: !!window.globalSocket,
      currentRoom: !!currentRoom,
      roomId: currentRoom?.id,
      playerIndex: state.multiplayerPlayerIndex,
      auctionCurrent: state.auctionCurrent
    });
    
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      console.log('📤 Sordum event gönderiliyor...');
      // Multiplayer modda server'a gönder
      socket.emit('sordum', {
        roomId: currentRoom.id,
        playerIndex: state.multiplayerPlayerIndex
      });
      console.log('✅ Sordum event gönderildi');
    } else {
      console.log('❌ Sordum event gönderilemedi:', {
        isMultiplayer: state.isMultiplayer,
        hasSocket: !!window.socket,
        hasGlobalSocket: !!window.globalSocket,
        hasCurrentRoom: !!currentRoom
      });
    }
    
    // Single player mod
    actions.sordum();
    
    // Sesli okuma - gerçek oyuncu ismi ile
    const currentPlayerName = state.playerNames[state.auctionCurrent] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionCurrent)}`;
    speakText(`${currentPlayerName} sordum dedi`);
  };

  const handleKonus = () => {
    console.log('🔍 handleKonus çağrıldı:', {
      isMultiplayer: state.isMultiplayer,
      socket: !!window.socket,
      globalSocket: !!window.globalSocket,
      currentRoom: !!currentRoom,
      roomId: currentRoom?.id,
      playerIndex: state.multiplayerPlayerIndex,
      auctionCurrent: state.auctionCurrent
    });
    
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      console.log('📤 Konus event gönderiliyor...');
      // Multiplayer modda server'a gönder
      socket.emit('konus', {
        roomId: currentRoom.id,
        playerIndex: state.multiplayerPlayerIndex
      });
      console.log('✅ Konus event gönderildi');
    } else {
      console.log('❌ Konus event gönderilemedi:', {
        isMultiplayer: state.isMultiplayer,
        hasSocket: !!window.socket,
        hasGlobalSocket: !!window.globalSocket,
        hasCurrentRoom: !!currentRoom
      });
    }
    
    // Single player mod
    actions.konus();
    
    // Sesli okuma - gerçek oyuncu ismi ile
    const currentPlayerName = state.playerNames[state.auctionCurrent] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionCurrent)}`;
    speakText(`${currentPlayerName} konuş dedi`);
  };

  const handleSelectTrump = (suit) => {
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      // Multiplayer modda server'a gönder
      socket.emit('selectTrump', {
        roomId: currentRoom.id,
        trumpSuit: suit
      });
    }
    
    // Single player mod
    actions.selectTrump(suit);
    
    // Sesli okuma
    const suitNames = {
      '♥': 'Kalp',
      '♠': 'Maça', 
      '♦': 'Karo',
      '♣': 'Sinek'
    };
    speakText(`Koz seçildi: ${suitNames[suit]}`);
  };

  const handleBoz = () => {
    console.log('🔍 handleBoz çağrıldı:', {
      isMultiplayer: state.isMultiplayer,
      socket: !!window.socket,
      globalSocket: !!window.globalSocket,
      currentRoom: !!currentRoom,
      roomId: currentRoom?.id,
      playerIndex: state.multiplayerPlayerIndex,
      auctionCurrent: state.auctionCurrent
    });
    
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && (window.socket || window.globalSocket) && currentRoom) {
      const socket = window.socket || window.globalSocket;
      console.log('📤 Boz event gönderiliyor...');
      // Multiplayer modda server'a gönder
      socket.emit('boz', {
        roomId: currentRoom.id,
        playerIndex: state.multiplayerPlayerIndex
      });
      console.log('✅ Boz event gönderildi');
    } else {
      console.log('❌ Boz event gönderilemedi:', {
        isMultiplayer: state.isMultiplayer,
        hasSocket: !!window.socket,
        hasGlobalSocket: !!window.globalSocket,
        hasCurrentRoom: !!currentRoom
      });
    }
    
    // Single player mod
    actions.boz();
    
    // Sesli okuma - gerçek oyuncu ismi ile
    const currentPlayerName = state.playerNames[state.auctionCurrent] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionCurrent)}`;
    speakText(`${currentPlayerName} boz dedi`);
  };

  // Buton görünürlük mantığı - Normal oyun modu ve Sordum/Konuş modu
  const getButtonVisibility = useCallback(() => {
    let showSordum = false;
    let showKonus = false;
    let showBoz = false;
    let showBid = true;  // Teklif Ver her zaman görünür
    let showPass = true; // Pas her zaman görünür

    // Multiplayer mod kontrolü
    if (state.isMultiplayer) {
      const currentPlayerIndex = state.multiplayerPlayerIndex;

      // Sadece sırası gelen oyuncu butonları görebilir
      if (state.auctionCurrent !== currentPlayerIndex) {
        return { showSordum: false, showKonus: false, showBoz: false, showBid: false, showPass: false };
      }

      // Normal ihale modunda - Round'a göre dinamik buton gösterimi
      let canShowSordum = false;
      let hasAnyBid = false;

      // auctionCurrent >= 2 olmalı (en az 2 oyuncu sırası gelmiş olmalı)
      if (state.auctionCurrent >= 2) {
        // Hiç teklif verilip verilmediğini kontrol et
        for (let i = 0; i < state.auctionBids.length; i++) {
          if (state.auctionBids[i] !== null && state.auctionBids[i] !== 'PASS') {
            hasAnyBid = true;
            break;
          }
        }

        // Eğer hiç teklif verilmemişse, ard arda 2 PASS kontrolü yap
        if (!hasAnyBid) {
          let consecutivePasses = 0;
          for (let i = 0; i < state.auctionBids.length; i++) {
            if (state.auctionBids[i] === 'PASS') {
              consecutivePasses++;
              if (consecutivePasses >= 2) {
                canShowSordum = true;
                break;
              }
            } else if (state.auctionBids[i] !== null) {
              // Gerçek bir teklif verilmişse sayacı sıfırla
              consecutivePasses = 0;
            }
            // null ise sayacı sıfırlama (henüz sırası gelmemiş)
          }

          // Eğer hala bulunamadıysa, son 2 oyuncunun PASS olup olmadığını kontrol et
          if (!canShowSordum && state.auctionCurrent >= 3) {
            let lastTwoPasses = 0;
            for (let i = Math.max(0, state.auctionCurrent - 2); i < state.auctionCurrent; i++) {
              if (state.auctionBids[i] === 'PASS') {
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

      if (canShowSordum && !state.sordumKonusMode && !state.konusPlayer) {
        // Ard arda 2 oyuncu pas derse VE Sordum/Konuş modunda değilse VE Konuş oyuncusu yoksa: Teklif Ver + Sordum (Pas butonu gizli)
        showSordum = true;
        showBid = true;
        showPass = false; // Pas butonu gizli
        showKonus = false;
        showBoz = false;
        console.log('🔍 Sordum butonu gösteriliyor (2 PASS sonrası)');
      } else if (state.sordumKonusMode) {
        // Sordum/Konuş modunda
        console.log('🔍 Sordum/Konuş modu aktif:', {
          sordumPlayer: state.sordumPlayer,
          konusPlayer: state.konusPlayer,
          auctionCurrent: state.auctionCurrent
        });
        
        if (state.sordumPlayer && state.auctionCurrent !== state.sordumPlayer && !state.konusPlayer) {
          // Sordum sonrası sonraki oyuncuya geçildiğinde: Konuş ve Boz butonları
          showKonus = true;
          showBoz = true;
          showBid = false;
          showPass = false;
          showSordum = false;
          console.log('🔍 Konuş ve Boz butonları gösteriliyor (Sordum sonrası)');
        } else if (state.konusPlayer && state.auctionCurrent !== state.konusPlayer && state.auctionBids[state.auctionCurrent] === null) {
          // Konuş sonrası önceki oyuncuya dönüldüğünde: Teklif Ver ve Pas butonları
          showBid = true;
          showPass = true;
          showKonus = false;
          showBoz = false;
          showSordum = false;
          console.log('🔍 Teklif Ver ve Pas butonları gösteriliyor (Konuş sonrası)');
        } else if (state.konusPlayer && state.auctionCurrent !== state.konusPlayer) {
          // Konuş sonrası önceki oyuncu teklif verdikten sonra sonraki oyuncuya geçildiğinde: Teklif Ver ve Pas butonları
          showBid = true;
          showPass = true;
          showKonus = false;
          showBoz = false;
          showSordum = false;
          console.log('🔍 Teklif Ver ve Pas butonları gösteriliyor (Teklif sonrası)');
        } else if (state.konusPlayer && state.auctionCurrent === state.konusPlayer) {
          // Konuş butonuna basılacak oyuncu sırasında: Teklif Ver ve Pas butonları
          showBid = true;
          showPass = true;
          showKonus = false;
          showBoz = false;
          showSordum = false;
          console.log('🔍 Teklif Ver ve Pas butonları gösteriliyor (Konuş sırası)');
        } else {
          // Diğer durumlar için varsayılan: Teklif Ver ve Pas
          showBid = true;
          showPass = true;
          showSordum = false;
          showKonus = false;
          showBoz = false;
          console.log('🔍 Varsayılan: Teklif Ver ve Pas butonları gösteriliyor');
        }
      } else {
        // Normal ihale modunda: Teklif Ver + Pas
        showBid = true;
        showPass = true;
        showSordum = false;
        showKonus = false;
        showBoz = false;
        console.log('🔍 Normal mod: Teklif Ver ve Pas butonları gösteriliyor');
      }
    }
    return { showSordum, showKonus, showBoz, showBid, showPass };
  }, [state.isMultiplayer, state.auctionCurrent, state.multiplayerPlayerIndex, state.sordumKonusMode, state.sordumPlayer, state.konusPlayer, state.auctionBids]);

  // Buton görünürlük mantığı
  const buttonVisibility = getButtonVisibility();

  // Sıradaki oyuncu mu kontrol et - sadece auctionCurrent ile karşılaştır
  const isCurrentPlayerTurn = state.isMultiplayer && 
    state.multiplayerPlayerIndex !== null && 
    state.multiplayerPlayerIndex === state.auctionCurrent &&
    state.gamePhase === 'auction'; // Sadece auction fazında kontrol et

  // Debug log'lar ekle
  console.log('🔍 AuctionPanel Debug:', {
    isMultiplayer: state.isMultiplayer,
    multiplayerPlayerIndex: state.multiplayerPlayerIndex,
    auctionCurrent: state.auctionCurrent,
    gamePhase: state.gamePhase,
    isCurrentPlayerTurn: isCurrentPlayerTurn,
    auctionActive: state.auctionActive
  });

  // İhale sonucu gösterimi - gamePhase'e göre kontrol et
  if (state.gamePhase === 'trumpSelection' || (state.gamePhase === 'playing' && state.isBoz)) {
    if (state.isBoz) {
      // Boz durumu - dağıtıcı 150'ye aldı
      const dealerPlayerName = state.playerNames[state.currentDealer] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.currentDealer)}`;
      return (
        <div id="auction" className="auction-panel">
          <h2>İhale Sonucu</h2>
          <div className="auction-result">
            <div className="auction-winner">
              🏆 Tüm oyuncular pas geçti! İhaleyi <strong>{dealerPlayerName}</strong> 150'ye aldı!
            </div>
            <div className="auction-bid">
              Teklif: <strong>150</strong>
            </div>
            <div className="auction-next-step">
              {dealerPlayerName} ilk kartı atacak...
            </div>
          </div>
        </div>
      );
    } else if (state.auctionWinner !== null) {
      // Normal ihale kazananı - koz seçme ekranını göster
      const winnerPlayerName = state.playerNames[state.auctionWinner] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionWinner)}`;
      return (
        <div id="auction" className="auction-panel">
          <h2>Koz Seçimi</h2>
          <div className="auction-result">
            <div className="auction-winner">
              🏆 İhaleyi <strong>{winnerPlayerName}</strong> kazandı!
            </div>
            <div className="auction-bid">
              Teklif: <strong>{state.auctionHighestBid}</strong>
            </div>
            <div className="trump-selection">
              <h3>Koz Seçin:</h3>
              <div className="trump-buttons">
                <button 
                  className="trump-btn hearts" 
                  onClick={() => handleSelectTrump('♥')}
                >
                  ♥ Kupa
                </button>
                <button 
                  className="trump-btn spades" 
                  onClick={() => handleSelectTrump('♠')}
                >
                  ♠ Maça
                </button>
                <button 
                  className="trump-btn diamonds" 
                  onClick={() => handleSelectTrump('♦')}
                >
                  ♦ Karo
                </button>
                <button 
                  className="trump-btn clubs" 
                  onClick={() => handleSelectTrump('♣')}
                >
                  ♣ Sinek
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Oyun fazındaysa ihale bilgilerini göster
  if (state.gamePhase === 'playing') {
    const winnerPlayerName = currentRoom && currentRoom.players[state.auctionWinner] 
      ? currentRoom.players[state.auctionWinner].username 
      : (state.playerNames[state.auctionWinner] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionWinner)}`);
    
    return (
      <div id="auction" className="auction-panel">
        <h2>İhale Bilgileri</h2>
        <div className="auction-info">
          <div className="auction-winner">
            🏆 İhaleyi <strong>{winnerPlayerName}</strong> kazandı!
          </div>
          <div className="auction-bid">
            Teklif: <strong>{state.auctionHighestBid}</strong>
          </div>
          <div className="trump-info">
            Koz: <strong>{state.trumpSuit}</strong>
          </div>
        </div>
      </div>
    );
  }

  // İhale aktif değilse veya oyun başlamadıysa
  if (!state.auctionActive || state.gamePhase === 'waiting') {
    return (
      <div id="auction" className="auction-panel">
        <h2>İhale Süreci</h2>
        <div id="auction-status" className="auction-status">
          Kartlar dağıtıldıktan sonra ihale başlayacak.
        </div>
      </div>
    );
  }

  // İhale aktif değilse (oyun fazında) veya koz seçimi fazındaysa
  if (state.gamePhase !== 'auction') {
    return null;
  }

  const currentPlayerNumber = utils.getPlayerNumberFromIndex(state.auctionCurrent);
  const dealerPlayerNumber = utils.getPlayerNumberFromIndex(state.currentDealer);

  // Multiplayer mod için sıradaki oyuncu bilgisi
  const getCurrentPlayerInfo = () => {
    if (state.isMultiplayer && currentRoom) {
      const currentPlayerIndex = state.auctionCurrent;
      
      console.log('🔍 AuctionPanel getCurrentPlayerInfo debug:');
      console.log('  - currentPlayerIndex:', currentPlayerIndex);
      console.log('  - multiplayerPlayerIndex:', state.multiplayerPlayerIndex);
      console.log('  - currentRoom.players:', currentRoom.players);
      
      if (currentPlayerIndex !== null) {
        // Room'dan gerçek oyuncu ismini al
        const roomPlayer = currentRoom.players.find(p => p.position === currentPlayerIndex);
        const playerName = roomPlayer ? roomPlayer.username : state.playerNames[currentPlayerIndex] || `Oyuncu ${currentPlayerIndex + 1}`;
        
        // Sadece sırası gelen oyuncu isMyTurn: true olmalı
        const isMyTurn = currentPlayerIndex === state.auctionCurrent && state.multiplayerPlayerIndex === state.auctionCurrent;
        
        console.log('  - roomPlayer:', roomPlayer);
        console.log('  - playerName:', playerName);
        console.log('  - isMyTurn:', isMyTurn);
        console.log('  - currentPlayerIndex === auctionCurrent:', currentPlayerIndex === state.auctionCurrent);
        console.log('  - multiplayerPlayerIndex === auctionCurrent:', state.multiplayerPlayerIndex === state.auctionCurrent);
        
        return {
          name: playerName,
          isMyTurn: isMyTurn,
          message: isMyTurn ? 'Sıra sizde!' : `${playerName} sırada...`
        };
      }
    }
    
    // Single player mod için - her zaman sıra sizde
    return {
      name: state.playerNames[state.auctionCurrent] || `Oyuncu ${state.auctionCurrent + 1}`,
      isMyTurn: true,
      message: 'Sıra sizde!'
    };
  };

  const currentPlayerInfo = getCurrentPlayerInfo();

  // GamePhase trumpSelection ise hiçbir şey gösterme
  console.log('🔍 AuctionPanel GamePhase:', state.gamePhase);
  console.log('🔍 AuctionPanel auctionWinner:', state.auctionWinner);
  console.log('🔍 AuctionPanel trumpSuit:', state.trumpSuit);
  
  if (state.gamePhase === 'trumpSelection') {
    console.log('✅ AuctionPanel trumpSelection fazında, null döndürülüyor');
    return null;
  }

  return (
    <div id="auction" className="auction-panel">
      <h2>İhale Süreci</h2>
      <div id="auction-status" className="auction-status">
        İhale başladı! (En az 150)
        <br />Dağıtıcı: {currentRoom && currentRoom.players[state.currentDealer] ? currentRoom.players[state.currentDealer].username : (state.playerNames[state.currentDealer] || `Oyuncu ${dealerPlayerNumber}`)}
      </div>
      
      <div id="auction-controls" className="auction-controls">
        <div className="auction-player-info">
          <span id="auction-player">
            {currentPlayerInfo.message}
          </span>
        </div>
        
        {isCurrentPlayerTurn && (
          <div className="bid-input-container">
            <input
              type="number"
              id="bid-input"
              min="0"
              placeholder="Teklif (sayı)"
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              className="bid-input"
            />
          </div>
        )}

        {isCurrentPlayerTurn && (
          <div className="auction-buttons">
            {buttonVisibility.showBid && (
              <button
                id="bid-btn"
                onClick={handleBid}
                className="auction-btn bid-btn"
              >
                Teklif Ver
              </button>
            )}
            
            {buttonVisibility.showPass && (
              <button
                id="pass-btn"
                onClick={handlePass}
                className="auction-btn pass-btn"
              >
                Pas
              </button>
            )}
            
            {buttonVisibility.showSordum && (
              <button
                id="sordum-btn"
                onClick={handleSordum}
                className="auction-btn sordum-btn"
              >
                Sordum
              </button>
              )}
            
            {buttonVisibility.showKonus && (
              <button
                id="konus-btn"
                onClick={handleKonus}
                className="auction-btn konus-btn"
              >
                Konuş
              </button>
            )}
            
            {buttonVisibility.showBoz && (
              <button
                id="boz-btn"
                onClick={handleBoz}
                className="auction-btn boz-btn"
              >
                Boz
              </button>
            )}
          </div>
        )}
      </div>
      
      <div id="auction-highest-bid" className="auction-highest-bid">
        En Yüksek Teklif: {state.auctionHighestBid}
      </div>
      
      {/* Mevcut teklifleri göster */}
      <div className="current-bids">
        <h4>Mevcut Teklifler:</h4>
        <div className="bids-list">
          {Array.isArray(state.auctionBids) && state.auctionBids.map((bid, index) => {
            const playerNumber = utils.getPlayerNumberFromIndex(index);
            // Room'dan gerçek oyuncu ismini al
            const roomPlayer = currentRoom && currentRoom.players.find(p => p.position === index);
            const playerName = roomPlayer ? roomPlayer.username : (state.playerNames[index] || `Oyuncu ${playerNumber}`);
            
            // PASS durumunu kontrol et
            const hasPassed = state.auctionPasses && state.auctionPasses[index];
            const displayValue = hasPassed ? 'PAS' : (bid === null ? 'Bekliyor...' : bid);
            const displayClass = hasPassed ? 'pass' : (bid === null ? 'waiting' : 'bid');
            
            return (
              <div key={index} className="bid-item">
                <span className="player-name">{playerName}:</span>
                <span className={`bid-value ${displayClass}`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AuctionPanel;
