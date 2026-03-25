import React, { useState, useEffect, useCallback } from "react";

// --- FIRESTORE REST API ---
const PROJECT_ID = "badminton-tournament-153ae";
const API_KEY = "AIzaSyDNItwTcjcQte8qDHNvB6giuq635lCx4qU";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const api = {
  async listTournaments() {
    try {
      const res = await fetch(`${BASE}/tournaments?key=${API_KEY}`);
      const data = await res.json();
      if (!data.documents) return [];
      return data.documents.map((d) => {
        const parsed = JSON.parse(d.fields.tournament.stringValue);
        const id = d.name.split("/").pop();
        return { id, ...parsed, updatedAt: d.fields.updatedAt?.stringValue || "" };
      });
    } catch (err) { console.error("List error:", err); return []; }
  },

  async saveTournament(id, data) {
    try {
      await fetch(`${BASE}/tournaments/${id}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            tournament: { stringValue: JSON.stringify(data) },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });
      return true;
    } catch (err) { console.error("Save error:", err); return false; }
  },

  async loadTournament(id) {
    try {
      const res = await fetch(`${BASE}/tournaments/${id}?key=${API_KEY}`);
      if (res.status === 404) return null;
      const data = await res.json();
      return data.fields?.tournament?.stringValue ? JSON.parse(data.fields.tournament.stringValue) : null;
    } catch (err) { console.error("Load error:", err); return null; }
  },

  async deleteTournament(id) {
    try { await fetch(`${BASE}/tournaments/${id}?key=${API_KEY}`, { method: "DELETE" }); return true; }
    catch (err) { console.error("Delete error:", err); return false; }
  },
};

// --- HELPERS ---
const genId = () => "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const createEmptyTeams = (count, perGroup) => {
  const teams = [];
  const groupCount = Math.ceil(count / perGroup);
  const groups = "ABCDEFGH".split("");
  for (let i = 0; i < count; i++) {
    teams.push({ id: i + 1, name: `Team ${i + 1}`, players: ["Player 1", "Player 2", "Player 3", "Player 4"], group: groups[Math.floor(i / perGroup)] || "A" });
  }
  return teams;
};

const createMatches = (teams) => {
  const groups = [...new Set(teams.map((t) => t.group))];
  const matches = [];
  groups.forEach((g) => {
    const grp = teams.filter((t) => t.group === g);
    for (let i = 0; i < grp.length; i++)
      for (let j = i + 1; j < grp.length; j++)
        matches.push({
          id: `${g}-${grp[i].id}-${grp[j].id}`, group: g, team1Id: grp[i].id, team2Id: grp[j].id,
          games: [
            { type: "Singles 1", pointsWorth: 1, team1Player: "", team2Player: "", team1Score: 0, team2Score: 0, completed: false },
            { type: "Singles 2", pointsWorth: 1, team1Player: "", team2Player: "", team1Score: 0, team2Score: 0, completed: false },
            { type: "Doubles", pointsWorth: 2, team1Players: "", team2Players: "", team1Score: 0, team2Score: 0, completed: false },
          ],
          tiebreaker: null, completed: false,
        });
  });
  return matches;
};

const Badge = ({ children, variant = "default" }) => {
  const c = { default: { bg: "#1a1a2e", color: "#e0e0e0", border: "#333" }, live: { bg: "#ff4444", color: "#fff", border: "#ff4444" }, done: { bg: "#00c853", color: "#fff", border: "#00c853" }, pending: { bg: "#2a2a3e", color: "#888", border: "#444" }, edit: { bg: "#ff8c00", color: "#fff", border: "#ff8c00" } }[variant] || { bg: "#1a1a2e", color: "#e0e0e0", border: "#333" };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, textTransform: "uppercase", letterSpacing: 1 }}>{children}</span>;
};

const SyncIndicator = ({ status }) => {
  const c = { synced: { color: "#00c853", text: "Synced", icon: "☁️" }, saving: { color: "#ffd700", text: "Saving...", icon: "⏳" }, offline: { color: "#ff4444", text: "Offline", icon: "⚠️" }, loading: { color: "#2196f3", text: "Loading...", icon: "🔄" } }[status] || { color: "#00c853", text: "Synced", icon: "☁️" };
  return <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 999, background: "#1a1a2e", border: `1px solid ${c.color}44`, borderRadius: 10, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.color, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}><span>{c.icon}</span><span>{c.text}</span><span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, animation: status === "saving" ? "pulse 1s infinite" : "none" }} /></div>;
};

// ==============================
//  HOME — TOURNAMENT LIST
// ==============================
const HomeScreen = ({ onCreateNew, tournaments, onOpen, onDelete, loading }) => {
  const completed = (t) => { const total = t.matches?.length || 0; const done = (t.matches || []).filter((m) => m.completed).length; return { total, done }; };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🏸</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: "#ffd700", margin: 0, letterSpacing: 4 }}>OFFICE BADMINTON</h1>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#ff6b6b", margin: "4px 0 0", letterSpacing: 6 }}>SHOWDOWN</h2>
        <p style={{ color: "#555", fontSize: 13, marginTop: 12 }}>Manage all your tournaments in one place. May the best team win!</p>
      </div>

      <button onClick={onCreateNew} style={{ width: "100%", background: "linear-gradient(135deg, #ffd700, #ff8c00)", color: "#1a1a2e", border: "none", borderRadius: 14, padding: "18px 32px", fontSize: 20, fontWeight: 800, cursor: "pointer", letterSpacing: 2, fontFamily: "'Bebas Neue', sans-serif", boxShadow: "0 4px 24px #ffd70044", marginBottom: 32, transition: "transform 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "")}>
        + CREATE NEW TOURNAMENT
      </button>

      {loading && <div style={{ textAlign: "center", color: "#666", padding: 40 }}>Loading tournaments...</div>}

      {!loading && tournaments.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, background: "#1a1a2e", borderRadius: 16, border: "1px solid #333" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏟️</div>
          <p style={{ color: "#666", fontSize: 14 }}>No tournaments yet. Create your first one!</p>
          <p style={{ color: "#333", fontSize: 11, fontStyle: "italic", marginTop: 16 }}>Why did the shuttlecock go to therapy? It was tired of getting smashed. 🥁</p>
        </div>
      )}

      {tournaments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>YOUR TOURNAMENTS ({tournaments.length})</div>
          {tournaments.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).map((t) => {
            const { total, done } = completed(t);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const allDone = done === total && total > 0;
            const teamCount = t.teams?.length || 0;
            const groupCount = [...new Set((t.teams || []).map((x) => x.group))].length;

            return (
              <div key={t.id} style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, border: allDone ? "1px solid #00c85333" : "1px solid #333", transition: "transform 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#ffd700", margin: 0, letterSpacing: 2 }}>{t.tournamentName || "Unnamed Tournament"}</h3>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "#666" }}>
                      <span>👥 {teamCount} teams</span>
                      <span>📂 {groupCount} groups</span>
                      <span>🏸 {done}/{total} matches</span>
                    </div>
                  </div>
                  <Badge variant={allDone ? "done" : done > 0 ? "live" : "pending"}>
                    {allDone ? "Finished" : done > 0 ? "In Progress" : "Not Started"}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div style={{ background: "#0d0d1a", borderRadius: 6, height: 6, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ height: "100%", borderRadius: 6, width: `${pct}%`, background: allDone ? "#00c853" : "linear-gradient(90deg, #ffd700, #ff8c00)", transition: "width 0.3s" }} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onOpen(t.id)} style={{ flex: 1, background: "#ffd700", color: "#1a1a2e", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
                    {done > 0 ? "RESUME" : "OPEN"} →
                  </button>
                  <button onClick={() => { if (window.confirm(`Delete "${t.tournamentName}"? This cannot be undone!`)) onDelete(t.id); }}
                    style={{ background: "#1a1a2e", color: "#ff444488", border: "1px solid #ff444433", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==============================
//  CONFIG SCREEN
// ==============================
const ConfigScreen = ({ onNext, onBack }) => {
  const [tournamentName, setTournamentName] = useState("Office Badminton Showdown");
  const [teamCount, setTeamCount] = useState(6);
  const [teamsPerGroup, setTeamsPerGroup] = useState(3);
  const groupCount = Math.ceil(teamCount / teamsPerGroup);
  const groups = "ABCDEFGH".split("").slice(0, groupCount);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#888", fontSize: 14, cursor: "pointer", marginBottom: 24 }}>← Back</button>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>⚙️</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#ffd700", margin: 0, letterSpacing: 3 }}>NEW TOURNAMENT</h1>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: "1px solid #333" }}>
          <label style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tournament Name</label>
          <input value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} style={{ background: "#0d0d1a", border: "1px solid #444", borderRadius: 8, color: "#fff", fontSize: 16, width: "100%", padding: "12px 14px", outline: "none", boxSizing: "border-box", fontWeight: 600 }} />
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: "1px solid #333" }}>
          <label style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Number of Teams</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[4, 5, 6, 8, 9, 10, 12].map((n) => (
              <button key={n} onClick={() => { setTeamCount(n); if (n <= 4) setTeamsPerGroup(Math.min(teamsPerGroup, n)); }}
                style={{ background: teamCount === n ? "#ffd700" : "#0d0d1a", color: teamCount === n ? "#1a1a2e" : "#888", border: `1px solid ${teamCount === n ? "#ffd700" : "#444"}`, borderRadius: 8, padding: "10px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", minWidth: 48 }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: "1px solid #333" }}>
          <label style={{ fontSize: 11, color: "#888", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Teams Per Group</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[2, 3, 4, 5].filter((n) => n <= teamCount).map((n) => (
              <button key={n} onClick={() => setTeamsPerGroup(n)} style={{ background: teamsPerGroup === n ? "#4ecdc4" : "#0d0d1a", color: teamsPerGroup === n ? "#1a1a2e" : "#888", border: `1px solid ${teamsPerGroup === n ? "#4ecdc4" : "#444"}`, borderRadius: 8, padding: "10px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", minWidth: 48 }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: "1px solid #ffd70033" }}>
          <div style={{ fontSize: 11, color: "#ffd700", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>PREVIEW</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {groups.map((g, gi) => { const count = gi < groupCount - 1 ? teamsPerGroup : teamCount % teamsPerGroup === 0 ? teamsPerGroup : teamCount % teamsPerGroup; return (<div key={g} style={{ background: "#0d0d1a", borderRadius: 8, padding: "12px 16px", flex: "1 1 120px" }}><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: gi % 2 === 0 ? "#ff6b6b" : "#4ecdc4" }}>Group {g}</div><div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{count} teams · {(count * (count - 1)) / 2} matches</div></div>); })}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button onClick={() => onNext({ tournamentName, teamCount, teamsPerGroup })} style={{ background: "linear-gradient(135deg, #ffd700, #ff8c00)", color: "#1a1a2e", border: "none", borderRadius: 12, padding: "16px 48px", fontSize: 20, fontWeight: 800, cursor: "pointer", letterSpacing: 2, fontFamily: "'Bebas Neue', sans-serif", boxShadow: "0 4px 24px #ffd70055" }}>NEXT: SET UP TEAMS →</button>
      </div>
    </div>
  );
};

// ==============================
//  TEAM SETUP
// ==============================
const SetupScreen = ({ teams, setTeams, onStart, onBack }) => {
  const [editingTeams, setEditingTeams] = useState(JSON.parse(JSON.stringify(teams)));
  const groups = [...new Set(editingTeams.map((t) => t.group))];
  const gc = ["#ff6b6b", "#4ecdc4", "#a29bfe", "#fdcb6e", "#e17055", "#00b894", "#6c5ce7", "#fd79a8"];
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#888", fontSize: 14, cursor: "pointer", marginBottom: 24 }}>← Back</button>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#ffd700", margin: 0, letterSpacing: 3 }}>NAME YOUR WARRIORS</h1>
        <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>Fill in team and player names.</p>
      </div>
      {groups.map((group, gi) => (
        <div key={group} style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: gc[gi % gc.length], letterSpacing: 2, marginBottom: 16 }}>GROUP {group}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {editingTeams.filter((t) => t.group === group).map((team) => (
              <div key={team.id} style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, border: `1px solid ${gc[gi % gc.length]}33` }}>
                <input value={team.name} onChange={(e) => setEditingTeams((p) => p.map((t) => t.id === team.id ? { ...t, name: e.target.value } : t))}
                  style={{ background: "transparent", border: "none", borderBottom: `2px solid ${gc[gi % gc.length]}44`, color: "#fff", fontSize: 18, fontWeight: 700, width: "100%", padding: "4px 0", marginBottom: 16, outline: "none", fontFamily: "'Bebas Neue', sans-serif", boxSizing: "border-box" }} />
                {team.players.map((p, i) => (
                  <input key={i} value={p} placeholder={`Player ${i + 1}`} onChange={(e) => setEditingTeams((pr) => pr.map((t) => { if (t.id !== team.id) return t; const pl = [...t.players]; pl[i] = e.target.value; return { ...t, players: pl }; }))}
                    style={{ background: "#0d0d1a", border: "1px solid #333", borderRadius: 8, color: "#ccc", fontSize: 13, width: "100%", padding: "8px 12px", marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button onClick={() => { setTeams(editingTeams); onStart(editingTeams); }} style={{ background: "linear-gradient(135deg, #ffd700, #ff8c00)", color: "#1a1a2e", border: "none", borderRadius: 12, padding: "16px 48px", fontSize: 20, fontWeight: 800, cursor: "pointer", letterSpacing: 2, fontFamily: "'Bebas Neue', sans-serif", boxShadow: "0 4px 24px #ffd70055" }}>START TOURNAMENT 🏸</button>
      </div>
    </div>
  );
};

// ==============================
//  SCORING MODAL
// ==============================
const ScoringModal = ({ match, teams, onSave, onClose }) => {
  const [lm, setLm] = useState(JSON.parse(JSON.stringify(match)));
  const [editMode, setEditMode] = useState(false);
  const t1 = teams.find((t) => t.id === match.team1Id), t2 = teams.find((t) => t.id === match.team2Id);
  const uT1 = [], uT2 = [];
  lm.games.forEach((g, i) => { if (i < 2) { if (g.team1Player) uT1.push(g.team1Player); if (g.team2Player) uT2.push(g.team2Player); } });
  const ug = (gi, f, v) => setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.games[gi][f] = v; return m; });
  const md = (gi) => setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.games[gi].completed = true; return m; });
  const rg = (gi) => { setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.games[gi].completed = false; m.completed = false; m.tiebreaker = null; return m; }); setEditMode(true); };
  const rm = () => { setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.completed = false; m.tiebreaker = null; return m; }); setEditMode(true); };
  const cp = (m) => { let a = 0, b = 0; m.games.forEach((g) => { if (g.completed) { if (g.team1Score > g.team2Score) a += g.pointsWorth; else if (g.team2Score > g.team1Score) b += g.pointsWorth; } }); return [a, b]; };
  const allDone = lm.games.every((g) => g.completed);
  const [p1, p2] = cp(lm);
  const tied = allDone && p1 === p2;
  const stb = () => setLm((p) => ({ ...p, tiebreaker: { phases: [{ team1Score: 0, team2Score: 0, label: "Phase 1 (0→5): Doubles players" }, { team1Score: 0, team2Score: 0, label: "Phase 2 (5→10): Singles 2 players" }, { team1Score: 0, team2Score: 0, label: "Phase 3 (10→15): Singles 1 players" }], team1Total: 0, team2Total: 0, completed: false, winner: null } }));
  const utb = (pi, f, v) => setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.tiebreaker.phases[pi][f] = Math.max(0, Math.min(5, parseInt(v) || 0)); let a = 0, b = 0; m.tiebreaker.phases.forEach((x) => { a += x.team1Score; b += x.team2Score; }); m.tiebreaker.team1Total = a; m.tiebreaker.team2Total = b; return m; });
  const ctb = () => setLm((p) => { const m = JSON.parse(JSON.stringify(p)); m.tiebreaker.completed = true; m.tiebreaker.winner = m.tiebreaker.team1Total > m.tiebreaker.team2Total ? match.team1Id : match.team2Id; m.completed = true; return m; });
  const save = () => { const m = { ...lm }; if (allDone && !tied) m.completed = true; setEditMode(false); onSave(m); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div style={{ background: "#12121f", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", border: "1px solid #333" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#12121f", zIndex: 2, borderRadius: "16px 16px 0 0" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#888", letterSpacing: 1 }}>GROUP {match.group}</span>
              {editMode && <Badge variant="edit">Editing</Badge>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Bebas Neue', sans-serif" }}>
              <span style={{ color: "#ff6b6b" }}>{t1.name}</span><span style={{ color: "#555", margin: "0 8px" }}>vs</span><span style={{ color: "#4ecdc4" }}>{t2.name}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#333", border: "none", color: "#aaa", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {match.completed && !editMode && (
            <div style={{ background: "#2a1a0e", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #ff8c0044", textAlign: "center" }}>
              <p style={{ color: "#ffaa44", fontSize: 13, margin: "0 0 12px" }}>Need to fix a score?</p>
              <button onClick={rm} style={{ background: "#ff8c00", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>✏️ EDIT SCORES</button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, padding: 16, background: "#1a1a2e", borderRadius: 12, marginBottom: 24 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 36, fontWeight: 900, color: "#ff6b6b", fontFamily: "'Bebas Neue', sans-serif" }}>{p1}</div><div style={{ fontSize: 11, color: "#888" }}>POINTS</div></div>
            <div style={{ fontSize: 14, color: "#555", fontWeight: 700 }}>—</div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 36, fontWeight: 900, color: "#4ecdc4", fontFamily: "'Bebas Neue', sans-serif" }}>{p2}</div><div style={{ fontSize: 11, color: "#888" }}>POINTS</div></div>
          </div>
          {lm.games.map((g, gi) => {
            const locked = g.completed && !editMode;
            return (
              <div key={gi} style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 16, border: g.completed ? "1px solid #00c85344" : "1px solid #333" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{g.type}</span><Badge variant={g.completed ? "done" : "pending"}>{g.completed ? "Done" : `${g.pointsWorth} pt${g.pointsWorth > 1 ? "s" : ""}`}</Badge></div>
                  {g.completed && !editMode && <button onClick={() => rg(gi)} style={{ background: "transparent", border: "1px solid #ff8c0066", borderRadius: 6, color: "#ff8c00", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>✏️ Edit</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {gi < 2 ? (<>
                    <select value={g.team1Player} onChange={(e) => ug(gi, "team1Player", e.target.value)} disabled={locked} style={{ background: "#0d0d1a", border: "1px solid #ff6b6b44", borderRadius: 8, color: "#ff6b6b", padding: "8px 10px", fontSize: 13, outline: "none", opacity: locked ? 0.5 : 1 }}>
                      <option value="">{t1.name} player...</option>{t1.players.map((p, pi) => <option key={pi} value={p} disabled={uT1.includes(p) && g.team1Player !== p}>{p}</option>)}
                    </select>
                    <select value={g.team2Player} onChange={(e) => ug(gi, "team2Player", e.target.value)} disabled={locked} style={{ background: "#0d0d1a", border: "1px solid #4ecdc444", borderRadius: 8, color: "#4ecdc4", padding: "8px 10px", fontSize: 13, outline: "none", opacity: locked ? 0.5 : 1 }}>
                      <option value="">{t2.name} player...</option>{t2.players.map((p, pi) => <option key={pi} value={p} disabled={uT2.includes(p) && g.team2Player !== p}>{p}</option>)}
                    </select>
                  </>) : (<>
                    <input value={g.team1Players || ""} onChange={(e) => ug(gi, "team1Players", e.target.value)} disabled={locked} placeholder={`${t1.name} pair`} style={{ background: "#0d0d1a", border: "1px solid #ff6b6b44", borderRadius: 8, color: "#ff6b6b", padding: "8px 10px", fontSize: 13, outline: "none", opacity: locked ? 0.5 : 1 }} />
                    <input value={g.team2Players || ""} onChange={(e) => ug(gi, "team2Players", e.target.value)} disabled={locked} placeholder={`${t2.name} pair`} style={{ background: "#0d0d1a", border: "1px solid #4ecdc444", borderRadius: 8, color: "#4ecdc4", padding: "8px 10px", fontSize: 13, outline: "none", opacity: locked ? 0.5 : 1 }} />
                  </>)}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#ff6b6b", fontWeight: 600 }}>{t1.name.substring(0, 6)}</span>
                    <input type="number" min="0" max="30" value={g.team1Score} onChange={(e) => ug(gi, "team1Score", parseInt(e.target.value) || 0)} disabled={locked}
                      style={{ background: "#0d0d1a", border: "2px solid #ff6b6b44", borderRadius: 8, color: "#ff6b6b", fontSize: 24, fontWeight: 900, width: 64, textAlign: "center", padding: "8px 4px", outline: "none", fontFamily: "'Bebas Neue', sans-serif", opacity: locked ? 0.5 : 1 }} />
                  </div>
                  <span style={{ color: "#555", fontWeight: 700, fontSize: 18 }}>:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min="0" max="30" value={g.team2Score} onChange={(e) => ug(gi, "team2Score", parseInt(e.target.value) || 0)} disabled={locked}
                      style={{ background: "#0d0d1a", border: "2px solid #4ecdc444", borderRadius: 8, color: "#4ecdc4", fontSize: 24, fontWeight: 900, width: 64, textAlign: "center", padding: "8px 4px", outline: "none", fontFamily: "'Bebas Neue', sans-serif", opacity: locked ? 0.5 : 1 }} />
                    <span style={{ fontSize: 12, color: "#4ecdc4", fontWeight: 600 }}>{t2.name.substring(0, 6)}</span>
                  </div>
                </div>
                {!g.completed && <div style={{ textAlign: "center", marginTop: 12 }}><button onClick={() => md(gi)} style={{ background: "#00c853", color: "#fff", border: "none", borderRadius: 8, padding: "6px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Finish Game</button></div>}
              </div>
            );
          })}
          {tied && !lm.tiebreaker?.completed && !lm.tiebreaker && (
            <div style={{ textAlign: "center", padding: 24, background: "#2a1a0e", borderRadius: 12, border: "1px solid #ffd70044" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ffd700", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, marginBottom: 8 }}>IT'S A TIE! 2 - 2</div>
              <button onClick={stb} style={{ background: "linear-gradient(135deg, #ffd700, #ff8c00)", color: "#1a1a2e", border: "none", borderRadius: 10, padding: "10px 32px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>START TIEBREAKER 🔥</button>
            </div>
          )}
          {lm.tiebreaker && !lm.tiebreaker.completed && (
            <div style={{ background: "#2a1a0e", borderRadius: 12, padding: 20, border: "1px solid #ffd70044" }}>
              <h3 style={{ color: "#ffd700", margin: "0 0 16px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, textAlign: "center" }}>RALLY TIEBREAKER — FIRST TO 15</h3>
              {lm.tiebreaker.phases.map((ph, pi) => (
                <div key={pi} style={{ marginBottom: 12, padding: 12, background: "#1a1a2e", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>{ph.label}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <input type="number" min="0" max="5" value={ph.team1Score} onChange={(e) => utb(pi, "team1Score", e.target.value)} style={{ background: "#0d0d1a", border: "2px solid #ff6b6b44", borderRadius: 8, color: "#ff6b6b", fontSize: 22, fontWeight: 900, width: 56, textAlign: "center", padding: "6px 4px", outline: "none", fontFamily: "'Bebas Neue', sans-serif" }} />
                    <span style={{ color: "#555" }}>:</span>
                    <input type="number" min="0" max="5" value={ph.team2Score} onChange={(e) => utb(pi, "team2Score", e.target.value)} style={{ background: "#0d0d1a", border: "2px solid #4ecdc444", borderRadius: 8, color: "#4ecdc4", fontSize: 22, fontWeight: 900, width: 56, textAlign: "center", padding: "6px 4px", outline: "none", fontFamily: "'Bebas Neue', sans-serif" }} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, padding: 12, background: "#0d0d1a", borderRadius: 8 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "#ff6b6b", fontFamily: "'Bebas Neue', sans-serif" }}>{lm.tiebreaker.team1Total}</div><div style={{ fontSize: 10, color: "#888" }}>TOTAL</div></div>
                <div style={{ color: "#555", fontSize: 20, fontWeight: 700, lineHeight: "32px" }}>—</div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "#4ecdc4", fontFamily: "'Bebas Neue', sans-serif" }}>{lm.tiebreaker.team2Total}</div><div style={{ fontSize: 10, color: "#888" }}>TOTAL</div></div>
              </div>
              {lm.tiebreaker.team1Total !== lm.tiebreaker.team2Total && (lm.tiebreaker.team1Total >= 15 || lm.tiebreaker.team2Total >= 15) && (
                <div style={{ textAlign: "center", marginTop: 16 }}><button onClick={ctb} style={{ background: "#00c853", color: "#fff", border: "none", borderRadius: 10, padding: "10px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>CONFIRM WINNER</button></div>
              )}
            </div>
          )}
          {lm.tiebreaker?.completed && (
            <div style={{ textAlign: "center", padding: 16, background: "#1a2e1a", borderRadius: 12, border: "1px solid #00c85344" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#00c853", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>TIEBREAKER WON BY {teams.find((t) => t.id === lm.tiebreaker.winner)?.name.toUpperCase()}</div>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={onClose} style={{ background: "#333", color: "#aaa", border: "none", borderRadius: 10, padding: "12px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} style={{ background: "linear-gradient(135deg, #ffd700, #ff8c00)", color: "#1a1a2e", border: "none", borderRadius: 10, padding: "12px 32px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{editMode ? "💾 Save Changes" : "Save Match"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==============================
//  STANDINGS
// ==============================
const StandingsTable = ({ group, teams, matches, groupColorIdx }) => {
  const gc = ["#ff6b6b", "#4ecdc4", "#a29bfe", "#fdcb6e", "#e17055", "#00b894"];
  const hc = gc[groupColorIdx % gc.length];
  const gt = teams.filter((t) => t.group === group), gm = matches.filter((m) => m.group === group);
  const st = gt.map((team) => {
    let w = 0, l = 0, mp = 0, ts = 0;
    gm.forEach((m) => { if (!m.completed) return; const i1 = m.team1Id === team.id, i2 = m.team2Id === team.id; if (!i1 && !i2) return; let a = 0, b = 0, c = 0, d = 0; m.games.forEach((g) => { if (g.completed) { c += g.team1Score; d += g.team2Score; if (g.team1Score > g.team2Score) a += g.pointsWorth; else if (g.team2Score > g.team1Score) b += g.pointsWorth; } }); if (i1) { mp += a; ts += c; if (a > b) w++; else if (b > a) l++; else if (m.tiebreaker?.completed) { m.tiebreaker.winner === team.id ? w++ : l++; } } else { mp += b; ts += d; if (b > a) w++; else if (a > b) l++; else if (m.tiebreaker?.completed) { m.tiebreaker.winner === team.id ? w++ : l++; } } });
    return { ...team, w, l, mp, ts };
  }).sort((a, b) => b.w - a.w || b.mp - a.mp || b.ts - a.ts);
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: hc, letterSpacing: 2, marginBottom: 12 }}>GROUP {group} STANDINGS</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `2px solid ${hc}44` }}>{["#", "Team", "W", "L", "Pts", "Score"].map((h) => <th key={h} style={{ padding: "8px 12px", textAlign: h === "Team" ? "left" : "center", color: "#888", fontWeight: 600, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{st.map((t, i) => <tr key={t.id} style={{ borderBottom: "1px solid #222", background: i === 0 ? `${hc}0a` : "transparent" }}>
            <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: i === 0 ? "#ffd700" : "#666" }}>{i + 1}</td>
            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#eee" }}>{t.name}</td>
            <td style={{ padding: "10px 12px", textAlign: "center", color: "#00c853", fontWeight: 700 }}>{t.w}</td>
            <td style={{ padding: "10px 12px", textAlign: "center", color: "#ff4444", fontWeight: 700 }}>{t.l}</td>
            <td style={{ padding: "10px 12px", textAlign: "center", color: "#ffd700", fontWeight: 700 }}>{t.mp}</td>
            <td style={{ padding: "10px 12px", textAlign: "center", color: "#aaa" }}>{t.ts}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

// ==============================
//  MATCH CARD
// ==============================
const MatchCard = ({ match, teams, onClick }) => {
  const t1 = teams.find((t) => t.id === match.team1Id), t2 = teams.find((t) => t.id === match.team2Id);
  let a = 0, b = 0; match.games.forEach((g) => { if (g.completed) { if (g.team1Score > g.team2Score) a += g.pointsWorth; else if (g.team2Score > g.team1Score) b += g.pointsWorth; } });
  const started = match.games.some((g) => g.completed);
  return (
    <div onClick={onClick} style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, cursor: "pointer", border: match.completed ? "1px solid #00c85333" : started ? "1px solid #ffd70033" : "1px solid #333", transition: "transform 0.15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Badge>Group {match.group}</Badge>
        <div style={{ display: "flex", gap: 6 }}>
          {match.completed && <Badge variant="edit">✏️ Editable</Badge>}
          <Badge variant={match.completed ? "done" : started ? "live" : "pending"}>{match.completed ? "Completed" : started ? "In Progress" : "Upcoming"}</Badge>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#ff6b6b", fontFamily: "'Bebas Neue', sans-serif" }}>{t1.name}</div></div>
        <div style={{ padding: "0 16px", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: match.completed && a > b ? "#ffd700" : "#ff6b6b", fontFamily: "'Bebas Neue', sans-serif" }}>{a}</span>
            <span style={{ color: "#555", fontSize: 16 }}>-</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: match.completed && b > a ? "#ffd700" : "#4ecdc4", fontFamily: "'Bebas Neue', sans-serif" }}>{b}</span>
          </div>
          {match.tiebreaker?.completed && <div style={{ fontSize: 9, color: "#ffd700", letterSpacing: 1 }}>TIEBREAKER</div>}
        </div>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#4ecdc4", fontFamily: "'Bebas Neue', sans-serif" }}>{t2.name}</div></div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
        {match.games.map((g, i) => <div key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "#0d0d1a", color: g.completed ? "#ccc" : "#555" }}>{g.completed ? `${g.team1Score}-${g.team2Score}` : g.type}</div>)}
      </div>
    </div>
  );
};

// ==============================
//  MAIN APP
// ==============================
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [allTournaments, setAllTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);
  const [config, setConfig] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tournamentName, setTournamentName] = useState("");
  const [activeMatch, setActiveMatch] = useState(null);
  const [tab, setTab] = useState("matches");
  const [syncStatus, setSyncStatus] = useState("loading");
  const [listLoading, setListLoading] = useState(true);

  // Load tournament list on mount
  useEffect(() => {
    (async () => {
      const list = await api.listTournaments();
      setAllTournaments(list);
      setListLoading(false);
      setScreen("home");
      setSyncStatus("synced");
    })();
  }, []);

  const refreshList = async () => {
    const list = await api.listTournaments();
    setAllTournaments(list);
  };

  // Auto-refresh active tournament every 10s
  useEffect(() => {
    if (screen !== "tournament" || !activeTournamentId) return;
    const interval = setInterval(async () => {
      const data = await api.loadTournament(activeTournamentId);
      if (data) { setTeams(data.teams || []); setMatches(data.matches || []); setTournamentName(data.tournamentName || ""); }
    }, 10000);
    return () => clearInterval(interval);
  }, [screen, activeTournamentId]);

  const saveToCloud = async (id, t, m, name, cfg) => {
    setSyncStatus("saving");
    const ok = await api.saveTournament(id, { teams: t, matches: m, tournamentName: name, config: cfg });
    setSyncStatus(ok ? "synced" : "offline");
  };

  const handleConfig = (cfg) => { setConfig(cfg); setTournamentName(cfg.tournamentName); setTeams(createEmptyTeams(cfg.teamCount, cfg.teamsPerGroup)); setScreen("setup"); };

  const startTournament = async (finalTeams) => {
    const id = genId();
    const m = createMatches(finalTeams);
    setActiveTournamentId(id);
    setMatches(m);
    setScreen("tournament");
    await saveToCloud(id, finalTeams, m, tournamentName, config);
    refreshList();
  };

  const openTournament = async (id) => {
    setSyncStatus("loading");
    const data = await api.loadTournament(id);
    if (data) {
      setActiveTournamentId(id);
      setTeams(data.teams || []);
      setMatches(data.matches || []);
      setTournamentName(data.tournamentName || "");
      setConfig(data.config || null);
      setScreen("tournament");
      setSyncStatus("synced");
    }
  };

  const deleteTournament = async (id) => {
    setSyncStatus("saving");
    await api.deleteTournament(id);
    setAllTournaments((p) => p.filter((t) => t.id !== id));
    if (activeTournamentId === id) { setActiveTournamentId(null); setMatches([]); setTeams([]); }
    setSyncStatus("synced");
  };

  const saveMatch = async (updated) => {
    const m = matches.map((x) => x.id === updated.id ? updated : x);
    setMatches(m);
    setActiveMatch(null);
    await saveToCloud(activeTournamentId, teams, m, tournamentName, config);
  };

  const goHome = async () => {
    await refreshList();
    setScreen("home");
  };

  const groups = [...new Set(teams.map((t) => t.group))];

  // Export CSV
  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let csv = `=== ${tournamentName} ===\n\n=== STANDINGS ===\nGroup,Rank,Team,Wins,Losses,Match Points,Total Score\n`;
    groups.forEach((group) => {
      const gt = teams.filter((t) => t.group === group), gm = matches.filter((m) => m.group === group);
      const st = gt.map((team) => { let w = 0, l = 0, mp = 0, ts = 0; gm.forEach((m) => { if (!m.completed) return; const i1 = m.team1Id === team.id, i2 = m.team2Id === team.id; if (!i1 && !i2) return; let a = 0, b = 0, c = 0, d = 0; m.games.forEach((g) => { if (g.completed) { c += g.team1Score; d += g.team2Score; if (g.team1Score > g.team2Score) a += g.pointsWorth; else if (g.team2Score > g.team1Score) b += g.pointsWorth; } }); if (i1) { mp += a; ts += c; if (a > b) w++; else if (b > a) l++; else if (m.tiebreaker?.completed) { m.tiebreaker.winner === team.id ? w++ : l++; } } else { mp += b; ts += d; if (b > a) w++; else if (a > b) l++; else if (m.tiebreaker?.completed) { m.tiebreaker.winner === team.id ? w++ : l++; } } }); return { ...team, w, l, mp, ts }; }).sort((a, b) => b.w - a.w || b.mp - a.mp || b.ts - a.ts);
      st.forEach((t, i) => { csv += `${esc(group)},${i + 1},${esc(t.name)},${t.w},${t.l},${t.mp},${t.ts}\n`; });
    });
    csv += "\n=== MATCH RESULTS ===\nGroup,Team 1,Team 2,Status,Game,T1 Player(s),T2 Player(s),T1 Score,T2 Score,Worth,Winner\n";
    matches.forEach((m) => { const a = teams.find((t) => t.id === m.team1Id), b = teams.find((t) => t.id === m.team2Id); const s = m.completed ? "Done" : m.games.some((g) => g.completed) ? "Live" : "Upcoming"; m.games.forEach((g) => { const p1 = g.type === "Doubles" ? g.team1Players || "" : g.team1Player || ""; const p2 = g.type === "Doubles" ? g.team2Players || "" : g.team2Player || ""; const w = g.completed ? (g.team1Score > g.team2Score ? a.name : g.team2Score > g.team1Score ? b.name : "Tie") : ""; csv += `${esc(m.group)},${esc(a.name)},${esc(b.name)},${s},${esc(g.type)},${esc(p1)},${esc(p2)},${g.team1Score},${g.team2Score},${g.pointsWorth},${esc(w)}\n`; }); });
    csv += "\n=== TEAMS ===\nGroup,Team,Player 1,Player 2,Player 3,Player 4\n";
    teams.forEach((t) => { csv += `${esc(t.group)},${esc(t.name)},${esc(t.players[0])},${esc(t.players[1])},${esc(t.players[2])},${esc(t.players[3])}\n`; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${(tournamentName || "tournament").replace(/\s+/g, "_")}_results.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 64 }}>🏸</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#ffd700", letterSpacing: 3 }}>LOADING...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#e0e0e0", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <SyncIndicator status={syncStatus} />

      {screen === "home" && <HomeScreen onCreateNew={() => setScreen("config")} tournaments={allTournaments} onOpen={openTournament} onDelete={deleteTournament} loading={listLoading} />}
      {screen === "config" && <ConfigScreen onNext={handleConfig} onBack={() => setScreen("home")} />}
      {screen === "setup" && <SetupScreen teams={teams} setTeams={setTeams} onStart={startTournament} onBack={() => setScreen("config")} />}

      {screen === "tournament" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 80px" }}>
          <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#ffd700", margin: 0, letterSpacing: 3 }}>🏸 {tournamentName.toUpperCase()}</h1>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 24, background: "#1a1a2e", borderRadius: 12, padding: 4, flexWrap: "wrap" }}>
            {[{ key: "matches", label: "Matches" }, { key: "standings", label: "Standings" }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "#ffd700" : "transparent", color: tab === t.key ? "#1a1a2e" : "#888", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Bebas Neue', sans-serif" }}>{t.label}</button>
            ))}
            <button onClick={exportCSV} style={{ background: "transparent", color: "#00c853aa", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Bebas Neue', sans-serif" }}>📥 Export</button>
            <button onClick={goHome} style={{ background: "transparent", color: "#888", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1, fontFamily: "'Bebas Neue', sans-serif" }}>← ALL TOURNAMENTS</button>
          </div>
          {tab === "matches" && groups.map((group, gi) => {
            const gc = ["#ff6b6b", "#4ecdc4", "#a29bfe", "#fdcb6e", "#e17055", "#00b894"];
            return (<div key={group} style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: gc[gi % gc.length], letterSpacing: 2, marginBottom: 12 }}>GROUP {group} MATCHES</h2>
              <div style={{ display: "grid", gap: 12 }}>{matches.filter((m) => m.group === group).map((m) => <MatchCard key={m.id} match={m} teams={teams} onClick={() => setActiveMatch(m)} />)}</div>
            </div>);
          })}
          {tab === "standings" && groups.map((group, gi) => <StandingsTable key={group} group={group} teams={teams} matches={matches} groupColorIdx={gi} />)}
        </div>
      )}

      {activeMatch && (
        <ScoringModal
          key={activeMatch.id + "-" + JSON.stringify(matches.find((m) => m.id === activeMatch.id))}
          match={matches.find((m) => m.id === activeMatch.id)}
          teams={teams} onSave={saveMatch} onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  );
}
