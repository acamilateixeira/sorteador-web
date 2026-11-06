/**
 * O jsdom não implementa crypto.subtle. Nos testes, usa o Web Crypto do Node,
 * que é o mesmo padrão disponível no navegador.
 */
export async function ensureWebCrypto(): Promise<void> {
  if (globalThis.crypto?.subtle) return;
  const specifier = `node:${'crypto'}`;
  const { webcrypto } = (await import(/* @vite-ignore */ specifier)) as { webcrypto: Crypto };
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
