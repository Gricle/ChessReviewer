import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageSwitcher } from './LanguageSwitcher';
import { setLanguage } from '../i18n';

const NATIVE_NAMES = [
  'English',
  '中文',
  'हिन्दी',
  'Español',
  'Français',
  'العربية',
  'Русский',
  'Português',
  'Deutsch',
  'فارسی',
];

function trigger() {
  return screen.getByRole('button', { name: 'Change language' });
}

afterEach(() => {
  // Reset so other test files always run in English/ltr.
  setLanguage('en');
});

describe('LanguageSwitcher', () => {
  it('renders the current language code', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText('EN')).toBeTruthy();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a listbox with all 10 languages by native name', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(10);
    for (const native of NATIVE_NAMES) {
      expect(screen.getByText(native)).toBeTruthy();
    }
    expect(
      screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')?.textContent,
    ).toContain('English');
  });

  it('selecting a language switches lang/dir on <html> and closes the list', async () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByText('فارسی'));
    expect(screen.queryByRole('listbox')).toBeNull();
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('fa');
    await waitFor(() => expect(screen.getByText('FA')).toBeTruthy());

    fireEvent.click(trigger());
    fireEvent.click(screen.getByText('English'));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('en');
  });

  it('closes on Escape', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
