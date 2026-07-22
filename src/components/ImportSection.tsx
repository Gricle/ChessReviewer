import { useState } from 'react';
import { Cpu, FileText, Globe, ArrowRight, AlertCircle, Play, Loader2, Sparkles } from 'lucide-react';
import { fetchRecentGames as fetchComGames, type GameSummary as ComSummary } from '../importers/chesscom';
import { fetchRecentGames as fetchLiGames, type GameSummary as LiSummary } from '../importers/lichess';
import { SAMPLE_PGNS } from '../data/samplePgns';
import type { GameSource } from '../supabase/mapReview';

type GameSummary = ComSummary | LiSummary;

interface Props {
  onPgn: (pgn: string, source: GameSource) => void;
}

const SAMPLE_ICON_COLOR: Record<keyof typeof SAMPLE_PGNS, string> = {
  immortal: 'text-amber-400',
  opera: 'text-cyan-400',
  blunderfest: 'text-rose-400',
};

export function ImportSection({ onPgn }: Props) {
  const [pgnInput, setPgnInput] = useState('');
  const [comUser, setComUser] = useState('');
  const [liUser, setLiUser] = useState('');
  const [comGames, setComGames] = useState<GameSummary[]>([]);
  const [liGames, setLiGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function loadChessCom() {
    setError(null);
    setComGames([]);
    setLoading('chess.com');
    try {
      setComGames(await fetchComGames(comUser.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(null);
    }
  }

  async function loadLichess() {
    setError(null);
    setLiGames([]);
    setLoading('lichess');
    try {
      setLiGames(await fetchLiGames(liUser.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5" /> Stockfish · Depth 14 · Client-side
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display leading-tight">
          See your game the way the{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
            engine
          </span>{' '}
          sees it.
        </h2>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans">
          Paste a PGN or import your latest games from Chess.com or Lichess. Every move is scored
          from <strong className="text-cyan-300">Brilliant</strong> to <strong className="text-rose-400">Blunder</strong> with accuracy readouts, best-line arrows, opening theory detection, and a natural-language coach.
        </p>

        {/* Quick Sample Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <span className="text-xs font-mono text-slate-400 mr-1">Quick Demos:</span>
          {Object.entries(SAMPLE_PGNS).map(([key, sample]) => (
            <button
              key={key}
              onClick={() => onPgn(sample.pgn, 'paste')}
              className="px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-cyan-500/20 border border-indigo-500/30 text-xs font-mono text-cyan-300 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className={`w-3 h-3 ${SAMPLE_ICON_COLOR[key as keyof typeof SAMPLE_PGNS]}`} /> {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Diagnostic Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-center gap-3 shadow-lg max-w-3xl mx-auto">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3-Column Glass Import Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Paste PGN */}
        <div className="glass-panel rounded-2xl p-6 border border-indigo-400/20 flex flex-col justify-between shadow-xl space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
              <FileText className="w-4 h-4" />
              <span>Paste PGN</span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Paste any raw PGN text with headers or move history.
            </p>
            <textarea
              rows={7}
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              placeholder={`[Event "Casual Game"]\n[White "Player1"]\n[Black "Player2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 ...`}
              className="w-full bg-[#0b0918]/90 border border-indigo-500/20 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60 resize-none"
            />
          </div>

          <button
            onClick={() => onPgn(pgnInput, 'paste')}
            disabled={!pgnInput.trim()}
            className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#05040c] font-bold font-sans text-sm shadow-[0_0_15px_rgba(56,225,214,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Review This PGN</span>
          </button>
        </div>

        {/* Column 2: From Chess.com */}
        <div className="glass-panel rounded-2xl p-6 border border-indigo-400/20 flex flex-col justify-between shadow-xl space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>From Chess.com</span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Enter your public Chess.com username to fetch recent games.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={comUser}
                onChange={(e) => setComUser(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && comUser.trim()) loadChessCom(); }}
                placeholder="e.g. Hikaru"
                className="flex-1 bg-[#0b0918]/90 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60"
              />
              <button
                onClick={loadChessCom}
                disabled={loading !== null || !comUser.trim()}
                className="px-3 py-2 rounded-xl bg-indigo-900/60 hover:bg-cyan-500/20 border border-indigo-500/30 text-xs font-mono text-cyan-300 disabled:opacity-40 cursor-pointer"
              >
                {loading === 'chess.com' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
              </button>
            </div>

            {/* Games List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {comGames.map((g) => (
                <div
                  key={g.id}
                  onClick={() => onPgn(g.pgn, 'chesscom')}
                  title={g.url}
                  className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-cyan-500/20 border border-indigo-500/15 cursor-pointer transition-all flex items-center justify-between text-xs font-mono group"
                >
                  <div className="truncate pr-2">
                    <p className="text-white font-semibold truncate">
                      {g.white} vs {g.black}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      #{g.id} · {g.date}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: From Lichess.org */}
        <div className="glass-panel rounded-2xl p-6 border border-indigo-400/20 flex flex-col justify-between shadow-xl space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>From Lichess.org</span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Enter your public Lichess username to fetch recent games.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={liUser}
                onChange={(e) => setLiUser(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && liUser.trim()) loadLichess(); }}
                placeholder="e.g. MagnusCarlsen"
                className="flex-1 bg-[#0b0918]/90 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60"
              />
              <button
                onClick={loadLichess}
                disabled={loading !== null || !liUser.trim()}
                className="px-3 py-2 rounded-xl bg-indigo-900/60 hover:bg-cyan-500/20 border border-indigo-500/30 text-xs font-mono text-cyan-300 disabled:opacity-40 cursor-pointer"
              >
                {loading === 'lichess' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
              </button>
            </div>

            {/* Games List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {liGames.map((g) => (
                <div
                  key={g.id}
                  onClick={() => onPgn(g.pgn, 'lichess')}
                  title={g.url}
                  className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-cyan-500/20 border border-indigo-500/15 cursor-pointer transition-all flex items-center justify-between text-xs font-mono group"
                >
                  <div className="truncate pr-2">
                    <p className="text-white font-semibold truncate">
                      {g.white} vs {g.black}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      #{g.id} · {g.date}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
