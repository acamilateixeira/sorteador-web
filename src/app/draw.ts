const maxRange = 100_000;
const maxNames = 5_000;

export function namePool(input: string): string[] {
  const names = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const name = line.trim().normalize('NFC');
    const key = name.toLowerCase();
    if (name && !names.has(key)) names.set(key, name);
    if (names.size > maxNames) throw new Error('Use até 5.000 nomes por sorteio.');
  }
  if (names.size === 0) throw new Error('Insira pelo menos um nome.');
  return [...names.values()];
}

export function numberPool(min: number | null, max: number | null): string[] {
  if (min === null || max === null || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new Error('Informe um intervalo válido de números inteiros.');
  }
  const length = max - min + 1;
  if (length > maxRange) throw new Error('Use um intervalo de até 100.000 números.');
  return Array.from({ length }, (_, index) => String(min + index));
}

function randomIndex(length: number): number {
  const buffer = new Uint32Array(1);
  const range = 2 ** 32;
  const limit = range - range % length;
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0]! >= limit);
  return buffer[0]! % length;
}

export function draw(pool: readonly string[], count: number | null): string[] {
  if (count === null || !Number.isInteger(count) || count < 1) {
    throw new Error('Informe uma quantidade inteira maior que zero.');
  }
  if (count > 200) throw new Error('Sorteie até 200 resultados por rodada.');
  if (count > pool.length) throw new Error('A quantidade é maior que o total de opções disponíveis.');

  const available = [...pool];
  for (let index = 0; index < count; index++) {
    const swap = index + randomIndex(available.length - index);
    [available[index], available[swap]] = [available[swap]!, available[index]!];
  }
  return available.slice(0, count);
}
