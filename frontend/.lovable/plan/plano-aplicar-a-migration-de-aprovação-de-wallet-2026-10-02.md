# Plano — Aplicar a migration de aprovação de wallet

## Pré-requisito
A migration `drizzle/migrations/0005_demo_wallet_approval_challenges.sql` ainda não está presente no repositório disponível. Anexe o arquivo SQL na próxima mensagem para que o conteúdo exato possa ser usado.

## Aplicação
1. Conferir o arquivo enviado e confirmar que ele corresponde à migration `0005_demo_wallet_approval_challenges.sql`.
2. Aplicar seu conteúdo integral, sem reescrever ou reformatar, usando o mecanismo seguro de migrations do Lovable Cloud.
3. Não alterar credenciais, connection strings ou outras tabelas fora das instruções contidas na própria migration.
4. Preservar exatamente os `GRANT`s, RLS, vínculo com `demo_sessions`, restrição de rede, expiração, nonce, consumo único e função definidos no SQL.

## Verificação
- Confirmar no banco remoto a existência de `public.demo_wallet_approval_challenges` e `public.consume_demo_wallet_approval(...)`.
- Confirmar que a migration foi registrada como aplicada.
- Verificar se os tipos e artefatos gerados foram atualizados automaticamente; se a atualização automática falhar, regenerá-los pelo fluxo seguro do projeto.
- Reportar o resultado final sem revelar credenciais ou URLs de conexão.
