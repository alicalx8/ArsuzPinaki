import React from 'react';
import './MainMenu.css';

const MainMenu = ({ onStartMultiplayer }) => (
  <div className="main-menu-container">
    <div className="menu-content">
      <div className="game-title">
        <h1>🎮 PINAKI</h1>
        <h2>Samandağ İskambil Oyunu</h2>
      </div>
      <div className="menu-description">
        <p>Arkadaşlarınla çevrimiçi Pinaki oyna</p>
      </div>
      <div className="menu-options">
        <button className="menu-btn multiplayer-btn" onClick={onStartMultiplayer}>
          <span className="btn-icon">👥</span>
          <span className="btn-text">Odalar</span>
          <span className="btn-description">Oda oluştur veya mevcut bir odaya katıl</span>
        </button>
      </div>
      <div className="footer"><p>© 2024 Pinaki Game - Samandağ Geleneği</p></div>
    </div>
  </div>
);

export default MainMenu;
