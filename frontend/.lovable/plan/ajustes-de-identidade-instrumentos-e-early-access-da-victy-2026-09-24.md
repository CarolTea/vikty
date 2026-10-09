# Ajustes de identidade, instrumentos e early access da VicTy

## Resultado
- Substituir a marca desenhada atualmente pela logo oficial enviada, preservando cores, proporções e fundo original.
- Aplicar o favicon oficial enviado em todos os navegadores.
- Trocar os instrumentos genéricos da narrativa por ativos reais e coerentes com cada exposição.
- Transformar o formulário de early access em um cadastro real de nome, WhatsApp e e-mail.

## Alterações na página

### Logo e favicon
- Preparar uma versão recortada da logo horizontal enviada, removendo apenas o excesso de margem do arquivo, sem redesenhar a marca.
- Hospedar essa imagem como ativo do projeto e usá-la no menu e no rodapé com dimensões responsivas.
- Redimensionar o favicon quadrado enviado para um arquivo leve de 64×64 px, mantendo a proporção e sem esticar.
- Atualizar o ícone do navegador e remover o favicon padrão anterior.

### Instrumentos reais
Atualizar “Possible instruments” para exemplos reais relacionados às três exposições:
- **Semiconductors:** NVIDIA — `NVDA`
- **Data centers:** Equinix — `EQIX`
- **Energy infrastructure:** NextEra Energy — `NEE`

Os nomes e tickers aparecerão juntos para que o usuário entenda o ativo, mantendo a indicação de que a composição é ilustrativa e não constitui recomendação financeira.

### Formulário de early access
- Ativar o Lovable Cloud para armazenar os cadastros em banco de dados real.
- Criar uma tabela de inscrições com: nome, WhatsApp, e-mail e data de cadastro.
- Manter os registros privados: visitantes poderão enviar o formulário, mas não listar, alterar ou apagar inscrições.
- Adicionar os três campos obrigatórios com mensagens de erro claras.
- Aceitar WhatsApp em formato internacional, normalizar espaços e símbolos e validar o número antes do envio.
- Validar nome, WhatsApp e e-mail tanto na página quanto no servidor.
- Impedir cadastros duplicados por e-mail ou WhatsApp e mostrar uma resposta amigável quando a pessoa já estiver inscrita.
- Substituir a confirmação simulada pelo envio real; a tela de sucesso só aparecerá após o banco confirmar o cadastro.
- Manter estados de envio, erro e sucesso sem recarregar a página.

## Segurança e qualidade
- Criar permissões mínimas no banco e não expor os cadastros publicamente.
- Não registrar dados pessoais no console.
- Adicionar um campo invisível contra envios automatizados básicos, sem atrapalhar usuários reais.
- Verificar o fluxo completo no desktop e no celular: validação, cadastro real, duplicidade, confirmação e persistência.
- Confirmar que logo e favicon aparecem nítidos e que a página continua sem erros.

## Premissas
- O conteúdo da página continuará em inglês.
- Nome, WhatsApp e e-mail serão obrigatórios.
- Os ativos são exemplos ilustrativos, não uma carteira ou recomendação.
