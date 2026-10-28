#!/usr/bin/env node
/**
 * Import the Base44 CSV exports into the Supabase compatibility schema.
 *
 * Run from the repository root:
 *
 *   node --env-file=.env.import.local scripts/import-csv.mjs --dry-run
 *   node --env-file=.env.import.local scripts/import-csv.mjs
 *
 * The script is idempotent on legacy_id: rerunning updates the same rows.
 * It requires the schema migration and scripts/bootstrap-users.mjs to have
 * already been run.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

const DISCARDED_CLIENT = "6add22b0475af9fdf6d25200";
const MISSING_PROTEIN_CLIENT = "6ae148aab5f9eb09d2f1b6e7";
const DEFAULT_COACH = "Jun Takakura";

const EXPECTED = {
  clientes: 5319,
  avaliacoes: 10519,
  anamneses: 6,
  agendamentos: 7,
  calculos_proteina: 2,
  conjuntos_anamnese: 1,
};

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== "")) records.push(row);
    row = [];
  };

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch === "\r") {
      if (clean[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += ch;
    }
  }
  endRow();

  if (!records.length) return [];
  const headers = records.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return records.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function readCsv(file) {
  return parseCsv(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
// Value conversion
// ---------------------------------------------------------------------------

const trimmed = (value) => String(value ?? "").trim();
const text = (value) => {
  const raw = String(value ?? "");
  return raw.trim() === "" ? null : raw;
};
const trimmedText = (value) => {
  const raw = trimmed(value);
  return raw === "" ? null : raw;
};
const requiredText = (value, field) => {
  const raw = trimmed(value);
  if (!raw) throw new Error(`missing required field ${field}`);
  return raw;
};
const number = (value) => {
  const raw = trimmed(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`invalid number: ${value}`);
  return parsed;
};
const boolean = (value) => trimmed(value).toLowerCase() === "true";
const dateValue = (value) => {
  const raw = trimmed(value);
  return raw === "" || raw.startsWith("0000-00-00") ? null : raw;
};
const timestamp = (value) => {
  const raw = trimmed(value);
  return raw === "" ? null : raw;
};
const json = (value, field) => {
  const raw = trimmed(value);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`invalid JSON in ${field}: ${raw.slice(0, 120)}`);
  }
};
const jsonArray = (value, field) => {
  const parsed = json(value, field);
  if (parsed == null) return [];
  if (!Array.isArray(parsed)) throw new Error(`${field} is not a JSON array`);
  return parsed;
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = row[key];
    if (value == null) continue;
    if (seen.has(value)) throw new Error(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function assertCount(name, rows, expected) {
  if (rows.length !== expected) {
    throw new Error(`${name}: expected ${expected} rows, got ${rows.length}`);
  }
}

// ---------------------------------------------------------------------------
// Transform CSV rows
// ---------------------------------------------------------------------------

async function loadOwnerMap() {
  const { data, error } = await admin
    .from("legacy_users")
    .select("legacy_id,new_user_id");
  if (error) throw error;
  if (!data.length) {
    throw new Error("legacy_users is empty; run scripts/bootstrap-users.mjs first");
  }
  return new Map(data.map((row) => [row.legacy_id, row.new_user_id]));
}

function makeOwnerResolver(ownerMap) {
  const unknown = new Set();
  return {
    unknown,
    resolve(legacyId) {
      const id = trimmed(legacyId);
      if (!id) return null;
      if (!ownerMap.has(id)) {
        unknown.add(id);
        return null;
      }
      return ownerMap.get(id);
    },
  };
}

function buildData(ownerMap) {
  const owners = makeOwnerResolver(ownerMap);

  const clientRows = readCsv("Cliente_export.csv").filter(
    (row) => row.id !== DISCARDED_CLIENT,
  );
  const clientes = clientRows.map((row) => ({
    legacy_id: requiredText(row.id, "Cliente.id"),
    nome: requiredText(row.nome, "Cliente.nome"),
    codigo: trimmedText(row.codigo),
    email: text(row.email),
    notas: text(row.notas),
    whatsapp: trimmedText(row.whatsapp),
    data_nascimento: dateValue(row.data_nascimento),
    sexo: trimmedText(row.sexo),
    altura: number(row.altura),
    grupo: text(row.grupo),
    coach: trimmedText(row.coach),
    share_token: null,
    status: trimmedText(row.status) ?? "ativo",
    objetivo: text(row.objetivo),
    data_inicio: dateValue(row.data_inicio),
    proxima_avaliacao: dateValue(row.proxima_avaliacao),
    meta_proteica: json(row.meta_proteica, "Cliente.meta_proteica"),
    legacy_created_by_id: trimmedText(row.created_by_id),
    created_by_id: owners.resolve(row.created_by_id),
    created_date: timestamp(row.created_date),
    updated_date: timestamp(row.updated_date),
    is_sample: boolean(row.is_sample),
  }));

  const avaliacoes = readCsv("Avaliacao_export.csv")
    .filter((row) => row.cliente_id !== DISCARDED_CLIENT)
    .map((row) => ({
      legacy_id: requiredText(row.id, "Avaliacao.id"),
      legacy_cliente_id: trimmedText(row.cliente_id),
      cliente_id: null,
      coach: trimmedText(row.coach) ?? DEFAULT_COACH,
      data: requiredText(row.data, "Avaliacao.data"),
      tipo: trimmedText(row.tipo) ?? "acompanhamento",
      peso: number(row.peso),
      musculo: number(row.musculo),
      idade_corporal: number(row.idade_corporal),
      imc: number(row.imc),
      gordura_corporal: number(row.gordura_corporal),
      gordura_visceral: number(row.gordura_visceral),
      metabolismo_basal: number(row.metabolismo_basal),
      altura: number(row.altura),
      pescoco: number(row.pescoco),
      antebraco_direito: number(row.antebraco_direito),
      antebraco_esquerdo: number(row.antebraco_esquerdo),
      femur: number(row.femur),
      torax: number(row.torax),
      braco_direito: number(row.braco_direito),
      braco_esquerdo: number(row.braco_esquerdo),
      cintura: number(row.cintura),
      abdome: number(row.abdome),
      quadril: number(row.quadril),
      coxa_direita: number(row.coxa_direita),
      coxa_esquerda: number(row.coxa_esquerda),
      panturrilha_direita: number(row.panturrilha_direita),
      panturrilha_esquerda: number(row.panturrilha_esquerda),
      punho: number(row.punho),
      navy_gordura: number(row.navy_gordura),
      navy_massa_gorda: number(row.navy_massa_gorda),
      navy_massa_magra: number(row.navy_massa_magra),
      observacoes_cliente: text(row.observacoes_cliente),
      notas_profissional: text(row.notas_profissional),
      legacy_created_by_id: trimmedText(row.created_by_id),
      created_by_id: owners.resolve(row.created_by_id),
      created_date: timestamp(row.created_date),
      updated_date: timestamp(row.updated_date),
      is_sample: boolean(row.is_sample),
    }));

  const anamneses = readCsv("Anamnese_export.csv")
    .filter((row) => row.cliente_id !== DISCARDED_CLIENT)
    .map((row) => ({
      legacy_id: requiredText(row.id, "Anamnese.id"),
      legacy_cliente_id: trimmedText(row.cliente_id),
      cliente_id: null,
      nome: trimmedText(row.nome),
      whatsapp: trimmedText(row.whatsapp),
      data: dateValue(row.data),
      token: requiredText(row.token, "Anamnese.token"),
      status: trimmedText(row.status) ?? "pendente",
      perguntas: jsonArray(row.perguntas, "Anamnese.perguntas"),
      meta_proteica: json(row.meta_proteica, "Anamnese.meta_proteica"),
      respondida_em: timestamp(row.respondida_em),
      legacy_created_by_id: trimmedText(row.created_by_id),
      created_by_id: owners.resolve(row.created_by_id),
      created_date: timestamp(row.created_date),
      updated_date: timestamp(row.updated_date),
      is_sample: boolean(row.is_sample),
    }));

  const agendamentos = readCsv("Agendamento_export.csv")
    .filter((row) => row.cliente_id !== DISCARDED_CLIENT)
    .map((row) => ({
      legacy_id: requiredText(row.id, "Agendamento.id"),
      legacy_cliente_id: trimmedText(row.cliente_id),
      cliente_id: null,
      data: requiredText(row.data, "Agendamento.data"),
      hora: trimmedText(row.hora),
      tipo: trimmedText(row.tipo) ?? "avaliacao",
      status: trimmedText(row.status) ?? "agendado",
      google_event_id: trimmedText(row.google_event_id),
      google_link: trimmedText(row.google_link),
      legacy_created_by_id: trimmedText(row.created_by_id),
      created_by_id: owners.resolve(row.created_by_id),
      created_date: timestamp(row.created_date),
      updated_date: timestamp(row.updated_date),
      is_sample: boolean(row.is_sample),
    }));

  const calculos_proteina = readCsv("CalculoProteina_export.csv")
    .filter((row) => row.cliente_id !== DISCARDED_CLIENT)
    .map((row) => ({
      legacy_id: requiredText(row.id, "CalculoProteina.id"),
      legacy_cliente_id: trimmedText(row.cliente_id),
      cliente_id: null,
      nome: trimmedText(row.nome),
      whatsapp: trimmedText(row.whatsapp),
      coach: trimmedText(row.coach),
      token: requiredText(row.token, "CalculoProteina.token"),
      status: trimmedText(row.status) ?? "pendente",
      sexo: trimmedText(row.sexo),
      idade: number(row.idade),
      peso: number(row.peso),
      altura: number(row.altura),
      nivel_atividade: trimmedText(row.nivel_atividade),
      objetivo: trimmedText(row.objetivo),
      usa_glp1: trimmedText(row.usa_glp1) === "" ? null : boolean(row.usa_glp1),
      fator: number(row.fator),
      gramas_dia: number(row.gramas_dia),
      refeicao_min: number(row.refeicao_min),
      refeicao_max: number(row.refeicao_max),
      refeicoes: number(row.refeicoes),
      respondida_em: timestamp(row.respondida_em),
      legacy_created_by_id: trimmedText(row.created_by_id),
      created_by_id: owners.resolve(row.created_by_id),
      created_date: timestamp(row.created_date),
      updated_date: timestamp(row.updated_date),
      is_sample: boolean(row.is_sample),
    }));

  const conjuntos_anamnese = readCsv("ConjuntoAnamnese_export.csv").map((row) => ({
    legacy_id: requiredText(row.id, "ConjuntoAnamnese.id"),
    nome: requiredText(row.nome, "ConjuntoAnamnese.nome"),
    codigos: jsonArray(row.codigos, "ConjuntoAnamnese.codigos"),
    legacy_created_by_id: trimmedText(row.created_by_id),
    created_by_id: owners.resolve(row.created_by_id),
    created_date: timestamp(row.created_date),
    updated_date: timestamp(row.updated_date),
    is_sample: boolean(row.is_sample),
  }));

  return {
    clientes,
    avaliacoes,
    anamneses,
    agendamentos,
    calculos_proteina,
    conjuntos_anamnese,
    unknownOwners: owners.unknown,
  };
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function upsertAll(table, rows) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const { error } = await admin
      .from(table)
      .upsert(batch, { onConflict: "legacy_id" });
    if (error) {
      throw new Error(
        `${table} batch ${offset / BATCH_SIZE + 1}: ${error.message}` +
          (error.details ? ` (${error.details})` : "") +
          (error.hint ? ` (${error.hint})` : ""),
      );
    }
    console.log(`${table}: ${Math.min(offset + batch.length, rows.length)}/${rows.length}`);
  }
}

async function loadClientMap() {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("clientes")
      .select("legacy_id,id")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data) map.set(row.legacy_id, row.id);
    if (data.length < 1000) break;
  }
  return map;
}

async function count(table) {
  const { count: value, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return value;
}

async function verify(expected) {
  const actual = {};
  for (const table of Object.keys(expected)) actual[table] = await count(table);
  for (const [table, value] of Object.entries(expected)) {
    if (actual[table] !== value) {
      throw new Error(`${table}: expected ${value}, found ${actual[table]}`);
    }
  }

  const { count: blankCoach, error: coachError } = await admin
    .from("avaliacoes")
    .select("*", { count: "exact", head: true })
    .is("coach", null);
  if (coachError) throw coachError;
  if (blankCoach !== 0) {
    throw new Error(`avaliacoes still has blank coach: ${blankCoach}`);
  }

  const { count: joaoClients, error: joaoClientError } = await admin
    .from("clientes")
    .select("*", { count: "exact", head: true })
    .eq("legacy_id", DISCARDED_CLIENT);
  if (joaoClientError) throw joaoClientError;
  if (joaoClients !== 0) {
    throw new Error("discarded João Ninguém client is still present");
  }

  console.table(actual);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const ownerMap = await loadOwnerMap();
  const data = buildData(ownerMap);

  for (const [name, expected] of Object.entries(EXPECTED)) {
    assertCount(name, data[name], expected);
  }
  for (const name of Object.keys(EXPECTED)) {
    assertUnique(data[name], "legacy_id", `${name}.legacy_id`);
  }
  assertUnique(data.clientes, "codigo", "clientes.codigo");
  assertUnique(data.anamneses, "token", "anamneses.token");
  assertUnique(data.calculos_proteina, "token", "calculos_proteina.token");

  if (data.unknownOwners.size) {
    throw new Error(`unknown legacy owners: ${[...data.unknownOwners].join(", ")}`);
  }
  if (data.clientes.some((row) => row.share_token !== null)) {
    throw new Error("client share_token was not normalized to null");
  }
  if (data.clientes.filter((row) => row.coach === DEFAULT_COACH).length !== 85) {
    throw new Error("unexpected Jun Takakura client count");
  }
  if (data.clientes.filter((row) => row.coach === "Jesus Ramaldes").length !== 5234) {
    throw new Error("unexpected Jesus Ramaldes client count");
  }
  if (data.avaliacoes.some((row) => !row.coach)) {
    throw new Error("evaluation coach was not filled");
  }

  console.log("Validated CSV data:");
  for (const name of Object.keys(EXPECTED)) console.log(`  ${name}: ${data[name].length}`);
  console.log(`  legacy owners: ${ownerMap.size}`);

  if (DRY_RUN) {
    console.log("Dry run: no rows written.");
    return;
  }

  // Clients must exist before child rows. The child rows are built with null
  // client placeholders because their UUIDs are assigned by Postgres, so fill
  // them from the actual inserted rows before writing children.
  await upsertAll("clientes", data.clientes);
  const clientMap = await loadClientMap();

  const resolveClients = (rows, allowedMissing = new Set()) =>
    rows.map(({ legacy_cliente_id, ...row }) => {
      const legacyClient = trimmed(legacy_cliente_id);
      const mapped = legacyClient ? clientMap.get(legacyClient) ?? null : null;
      if (legacyClient && !mapped && !allowedMissing.has(legacyClient)) {
        throw new Error(`missing client ${legacyClient} for row ${row.legacy_id}`);
      }
      return { ...row, cliente_id: mapped };
    });

  const avaliacoes = resolveClients(data.avaliacoes);
  const anamneses = resolveClients(data.anamneses);
  const agendamentos = resolveClients(data.agendamentos);
  const calculos_proteina = resolveClients(
    data.calculos_proteina,
    new Set([MISSING_PROTEIN_CLIENT]),
  );

  await upsertAll("avaliacoes", avaliacoes);
  await upsertAll("anamneses", anamneses);
  await upsertAll("agendamentos", agendamentos);
  await upsertAll("calculos_proteina", calculos_proteina);
  await upsertAll("conjuntos_anamnese", data.conjuntos_anamnese);

  await verify(EXPECTED);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
