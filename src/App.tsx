import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { uciToSan } from './chess/san';
import { playSound, sanToSound, classToStinger, setVolume, getVolume } from './sound';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings.sample';
import { ImportPanel } from './components/ImportPanel';
import { ReviewBoard } from './components/ReviewBoard';
import { EvalBar } from './components/EvalBar';
import { CoachCard, type CurrentMove } from './components/CoachCard';
import { explainMove } from './coach/explain';
import { MoveList } from './components/MoveList';
import { EvalGraph } from './components/EvalGraph';
import { SummaryPanel } from './components/SummaryPanel';
import { RevealOverlay } from './components/RevealOverlay';
import { playerRatings } from './chess/ratings';
import { kingSquare } from './chess/kingSquare';
import type { ParsedGame } from './chess/types';
import { supabase } from './supabase/client';
import { useAuth } from './supabase/useAuth';
import { AuthBar } from './components/AuthBar';
import { LibraryView } from './components/LibraryView';
import { mapReview, type GameSource } from './supabase/mapReview';
import { uploadReview } from './supabase/uploadReview';
import { fetchSavedGame } from './supabase/library';
import { rowToReview } from './supabase/rowToReview';
import { enqueue, flushQueue, hashString } from './supabase/syncQueue';

// localStorage can throw SecurityError in storage-blocked contexts; settings
// are a nicety — never let them take down the app.
function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

const DEPTH = 14;
type Speed = 'off' | 'slow' | 'medium' | 'fast';
const SPEED_CYCLE: Speed[] = ['off', 'slow', 'medium', 'fast'];
const SPEED_MS: Record<Speed, number> = { off: 0, slow: 1200, medium: 600, fast: 250 };
const SPEED_LABEL: Record<Speed, string> = { off: '', slow: '×½', medium: '×1', fast: '×2' };

