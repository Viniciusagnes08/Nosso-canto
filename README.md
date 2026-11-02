# Nosso Canto — versão 0.3

Aplicativo pessoal para cultivar presença à distância: humor com oito figurinhas originais de gatinhos, diário, agenda, desafios, memórias e músicas.

## Estado real

O código contém login Supabase e fluxos OAuth de Google Fotos, Google Agenda e Spotify. A autenticação fica indisponível até configurar um Supabase pessoal. Os botões das integrações ficam indisponíveis até cadastrar os respectivos Client IDs. Não há sincronização de registros entre aparelhos nesta versão.

Os registros e fotos ficam no navegador, separados por usuário autenticado. Isso evita mistura acidental entre perfis, mas não criptografa o armazenamento local nem substitui controle de acesso em banco remoto. A coleção anterior ao login permanece intacta e pode ser exportada explicitamente em Meu cantinho.

## Desenvolvimento

Requer Node 22+ e Python 3 para o servidor estático opcional.

```sh
npm ci
npm test
npm run build
python -m http.server 8766 --directory dist
```

O servidor estático permite verificar as telas. A importação de bytes do Google Fotos usa `api/photo.js` e requer Vercel Functions ou emulador equivalente.

Para compilar com configuração local, copie `.env.example` para `.env.local`, preencha somente valores públicos e execute:

```sh
node --env-file=.env.local scripts/build.mjs
```

Nunca coloque Client Secrets, service-role keys ou senhas em arquivos públicos. O código usa Google Identity Services e Spotify PKCE sem Client Secret no navegador. A função de fotos usa somente a chave pública do Supabase para verificar a sessão.

## Documentação

- [Ativação do login e das integrações](docs/CONEXOES.md)
- [Revisão e limites verificados](docs/REVISAO.md)
- [Mapa da estrutura](docs/ESTRUTURA.md)

## Verificação

`npm test` cobre as oito rotas, figurinhas, formulário de humor, compatibilidade de registros antigos, namespaces por perfil, falha de armazenamento, telas de login simuladas, OAuth state e mapeamento privado de eventos/músicas. Há testes de autenticação e restrição de origem/tamanho no endpoint de fotos.

Os provedores reais, e-mail transacional, callbacks, fotos e dispositivos físicos ainda precisam ser homologados após os cadastros. O login conectado exige rede; o service worker anterior é aposentado para não servir uma interface de acesso antiga pelo cache.
