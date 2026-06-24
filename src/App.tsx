import { useMemo, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { uciToSan } from './chess/san';
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

export default function App() {
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [ply, setPly] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setProgress('Analyzing position 0');
    try {
      const analyses = await analyzeGame(parsed, DEPTH, (d, t) => setProgress(`Analyzing position ${d} / ${t}`));
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setProgress(null);
    } catch {
      setError('The engine could not load in this browser. Try reloading the page.');
      setProgress(null);
    }
  }

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

  // Best-move arrow from the position before the current move.
  const arrow = useMemo((): [string, string] | null => {
    if (!playedPly) return null;
    const uci = playedPly.bestMoveUci;
    return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null;
  }, [playedPly]);

  // Coach comment payload for the current move.
  const currentMove = useMemo((): CurrentMove | null => {
    if (!playedPly) return null;
    return {
      san: playedPly.san,
      cls: playedPly.classification,
      bestSan: uciToSan(playedPly.fenBefore, playedPly.bestMoveUci),
      isBest: playedPly.uci === playedPly.bestMoveUci,
    };
  }, [playedPly]);

  // Each ply's eval after the move, from white's perspective (for the graph).
  const whiteEvals = useMemo(() => {
    if (!review) return [];
    return review.plies.map((p) => (p.color === 'white' ? p.evalAfterCp : -p.evalAfterCp));
  }, [review]);

  // White-perspective eval of the currently shown position (eval bar + pill).
  const currentWhiteCp = useMemo(() => {
    if (!review) return 0;
    if (ply === 0) {
      const p0 = review.plies[0];
      return p0 ? (p0.color === 'white' ? p0.evalBeforeCp : -p0.evalBeforeCp) : 0;
    }
    return whiteEvals[ply - 1] ?? 0;
  }, [review, ply, whiteEvals]);

  const total = game?.plies.length ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="pc">♞</span> Chess Reviewer</div>
        <div className="tagline">Game Review — Stockfish runs right in your browser</div>
      </header>

      <ImportPanel onPgn={run} />

      {progress && <div className="status"><span className="dot" /> {progress}</div>}
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
              <CoachCard opening={review.summary.opening} evalCp={currentWhiteCp} move={currentMove} />

              <SummaryPanel summary={review.summary} white={game.white} black={game.black}>
                <MoveList plies={review.plies} current={ply} onSelect={setPly} />
              </SummaryPanel>

              <div className="card graph-card">
                <EvalGraph
                  evalsCp={whiteEvals}
                  current={Math.max(0, ply - 1)}
                  onSelect={(i) => setPly(i + 1)}
                />
                <div className="playback">
                  <button onClick={() => setPly(0)} title="Start" aria-label="Start">⏮</button>
                  <button onClick={() => setPly((p) => Math.max(0, p - 1))} title="Previous" aria-label="Previous move">◀</button>
                  <button onClick={() => setPly((p) => Math.min(total, p + 1))} title="Next" aria-label="Next move">▶</button>
                  <button onClick={() => setPly(total)} title="End" aria-label="End">⏭</button>
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
