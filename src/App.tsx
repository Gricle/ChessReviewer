import { useMemo, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings.sample';
import { ImportPanel } from './components/ImportPanel';
import { ReviewBoard } from './components/ReviewBoard';
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
      const analyses = await analyzeGame(parsed, DEPTH, (d, t) => setProgress(`Analyzing ${d}/${t}`));
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

  const whiteEvals = useMemo(() => {
    if (!review) return [];
    // Convert each ply's mover-perspective eval to white perspective for the graph.
    return review.plies.map((p) =>
      p.color === 'white' ? p.evalAfterCp : -p.evalAfterCp,
    );
  }, [review]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h2>Chess Reviewer</h2>
      <ImportPanel onPgn={run} />
      {progress && <div>{progress}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {game && fen && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 16 }}>
          <div>
            <ReviewBoard fen={fen} arrow={arrow} />
            <div>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
              <button onClick={() => setPly((p) => Math.min(game.plies.length, p + 1))}>▶</button>
              <span> ply {ply}/{game.plies.length}</span>
            </div>
            {review && (
              <EvalGraph evalsCp={whiteEvals} current={Math.max(0, ply - 1)} onSelect={(i) => setPly(i + 1)} />
            )}
          </div>
          {review && <MoveList plies={review.plies} current={ply} onSelect={setPly} />}
          {review && <SummaryPanel summary={review.summary} white={game.white} black={game.black} />}
        </div>
      )}
    </div>
  );
}
