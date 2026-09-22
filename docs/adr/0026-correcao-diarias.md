# ADR 0026 — Correção de associações e períodos de diárias

Status: aceita para simulação DEV. Data: 17/09/2026. Complementa M4 e C15; não aprova regras comerciais do hospital.

## Problema

Associações de pacote e períodos eram imutáveis e suas exclusões temporais incluíam todo o histórico. Não havia como corrigir intervalo/contexto ou cancelar um registro indevido preservando a origem. Reservas, avaliações e documentos financeiros dependem desses IDs; trocar valores no registro ou recalcular efeitos implicitamente perderia a rastreabilidade.

## Decisão

Duas tabelas imutáveis registram revisão de associação e revisão de período. Cada origem admite uma decisão final: correção com sucessora nova ou cancelamento sem sucessora. Uma sucessora pode receber nova revisão, formando uma cadeia. IDs de origem funcionam como controle de concorrência; retries continuam usando o comando idempotente. Organização, unidade e episódio são preservados por FKs tipadas, incluindo as sucessoras com conferência diferida no commit.

A correção insere revisão e sucessora na mesma transação. Falhas de intervalo, classificação, pacote aprovado ou episódio desfazem ambas, comando, auditoria e outbox. O autor da revisão é o usuário autenticado; a permissão dedicada é `diarias:corrigir`, acrescida de `diarias:associar` quando há sucessora. Confirmação humana e simulação exigem booleanos literais true.

Não se migram efeitos de forma automática. Antes de revisar um período, exigir liberação/expiração explícita das reservas ativas, reversão das avaliações de cobertura não revertidas e dos itens financeiros ativos originados do período ou de sua cobertura, inclusive os de valor zero. Títulos, recebimentos e demais dependências seguem a ordem de reversão financeira já existente. Antes de revisar associação, tratar todos os seus períodos vigentes. Não se trata só de verificar saldo: uma avaliação pendente ainda é uma decisão que precisa de reversão explícita.

As exclusões GiST históricas são substituídas, em migration nova, por guardas de sobreposição apenas dos intervalos vigentes, serializadas pelo episódio. A validação existe no banco, também para INSERT SQL concorrente; não depende somente do serviço HTTP. A imutabilidade das tabelas originais continua intacta. Todas as regras originais de internação, limites de associação, classificação e fuso continuam aplicadas às sucessoras.

Projeções expõem revisão, sucessora e situação, sem ocultar linhas antigas. O período revisado necessita de revisão e deixa de fornecer regra elegível de cobertura ou origem financeira ativa. Reservas, alocações e novos usos não recuperam a vigência da origem. Leituras identificadas continuam auditadas pelo mecanismo C12.

## Limites

Não há restauração, alteração da classificação original, transferência entre episódios, divisão/fusão automática, migração em lote nem recálculo de cobertura/cobrança. Uma associação substituta precisa de períodos explicitamente criados; os períodos antigos continuam cancelados/corrigidos na sua própria cadeia. A confirmação de um comando antigo retorna o resultado histórico, mesmo após revisão posterior.

A presença histórica de associação/evento de cobertura continua acionando a barreira financeira contra omissão de diária. Cancelar associação não promove uma cobrança de execução a cobrança avulsa. Regularizar esse caso exige política/fluxo explícito futuro; permanece pendência documentada. Este recorte prioriza preservar a barreira existente, sem inventar aprovação comercial.

## Evidência

Migrations 069–070; 15 testes específicos incluindo concorrência API/SQL, financeiro, RLS/RBAC, rollback e retry. Recorte total de 68 testes aprovado. Demonstração DEV repetida com quatro revisões e saldo físico preservado. Ver [relatório C16](../RELATORIO-C16.md).
