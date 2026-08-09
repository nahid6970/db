"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/types";
import { formatBST, getCountdown } from "@/lib/utils";

interface MatchCardProps {
  match: Match;
  tournamentColor?: string;
  whiteLogoTeams: Set<string>;
  onClick: () => void;
}

export default function MatchCard({ match, tournamentColor, whiteLogoTeams, onClick }: MatchCardProps) {
  const [countdown, setCountdown] = useState("");
  const [t1ImgError, setT1ImgError] = useState(false);
  const [t2ImgError, setT2ImgError] = useState(false);
  const [tourneyImgError, setTourneyImgError] = useState(false);

  useEffect(() => {
    setT1ImgError(false);
    setT2ImgError(false);
    setTourneyImgError(false);
  }, [match.match_id]);

  useEffect(() => {
    if (match.status !== "Upcoming" || !match.unix_timestamp) return;
    const update = () => setCountdown(getCountdown(match.unix_timestamp!));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [match.status, match.unix_timestamp]);

  const isLive      = match.status === "Live";
  const isUpcoming  = match.status === "Upcoming";
  const isCompleted = match.status === "Completed";

  const s1 = parseInt(match.score1 ?? "", 10);
  const s2 = parseInt(match.score2 ?? "", 10);
  const t1Wins = !isNaN(s1) && !isNaN(s2) && s1 > s2;
  const t2Wins = !isNaN(s1) && !isNaN(s2) && s2 > s1;

  const t1White = whiteLogoTeams.has(match.team1);
  const t2White = whiteLogoTeams.has(match.team2);

  const series     = match.series ?? "";
  const isElim     = /elimination|elim/i.test(series);
  const isFinal    = /grand final|finals/i.test(series);

  const cardStyle: React.CSSProperties = {};
  if (tournamentColor) {
    cardStyle.background = tournamentColor;
  }

  return (
    <div
      className="match-card"
      data-status={match.status.toLowerCase()}
      data-elimination={isElim ? "1" : undefined}
      data-final={isFinal ? "1" : undefined}
      style={cardStyle}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Header */}
      <div className="match-card-header">
        <div className="tournament-info">
          {match.tournament_logo && !tourneyImgError ? (
            <img
              src={match.tournament_logo}
              alt=""
              className="tournament-logo"
              onError={() => setTourneyImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="tournament-logo-placeholder">
              <i className="fa-solid fa-trophy" />
            </div>
          )}
          <div className="tournament-name-container">
            <span className="tournament-name">{match.tournament}</span>
            {match.series && <span className="tournament-series">{match.series}</span>}
          </div>
        </div>

        {isLive && (
          <span className="match-status-badge status-live">
            <span className="live-dot" /> LIVE
          </span>
        )}
        {isUpcoming && (
          <span className="match-status-badge status-upcoming">UPCOMING</span>
        )}
        {isCompleted && (
          <span className="match-status-badge status-completed">COMPLETED</span>
        )}
      </div>

      {/* Body */}
      <div className="match-card-body">
        {/* Team 1 */}
        <div className="team-container">
          <div className={`logo-wrapper${t1White ? " white-bg-logo" : ""}`}>
            {match.team1_logo && !t1ImgError ? (
              <img
                src={match.team1_logo}
                alt={match.team1}
                className="team-logo"
                onError={() => setT1ImgError(true)}
                loading="lazy"
              />
            ) : (
              <div className="team-initial">{match.team1?.[0] ?? "?"}</div>
            )}
          </div>
          <span className="team-name">{match.team1}</span>
        </div>

        {/* Score / VS */}
        <div className="match-vs-score">
          {isCompleted || isLive ? (
            <div className="score-display">
              <span className={`score-num${t1Wins ? " winner" : ""}`}>{match.score1 || "0"}</span>
              <span className="score-divider">:</span>
              <span className={`score-num${t2Wins ? " winner" : ""}`}>{match.score2 || "0"}</span>
            </div>
          ) : (
            <span className="vs-label">VS</span>
          )}
        </div>

        {/* Team 2 */}
        <div className="team-container">
          <div className={`logo-wrapper${t2White ? " white-bg-logo" : ""}`}>
            {match.team2_logo && !t2ImgError ? (
              <img
                src={match.team2_logo}
                alt={match.team2}
                className="team-logo"
                onError={() => setT2ImgError(true)}
                loading="lazy"
              />
            ) : (
              <div className="team-initial">{match.team2?.[0] ?? "?"}</div>
            )}
          </div>
          <span className="team-name">{match.team2}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="match-card-footer">
        <div className="time-info">
          <i className="fa-regular fa-clock clock-icon" />
          <span className="bst-time">
            {match.unix_timestamp ? formatBST(match.unix_timestamp) : match.bst_time || match.time || "TBD"}
          </span>
        </div>

        {isUpcoming && (
          <div className="countdown-container">
            <span className="countdown-label">Starts in</span>
            <span className="countdown-timer">
              {match.unix_timestamp ? countdown : match.eta || "TBD"}
            </span>
          </div>
        )}
        {isLive && (
          <div className="countdown-container status-live-container">
            <span className="live-pulse-indicator" />
            <span className="live-countdown-text">LIVE NOW</span>
          </div>
        )}
        {isCompleted && (
          <div className="countdown-container status-completed-container">
            <span className="completed-text">Final</span>
          </div>
        )}
      </div>
    </div>
  );
}
