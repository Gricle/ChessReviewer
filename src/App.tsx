import { useMemo, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings.sample';
import { ImportPanel } from './components/ImportPanel';
import { ReviewBoard } from './components/ReviewBoard';
import { EvalBar } from './components/EvalBar';
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
      setError('Invalid PGN');
      return;
    }
    setGame(parsed);
    setPly(0);
    setProgress('Analyzing…');
    try {
      const analyses = await analyzeGame(parsed, DEPTH, (d, t) => setProgress(`Analyzing position ${d} / ${t}`));
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setProgress(null);
    } catch {
      setError('Analysis failed (engine could not load).');
      setProgress(null);
    }
  }

  const fen = useMemo(() => {
    if (!game) return undefined;
    if (ply === 0) return game.plies[0]?.fenBefore;
    return game.plies[ply - 1]?.fenAfter;
  }, [game, ply]);

  const arrow = useMemo((): [string, string] | null => {
    if (!review || ply === 0) return null;
    const uci = review.plies[ply - 1]?.bestMoveUci;
    return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null;
  }, [review, ply]);

  // Each ply's eval after the move, from white's perspective (for the graph).
  const whiteEvals = useMemo(() => {
    if (!review) return [];
    return review.plies.map((p) => (p.color === 'white' ? p.evalAfterCp : -p.evalAfterCp));
  }, [review]);

  // White-perspective eval of the currently shown position (for the eval bar).
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
        <div className="brand"><span className="pc">♟</span> Chess Reviewer</div>
        <div className="tagline">Game Review — powered by Stockfish, right in your browser</div>
      </header>

      <ImportPanel onPgn={run} />

      {progress && (
        <div className="status"><span className="dot" /> {progress}</div>
      )}
      {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}

      {game && fen && (
        <div className="review-grid">
          <section className="board-col">
            <div className="board-area">
              <EvalBar cp={currentWhiteCp} />
              <div className="board">
                <ReviewBoard fen={fen} arrow={arrow} />
              </div>
            </div>

            <div className="controls">
              <button onClick={() => setPly(0)} title="Start">⏮</button>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))} title="Previous">◀</button>
              <button onClick={() => setPly((p) => Math.min(total, p + 1))} title="Next">▶</button>
              <button onClick={() => setPly(total)} title="End">⏭</button>
              <span className="ply">{ply} / {total}</span>
            </div>

            {review && (
              <div className="graph-wrap">
                <EvalGraph
                  evalsCp={whiteEvals}
                  current={Math.max(0, ply - 1)}
                  onSelect={(i) => setPly(i + 1)}
                />
              </div>
            )}
          </section>

          {review && (
            <aside className="panel">
              <SummaryPanel summary={review.summary} white={game.white} black={game.black}>
                <MoveList plies={review.plies} current={ply} onSelect={setPly} />
              </SummaryPanel>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
