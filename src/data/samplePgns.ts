// Classic / demo PGNs used to power the "Quick Demos" chips on the import
// screen. Each entry parses cleanly via chess/pgnParser and runs through a
// full engine review so newcomers can see what an analyzed game looks like
// without importing their own.

export interface SamplePgn {
  label: string;
  sub: string;
  pgn: string;
}

export const SAMPLE_PGNS: Record<'immortal' | 'opera' | 'blunderfest', SamplePgn> = {
  immortal: {
    label: 'Immortal Game (1851)',
    sub: "Anderssen's sacrificial masterpiece",
    pgn: `[Event "London"]
[Site "London"]
[Date "1851.06.21"]
[Round "?"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0
`,
  },
  opera: {
    label: 'Opera Game (Morphy)',
    sub: 'A lesson in rapid development',
    pgn: `[Event "Paris"]
[Site "Paris"]
[Date "1858.10.??"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
`,
  },
  blunderfest: {
    label: 'Tactics & Blunders',
    sub: 'Hung pieces galore — great for spotting mistakes',
    pgn: `[Event "Casual Game"]
[Site "Internet Chess Club"]
[Date "2024.03.15"]
[Round "-"]
[White "Tactics Demo"]
[Black "Blunder Bot"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Bg5 h6 8. Bh4
g5 9. Bg3 Nxe4 10. dxe4 Bxf2+ 11. Rxf2 Qe7 12. Nbd2 Be6 13. Bxe6 fxe6 14. Qc2
a6 15. Rd1 b5 16. Nxg5 Qd8 17. Nxe6 Qd7 18. Nxf8 Rxf8 19. Qb3+ Kh8 20. Nc4 Rf6
21. Nxd6 Qxd6 22. Rxd6 Kg7 23. Rd7+ Kg6 24. Rxc7 Rf7 25. Rcxf7 Kg5 26. h4+ Kh5
27. Qd1+ Kg6 1-0
`,
  },
};
