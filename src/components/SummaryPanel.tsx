import type { ReviewSummary, Classification } from '../chess/types';

const ORDER: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder',
];

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
}

export function SummaryPanel({ summary, white, black }: Props) {
  return (
    <div style={{ width: 260 }}>
      <h3>Game Review</h3>
      {summary.opening && <p>Opening: {summary.opening.eco} {summary.opening.name}</p>}
      <table>
        <thead>
          <tr><th></th><th>{white}</th><th>{black}</th></tr>
          <tr>
            <td>Accuracy</td>
            <td>{summary.whiteAccuracy.toFixed(1)}%</td>
            <td>{summary.blackAccuracy.toFixed(1)}%</td>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((label) => (
            <tr key={label}>
              <td style={{ textTransform: 'capitalize' }}>{label}</td>
              <td align="center">{summary.counts[label].white}</td>
              <td align="center">{summary.counts[label].black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