export default function App() {
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [ply, setPly] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(true);
  const [showReveal, setShowReveal] = useState(false);
  const [soundOn, setSoundOn] = useState(() => safeStorageGet('chessreviewer.soundOn') !== '0');
  const [voiceOn, setVoiceOn] = useState(() => safeStorageGet('chessreviewer.voiceOn') !== '0');
  const [volume, setVolumeState] = useState(getVolume);
  const [autoplaySpeed, setAutoplaySpeed] = useState<Speed>('off');
  const [view, setView] = useState<'game' | 'library'>('game');
  const auth = useAuth();
  const [lastImport, setLastImport] = useState<{ pgn: string; source: GameSource } | null>(null);
  const prevPly = useRef(0);
  const autoplayTimer = useRef<number | null>(null);
  const runSeq = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const total = game?.plies.length ?? 0;
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
    if (dx < 0) setPly((p) => Math.min(total, p + 1));  // swipe left → next
    else setPly((p) => Math.max(0, p - 1));             // swipe right → previous
  }, [total]);
  const result = game?.headers.Result ?? null;
  const ratings = useMemo(
    () => playerRatings(game?.headers ?? {}),
    [game],
  );

  async function run(pgnText: string, source: GameSource = 'paste') {
    const seq = ++runSeq.current;
    setLastImport({ pgn: pgnText, source });
    setError(null);
    setReview(null);
    setAutoplaySpeed('off');
    let parsed: ParsedGame;
    try {
      parsed = parsePgn(pgnText);
    } catch {
      setError('That PGN could not be read. Check the moves and try again.');
      return;
    }
    setGame(parsed);
    setPly(0);
    setProgress('Analyzing with Stockfish…');
    setProgressPct(0);
    try {
      const analyses = await analyzeGame(parsed, DEPTH, (d, t) => {
        if (seq === runSeq.current) {
          setProgress(`Analyzing position ${d} / ${t}`);
          setProgressPct(t > 0 ? Math.round((d / t) * 100) : 0);
        }
      });
      if (seq !== runSeq.current) return;
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setShowReveal(true);
      setProgress(null);
      setShowImport(false);
    } catch {
      if (seq !== runSeq.current) return;
      setError('The engine could not load in this browser. Try reloading the page.');
      setProgress(null);
    }
  }

  async function openSaved(gameId: string) {
    if (!supabase) return;
    const row = await fetchSavedGame(supabase, gameId);
    const rebuilt = row ? rowToReview(row.pgn, row.analysis) : null;
    if (!rebuilt) { setError('That saved review could not be loaded.'); setView('game'); return; }
    runSeq.current++;      // invalidate any in-flight analysis so it can't clobber this saved review
    setProgress(null);
    setError(null);
    setAutoplaySpeed('off');
    setGame(rebuilt.game);
    setReview(rebuilt.review);
    setPly(0);
    setShowImport(false);
    setLastImport(null);   // prevents the sync effect from re-uploading (guard requires lastImport)
    setView('game');
  }

  // ── autoplay ──
  useEffect(() => {
    if (autoplaySpeed === 'off' || !review) {
      if (autoplayTimer.current !== null) { clearInterval(autoplayTimer.current); autoplayTimer.current = null; }
      return;
    }
    const ms = SPEED_MS[autoplaySpeed];
    autoplayTimer.current = window.setInterval(() => {
      setPly((p) => {
        if (p >= total) { setAutoplaySpeed('off'); return total; }
        return p + 1;
      });
    }, ms);
    return () => { if (autoplayTimer.current !== null) clearInterval(autoplayTimer.current); };
  }, [autoplaySpeed, review, total]);

  // ── cloud sync: enqueue each finished review, then flush ──
  useEffect(() => {
    if (!review || !game || !lastImport || !supabase || !auth.user) return;
    const client = supabase;
    const userId = auth.user.id;
    const payload = mapReview(game, review, lastImport.source, DEPTH, lastImport.pgn);
    enqueue(localStorage, payload, `${userId}:${hashString(lastImport.pgn)}`);
    void flushQueue(localStorage, (p, id) =>
      id.startsWith(`${userId}:`)
        ? uploadReview(client, userId, p)
        : Promise.reject(new Error('queued by another user')),
    ).catch(() => { /* fire-and-forget */ });
  }, [review]);

  // Retry anything pending whenever a user (re)appears.
  useEffect(() => {
    if (!supabase || !auth.user) return;
    const client = supabase;
    const userId = auth.user.id;
    void flushQueue(localStorage, (p, id) =>
      id.startsWith(`${userId}:`)
        ? uploadReview(client, userId, p)
        : Promise.reject(new Error('queued by another user')),
    ).catch(() => { /* fire-and-forget */ });
  }, [auth.user?.id]);

  useEffect(() => { safeStorageSet('chessreviewer.soundOn', soundOn ? '1' : '0'); }, [soundOn]);
  useEffect(() => { safeStorageSet('chessreviewer.voiceOn', voiceOn ? '1' : '0'); }, [voiceOn]);

  // Signing out while viewing the library shouldn't leave the user stranded on it.
  useEffect(() => { if (!auth.user) setView('game'); }, [auth.user]);

  const handleAutoplay = useCallback(() => {
    setAutoplaySpeed((s) => {
      const idx = SPEED_CYCLE.indexOf(s);
      return SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
    });
  }, []);

  const fen = useMemo(() => {
    if (!game) return undefined;
    if (ply === 0) return game.plies[0]?.fenBefore;
    return game.plies[ply - 1]?.fenAfter;
  }, [game, ply]);

  const playedPly = ply > 0 ? review?.plies[ply - 1] ?? null : null;

  const lastMove = useMemo((): [string, string] | null => {
    if (!playedPly) return null;
    return [playedPly.uci.slice(0, 2), playedPly.uci.slice(2, 4)];
  }, [playedPly]);

  const badge = useMemo(() => {
    if (!playedPly) return null;
    return { square: playedPly.uci.slice(2, 4), cls: playedPly.classification };
  }, [playedPly]);

  const arrow = useMemo((): [string, string] | null => {
    if (!playedPly) return null;
    const uci = playedPly.bestMoveUci;
    return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null;
  }, [playedPly]);

  const checkSq = useMemo(() => {
    if (!playedPly || !(playedPly.san.includes('+') || playedPly.san.includes('#'))) return null;
    // After the move, the side to move is the one in check.
    const sideToMove = playedPly.fenAfter.split(' ')[1] === 'w' ? 'white' : 'black';
    return kingSquare(playedPly.fenAfter, sideToMove);
  }, [playedPly]);

  const boardFx = useMemo(() => {
    if (!playedPly) return '';
    const fx: string[] = [];
    if (playedPly.san.includes('#')) fx.push('fx-mate');
    else if (playedPly.san.includes('x')) fx.push('fx-capture');
    if (playedPly.classification === 'brilliant') fx.push('fx-brilliant');
    return fx.join(' ');
  }, [playedPly]);

  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !boardFx) return;
    el.classList.remove('fx-mate', 'fx-capture', 'fx-brilliant');
    void el.offsetWidth; // reflow to restart animation
    for (const c of boardFx.split(' ')) el.classList.add(c);
    return () => { el.classList.remove('fx-mate', 'fx-capture', 'fx-brilliant'); };
  }, [ply, boardFx]);

  const currentMove = useMemo((): CurrentMove | null => {
    if (!playedPly) return null;
    const bestSan = uciToSan(playedPly.fenBefore, playedPly.bestMoveUci);
    const next = review?.plies[ply] ?? null;
    const nextBestSan = next?.bestMoveUci ? uciToSan(next.fenBefore, next.bestMoveUci) : null;
    return {
      san: playedPly.san,
      cls: playedPly.classification,
      bestSan,
      isBest: playedPly.uci === playedPly.bestMoveUci,
      explanation: explainMove(playedPly, { bestSan, nextBestSan }),
    };
  }, [playedPly, review, ply]);

  const whiteEvals = useMemo(() => {
    if (!review) return [];
    return review.plies.map((p) => (p.color === 'white' ? p.evalAfterCp : -p.evalAfterCp));
  }, [review]);

  const classifications = useMemo(() => {
    if (!review) return [];
    return review.plies.map((p) => p.classification);
  }, [review]);

  const currentWhiteCp = useMemo(() => {
    if (!review) return 0;
    if (ply === 0) {
      const p0 = review.plies[0];
      return p0 ? (p0.color === 'white' ? p0.evalBeforeCp : -p0.evalBeforeCp) : 0;
    }
    return whiteEvals[ply - 1] ?? 0;
  }, [review, ply, whiteEvals]);

  useEffect(() => {
    if (review && soundOn && ply > 0 && ply !== prevPly.current) {
      const p = review.plies[ply - 1];
      if (p) {
        playSound(sanToSound(p.san));
        const st = classToStinger(p.classification);
        if (st) playSound(st);
      }
    }
    prevPly.current = ply;
  }, [ply, review, soundOn]);

  const handleVolume = (v: number) => {
    setVolume(v);        // module: master gain + persistence
    setVolumeState(v);   // UI
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="pc">♞</span> Chess Reviewer</div>
        <div className="tagline">Paste a PGN or import from chess.com / lichess.org — Stockfish analyzes every move in-browser</div>
        {auth.user && <button className="lib-btn" onClick={() => setView('library')}>Library</button>}
        <AuthBar auth={auth} />
      </header>

      {view === 'library' && auth.user ? (
        <LibraryView user={auth.user} onOpen={openSaved} onClose={() => setView('game')} />
      ) : (
        <>
          {showImport ? (
            <ImportPanel onPgn={run} />
          ) : (
            <div className="gamebar">
              <button onClick={() => setShowImport(true)}>↺ New game</button>
              {game && review && (
                <span className="gamebar-title">
                  {game.white}{ratings.white !== null && <span className="elo"> ({ratings.white})</span>}
                  <span className="vs">vs</span>
                  {game.black}{ratings.black !== null && <span className="elo"> ({ratings.black})</span>}
                  {result && <span className="result">{result}</span>}
                  {review.summary.opening && <span className="muted"> · {review.summary.opening.name}</span>}
                </span>
              )}
            </div>
          )}

          {progress && (
            <div className="status">
              <div className="status-bar" style={{ width: `${progressPct}%` }} />
              <span className="status-text">
                <span className="dot" /> {progress}
                {progressPct > 0 && <span className="pct">{progressPct}%</span>}
              </span>
            </div>
          )}
          {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}

          {game && fen && (
            <div className="review-grid">
              <section className="board-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <div className="player black-name">
                  {game.black}{ratings.black !== null && <span className="player-elo"> ({ratings.black})</span>}
                </div>
                <div className="board-area">
                  <EvalBar cp={currentWhiteCp} />
                  <div className="board" ref={boardRef}>
                    <ReviewBoard fen={fen} lastMove={lastMove} badge={badge} arrow={arrow} checkSquare={checkSq} />
                  </div>
                </div>
                <div className="player white-name">
                  {game.white}{ratings.white !== null && <span className="player-elo"> ({ratings.white})</span>}
                </div>
              </section>

              {!review && progress && (
                <aside className="panel">
                  <div className="card skel" style={{ height: 120 }} />
                  <div className="card skel" style={{ height: 260 }} />
                  <div className="card skel" style={{ height: 140 }} />
                </aside>
              )}

              {review && (
                <aside className="panel panel-enter" key={game?.plies[0]?.fenBefore ?? 'panel'}>
                  <CoachCard opening={review.summary.opening} evalCp={currentWhiteCp} move={currentMove} voiceOn={voiceOn} />

                  <SummaryPanel summary={review.summary} white={game.white} black={game.black} ratings={ratings} result={result}>
                    <MoveList plies={review.plies} current={ply} onSelect={setPly} />
                  </SummaryPanel>

                  <div className="card graph-card">
                    <EvalGraph
                      evalsCp={whiteEvals}
                      classifications={classifications}
                      current={Math.max(0, ply - 1)}
                      onSelect={(i) => setPly(i + 1)}
                    />
                    <div className="playback">
                      <button onClick={() => setPly(0)} title="Start" aria-label="Start">⏮</button>
                      <button onClick={() => setPly((p) => Math.max(0, p - 1))} title="Previous" aria-label="Previous move">◀</button>
                      <button
                        onClick={handleAutoplay}
                        className={`auto-btn ${autoplaySpeed}`}
                        title={autoplaySpeed === 'off' ? 'Autoplay' : `Playing ${autoplaySpeed}`}
                        aria-label="Autoplay"
                      >
                        {autoplaySpeed === 'off' ? '▶▶' : '⏹'}
                      </button>
                      {autoplaySpeed !== 'off' && <span className="speed-label">{SPEED_LABEL[autoplaySpeed]}</span>}
                      <button onClick={() => setPly((p) => Math.min(total, p + 1))} title="Next" aria-label="Next move">▶</button>
                      <button onClick={() => setPly(total)} title="End" aria-label="End">⏭</button>
                      <button
                        onClick={() => setSoundOn((s) => !s)}
                        className={`icon-btn${soundOn ? '' : ' muted'}`}
                        title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                        aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                      >
                        {soundOn
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14" /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                        }
                      </button>
                      <input
                        type="range"
                        className="vol-slider"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => handleVolume(Number(e.target.value))}
                        title="Volume"
                        aria-label="Sound volume"
                      />
                      <button
                        onClick={() => setVoiceOn((v) => !v)}
                        className={`icon-btn${voiceOn ? '' : ' muted'}`}
                        title={voiceOn ? 'Mute voice' : 'Unmute voice'}
                        aria-label={voiceOn ? 'Disable coach voice' : 'Enable coach voice'}
                      >
                        {voiceOn
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        }
                      </button>
                      <span className="ply">{ply} / {total}</span>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {showReveal && game && review && (
        <RevealOverlay
          summary={review.summary}
          white={game.white}
          black={game.black}
          ratings={ratings}
          soundOn={soundOn}
          onClose={() => setShowReveal(false)}
        />
      )}
    </div>
  );
}
