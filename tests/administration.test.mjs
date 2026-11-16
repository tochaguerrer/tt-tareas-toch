import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("user administration validates scopes, concurrent edits, exclusive access and atomic transfer",async(t)=> {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid,provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon;`);
  for(const file of ["202611020001_access_foundation.sql","202611020002_user_administration.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  const ca="10000000-0000-0000-0000-000000000001", cb="10000000-0000-0000-0000-000000000002";
  const pa="20000000-0000-0000-0000-000000000001", pa2="20000000-0000-0000-0000-000000000002", pb="20000000-0000-0000-0000-000000000003";
  await db.query("insert into public.clients(id,name,client_type) values($1,'Client A','external'),($2,'Client B','external')",[ca,cb]);
  await db.query("insert into public.projects(id,client_id,name) values($1,$2,'A1'),($3,$2,'A2'),($4,$5,'B1')",[pa,ca,pa2,pb,cb]);
  const users=[];
  for(let i=0;i<5;i++) {
    const uid=`00000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`, email=`person${i}@example.test`;
    await db.query("insert into auth.users values($1,$2,now())",[uid,email]);
    await db.query("insert into auth.identities values($1,'google',$2)",[uid,JSON.stringify({email,email_verified:true})]);
    const {rows}=await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning *",[email,uid]);
    users.push({...rows[0],uid});
  }
  const assignments=[[{role:"toch_admin"}],[{role:"account_manager",client_id:ca}],[{role:"collaborator",project_id:pa}],[{role:"client_contract_admin",client_id:ca}],[{role:"client_contract_admin",client_id:cb}]];
  for(let i=0;i<5;i++) for(const g of assignments[i]) await db.query("insert into public.access_grants(account_id,role,client_id,project_id) values($1,$2,$3,$4)",[users[i].id,g.role,g.client_id??null,g.project_id??null]);
  async function asUser(i,fn) {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[users[i].uid,JSON.stringify({app_metadata:{provider:"google"}})]);
    try { return await fn(); } finally { await db.exec("reset role"); }
  }
  await t.test("project creation and hourly rates are exclusive to the TOCH administrator", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611150019_project_administration.sql", import.meta.url), "utf8"));
    const create = () => db.query(
      "select public.admin_create_project($1, 'Nuevo proyecto', 12.5, 80.25) as id", [ca],
    );
    await db.exec("begin");
    try {
      const { rows: [{ id }] } = await asUser(0, create);
      const rate = () => db.query("select hourly_rate from public.project_hourly_rates where project_id=$1", [id]);
      assert.equal((await asUser(0, rate)).rows[0].hourly_rate, "80.25");
      for (const i of [1, 3]) {
        await asUser(i, async () => {
          assert.deepEqual((await rate()).rows, []);
          assert.equal((await db.query("select budget_hours from public.projects where id=$1", [id])).rows[0].budget_hours, "12.5");
        });
      }
    } finally {
      await db.exec("rollback");
    }
    await asUser(1, () => assert.rejects(create(), /Access denied/));
  });
  const save=(id,email,active,grants,expected)=>db.query("select public.admin_save_account($1,$2,$3,$4,$5) as id",[id,email,active,JSON.stringify(grants),expected]);
  await t.test("only TOCH admin can save accounts or invoke transfer; legacy endpoint is closed",async()=> {
    for(const i of [1,2,3,4]) await asUser(i,async()=> {
      await assert.rejects(save(null,"new@example.test",true,[{role:"toch_admin"}],null),/Access denied/);
      await assert.rejects(db.query("select public.admin_transfer_administration($1,$2)",[users[1].id,users[1].updated_at]),/Access denied/);
      await assert.rejects(db.query("select public.admin_set_account_legacy($1,true,'[]')",[users[i].email]),/permission denied/i);
    });
  });
  await t.test("scope RLS isolates clients and restricts collaborator to assigned project",async()=> {
    for(const i of [1,2,3,4]) await asUser(i,async()=> {
      const clients=(await db.query("select id from public.clients")).rows.map(x=>x.id);
      assert.deepEqual(clients,[i===4?cb:ca]);
      const projects=(await db.query("select id from public.projects order by id")).rows.map(x=>x.id);
      assert.deepEqual(projects,i===2?[pa]:i===4?[pb]:[pa,pa2]);
      await assert.rejects(db.query("insert into public.clients(name,client_type) values('Escalation','external')"),/permission denied/i);
    });
  });
  await t.test("valid scoped account can be preauthorized without creating an Auth user",async()=> {
    await asUser(0,async()=> {
      const result=await save(null,"new@example.test",true,[{role:"account_manager",client_id:ca},{role:"collaborator",project_id:pa}],null);
      assert.ok(result.rows[0].id);
      const row=(await db.query("select auth_user_id from public.app_accounts where email='new@example.test'")).rows[0];
      assert.equal(row.auth_user_id,null);
      await assert.rejects(save(null,"new@example.test",true,[{role:"toch_admin"}],null),/already exists/);
    });
  });
  await t.test("invalid or inactive scopes and multiple contract clients fail atomically",async()=> {
    await db.query("update public.projects set is_active=false where id=$1",[pb]);
    await asUser(0,async()=> {
      for(const grants of [[{role:"account_manager",client_id:pb}],[{role:"collaborator",project_id:pb}],[{role:"client_contract_admin",client_id:ca},{role:"client_contract_admin",client_id:cb}],[{role:"toch_admin"},{role:"collaborator",project_id:pa}]]) {
        await assert.rejects(save(null,"invalid@example.test",true,grants,null));
        assert.equal((await db.query("select * from public.app_accounts where email='invalid@example.test'")).rows.length,0);
      }
    });
  });
  await t.test("stale edits cannot overwrite newer permissions and deactivation revokes access",async()=> {
    await asUser(0,async()=> {
      await save(users[2].id,users[2].email,false,assignments[2],users[2].updated_at);
      await assert.rejects(save(users[2].id,users[2].email,true,assignments[2],users[2].updated_at),/Account changed/);
    });
    await asUser(2,async()=>assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null));
  });
  await t.test("last active administrator cannot be deactivated or demoted, even via direct RPC",async()=> {
    await asUser(0,async()=> {
      for (const [active,grants] of [[false,assignments[0]],[true,[{role:"account_manager",client_id:ca}]],[false,[]]]) {
        await assert.rejects(save(users[0].id,users[0].email,active,grants,users[0].updated_at),/Last active administrator/);
      }
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access.grants[0].role,"toch_admin");
    });
  });
  await t.test("transfer rejects self and inactive recipients",async()=> {
    await asUser(0,async()=> {
      await assert.rejects(db.query("select public.admin_transfer_administration($1,$2)",[users[0].id,users[0].updated_at]),/Recipient/);
      const inactive=(await db.query("select * from public.app_accounts where id=$1",[users[2].id])).rows[0];
      await assert.rejects(db.query("select public.admin_transfer_administration($1,$2)",[inactive.id,inactive.updated_at]),/Recipient/);
    });
  });
  await t.test("transfer rolls back all role changes if a late audit operation fails",async()=> {
    await db.exec(`create function public.test_fail_transfer() returns trigger language plpgsql as $$begin if new.action='administration_transferred' then raise exception 'simulated audit failure'; end if; return new; end$$;
      create trigger test_transfer_failure before insert on public.access_audit for each row execute function public.test_fail_transfer();`);
    await asUser(0,()=>assert.rejects(db.query("select public.admin_transfer_administration($1,$2)",[users[1].id,users[1].updated_at]),/simulated audit failure/));
    assert.equal((await db.query("select is_active from public.app_accounts where id=$1",[users[0].id])).rows[0].is_active,true);
    assert.equal((await db.query("select role from public.access_grants where account_id=$1",[users[1].id])).rows[0].role,"account_manager");
    await db.exec("drop trigger test_transfer_failure on public.access_audit; drop function public.test_fail_transfer();");
  });
  await t.test("transfer grants target admin, disables source and audits both in one transaction",async()=> {
    await asUser(0,()=>db.query("select public.admin_transfer_administration($1,$2)",[users[1].id,users[1].updated_at]));
    await asUser(0,async()=>assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null));
    await asUser(1,async()=> {
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access.grants[0].role,"toch_admin");
      assert.equal((await db.query("select count(*)::int as n from public.access_audit where action='administration_transferred'")).rows[0].n,1);
    });
  });
});
