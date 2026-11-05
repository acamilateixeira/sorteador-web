import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { draw, namePool, numberPool } from './draw';

type Mode = 'names' | 'numbers';
type Round = { id: number; mode: Mode; winners: string[] };

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly mode = signal<Mode>('names');
  readonly names = new FormControl('', { nonNullable: true });
  readonly min = new FormControl<number | null>(1);
  readonly max = new FormControl<number | null>(100);
  readonly quantity = new FormControl<number | null>(1);
  readonly excludePrevious = new FormControl(true, { nonNullable: true });
  readonly result = signal<Round | null>(null);
  readonly history = signal<Round[]>([]);
  readonly error = signal('');
  private previous = new Set<string>();
  private sequenceKey = '';
  private nextRound = 1;

  selectMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
  }

  drawRound(): void {
    this.error.set('');
    try {
      const mode = this.mode();
      const pool = mode === 'names'
        ? namePool(this.names.value)
        : numberPool(this.min.value, this.max.value);
      const key = JSON.stringify([mode, mode === 'names' ? pool.map((name) => name.toLowerCase()).sort() : [this.min.value, this.max.value]]);
      if (key !== this.sequenceKey) {
        this.previous.clear();
        this.sequenceKey = key;
      }
      const available = this.excludePrevious.value
        ? pool.filter((entry) => !this.previous.has(entry.toLowerCase()))
        : pool;
      if (available.length === 0) throw new Error('Todas as opções já saíram. Comece uma nova sequência.');

      const winners = draw(available, this.quantity.value);
      for (const winner of winners) this.previous.add(winner.toLowerCase());
      const round = { id: this.nextRound++, mode, winners };
      this.result.set(round);
      this.history.update((history) => [round, ...history].slice(0, 10));
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.error.set(error.message);
    }
  }

  resetSequence(): void {
    this.previous.clear();
    this.sequenceKey = '';
    this.nextRound = 1;
    this.result.set(null);
    this.history.set([]);
    this.error.set('');
  }

  useExample(): void {
    this.names.setValue('Ana\nBruno\nCarla\nDiego\nElisa');
    this.quantity.setValue(1);
    this.error.set('');
  }
}
