import { describe, expect, it } from 'vitest';
import { draw, namePool, numberPool } from './draw';

describe('draw rules', () => {
  it('keeps the first spelling of a name and ignores empty and duplicate entries', () => {
    expect(namePool(' Ana \nana\n\nBia\r\n')).toEqual(['Ana', 'Bia']);
  });

  it('accepts inclusive ranges and rejects invalid or oversized ranges', () => {
    expect(numberPool(-1, 1)).toEqual(['-1', '0', '1']);
    expect(() => numberPool(5, 2)).toThrow('intervalo válido');
    expect(() => numberPool(1, 100_001)).toThrow('100.000');
  });

  it('draws unique results without mutating the original pool', () => {
    const pool = ['A', 'B', 'C'];
    expect(new Set(draw(pool, 3))).toEqual(new Set(pool));
    expect(pool).toEqual(['A', 'B', 'C']);
  });

  it('rejects impossible draws', () => {
    expect(() => draw(['A'], 2)).toThrow('maior que o total');
    expect(() => draw(['A'], 0)).toThrow('maior que zero');
  });
});
