# i18n Conventions

Infrastructure lives in `src/i18n/index.ts`; English catalogs in `src/i18n/locales/en/*.json`.
All five namespaces are already registered — extraction agents only edit JSON files and components,
never `src/i18n/index.ts`.

## Namespace → domain mapping

| Namespace | Owns |
|-----------|------|
| `shell`   | Header / app chrome (already done — use as the reference pattern) |
| `import`  | import / auth / analysis screens |
| `review`  | review deck components |
| `coach`   | coach explanation templates |
| `library` | library components + App shell strings |

## Key style

- Dot-grouped lowercase camel: `hero.title`, `auth.signIn`, `chip.engine`.
  Keys are nested JSON objects (`{ "hero": { "title": "..." } }`), looked up with `t('hero.title')`.
- Interpolation: `{{name}}` in JSON, `t('key', { name })` at the call site.
- Plurals: i18next suffixes — `key_one` / `key_other` sibling keys, `t('key', { count })`.

## Hard rules

- **English values must match current UI text byte-for-byte** — existing tests assert exact strings.
- React components: `const { t } = useTranslation('<ns>');` then `t('key')`.
- Non-React modules: `import i18n from '../i18n';` (adjust path) then `i18n.t('<ns>:key')`.
- Never call `i18n.changeLanguage` directly — use the exported `setLanguage(code)` helper
  (it owns localStorage persistence and `<html lang>`/`<html dir>`).
- Tests: i18n is initialized in English by `src/test/setup.ts` (vitest `setupFiles`);
  if a test changes language, reset with `setLanguage('en')` in `afterEach`.

## Adding a locale (translation agent)

Create `src/i18n/locales/<code>/` mirroring `en/` (five JSONs + `index.ts`), then add the
entry to `RESOURCES` in `src/i18n/index.ts`. Supported codes/dirs are in `LANGUAGES` there.
