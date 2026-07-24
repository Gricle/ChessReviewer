import { useTranslation } from 'react-i18next';
import {
  Cpu,
  Award,
  LineChart,
  MessageSquare,
  BookOpen,
  Download,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Crawlable, keyword-rich landing content shown beneath the import cards on the
 * home tab. Real, useful copy (features, how-it-works, comparison, FAQ) that
 * gives search engines something to index and users a reason to trust the tool.
 * All strings come from the `seo` i18n namespace; the FAQ mirrors the FAQPage
 * JSON-LD injected in index.html.
 */

const FEATURE_KEYS = [
  { key: 'engine', Icon: Cpu, accent: 'text-cyan-400' },
  { key: 'classify', Icon: Award, accent: 'text-amber-400' },
  { key: 'accuracy', Icon: LineChart, accent: 'text-teal-300' },
  { key: 'coach', Icon: MessageSquare, accent: 'text-indigo-300' },
  { key: 'openings', Icon: BookOpen, accent: 'text-rose-300' },
  { key: 'import', Icon: Download, accent: 'text-emerald-400' },
] as const;

const HOW_KEYS = ['step1', 'step2', 'step3'] as const;
const FAQ_KEYS = ['free', 'how', 'alternative', 'privacy', 'engine', 'languages'] as const;

export function SeoContent() {
  const { t } = useTranslation('seo');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-8 space-y-16">
      {/* Features */}
      <section aria-labelledby="features-heading" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2
            id="features-heading"
            className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight"
          >
            {t('landing.featuresHeading')}
          </h2>
          <p className="text-sm text-slate-400 font-sans leading-relaxed">
            {t('landing.featuresSub')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_KEYS.map(({ key, Icon, accent }) => (
            <Feature
              key={key}
              Icon={Icon}
              accent={accent}
              title={t(`landing.features.${key}.title`)}
              body={t(`landing.features.${key}.body`)}
            />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2
            id="how-heading"
            className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight"
          >
            {t('landing.howHeading')}
          </h2>
          <p className="text-sm text-slate-400 font-sans leading-relaxed">{t('landing.howSub')}</p>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {HOW_KEYS.map((key) => (
            <li
              key={key}
              className="glass-panel rounded-2xl p-6 border border-indigo-400/20 shadow-xl space-y-2"
            >
              <h3 className="text-base font-bold text-cyan-300 font-display">
                {t(`landing.how.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-400 font-sans leading-relaxed">
                {t(`landing.how.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Comparison */}
      <section
        aria-labelledby="compare-heading"
        className="glass-panel rounded-2xl p-8 border border-cyan-400/20 shadow-xl max-w-3xl mx-auto text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 font-mono text-xs font-bold">
          <Check className="w-3.5 h-3.5" /> {t('landing.compareHeading')}
        </div>
        <p className="text-sm text-slate-300 font-sans leading-relaxed max-w-2xl mx-auto">
          {t('landing.compareBody')}
        </p>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="space-y-6 max-w-3xl mx-auto">
        <h2
          id="faq-heading"
          className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight text-center"
        >
          {t('landing.faqHeading')}
        </h2>
        <div className="space-y-3">
          {FAQ_KEYS.map((key) => (
            <details
              key={key}
              className="group glass-panel rounded-2xl border border-indigo-400/20 shadow-lg overflow-hidden"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 text-sm font-semibold text-slate-100 font-sans marker:content-['']">
                <h3 className="m-0 text-sm font-semibold">{t(`landing.faq.${key}.q`)}</h3>
                <span className="text-cyan-400 shrink-0 transition-transform group-open:rotate-45 text-lg leading-none">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-sm text-slate-400 font-sans leading-relaxed">
                {t(`landing.faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Feature({
  Icon,
  accent,
  title,
  body,
}: {
  Icon: LucideIcon;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-indigo-400/20 shadow-xl space-y-3">
      <div
        className={`w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center ${accent}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-white font-display">{title}</h3>
      <p className="text-sm text-slate-400 font-sans leading-relaxed">{body}</p>
    </div>
  );
}
