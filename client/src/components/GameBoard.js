import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import './GameBoard.css';

const GameBoard = ({ currentRoom }) => {
  const { state, actions, utils } = useGame();
  const [trickWinner, setTrickWinner] = useState(null);
  const [showTrickResult, setShowTrickResult] = useState(false);

  // actions.playCard'ı useCallback ile sarmalayarak infinite loop'u önle
  const handlePlayCard = useCallback((playerIndex, card) => {
    actions.playCard(playerIndex, card);
  }, [actions]);



  // 4 kart atıldığında el sonucunu göster
  useEffect(() => {
    console.log('🔄 playedCards değişti:', state.playedCards);
    if (state.playedCards.length === 4) {
      // El kazananını belirle
      const winner = determineTrickWinner(state.playedCards, state.trumpSuit);
      setTrickWinner(winner);
      setShowTrickResult(true);
      
      // 2 saniye sonra sonucu gizle ve yeni eli başlat
      setTimeout(() => {
        setShowTrickResult(false);
        setTrickWinner(null);
        // El kazananı yeni eli başlatır
        handlePlayCard(winner, { suit: '', rank: '' }); // Dummy card to trigger new trick
      }, 2000);
    }
  }, [state.playedCards.length]);

  const handleCardClick = (playerIndex, card) => {
    console.log('�?� handleCardClick çağrıldı:', { playerIndex, card });
    console.log('�?� Mevcut oyuncu:', state.currentPlayer, 'Oyun fazı:', state.gamePhase);
    console.log('📊 Mevcut playedCards:', state.playedCards);
    
    // Sadece aktif oyuncu kart atabilir
    if (state.currentPlayer !== playerIndex) {
      console.log('�?� Sıra sizde değil!');
      return;
    }

    // Oynanabilir kart kontrolü
    const allowedCards = utils.getAllowedCards(playerIndex);
    console.log('�?� İzin verilen kartlar:', allowedCards);
    const canPlay = allowedCards.some(c => c.suit === card.suit && c.rank === card.rank);
    console.log('✅ Kart oynanabilir mi:', canPlay);
    
    if (!canPlay) {
      // Geçersiz hamle uyarısı - daha kullanıcı dostu
      const cardElement = document.querySelector(`[data-card="${card.suit}-${card.rank}"]`);
      if (cardElement) {
        cardElement.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          cardElement.style.animation = '';
        }, 500);
      }
      
      // Kısa uyarı mesajı göster
      showTemporaryMessage('Bu kartı oynayamazsın!', 'error');
      return;
    }

    // Kart tıklandığında görsel geri bildirim
    const cardElement = document.querySelector(`[data-card="${card.suit}-${card.rank}"]`);
    if (cardElement) {
      cardElement.style.animation = 'cardPlay 0.3s ease-in-out';
      setTimeout(() => {
        cardElement.style.animation = '';
      }, 300);
    }

    // Multiplayer mod kontrolü
    if (state.isMultiplayer && window.globalSocket && currentRoom) {
      console.log('�? Multiplayer modda kart gönderiliyor...');
      console.log('🔌 globalSocket:', !!window.globalSocket);
      console.log('�?� currentRoom:', currentRoom);
      console.log('📤 Gönderilen data:', {
        roomId: currentRoom.id,
        cardIndex: state.players[playerIndex].findIndex(c => c.suit === card.suit && c.rank === card.rank),
        playerIndex: playerIndex
      });
      
      // Multiplayer modda server'a gönder
      window.globalSocket.emit('playCard', {
        roomId: currentRoom.id,
        cardIndex: state.players[playerIndex].findIndex(c => c.suit === card.suit && c.rank === card.rank),
        playerIndex: playerIndex
      });
      
      console.log('✅ playCard event gönderildi');
    } else {
      console.log('�?� Single player mod veya eksik bilgi');
      console.log('🔌 isMultiplayer:', state.isMultiplayer);
      console.log('🔌 globalSocket:', !!window.globalSocket);
      console.log('🔌 currentRoom:', !!currentRoom);
      // Single player mod
      handlePlayCard(playerIndex, card);
    }
  };

  // Geçici mesaj gösterme fonksiyonu
  const showTemporaryMessage = (message, type = 'info') => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `temp-message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${type === 'error' ? '#f44336' : '#4CAF50'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 2000);
  };

  const renderPlayerCards = (playerIndex, cards) => {
    if (state.isMultiplayer && playerIndex !== state.multiplayerPlayerIndex) {
      return <small>{state.handSizes?.[playerIndex] || 0} kapalı kart</small>;
    }
    console.log(`�?� renderPlayerCards çağrıldı - Oyuncu ${playerIndex}, kartlar:`, cards);
    const sortedCards = utils.sortPlayerCards(cards);
    const allowedCards = state.currentPlayer === playerIndex ? utils.getAllowedCards(playerIndex) : [];
    const isCurrentPlayer = state.currentPlayer === playerIndex;
    const isDealer = state.currentDealer === playerIndex;
    
    return utils.suitOrder.map(suit => {
      const suitCards = sortedCards.filter(card => card.suit === suit);
      if (suitCards.length === 0) return null;
      
      return (
        <div key={suit} className="card-row">
          {suitCards.map((card, idx) => {
            const canPlay = isCurrentPlayer && 
                           allowedCards.some(c => c.suit === card.suit && c.rank === card.rank);
            const isClickable = isCurrentPlayer;
            
            return (
              <span
                key={`${card.suit}-${card.rank}-${idx}`}
                data-card={`${card.suit}-${card.rank}`}
                className={`card ${utils.getSuitClass(card.suit)} ${
                  isClickable ? 'clickable' : ''
                } ${canPlay ? 'playable' : isClickable ? 'not-playable' : ''}`}
                onClick={() => handleCardClick(playerIndex, card)}
                title={
                  isClickable 
                    ? (canPlay ? 'Bu kartı oyna' : 'Bu kartı oynayamazsın') 
                    : ''
                }
              >
                {card.rank}{card.suit}
              </span>
            );
          })}
        </div>
      );
    });
  };



  const renderCenterCards = () => {
    console.log('�?� renderCenterCards çağrıldı, playedCards:', state.playedCards);
    return state.playedCards.map((play, index) => {
      const playerNumber = utils.getPlayerNumberFromIndex(play.player);
      return (
        <span
          key={index}
          className={`card ${utils.getSuitClass(play.card.suit)} center-card`}
          title={`Oyuncu ${playerNumber}`}
          style={{
            animation: 'cardDrop 0.5s ease-out',
            animationDelay: `${index * 0.1}s`
          }}
        >
          {play.card.rank}{play.card.suit}
        </span>
      );
    });
  };

  // El kazananını belirleme fonksiyonu - GameContext'teki utility'yi kullan
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
        if (utils.rankOrder.indexOf(c.rank) < utils.rankOrder.indexOf(bestCard.rank)) {
          bestIdx = i;
          bestCard = c;
        }
      }
    }
    
    return playedCards[bestIdx].player;
  };

  return (
    <div id="players" className="game-board">
      {/* El Sonucu Gösterimi */}
      {showTrickResult && trickWinner !== null && (
        <div className="trick-result-overlay">
          <div className="trick-result">
            <h2>�?� El Sonucu</h2>
            <div className="trick-winner">
              <strong>{state.playerNames[trickWinner] || `Oyuncu ${trickWinner + 1}`}</strong> eli kazandı!
            </div>
            <div className="trick-cards">
              {state.playedCards.map((play, index) => (
                <span
                  key={index}
                  className={`card ${utils.getSuitClass(play.card.suit)} result-card`}
                >
                  {play.card.rank}{play.card.suit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {[0, 1, 2, 3].map(playerIndex => {
        const playerNumber = utils.getPlayerNumberFromIndex(playerIndex);
        return (
          <div 
            key={playerIndex}
            className={`player ${state.currentPlayer === playerIndex ? 'active-player' : ''} ${
              state.auctionActive && state.auctionCurrent === playerIndex ? 'auction-active' : ''
            }`}
            id={`player${playerIndex + 1}`}
          >
            <h4>
              {state.playerNames[playerIndex] || `Oyuncu ${playerNumber}`}
              {state.currentDealer === playerIndex && (
                <span className="dealer-badge" title="Dağıtıcı">�?�</span>
              )}
              {state.trumpSuit && state.currentPlayer === playerIndex && (
                <span className="current-player-badge" title="Sıra sizde">▶�?</span>
              )}
            </h4>
            <div className="cards">
              {state.gameStarted ? (
                renderPlayerCards(playerIndex, state.players[playerIndex])
              ) : (
                <div className="waiting-message">
                  <small>
                    {state.currentDealer === playerIndex 
                      ? 'Kartları dağıtabilirsiniz!' 
                      : 'Kartlar dağıtılmayı bekliyor...'}
                  </small>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      <div id="table-center" className="table-center">
        <h3>Masa</h3>
        <div id="center-cards" className="center-cards">
          {state.gameStarted ? (
            renderCenterCards()
          ) : (
            <div className="waiting-message">
              <small>Oyun başlamayı bekliyor...</small>
            </div>
          )}
        </div>
        {/* El durumu gösterimi */}
        {state.gameStarted && state.playedCards.length > 0 && (
          <div className="trick-status">
            <small>
              {state.playedCards.length}/4 kart atıldı
              {state.playedCards.length === 4 && ' - El tamamlandı!'}
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;

