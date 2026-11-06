import { TestBed } from '@angular/core/testing';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { encodeReceipt, LINK_PREFIX } from './audit';
import { ensureWebCrypto } from './test-crypto';

describe('Sorteador', () => {
  beforeAll(ensureWebCrypto);

  it('draws two consecutive rounds without repeats, then resets the sequence', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.names.setValue('Ana\nBia');
    app.drawRound();
    app.drawRound();
    expect(new Set(app.history().flatMap((round) => round.winners))).toEqual(new Set(['Ana', 'Bia']));

    app.drawRound();
    expect(app.error()).toContain('Todas as opções já saíram');
    app.resetSequence();
    expect(app.history()).toEqual([]);
    expect(app.result()).toBeNull();
  });

  it('explains how many options are left when the round asks for more', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.names.setValue('Ana\nBia\nCaio');
    app.quantity.setValue(2);
    app.drawRound();
    app.drawRound();

    expect(app.error()).toBe('Resta 1 opção nesta sequência. Diminua a quantidade ou comece uma nova sequência.');
    expect(app.history()).toHaveLength(1);
  });

  it('submits the form and draws without a native page navigation', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.names.setValue('Ana');
    await fixture.whenStable();

    const page: HTMLElement = fixture.nativeElement;
    const submission = new Event('submit', { bubbles: true, cancelable: true });
    page.querySelector('form')?.dispatchEvent(submission);
    await fixture.whenStable();

    expect(submission.defaultPrevented).toBe(true);
    expect(page.querySelector('.winners li')?.textContent).toBe('Ana');
  });

  it('renders the number range and announces a successful round', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.selectMode('numbers');
    fixture.componentInstance.min.setValue(9);
    fixture.componentInstance.max.setValue(9);
    fixture.componentInstance.drawRound();
    await fixture.whenStable();

    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('#min')).not.toBeNull();
    expect(page.querySelector('[aria-live="polite"] .winners li')?.textContent).toBe('9');
  });

  it('publica o compromisso antes de sortear e gera um comprovante verificável', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.names.setValue('Ana\nBia\nCaio\nDani');
    app.quantity.setValue(2);
    app.audited.setValue(true);

    app.drawRound();
    await vi.waitFor(() => expect(app.pending()).not.toBeNull());
    const pending = app.pending();
    expect(pending?.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(app.result()).toBeNull();

    app.contribution.setValue('girassol');
    await app.revealAudited();
    const receipt = app.result()?.receipt;
    expect(receipt?.commitment).toBe(pending?.commitment);
    expect(receipt?.contribution).toBe('girassol');
    expect(receipt?.winners).toHaveLength(2);

    app.receiptInput.setValue(app.receiptJson(receipt!));
    await app.verifyPasted();
    expect(app.verification()?.ok).toBe(true);
  });

  it('invalida o compromisso se a lista mudar antes da revelação', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.names.setValue('Ana\nBia\nCaio');
    app.audited.setValue(true);
    await app.prepareCommitment();
    app.names.setValue('Ana\nBia\nCaio\nDani');

    await app.revealAudited();
    expect(app.error()).toContain('mudou depois do compromisso');
    expect(app.pending()).toBeNull();
    expect(app.result()).toBeNull();
  });

  it('verifica um comprovante aberto por link e mostra o veredito', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.names.setValue('Ana\nBia\nCaio');
    app.audited.setValue(true);
    await app.prepareCommitment();
    await app.revealAudited();
    const receipt = app.result()!.receipt!;

    const other = TestBed.createComponent(App);
    await other.componentInstance.verifyFromLink(encodeReceipt(receipt));
    expect(other.componentInstance.verification()?.ok).toBe(true);

    // Trocar a semente sempre quebra o compromisso; trocar só a contribuição
    // pode, por acaso, repetir o vencedor numa lista de 3 nomes.
    await other.componentInstance.verifyFromLink(encodeReceipt({ ...receipt, seed: 'f'.repeat(64) }));
    other.detectChanges();
    expect(other.componentInstance.verification()?.ok).toBe(false);
    expect(LINK_PREFIX).toBe('#verificar=');
    expect((other.nativeElement as HTMLElement).querySelector('[data-test="verdict"]')).not.toBeNull();
  });
});
