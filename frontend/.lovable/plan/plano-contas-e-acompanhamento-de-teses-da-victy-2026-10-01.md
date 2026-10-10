# Plano — contas e acompanhamento de teses da VicTy

## Objetivo

Estender a demo existente sem redesenhá-la: a pessoa continua criando e simulando uma tese sem cadastro; após o primeiro investimento simulado, pode salvá-la por link mágico e acompanhar sua evolução em um painel privado.

## Jornada

1. Manter intactas as etapas atuais de crença, refinamento, interpretação e composição.
2. Após “Investment simulated”, acrescentar “Your thesis is now being tracked.” e a ação “View my thesis”.
3. Para visitantes sem conta, abrir “Save your thesis” com nome e e-mail, enviar um link mágico e preservar a tese pendente durante a ida ao e-mail.
4. Ao retornar pelo link, confirmar a sessão, salvar a tese uma única vez e abrir o detalhe correspondente.
5. Criar “Access your VicTy” para usuários recorrentes, também por link mágico, com redirecionamento ao painel.
6. Exibir no acesso global da experiência o estado correto: acesso quando desconectado; painel e saída quando conectado.

## Perfil e early access

- Criar um perfil privado com nome e e-mail, vinculado à identidade autenticada.
- Quando o e-mail autenticado já existir no early access, reutilizar o nome existente somente no servidor; não expor nem duplicar o registro de contato.
- Se o nome for informado no fluxo “Save your thesis”, ele terá prioridade para o perfil da conta.
- Manter o WhatsApp apenas no cadastro de early access; ele não será copiado para o perfil nem mostrado no painel.

## Painel privado

### `/dashboard`

- Título “My theses” e apoio “Your ideas, translated into positions.”
- Cards com nome, descrição curta, valor inicialmente simulado, valor simulado atual, variação desde a criação, data, composição compacta e selo “Demo performance”.
- Suportar resultados positivos e negativos com linguagem neutra.
- Estado vazio simples com ação para iniciar uma nova tese.

### `/dashboard/thesis/:id`

- “Your thesis”: interpretação em linguagem clara.
- “How it’s represented”: reutilizar a linguagem visual dos ativos atuais, sem controles de compra.
- “How it’s moving”: valor atual, mudança desde a criação, mudança simulada do dia e gráfico de linha simples.
- “What changed?”: explicação determinística em linguagem VicTy, preparada para futuramente usar o provedor de IA.
- “Asset contribution”: lista curta de contribuições relevantes, sem métricas de trading.
- Identificar todos os números como demonstração/simulação.

## Dados e segurança

Criar estruturas privadas para:

- perfis;
- teses;
- composições;
- ativos de cada composição;
- snapshots de desempenho.

Aplicar acesso por proprietário em todas as tabelas. O identificador do usuário virá exclusivamente da sessão validada no servidor, nunca do navegador. As páginas do painel ficarão sob a área autenticada e todas as operações privadas repetirão a validação no servidor. Nenhum segredo será enviado ao navegador.

A sessão anônima atual continuará separada e protegida pelo segredo opaco. Ela será convertida em tese persistente apenas depois da autenticação, com proteção contra salvamento duplicado ao retornar pelo link.

## Desempenho simulado

- Adicionar `PerformanceProvider` e `MockPerformanceProvider` ao sistema de provedores existente.
- Gerar uma série diária determinística a partir da identidade da tese e dos ativos, com movimentos plausíveis, oscilações, ganhos e perdas.
- Persistir os snapshots no primeiro salvamento; recarregar a página nunca recalculará outro histórico.
- Calcular valor atual e contribuição dos ativos a partir dos snapshots persistidos.
- Manter a interface do painel independente do mock, permitindo trocar futuramente por preços reais sem reescrever as telas.

## Autenticação por link mágico

- Habilitar o acesso por e-mail no Lovable Cloud e preparar os e-mails de autenticação para o domínio atual.
- Criar uma página pública de acesso e uma página pública de retorno do link.
- Tratar confirmação, link expirado, reenvio e sessão já ativa.
- Após sair, limpar dados privados em memória e impedir que o botão voltar restaure o painel.

## Detalhes técnicos

- Novas leituras e gravações autenticadas usarão funções de servidor com validação de sessão e políticas de propriedade no banco.
- A área privada seguirá o gate autenticado gerenciado pelo projeto; rotas públicas da landing page e da demo continuarão públicas.
- O listener global de autenticação manterá navegação e dados sincronizados sem duplicar assinaturas por página.
- As alterações de banco incluirão permissões explícitas, RLS e índices para consultas por proprietário e data.
- Cada nova página terá título, descrição e metadados sociais próprios.

## Validação

- Validar a demo completa sem login até o investimento simulado.
- Validar primeiro acesso: nome/e-mail → link mágico → tese salva → detalhe.
- Validar usuário recorrente: e-mail → link mágico → painel.
- Validar painel com teses positivas e negativas, gráfico e explicação persistentes após recarga.
- Validar isolamento entre duas contas, inclusive tentativa direta de acessar o ID de outra tese.
- Validar saída, retorno do navegador, link expirado, reenvio, desktop e celular.
- Conferir compilação, erros em execução, políticas de segurança e fluxo completo autenticado.
