export const MATE_CP = 32000;

export function parseScoreCp(text: string): { cp: number; mate: number | null } {
  const mateMatch = text.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const mate = parseInt(mateMatch[1], 10);
    return { cp: mate >= 0 ? MATE_CP : -MATE_CP, mate };
  }
  const cpMatch = text.match(/score cp (-?\d+)/);
  if (cpMatch) return { cp: parseInt(cpMatch[1], 10), mate: null };
  return { cp: NaN, mate: null };
}

export interface InfoLine {
  multipv: number;
  cp: number;
  mate: number | null;
  firstMove: string;
}

export function parseInfoLine(line: string): InfoLine | null {
  if (!/score (cp|mate) /.test(line)) return null;
  const { cp, mate } = parseScoreCp(line);
  const multipvMatch = line.match(/multipv (\d+)/);
  const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
  const pvMatch = line.match(/ pv (\S+)/);
  if (!pvMatch) return null;
  return { multipv, cp, mate, firstMove: pvMatch[1] };
}
