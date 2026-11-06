import { beforeAll, describe, expect, it } from 'vitest';
import {
  commitTo,
  decodeReceipt,
  drawSeed,
  encodeReceipt,
  newSeed,
  parseReceipt,
  type Receipt,
  seededDraw,
  verifyReceipt,
} from './audit';
import { ensureWebCrypto } from './test-crypto';

const pool = ['Ana', 'Bruno', 'Carla', 'Davi', 'Eva', 'Fábio', 'Gil'];

async function auditedRound(contribution = 'girassol'): Promise<Receipt> {
  const commitment = await commitTo(pool, 3);
  const winners = await seededDraw(pool, 3, await drawSeed(commitment.seed, contribution));
  return {
    version: 1,
    mode: 'names',
    pool,
    count: 3,
    seed: commitment.seed,
    contribution,
    commitment: commitment.commitment,
    winners,
  };
}

describe('sorteio auditável', () => {
  beforeAll(ensureWebCrypto);

  it('repete o mesmo resultado para a mesma semente, sem repetir nomes', async () => {
    const seed = 'a'.repeat(64);
    const first = await seededDraw(pool, 4, seed);
    expect(await seededDraw(pool, 4, seed)).toEqual(first);
    expect(new Set(first).size).toBe(4);
    expect(await seededDraw(pool, 7, '0'.repeat(64))).not.toEqual(await seededDraw(pool, 7, '1'.repeat(64)));
  });

  it('mantém um vetor fixo, para que verificações antigas continuem válidas', async () => {
    expect(await seededDraw(pool, 3, 'a'.repeat(64))).toEqual(['Fábio', 'Gil', 'Carla']);
  });

  it('a contribuição pública muda a semente do sorteio', async () => {
    const seed = newSeed();
    expect(await drawSeed(seed, '')).toBe(seed);
    expect(await drawSeed(seed, '  girassol ')).toBe(await drawSeed(seed, 'girassol'));
    expect(await drawSeed(seed, 'girassol')).not.toBe(await drawSeed(seed, 'margarida'));
  });

  it('aprova um comprovante íntegro, também depois de passar pelo link', async () => {
    const receipt = await auditedRound();
    expect((await verifyReceipt(receipt)).ok).toBe(true);
    expect(decodeReceipt(encodeReceipt(receipt))).toEqual(receipt);
  });

  it('reprova lista, quantidade, semente, contribuição ou resultado adulterados', async () => {
    const receipt = await auditedRound();
    const results = await Promise.all([
      verifyReceipt({ ...receipt, pool: [...pool.slice(0, 6), 'Zé'] }),
      verifyReceipt({ ...receipt, count: 2, winners: receipt.winners.slice(0, 2) }),
      verifyReceipt({ ...receipt, seed: newSeed() }),
      verifyReceipt({ ...receipt, contribution: 'outra' }),
      verifyReceipt({ ...receipt, winners: [...receipt.winners].reverse() }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([false, false, false, false, false]);
    expect(results[0]!.checks[0]!.ok).toBe(false);
    expect(results[3]!.checks.map((check) => check.ok)).toEqual([true, false]);
  });

  it('explica comprovantes inválidos', () => {
    expect(() => parseReceipt('{')).toThrow('JSON válido');
    expect(() => parseReceipt('{"version": 2}')).toThrow('formato desconhecido');
    expect(() => decodeReceipt('@@@')).toThrow();
  });

  it('distribui os resultados de forma uniforme', async () => {
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 1500; i++) {
      const [winner] = await seededDraw(['a', 'b', 'c'], 1, newSeed());
      counts[winner as keyof typeof counts]++;
    }
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(400);
  });
});
