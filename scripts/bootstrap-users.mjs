#!/usr/bin/env node
/**
 * Create the three known Base44 accounts in Supabase Auth and seed the
 * Base44 -> Supabase owner mapping.
 *
 * Run from the repository root with a service-role/secret key available:
 *
 *   node --env-file=.env.import.local scripts/bootstrap-users.mjs
 *
 * New accounts receive a generated temporary password, written to
 * .import-credentials.local (gitignored). Existing accounts are never given a
 * new password; only their metadata/profile is corrected.
 */

import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    email: "jun@shake4u.com.br",
    full_name: "jun",
    coach_nome: "Jun Takakura",
    role: "admin",
    legacy_id: "6adb6fad5703905140c49faa",
  },
  {
    email: "joao.anonimo1969@gmail.com",
    full_name: "joao.anonimo1969",
    coach_nome: "Jesus Ramaldes",
    role: "user",
    legacy_id: "6adcccba140e64ef33f34a64",
  },
  {
    email: "jun.takakura@yahoo.com.br",
    full_name: "jun.takakura",
    coach_nome: "JunT",
    role: "user",
    legacy_id: "6ae21a5bc68b992627bc3925",
  },
];

const serviceOwner = {
  email: null,
  coach_nome: null,
  role: null,
  legacy_id: "service_d4b6c372-4cb7-4c4c-bb65-440e08045f73",
};

async function findAllUsers() {
  const found = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    found.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return found;
}

function temporaryPassword() {
  return `Bio-${randomBytes(18).toString("base64url")}`;
}

async function main() {
  const existing = await findAllUsers();
  const byEmail = new Map(existing.map((u) => [u.email?.toLowerCase(), u]));
  const credentials = [];
  const profiles = [];

  for (const target of users) {
    let authUser = byEmail.get(target.email.toLowerCase());

    if (!authUser) {
      const password = temporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email: target.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: target.full_name,
          coach_nome: target.coach_nome,
        },
      });
      if (error) throw new Error(`${target.email}: ${error.message}`);
      authUser = data.user;
      credentials.push(`${target.email}\t${password}`);
      console.log(`created ${target.email} (${authUser.id})`);
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...authUser.user_metadata,
          full_name: target.full_name,
          coach_nome: target.coach_nome,
        },
      });
      if (error) throw new Error(`${target.email}: ${error.message}`);
      authUser = data.user;
      console.log(`updated metadata for existing ${target.email} (${authUser.id})`);
    }

    profiles.push({
      id: authUser.id,
      email: target.email,
      full_name: target.full_name,
      coach_nome: target.coach_nome,
      role: target.role,
      legacy_base44_id: target.legacy_id,
    });
  }

  const { error: profileError } = await admin.from("profiles").upsert(profiles, {
    onConflict: "id",
  });
  if (profileError) throw profileError;

  const mapping = users.map((target, index) => ({
    legacy_id: target.legacy_id,
    email: target.email,
    coach_nome: target.coach_nome,
    role: target.role,
    new_user_id: profiles[index].id,
  }));
  mapping.push({
    legacy_id: serviceOwner.legacy_id,
    email: serviceOwner.email,
    coach_nome: serviceOwner.coach_nome,
    role: serviceOwner.role,
    new_user_id: null,
  });

  const { error: mappingError } = await admin.from("legacy_users").upsert(mapping, {
    onConflict: "legacy_id",
  });
  if (mappingError) throw mappingError;

  if (credentials.length) {
    appendFileSync(
      ".import-credentials.local",
      `# Generated ${new Date().toISOString()}. Delete after the users set their passwords.\n` +
        credentials.join("\n") +
        "\n",
    );
    console.log(`temporary passwords written to .import-credentials.local (${credentials.length})`);
  }

  const { data: verified, error: verifyError } = await admin
    .from("profiles")
    .select("id,email,full_name,coach_nome,role,legacy_base44_id")
    .order("email");
  if (verifyError) throw verifyError;
  console.table(verified);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
