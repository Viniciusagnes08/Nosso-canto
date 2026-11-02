# Ativação: login e conexões

## Dependências externas — ainda pendentes

Nenhum Supabase do Nosso Canto foi encontrado na conexão atual. A Vercel `nossocanto` não tinha variáveis de ambiente. O usuário informou que ainda não criou os aplicativos OAuth no Google Cloud e Spotify.

A criação do Supabase depende da escolha de organização e da confirmação de eventual custo. Não usar os projetos da ST1. A configuração dos provedores exige acesso aos painéis e, quando solicitado por eles, a participação do titular para termos, login ou consentimento.

## 1. Supabase Auth

Criar um projeto pessoal separado. Esta entrega só necessita de Auth, sem aplicar o schema de casal ainda proposto.

- Habilitar Email Auth e confirmação de e-mail.
- Configurar Site URL: `https://nossocanto-nine.vercel.app`.
- Cadastrar redirects exatos para `/` e `/?recovery=1` no domínio de produção e no domínio de preview escolhido. Não liberar todas as branches com wildcard amplo.
- Configurar SMTP transacional para uso real, limites de envio e política de senha mínima de 12 caracteres.
- Para entrada Google, cadastrar o provedor Google no Supabase e autorizar no Google Cloud o callback `https://<project-ref>.supabase.co/auth/v1/callback`. O Client Secret é inserido apenas no painel do Supabase.

Variáveis da Vercel:

| Nome | Valor / efeito |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto pessoal |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública/publishable, nunca service_role |
| `GOOGLE_LOGIN_ENABLED` | `true` apenas após habilitar e testar o provedor no Supabase |
| `GOOGLE_CLIENT_ID` | Client ID web público para as integrações do Google |
| `SPOTIFY_CLIENT_ID` | Client ID público do Spotify |

As variáveis acima são públicas e entram no bundle, exceto que a função também lê as duas primeiras para validar sessões. Salvar configuração exige novo build. Usar Preview para testes antes de Production.

## 2. Google Cloud — Fotos e Agenda

Criar um projeto dedicado e um cliente OAuth Web. Ativar Google Photos Picker API e Google Calendar API. Configurar Google Auth Platform: nome do aplicativo, contato, audiência e usuários de teste. Informar a política de privacidade e os dados exigidos pelo console antes de publicação externa.

Origens JavaScript autorizadas: o domínio exato de produção e o preview estável escolhido. Para teste local, usar uma origem local explicitamente cadastrada.

Escopos solicitados incrementalmente:

- Fotos: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
- Agenda: `https://www.googleapis.com/auth/calendar.events.readonly` e `https://www.googleapis.com/auth/calendar.calendarlist.readonly`.

O usuário seleciona até 20 fotos. A função autenticada confirma a sessão do Picker, encontra o item selecionado e baixa uma versão até 1600 px. Não aceita uma URL de download enviada pelo cliente. Vídeos não são importados.

Agenda lista calendários e eventos dos próximos 30 dias, até 500. Só grava os itens marcados; a opção “Horário ocupado” não guarda título nem descrição do evento. Não escreve no Google e não realiza sincronização contínua.

Tokens Google ficam em memória e precisam de nova autorização após expiração/recarregamento. A desconexão revoga a concessão Google desse aplicativo e limpa as duas conexões locais.

Referências:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/photos/picker/guides/get-started-picker
- https://developers.google.com/photos/picker/guides/media-items
- https://developers.google.com/workspace/calendar/api/v3/reference/events/list

## 3. Spotify for Developers

Criar aplicativo Web API e cadastrar exatamente:

`https://nossocanto-nine.vercel.app/spotify-callback.html`

Cadastrar também o callback do preview que será usado nos testes. Conferir no dashboard os requisitos atuais do modo de desenvolvimento, incluindo contas autorizadas e elegibilidade da conta proprietária.

O aplicativo usa Authorization Code com PKCE, state aleatório, verificador de uso único, validade de dez minutos e vinculação ao usuário autenticado. Não usa Client Secret nem guarda refresh token. O access token fica no sessionStorage da aba, vinculado ao usuário, até expirar ou sair.

Escopos: `user-library-read user-read-recently-played`.

Favoritas e recentes retornam até 50 músicas por consulta. A pessoa seleciona quais links guardar. Não há reprodução de áudio pelo aplicativo, alteração de playlists ou monitoramento contínuo.

Desconectar remove a sessão local. A revogação definitiva é feita pelo titular em https://www.spotify.com/account/apps/.

Referência: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

## 4. Testes antes de ativar o site

1. Criar conta, confirmar e-mail, entrar por senha e por link, sair e recuperar senha.
2. Se habilitado: login Google, cancelamento e retorno permitido.
3. Duas contas no mesmo navegador mantêm registros e fotos separados.
4. Google Fotos: seleção cancelada, sessão expirada, imagem escolhida, formato inválido e falha parcial.
5. Agenda: eventos de dia inteiro, fuso, seleção vazia, apenas ocupado e duplicidade.
6. Spotify: state inválido, troca de conta, cancelamento, expiração, favorita e recente.
7. Desconexão não apaga cópias locais; sair limpa tokens de integrações.
8. Testar 320/375/768/1024/1440 px em navegador e aparelhos reais.

Não apresentar login ou integrações como ativos só porque o build terminou.
