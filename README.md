# Sorteador

**Português** · [English](README.en.md) · [Abrir Sorteador](https://acamilateixeira.github.io/sorteador-web/)

[![Testes e deploy](https://github.com/acamilateixeira/sorteador-web/actions/workflows/pages.yml/badge.svg)](https://github.com/acamilateixeira/sorteador-web/actions/workflows/pages.yml)

Sorteie nomes ou números pelo navegador para atividades, eventos e dinâmicas. A versão Angular tem identidade visual própria, campos acessíveis por teclado e histórico de rodadas na sessão.

## Como usar

1. Escolha **Nomes** e cole um nome por linha ou selecione **Números** e informe um intervalo.
2. Escolha a quantidade por rodada. Cada rodada contém resultados distintos.
3. Use **Excluir resultados anteriores deste conjunto** para continuar sorteando do mesmo conjunto sem repetir. **Nova sequência** limpa o resultado e o histórico.
4. Consulte as rodadas anteriores no painel de resultado. Listas e resultados ficam na memória da página durante a sessão.

## Sorteio auditável

Marque **Sorteio auditável** quando os participantes precisarem confiar no resultado sem confiar em quem organiza.

1. **Compromisso.** O app gera uma semente secreta de 256 bits e mostra `SHA-256(semente, impressão da lista, quantidade)`. O organizador divulga esse código antes de sortear. A partir daí, a lista e a quantidade ficam presas a ele.
2. **Contribuição pública (opcional).** Depois do compromisso, o público dá uma palavra ou um número. A semente do sorteio vira `SHA-256(semente, contribuição)`. Assim, quem organiza não consegue gerar vários compromissos até achar um resultado conveniente.
3. **Revelação.** O sorteio é determinístico: blocos `SHA-256(semente:contador)` viram inteiros de 32 bits, com rejeição para evitar viés de módulo, e alimentam um Fisher-Yates parcial. O resultado sai com um comprovante JSON que revela a semente.
4. **Verificação.** Qualquer pessoa cola o comprovante ou abre o link de verificação. O app refaz o cálculo no navegador e confere se o compromisso e o resultado batem. O link guarda o comprovante no fragmento (`#`), que o navegador não envia ao servidor.

| Adulteração | O que a verificação acusa |
| --- | --- |
| Lista, quantidade ou semente trocadas | O compromisso não confere |
| Contribuição ou resultado alterados | O sorteio refeito dá outro resultado |

## Arquitetura

| Escolha | Motivo |
| --- | --- |
| **Angular 22, TypeScript e Reactive Forms** | A interface separa configuração, feedback e resultado. Os campos usam formulários reativos e a rodada atual e o histórico usam signals. |
| **Motor auditável em `audit.ts`** | Compromisso, contribuição, sorteio determinístico e verificação usam só Web Crypto. Os testes cobrem um vetor fixo, a uniformidade e cada tipo de adulteração. |
| **Motor de sorteio separado** | As regras de entrada e amostragem ficam em `src/app/draw.ts`. O algoritmo usa Web Crypto e descarta valores que causariam viés de módulo antes de amostrar sem reposição. |
| **Build estático** | O navegador faz todo o sorteio. A página pode ser publicada como arquivos estáticos, com os nomes mantidos no dispositivo. |

## Rodar localmente

Use Node.js 22.22.3 ou superior na série 22. [Compatibilidade do Angular](https://angular.dev/reference/versions)

```bash
npm ci
npm start
```

Abra `http://localhost:4200`. Verifique o motor e o fluxo da interface com:

```bash
npm test -- --watch=false
npm run build
```
