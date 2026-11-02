# Humor com Figurinhas de Gatinhos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar oito figurinhas originais para o humor e uma página responsiva integrada ao fluxo existente.

**Architecture:** Catálogo único de oito estados em `assets/catalog.js`; apresentação de figurinhas em `assets/mood-view.js`; página, modal, miniatura inicial e persistência ficam integrados a `assets/app.js`. Ilustrações SVG em `assets/stickers/`, CSS em `assets/mood.css`.

**Tech Stack:** HTML/CSS/JavaScript ES modules, localStorage atual, PWA service worker, GitHub e Vercel.

---

### Task 1: Figurinhas e catálogo
**Files:** criar `assets/stickers/cat-{id}.svg` para os oito IDs; modificar `assets/catalog.js`.
- [ ] Definir os oito IDs `apaixonado,saudade,feliz,carente,cansado,bravo,ansioso,tranquilo` com nome, frase e caminho SVG.
- [ ] Gerar um SVG independente para cada humor, traço coeso, transparente e sem texto embutido.
- [ ] Manter os IDs legados em um dicionário explícito para leitura do histórico.

### Task 2: Componente reutilizável e estilos
**Files:** criar `assets/mood-view.js`, `assets/mood.css`.
- [ ] Renderizar `<button type="button" data-pick-mood="..." aria-pressed="false">...` por humor.
- [ ] Criar imagem `<img src="./assets/stickers/cat-feliz.svg" alt="" width="160" height="160">...` dentro do botão que também contém texto acessível.
- [ ] Criar grade com 2 colunas em celulares, 3 em tablets e 4 em desktops; modos compacto e modal.
- [ ] Garantir `:focus-visible`, seleção evidente e `prefers-reduced-motion`.

### Task 3: Página, modal, diário e home
**Files:** modificar `assets/app.js`, `index.html`.
- [ ] Adicionar rota `humor` e link no menu lateral e móvel.
- [ ] Criar página com notas opcionais, compartilhamento opt-in e botão salvar; não salvar sem seleção.
- [ ] Reutilizar as imagens no modal e no histórico, sem apagar IDs antigos.
- [ ] Centralizar criação de registros de humor no mesmo armazenamento existente: `data.entries.push(record); persist();`.
- [ ] Preservar formulário de nota e opção privada.

### Task 4: Serviço offline e testes
**Files:** modificar `sw.js`, `test-smoke.cjs`, adicionar documentação.
- [ ] Cachear `assets/mood.css`, `assets/mood-view.js` e as oito figuras; atualizar versão do cache.
- [ ] Validar catálogo, rota, seleção, armazenamento, fallback histórico e renderização das imagens em smoke test.
- [ ] Publicar exclusivamente branch de homologação no Vercel e verificar estado READY.
- [ ] Conferir com QA visual e reportar qualquer teste não executado.
