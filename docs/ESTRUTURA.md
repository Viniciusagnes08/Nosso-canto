# Estrutura atual — versão 0.3

A revisão atual acrescenta `assets/boot.js` (login e início autenticado), `assets/auth.js` (sessão Supabase), `assets/connections.js` (seleção OAuth), `assets/integration-models.js` (mapeamento/validação), `api/photo.js` (download autenticado), `scripts/build.mjs` (bundle/configuração pública), e os módulos/figurinhas de humor da branch mais recente.

Consulte [CONEXOES.md](CONEXOES.md) para ativação e [REVISAO.md](REVISAO.md) para resultados e limites. O service worker antigo foi aposentado; autenticação exige rede. Os namespaces locais agora são por usuário; a base v1 anterior é preservada, sem atribuição automática.

---

O texto abaixo registra a revisão 0.2 e deve ser lido como histórico.

# Estrutura e evolução do Nosso Canto

## Versão 0.2 — organização e experiência local

O aplicativo continua estático, sem etapa obrigatória de build, e mantém as chaves originais de localStorage e IndexedDB para preservar a compatibilidade dos registros existentes.

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura semântica, navegação, diálogo e acessibilidade |
| `assets/app.js` | Telas, estado, formulários e coordenação das ações |
| `assets/catalog.js` | Humores, tipos de registro, desafios e dicas |
| `assets/utils.js` | Escape de conteúdo, identificadores e datas |
| `assets/media.js` | IndexedDB, compressão e carregamento de fotos |
| `assets/styles.css` | Componentes visuais e estilos de base |
| `assets/layout.css` | Ajustes de leitura, responsividade e interação |
| `sw.js` | Cache da aplicação e suporte offline |
| `test-smoke.cjs` | Renderização, persistência e regressões de comportamento |

Execute `npm test`. Para abrir localmente, execute `npm run dev` e visite http://localhost:8765. O Node é usado nos testes; a aplicação roda sem dependências de JavaScript de terceiros.

## Navegação e prioridades

1. Início: check-in, atalhos de registro, próximos encontros e lembranças.
2. Nosso dia: linha do tempo por tipo de registro.
3. Calendário: eventos manuais, horário, seleção de dia e retorno a hoje.
4. Desafios: sugestões, propostas e foto de participação.
5. Memórias: fotos escolhidas no aparelho e lembranças de outros anos.
6. Músicas: links e histórias das músicas, também acessíveis na navegação móvel.
7. Perfil: nomes, data do relacionamento, backups e situação das conexões.

## Entregue nesta revisão

- Navegação móvel com acesso direto às seis áreas principais.
- Atalhos na página inicial para humor, refeição, encontro, foto e música.
- Layout intermediário para notebooks estreitos, cartões flexíveis e formulários com tipografia de 16 px.
- Áreas de toque maiores, foco de teclado, link para pular navegação e redução de movimento.
- Histórico de navegação acompanha os botões Voltar e Avançar.
- Humor de outro dia não aparece como humor de hoje.
- Eventos mostram a data do evento e o horário informado.
- Fotos não alteram a escolha de compartilhamento do registro.
- Falha de escrita local interrompe o salvamento e restaura o estado persistido.
- Cache inclui os módulos separados; a limpeza se limita aos caches deste aplicativo.

## Próxima etapa: uso real por duas pessoas

Esta revisão não implementa contas nem sincronização. A opção de registro privado é metadado local, não uma barreira de acesso para pessoas que usam o mesmo navegador.

Ordem proposta para implementação:

1. Projeto pessoal de banco de dados, independente de qualquer ambiente empresarial.
2. Autenticação, perfil e convite de uso único para formar o casal.
3. Regras de acesso: autor acessa seus registros; parceiro acessa apenas os compartilhados; terceiros não acessam.
4. Migração local idempotente, com prévia dos registros a enviar e escolha explícita de compartilhamento.
5. Sincronização com controle de versão, estados de erro, nova tentativa e conflito de edições.
6. Fotos em armazenamento privado, com URLs temporárias e exclusão consistente.
7. Testes com duas contas participantes e uma terceira conta sem acesso.
8. Integrações opcionais de fotos, agenda e música após validar requisitos atuais dos provedores.

Critério de pronto: um registro compartilhado aparece no segundo aparelho; um privado permanece acessível apenas ao autor; desconexão e revogação têm comportamento verificável. Nenhuma integração deve ser apresentada como conectada antes desse teste.

## Pendências técnicas conhecidas

- Restauração de backup ainda usa o fluxo anterior de substituição. Antes de uso intensivo, implementar staging das imagens e recuperação atômica se houver falha intermediária.
- A coordenação das telas permanece em app.js; a próxima extração deve usar um estado/repositório explícito para preparar a sincronização, sem apenas espalhar estado global entre arquivos.
- Completar testes reais de fotos, backup grande, modo offline e instalação em iOS/Android. Os testes atuais não substituem essa homologação.
- Dicas externas podem estar em inglês; o conteúdo local continua disponível como alternativa.
