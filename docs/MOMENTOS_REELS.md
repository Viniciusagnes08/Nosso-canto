# Momentos e Meu Universo — ajustes de 03/11/2026

## Regra de produto

O Nosso Canto é um espaço do casal com **dois perfis pessoais** e um **acervo compartilhado**.

- **Perfil pessoal:** nome, foto, biografia, música favorita, texto de interesses e até oito assuntos do Meu Universo pertencem somente ao usuário autenticado. Dados de autenticação, tokens e preferências não são publicados.
- **Meu Universo:** cada pessoa escolhe seus próprios assuntos em **Meu cantinho**. Sem escolha, o feed mostra um convite de configuração, jamais os interesses do outro. O catálogo contém BTS, Ballet e outros temas; atualmente só BTS e Ballet têm vídeo oficial e seleção específica de música, enquanto as demais categorias têm notícias.
- **Conteúdo do casal:** cada **novo** registro criado ou importado (fotos, memórias, humor, diário, calendário, desafios e músicas) é compartilhado automaticamente com o outro membro. Não existe controle de privacidade por novo registro. A interface deixa claro o compartilhamento automático antes do envio. No Google Fotos/Agenda/Spotify, o usuário continua selecionando **o que deseja importar** e autorizando o provedor; apenas a escolha de visibilidade após importação foi eliminada.
- **Histórico privado:** itens criados antes desta mudança com `shared: false` **não são convertidos retroativamente**. Isso evita uma divulgação inesperada dos dados. Uma migração em lote deve ser uma etapa específica de consentimento.
- **Favoritos do Meu Universo:** salvos por usuário, privados; não seguem a regra dos novos registros do casal.

## Momentos/Reels
- Removidos: segunda tela e botão de perfil, contador no topo, etiqueta FOTO/VÍDEO e Só para você, faixa inferior “Deslize para continuar” e link de Google Fotos no rodapé. A importação continua disponível em **Meu cantinho → Suas conexões**.
- A legenda só é exibida quando a pessoa escrever texto próprio. Identificadores de upload como `19dad113-8ce6-4322-8849-f6a98b2a7931.jpg` são reconhecidos como nomes de arquivo, não legendas, inclusive em conteúdo antigo.
- Novos Reels têm `shared: true` e, para GIF/vídeo no Firebase Storage, metadata `shared: "true"`. Não existe seletor “Só eu / Nós dois”.
- O filtro “Minhas” continua disponível para ver publicações do próprio usuário, inclusive arquivos antigos marcados como privados; é filtro de autoria, não uma configuração de compartilhamento.

## Perfil
- Existe **um único formulário de perfil**, no **Meu cantinho**, com foto, nome, data da história, bio, gostos e escolha dos assuntos do Meu Universo.
- Preferências e informações pessoais ficam em `spaces/nosso-canto/profiles/<uid>` com regras de leitura apenas para o dono.
- Cada pessoa precisa escolher seus assuntos individualmente. Não há criação automática de perfil “da namorada” a partir de endereços de e-mail ou inferência.

## Implantação e verificação
- Alterações feitas na branch `fix/reels-perfis-universo-pessoal-20261103`. Não alterar produção antes da homologação em duas contas.
- Testar manualmente: abrir Reels, avançar por fotos, nova foto sem legenda, registro de humor, evento de calendário, importação selecionada do Google Fotos, perfis diferentes e favoritos pessoais.
- Testar acesso cruzado: itens novos compartilhados aparecem nos dois logins; configurações do Meu Universo não se misturam; itens antigos privados continuam inacessíveis à outra conta.
- Ativação de MP4/WebM/GIF ainda exige bucket real de Firebase Storage, regras publicadas, CORS e `FIREBASE_STORAGE_BUCKET` configurado na Vercel. Compilar não equivale a homologar mídia.
- O Google Fotos Picker **não importa automaticamente a biblioteca inteira**. A importação de vídeos diretamente do Google Fotos ainda não foi implementada.
