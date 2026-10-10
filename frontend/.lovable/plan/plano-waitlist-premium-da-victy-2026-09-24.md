# Plano — Waitlist premium da VicTy

## Objetivo
Criar em `/` uma landing page de lista de espera em inglês, imersiva e responsiva, que conta visualmente a transformação **belief → intelligence → structure → decision** e termina na conversão por e-mail.

## Experiência e direção visual
- Aplicar fielmente a identidade enviada: VicTy Night, Indigo, Electric Violet, Signal Teal e VicTy Light; Manrope para linguagem e JetBrains Mono para dados.
- Preparar versões utilizáveis do logo a partir da referência anexada, preservando desenho, proporções e contraste nos fundos escuros.
- Construir uma narrativa contínua, sem aparência de dashboard ou landing SaaS genérica: fundos atmosféricos, vidro discreto, bordas translúcidas, grandes respiros e auroras muito suaves.
- Criar o sistema visual “Thesis Paths” com SVGs animados, nós e ramificações que evoluem de frase abstrata para setores, percentuais e instrumentos.
- Usar animações lentas por entrada na tela, transições de números, desenho de caminhos e microinterações nos botões; desativar ou simplificar tudo com `prefers-reduced-motion`.

## Estrutura da página
1. **Navegação flutuante:** logo, âncoras para How it works, Why VicTy e About, CTA para a lista de espera e menu móvel acessível.
2. **The Belief:** headline principal, duas ações, mensagem non-custodial e um campo de crença vivo com ramificações ainda incompletas.
3. **From belief to structure:** transformação cinematográfica da crença em Semiconductors, Data centers, Energy infrastructure e possíveis instrumentos.
4. **Product idea:** composição 40/35/25 com percentuais animados e explicações “What it represents”, “Why it’s here” e “Known risks”.
5. **Control moment:** composição ajustável com percentuais, remoção/restauração de itens e explicação de inclusão; reforço “Nothing happens without you.”
6. **How it works:** jornada horizontal 01–04 conectada por caminhos no desktop e vertical no celular.
7. **Why VicTy:** três princípios tipográficos amplos, sem cards convencionais.
8. **Women-built identity:** seção sóbria, sem estereótipos, com referência muito discreta ao dinossauro quando couber.
9. **Waitlist:** painel de conversão com e-mail, validação clara, estado de envio, erro e confirmação animada na própria página.
10. **Footer:** logo, posicionamento, links solicitados, linha institucional e aviso de que a VicTy não oferece aconselhamento financeiro.

## Formulário e interações
- Validar o e-mail no navegador com limites e mensagens acessíveis; impedir envios inválidos e duplicados durante carregamento.
- Nesta etapa, simular a confirmação local sem redirecionar nem armazenar endereços, deixando a estrutura isolada para futura conexão ao Lovable Cloud.
- Adicionar navegação por âncoras, rolagem suave, foco visível, mensagens anunciadas por leitores de tela e controles utilizáveis por teclado.
- Os destinos de Privacy, Terms, X e LinkedIn ficarão sem URLs inventadas até os endereços oficiais serem fornecidos.

## Implementação técnica
- Organizar a página em componentes React reutilizáveis para navegação, seções narrativas, caminhos, composição, controles e formulário.
- Centralizar cores, tipografia, brilho, bordas e superfícies em tokens semânticos globais; carregar as fontes pela página raiz.
- Usar CSS, SVG e Intersection Observer para manter as animações leves e evitar canvas/WebGL.
- Inserir metadados próprios da página (title, description, Open Graph e Twitter) e remover os metadados genéricos atuais.

## Validação
- Conferir a experiência real em desktop e mobile, incluindo 320 px, menu, âncoras, ajustes da composição e todos os estados do formulário.
- Verificar contraste, foco, redução de movimento, ausência de sobreposição, estabilidade das animações e saúde final da prévia.
