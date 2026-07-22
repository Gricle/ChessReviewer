import { Cpu, Library, UserCheck } from 'lucide-react';

interface Props {
  activeTab: 'import' | 'review' | 'library';
  onSelectTab: (tab: 'import' | 'review' | 'library') => void;
  hasActiveReview: boolean;
  authEnabled: boolean;
  userEmail: string | null;
  onOpenAuth: () => void;
}

export function Header({
  activeTab,
  onSelectTab,
  hasActiveReview,
  authEnabled,
  userEmail,
  onOpenAuth,
}: Props) {
  return (
    <header className="w-full glass-panel sticky top-0 z-40 border-b border-indigo-400/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab(hasActiveReview ? 'review' : 'import')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-2xl font-bold text-[#05040c] shadow-[0_0_15px_rgba(56,225,214,0.4)] group-hover:scale-105 transition-transform">
            ♞
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white font-display">
                Chess Reviewer
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[10px] font-mono text-cyan-300">
                <Cpu className="w-3 h-3" /> Stockfish · depth 14
              </span>
            </div>
            <p className="text-[11px] font-mono text-indigo-200/60 hidden sm:block">
              Client-side Game Analysis Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          {hasActiveReview && (
            <button
              onClick={() => onSelectTab('review')}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'review'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,225,214,0.2)]'
                  : 'bg-indigo-950/40 text-slate-300 border border-indigo-500/20 hover:bg-indigo-900/40'
              }`}
            >
              Active Review
            </button>
          )}

          <button
            onClick={() => onSelectTab('import')}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,225,214,0.2)]'
                : 'bg-indigo-950/40 text-slate-300 border border-indigo-500/20 hover:bg-indigo-900/40'
            }`}
          >
            New Import
          </button>

          <button
            onClick={() => onSelectTab('library')}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,225,214,0.2)]'
                : 'bg-indigo-950/40 text-slate-300 border border-indigo-500/20 hover:bg-indigo-900/40'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Library & Trends</span>
          </button>

          {/* Auth Button */}
          {authEnabled && (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline max-w-[160px] truncate">
                {userEmail ?? 'Guest Mode'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
