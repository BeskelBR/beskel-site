import { createPilotClient, pilotError } from "./pilot-api.js";

const $ = (id) => document.getElementById(`pilot-${id}`);
const forms = {
  patient: $("patient-form"),
  episode: $("episode-form"),
  record: $("record-form"),
};
let client, context, patient, episode, pending;
let patients = [],
  episodes = [];
let patientCursor = null,
  episodeCursor = null,
  recordCursor = null;
let epoch = 0,
  busy = false,
  ready = false;
const credentials = () => ({
  base: (localStorage.getItem("hvb-api-base") || location.origin).replace(
    /\/$/,
    "",
  ),
  token: sessionStorage.getItem("hvb-access-token") || "",
});
const identity = () => JSON.stringify(credentials());
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const dateLabel = (value) => new Date(value).toLocaleString("pt-BR");
function status(text, error = false) {
  $("status").textContent = text;
  $("status").dataset.error = String(error);
}
function sync() {
  $("controls").disabled = !ready || busy || !!pending;
  $("start").disabled = busy || !!pending;
  $("retry").hidden = !pending;
  $("retry").disabled = busy;
  forms.episode.querySelector("button").disabled = !patient;
  forms.record.querySelector("button").disabled =
    !episode || !!episode.encerrado_em;
  $("refresh-records").disabled = !episode;
}
function reset() {
  epoch++;
  client = context = patient = episode = pending = undefined;
  busy = false;
  ready = false;
  patients = [];
  episodes = [];
  patientCursor = episodeCursor = recordCursor = null;
  for (const form of Object.values(forms)) form.reset();
  for (const name of ["unit", "patient", "episode", "records"])
    $(name).replaceChildren();
  for (const name of ["more", "episodes-more", "records-more"])
    $(name).hidden = true;
  $("count").textContent = "";
  $("context").textContent = "Nenhum paciente selecionado.";
  status("Carregue o atendimento para começar.");
  sync();
}
function current(version) {
  return version === epoch && context === identity();
}
async function run(work) {
  if (busy || pending) return;
  if (client && context !== identity()) reset();
  busy = true;
  sync();
  const version = epoch;
  try {
    await work(version);
  } catch (error) {
    if (current(version) || !client) status(pilotError(error), true);
  } finally {
    if (version === epoch) {
      busy = false;
      sync();
    }
  }
}
function option(select, value, label) {
  select.add(new Option(label, value));
}
function showPatients() {
  const query = $("search").value.trim().toLocaleLowerCase("pt-BR");
  $("patient").replaceChildren();
  option($("patient"), "", "Selecione um paciente");
  const filtered = patients.filter(
    (p) =>
      p.id === patient?.id ||
      `${p.nome} ${p.especie_codigo} ${p.id}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
  );
  for (const p of filtered)
    option($("patient"), p.id, `${p.nome} · ${p.especie_codigo} · ${p.id}`);
  $("patient").value = patient?.id || "";
  $("count").textContent =
    `${patients.length} pacientes carregados. ${patientCursor ? "Há mais páginas; o filtro vale apenas para os carregados." : "Lista completa carregada."}`;
  $("more").hidden = !patientCursor;
}
function query(path, params) {
  return `${path}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined))}`;
}
async function loadPatients(version, more = false) {
  const result = await client.read(
    query("/v1/pacientes", { limit: 100, cursor: more ? patientCursor : null }),
  );
  if (!current(version)) return;
  patients = [
    ...new Map(
      [...(more ? patients : []), ...result.items].map((p) => [p.id, p]),
    ).values(),
  ];
  patientCursor = result.next_cursor;
  showPatients();
}
function showEpisodes() {
  $("episode").replaceChildren();
  option(
    $("episode"),
    "",
    episodes.length ? "Selecione um episódio" : "Nenhum episódio carregado",
  );
  for (const e of episodes)
    option(
      $("episode"),
      e.id,
      `${e.tipo} · ${dateLabel(e.admitido_em)} · ${e.encerrado_em ? "encerrado" : e.alta_clinica_em ? "alta clínica" : "aberto"} · ${e.id}`,
    );
  $("episode").value = episode?.id || "";
  $("episodes-more").hidden = !episodeCursor;
  $("context").textContent = patient
    ? `${patient.nome} · ${patient.id} | Unidade: ${$("unit").selectedOptions[0]?.textContent || "não selecionada"}${episode ? ` | Episódio: ${episode.id}` : " | Selecione ou abra um episódio."}`
    : "Nenhum paciente selecionado.";
  sync();
}
function clearEpisode() {
  episode = undefined;
  episodes = [];
  episodeCursor = recordCursor = null;
  forms.record.reset();
  forms.record.elements.ocorrida_em.value = localNow();
  $("records").replaceChildren();
  $("records-more").hidden = true;
  showEpisodes();
}
async function loadEpisodes(version, more = false) {
  if (!patient || !$("unit").value) return;
  const result = await client.read(
    query("/v1/episodios", {
      unidade_id: $("unit").value,
      paciente_id: patient.id,
      limit: 100,
      cursor: more ? episodeCursor : null,
    }),
  );
  if (!current(version)) return;
  episodes = [
    ...new Map(
      [...(more ? episodes : []), ...result.items].map((e) => [e.id, e]),
    ).values(),
  ];
  episodeCursor = result.next_cursor;
  showEpisodes();
}
async function loadRecords(version, more = false) {
  if (!episode) return;
  const result = await client.read(
    query("/v1/prontuario/versoes", {
      unidade_id: $("unit").value,
      paciente_id: patient.id,
      episodio_id: episode.id,
      limit: 25,
      cursor: more ? recordCursor : null,
    }),
  );
  if (!current(version)) return;
  if (!more) $("records").replaceChildren();
  recordCursor = result.next_cursor;
  $("records-more").hidden = !recordCursor;
  if (!result.items.length && !more)
    $("records").textContent = "Nenhum registro neste episódio.";
  for (const item of result.items) {
    const row = document.createElement("article"),
      label = document.createElement("p"),
      button = document.createElement("button"),
      content = document.createElement("pre");
    row.className = "pilot-record";
    label.textContent = `${item.tipo} · ${dateLabel(item.ocorrida_em)} · versão ${item.versao} · ${item.estado} · ${item.atual ? "atual" : "histórica"} · Autor ${item.autor_id}`;
    button.type = "button";
    button.className = "secondary-btn";
    button.textContent = "Ler conteúdo";
    button.addEventListener("click", () =>
      run(async (v) => {
        const data = await client.read(
          query(`/v1/prontuario/versoes/${item.id}`, {
            unidade_id: $("unit").value,
          }),
        );
        if (current(v)) {
          content.textContent = data.conteudo;
          button.hidden = true;
        }
      }),
    );
    row.append(label, button, content);
    $("records").append(row);
  }
}
$("start").addEventListener("click", () => {
  reset();
  run(async (v) => {
    const auth = credentials();
    if (!auth.token)
      throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    context = identity();
    client = createPilotClient(auth);
    status("Carregando contexto…");
    await client.read("/v1/me");
    const saved = localStorage.getItem("hvb-unit-id");
    let cursor = null;
    do {
      let result;
      try {
        result = await client.read(
          query("/v1/unidades", { limit: 100, cursor }),
        );
      } catch (error) {
        // Listing units is administrative. The existing DEV login may supply
        // a unit; every subsequent read/write still authorizes it on the API.
        if (error.status !== 403 || !saved || !/^[0-9a-f-]{36}$/i.test(saved))
          throw error;
        if (!current(v)) return;
        option(
          $("unit"),
          saved,
          `Unidade configurada no acesso DEV · ${saved}`,
        );
        break;
      }
      if (!current(v)) return;
      for (const u of result.items)
        option($("unit"), u.id, `${u.nome} · ${u.id}`);
      cursor = result.next_cursor;
    } while (cursor);
    if ([...$("unit").options].some((o) => o.value === saved))
      $("unit").value = saved;
    forms.episode.elements.admitido_em.value = localNow();
    forms.record.elements.ocorrida_em.value = localNow();
    await loadPatients(v);
    if (current(v)) {
      ready = true;
      status("Selecione um paciente ou cadastre um paciente fictício.");
    }
  });
});
$("search").addEventListener("input", showPatients);
$("more").addEventListener("click", () => run((v) => loadPatients(v, true)));
$("episodes-more").addEventListener("click", () =>
  run((v) => loadEpisodes(v, true)),
);
$("records-more").addEventListener("click", () =>
  run((v) => loadRecords(v, true)),
);
$("refresh-records").addEventListener("click", () =>
  run((v) => loadRecords(v)),
);
$("patient").addEventListener("change", () =>
  run(async (v) => {
    patient = patients.find((p) => p.id === $("patient").value);
    clearEpisode();
    await loadEpisodes(v);
  }),
);
$("unit").addEventListener("change", () =>
  run(async (v) => {
    clearEpisode();
    await loadEpisodes(v);
  }),
);
$("episode").addEventListener("change", () =>
  run(async (v) => {
    episode = episodes.find((e) => e.id === $("episode").value);
    forms.record.reset();
    forms.record.elements.ocorrida_em.value = localNow();
    $("records").replaceChildren();
    $("records-more").hidden = true;
    showEpisodes();
    await loadRecords(v);
  }),
);
function instant(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()) || date.getTime() > Date.now())
    throw Object.assign(new Error("horario_invalido_ou_futuro"), {
      status: 400,
    });
  return date.toISOString();
}
async function transmit(version) {
  const active = pending;
  let result;
  try {
    result = await client.send(active.intent);
  } catch (error) {
    if (!current(version)) return;
    if (error.status && !error.uncertain) pending = undefined;
    status(
      `${pilotError(error)}${pending ? " O envio pode ter sido gravado. Use Reconsultar o envio com segurança; os mesmos dados serão reenviados sem duplicação." : " Nada foi confirmado por este envio."}`,
      true,
    );
    return;
  }
  if (!current(version)) return;
  pending = undefined;
  // Receipt is applied before any read: a refresh failure must never re-send a committed action.
  forms[active.kind].reset();
  if (active.kind === "patient") {
    patient = { ...active.body, id: result.id };
    patients.push(patient);
    $("search").value = "";
    showPatients();
    clearEpisode();
  } else if (active.kind === "episode") {
    episode = { ...active.body, id: result.id, encerrado_em: null };
    episodes.unshift(episode);
    showEpisodes();
  }
  forms.episode.elements.admitido_em.value = localNow();
  forms.record.elements.ocorrida_em.value = localNow();
  status(
    `Gravado com sucesso: ${result.id}. ${active.kind === "patient" ? "Paciente selecionado; abra ou selecione um episódio." : active.kind === "episode" ? "Episódio selecionado; registre a evolução." : "Evolução registrada."}`,
  );
  if (active.kind !== "patient") {
    try {
      await loadRecords(version);
    } catch (error) {
      if (current(version))
        status(
          `Gravado com sucesso: ${result.id}. A atualização da lista falhou. ${pilotError(error)} Use Atualizar registros.`,
          true,
        );
    }
  }
}
for (const [kind, form] of Object.entries(forms))
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    run(async (v) => {
      if (!client)
        throw Object.assign(new Error("sessao_ausente"), { status: 401 });
      let path, body;
      if (kind === "patient") {
        path = "/v1/pacientes";
        body = { ...fields, nome: fields.nome.trim() };
      } else {
        if (!patient || !$("unit").value)
          throw Object.assign(new Error("selecione_paciente_e_unidade"), {
            status: 400,
          });
        if (kind === "episode") {
          path = "/v1/episodios";
          body = {
            ...fields,
            paciente_id: patient.id,
            unidade_id: $("unit").value,
            admitido_em: instant(fields.admitido_em),
          };
        } else {
          if (!episode || episode.encerrado_em)
            throw Object.assign(new Error("selecione_episodio_aberto"), {
              status: 400,
            });
          path = "/v1/prontuario/evolucoes";
          body = {
            ...fields,
            unidade_id: $("unit").value,
            paciente_id: patient.id,
            episodio_id: episode.id,
            ocorrida_em: instant(fields.ocorrida_em),
            referencia: crypto.randomUUID(),
            simulacao: true,
            confirmacao_humana: true,
          };
        }
      }
      pending = { kind, body, intent: client.prepare(path, body) };
      status("Enviando…");
      sync();
      await transmit(v);
    });
  });
$("retry").addEventListener("click", async () => {
  if (!pending || busy) return;
  if (context !== identity()) {
    reset();
    return;
  }
  busy = true;
  sync();
  const version = epoch;
  try {
    await transmit(version);
  } finally {
    if (version === epoch) {
      busy = false;
      sync();
    }
  }
});
document.getElementById("logout-btn").addEventListener("click", reset);
window.addEventListener("beforeunload", (event) => {
  if (pending) {
    event.preventDefault();
    event.returnValue = "";
  }
});
reset();
