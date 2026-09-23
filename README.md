# VicTy

> **Invest in a thesis, not a ticker.**
>
> A VicTy transforma aquilo em que você acredita em um investimento que você entende.

A VicTy parte de uma pergunta — **"No que você acredita?"** — e transforma uma convicção econômica ou
tecnológica numa composição de ativos em Solana que a pessoa entende antes de investir. Cada ativo
vem com o porquê de estar ali, o que ele representa de fato e qual o seu papel na tese. A compra e a
venda acontecem ativo por ativo, sempre autorizadas pela própria wallet do usuário.

🚧 **Em construção** — MVP desenvolvido para hackathon.

## Como funciona

1. **Convicção** — o usuário descreve no que acredita ou escolhe uma tese sugerida.
2. **Interpretação** — a VicTy traduz a ideia em exposições econômicas e mostra como entendeu.
3. **Composição** — uma proposta de ativos, montada só com instrumentos aprovados, com o papel e o
   peso de cada um. O usuário pode rejeitar ativos e ajustar pesos.
4. **Execução individual** — cada compra ou venda é revisada (preço, taxas, slippage, validade) e
   assinada na wallet do usuário, uma operação por vez.
5. **Acompanhamento** — posição real por tese: plano versus executado, baseado no que de fato
   aconteceu on-chain.

## Princípios

- **Não custodiante.** A VicTy nunca tem acesso às chaves nem ao capital do usuário. Toda transação
  é assinada na wallet de quem investe.
- **Você decide cada operação.** Sem execução automática da composição, rebalanceamento, DCA ou
  ordens agendadas.
- **Só instrumentos aprovados.** A IA interpreta a convicção, mas não escolhe tokens livremente: a
  composição é feita a partir de uma lista curada de instrumentos verificados.
- **Números honestos.** Sem dado, sem número. Quando um preço falta ou uma informação é limitada, a
  interface mostra isso em vez de estimar.
- **Sem promessa de retorno.**

## O que a VicTy não é

- Não é uma interface de swap nem uma lista de tokens — a unidade é a convicção, não o ativo.
- Não é um robo-advisor automático.
- Não é custodiante.

## Stack e integrações

| Camada | Tecnologia |
|---|---|
| Blockchain | Solana (mainnet) |
| Execução | Jupiter Swap API v2 (`/order` + `/execute`) |
| Preços e metadados | Jupiter Price API v3 · Jupiter Tokens API v2 |
| Wallet | Wallets Solana padrão |
| Frontend | _a definir_ |
| Backend | _a definir_ (rascunho em Node.js + TypeScript) |
| Banco de dados | PostgreSQL (proposta) |

## Estrutura do repositório

```
.
├── backend/            # API: interpretação, composição, cotações e registro de operações
│   ├── Dockerfile
│   └── .env.example
├── frontend/           # Aplicação web
│   └── .env.example
├── docker-compose.yml  # Ambiente local (backend + PostgreSQL)
└── Docs/               # Documentação do produto
```

## Rodando localmente

> O código da aplicação ainda está sendo escrito; os passos abaixo valem assim que o backend e o
> frontend tiverem sua primeira versão.

Pré-requisitos: [Docker](https://www.docker.com/) e uma chave da [Jupiter API](https://developers.jup.ag/).

```bash
cp backend/.env.example backend/.env    # preencha JUPITER_API_KEY, SOLANA_RPC_URL etc.
cp frontend/.env.example frontend/.env

docker compose up --build               # sobe backend (porta 3001) e PostgreSQL
```

## Aviso

A VicTy opera em Solana mainnet com dinheiro real. Nada aqui é recomendação de investimento.
