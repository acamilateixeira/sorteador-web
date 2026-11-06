# Sorteador

[Português](README.md) · **English** · [Open Sorteador](https://acamilateixeira.github.io/sorteador-web/)

[![Tests and deploy](https://github.com/acamilateixeira/sorteador-web/actions/workflows/pages.yml/badge.svg)](https://github.com/acamilateixeira/sorteador-web/actions/workflows/pages.yml)

A browser-based name and number picker for events and activities. The Angular version has its own visual identity, keyboard-friendly fields, and a session history.

## How to use it

1. Pick **Nomes** (Names) and paste one name per line, or pick **Números** (Numbers) and enter a range.
2. Set the number of results. Each round returns distinct results.
3. Use the exclusion checkbox to avoid drawing past results from the same pool. **Nova sequência** resets the result and session history.
4. Review previous rounds in the result panel. Lists and results stay in page memory during the session.

## Auditable draw

Turn on **Sorteio auditável** (auditable draw) when participants need to trust the result without trusting the organizer.

1. **Commitment.** The app generates a secret 256-bit seed and shows `SHA-256(seed, list fingerprint, count)`. The organizer shares this code before drawing. From that point, the list and the count are bound to it.
2. **Public contribution (optional).** After the commitment, the audience provides a word or a number. The draw seed becomes `SHA-256(seed, contribution)`, so the organizer cannot try commitments until one gives a convenient result.
3. **Reveal.** The draw is deterministic. `SHA-256(seed:counter)` blocks become 32-bit integers, with rejection sampling to avoid modulo bias, and feed a partial Fisher-Yates shuffle. The result comes with a JSON receipt that reveals the seed.
4. **Verification.** Anyone can paste the receipt or open the verification link. The app recomputes everything in the browser and checks that the commitment and the result match. The link keeps the receipt in the URL fragment (`#`), which the browser never sends to the server.

| Tampering | What verification reports |
| --- | --- |
| List, count, or seed changed | The commitment does not match |
| Contribution or result changed | Re-running the draw gives a different result |

## Architecture

| Choice | Rationale |
| --- | --- |
| **Angular 22, TypeScript, and Reactive Forms** | Configuration, feedback, and results have separate roles in the UI. Inputs use reactive forms, while the current round and history use signals. |
| **Auditable engine in `audit.ts`** | Commitment, contribution, deterministic draw, and verification use only Web Crypto. Tests cover a fixed vector, uniformity, and every kind of tampering. |
| **Separate draw engine** | `src/app/draw.ts` owns input and sampling rules. It uses Web Crypto and rejects values that would introduce modulo bias before sampling without replacement. |
| **Static build** | All drawing happens in the browser. The site can be published as static assets while keeping names on the user's device. |

## Run locally

Use Node.js 22.22.3 or newer in the 22.x release line. [Angular compatibility](https://angular.dev/reference/versions)

```bash
npm ci
npm start
```

Open `http://localhost:4200`. Verify the engine and UI workflow with:

```bash
npm test -- --watch=false
npm run build
```
