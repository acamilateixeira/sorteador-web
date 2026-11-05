import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('Sorteador', () => {
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
});
