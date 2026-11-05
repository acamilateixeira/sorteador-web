# Sorteador

[Português](README.md) · **English** · [Open Sorteador](https://acamilateixeira.github.io/sorteador-web/)

A browser-based name and number picker for events and activities. The Angular version has its own visual identity, keyboard-friendly fields, and a session history.

## How to use it

1. Pick **Nomes** (Names) and paste one name per line, or pick **Números** (Numbers) and enter a range.
2. Set the number of results. Each round returns distinct results.
3. Use the exclusion checkbox to avoid drawing past results from the same pool. **Nova sequência** resets the result and session history.
4. Review previous rounds in the result panel. Lists and results stay in page memory during the session.

## Architecture

| Choice | Rationale |
| --- | --- |
| **Angular 22, TypeScript, and Reactive Forms** | Configuration, feedback, and results have separate roles in the UI. Inputs use reactive forms, while the current round and history use signals. |
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
