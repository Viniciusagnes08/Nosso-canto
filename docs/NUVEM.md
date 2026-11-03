# Espaço compartilhado em nuvem

O aplicativo principal usa o Firestore (default), em southamerica-east1, no projeto nosso-canto-19a39, plano Spark. Não existe uma experiência paralela: humor, diário, calendário, desafios, memórias e músicas usam a mesma sincronização.

As regras publicadas restringem spaces/nosso-canto/entries às contas Google verificadas de Vinicius e Mirna. Documentos compartilhados são lidos pelos dois; privados somente pelo autor. Somente o autor pode alterar ou excluir.

A interface recebe atualizações por onSnapshot e confirma salvamento somente quando a promessa de escrita recebe resposta do servidor. Textos ficam no formulário em caso de erro. Fotos são comprimidas antes de serem anexadas ao registro; não é um armazenamento de fotos originais.

Os dados já associados à conta no navegador são migrados no primeiro acesso, preservando `shared`. Dados da antiga versão sem conta continuam separados e podem ser exportados manualmente.

Validação: build e 12 testes de regressão passaram. A validação com duas contas reais e fotos ainda precisa ser realizada; não acessar a conta de Mirna sem autorização própria.
