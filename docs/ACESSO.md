# Acesso ao Nosso Canto — diagnóstico e recuperação (02/11/2026)

## Por que o novo login não abria o aplicativo?
A revisão consolidada `improve/structure-responsive-v2` passou a exigir Supabase Auth antes de carregar o aplicativo. No momento da inspeção, o projeto Vercel `nossocanto` não tinha variáveis de ambiente configuradas para o Supabase, logo o formulário de login estava corretamente desabilitado, mas não havia forma de entrar para conhecer a interface. O Vercel também protege links de preview por autenticação da plataforma.

## Correção de acesso local
A tela passa a oferecer, quando o serviço de autenticação ainda não está configurado, um botão explícito **"Entrar no meu espaço neste dispositivo"**. Este acesso:
- funciona somente neste navegador/aparelho, sem conta pessoal;
- guarda registros sob `entre-nos-local-isolated-v1` e mídia no IndexedDB `entre-nos-images:local-isolated-v1`;
- mantém separados os dados `entre-nos-user-v1:<id>` e as mídias de perfis realmente autenticados;
- não inicializa os conectores Google, Spotify ou qualquer função autenticada do Supabase;
- oferece perfil local, histórico de humor com gatinhos, calendário manual, diário, fotos locais, backup e retorno à entrada;
- não importa automaticamente dados antigos e não promete sincronização entre o casal.

**Não desativar Vercel Authentication para liberar este acesso**, pois links de preview são protegidos pela conta Vercel. Para abrir, entre na sua conta Vercel e acesse a URL de homologação. O botão de acesso local só libera o espaço isolado no navegador, não contorna a proteção de implantação.

## Ativação posterior
Para login real entre dois aparelhos, é necessário criar/configurar um projeto Supabase pessoal e inserir somente a URL e chave **pública** no ambiente de preview do Vercel, cadastrar redirects, testar e reconstruir. Não reutilizar infraestrutura corporativa. As conexões opcionais requerem seus próprios cadastros e consentimentos. A sincronização entre pessoas não foi implementada.

## Validação
- Inspeção do código GitHub: ramo principal continua com código anterior; a versão completa está em draft na branch de revisão.
- Vercel latest preview do código consolidado reportou `READY`.
- A prévia corrigida reportou `READY`.
- Teste isolado do `assets/boot.js`: botão local, estado da interface, remoção do marcador de sessão e chamada de `startApp({id:'local-only-v1'}, {localOnly:true})` passaram.
- Análise estática do `assets/app.js`: dados e mídia local segregados, inicialização de provedores desabilitada para visitante.
- Navegador conectado não pôde executar QA visual final porque a conexão do Opera expirou durante a verificação. O status `READY` significa que o build passou, **não** que o uso em celular ou o login real foram homologados.
