# ADR 0007 — Exames e resultados estruturados

Data: 14/09/2026. Primeiro recorte M6 (M6A) implementado em simulação. O usuário autorizou continuidade; permanecem GitHub, branch única, dados fictícios e pendências cumulativas.

Exame é especialização explícita de item clínico, sem depender de item comercial. Solicitação, coleta, avaliação da amostra, resultado e liberação são fatos distintos. Não inferir execução, consumo, cobrança ou diagnóstico de uma solicitação ou resultado.

Catálogo, estrutura técnica, atributos e referências são versionados. A estrutura é imutável desde a criação; aprovação permite seu uso somente em simulação. Resultado preserva texto original, representação tipada, número decimal exato, qualificador, unidade e referência explícita quando compatível. Referência ausente, idade estimada ou contexto incompleto permanecem identificados; nenhum valor clínico será interpretado automaticamente.

Coleta interna referencia uma execução confirmada do mesmo episódio. Coleta externa registra proveniência e coletor informado, sem inventar usuário ou consumo hospitalar. Uma amostra rejeitada não fundamenta resultado; nova coleta tem identidade própria. Exames sem coleta só são permitidos por configuração explícita da versão.

Resultado é imutável e versionado com expectativa de versão. Valores são gravados no mesmo comando. Correção cria nova versão; liberação humana DEV preserva hash SHA-256 do conteúdo exato e autoria, sem se apresentar como assinatura eletrônica profissional validada. Nova versão em rascunho não substitui silenciosamente o resultado liberado anterior.

Concorrência por item de exame; mudanças de versão e liberação serializadas no banco. Organização/unidade, FKs tipadas, RLS, comando, auditoria e outbox acompanham todos os registros. Conteúdo técnico liberado pode ser consultado localmente, sem envio, portal, arquivo público ou integração de laboratório.

Este recorte cobre exames/resultados. Protocolos preventivos, documentos gerais, agenda, portal/comunicação e interface permanecem nos próximos recortes M6. Regras e poderes reais dependem da equipe do hospital.
