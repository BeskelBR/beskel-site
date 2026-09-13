# ADR 0005 — Diária configurável, somente simulação

Data: 13/09/2026. Implementado e validado no recorte M4, restrito à simulação.

O usuário pediu continuidade e manter o código no GitHub; a configuração de Vercel/Cloudflare ficará a cargo dele. As regras reais de diária continuam pendentes. Este recorte não cria preço, cobrança, conta, título ou recebimento.

Implementar classificação versionada da internação, medição de peso referenciada quando informada, associação de pacote versionado ao episódio e períodos de diária explícitos. Não inferir janela de 24 horas, virada de calendário, tolerância, classificação ou efeito comercial de alta/permanência. Configurações incompletas permanecem em rascunho. Aprovação disponível somente como simulação, com confirmação explícita e autoria; não representa validação de regra real do HVB.

Grupos têm membros clínicos tipados. Regras declaram alvo, prioridade, dimensão (quantidade física, administrações ou itens clínicos distintos), janela (período explícito ou episódio), tratamento e limite. A maior prioridade explícita decide; empate ou ausência de regra ficam pendentes. Quantidade física exige produto/unidade base compatíveis. Contagem de administrações neste recorte usa execuções integrais; parciais ficam pendentes para revisão da semântica. Não usar nome como associação.

Eventos de cobertura referenciam execução ou item de consumo real, sem inventar evento assistencial. A avaliação é não monetária: incluído, parcial, excedente, excluído ou pendente. Cobertura não altera saldo, consumo ou custo. O material do tutor pode ser registrado, mas avaliação física de seu material permanece pendente até regra real de propriedade, sem cobrança automática.

Usos por pacote/regra/janela recebem alocações e reservas explícitas. Serializar operações pela linha do episódio, compartilhando a ordem de lock com M3. Quantidades usam decimais exatos; distintos contam o conjunto de itens clínicos, inclusive reservas ativas, não a soma de eventos. Expiração de reserva é explícita. Reavaliação exige versão esperada, reverte a alocação anterior e grava nova versão no mesmo comando. Histórico, auditoria e outbox permanecem atômicos.

Retificação clínica, estorno físico ou alta retroativa não são bloqueados pela cobertura. A consulta sinaliza origem/período que exige revisão; utilizações anteriores permanecem conservadoramente comprometidas até reversão/reavaliação explícita. Nenhuma correção comercial é inferida de alteração clínica.

Foram aprovados 17 testes M4 e 52 regressões anteriores, inclusive em banco vazio. Cobrem limite concorrente, reserva/repetição/expiração, reversão e reavaliação, janela exata, grupos/prioridades/conflitos, quantidade física e material do tutor, classificação/peso, isolamento/permissões e congelamento de versões aprovadas. Benchmark com mil avaliações e HTTP real está no [relatório M4](../RELATORIO-M4.md); limites permanecem nas [pendências cumulativas](../PENDENCIAS-HVB.md).

O nome persistente `avaliacao_cobertura` identifica uma decisão não monetária. A futura avaliação comercial deverá referenciar esse histórico e a origem tipada, preservando a separação entre fato clínico, consumo físico e cobrança. Nenhuma tabela de conta ou obrigação financeira foi criada no M4.
