# Dicionário M6E — Portal e comunicação

Migrations 036–038: dez tabelas e três views. Total acumulado: 140 tabelas, 40 views e 85 permissões. Nove tabelas de negócio têm organização/unidade, autor, comando, motivo e instante de registro; credencial tem hash, conta e validade, sem token em claro no banco. Tabelas imutáveis, RLS por organização e FKs tipadas.

| Entidade | Conteúdo e invariantes |
|---|---|
| `conta_portal` | Responsável e unidade; uma conta por responsável/unidade |
| `revogacao_conta_portal` | Suspende conta e todas as credenciais, preservando histórico |
| `credencial_portal` | Hash SHA-256 único, conta, organização e expiração; inserção administrativa local |
| `concessao_portal` | Conta, paciente, vínculo cadastral, evidência e validade |
| `revogacao_concessao_portal` | Revogação específica da concessão |
| `preferencia_comunicacao` | Finalidade aviso/documento/agenda, versão, decisão e evidência; canal portal_dev |
| `mensagem_portal` | Concessão destinatária, título/texto, finalidade, canal, origem, referência e agenda opcional |
| `mensagem_documento` | Versão documental exata, mesma unidade e comando da mensagem |
| `tentativa_comunicacao` | Mensagem, sequência de 1 a 5; retry só após falha conhecida |
| `retorno_comunicacao` | Tentativa, sequência, estado declarado, instante, evidência e referência deduplicável |
| `concessao_portal_consulta` | Vigência derivada de conta, relação, prazo e revogação |
| `preferencia_comunicacao_consulta` | Histórico com flag de versão atual |
| `mensagem_portal_consulta` | Metadados, estado operacional e acesso vigente; sem texto/documentos |

Oito POST administrativos sob `/v1/comunicacao`: contas, contas-revogacoes, concessoes, concessoes-revogacoes, preferencias, mensagens, tentativas e retornos. Nove GET de metadados: mesmos caminhos e documentos. Duas rotas GET próprias de portal com autenticação separada. Total: **19 operações novas**, **280 operações em 170 caminhos**.

Permissões internas: `portal:administrar`, `portal:ler`, `portal:autorizar`, `comunicacao:preferencias`, `comunicacao:preparar`, `comunicacao:simular`, `comunicacao:ler`. Token de portal não herda nenhuma delas. Escritas exigem idempotência, confirmação humana e simulação explícitas.

Texto da mensagem até quatro mil caracteres; até cinco documentos, sem renderização de HTML. Caixa limitada a cem itens por página, por UUID, e conteúdo sob demanda. Datas exigem fuso. Retorno não admite instante futuro ou anterior à tentativa/retorno anterior.

Ver [ADR](adr/0011-portal-comunicacao.md) e [relatório](RELATORIO-M6E.md).
