# HVB Terminal — Offline / Edge v1

Status: **DIREÇÃO ARQUITETURAL / ainda não implementado**.

## 1. Problema

A arquitetura v2 possui pelo menos dois clientes operacionais durante a retirada:

```text
Terminal externo
+
HVB Mobile dentro da sala
```

Quando a API central fica indisponível, duas PWAs isoladas não conseguem manter, sozinhas, uma autoridade consistente sobre:

- AuthSession;
- AccessSession;
- ordem;
- eventos de porta/armário;
- idempotência;
- sincronização.

Por isso, offline não deve ser tratado apenas como `localStorage + retry`.

## 2. Regra atual do protótipo

Até existir uma política/Edge homologados:

```text
API indisponível
→ não criar nova AccessSession
→ não autorizar nova barreira física
→ FAIL_CLOSED
```

Isto vale especialmente para estoque sensível.

O protótipo pode registrar apenas telemetria/local UI sem efeito físico real.

## 3. Direção futura preferida

```text
HVB API / Cloud
      │
      │ sincronização
      ▼
HVB Edge local
      │
  ┌───┴────┐
  ▼        ▼
Terminal  HVB Mobile/LAN
  │
  ▼
Controlador físico
```

O Edge é uma hipótese arquitetural forte, não uma autorização de implementação/compra.

## 4. Responsabilidades candidatas do Edge

Se aprovado futuramente:

- cache mínimo de identidades/credenciais autorizadas;
- políticas offline versionadas e com validade;
- ordens previamente sincronizadas;
- emissão/validação local de sessões dentro de escopo limitado;
- fila local append-only;
- UUID/command_id;
- idempotência;
- sincronização posterior;
- comunicação com controlador físico em LAN;
- relógio/ordem temporal confiável;
- estado explícito de sincronização.

Não deve virar uma segunda fonte de verdade independente da API central.

## 5. Estoque comum

Uma política offline futura poderá permitir acesso comum somente quando todos os pré-requisitos estiverem satisfeitos, por exemplo:

```text
credencial conhecida
+ identidade 1:1/PAD local
+ política offline válida
+ ordem previamente cacheada
+ dispositivo confiável
+ janela temporal válida
```

Qualquer ação deve nascer com:

- `event_id`/`command_id` único;
- `source_occurred_at`;
- `source_device_id`;
- `offline=true`;
- `sync_status=PENDING`;
- payload imutável para retry idempotente.

## 6. Estoque sensível

Regra vigente:

```text
offline
→ FAIL_CLOSED
```

Exceção somente após procedimento físico/organizacional formalmente aprovado pelo HVB.

Não criar bypass técnico em software para “facilitar” emergência.

## 7. Break glass

`BREAK_GLASS` não é sinônimo de offline.

Mesmo um fluxo de emergência deve ter:

- profissional autenticado;
- segundo autorizador/fator conforme política;
- justificativa obrigatória;
- evento destacado;
- reconciliação posterior.

Se não houver infraestrutura capaz de registrar/validar isso com segurança, o procedimento deve ser físico e formal, não uma liberação silenciosa do software.

## 8. Reconciliação

Na volta da conectividade:

- sincronizar envelopes originais;
- preservar `command_id`;
- não recriar timestamps;
- servidor deduplica;
- conflitos não são sobrescritos silenciosamente;
- conflito vira pendência operacional/auditoria.

## 9. O que não implementar ainda

Sem decisão explícita:

- banco local definitivo;
- Redis/queue local;
- hardware Edge;
- VPN/LAN definitiva;
- credenciais reais offline;
- chaves reais;
- bypass de barreira sensível.

Este documento existe para impedir que o protótipo adote atalhos incompatíveis com contingência futura segura.
