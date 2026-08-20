import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import './Lobby.css';

const Lobby = ({ onJoinGame, onBackToMenu, globalSocket }) => {
  // Fallback olarak window.globalSocket kullan
  const socket = globalSocket || window.globalSocket;
  const { actions } = useGame();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    if (!socket) {
      return;
    }

    if (!socket.id) {
      return;
    }

    // Oda listesini al
    socket.emit('getRooms');

    const handleRoomsList = (roomsList) => {
      console.log('📋 Gelen odalar:', roomsList);
      setRooms(roomsList);
    };

    const handleRoomUpdate = (data) => {
      console.log('🔄 Oda güncellendi:', data);
      
      // Eğer bu bizim odamızsa veya henüz currentRoom yoksa, currentRoom'u güncelle
      if ((currentRoom && data.roomId === currentRoom.id) || !currentRoom) {
        // Oyuncu bu odada mı kontrol et
        const isPlayerInRoom = data.room.players && data.room.players.some(player => player.username === username);
        if (isPlayerInRoom) {
          setCurrentRoom(data.room);
        }
      }
      
      setRooms(prevRooms => {
        const updatedRooms = [...prevRooms];
        const roomIndex = updatedRooms.findIndex(room => room.id === data.roomId);
        
        if (roomIndex !== -1) {
          updatedRooms[roomIndex] = { ...updatedRooms[roomIndex], ...data.room };
        } else {
          updatedRooms.push(data.room);
        }
        
        return updatedRooms;
      });
    };

    const handleRoomCreated = (data) => {
      console.log('�?� Oda oluşturuldu:', data);
      // Oda oluşturulduğunda otomatik olarak o odaya katıl
      setCurrentRoom(data.room);
      setIsCreatingRoom(false);
      
      setRooms(prevRooms => {
        const existingRoom = prevRooms.find(room => room.id === data.roomId);
        if (!existingRoom) {
          return [...prevRooms, data.room];
        }
        return prevRooms;
      });
    };

    const handleJoinRoomSuccess = (data) => {
      console.log('✅ Odaya katılım başarılı:', data);
      setCurrentRoom(data.room);
      setSelectedRoom(null);
    };

    const handleJoinRoomError = (data) => {
      console.log('�?� Odaya katılım hatası:', data);
      alert(data.message);
    };

    const handleGameStarted = (data) => {
      console.log('�?� Oyun başladı:', data);
      if (data.message) {
        setCurrentRoom(prev => ({ ...prev, gameStarted: true }));
        // Oyun başladığında MultiplayerGame'e geç
        console.log('🚀 MultiplayerGame\'e geçiliyor...');
        onJoinGame(data.room);
      }
    };

    const handleCardsDealt = (data) => {
      // Kartlar dağıtıldığında yapılacak işlemler
    };

    const handleAuctionStarted = (data) => {
      // İhale başladı
      // İhale başladığında oyuna geç
      onJoinGame(data.room);
    };

    // Event listener'ları ekle
    socket.on('roomsList', handleRoomsList);
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('roomCreated', handleRoomCreated);
    socket.on('joinRoomSuccess', handleJoinRoomSuccess);
    socket.on('joinRoomError', handleJoinRoomError);
    socket.on('gameStarted', handleGameStarted);
    socket.on('cardsDealt', handleCardsDealt);
    socket.on('auctionStarted', handleAuctionStarted);

    return () => {
      socket.off('roomsList', handleRoomsList);
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('roomCreated', handleRoomCreated);
      socket.off('joinRoomSuccess', handleJoinRoomSuccess);
      socket.off('joinRoomError', handleJoinRoomError);
      socket.off('gameStarted', handleGameStarted);
      socket.off('cardsDealt', handleCardsDealt);
      socket.off('auctionStarted', handleAuctionStarted);
    };
  }, [socket, currentRoom, username]);

  const handleCreateRoom = useCallback(() => {
    if (!username.trim() || !socket) {
      console.log('�?� Oda oluşturulamadı:', { username: username.trim(), socket: !!socket });
      return;
    }

    setIsCreatingRoom(true);
    console.log('🚀 Oda oluşturuluyor... Username:', username);
    console.log('🔌 Socket durumu:', { id: socket.id, connected: socket.connected });
    
    socket.emit('createRoom', { username });
    console.log('📤 createRoom event\'i gönderildi');
    
    // Server'dan callback gelmiyor, roomCreated event'i ile currentRoom set edilecek
  }, [username, socket]);

  const handleJoinRoom = useCallback((roomId) => {
    if (!username.trim() || !socket) {
      console.log('�?� Odaya katılım hatası:', { username: username.trim(), socket: !!socket });
      return;
    }

    console.log('🚪 Odaya katılım isteği gönderiliyor:', { roomId, username });
    socket.emit('joinRoom', { roomId, username });
    // Server'dan joinRoomSuccess event'i ile currentRoom set edilecek
  }, [username, socket]);

  const handleStartGame = useCallback(() => {
    if (!currentRoom || !socket) {
      console.log('�?� Oyun başlatılamadı:', { currentRoom: !!currentRoom, socket: !!socket });
      return;
    }

    console.log('🚀 Oyun başlatılıyor:', { roomId: currentRoom.id, playerCount: currentRoom.players?.length });
    socket.emit('startGame', { roomId: currentRoom.id });
  }, [currentRoom, socket]);

  const handleBackToLobby = useCallback(() => {
    if (currentRoom && socket) {
      socket.emit('leaveRoom', { roomId: currentRoom.id });
    }
    setCurrentRoom(null);
    setSelectedRoom(null);
  }, [currentRoom, socket]);

  // Oyun başlatma kontrolü
  useEffect(() => {
    if (currentRoom && currentRoom.gameStarted) {
      onJoinGame(currentRoom);
    }
  }, [currentRoom, onJoinGame]);

  if (!socket) {
    return <div className="lobby-container">WebSocket bağlantısı bekleniyor...</div>;
  }

      // Debug log kaldırıldı
  
  if (!socket.id) {
    return <div className="lobby-container">WebSocket bağlantısı kuruluyor... (ID: {socket?.id || 'undefined'})</div>;
  }

  const isRoomOwner = currentRoom?.createdBy === username;

  if (currentRoom) {
    console.log('�?� Oda bekleme ekranı:', {
      roomId: currentRoom.id,
      players: currentRoom.players,
      playerCount: currentRoom.players?.length,
      gameStarted: currentRoom.gameStarted
    });
    
    return (
      <div className="room-waiting">
        <h2>Oda: {currentRoom.id}</h2>
        <div className="players-list">
          {currentRoom.players && currentRoom.players.map((player, index) => (
            <div key={player.socketId} className={`player-item ${player.username === username ? 'current-player' : ''}`}>
              <span className="player-number">{index + 1}</span>
              <span className="player-name">{player.username}</span>
              <span className="player-status">{player.username === username ? '(Siz)' : '(Bekleniyor)'}</span>
            </div>
          ))}
        </div>
        
        {currentRoom.players && currentRoom.players.length === 4 && isRoomOwner && (
          <div className="room-actions">
            <button 
              className="start-game-btn"
              onClick={handleStartGame}
              disabled={currentRoom.gameStarted}
            >
              {currentRoom.gameStarted ? 'Oyun Başladı!' : 'Oyunu Başlat'}
            </button>
          </div>
        )}
        
        <button className="back-btn" onClick={handleBackToLobby}>
          Lobiden Ayrıl
        </button>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <h1>�?� Pinaki Oyunu �?�</h1>
      
      <div className="username-section">
        <input
          type="text"
          placeholder="Kullanıcı adınızı girin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="username-input"
        />
      </div>

      <div className="room-creation">
        <button 
          onClick={handleCreateRoom}
          disabled={!username.trim() || isCreatingRoom}
          className="create-room-btn"
        >
          {isCreatingRoom ? 'Oda Oluşturuluyor...' : 'Oda Oluştur'}
        </button>
      </div>

      <div className="rooms-section">
        <h3>Mevcut Odalar</h3>
        {!rooms || rooms.length === 0 ? (
          <p>Henüz oda yok. Bir oda oluşturun!</p>
        ) : (
          <div className="rooms-list">
            {rooms && rooms.length > 0 && rooms.map(room => (
              <div key={room.id} className="room-item">
                <div className="room-info">
                  <span className="room-id">{room.id}</span>
                  <span className="player-count">{room.players?.length || 0}/4 Oyuncu</span>
                  <span className="room-status">{room.status}</span>
                  {room.createdBy && <span className="room-creator">Oluşturan: {room.createdBy}</span>}
                </div>
                <button 
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={(room.players?.length || 0) >= 4 || !username.trim()}
                  className="join-room-btn"
                >
                  Katıl
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;

