import React, { useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import Navbar from './Navbar';
import GameBoard from './GameBoard';
import AuctionPanel from './AuctionPanel';
import ScoreTable from './ScoreTable';
import PotaChat from './PotaChat';

const MultiplayerGame = ({ currentRoom, onBackToLobby, globalSocket }) => {
  const { actions, state } = useGame();
  const actionsRef = useRef(actions);
  const stateRef = useRef(state);
  
  // actions ve state'i ref'e güncelle
  useEffect(() => {
    actionsRef.current = actions;
    stateRef.current = state;
  });

  // Event handler'ları useCallback ile sarmalayarak sonsuz döngüyü önle
  const handleDealCards = useCallback((data) => {
    actionsRef.current.setMultiplayerCards(data.cards, data.playerIndex, data.allPlayerCards, data.gameState);
    if (data.gameState?.gamePhase) {
      actionsRef.current.setGamePhase(data.gameState.gamePhase);
    }
  }, []);

  const handleDealerTurn = useCallback((data) => {
    actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
    if (data.gameState?.gamePhase) {
      actionsRef.current.setGamePhase(data.gameState.gamePhase);
    }
  }, []);

  const handleGameStarted = useCallback((data) => {
    if (data.gameState) {
      // MultiplayerPlayerIndex'i set et - server'dan gelen playerIndex kullanarak
      if (data.playerIndex !== undefined) {
        actionsRef.current.setMultiplayerPlayerIndex(data.playerIndex);
      }
      
      // Diğer state'leri güncelle
      actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
      actionsRef.current.setGameStarted(true);
      if (data.gameState.gamePhase) {
        actionsRef.current.setGamePhase(data.gameState.gamePhase);
      }
    }
  }, []);

  const handleAuctionStarted = useCallback((data) => {
    if (data.gameState) {
      // Önce auctionBids state'ini güncelle
      if (data.gameState.auctionBids || data.gameState.auctionPasses || data.gameState.auctionHighestBid !== undefined || data.gameState.auctionWinner !== undefined || data.gameState.auctionCurrent !== undefined || data.gameState.auctionActive !== undefined) {
        actionsRef.current.setAuctionBids(
          data.gameState.auctionBids,
          data.gameState.auctionPasses,
          data.gameState.auctionHighestBid,
          data.gameState.auctionWinner,
          data.gameState.auctionCurrent,
          data.gameState.auctionActive
        );
      }
      
      // Sonra diğer state'leri güncelle
      actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
      
      // GamePhase'i auction olarak set et
      if (data.gameState.gamePhase) {
        actionsRef.current.setGamePhase(data.gameState.gamePhase);
      }
      
      // AuctionActive'i true olarak set et
      if (data.gameState.auctionActive !== undefined) {
        // GameContext'te auctionActive'i set etmek için setAuctionBids'i tekrar çağır
        actionsRef.current.setAuctionBids(
          data.gameState.auctionBids || [null, null, null, null],
          data.gameState.auctionPasses || [false, false, false, false],
          data.gameState.auctionHighestBid || 0,
          data.gameState.auctionWinner || null,
          data.gameState.auctionCurrent || 0,
          true // auctionActive'i true olarak set et
        );
      }
      
      // MultiplayerPlayerIndex'i set et - server'dan gelen playerIndex kullanarak
      if (data.playerIndex !== undefined) {
        actionsRef.current.setMultiplayerPlayerIndex(data.playerIndex);
      }
    }
  }, []);

  

  const handleCardsDealt = useCallback((data) => {
    if (data.gameState) {
      // Önce auctionBids state'ini güncelle
      if (data.gameState.auctionBids || data.gameState.auctionPasses || data.gameState.auctionHighestBid !== undefined || data.gameState.auctionWinner !== undefined || data.gameState.auctionCurrent !== undefined || data.gameState.auctionActive !== undefined) {
        actionsRef.current.setAuctionBids(
          data.gameState.auctionBids,
          data.gameState.auctionPasses,
          data.gameState.auctionHighestBid,
          data.gameState.auctionWinner,
          data.gameState.auctionCurrent,
          data.gameState.auctionActive
        );
      }
      
      // MultiplayerPlayerIndex'i set et - server'dan gelen playerIndex kullanarak
      if (data.playerIndex !== undefined) {
        actionsRef.current.setMultiplayerPlayerIndex(data.playerIndex);
      }
      
      // Sonra diğer state'leri güncelle
      actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
      actionsRef.current.setGameStarted(true);
      if (data.gameState.gamePhase) {
        actionsRef.current.setGamePhase(data.gameState.gamePhase);
      }
    }
  }, []);

    const handleAuctionUpdate = useCallback((data) => {
      console.log('�?� AuctionUpdate event alındı:', data);
      console.log('�? Mevcut state:', stateRef.current);
      
      if (data.gameState) {
        // Önce auctionBids state'ini güncelle
        if (data.gameState.auctionBids || data.gameState.auctionPasses || data.gameState.auctionHighestBid !== undefined || data.gameState.auctionWinner !== undefined || data.gameState.auctionCurrent !== undefined || data.gameState.auctionActive !== undefined) {
          console.log('📊 AuctionBids güncelleniyor...');
          actionsRef.current.setAuctionBids(
            data.gameState.auctionBids,
            data.gameState.auctionPasses,
            data.gameState.auctionHighestBid,
            data.gameState.auctionWinner,
            data.gameState.auctionCurrent,
            data.gameState.auctionActive
          );
        }
        
        // MultiplayerPlayerIndex'i set et - server'dan gelen playerIndex kullanarak
        if (data.playerIndex !== undefined) {
          console.log('👤 MultiplayerPlayerIndex set ediliyor:', data.playerIndex);
          actionsRef.current.setMultiplayerPlayerIndex(data.playerIndex);
        } else {
          console.log('👤 MultiplayerPlayerIndex korunuyor, mevcut değer:', stateRef.current?.multiplayerPlayerIndex);
        }
        
        // Sonra diğer state'leri güncelle
        actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
        if (data.gameState.gamePhase) {
          actionsRef.current.setGamePhase(data.gameState.gamePhase);
        }
      }
    }, []);

  const handleAuctionEnded = useCallback((data) => {
    console.log('�?� MultiplayerGame handleAuctionEnded çağrıldı:', data);
    
    if (data.gameState) {
      console.log('📊 GameState var, işleniyor...');
      
      // Önce auctionBids state'ini güncelle
      if (data.gameState.auctionBids || data.gameState.auctionPasses || data.gameState.auctionHighestBid !== undefined || data.gameState.auctionWinner !== undefined || data.gameState.auctionCurrent !== undefined || data.gameState.auctionActive !== undefined) {
        console.log('📊 AuctionBids güncelleniyor...');
        console.log('�?� auctionWinner:', data.gameState.auctionWinner);
        actionsRef.current.setAuctionBids(
          data.gameState.auctionBids,
          data.gameState.auctionPasses,
          data.gameState.auctionHighestBid,
          data.gameState.auctionWinner,
          data.gameState.auctionCurrent,
          data.gameState.auctionActive,
          data.gameState.sordumKonusMode,
          data.gameState.sordumPlayer,
          data.gameState.konusPlayer
        );
      }
      
      // Sonra diğer state'leri güncelle
      console.log('🔄 MultiplayerCards güncelleniyor...');
      actionsRef.current.setMultiplayerCards(
        data.cards || null, // this socket's hand only
        stateRef.current.multiplayerPlayerIndex, // playerIndex - mevcut değeri koru
        null, // players
        data.gameState
      );
      
      // GamePhase güncellemesi - kritik!
      if (data.gameState.gamePhase) {
        console.log('�?� GamePhase güncelleniyor:', data.gameState.gamePhase);
        actionsRef.current.setGamePhase(data.gameState.gamePhase);
      } else if (data.gameState.auctionWinner !== null && data.gameState.auctionWinner !== undefined) {
        // Eğer gamePhase yoksa ama auctionWinner varsa, trumpSelection fazına geç
        console.log('�?� GamePhase yok ama auctionWinner var, trumpSelection olarak set ediliyor');
        actionsRef.current.setGamePhase('trumpSelection');
      }
      
      if (data.isBoz !== undefined) {
        console.log('🔄 isBoz güncelleniyor:', data.isBoz);
        actionsRef.current.setIsBoz(data.isBoz);
      }
      
      console.log('✅ handleAuctionEnded tamamlandı');
    } else {
      console.log('�?� GameState yok!');
    }
  }, []);

  const handleTrumpSelected = useCallback((data) => {
    if (data.gameState) {
      actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
      if (data.gameState.gamePhase) {
        actionsRef.current.setGamePhase(data.gameState.gamePhase);
      }
    }
  }, []);

     const handlePassBid = useCallback((data) => {
     if (data.gameState) {
       actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
       if (data.gameState.gamePhase) {
         actionsRef.current.setGamePhase(data.gameState.gamePhase);
       }
     }
   }, []);

   const handleSordum = useCallback((data) => {
     if (data.gameState) {
       actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
       if (data.gameState.gamePhase) {
         actionsRef.current.setGamePhase(data.gameState.gamePhase);
       }
     }
   }, []);

   const handleKonus = useCallback((data) => {
     if (data.gameState) {
       actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
       if (data.gameState.gamePhase) {
         actionsRef.current.setGamePhase(data.gameState.gamePhase);
       }
     }
   }, []);

   const handleBoz = useCallback((data) => {
     if (data.gameState) {
       actionsRef.current.setMultiplayerCards(null, null, null, data.gameState);
       if (data.gameState.gamePhase) {
         actionsRef.current.setGamePhase(data.gameState.gamePhase);
       }
     }
   }, []);

  const handleCardPlayed = useCallback((data) => {
    console.log('�?� cardPlayed event alındı:', data);
    if (data.gameState) {
      console.log('📊 Gelen gameState:', data.gameState);
      console.log('�?� Oynanan kart:', data.playedCard);
      console.log('�?� Güncel playerCards:', data.allPlayerCards);
      console.log('👤 Mevcut multiplayerPlayerIndex:', state.multiplayerPlayerIndex);
      
      // multiplayerPlayerIndex'i koruyarak setMultiplayerCards çağır
      actionsRef.current.setMultiplayerCards(
        data.cards || null, // this socket's hand only
        state.multiplayerPlayerIndex, // playerIndex - mevcut değeri koru
        null, // other players' hands are never sent
        data.gameState
      );
      
      console.log('✅ cardPlayed event işlendi');
    }
  }, [state.multiplayerPlayerIndex, state.currentPlayer]);

  const handleTrickEnded = useCallback((data) => {
    if (data.gameState) {
      console.log('�?� trickEnded event alındı:', data);
      console.log('�?� Güncel playerCards:', data.allPlayerCards);
      console.log('👤 Mevcut multiplayerPlayerIndex:', state.multiplayerPlayerIndex);
      
      // multiplayerPlayerIndex'i koruyarak setMultiplayerCards çağır
      actionsRef.current.setMultiplayerCards(
        data.cards || null, // this socket's hand only
        state.multiplayerPlayerIndex, // playerIndex - mevcut değeri koru
        null, // other players' hands are never sent
        data.gameState
      );
    }
  }, [state.multiplayerPlayerIndex]);

  

  useEffect(() => {
    if (currentRoom && currentRoom.players && globalSocket) {
      // Oyuncu isimlerini GameContext'e set et
      const playerNames = currentRoom.players.map(player => player.username);
      actionsRef.current.setPlayerNames(playerNames);
      
      // Multiplayer modunu aktif et
      actionsRef.current.setMultiplayerMode(true);
      
      // Test için round end verisi set et (sonra kaldırılacak)
      setTimeout(() => {
        actionsRef.current.setRoundEnd({
          roundNumber: 1,
          roundTeam1Score: 150,
          roundTeam2Score: 80,
          cumulativeTeam1Score: 150,
          cumulativeTeam2Score: 80,
          kabbut: false,
          oyunBatti: false,
          gameWinner: null
        });
      }, 3000); // 3 saniye sonra göster

      // Socket'i global olarak erişilebilir yap
      window.socket = globalSocket;
      
      // Event listener'ları ekle
      globalSocket.on('dealCards', handleDealCards);
      globalSocket.on('dealerTurn', handleDealerTurn);
      globalSocket.on('gameStarted', handleGameStarted);
      globalSocket.on('auctionStarted', handleAuctionStarted);
      globalSocket.on('cardsDealt', handleCardsDealt);
      globalSocket.on('auctionUpdate', handleAuctionUpdate);
      globalSocket.on('passBid', handlePassBid);
             console.log('🔌 auctionEnded event listener ekleniyor...');
       globalSocket.on('auctionEnded', handleAuctionEnded);
       console.log('✅ auctionEnded event listener eklendi');
        globalSocket.on('trumpSelected', handleTrumpSelected);
        globalSocket.on('sordum', handleSordum);
        globalSocket.on('konus', handleKonus);
        globalSocket.on('boz', handleBoz);
        globalSocket.on('cardPlayed', handleCardPlayed);
        globalSocket.on('trickEnded', handleTrickEnded);

      return () => {
        // Event listener'ları temizle
        globalSocket.off('dealCards', handleDealCards);
        globalSocket.off('dealerTurn', handleDealerTurn);
        globalSocket.off('gameStarted', handleGameStarted);
        globalSocket.off('auctionStarted', handleAuctionStarted);
        globalSocket.off('cardsDealt', handleCardsDealt);
        globalSocket.off('auctionUpdate', handleAuctionUpdate);
        globalSocket.off('passBid', handlePassBid);
        globalSocket.off('auctionEnded', handleAuctionEnded);
         globalSocket.off('trumpSelected', handleTrumpSelected);
         globalSocket.off('sordum', handleSordum);
         globalSocket.off('konus', handleKonus);
         globalSocket.off('boz', handleBoz);
         globalSocket.off('cardPlayed', handleCardPlayed);
         globalSocket.off('trickEnded', handleTrickEnded);
                  globalSocket.off('auctionUpdate', handleAuctionUpdate);
      };
    }
  }, [currentRoom, globalSocket, handleAuctionUpdate, handleCardPlayed, handleTrickEnded, handleAuctionEnded]);



     return (
     <div className="App">
       <Navbar currentRoom={currentRoom} onBackToLobby={onBackToLobby} globalSocket={globalSocket} />
              <div className="game-container">
          {/* Sol panel - İhale ve koz bilgileri */}
        <div className="left-panel">
          <AuctionPanel currentRoom={currentRoom} />
          <ScoreTable />
        </div>
        
        {/* Sağ üst köşe - Round sonu tablosu */}
        <GameBoard currentRoom={currentRoom} />
        <PotaChat />
      </div>
    </div>
  );
};

export default MultiplayerGame;

