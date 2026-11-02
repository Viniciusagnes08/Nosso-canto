# Entre Nós — Como usar a primeira versão

Este projeto é um **protótipo funcional local**, pensado para testar a experiência antes de publicar para as duas pessoas.

## Abrir no seu computador

1. Descompacte o arquivo `entre-nos-app.zip`.
2. Abra o terminal na pasta `entre-nos-app`.
3. Execute `python -m http.server 8080` (o Python 3 precisa estar instalado).
4. Visite `http://localhost:8080` no Chrome, Edge ou outro navegador moderno.
5. Em **Meu cantinho**, configure os nomes e a data do início do relacionamento.

## O que já funciona

- Registrar humor, pensamentos, refeições e fotos.
- Guardar mensagens, compromissos e músicas com links externos.
- Visualizar calendário com marcações de dias registrados.
- Criar desafios e anexar fotos como comprovação.
- Montar álbum de memórias, inclusive com fotos antigas selecionadas manualmente.
- Exportar e importar backups com as fotografias incluídas.
- Testar o layout no celular ou instalar como PWA por HTTPS.

## O que ainda NÃO funciona

- Duas contas sincronizadas pela internet.
- Integração automática com Google Fotos, Google Agenda ou Spotify.
- Notificações automáticas, fotos importadas sem autorização e leitura da rotina da outra pessoa.

**Importante:** qualquer foto ou registro pessoal só deve ser compartilhado com o consentimento de quem o criou. A futura sincronização exigirá dois logins independentes e regras de privacidade testadas.

## Próximo passo técnico

Criar um projeto Supabase pessoal e isolado, configurar Auth com duas contas, publicar a interface em um link HTTPS e implementar o compartilhamento de registros. O arquivo `supabase/schema.sql` é uma proposta de banco com RLS, ainda não aplicada nem validada em produção.

As integrações externas virão depois da autorização individual de cada um.
