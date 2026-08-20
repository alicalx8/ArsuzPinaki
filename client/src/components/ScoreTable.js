import React from 'react';
import { useGame } from '../context/GameContext';
import './ScoreTable.css';

const ScoreTable = () => {
  const { state, utils } = useGame();

  // Sadece koz belirlendikten sonra (oyun fazında) göster
  if (state.gamePhase !== 'playing' && state.gamePhase !== 'ended') {
    return null;
  }

  // Başlangıç puanları state'ten al
  const scores = state.gameScores;
  const team1Score = scores[0] + scores[2];
  const team2Score = scores[1] + scores[3];

  return (
    <div id="score-table" className="score-table">
      <table>
        <thead>
          <tr>
            <th>Oyuncu</th>
            <th>Puan</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map(playerIndex => {
            const playerNumber = utils.getPlayerNumberFromIndex(playerIndex);
            return (
              <tr key={playerIndex}>
                <td>{state.playerNames[playerIndex] || `Oyuncu ${playerNumber}`}</td>
                <td>{scores[playerIndex]}</td>
              </tr>
            );
          })}
          <tr className="team-row team1">
            <td>Takım 1 (1 & 3)</td>
            <td>{team1Score}</td>
          </tr>
          <tr className="team-row team2">
            <td>Takım 2 (2 & 4)</td>
            <td>{team2Score}</td>
          </tr>
          <tr className="cumulative-row team1-cumulative">
            <td>Birikimli Takım 1</td>
            <td>{state.cumulativeTeam1Score}</td>
          </tr>
          <tr className="cumulative-row team2-cumulative">
            <td>Birikimli Takım 2</td>
            <td>{state.cumulativeTeam2Score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ScoreTable;
