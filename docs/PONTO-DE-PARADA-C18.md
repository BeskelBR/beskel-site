# Ponto de parada — C18 Terminal v1

Atualização de continuidade em 22/09/2026: a situação Git abaixo é histórica e foi superada. C8–C18 e o frontend MVP 8 estão publicados em `hvb-sistema-dev`, SHA confirmado `bea6df2c8c1d4d6f741e965fe6a1726c62bda4fa`. Retomar pelo [plano de entrega da semana](PLANO-ENTREGA-SEMANA.md), prioridade 3; preservar o registro original abaixo.

Data: 22/09/2026. Workspace SISTEMA; branch `hvb-sistema-dev`; versão 0.27.0.

Delta N1 backend concluído no recorte documentado: migrations 073–076 aplicadas DEV/TEST e verificadas por hash; 78 testes pontuais aprovados; OpenAPI 451 operações/288 caminhos; 220 tabelas/77 views/128 permissões. Evidências e relatórios C18 estão em docs. Não existe adaptador biométrico real nem cliente novo em outra pasta/branch.

O working tree contém C8–C18 locais, preservados sem commit. Último publicado registrado C7 `789ee1f26241be9e636ea0ad328d03a1cea6f04b`. Não repetir tentativas de escrita Git enquanto o bloqueio adiado permanecer. Não reescrever migrations 001–076; próxima numeração: 077.

Para retomar: conferir branch/working tree, ler o inventário [FECHAMENTO-CICLO-BASICO.md](FECHAMENTO-CICLO-BASICO.md) e as pendências atuais. Prosseguir na consolidação restante do sistema, mantendo decisões humanas para a fase conjunta já combinada. Não tratar descrições congeladas de C5/C14 como impedimento de evolução N1 explicitamente autorizada; documentar novas supersessões.

Não reiniciar a implementação Terminal v1 nem reinterpretar etiquetas legadas. Credenciais locais permanecem privadas; nenhum segredo foi incluído nos relatórios. Validação C18 usa injeção HTTP local e cenários sintéticos no TEST. Migrations foram aplicadas no DEV, sem adicionar usuários/dispositivos operacionais reais.
