# Plano — Demo interativa da VicTy

## Objetivo
Criar uma nova experiência pública em `/demo` que permita transformar uma crença em tese, exposições, composição de ativos e simulação de investimento, sem alterar a identidade visual ou o funcionamento atual da página inicial.

## Jornada da demo
1. **Entrada da tese:** tela inicial com “What do you believe in?”, campo conversacional amplo, exemplos clicáveis e ação “Explore this thesis”.
2. **Refinamento:** uma única conversa guiada, com 1–3 perguntas de esclarecimento, respostas rápidas e campo livre; respostas determinísticas nesta fase.
3. **Interpretação:** resumo editável da tese e 3–5 exposições identificadas, com ações “Build a composition” e “Adjust thesis”.
4. **Composição:** catálogo simulado de ativos em grade e resumo sempre visível; NVDA, AMD, exposição tokenizada ao Nasdaq, SOL e USDC para o exemplo de infraestrutura de IA.
5. **Controle:** aumentar, reduzir ou editar percentuais, rejeitar e restaurar ativos sem redistribuição automática; diferença para 100% sempre explícita.
6. **Ask VicTy:** área conversacional integrada à composição, com sugestões e respostas simuladas baseadas no estado atual.
7. **Wallet demo:** alternância clara entre desconectada e conectada em Solana Devnet, sem integração blockchain real.
8. **Investimento simulado:** revisão do ativo, valor, provedor e rota; aprovação simulada e confirmação “Investment simulated”, sempre indicando que nenhuma compra ocorreu.

## Persistência escolhida
- Manter **uma única conversa**, sem lista de threads.
- Salvar o progresso no banco para permitir restauração após recarregar a página.
- Criar uma sessão anônima protegida por identificador e segredo opaco mantido no navegador; o banco armazenará apenas o hash do segredo e o estado da demo.
- Bloquear acesso direto público às tabelas; leitura e gravação ocorrerão somente por funções do servidor com validação, limites de tamanho e verificação da sessão.
- Persistir etapa atual, tese, mensagens, exposições, composição, wallet simulada e investimentos simulados.

## Arquitetura
- Separar a interface em componentes focados: entrada, conversa, interpretação, cards de ativos, resumo, Ask VicTy, wallet e fluxo de revisão.
- Criar contratos independentes para `AIProvider`, `WalletProvider`, `AssetCatalogProvider`, `PriceProvider` e `ExecutionProvider`.
- Implementar provedores mockados atrás desses contratos; a interface não importará dados simulados diretamente.
- Criar funções de servidor equivalentes a `interpret-thesis`, `generate-composition`, `ask-about-composition` e `simulate-investment`, usando os provedores mockados e sem exigir chave de IA.
- Preparar os limites de troca futura: IA real no servidor, Solana Wallet Standard no navegador, catálogo/preços reais e execução Jupiter.
- Usar os componentes de conversa do projeto/ecossistema compatíveis com a interface atual, mantendo a voz VicTy calma, precisa e sem promessas financeiras.

## Integração visual
- Reutilizar logo, tipografia, cores, tokens, botões, superfícies, espaçamento e movimentos já existentes.
- Criar um layout de produto denso e legível: conteúdo principal à esquerda e resumo fixo à direita no desktop; fluxo empilhado no celular.
- Preservar foco visível, navegação por teclado, estados de carregamento/erro, áreas anunciadas por leitores de tela e redução de movimento.
- Adicionar uma entrada discreta e clara “Try the demo” na navegação da página inicial, sem redesenhar a landing page.
- Adicionar metadados próprios para `/demo`.

## Banco e segurança
- Adicionar tabela de sessões anônimas com `GRANT` explícito apenas para `service_role`, RLS ativado e políticas públicas bloqueadas.
- Não armazenar chaves ou segredos no frontend; o token da sessão será validado no servidor antes de qualquer leitura ou atualização.
- Validar todos os payloads e manter a simulação sem operações financeiras reais.

## Validação
- Testar a jornada completa desde a tese até a confirmação simulada, incluindo retorno após recarregar a página.
- Confirmar edição manual, totais diferentes de 100%, rejeição/Undo, perguntas sobre composição, wallet mockada e revisão do investimento.
- Verificar desktop e celular, acessibilidade básica, ausência de sobreposição e saúde final da prévia.
- Executar as verificações existentes e corrigir erros introduzidos.

## Entrega
Ao final, listar arquivos criados e modificados, explicar os componentes e provedores mockados e indicar exatamente o que será substituído nas integrações futuras de IA, Solana e Jupiter.
