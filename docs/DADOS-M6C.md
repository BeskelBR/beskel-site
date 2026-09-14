# Dicionário M6C — Documentos gerais

Migrations 030–033: 11 tabelas e três views novas, total de 122 tabelas e 34 views no schema `hvb`. Tabelas de domínio são imutáveis, com organização/unidade, UUID, comando, autor, motivo, instante de registro, FKs compostas e RLS forçada.

| Tabela | Papel |
|---|---|
| `modelo_documento` | Código por unidade, nome e tipo descritivo |
| `modelo_documento_versao` | Versão consecutiva, título, texto base e público interno/responsável |
| `campo_modelo_documento` | Código de marcador e obrigatoriedade, atômicos com a versão do modelo |
| `aprovacao_modelo_documento` | Aprovação da estrutura para simulação |
| `solicitacao_documento` | Paciente, episódio opcional, modelo, solicitante tipado, escopo, protocolo UUID, recebimento, prazo e evidência informada |
| `autorizacao_documento` | Decisão permitida/negada, validade e evidência, única por solicitação |
| `revogacao_autorizacao_documento` | Revogação única, sem apagar decisão anterior |
| `documento_versao` | Solicitação, modelo exato, versão/anterior, campos JSONB textuais, conteúdo e hash |
| `aprovacao_documento` | Aprovação da versão preenchida, distinta de assinatura |
| `assinatura_documento` | Declaração não verificada, signatário tipado, mecanismo DEV, hash, instante e evidência |
| `entrega_documento` | Registro manual fictício, versão exata, destinatário, instante, evidência e referência persistente |

`solicitante_responsavel_id` e `solicitante_usuario_id` são mutuamente exclusivos. O mesmo vale para os campos de signatário. O episódio, quando informado, pertence ao paciente e à unidade. Nenhum responsável externo vira usuário fictício.

`campos` é um objeto de até 50 chaves com valores textuais de até 2.000 caracteres. Códigos usam letras minúsculas, dígitos e sublinhado, começando por letra. Modelo tem até 20.000 caracteres; conteúdo final, até 120.000. Valores numéricos/booleanos JSON não são convertidos silenciosamente em texto. O conteúdo é título, duas quebras de linha e corpo preenchido; SHA-256 usa essa string exata em UTF-8, sem reserialização JSON.

| View | Contrato |
|---|---|
| `solicitacao_documento_consulta` | Decisão, acesso vigente e prazo vencido sem entrega registrada |
| `documento_versao_consulta` | Metadados, paciente/público, aprovação, substituição e versão posterior; sem conteúdo preenchido |
| `documento_conteudo_consulta` | Conteúdo privado e hash, exigindo `documento_versao_id` e permissão própria na API |

As 12 listas são paginadas por UUID, máximo 100; filtros tipados constam no [OpenAPI](../openapi/hvb-sistema.json). Ler conteúdo interno não equivale a autorizar entrega ao solicitante. Revogação impede novos atos de aprovação, declaração e entrega; preserva acesso de operadores com permissão e os fatos históricos.

Referências: [ADR 0009](adr/0009-documentos-gerais.md), [relatório](RELATORIO-M6C.md) e [pendências](PENDENCIAS-HVB.md).
