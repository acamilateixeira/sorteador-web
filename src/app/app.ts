import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  type Commitment,
  type Receipt,
  type Verification,
  commitTo,
  decodeReceipt,
  drawSeed,
  encodeReceipt,
  LINK_PREFIX,
  listHash,
  MAX_LINK_LENGTH,
  parseReceipt,
  RECEIPT_VERSION,
  seededDraw,
  verifyReceipt,
} from './audit';
import { draw, namePool, numberPool, validateCount } from './draw';

type Mode = 'names' | 'numbers';
type Round = { id: number; mode: Mode; winners: string[]; receipt?: Receipt };
type Pending = Commitment & { mode: Mode; count: number };

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  readonly mode = signal<Mode>('names');
  readonly names = new FormControl('', { nonNullable: true });
  readonly min = new FormControl<number | null>(1);
  readonly max = new FormControl<number | null>(100);
  readonly quantity = new FormControl<number | null>(1);
  readonly excludePrevious = new FormControl(true, { nonNullable: true });
  readonly audited = new FormControl(false, { nonNullable: true });
  readonly configuration = new FormGroup({
    names: this.names,
    min: this.min,
    max: this.max,
    quantity: this.quantity,
    excludePrevious: this.excludePrevious,
    audited: this.audited,
  });
  readonly receiptInput = new FormControl('', { nonNullable: true });
  readonly contribution = new FormControl('', { nonNullable: true });

  readonly result = signal<Round | null>(null);
  readonly history = signal<Round[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly pending = signal<Pending | null>(null);
  readonly verification = signal<Verification | null>(null);
  readonly verifyError = signal('');
  readonly copied = signal('');

  private previous = new Set<string>();
  private sequenceKey = '';
  private nextRound = 1;

  ngOnInit(): void {
    const hash = globalThis.location?.hash ?? '';
    if (hash.startsWith(LINK_PREFIX)) void this.verifyFromLink(hash.slice(LINK_PREFIX.length));
  }

  selectMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
    this.pending.set(null);
  }

  /** Lista disponível para a próxima rodada, já sem os resultados anteriores. */
  private available(): { mode: Mode; pool: string[] } {
    const mode = this.mode();
    const pool =
      mode === 'names' ? namePool(this.names.value) : numberPool(this.min.value, this.max.value);
    const key = JSON.stringify([
      mode,
      mode === 'names'
        ? pool.map((name) => name.toLowerCase()).sort()
        : [this.min.value, this.max.value],
    ]);
    if (key !== this.sequenceKey) {
      this.previous.clear();
      this.sequenceKey = key;
    }
    const available = this.excludePrevious.value
      ? pool.filter((entry) => !this.previous.has(entry.toLowerCase()))
      : pool;
    if (available.length === 0) {
      throw new Error('Todas as opções já saíram. Comece uma nova sequência.');
    }
    const quantity = this.quantity.value;
    if (
      this.excludePrevious.value &&
      quantity !== null &&
      quantity > available.length &&
      available.length < pool.length
    ) {
      const left = available.length === 1 ? 'Resta 1 opção' : `Restam ${available.length} opções`;
      throw new Error(`${left} nesta sequência. Diminua a quantidade ou comece uma nova sequência.`);
    }
    return { mode, pool: available };
  }

  private record(mode: Mode, winners: string[], receipt?: Receipt): void {
    for (const winner of winners) this.previous.add(winner.toLowerCase());
    const round: Round = { id: this.nextRound++, mode, winners, receipt };
    this.result.set(round);
    this.history.update((history) => [round, ...history].slice(0, 10));
  }

  drawRound(): void {
    this.error.set('');
    if (this.audited.value) {
      void (this.pending() ? this.revealAudited() : this.prepareCommitment());
      return;
    }
    try {
      const { mode, pool } = this.available();
      this.record(mode, draw(pool, this.quantity.value));
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.error.set(error.message);
    }
  }

  /** Passo 1: gera a semente e publica o compromisso, sem sortear ainda. */
  async prepareCommitment(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      const { mode, pool } = this.available();
      const count = this.quantity.value;
      validateCount(count, pool.length);
      this.contribution.setValue('');
      this.pending.set({ ...(await commitTo(pool, count)), mode, count });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.error.set(error.message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Passo 2: sorteia com a semente comprometida e revela o comprovante. */
  async revealAudited(): Promise<void> {
    const pending = this.pending();
    if (!pending) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const { pool } = this.available();
      if (
        (await listHash(pool)) !== pending.listHash ||
        this.quantity.value !== pending.count ||
        this.mode() !== pending.mode
      ) {
        this.pending.set(null);
        throw new Error('A lista ou a quantidade mudou depois do compromisso. Gere um novo compromisso.');
      }
      const contribution = this.contribution.value.trim();
      const winners = await seededDraw(pool, pending.count, await drawSeed(pending.seed, contribution));
      const receipt: Receipt = {
        version: RECEIPT_VERSION,
        mode: pending.mode,
        pool,
        count: pending.count,
        seed: pending.seed,
        contribution,
        commitment: pending.commitment,
        winners,
      };
      this.pending.set(null);
      this.record(pending.mode, winners, receipt);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.error.set(error.message);
    } finally {
      this.busy.set(false);
    }
  }

  cancelCommitment(): void {
    this.pending.set(null);
  }

  resetSequence(): void {
    this.previous.clear();
    this.sequenceKey = '';
    this.nextRound = 1;
    this.result.set(null);
    this.history.set([]);
    this.error.set('');
    this.pending.set(null);
  }

  useExample(): void {
    this.names.setValue('Ana\nBruno\nCarla\nDiego\nElisa');
    this.quantity.setValue(1);
    this.error.set('');
  }

  receiptJson(receipt: Receipt): string {
    return JSON.stringify(receipt, null, 2);
  }

  verificationLink(receipt: Receipt): string | null {
    const base = `${globalThis.location?.origin ?? ''}${globalThis.location?.pathname ?? ''}`;
    const link = `${base}${LINK_PREFIX}${encodeReceipt(receipt)}`;
    return link.length <= MAX_LINK_LENGTH ? link : null;
  }

  async copy(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(label);
    } catch {
      this.copied.set('');
    }
  }

  downloadReceipt(receipt: Receipt): void {
    const blob = new Blob([this.receiptJson(receipt)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `comprovante-sorteio-${receipt.commitment.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async verifyPasted(): Promise<void> {
    this.verifyError.set('');
    this.verification.set(null);
    try {
      this.verification.set(await verifyReceipt(parseReceipt(this.receiptInput.value)));
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.verifyError.set(error.message);
    }
  }

  async verifyFromLink(encoded: string): Promise<void> {
    this.verifyError.set('');
    try {
      const receipt = decodeReceipt(encoded);
      this.receiptInput.setValue(this.receiptJson(receipt));
      this.verification.set(await verifyReceipt(receipt));
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      this.verifyError.set(error.message);
    }
  }
}
