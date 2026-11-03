# Nosso Canto 2.0 — Handoff único para Codex

> **Papel do Codex:** engenheiro revisor e validador. **Não começar do zero e não repetir a implementação**. A maior parte deste incremento já foi codificada diretamente pelo ChatGPT na PR #9. Leia, execute os testes, inspeccione a interface real, corrija apenas defeitos demonstráveis e reporte evidências. Este arquivo substitui briefings redundantes para esta entrega.

**Projeto:** [Viniciusagnes08/Nosso-canto](https://github.com/Viniciusagnes08/Nosso-canto)  
**PR de trabalho:** [#9 — Nosso Canto 2.0](https://github.com/Viniciusagnes08/Nosso-canto/pull/9)  
**Branch:** `improve/experiencias-sync-media-20261103`  
**Base de desenvolvimento:** `main` no commit `10ea74875f08819b7625ec87a452d5bfceea8a59`.  
**Estado:** alterações em branch de homologação; **não mescladas em produção por esta entrega**. O CI e o build não substituem teste com dados reais.

## 1. A visão do proprietário (critério de projeto)

O aplicativo **Entre Nós / Nosso Canto** deve ser o espaço íntimo e elegante do casal, não uma cópia superficial do Instagram. Os dois possuem identidades próprias, mas compartilham experiências.

- **Nosso espaço:** todas as novas fotos, vídeos, humores, memórias, eventos, notas, desafios e músicas intencionalmente cadastradas/importadas são compartilhadas automaticamente entre os membros. Não perguntar a cada postagem “privado ou compartilhado”. Serviços externos **sempre exigem a escolha explícita** de quais dados importar e as autorizações necessárias.
- **Meu cantinho:** um único perfil editável por conta, com foto, nome, biografia, interesses e preferências. Não criar outro editor de perfil no Reels.
- **Meu Universo:** temas pessoais são isolados por usuário. BTS/Ballet podem ser interesses de uma pessoa, sem aparecerem automaticamente para a outra.
- **Momentos/Reels:** foco absoluto na foto ou vídeo; sem nome de arquivo, contador por cima da foto, rótulo “Só para você” ou barra inferior desnecessária. Rolagem confortável, reprodução de vídeo silenciosa até ação explícita.
- **Memórias:** fotografias reais, polaroids suaves, zoom/rotação, álbum navegável. Interatividade relevante, sem efeitos que atrapalhem leitura e uso.
- **Nossa Trilha:** música dentro do aplicativo **se** houver player oficial ou arquivo licenciado. Não fazer download nem reempacotar música protegida. Nenhuma reprodução com som automática.
- **Visual:** editorial romântico, creme, rosa discreto e ameixa; espaço em branco, fotografia predominante, gatinhos existentes como detalhes afetivos. Sem poluição visual, gradientes aleatórios ou dezenas de efeitos em paralelo.
- **Qualidade:** experiência verdadeiramente boa no Android, iPhone e desktop; não afirmar que está pronto apenas porque a Vercel mostra READY.

**Regra de segurança fundamental:** informações de perfil, favoritos pessoais, tokens e sessões não seguem o compartilhamento automático; históricos previamente privados **não** devem tornar-se públicos retroativamente.

## 2. Arquitetura que existe de fato

- Stack: HTML, CSS, módulos ES JavaScript, esbuild, Firebase Auth + Firestore, Firebase Storage parcialmente previsto. Adaptadores legados Supabase ainda estão no repositório.
- Não instalar React/Next.js só para usar React Bits, Magic UI, React PageFlip, Rive ou outro pacote sem provar compatibilidade, licença, custo de bundle e necessidade.
- `assets/app.js` continua sendo o shell legado com funcionalidades de diário, calendário, humor, memórias e trilha. Este incremento separa novos comportamentos sem reescrevê-lo inteiro.
- `assets/cloud-records.js` mantém compatibilidade com fotos antigas codificadas como Data URL; isso não é a arquitetura de mídia definitiva.
- `assets/reels.js` integra o feed vertical e gerenciamento de mídia; `assets/memory-gallery.js` e `assets/music-embed.js` são módulos de interatividade sem dependências adicionais.
- `assets/experiences.css` centraliza estilos e movimento para as novas experiências; evita sobrescrever a identidade do app inteiro.

### Arquivos efetivamente criados ou alterados

| Arquivo | Trabalho realizado | Verificação do Codex |
| --- | --- | --- |
| `assets/core/sync-policy.js` | Seleção não destrutiva de registros legados e fingerprint de snapshots | Testar conflitos com duas sessões e timestamps |
| `assets/cloud-records.js` | Antes de importar registros locais, consulta IDs da nuvem; não sobrescreve entradas existentes; evita hidratação repetida | Validar migrações, latência e permissões reais |
| `assets/core/media-window.js` | Janela ativa do Reels e versão de conteúdo | Confirmar no Safari/iOS |
| `assets/reels.js` | Foto do parceiro, Blob URL para imagens, liberação de mídia distante, menos re-render do feed | Testar 36+ fotos, vídeo, voltar, alternar abas |
| `assets/memory-gallery.js` | Modal de galeria, zoom, rotação de 90°, teclas, tilt leve no desktop, liberação do Blob URL | Verificar foco, fechamento, labels, imagens reais |
| `assets/app.js` | Botões de foto acionáveis no álbum; player oficial na Nossa Trilha; instalação dos módulos | Verificar sem regressão de CRUD, diário e calendário |
| `assets/music-embed.js` | Validação de URL Spotify, iframe oficial somente após clique e descarte ao fechar | Verificar embed liberado, conteúdo e direitos |
| `assets/experiences.css` | Design responsivo, polaroids, modais, disco decorativo e reação curta do gato | Auditar 360/390/768/1440 px e prefers-reduced-motion |
| `index.html` / `scripts/build.mjs` | Carregamento da folha nova também na compilação | Confirmar artefato em `dist` |
| `vercel.json` | CSP de iframe inclui apenas `https://open.spotify.com` adicionalmente | Auditar CSP e autenticação |
| `test-smoke.cjs` | Simulador reconhece os novos módulos sem requerer Firebase no modo local | Manter validação real em CI |
| `tests/sync-policy.test.mjs` | Nuvem vence cache legado, versão estável de listener | Conferir limite de transações |
| `tests/media-window.test.mjs` | Janela de até três reels e acesso a imagens de ambos | Confirmar vazamento de memória real |
| `tests/experiences.test.mjs` | Verifica URLs Spotify, galeria, integração e CSP | Complementar com E2E visual |
| `.github/workflows/nc-phase1-check.yml` | CI Node 24: testes, build e sintaxe | Proteger merge com status checks |

## 3. Qualidade confirmada e limites

O CI de integração do GitHub executou **`npm ci`, `npm test`, `npm run build` e `node --check`** com sucesso após a correção do mock legado (GitHub Actions; detalhes no histórico da PR). As outras três verificações existentes também passaram na execução posterior ao ajuste do teste de fumaça.

**Isso não prova:** acesso às fotos e vídeos reais, transições nos celulares, uso de Google Fotos, reprodução Spotify em cada conta, conformidade de acessibilidade ou permissões Firebase Storage publicadas.

Não publicamos regras nem ativamos produtos pagos. A prévia pode exigir autenticação da Vercel. **Nunca interpretar bloqueio 403 de preview como sucesso da funcionalidade.**

**Auditoria de dependências:** o log de `npm ci` sinalizou **2 vulnerabilidades de severidade alta**. A identidade dos pacotes e o alcance em runtime não foram verificados nesta entrega. Rodar `npm audit --json`, identificar caminhos afetados e corrigir com alteração mínima testada antes de produção; **não** executar `npm audit fix --force` cegamente.

## 4. Validação obrigatória do Codex (executar na PR, sem refazer o código)

### Gate A — Integridade e sincronização

1. Atualizar a branch PR #9 em worktree limpo; conferir o SHA, `git diff main...HEAD` e `npm ci`.
2. Executar `npm test` e `npm run build`. Resultado esperado: exit code 0. Registrar versões de Node e npm. A dependência Firebase exige Node >=24.12; evitar motores antigos nos pipelines.
3. Reproduzir com **as duas contas reais autorizadas**: conta A cria memória com foto; B visualiza no álbum e no Reels. A edita legenda; B atualiza sem perder foto; A exclui; B deixa de ver. Testar rede lenta/desconexão/reconexão.
4. Cenário de conflito: dois aparelhos, um com cache desatualizado. Login do aparelho antigo **não pode sobrescrever título, conteúdo ou compartilhamento mais novos** na nuvem.
5. Verificar se a importação legada ainda enfrenta colisão de ID com registros compartilhados de outro autor. Se houver caso reproduzível, estender proteção sem modificar histórico existente.
6. Verificar que fotos importadas do Google Fotos são selecionadas conscientemente, aparecem no espaço do casal e não usam nomes de arquivo como legendas.
7. Conferir que **preferências de Meu Universo** permanecem diferentes nas duas contas. Um favorito pessoal não entra no diário.

### Gate B — Reels e ciclo de vida de mídia

1. Importar/amostrar 36 ou mais fotos autorizadas (sem expor mídias privadas no relatório).
2. Percorrer o feed completo e depois voltar: nunca manter objetos `blob:` antigos de itens fora da janela ativa; fotos e GIFs não devem ficar em branco ao retornar.
3. Verificar mudança de rota, abrir modal, aba em segundo plano, aparelho bloqueado, retorno de foco; vídeos pausam quando não visíveis.
4. Medir uso de memória, número de listeners, redownload e custo de render; priorizar correção de vazamentos observados.
5. Testar movimento reduzido, navegação por teclado, gestos de toque, áreas clicáveis >=44 px e texto legível.
6. Verificar que nenhum título automático como `IMG_1234.jpg`, UUID ou caminho local aparece no Reels/álbum.

### Gate C — Memórias e Nossa Trilha

1. Em Memórias, abrir foto, navegar anterior/próxima, girar 90°, aplicar zoom, fechar e reabrir. Verificar que nenhum Blob URL fica ativo após fechamento.
2. Testar fechamento com ESC, foco visível, leitor de tela e fallback para fotografia indisponível.
3. Abrir faixa Spotify por **Ouvir aqui**. O iframe só pode nascer após clique; deve desaparecer ao fechar e liberar reprodução.
4. Verificar no Safari iOS/Chrome Android limites do embed oficial; não prometer áudio contínuo entre telas. Outros links musicais seguem externos.
5. A vinheta de disco existente é **decoração estática**, não indicador falso de áudio tocando. Só adicionar animação sincronizada se o SDK oficial confirmar `playing`.
6. Monitorar console para CSP bloqueada, erro de sessão e exceções de DOM. Nada de controles mortos.

### Gate D — Visual e acessibilidade

Realizar capturas da PR e da `main` em estados equivalentes (mesma conta, rota, dados de teste autorizados, largura, zoom e tema), e comparar lado a lado:

- Desktop 1440×900, tablet 768×1024, mobile 390×844 e 360×740, incluindo Safari/iPhone se disponível.
- Login, Início, Reels, Memórias, lightbox, Nossa Trilha, player, Humor, Meu Universo e Meu cantinho.
- Estados carregando, vazio, erro, com 1 foto e com coleção longa.
- Tipografia, hierarquia, espaçamento, botões de 44×44, contraste WCAG AA, alt/aria, foco, scroll lateral, notch/safe area, reduced motion e tamanho da página.
- **Não aprovar Design QA somente lendo CSS**. Exigir render e screenshots válidos. Se preview for inacessível, marcar visual QA bloqueado e não mesclar.

## 5. O que Codex NÃO deve fazer

- Não apagar registros, alterar donos, importar dados de outro usuário ou publicar registros históricos privados automaticamente.
- Não publicar na `main` antes de aceite funcional e testes nas duas contas.
- Não duplicar perfil dentro do Reels.
- Não retirar seleção/autorização de serviços externos; compartilhar automaticamente só ocorre **após** importação voluntária para o espaço.
- Não ativar Firebase Storage, subir regras, abrir CORS ou criar serviços pagos sem autorização explícita.
- Não copiar música de Spotify/YouTube; não criar MP3 pirata nem autoplay com áudio.
- Não adicionar GSAP, React Bits, Howler, Motion, Rive, Three.js e afins indiscriminadamente; qualquer dependência nova exige ADR, licença, teste e avaliação de peso.
- Não gerar dados falsos em ambiente produtivo, nem expor informações sensíveis em logs ou screenshots.

## 6. Etapas futuras — somente onde for necessário

**P0:** confirmar autenticação, Firestore Rules publicadas, sincronização cruzada com duas contas, arquivos em celular. Resolver qualquer regressão e excluir orfandades de uploads.

**P1:** ativar Storage de forma controlada (bucket, custo, regras, CORS, metadata privada, upload resiliente, limpeza, miniaturas) para vídeos/GIF e novas fotos; modelar migração gradual de imagens em base64 sem destruir o legado. Vídeos importados do Google Fotos exigem um fluxo próprio do Picker e upload seguro.

**P1:** separar `assets/app.js` e `assets/connections.js` progressivamente por domínio, com testes de comportamento para cada extração. Evitar um big-bang ou scaffold vazio.

**P2:** polaroids em modo galeria, flipbook com fallback convencional, eventos especiais e animações dos gatinhos, controles de notificações. Só após estabilizar.

**P2:** player de áudio próprio/licenciado com Howler.js se houver arquivos autorizados. Para Spotify, somente SDK/embeds oficiais. Nada de “full player” simulado.

**P3:** melhorar personalização com regras explicáveis por perfil, fontes confiáveis e deduplicação de notícias. Conteúdo externo não vira dado compartilhado sem ação intencional.

## 7. Recomendações de arquitetura

- Criar interfaces pequenas por domínio; não expandir `assets/app.js` indefinidamente.
- Evoluir modelos legados com adaptadores e testes de migração: `record.photoId`, `record.photoData`, `record.shared` continuam válidos para leitura até migração comprovada.
- Firestore doc máximo 1 MiB: **não** crescer dados base64 na coleção de registros.
- Telemetria de erro deve ocultar dados pessoais, tokens, identificadores sensíveis e URLs temporárias.
- Usar chave de idempotência por item importado; remover duplicatas por provider+externalId+owner de forma determinística.
- Guardar URL de mídia em Storage e um poster/thumbnail; descartar vídeo fora da janela ativa; renderizar no máximo a mídia atual e adjacentes.
- O CSS de experiências deve permanecer isolado e responsivo, não redefinir globalmente todo o design system.
- Executar alterações em commits pequenos por intenção; atualizar testes e documentação na mesma PR.

## 8. Critérios finais para aprovação

A PR só pode ser mesclada depois de:

- [ ] CI verde no último commit, não em SHA antigo.
- [ ] Sem sobrescrita de dados por cache legado comprovada em duas sessões.
- [ ] Foto publicada por A visível por B no Reels e Memórias.
- [ ] Vídeos/GIF desabilitados honestamente se bucket não estiver pronto.
- [ ] Imagem gira, amplia, fecha; áudio Spotify apenas após clique, sem tocar ao fechar.
- [ ] Nenhuma preferência pessoal vaza entre os perfis.
- [ ] Não existem filename/UUID e segundos perfis no feed.
- [ ] Screenshots mobile e desktop revisados; estados vazios/erro e teclado acessíveis.
- [ ] Recursos externos e custos confirmados antes de ativação.
- [ ] Rollback e preservação de dados comprovados.

**Formato esperado da devolutiva do Codex:** uma tabela concisa `Requisito | Evidência | Status [PASS/FAIL/BLOCKED] | Patch/commit`, links de capturas ou logs sem dados privados, e PR contendo **somente** correções justificadas. Se nada falhar, declarar “nenhuma correção necessária” e não modificar o projeto para consumir trabalho.

---

## Contexto adicional e referências

- Especificação anterior extensa: `Nosso_Canto_2_0_Especificacao_Codex.md` (entregue na conversa); usar somente para fases futuras, sem tomar hipóteses como comprovadas.
- Referência de Reels: [SolutionCarriers/vybe](https://github.com/SolutionCarriers/vybe), inspiração de interação, **não copiar código ou stack**.
- Referências de movimento pesquisadas: GSAP, Embla, dotLottie, React Bits, React PageFlip, Rive e Howler.js. Nenhuma foi instalada nesta fase; componentes nativos foram priorizados.
- Mobbin não forneceu referências nesta sessão por exigir plano pago; não inventar prints nem alegar auditoria dele.

**Mensagem do proprietário:** _“Quero um aplicativo com nossa cara, bonito, leve e divertido. Cada pessoa terá seu perfil e o que gosta de acompanhar. O que registrarmos no nosso espaço é para os dois; não quero ter que ficar escolhendo isso toda hora. Quero que as fotos, os vídeos e as músicas deem vontade de usar o aplicativo, mas sem erros, telas duplicadas ou poluição. Quero que você [Codex] revise e valide o que já foi implementado, não que reconstrua.”_
