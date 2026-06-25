import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { uciToSan } from './chess/san';
import { playSound, sanToSound } from './sound';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings.sample';
import { ImportPanel } from './components/ImportPanel';
import { ReviewBoard } from './components/ReviewBoard';
import { EvalBar } from './components/EvalBar';
import { CoachCard, type CurrentMove } from './components/CoachCard';
import { MoveList } from './components/MoveList';
import { EvalGraph } from './components/EvalGraph';
import { SummaryPanel } from './components/SummaryPanel';
import type { ParsedGame } from './chess/types';

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
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [autoplaySpeed, setAutoplaySpeed] = useState<Speed>('off');
  const prevPly = useRef(0);
  const autoplayTimer = useRef<number | null>(null);

  const total = game?.plies.length ?? 0;
  const result = game?.headers.Result ?? null;

  async function run(pgnText: string) {
    setError(null);
    setReview(null);
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
        setProgress(`Analyzing position ${d} / ${t}`);
        setProgressPct(t > 0 ? Math.round((d / t) * 100) : 0);
      });
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setProgress(null);
      setShowImport(false);
    } catch {
      setError('The engine could not load in this browser. Try reloading the page.');
      setProgress(null);
    }
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

  const currentMove = useMemo((): CurrentMove | null => {
    if (!playedPly) return null;
    return {
      san: playedPly.san,
      cls: playedPly.classification,
      bestSan: uciToSan(playedPly.fenBefore, playedPly.bestMoveUci),
      isBest: playedPly.uci === playedPly.bestMoveUci,
    };
  }, [playedPly]);

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
      if (p) playSound(sanToSound(p.san));
    }
    prevPly.current = ply;
  }, [ply, review, soundOn]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="pc">♞</span> Chess Reviewer</div>
        <div className="tagline">Paste a PGN or import from chess.com / lichess.org — Stockfish analyzes every move in-browser</div>
      </header>

      {showImport ? (
        <ImportPanel onPgn={run} />
      ) : (
        <div className="gamebar">
          <button onClick={() => setShowImport(true)}>↺ New game</button>
          {game && review && (
            <span className="gamebar-title">
              {game.white} <span className="vs">vs</span> {game.black}
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
          <section className="board-col">
            <div className="player black-name">{game.black}</div>
            <div className="board-area">
              <EvalBar cp={currentWhiteCp} />
              <div className="board">
                <ReviewBoard fen={fen} lastMove={lastMove} badge={badge} arrow={arrow} />
              </div>
            </div>
            <div className="player white-name">{game.white}</div>
          </section>

          {review && (
            <aside className="panel">
              <CoachCard opening={review.summary.opening} evalCp={currentWhiteCp} move={currentMove} voiceOn={voiceOn} />

              <SummaryPanel summary={review.summary} white={game.white} black={game.black} result={result}>
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
    </div>
  );
}
