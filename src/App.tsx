import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Library } from 'lucide-react';
import { parsePgn } from './chess/pgnParser';
import { uciToSan } from './chess/san';
import { playSound, sanToSound, classToStinger, setVolume, getVolume } from './sound';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings';
import { Header } from './components/Header';
import { ImportSection } from './components/ImportSection';
import { SeoContent } from './components/SeoContent';
import { SeoHead } from './components/SeoHead';
import { AdsRoot, AdSlot } from './ads';
import { Footer } from './components/Footer';
import { AnalysisProgress } from './components/AnalysisProgress';
import { PlayerCard } from './components/PlayerCard';
import { PlaybackControls, type Speed } from './components/PlaybackControls';
import { ReviewBoard } from './components/ReviewBoard';
import { EvalBar } from './components/EvalBar';
import { CoachCard, type CurrentMove } from './components/CoachCard';
import { explainMove } from './coach/explain';
import { MoveList } from './components/MoveList';
import { EvalGraphCard } from './components/EvalGraphCard';
import { SummaryPanel } from './components/SummaryPanel';
import { RevealOverlay } from './components/RevealOverlay';
import { useReviewShortcuts, IGNORE_SELECTOR } from './hooks/useReviewShortcuts';
import { playerRatings } from './chess/ratings';
import { kingSquare } from './chess/kingSquare';
import type { ParsedGame } from './chess/types';
import { supabase } from './supabase/client';
import { useAuth } from './supabase/useAuth';
import { AuthModal } from './components/AuthModal';
import { LibraryView } from './components/LibraryView';
import { mapReview, type GameSource } from './supabase/mapReview';
import { uploadReview } from './supabase/uploadReview';
import { fetchSavedGame, fetchProfile, fetchLibraryPgnHashes } from './supabase/library';
import { rowToReview } from './supabase/rowToReview';
import { enqueue, flushQueue, hashString } from './supabase/syncQueue';
import { fetchRecentGames as fetchComGames } from './importers/chesscom';
import { fetchRecentGames as fetchLiGames } from './importers/lichess';
import { chooseImportSource, latestGames, unreviewedGames } from './importers/autoImport';
import { Engine } from './engine/engine';
import type { SupabaseClient } from '@supabase/supabase-js';

// localStorage can throw SecurityError in storage-blocked contexts; settings
// are a nicety — never let them take down the app.
function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

const DEPTH = 14;
const LATEST_N = 10; // how many recent games to pull + score on login
const SPEED_CYCLE: Speed[] = ['off', 'slow', 'medium', 'fast'];
const SPEED_MS: Record<Speed, number> = { off: 0, slow: 1200, medium: 600, fast: 250 };

type Tab = 'import' | 'review' | 'library';

