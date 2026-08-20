import React, { useEffect, useState } from 'react';
import './App.css';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import MultiplayerGame from './components/MultiplayerGame';
import { GameProvider } from './context/GameContext';
import io from 'socket.io-client';

function App() {
  const [gameMode, setGameMode] = useState('menu');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const nextSocket = io({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    nextSocket.on('connect', () => {
      setSocket(nextSocket);
      window.globalSocket = nextSocket;
    });

    return () => {
      nextSocket.disconnect();
      if (window.globalSocket === nextSocket) window.globalSocket = null;
    };
  }, []);

  const openLobby = () => setGameMode('lobby');
  const backToMenu = () => {
    setCurrentRoom(null);
    setGameMode('menu');
  };
  const joinGame = (room) => {
    setCurrentRoom(room);
    setGameMode('multiplayer');
  };

  if (gameMode === 'menu') {
    return <MainMenu onStartMultiplayer={openLobby} />;
  }

  return (
    <GameProvider>
      {gameMode === 'lobby' ? (
        <Lobby onJoinGame={joinGame} onBackToMenu={backToMenu} globalSocket={socket} />
      ) : (
        <MultiplayerGame
          currentRoom={currentRoom}
          onBackToLobby={() => setGameMode('lobby')}
          globalSocket={socket}
        />
      )}
    </GameProvider>
  );
}

export default App;

