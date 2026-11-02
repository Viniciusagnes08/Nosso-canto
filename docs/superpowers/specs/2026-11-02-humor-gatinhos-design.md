# Tela Humor com Figurinhas de Gatinhos — 2026-11-02
## Objetivo
Substituir os seletores de humor em emojis por oito figurinhas originais de gatinhos, cada uma com nome e frase, em uma tela própria integrada ao diário local do app Entre Nós.
## Experiência aprovada
Humores: Apaixonado (“Hoje eu tô todo seu.”), Com saudade (“Queria você aqui comigo.”), Feliz (“Meu coração tá levinho hoje.”), Carente (“Tô precisando de carinho.”), Cansado (“Hoje eu só queria colo.”), Bravo (“Tô meio bravinho hoje.”), Ansioso (“Meu coração tá acelerado.”), Tranquilo (“Hoje eu tô em paz.”).
## Design
Imagens vetoriais SVG originais, fundo transparente e contorno branco como sticker; paleta creme, vinho e rosé. Página #humor: título “Como está seu coração hoje?”, subtítulo explicativo, grade 4/3/2 colunas (desktop/tablet/celular), seleção com aria-pressed, campo de nota opcional, toggle de compartilhamento desmarcado e botão “Salvar meu humor”. Modal de humor e cartão resumido da home reutilizam as mesmas figurinhas. Botões de navegação nos tamanhos menores permanecem acessíveis por rolagem horizontal.
## Persistência
Continuar usando apenas a coleção `data.entries`, `persist()` e o identificador `entre-nos-local-v1`. Cada seleção salva `{id,type:'mood',owner:'self',created,date,title:'',note,shared,mood}`. Não criar outro localStorage ou alegar sincronização entre contas.
## Compatibilidade
Registros antigos com IDs radiante, normal, triste e dificil continuam legíveis por fallback explícito; não reinterpretar a emoção histórica sem indicação. Os novos oito IDs são usados somente para registros novos.
## QA
Verificar opções únicas, sem emojis na nova grade, seleção via toque/teclado, botão sem seleção bloqueado, registros locais/backup preservados, fallback histórico, tela/diálogo e rotas #humor, responsividade 320/375/768/1024/1440px, PWA cache das imagens, foco, contraste e movimento reduzido.