export default function App() {
  const { t } = useTranslation('shell');
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [ply, setPly] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('import');
  const [flipped, setFlipped] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [soundOn, setSoundOn] = useState(() => safeStorageGet('chessreviewer.soundOn') !== '0');
  const [voiceOn, setVoiceOn] = useState(() => safeStorageGet('chessreviewer.voiceOn') !== '0');
  const [volume, setVolumeState] = useState(getVolume);
  const [autoplaySpeed, setAutoplaySpeed] = useState<Speed>('off');
  const auth = useAuth();
  const [lastImport, setLastImport] = useState<{ pgn: string; source: GameSource } | null>(null);
  const [autoScore, setAutoScore] = useState<{ done: number; total: number } | null>(null);
  const prevPly = useRef(0);
  const autoplayTimer = useRef<number | null>(null);
  const runSeq = useRef(0);
  const autoRanForUser = useRef<string | null>(null); // guards "once per login"
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const total = game?.plies.length ?? 0;
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest?.(IGNORE_SELECTOR)) { touchStart.current = null; return; }
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
    setFlipped(false);
    let parsed: ParsedGame;
    try {
      parsed = parsePgn(pgnText);
    } catch (e) {
      // Surface the real reason (bad move, truncated paste, non-PGN text) so a
      // failed import is diagnosable instead of a fixed, opaque string.
      const detail = e instanceof Error ? e.message : String(e);
      console.error('[ChessReviewer] PGN parse failed:', e);
      setError(t('errors.pgnParse', { detail }));
      return;
    }
    setGame(parsed);
    setPly(0);
    setProgress(t('progress.analyzing'));
    setProgressPct(0);
    try {
      const analyses = await analyzeGame(parsed, DEPTH, (d, total) => {
        if (seq === runSeq.current) {
          setProgress(t('progress.analyzingPosition', { done: d, total }));
          setProgressPct(total > 0 ? Math.round((d / total) * 100) : 0);
        }
      });
      if (seq !== runSeq.current) return;
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setShowReveal(true);
      setProgress(null);
      setTab('review');
    } catch (e) {
      if (seq !== runSeq.current) return;
      // Engine failures (WASM blocked by a proxy/CSP, worker load error, UCI
      // timeout) were previously undiagnosable — log the cause for support.
      const detail = e instanceof Error ? e.message : String(e);
      console.error('[ChessReviewer] Analysis failed:', e);
      setError(t('errors.engineFailure', { detail }));
      setProgress(null);
    }
  }

  // Recent-games sidebar → fresh analysis. Leave the library first so the
  // AnalysisProgress screen is visible while the engine runs (the library
  // branch would otherwise cover it); run() lands on the review tab when done.
  function analyzeFromLibrary(pgn: string, source: GameSource) {
    setTab('import');
    void run(pgn, source);
  }

  async function openSaved(gameId: string) {
    if (!supabase) return;
    const row = await fetchSavedGame(supabase, gameId);
    const rebuilt = row ? rowToReview(row.pgn, row.analysis) : null;
    if (!rebuilt) { setError(t('errors.savedReviewLoadFailed')); setTab('import'); return; }
    runSeq.current++;      // invalidate any in-flight analysis so it can't clobber this saved review
    setProgress(null);
    setError(null);
    setAutoplaySpeed('off');
    setGame(rebuilt.game);
    setReview(rebuilt.review);
    setPly(0);
    setLastImport(null);   // prevents the sync effect from re-uploading (guard requires lastImport)
    setTab('review');
  }

  // Analyze + queue one game WITHOUT touching the board — reuses the exact same
  // pipeline run() uses (parsePgn → analyzeGame → assembleReview → mapReview),
  // then hands the payload to the write-behind sync queue. A shared Engine is
  // threaded through so the whole batch runs on one Stockfish worker, serially.
  async function analyzeAndQueue(pgnText: string, source: GameSource, userId: string, engine: Engine) {
    const parsed = parsePgn(pgnText);
    const analyses = await analyzeGame(parsed, DEPTH, undefined, engine);
    const review = assembleReview(parsed, analyses, OPENINGS);
    const payload = mapReview(parsed, review, source, DEPTH, pgnText);
    enqueue(localStorage, payload, `${userId}:${hashString(pgnText)}`);
  }

  // ── on login: fetch the player's latest games, auto-open the newest, and
  // score the rest in the background (see the guarded effect below) ──
  async function runAutoReview(client: SupabaseClient, userId: string) {
    let profile;
    try { profile = await fetchProfile(client, userId); } catch { return; }
    const target = chooseImportSource(profile);
    if (!target) return; // no linked chess.com / lichess account

    // Snapshot the run counter: if the user starts their own game while we're
    // fetching, runSeq changes and we must NOT clobber their board.
    const startSeq = runSeq.current;

    let fetched;
    try {
      fetched = target.source === 'chesscom'
        ? await fetchComGames(target.username)
        : await fetchLiGames(target.username);
    } catch { return; } // bad username / site down — stay silent, don't disrupt
    const latest = latestGames(fetched, LATEST_N);
    if (latest.length === 0) return;

    let existing: Array<{ id: string; pgn_hash: string }> = [];
    try { existing = await fetchLibraryPgnHashes(client); } catch { /* best-effort dedupe */ }
    const reviewedHashes = new Set(existing.map((e) => e.pgn_hash));
    const idByHash = new Map(existing.map((e) => [e.pgn_hash, e.id] as const));

    // "Latest" = the most-recently-played fetched game. Auto-open it so the user
    // lands on it — but only if they haven't started their own game meanwhile.
    const newest = latest[0];
    const newestHash = hashString(newest.pgn);
    const scored = new Set<string>();
    if (runSeq.current === startSeq) {
      if (reviewedHashes.has(newestHash)) {
        const id = idByHash.get(newestHash);
        if (id) await openSaved(id); // already analyzed — just load it, no re-run
      } else {
        await run(newest.pgn, target.source); // analyze + display + upload
        scored.add(newest.id);
      }
    }

    // Score every remaining not-yet-reviewed game from the latest N, serially,
    // on one worker. Per-game errors are swallowed so one bad game can't abort
    // the batch. This never touches the board.
    const toScore = unreviewedGames(
      latest.filter((g) => !scored.has(g.id)),
      reviewedHashes,
      hashString,
    );
    if (toScore.length === 0) return;

    const engine = new Engine();
    try {
      setAutoScore({ done: 0, total: toScore.length });
      for (let i = 0; i < toScore.length; i++) {
        try { await analyzeAndQueue(toScore[i].pgn, target.source, userId, engine); }
        catch { /* skip this game, keep going */ }
        setAutoScore({ done: i + 1, total: toScore.length });
      }
    } finally {
      engine.quit();
      setAutoScore(null);
    }

    void flushQueue(localStorage, (p, id) =>
      id.startsWith(`${userId}:`)
        ? uploadReview(client, userId, p)
        : Promise.reject(new Error('queued by another user')),
    ).catch(() => { /* fire-and-forget; retried on next login */ });
  }

  // Runs once per login: the ref guard survives React StrictMode's double
  // effect invocation, and resets on sign-out so a later login re-runs.
  useEffect(() => {
    const client = supabase;
    const user = auth.user;
    if (!client || !user) { autoRanForUser.current = null; return; }
    if (autoRanForUser.current === user.id) return;
    autoRanForUser.current = user.id;
    void runAutoReview(client, user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

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
    // Enqueue exactly once per finished review — other values are read, not triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Retry once per (re)appearing user id — client identity is stable per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  useEffect(() => { safeStorageSet('chessreviewer.soundOn', soundOn ? '1' : '0'); }, [soundOn]);
  useEffect(() => { safeStorageSet('chessreviewer.voiceOn', voiceOn ? '1' : '0'); }, [voiceOn]);

  const cycleAutoplaySpeed = useCallback(() => {
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
    // At the final position, reflect the game result rather than the last engine
    // eval: a resignation or agreed draw isn't captured by the board evaluation,
    // so drive the bar fully to the winner (or centre for a draw).
    if (ply === total) {
      if (result === '1-0') return 32000;
      if (result === '0-1') return -32000;
      if (result === '1/2-1/2') return 0;
    }
    if (ply === 0) {
      const p0 = review.plies[0];
      return p0 ? (p0.color === 'white' ? p0.evalBeforeCp : -p0.evalBeforeCp) : 0;
    }
    return whiteEvals[ply - 1] ?? 0;
  }, [review, ply, whiteEvals, total, result]);

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

  // ── playback + shortcut handlers (useCallback-stable for useReviewShortcuts) ──
  const goPrev = useCallback(() => setPly((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setPly((p) => Math.min(total, p + 1)), [total]);
  const goStart = useCallback(() => setPly(0), []);
  const goEnd = useCallback(() => setPly(total), [total]);
  const handleFlip = useCallback(() => setFlipped((f) => !f), []);
  const handleSelectPly = useCallback(
    (p: number) => setPly(Math.max(0, Math.min(total, p))),
    [total],
  );
  useReviewShortcuts(tab === 'review' && !!review, {
    onPrev: goPrev,
    onNext: goNext,
    onStart: goStart,
    onEnd: goEnd,
    onToggleAutoplay: cycleAutoplaySpeed,
    onFlip: handleFlip,
  });

  return (
    <div className="min-h-screen flex flex-col relative">
      <SeoHead />
      <AdsRoot />
      <Header
        activeTab={tab}
        onSelectTab={setTab}
        hasActiveReview={!!review && !!game}
        authEnabled={auth.enabled}
        userEmail={auth.user?.email ?? null}
        onOpenAuth={() => setShowAuth(true)}
      />

      <main className="flex-1 w-full pb-16">
        {autoScore && autoScore.total > 0 && (() => {
          const pct = Math.round((autoScore.done / autoScore.total) * 100);
          return (
            <div className="max-w-3xl mx-auto mt-4 px-4">
              <div className="glass-panel rounded-xl p-3 text-xs font-mono text-slate-300 space-y-2">
                <p>{t('progress.autoScore', { done: autoScore.done, total: autoScore.total })}</p>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-1 bg-indigo-950 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {error && tab !== 'library' && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-center gap-3 max-w-3xl mx-auto mt-4">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'library' ? (
          auth.user ? (
            <LibraryView user={auth.user} onOpen={openSaved} onAnalyze={analyzeFromLibrary} />
          ) : (
            <div className="max-w-md mx-auto my-16 glass-panel rounded-3xl p-8 border border-cyan-400/30 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <Library className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white font-display">
                {t('librarySignedOut.title')}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {auth.enabled
                  ? t('librarySignedOut.syncDescription')
                  : t('librarySignedOut.syncUnavailable')}
              </p>
              {auth.enabled && (
                <button
                  onClick={() => setShowAuth(true)}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#05040c] font-sans font-bold text-sm shadow-[0_0_15px_rgba(56,225,214,0.3)] transition-all cursor-pointer"
                >
                  {t('librarySignedOut.cta')}
                </button>
              )}
            </div>
          )
        ) : progress && !review ? (
          <AnalysisProgress label={progress} pct={progressPct} />
        ) : tab === 'review' && game && fen && review ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left column: player cards, eval bar + board, playback */}
              <div
                className="lg:col-span-6 flex flex-col gap-4"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <PlayerCard
                  name={flipped ? game.white : game.black}
                  elo={flipped ? ratings.white : ratings.black}
                  accuracy={flipped ? review.summary.whiteAccuracy : review.summary.blackAccuracy}
                  color={flipped ? 'white' : 'black'}
                />

                {/* dir="ltr" guard: chess coords + eval bar must never mirror under RTL locales (ar/fa) */}
                <div className="flex items-stretch justify-center gap-3 w-full" dir="ltr">
                  <EvalBar cp={currentWhiteCp} flipped={flipped} />
                  {/* The .board sizing/fx CSS keys off --bs; with the legacy
                      .review-grid gone, derive it from this frame's width via a
                      container query so the checkerboard + fx keep working.
                      The EvalBar needs no such bridge — it sits outside this
                      container-query frame and is sized by the flex
                      items-stretch row instead. */}
                  <div
                    className="flex-1 rounded-2xl overflow-hidden border border-indigo-400/20 shadow-2xl"
                    style={{ containerType: 'inline-size' }}
                    dir="ltr"
                  >
                    <div className="board" ref={boardRef} style={{ '--bs': '100cqw' } as React.CSSProperties}>
                      <ReviewBoard
                        fen={fen}
                        lastMove={lastMove}
                        badge={badge}
                        arrow={arrow}
                        checkSquare={checkSq}
                        orientation={flipped ? 'black' : 'white'}
                      />
                    </div>
                  </div>
                </div>

                <PlayerCard
                  name={flipped ? game.black : game.white}
                  elo={flipped ? ratings.black : ratings.white}
                  accuracy={flipped ? review.summary.blackAccuracy : review.summary.whiteAccuracy}
                  color={flipped ? 'black' : 'white'}
                />

                <PlaybackControls
                  ply={ply}
                  total={total}
                  onSelectPly={handleSelectPly}
                  speed={autoplaySpeed}
                  onCycleSpeed={cycleAutoplaySpeed}
                  flipped={flipped}
                  onToggleFlip={handleFlip}
                  soundOn={soundOn}
                  onToggleSound={() => setSoundOn((s) => !s)}
                  voiceOn={voiceOn}
                  onToggleVoice={() => setVoiceOn((v) => !v)}
                  volume={volume}
                  onVolume={handleVolume}
                />
              </div>

              {/* Right column: coach, move list, breakdown + eval graph */}
              <div className="lg:col-span-6 flex flex-col gap-4 panel-enter">
                <CoachCard
                  opening={review.summary.opening}
                  evalCp={currentWhiteCp}
                  move={currentMove}
                  voiceOn={voiceOn}
                />

                <MoveList plies={review.plies} current={ply} onSelect={handleSelectPly} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SummaryPanel
                    summary={review.summary}
                    white={game.white}
                    black={game.black}
                    ratings={ratings}
                    result={result}
                  />
                  <EvalGraphCard
                    evalsCp={whiteEvals}
                    classifications={classifications}
                    current={Math.max(0, ply - 1)}
                    onSelect={(i) => handleSelectPly(i + 1)}
                  />
                </div>
              </div>
            </div>
            <AdSlot placement="review" />
          </div>
        ) : (
          <>
            <ImportSection onPgn={run} />
            <SeoContent />
            <AdSlot placement="landing" className="px-4" />
          </>
        )}
      </main>

      <Footer />

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

      {showAuth && auth.enabled && (
        <AuthModal auth={auth} onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}
