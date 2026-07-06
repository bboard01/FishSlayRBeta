import { useState, useEffect, useCallback } from 'react';
import { useData } from '../lib/DataContext.jsx';
import {
  hostTournament, joinByCode, listTeams, createTeam, pickTeam,
  leaveTournament, myTournaments, getTournament,
  fetchLeaderboard, fetchTournamentCatches, fetchRoster, signThumbUrls,
  closeTournament, invalidateCatch, revalidateCatch, removeMember, removeTeam,
} from '../lib/tournament.js';

// Tournament — Dock Mode. States driven by data.activeTournament =
// { tournamentId, teamId }: (not in one) host/join, (teamless) pick a team,
// (on a team OR host) the live leaderboard + host tools. Matches the app's
// glass-panel / gold-accent / eyebrow voice — no new visual language.

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}
function fmtWhen(iso) {
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return iso; }
}
function defaultWindow() {
  const pad = (n) => String(n).padStart(2, '0');
  const toLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { start: toLocal(new Date()), end: toLocal(new Date(Date.now() + 2 * 864e5)) };
}
const isBass = (s) => s === 'Smallmouth Bass' || s === 'Largemouth Bass';

// Prominent, copyable join code so anglers can always find & share it.
function ShareCode({ code, toast }) {
  if (!code) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast && toast('Join code copied'); }
    catch { toast && toast(`Join code: ${code}`); }
  };
  return (
    <div className="tourn-share">
      <span className="tourn-share-label">Join code</span>
      <span className="tourn-share-code">{code}</span>
      <button className="btn gold small" onClick={copy}>Copy code</button>
    </div>
  );
}

export default function Tournament({ onToast }) {
  const { data, updateProfile, runSync } = useData();
  const active = data.activeTournament || null;
  const toast = (m) => onToast && onToast(m);

  const [busy, setBusy] = useState(false);
  const setActive = (tournamentId, teamId) =>
    updateProfile((prev) => ({ ...prev, activeTournament: { tournamentId, teamId: teamId || null } }));
  const clearActive = () => updateProfile((prev) => ({ ...prev, activeTournament: null }));

  if (active && active.teamId) {
    return <Leaderboard active={active} data={data} toast={toast} onLeave={clearActive}
      setActive={setActive} busy={busy} setBusy={setBusy} runSync={runSync} />;
  }
  if (active && !active.teamId) {
    return <TeamPicker active={active} toast={toast} setActive={setActive} clearActive={clearActive}
      busy={busy} setBusy={setBusy} runSync={runSync} />;
  }
  return <Lobby toast={toast} setActive={setActive} busy={busy} setBusy={setBusy} runSync={runSync} />;
}

