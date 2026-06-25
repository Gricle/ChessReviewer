import type { PositionAnalysis } from '../chess/types';
import { parseInfoLine } from './uci';

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;

  constructor(url: string = ENGINE_URL) {
    this.worker = new Worker(url);
    this.ready = this.handshake();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private handshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Engine handshake timed out — Stockfish may have failed to load')),
        12_000,
      );
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        if (line === 'uciok') this.send('isready');
        if (line === 'readyok') {
          clearTimeout(timer);
          this.worker.removeEventListener('message', onMsg);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.send('uci');
    });
  }

  async analyze(fen: string, depth: number): Promise<PositionAnalysis> {
    await this.ready;
    return new Promise((resolve) => {
      const best: Record<number, { cp: number; mate: number | null; move: string }> = {};
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        const info = parseInfoLine(line);
        if (info) {
          best[info.multipv] = { cp: info.cp, mate: info.mate, move: info.firstMove };
        }
        if (line.startsWith('bestmove')) {
          this.worker.removeEventListener('message', onMsg);
          const pv1 = best[1];
          const pv2 = best[2] ?? null;
          resolve({
            fen,
            bestMoveUci: pv1?.move ?? line.split(' ')[1] ?? '',
            bestEvalCp: pv1?.cp ?? 0,
            secondBestEvalCp: pv2 ? pv2.cp : null,
            mate: pv1?.mate ?? null,
          });
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.send('setoption name MultiPV value 2');
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  quit() {
    this.send('quit');
    this.worker.terminate();
  }
}
