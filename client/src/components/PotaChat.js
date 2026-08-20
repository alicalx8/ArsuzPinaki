import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import './PotaChat.css';

const PotaChat = () => {
  const { state } = useGame();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      text: inputValue,
      player: getCurrentPlayerNumber(),
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const getCurrentPlayerNumber = () => {
    if (state.auctionActive) {
      return state.auctionCurrent + 1;
    }
    if (state.currentPlayer !== null) {
      return state.currentPlayer + 1;
    }
    return '?';
  };

  return (
    <div id="pota-chat" className="pota-chat">
      <div id="pota-chat-messages" className="pota-chat-messages">
        {messages.map(message => (
          <div key={message.id} className="pota-message">
            <span className="message-player">Oyuncu {message.player}:</span>
            <span className="message-text">{message.text}</span>
            <span className="message-time">{message.timestamp}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="pota-chat-input-container">
        <input
          id="pota-chat-input"
          type="text"
          maxLength="40"
          placeholder="Pota mesajı yaz..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="pota-chat-input"
        />
        <button
          id="pota-chat-send"
          onClick={handleSendMessage}
          className="pota-chat-send"
        >
          Gönder
        </button>
      </div>
    </div>
  );
};

export default PotaChat;