// ---------------------------------------------------------------------------
// LOBBY — host, join, resume
// ---------------------------------------------------------------------------
function Lobby({ toast, setActive, busy, setBusy, runSync }) {
  const [mode, setMode] = useState(null);
  const [mine, setMine] = useState([]);
  const dw = defaultWindow();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState(dw.start);
  const [endsAt, setEndsAt] = useState(dw.end);
  const [code, setCode] = useState('');

  useEffect(() => {
    let live = true;
    myTournaments().then((r) => { if (live) setMine(r.tournaments || []); });
    return () => { live = false; };
  }, []);

  const doHost = async () => {
    if (!name.trim()) { toast('Name your tournament'); return; }
    const startsISO = new Date(startsAt).toISOString();
    const endsISO = new Date(endsAt).toISOString();
    if (new Date(endsISO) <= new Date(startsISO)) { toast('End must be after start'); return; }
    setBusy(true);
    const r = await hostTournament({ name, startsAt: startsISO, endsAt: endsISO });
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(r.tournament.id, null);
    toast(`Hosting "${r.tournament.name}" — code ${r.tournament.join_code}`);
    runSync && runSync();
  };
  const doJoin = async () => {
    if (!code.trim()) { toast('Enter a join code'); return; }
    setBusy(true);
    const r = await joinByCode(code);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(r.tournament.id, null);
    toast(`Joined "${r.tournament.name}" — pick your team`);
    runSync && runSync();
  };

  return (
    <div className="grid">
      <div className="glass panel span12 tourn-hero">
        <span className="eyebrow">Tournament</span>
        <h2 className="chapter-title">Top three bass take it.</h2>
        <p className="story">Total length of your team's three biggest bass. Join your crew with a code, or host your own.</p>
      </div>

      <div className="glass panel span12">
        {mode === null && (
          <div className="tourn-choice">
            <button className="btn primary" onClick={() => setMode('join')}>Join with a code</button>
            <button className="btn gold" onClick={() => setMode('host')}>Host a tournament</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="tourn-form">
            <label className="tourn-field">
              <span>Join code</span>
              <input className="tourn-code-input" value={code} maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" />
            </label>
            <div className="tourn-actions">
              <button className="btn primary" onClick={doJoin} disabled={busy}>Join</button>
              <button className="btn" onClick={() => setMode(null)} disabled={busy}>Back</button>
            </div>
          </div>
        )}

        {mode === 'host' && (
          <div className="tourn-form">
            <label className="tourn-field">
              <span>Tournament name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Bass Shootout" />
            </label>
            <div className="tourn-field-row">
              <label className="tourn-field">
                <span>Starts</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </label>
              <label className="tourn-field">
                <span>Ends</span>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </label>
            </div>
            <p className="muted tourn-rule-note">Top 3 bass by total length · 4th bass breaks ties · bass need a photo</p>
            <div className="tourn-actions">
              <button className="btn gold" onClick={doHost} disabled={busy}>Create</button>
              <button className="btn" onClick={() => setMode(null)} disabled={busy}>Back</button>
            </div>
          </div>
        )}
      </div>

      {mode === null && mine.length > 0 && (
        <div className="glass panel span12">
          <span className="eyebrow">Your tournaments</span>
          <div className="tourn-mine">
            {mine.map((t) => (
              <button key={t.id} className="tourn-mine-row" onClick={() => setActive(t.id, t.myTeamId || null)}>
                <span className="tourn-mine-name">🏆 {t.name}</span>
                <span className="muted tourn-mine-when">
                  {fmtDate(t.starts_at)}–{fmtDate(t.ends_at)}{t.status === 'closed' ? ' · closed' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TEAM PICKER — teamless state
// ---------------------------------------------------------------------------
function TeamPicker({ active, toast, setActive, clearActive, busy, setBusy, runSync }) {
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let live = true;
    listTeams(active.tournamentId).then((r) => { if (live) setTeams(r.teams || []); });
    getTournament(active.tournamentId).then((r) => { if (live) setMeta(r.tournament || null); });
    return () => { live = false; };
  }, [active.tournamentId]);

  const doCreate = async () => {
    if (!newTeam.trim()) { toast('Name your team'); return; }
    setBusy(true);
    const r = await createTeam(active.tournamentId, newTeam);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(active.tournamentId, r.team.id);
    toast(`Team "${r.team.name}" created`);
    runSync && runSync();
  };
  const doPick = async (teamId, teamName) => {
    setBusy(true);
    const r = await pickTeam(active.tournamentId, teamId);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(active.tournamentId, teamId);
    toast(`You're on ${teamName}`);
    runSync && runSync();
  };
  const doLeave = async () => {
    if (!window.confirm('Leave this tournament? Your logged catches stay in your journal.')) return;
    setBusy(true);
    const r = await leaveTournament(active.tournamentId);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    clearActive();
    toast('Left the tournament');
    runSync && runSync();
  };

  return (
    <div className="grid">
      <div className="glass panel span12 tourn-hero">
        <span className="eyebrow">Tournament</span>
        <h2 className="chapter-title">Pick your team.</h2>
        <p className="story">Join a crew or start your own — one team per angler.</p>
        <ShareCode code={meta?.join_code} toast={toast} />
      </div>

      <div className="glass panel span12">
        {teams.length > 0 && (
          <div className="tourn-team-list">
            {teams.map((t) => (
              <button key={t.id} className="tourn-team-row" disabled={busy} onClick={() => doPick(t.id, t.name)}>
                🎣 {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="tourn-form">
          <label className="tourn-field">
            <span>Start a new team</span>
            <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Team name" />
          </label>
          <div className="tourn-actions">
            <button className="btn gold" onClick={doCreate} disabled={busy}>Create team</button>
            <button className="btn danger" onClick={doLeave} disabled={busy}>Leave</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LEADERBOARD + HOST TOOLS — step 3b
// ---------------------------------------------------------------------------
function Leaderboard({ active, data, toast, onLeave, setActive, busy, setBusy, runSync }) {
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [catches, setCatches] = useState([]);
  const [roster, setRoster] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ownerFlag, setOwnerFlag] = useState(false);
  // Which bottom-sheet is open: 'share' | 'team' | 'tools' | null. Same .sheet
  // pattern as CatchSheet — self-contained here since this component owns the
  // data and handlers the sheets need.
  const [sheet, setSheet] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, lb, tc, rs] = await Promise.all([
      getTournament(active.tournamentId),
      fetchLeaderboard(active.tournamentId),
      fetchTournamentCatches(active.tournamentId),
      fetchRoster(active.tournamentId),
    ]);
    setMeta(m.tournament || null);
    setRows(lb.rows || []);
    setCatches(tc.catches || []);
    setRoster(rs.members || []);
    const paths = (tc.catches || []).map((c) => c.photo_url).filter(Boolean);
    setThumbs(await signThumbUrls(paths));
    setLoading(false);
  }, [active.tournamentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let live = true;
    import('../lib/supabase.js').then(({ sb }) =>
      sb.auth.getSession().then(({ data: s }) => {
        if (live && meta) setOwnerFlag(meta.owner_id === s.session?.user?.id);
      }));
    return () => { live = false; };
  }, [meta]);

  const catchesByTeam = (teamId) => catches.filter((c) => c.team_id === teamId);
  const myTeamId = active.teamId;
  const nameByUser = Object.fromEntries(roster.map((m) => [m.user_id, m.angler_name || 'Angler']));

  const doLeave = async () => {
    if (!window.confirm('Leave this tournament? Your logged catches stay in your journal.')) return;
    setBusy(true);
    const r = await leaveTournament(active.tournamentId);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    onLeave();
    toast('Left the tournament');
    runSync && runSync();
  };

  // Team-switch sheet: lazy-load the tournament's teams when it opens.
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  useEffect(() => {
    if (sheet !== 'team') return;
    let live = true;
    listTeams(active.tournamentId).then((r) => { if (live) setTeams(r.teams || []); });
    return () => { live = false; };
  }, [sheet, active.tournamentId]);

  const doSwitch = async (teamId, teamName) => {
    if (teamId === myTeamId) { setSheet(null); return; } // already on it
    setBusy(true);
    const r = await pickTeam(active.tournamentId, teamId);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(active.tournamentId, teamId);
    setSheet(null);
    toast(`You're on ${teamName}`);
    runSync && runSync();
    load();
  };
  const doCreateSwitch = async () => {
    if (!newTeam.trim()) { toast('Name your team'); return; }
    setBusy(true);
    const r = await createTeam(active.tournamentId, newTeam);
    setBusy(false);
    if (r.error) { toast(r.error); return; }
    setActive(active.tournamentId, r.team.id);
    setNewTeam('');
    setSheet(null);
    toast(`Team "${r.team.name}" created`);
    runSync && runSync();
    load();
  };

  const hostClose = async () => {
    if (!window.confirm('Close this tournament? The board freezes; in-window catches still count.')) return;
    setBusy(true); const r = await closeTournament(active.tournamentId); setBusy(false);
    if (r.error) { toast(r.error); return; } toast('Tournament closed'); load();
  };
  const hostVoid = async (row) => {
    const reason = window.prompt('Reason (shown to the angler):', 'Mismeasured — voided by host');
    if (reason === null) return;
    setBusy(true); const r = await invalidateCatch(row.id, reason); setBusy(false);
    if (r.error) { toast(r.error); return; } toast('Catch voided'); load();
  };
  const hostUnvoid = async (row) => {
    setBusy(true); const r = await revalidateCatch(row.id); setBusy(false);
    if (r.error) { toast(r.error); return; } toast('Catch restored'); load();
  };
  const hostRemoveTeam = async (teamId, teamName) => {
    if (!window.confirm(`Remove ${teamName} and all its catches? This can't be undone.`)) return;
    setBusy(true); const r = await removeTeam(teamId); setBusy(false);
    if (r.error) { toast(r.error); return; } toast('Team removed'); load();
  };
  const hostRemoveMember = async (userId, who) => {
    if (!window.confirm(`Remove ${who} from the tournament?`)) return;
    setBusy(true); const r = await removeMember(active.tournamentId, userId); setBusy(false);
    if (r.error) { toast(r.error); return; } toast('Member removed'); load();
  };

  const myInvalidCatches = (data.catches || []).filter((c) => c.tournStatus === 'invalidated');

  // Dashboard summary: find your team's row on the ranked board.
  const myRow = rows.find((r) => r.team_id === myTeamId) || null;

  return (
    <div className="grid">
      {/* Identity + prominent join code — home-base header */}
      <div className="glass panel span8 tourn-hero tourn-dash-id">
        <span className="eyebrow">Tournament{meta?.status === 'closed' ? ' · closed' : ''}</span>
        <h2 className="chapter-title">{meta?.name || 'Leaderboard'}</h2>
        {meta && (
          <p className="story">
            {fmtWhen(meta.starts_at)} — {fmtWhen(meta.ends_at)}
          </p>
        )}
        {meta?.join_code && (
          <button className="tourn-share tourn-share-btn" onClick={() => setSheet('share')}>
            <span className="tourn-share-label">Join code</span>
            <span className="tourn-share-code">{meta.join_code}</span>
            <span className="btn gold small">Share</span>
          </button>
        )}
      </div>

      {/* Your team — rank + score glance card */}
      <div className="glass panel span4 tourn-dash-you">
        <span className="eyebrow">Your team</span>
        <h3 className="tourn-dash-team">{myRow?.team_name || 'Your team'}</h3>
        <div className="tourn-dash-stat">
          <div className="tourn-dash-rank">
            <span className="tourn-dash-num">{myRow ? `#${myRow.rank}` : '—'}</span>
            <span className="muted">rank</span>
          </div>
          <div className="tourn-dash-score">
            <span className="tourn-dash-num gold">{myRow ? `${Number(myRow.score).toFixed(2)}"` : '—'}</span>
            <span className="muted">top 3 bass</span>
          </div>
        </div>
        <div className="tourn-actions tourn-dash-acts">
          <button className="btn small" onClick={() => setSheet('team')} disabled={busy}>Switch team</button>
          <button className="btn small danger" onClick={doLeave} disabled={busy}>Leave</button>
        </div>
      </div>

      {/* Board toolbar */}
      <div className="glass panel span12 tourn-dash-bar">
        <span className="eyebrow">Leaderboard</span>
        <div className="tourn-actions">
          {ownerFlag && (
            <button className="btn small gold" onClick={() => setSheet('tools')} disabled={busy}>Host tools</button>
          )}
          <button className="btn small" onClick={load} disabled={loading || busy}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
        </div>
      </div>

      {myInvalidCatches.length > 0 && (
        <div className="glass panel span12 tourn-warn">
          <span className="eyebrow">Heads up</span>
          {myInvalidCatches.map((c) => (
            <p key={c.id} className="tourn-warn-row">⚠ {c.species} {c.length}" — {c.tournReason || 'not counted.'}</p>
          ))}
        </div>
      )}

      <div className="glass panel span12">
        {loading ? (
          <p className="muted">Loading the board…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No teams yet. Share the join code to fill the board.</p>
        ) : (
          <div className="tourn-board">
            {rows.map((row) => {
              const teamCatches = catchesByTeam(row.team_id);
              const bass = teamCatches.filter((c) => isBass(c.species) && !c.invalidated);
              const other = teamCatches.filter((c) => !isBass(c.species) || c.invalidated);
              const open = expanded === row.team_id;
              const mine = row.team_id === myTeamId;
              return (
                <div key={row.team_id} className={`tourn-team${mine ? ' mine' : ''}`}>
                  <button className="tourn-team-head" onClick={() => setExpanded(open ? null : row.team_id)}>
                    <span className="tourn-rank">{row.rank}</span>
                    <span className="tourn-team-name">{row.team_name}{mine ? ' · you' : ''}</span>
                    <span className="tourn-score">{Number(row.score).toFixed(2)}"</span>
                    <span className="tourn-caret">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="tourn-detail">
                      {bass.length === 0 && <p className="muted">No scoring bass yet.</p>}
                      {bass.map((c, i) => (
                        <div key={c.id} className={`tourn-catch${i < 3 ? ' counts' : ''}`}>
                          {c.photo_url && thumbs[c.photo_url]
                            ? <img className="tourn-thumb" src={thumbs[c.photo_url]} alt="" />
                            : <span className="tourn-thumb ph">🎣</span>}
                          <span className="tourn-catch-len">{Number(c.length).toFixed(2)}"</span>
                          <span className="tourn-catch-sp">{c.species.replace(' Bass', '')}</span>
                          <span className="muted tourn-catch-by">{nameByUser[c.user_id] || ''}</span>
                          {i < 3 && <span className="tourn-counts-tag">counts</span>}
                          {ownerFlag && (
                            <button className="btn small danger tourn-void" disabled={busy}
                              onClick={() => hostVoid(c)}>void</button>
                          )}
                        </div>
                      ))}
                      {other.length > 0 && (
                        <div className="tourn-other">
                          <span className="eyebrow">Other</span>
                          {other.map((c) => (
                            <div key={c.id} className="tourn-catch dim">
                              <span className="tourn-catch-len">{Number(c.length).toFixed(2)}"</span>
                              <span className="tourn-catch-sp">{c.species}</span>
                              {c.invalidated && <span className="muted">· voided</span>}
                              {ownerFlag && c.invalidated && (
                                <button className="btn small tourn-void" disabled={busy}
                                  onClick={() => hostUnvoid(c)}>restore</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {ownerFlag && (
                        <button className="btn small danger tourn-rm-team" disabled={busy}
                          onClick={() => hostRemoveTeam(row.team_id, row.team_name)}>Remove team</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHARE-CODE SHEET */}
      {sheet === 'share' && (
        <div className="sheet-backdrop active" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Share the code</h2>
              <button className="btn small" onClick={() => setSheet(null)}>Close</button>
            </div>
            <div className="sheet-body">
              <ShareCode code={meta?.join_code} toast={toast} />
              <p className="muted" style={{ marginTop: 14 }}>Anyone with this code can join and pick a team. It never changes.</p>
            </div>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setSheet(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM-SWITCH SHEET */}
      {sheet === 'team' && (
        <div className="sheet-backdrop active" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Switch team</h2>
              <button className="btn small" onClick={() => setSheet(null)}>Close</button>
            </div>
            <div className="sheet-body">
              {teams.length > 0 && (
                <div className="tourn-team-list">
                  {teams.map((t) => (
                    <button key={t.id} className={`tourn-team-row${t.id === myTeamId ? ' mine' : ''}`}
                      disabled={busy} onClick={() => doSwitch(t.id, t.name)}>
                      🎣 {t.name}{t.id === myTeamId ? ' · you' : ''}
                    </button>
                  ))}
                </div>
              )}
              <div className="tourn-form" style={{ marginTop: teams.length ? 14 : 0 }}>
                <label className="tourn-field">
                  <span>Start a new team</span>
                  <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Team name" />
                </label>
              </div>
              <p className="muted" style={{ marginTop: 10 }}>One team per angler. Switching moves you over; an empty team you leave behind is cleaned up.</p>
            </div>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setSheet(null)} disabled={busy}>Cancel</button>
              <button className="btn gold" onClick={doCreateSwitch} disabled={busy}>Create team</button>
            </div>
          </div>
        </div>
      )}

      {/* HOST-TOOLS SHEET (owner-gated) */}
      {sheet === 'tools' && ownerFlag && (
        <div className="sheet-backdrop active" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Host tools</h2>
              <button className="btn small" onClick={() => setSheet(null)}>Close</button>
            </div>
            <div className="sheet-body">
              <div className="tourn-actions">
                {meta?.status !== 'closed'
                  ? <button className="btn danger" onClick={hostClose} disabled={busy}>Close tournament</button>
                  : <span className="muted">Tournament is closed.</span>}
              </div>
              <span className="eyebrow tourn-roster-label">Roster</span>
              <div className="tourn-roster">
                {roster.map((m) => (
                  <div key={m.user_id} className="tourn-roster-row">
                    <span>{m.angler_name || 'Angler'}{m.user_id === meta?.owner_id ? ' · host' : ''}</span>
                    {m.user_id !== meta?.owner_id && (
                      <button className="btn small danger" disabled={busy}
                        onClick={() => hostRemoveMember(m.user_id, m.angler_name || 'this angler')}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 12 }}>Void or restore individual catches from the board itself — tap a team to expand it.</p>
            </div>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setSheet(null)} disabled={busy}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
