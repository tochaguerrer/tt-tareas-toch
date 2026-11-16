import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseAccess } from "../src/lib/auth/policy.ts";

test("authorization parser denies absent or malformed role scopes", () => {
  for (const value of [null, {}, {email:"a@example.test",grants:[]},
    {email:"a@example.test",grants:[{role:"unknown"}]},
    {email:"a@example.test",grants:[{role:"account_manager"}]},
    {email:"a@example.test",grants:[{role:"collaborator"}]},
    {email:"a@example.test",grants:[{role:"client_contract_admin"}]},
    {email:"a@example.test",grants:[{role:"toch_admin",client_id:"client-a"}]}]) {
    assert.equal(parseAccess(value), null);
  }
  assert.equal(parseAccess({email:"a@example.test",grants:[{role:"toch_admin"}]}).grants[0].role, "toch_admin");
});

test("migration enforces preauthorization, roles, RLS, revocation and client scope", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid, provider text, identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid(), auth.jwt() to authenticated, anon;
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/202611020001_access_foundation.sql", import.meta.url), "utf8"));
  const bootstrap = (await readFile(new URL("../supabase/bootstrap-admin.sql", import.meta.url), "utf8")).replace("ariel.guerrero@toch-la.com", "admin@example.test");
  await db.exec(bootstrap);
  await t.test("initial administrator comes from editable bootstrap and cannot be silently reseeded", async()=> {
    const {rows}=await db.query("select a.email, g.role from public.app_accounts a join public.access_grants g on g.account_id=a.id");
    assert.deepEqual(rows,[{email:"admin@example.test",role:"toch_admin"}]);
    await assert.rejects(db.exec(bootstrap),/already exists/);
    await db.exec("rollback");
  });
  const ids = Array.from({length:7},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);
  const emails=["admin@example.test","manager@example.test","worker@example.test","contract-a@example.test","contract-b@example.test","stranger@example.test","unverified@example.test"];
  for(let i=0;i<ids.length;i++) {
    await db.query("insert into auth.users values($1,$2,now())",[ids[i],emails[i]]);
    await db.query("insert into auth.identities values($1,'google',$2)",[ids[i],JSON.stringify({email:emails[i],email_verified:i!==6})]);
  }
  const a="10000000-0000-0000-0000-000000000001", b="10000000-0000-0000-0000-000000000002";
  const project="20000000-0000-0000-0000-000000000001";
  const grants=[ [{role:"toch_admin"}], [{role:"account_manager",client_id:a},{role:"collaborator",project_id:project}], [{role:"collaborator",project_id:project}], [{role:"client_contract_admin",client_id:a}], [{role:"client_contract_admin",client_id:b}] ];
  for(let i=0;i<5;i++) {
    const {rows}=await db.query("insert into public.app_accounts(email) values($1) on conflict(email) do update set is_active=true returning id",[emails[i]]);
    for(const g of grants[i]) await db.query("insert into public.access_grants(account_id,role,client_id,project_id) values($1,$2,$3,$4) on conflict do nothing",[rows[0].id,g.role,g.client_id??null,g.project_id??null]);
  }
  async function asUser(i, action, provider="google") {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",[ids[i],JSON.stringify({app_metadata:{provider}})]);
    try { return await action(); } finally { await db.exec("reset role"); }
  }
  for(let i=0;i<5;i++) await asUser(i,()=>db.query("select public.bind_my_account()"));
  await t.test("each authorized role obtains only its assigned grants", async()=> {
    for(let i=0;i<5;i++) await asUser(i,async()=> {
      const {rows}=await db.query("select public.get_my_access() as access");
      assert.equal(rows[0].access.email,emails[i]);
      assert.equal(rows[0].access.grants.length,grants[i].length);
      assert.ok(parseAccess(rows[0].access));
    });
  });
  await t.test("client A cannot read client B account or grants directly",async()=> {
    await asUser(3,async()=> {
      const accounts=await db.query("select email from public.app_accounts");
      assert.deepEqual(accounts.rows,[{email:emails[3]}]);
      const scopes=await db.query("select client_id from public.access_grants");
      assert.deepEqual(scopes.rows,[{client_id:a}]);
      assert.equal((await db.query("select * from public.access_audit")).rows.length,0);
    });
  });
  await t.test("manager and collaborator cannot self-promote or authorize users",async()=> {
    for(const i of [1,2,3]) await asUser(i,async()=> {
      await assert.rejects(db.query("update public.access_grants set role='toch_admin', client_id=null, project_id=null"),/permission denied/i);
      await assert.rejects(db.query("select public.admin_set_account($1,true,$2)",[emails[i],JSON.stringify([{role:"toch_admin"}])]),/Access denied/);
    });
  });
  await t.test("unknown users and form-only requesters have no application access",async()=> {
    await asUser(5,async()=> {
      await db.query("select public.bind_my_account()");
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null);
      assert.equal((await db.query("select * from public.app_accounts")).rows.length,0);
      await assert.rejects(db.query("select public.admin_set_account($1,true,$2)",[emails[5],JSON.stringify([{role:"toch_admin"}])]),/Access denied/);
    });
    await db.exec("set role anon");
    try { await assert.rejects(db.query("select public.get_my_access()"),/permission denied/i); } finally { await db.exec("reset role"); }
  });
  await t.test("Google identity must be verified and non-Google sessions fail closed",async()=> {
    await asUser(6,()=>assert.rejects(db.query("select public.bind_my_account()"),/Access denied/));
    await asUser(0,async()=>assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null),"email");
  });
  await t.test("only admin edits authorization; contract admin stays in one company",async()=> {
    await asUser(0,async()=> {
      await assert.rejects(db.query("select public.admin_set_account($1,true,$2)",[emails[3],JSON.stringify([{role:"client_contract_admin",client_id:a},{role:"client_contract_admin",client_id:b}])]),/unique/i);
      await assert.rejects(db.query("select public.admin_set_account($1,true,$2)",[emails[3],JSON.stringify([{role:"client_contract_admin",client_id:a},{role:"account_manager",client_id:b}])]),/not approved/);
      await db.query("select public.admin_set_account($1,false,'[]')",[emails[2]]);
    });
    await asUser(2,async()=> {
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null);
      assert.equal((await db.query("select * from public.access_grants")).rows.length,0);
    });
    await asUser(0,async()=> {
      assert.ok((await db.query("select * from public.access_audit where action='authorization_changed'")).rows.length>0);
    });
  });
  await t.test("revoked role removes access without relying on token expiry",async()=> {
    await db.query("delete from public.access_grants where account_id=(select id from public.app_accounts where email=$1)",[emails[1]]);
    await asUser(1,async()=>assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null));
  });
});
