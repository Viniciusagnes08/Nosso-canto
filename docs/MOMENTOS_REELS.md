# Momentos: perfis pessoais e feed de memórias — 03/11/2026

## Objetivo
Ampliar o app **Entre Nós / Nosso Canto** com duas experiências complementares sem trocar o stack atual: perfis individuais e um feed vertical com fotos, vídeos curtos e GIFs, baseado nos padrões de interação de [VYBE](https://github.com/SolutionCarriers/vybe) (MIT). Nenhum código do VYBE foi copiado: o app de referência é Expo/React Native + Supabase; o Nosso Canto continua web + Firebase.

## Como acessar e usar
1. Entrar no Nosso Canto com a conta individual autorizada e tocar em **Momentos / Reels**.
2. Usar **Para nós** para as mídias compartilhadas e **Minhas** para todas as publicações próprias, inclusive privadas.
3. Em **Meu perfil**, cadastrar foto, nome, bio, interesses e música favorita. A ficha completa permanece restrita ao próprio usuário; publicações compartilhadas exibem o nome e a foto escolhidos.
4. Em **+ Publicar**, escolher uma foto JPG/PNG/WebP (12 MB no arquivo original), GIF (8 MB) ou MP4/WebM (24 MB), escrever legenda e escolher **Nós dois** ou **Só eu** antes de salvar.
5. Para fotos do Google Fotos: abrir **Importar do Google Fotos**, selecionar as fotos no Picker oficial e salvá-las. Elas surgem em **Momentos > Minhas**, privadas por padrão; é necessário tocar em **Publicar** para que o outro perfil as veja.
6. No feed, deslizar verticalmente. Vídeos visíveis reproduzem em silêncio e entram em pausa ao sair da tela; o som pode ser ativado pelo botão. O favorito por coração fica salvo somente neste aparelho, sem contagem compartilhada.

## Estado de integração
- Fotografias novas: compactadas no navegador e salvas no Firestore como dados JPEG limitados; assim podem sincronizar sem um bucket adicional.
- Fotos Google: reutilizam a importação já existente em `api/photo.js`, com Picker do próprio Google e aprovação explícita; não existe leitura em segundo plano de uma biblioteca inteira.
- Vídeos e GIFs: o código usa Firebase Storage com regras de segurança e mídia sob `reels/<uid>/<postId>.<ext>`. Para funcionar de verdade, exige um bucket dedicado existente, regras publicadas e a variável pública `FIREBASE_STORAGE_BUCKET` na Vercel. O app indica indisponibilidade sem configurar o bucket; NÃO considerar ativado só por um build READY.
- Importação de vídeos diretamente do Google Fotos: **ainda não implementada**. A API Picker suporta vídeos selecionados, mas a função atual `api/photo.js` deliberadamente restringe a fotos, e arquivos grandes exigem fluxo dedicado que não dependa dos limites de resposta da Vercel.
- Não há acesso a fotos antigas sem seleção e consentimento do titular.

## Preparação de Storage
1. Consultar planos/custos antes de ativar o serviço; não criar recursos pagos automaticamente. Ativar Cloud Storage para o Firebase **somente no projeto pessoal do Nosso Canto**.
2. Publicar o arquivo `storage.rules` no bucket correto. Confirme que o acesso privado funciona com as duas contas e é negado a uma terceira.
3. Adicionar `FIREBASE_STORAGE_BUCKET` na Vercel (Preview primeiro) com o nome **real** do bucket, sem o prefixo `gs://`. Refazer deploy.
4. Permitir o domínio exato do aplicativo no CORS do bucket para leitura autenticada por `getBlob`, conforme exigido pelo SDK do Firebase.
5. Confirmar publicação e reprodução de MP4, WebM e GIF tanto no Android quanto no iPhone; alguns navegadores não suportam WebM e MOV/HEVC não é aceito na V1.

## Segurança / privacidade
- A lista de pessoas autorizadas já é controlada por `firestore.rules`. O feed usa as mesmas regras existentes: registros próprios ou `shared == true`, jamais uma consulta irrestrita de terceiros.
- O bucket usa `storage.rules` com upload/delete apenas para o autor, leitura privada pelo dono e leitura compartilhada apenas por membros autorizados.
- O cliente não cria links públicos permanentes: usa `getBlob()` autenticado e `blob:` temporário. Esses blobs são revogados ao fechar o feed.
- Perfis completos estão em `spaces/nosso-canto/profiles/<uid>`, leitura permitida só ao proprietário. O post compartilhado carrega uma cópia mínima do nome e avatar que a pessoa escolheu divulgar.
- Excluir um Reel remove o documento e tenta remover a mídia; a remoção do arquivo deve ser auditada em homologação para evitar resíduos se a operação de Storage falhar.
- Não modificar `main` ou produção antes do teste dos dois perfis, das regras, da restauração e do desempenho em celulares reais.

## Critérios de validação
- Dois usuários autorizados conseguem manter perfis diferentes, inclusive após sair e voltar.
- Um Reel marcado privado aparece somente em **Minhas** do autor; nunca no perfil alheio ou em **Para nós**.
- Após publicar como compartilhado, aparece em **Para nós** de ambos os dispositivos.
- Fotos escolhidas no Google Fotos aparecem na biblioteca própria; só passam a ser compartilhadas com consentimento adicional.
- A interface suporta scroll vertical, vídeos pausam fora de vista e o modo de redução de movimento não inicia autoplay.
- Upload inválido ou sem bucket informa o problema em vez de simular sucesso.
- Nenhuma função da V1 exige copiar o repositório VYBE ou instalar Supabase novo.

