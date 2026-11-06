import { validateCount } from './draw';

/**
 * Sorteio auditável por compromisso e revelação.
 *
 * 1. Antes do sorteio, o app gera uma semente secreta e publica
 *    compromisso = SHA-256(semente \n SHA-256(lista) \n quantidade).
 * 2. Depois do compromisso, os participantes podem dar uma contribuição
 *    pública (uma palavra, um número). A semente do sorteio passa a ser
 *    SHA-256(semente \n contribuição), então quem organiza não consegue
 *    testar sementes até achar um resultado conveniente.
 * 3. Blocos SHA-256(semente do sorteio:contador) viram números de 32 bits,
 *    com rejeição para não ter viés de módulo, e alimentam um Fisher-Yates
 *    parcial.
 * 4. O comprovante revela a semente. Qualquer pessoa refaz as contas e
 *    confere se o compromisso e o resultado batem.
 */

export const RECEIPT_VERSION = 1;
const HEX_64 = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

export interface Receipt {
  version: typeof RECEIPT_VERSION;
  mode: 'names' | 'numbers';
  pool: string[];
  count: number;
  seed: string;
  contribution: string;
  commitment: string;
  winners: string[];
}

export interface Commitment {
  seed: string;
  listHash: string;
  commitment: string;
}

export interface Check {
  label: string;
  ok: boolean;
}

export interface Verification {
  ok: boolean;
  checks: Check[];
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('Este navegador não oferece Web Crypto.');
  return api;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await subtle().digest('SHA-256', encoder.encode(text))));
}

export function newSeed(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Impressão digital da lista, na ordem usada pelo sorteio. */
export function listHash(pool: readonly string[]): Promise<string> {
  return sha256Hex(pool.join('\n'));
}

export function commitmentFor(seed: string, hash: string, count: number): Promise<string> {
  return sha256Hex(`${seed}\n${hash}\n${count}`);
}

export async function commitTo(
  pool: readonly string[],
  count: number,
  seed = newSeed(),
): Promise<Commitment> {
  const hash = await listHash(pool);
  return { seed, listHash: hash, commitment: await commitmentFor(seed, hash, count) };
}

/** Semente usada no sorteio: mistura a semente secreta com a contribuição pública. */
export function drawSeed(seed: string, contribution: string): Promise<string> {
  const value = contribution.trim().normalize('NFC');
  return value ? sha256Hex(`${seed}\n${value}`) : Promise.resolve(seed);
}

/** Fonte determinística de inteiros uniformes a partir da semente. */
class SeededSource {
  private words: number[] = [];
  private counter = 0;
  private readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
  }

  private async refill(): Promise<void> {
    const digest = await subtle().digest('SHA-256', encoder.encode(`${this.seed}:${this.counter++}`));
    const view = new DataView(digest);
    for (let offset = 0; offset < view.byteLength; offset += 4) this.words.push(view.getUint32(offset));
  }

  async below(length: number): Promise<number> {
    const range = 2 ** 32;
    const limit = range - (range % length);
    for (;;) {
      if (this.words.length === 0) await this.refill();
      const word = this.words.shift()!;
      if (word < limit) return word % length;
    }
  }
}

export async function seededDraw(
  pool: readonly string[],
  count: number | null,
  seed: string,
): Promise<string[]> {
  validateCount(count, pool.length);
  if (!HEX_64.test(seed)) throw new Error('Semente inválida.');
  const source = new SeededSource(seed);
  const available = [...pool];
  for (let index = 0; index < count!; index++) {
    const swap = index + (await source.below(available.length - index));
    [available[index], available[swap]] = [available[swap]!, available[index]!];
  }
  return available.slice(0, count!);
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function parseReceipt(text: string): Receipt {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O comprovante não é um JSON válido.');
  }
  const r = data as Partial<Receipt> | null;
  if (
    !r ||
    r.version !== RECEIPT_VERSION ||
    (r.mode !== 'names' && r.mode !== 'numbers') ||
    !isStringArray(r.pool) ||
    !isStringArray(r.winners) ||
    !Number.isInteger(r.count) ||
    typeof r.seed !== 'string' ||
    typeof r.contribution !== 'string' ||
    typeof r.commitment !== 'string' ||
    !HEX_64.test(r.commitment)
  ) {
    throw new Error('O comprovante está incompleto ou em um formato desconhecido.');
  }
  return r as Receipt;
}

export async function verifyReceipt(receipt: Receipt): Promise<Verification> {
  const hash = await listHash(receipt.pool);
  const commitmentOk =
    (await commitmentFor(receipt.seed, hash, receipt.count)) === receipt.commitment;
  let drawOk = false;
  try {
    const seed = await drawSeed(receipt.seed, receipt.contribution);
    const again = await seededDraw(receipt.pool, receipt.count, seed);
    drawOk = again.length === receipt.winners.length && again.every((w, i) => w === receipt.winners[i]);
  } catch {
    drawOk = false;
  }
  const checks: Check[] = [
    { label: 'Semente, lista e quantidade correspondem ao compromisso publicado', ok: commitmentOk },
    { label: 'O resultado se repete quando o sorteio é refeito com a contribuição', ok: drawOk },
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

/** Link de verificação: o comprovante vai no fragmento (#), que não sai do navegador. */
export const LINK_PREFIX = '#verificar=';
export const MAX_LINK_LENGTH = 8000;

export function encodeReceipt(receipt: Receipt): string {
  const bytes = encoder.encode(JSON.stringify(receipt));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeReceipt(encoded: string): Receipt {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    return parseReceipt(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('O comprovante')) throw error;
    throw new Error('O link de verificação está corrompido.');
  }
}
