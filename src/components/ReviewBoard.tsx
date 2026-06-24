import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

interface Props {
  fen: string;
  // optional best-move arrow as [fromSquare, toSquare], e.g. ['g1','f3']
  arrow?: [string, string] | null;
}

export function ReviewBoard({ fen, arrow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { fen, viewOnly: true, coordinates: true });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    api.current?.set({
      fen,
      drawable: {
        autoShapes: arrow
          ? [{ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' }]
          : [],
      },
    });
  }, [fen, arrow]);

  return <div ref={el} style={{ width: 480, height: 480 }} />;
}
