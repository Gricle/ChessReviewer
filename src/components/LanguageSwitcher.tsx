import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { t, i18n: i18nInstance } = useTranslation('shell');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentCode = (i18nInstance.language ?? 'en').split('-')[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('language.label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span>{currentCode.toUpperCase()}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.label')}
          className="absolute right-0 top-full mt-2 min-w-[10rem] rounded-xl bg-[rgba(24,22,50,0.92)] backdrop-blur-xl border border-indigo-400/20 shadow-[0_8px_30px_rgba(5,4,12,0.6)] py-1.5 z-50"
        >
          {LANGUAGES.map((lang) => {
            const selected = lang.code === currentCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-1.5 text-xs font-mono whitespace-nowrap transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  selected
                    ? 'text-cyan-300 bg-cyan-500/10'
                    : 'text-slate-300 hover:bg-indigo-900/40'
                }`}
              >
                <span lang={lang.code} dir={lang.dir}>{lang.native}</span>
                <span className="text-[10px] text-indigo-200/50 uppercase">{lang.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
