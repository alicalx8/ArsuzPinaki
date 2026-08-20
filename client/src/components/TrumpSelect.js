import React from 'react';
import { useGame } from '../context/GameContext';
import './TrumpSelect.css';

const TrumpSelect = ({ currentRoom }) => {
  const { state, actions, utils } = useGame();

  const handleTrumpSelect = (suit) => {
    // Multiplayer mod kontrolü
    if (state.isMultiplayer && window.globalSocket && currentRoom) {
      // Multiplayer modda server'a gönder
      window.globalSocket.emit('selectTrump', {
        roomId: currentRoom.id,
        trumpSuit: suit
      });
    } else {
      // Single player mod
      actions.selectTrump(suit);
    }
    
    // Sesli okuma
    const kozAd = {
      '♥': 'Kupa',
      '♠': 'Maça', 
      '♦': 'Karo',
      '♣': 'Sinek'
    }[suit] || suit;
    
    speakText(`Seçilen koz: ${kozAd}`);
  };

  // Sesli okuma fonksiyonu
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'tr-TR';
      window.speechSynthesis.speak(utter);
    }
  };

  // Sadece trump selection fazında göster
  console.log('🔍 TrumpSelect render - GamePhase:', state.gamePhase);
  console.log('🔍 TrumpSelect render - auctionWinner:', state.auctionWinner);
  console.log('🔍 TrumpSelect render - trumpSuit:', state.trumpSuit);
  console.log('🔍 TrumpSelect render - auctionActive:', state.auctionActive);
  console.log('🔍 TrumpSelect render - isMultiplayer:', state.isMultiplayer);
  
  if (state.gamePhase !== 'trumpSelection') {
    console.log('❌ TrumpSelect: GamePhase trumpSelection değil, null döndürülüyor');
    return null;
  }

  if (state.auctionWinner === null || state.auctionWinner === undefined) {
    console.log('❌ TrumpSelect: auctionWinner yok, null döndürülüyor');
    return null;
  }

  if (state.trumpSuit) {
    console.log('❌ TrumpSelect: trumpSuit zaten seçilmiş, null döndürülüyor');
    return null;
  }

  // Room'dan gerçek oyuncu ismini al
  const roomPlayer = currentRoom && currentRoom.players.find(p => p.position === state.auctionWinner);
  const winnerPlayerName = roomPlayer ? roomPlayer.username : (state.playerNames[state.auctionWinner] || `Oyuncu ${utils.getPlayerNumberFromIndex(state.auctionWinner)}`);
  
  // İhale kazananı koz seçebilmeli (multiplayer'da sadece kazanan, single player'da herkes)
  const isMyTurn = state.isMultiplayer ? state.auctionWinner === state.multiplayerPlayerIndex : true;
  
  console.log('🔍 TrumpSelect debug:');
  console.log('  - auctionWinner:', state.auctionWinner);
  console.log('  - multiplayerPlayerIndex:', state.multiplayerPlayerIndex);
  console.log('  - isMultiplayer:', state.isMultiplayer);
  console.log('  - isMyTurn:', isMyTurn);
  console.log('  - winnerPlayerName:', winnerPlayerName);
  console.log('  - currentRoom:', currentRoom);

  return (
    <div className="trump-select">
      <h3>Koz Seçimi</h3>
      <p>{winnerPlayerName} kozu seçecek</p>
      {isMyTurn && (
        <div className="trump-buttons">
          <button onClick={() => handleTrumpSelect('♥')} className="trump-btn hearts">♥ Kupa</button>
          <button onClick={() => handleTrumpSelect('♠')} className="trump-btn spades">♠ Maça</button>
          <button onClick={() => handleTrumpSelect('♦')} className="trump-btn diamonds">♦ Karo</button>
          <button onClick={() => handleTrumpSelect('♣')} className="trump-btn clubs">♣ Sinek</button>
        </div>
      )}
    </div>
  );
};

export default TrumpSelect;
