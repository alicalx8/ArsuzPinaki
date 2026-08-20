import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import './Navbar.css';

const Navbar = ({ currentRoom, onBackToLobby, globalSocket }) => {
  const { state, actions, utils } = useGame();

  const handleDealCards = () => {
    // Multiplayer'da server'a kartları dağıt komutu gönder
    if (state.isMultiplayer && currentRoom) {
      // Server'a dealCards event'i gönder
      if (window.globalSocket) {
        window.globalSocket.emit('dealCards', { roomId: currentRoom.id });
      } else {
        console.error('Global socket bulunamadı!');
      }
    } else {
      // Single player'da local olarak kartları dağıt
      actions.dealCards();
      actions.startAuction();
    }
  };

  // Multiplayer'da dağıtıcı kontrolü
  const isCurrentPlayerDealer = useMemo(() => {
    if (!currentRoom || !state.isMultiplayer) return false;
    
    // Oyuncunun kendi indeksini bul - currentRoom'dan al
    const currentPlayerIndex = currentRoom.players.findIndex(
      player => player.socketId === globalSocket?.id // Socket ID ile bul
    );
    
    return currentPlayerIndex === state.currentDealer;
  }, [currentRoom, state.isMultiplayer, state.currentDealer, globalSocket?.id]);

  const getDealerDisplayName = useMemo(() => {
    if (!currentRoom || !state.isMultiplayer) return '';
    
    // currentDealer undefined olabilir, kontrol et
    if (state.currentDealer === undefined || state.currentDealer === null) {
      return '';
    }
    
    const dealerPlayer = currentRoom.players[state.currentDealer];
    return dealerPlayer ? dealerPlayer.username : '';
  }, [currentRoom, state.isMultiplayer, state.currentDealer]);

  const handleHowToPlay = () => {
    window.open('/README.md', '_blank');
  };

  const dealerPlayerNumber = useMemo(() => {
    return utils.getPlayerNumberFromIndex(state.currentDealer);
  }, [utils, state.currentDealer]);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Kartları Dağıt butonu - sadece dağıtıcı için */}
        {state.isMultiplayer ? (
          <button 
            id="dealBtn" 
            className="navbar-deal-btn"
            onClick={handleDealCards}
            disabled={!isCurrentPlayerDealer || state.auctionActive || state.currentPlayer !== null}
            title={`Sadece ${getDealerDisplayName} kartları dağıtabilir`}
          >
            🃏 Kartları Dağıt ({getDealerDisplayName})
          </button>
        ) : (
          <button 
            id="dealBtn" 
            className="navbar-deal-btn"
            onClick={handleDealCards}
            disabled={state.auctionActive || state.currentPlayer !== null}
            title={`Sadece Oyuncu ${dealerPlayerNumber} kartları dağıtabilir`}
          >
            🃏 Kartları Dağıt
          </button>
        )}
        
        {currentRoom && (
          <div className="multiplayer-info">
            <span className="room-id">🏠 {currentRoom.id}</span>
            <span className="game-mode">Çok Oyunculu Mod</span>
          </div>
        )}
      </div>
      
      <div className="navbar-center">
        <h1 className="navbar-title">
          🎮 ONLİNE PİNAKİ 🎮
        </h1>
      </div>
      
      <div className="navbar-right">
        {currentRoom && (
          <button 
            className="back-to-lobby-btn"
            onClick={onBackToLobby}
          >
            ← Lobby'ye Dön
          </button>
        )}
        <button 
          id="how-to-play-btn" 
          className="navbar-help-btn"
          onClick={handleHowToPlay}
        >
          📖 Nasıl Oynanır
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
