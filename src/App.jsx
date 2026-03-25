import { useState, useEffect, useCallback, useMemo } from "react";

// ── Firebase Setup Instructions ──────────────────────────────────────────────
// 1. Create a Firebase project at https://console.firebase.google.com
// 2. Enable Firestore Database
// 3. Replace the config below with your project's config
// 4. Import Firebase SDK in your project:
//    npm install firebase
//
// For this artifact, we simulate Firebase with persistent storage API.
// To connect real Firebase, uncomment the Firebase sections below.
// ─────────────────────────────────────────────────────────────────────────────


import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ── Default Tournament Data ──────────────────────────────────────────────────
const DEFAULT_TEAMS = {
  A: { name: "Team A", players: ["Player A1", "Player A2", "Player A3", "Player A4"], group: "A" },
  B: { name: "Team B", players: ["Player B1", "Player B2", "Player B3", "Player B4"], group: "B" },
  C: { name: "Team C", players: ["Player C1", "Player C2", "Player C3", "Player C4"], group: "A" },
  D: { name: "Team D", players: ["Player D1", "Player D2", "Player D3", "Player D4"], group: "B" },
  E: { name: "Team E", players: ["Player E1", "Player E2", "Player E3", "Player E4"], group: "B" },
  F: { name: "Team F", players: ["Player F1", "Player F2", "Player F3", "Player F4"], group: "A" },
};

const DEFAULT_MATCHES = [
  // Group A
  { id: "GA-1", group: "A", team1: "A", team2: "C", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
  { id: "GA-2", group: "A", team1: "A", team2: "F", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
  { id: "GA-3", group: "A", team1: "C", team2: "F", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
  // Group B
  { id: "GB-1", group: "B", team1: "B", team2: "D", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
  { id: "GB-2", group: "B", team1: "B", team2: "E", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
  { id: "GB-3", group: "B", team1: "D", team2: "E", games: [
    { type: "Singles 1", score1: null, score2: null, player1: "", player2: "" },
    { type: "Singles 2", score1: null, score2: null, player1: "", player2: "" },
    { type: "Doubles",   score1: null, score2: null, player1: "", player2: "" },
  ], rallyTiebreaker: null },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getMatchPoints(match) {
  let t1 = 0, t2 = 0;
  match.games.forEach((g) => {
    if (g.score1 !== null && g.score2 !== null) {
      const pts = g.type === "Doubles" ? 2 : 1;
      if (g.score1 > g.score2) t1 += pts;
      else if (g.score2 > g.score1) t2 += pts;
    }
  });
  return [t1, t2];
}

function getMatchWinner(match) {
  const [t1, t2] = getMatchPoints(match);
  if (t1 === 2 && t2 === 2) {
    if (match.rallyTiebreaker) {
      return match.rallyTiebreaker.score1 > match.rallyTiebreaker.score2 ? match.team1 : match.team2;
    }
    return null; // tied, no tiebreaker yet
  }
  if (t1 > t2) return match.team1;
  if (t2 > t1) return match.team2;
  return null;
}

function getTotalGameScores(matches, teamKey) {
  let total = 0;
  matches.forEach((m) => {
    if (m.team1 !== teamKey && m.team2 !== teamKey) return;
    const isTeam1 = m.team1 === teamKey;
    m.games.forEach((g) => {
      if (g.score1 !== null && g.score2 !== null) {
        total += isTeam1 ? g.score1 : g.score2;
      }
    });
  });
  return total;
}

function computeStandings(matches, teams, group) {
  const groupMatches = matches.filter((m) => m.group === group);
  const groupTeams = Object.keys(teams).filter((k) => teams[k].group === group);

  return groupTeams.map((tk) => {
    let wins = 0, losses = 0, matchPts = 0;
    groupMatches.forEach((m) => {
      if (m.team1 !== tk && m.team2 !== tk) return;
      const winner = getMatchWinner(m);
      const [t1pts, t2pts] = getMatchPoints(m);
      const isTeam1 = m.team1 === tk;
      if (winner === tk) wins++;
      else if (winner) losses++;
      matchPts += isTeam1 ? t1pts : t2pts;
    });
    const gameScores = getTotalGameScores(groupMatches, tk);
    return { team: tk, wins, losses, matchPts, gameScores };
  }).sort((a, b) => b.wins - a.wins || b.matchPts - a.matchPts || b.gameScores - a.gameScores);
}

// ── Styles ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0c0e13",
  surface: "#14171f",
  surfaceHover: "#1a1e28",
  card: "#181c26",
  border: "#2a2f3d",
  borderLight: "#353b4d",
  accent: "#f0c040",
  accentDim: "#b8922e",
  accentGlow: "rgba(240,192,64,0.15)",
  green: "#4ade80",
  red: "#f87171",
  blue: "#60a5fa",
  text: "#e8eaed",
  textDim: "#8b92a5",
  textMuted: "#5a6178",
  white: "#ffffff",
};

const font = `'DM Sans', 'Segoe UI', system-ui, sans-serif`;
const fontDisplay = `'Playfair Display', 'Georgia', serif`;

// ── Components ───────────────────────────────────────────────────────────────

function Badge({ children, color = COLORS.accent, bg }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: color,
      background: bg || `${color}18`,
      border: `1px solid ${color}30`,
      fontFamily: font,
    }}>{children}</span>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "flex",
      gap: 2,
      background: COLORS.surface,
      borderRadius: 10,
      padding: 4,
      border: `1px solid ${COLORS.border}`,
      flexWrap: "wrap",
    }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontFamily: font,
          fontSize: 13,
          fontWeight: active === t.key ? 700 : 500,
          background: active === t.key ? COLORS.accent : "transparent",
          color: active === t.key ? COLORS.bg : COLORS.textDim,
          transition: "all 0.2s",
          flex: "1 1 auto",
          minWidth: 90,
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function ScoreInput({ value, onChange, max = 30 }) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={value === null ? "" : value}
      onChange={(e) => {
        const v = e.target.value === "" ? null : Math.min(max, Math.max(0, parseInt(e.target.value) || 0));
        onChange(v);
      }}
      style={{
        width: 56,
        padding: "8px 6px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        color: COLORS.text,
        fontSize: 16,
        fontWeight: 700,
        textAlign: "center",
        fontFamily: font,
        outline: "none",
      }}
      onFocus={(e) => e.target.style.borderColor = COLORS.accent}
      onBlur={(e) => e.target.style.borderColor = COLORS.border}
    />
  );
}

function PlayerInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        maxWidth: 140,
        padding: "6px 10px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        color: COLORS.textDim,
        fontSize: 12,
        fontFamily: font,
        outline: "none",
      }}
      onFocus={(e) => e.target.style.borderColor = COLORS.accent}
      onBlur={(e) => e.target.style.borderColor = COLORS.border}
    />
  );
}

// ── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, teams, onUpdateGame, onUpdateRally }) {
  const [t1pts, t2pts] = getMatchPoints(match);
  const winner = getMatchWinner(match);
  const isTied = t1pts === 2 && t2pts === 2;
  const allPlayed = match.games.every((g) => g.score1 !== null && g.score2 !== null);

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${winner ? COLORS.accent + "40" : COLORS.border}`,
      borderRadius: 14,
      padding: 0,
      overflow: "hidden",
      transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: winner ? COLORS.accentGlow : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 11,
            color: COLORS.textMuted,
            fontFamily: font,
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}>{match.id}</span>
          <Badge color={match.group === "A" ? COLORS.blue : COLORS.green}>
            Group {match.group}
          </Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {winner ? (
            <Badge color={COLORS.green}>🏆 {teams[winner].name} wins</Badge>
          ) : allPlayed && isTied ? (
            <Badge color={COLORS.red}>⚡ Rally Needed</Badge>
          ) : (
            <Badge color={COLORS.textMuted}>In Progress</Badge>
          )}
        </div>
      </div>

      {/* Teams */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "16px 20px 8px",
        gap: 12,
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          color: winner === match.team1 ? COLORS.accent : COLORS.text,
          fontFamily: fontDisplay,
          textAlign: "left",
        }}>{teams[match.team1].name}</div>
        <div style={{
          fontSize: 24,
          fontWeight: 900,
          color: COLORS.textMuted,
          fontFamily: font,
          padding: "0 8px",
        }}>{t1pts} – {t2pts}</div>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          color: winner === match.team2 ? COLORS.accent : COLORS.text,
          fontFamily: fontDisplay,
          textAlign: "right",
        }}>{teams[match.team2].name}</div>
      </div>

      {/* Games */}
      <div style={{ padding: "8px 20px 16px" }}>
        {match.games.map((game, gi) => {
          const gameWon1 = game.score1 !== null && game.score2 !== null && game.score1 > game.score2;
          const gameWon2 = game.score1 !== null && game.score2 !== null && game.score2 > game.score1;
          return (
            <div key={gi} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 8,
              padding: "10px 0",
              borderTop: gi > 0 ? `1px solid ${COLORS.border}22` : "none",
            }}>
              {/* Left player + score */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PlayerInput
                  value={game.player1}
                  onChange={(v) => onUpdateGame(gi, "player1", v)}
                  placeholder={game.type === "Doubles" ? "Pair names" : "Player name"}
                />
                <ScoreInput
                  value={game.score1}
                  onChange={(v) => onUpdateGame(gi, "score1", v)}
                />
              </div>

              {/* Center label */}
              <div style={{
                textAlign: "center",
                minWidth: 80,
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.textMuted,
                  letterSpacing: "0.05em",
                  fontFamily: font,
                }}>{game.type}</div>
                <div style={{
                  fontSize: 10,
                  color: COLORS.textMuted,
                  fontFamily: font,
                  marginTop: 2,
                }}>
                  {game.type === "Doubles" ? "2 pts" : "1 pt"}
                  {gameWon1 && " ◀"}
                  {gameWon2 && " ▶"}
                </div>
              </div>

              {/* Right score + player */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <ScoreInput
                  value={game.score2}
                  onChange={(v) => onUpdateGame(gi, "score2", v)}
                />
                <PlayerInput
                  value={game.player2}
                  onChange={(v) => onUpdateGame(gi, "player2", v)}
                  placeholder={game.type === "Doubles" ? "Pair names" : "Player name"}
                />
              </div>
            </div>
          );
        })}

        {/* Rally Tiebreaker */}
        {isTied && allPlayed && (
          <div style={{
            marginTop: 12,
            padding: 16,
            background: `${COLORS.red}10`,
            borderRadius: 10,
            border: `1px solid ${COLORS.red}30`,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.red,
              marginBottom: 10,
              fontFamily: font,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>⚡ Rally Tiebreaker (First to 21)</div>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}>
              <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, fontFamily: font }}>
                {teams[match.team1].name}
              </span>
              <ScoreInput
                value={match.rallyTiebreaker?.score1 ?? null}
                onChange={(v) => onUpdateRally("score1", v)}
              />
              <span style={{ color: COLORS.textMuted, fontWeight: 800, fontSize: 16 }}>–</span>
              <ScoreInput
                value={match.rallyTiebreaker?.score2 ?? null}
                onChange={(v) => onUpdateRally("score2", v)}
              />
              <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 700, fontFamily: font }}>
                {teams[match.team2].name}
              </span>
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8, textAlign: "center", fontFamily: font }}>
              Rotation: Doubles pair → Singles 2 → Singles 1 (swap at 7 & 14)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Standings Table ──────────────────────────────────────────────────────────
function StandingsTable({ standings, teams, group }) {
  return (
    <div style={{
      background: COLORS.card,
      borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{
          fontSize: 15,
          fontWeight: 800,
          fontFamily: fontDisplay,
          color: COLORS.text,
        }}>Group {group}</span>
        <Badge color={group === "A" ? COLORS.blue : COLORS.green}>
          {standings.length} teams
        </Badge>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {["#", "Team", "W", "L", "Match Pts", "Game Score"].map((h) => (
                <th key={h} style={{
                  padding: "10px 16px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: COLORS.textMuted,
                  textAlign: h === "Team" ? "left" : "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.team} style={{
                borderBottom: `1px solid ${COLORS.border}22`,
                background: i < 2 ? `${COLORS.accent}08` : "transparent",
              }}>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 800, color: i < 2 ? COLORS.accent : COLORS.textMuted }}>
                  {i + 1}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                  {teams[s.team].name}
                  {i < 2 && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.green }}>▲ Qualifies</span>}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, fontWeight: 700, color: COLORS.green }}>{s.wins}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, fontWeight: 600, color: COLORS.red }}>{s.losses}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, fontWeight: 700, color: COLORS.text }}>{s.matchPts}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, fontWeight: 600, color: COLORS.textDim }}>{s.gameScores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Team Setup ───────────────────────────────────────────────────────────────
function TeamSetup({ teams, onUpdateTeam }) {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {Object.keys(teams).map((tk) => (
        <div key={tk} style={{
          background: COLORS.card,
          borderRadius: 14,
          border: `1px solid ${COLORS.border}`,
          padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Badge color={teams[tk].group === "A" ? COLORS.blue : COLORS.green}>
              Group {teams[tk].group}
            </Badge>
          </div>
          <input
            value={teams[tk].name}
            onChange={(e) => onUpdateTeam(tk, "name", e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.text,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: fontDisplay,
              marginBottom: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {teams[tk].players.map((p, pi) => (
            <input
              key={pi}
              value={p}
              onChange={(e) => {
                const np = [...teams[tk].players];
                np[pi] = e.target.value;
                onUpdateTeam(tk, "players", np);
              }}
              placeholder={`Player ${pi + 1}`}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                color: COLORS.textDim,
                fontSize: 13,
                fontFamily: font,
                marginBottom: 6,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function ChidiyaUddTournament() {
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [matches, setMatches] = useState(DEFAULT_MATCHES);
  const [tab, setTab] = useState("matches");
  const [groupFilter, setGroupFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // ── Load from storage ──
  useEffect(() => {
    (async () => {
      try {
        const tRes = await window.storage.get("chidiya-teams");
        if (tRes?.value) setTeams(JSON.parse(tRes.value));
      } catch {}
      try {
        const mRes = await window.storage.get("chidiya-matches");
        if (mRes?.value) setMatches(JSON.parse(mRes.value));
      } catch {}
    })();
  }, []);

  // ── Save to storage ──
  const saveData = useCallback(async (newTeams, newMatches) => {
    setSaving(true);
    try {
      await window.storage.set("chidiya-teams", JSON.stringify(newTeams || teams));
      await window.storage.set("chidiya-matches", JSON.stringify(newMatches || matches));
      setLastSaved(new Date().toLocaleTimeString());

      // ── FIREBASE SAVE (uncomment when deploying) ──
      // await setDoc(doc(db, "tournaments", "chidiya-udd"), {
      //   teams: newTeams || teams,
      //   matches: newMatches || matches,
      //   updatedAt: new Date().toISOString(),
      // });
    } catch (e) {
      console.error("Save error:", e);
    }
    setSaving(false);
  }, [teams, matches]);

  const updateTeam = (tk, field, value) => {
    const nt = { ...teams, [tk]: { ...teams[tk], [field]: value } };
    setTeams(nt);
    saveData(nt, null);
  };

  const updateGame = (matchIdx, gameIdx, field, value) => {
    const nm = matches.map((m, mi) => {
      if (mi !== matchIdx) return m;
      return {
        ...m,
        games: m.games.map((g, gi) => gi === gameIdx ? { ...g, [field]: value } : g),
      };
    });
    setMatches(nm);
    saveData(null, nm);
  };

  const updateRally = (matchIdx, field, value) => {
    const nm = matches.map((m, mi) => {
      if (mi !== matchIdx) return m;
      return {
        ...m,
        rallyTiebreaker: { ...(m.rallyTiebreaker || { score1: null, score2: null }), [field]: value },
      };
    });
    setMatches(nm);
    saveData(null, nm);
  };

  // ── CSV Export ──
  const downloadCSV = () => {
    const rows = [["Match ID", "Group", "Team 1", "Team 2", "Game", "Player 1", "Score 1", "Score 2", "Player 2", "Game Winner", "Match Winner"]];
    matches.forEach((m) => {
      const mWinner = getMatchWinner(m);
      m.games.forEach((g) => {
        let gWinner = "";
        if (g.score1 !== null && g.score2 !== null) {
          gWinner = g.score1 > g.score2 ? teams[m.team1].name : g.score2 > g.score1 ? teams[m.team2].name : "Draw";
        }
        rows.push([
          m.id, `Group ${m.group}`, teams[m.team1].name, teams[m.team2].name,
          g.type, g.player1 || "-", g.score1 ?? "-", g.score2 ?? "-", g.player2 || "-",
          gWinner || "-", mWinner ? teams[mWinner].name : "-",
        ]);
      });
      if (m.rallyTiebreaker) {
        rows.push([
          m.id, `Group ${m.group}`, teams[m.team1].name, teams[m.team2].name,
          "Rally Tiebreaker", "-", m.rallyTiebreaker.score1 ?? "-", m.rallyTiebreaker.score2 ?? "-", "-",
          mWinner ? teams[mWinner].name : "-", mWinner ? teams[mWinner].name : "-",
        ]);
      }
    });

    // Standings
    rows.push([]);
    rows.push(["STANDINGS"]);
    rows.push(["Group", "Rank", "Team", "Wins", "Losses", "Match Points", "Game Scores"]);
    ["A", "B"].forEach((g) => {
      computeStandings(matches, teams, g).forEach((s, i) => {
        rows.push([`Group ${g}`, i + 1, teams[s.team].name, s.wins, s.losses, s.matchPts, s.gameScores]);
      });
    });

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chidiya-udd-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const standingsA = useMemo(() => computeStandings(matches, teams, "A"), [matches, teams]);
  const standingsB = useMemo(() => computeStandings(matches, teams, "B"), [matches, teams]);

  const filteredMatches = groupFilter === "all" ? matches : matches.filter((m) => m.group === groupFilter);

  const completedMatches = matches.filter((m) => m.games.every((g) => g.score1 !== null && g.score2 !== null)).length;
  const totalGamesPlayed = matches.reduce((acc, m) => acc + m.games.filter((g) => g.score1 !== null && g.score2 !== null).length, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: font,
      padding: "0 0 60px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet" />

      {/* Hero */}
      <div style={{
        padding: "40px 24px 32px",
        textAlign: "center",
        background: `linear-gradient(180deg, ${COLORS.accent}0A 0%, transparent 100%)`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🏸</div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 900,
          fontFamily: fontDisplay,
          color: COLORS.accent,
          margin: "0 0 6px",
          letterSpacing: "-0.02em",
        }}>CHIDIYA UDD</h1>
        <p style={{
          fontSize: 13,
          color: COLORS.textMuted,
          margin: 0,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}>Tournament Manager</p>

        {/* Stats bar */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginTop: 20,
          flexWrap: "wrap",
        }}>
          {[
            { label: "Matches", value: `${completedMatches}/6` },
            { label: "Games Played", value: totalGamesPlayed },
            { label: "Teams", value: 6 },
          ].map((s) => (
            <div key={s.label} style={{
              padding: "8px 16px",
              background: COLORS.surface,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{s.value}</div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}>
          <TabBar
            tabs={[
              { key: "matches", label: "🏸 Matches" },
              { key: "standings", label: "📊 Standings" },
              { key: "teams", label: "👥 Teams" },
            ]}
            active={tab}
            onChange={setTab}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {lastSaved && (
              <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: font }}>
                {saving ? "Saving..." : `Saved ${lastSaved}`}
              </span>
            )}
            <button onClick={downloadCSV} style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: `1px solid ${COLORS.accent}40`,
              background: `${COLORS.accent}15`,
              color: COLORS.accent,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: font,
              cursor: "pointer",
              letterSpacing: "0.04em",
              transition: "all 0.2s",
            }}
              onMouseEnter={(e) => { e.target.style.background = `${COLORS.accent}30`; }}
              onMouseLeave={(e) => { e.target.style.background = `${COLORS.accent}15`; }}
            >⬇ Download CSV</button>
          </div>
        </div>

        {/* Matches Tab */}
        {tab === "matches" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <TabBar
                tabs={[
                  { key: "all", label: "All Matches" },
                  { key: "A", label: "Group A" },
                  { key: "B", label: "Group B" },
                ]}
                active={groupFilter}
                onChange={setGroupFilter}
              />
            </div>
            <div style={{ display: "grid", gap: 20 }}>
              {filteredMatches.map((m, mi) => {
                const realIdx = matches.indexOf(m);
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    teams={teams}
                    onUpdateGame={(gi, field, val) => updateGame(realIdx, gi, field, val)}
                    onUpdateRally={(field, val) => updateRally(realIdx, field, val)}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Standings Tab */}
        {tab === "standings" && (
          <div style={{ display: "grid", gap: 20 }}>
            <StandingsTable standings={standingsA} teams={teams} group="A" />
            <StandingsTable standings={standingsB} teams={teams} group="B" />
            <div style={{
              padding: 16,
              background: COLORS.surface,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              fontSize: 12,
              color: COLORS.textMuted,
              fontFamily: font,
              lineHeight: 1.7,
            }}>
              <strong style={{ color: COLORS.text }}>Tiebreaker Rules:</strong> If teams are tied on wins,
              they're separated by total match points (excluding rally tiebreakers). If still tied,
              total game scores are used (also excluding rally tiebreaker scores). Top 2 from each group advance.
            </div>
          </div>
        )}

        {/* Teams Tab */}
        {tab === "teams" && (
          <TeamSetup teams={teams} onUpdateTeam={updateTeam} />
        )}
      </div>

      {/* Firebase Status Footer */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "8px 16px",
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        zIndex: 100,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS.accent,
        }} />
        <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: font }}>
          Local Storage Active — Uncomment Firebase config to enable cloud sync
        </span>
      </div>
    </div>
  );
}