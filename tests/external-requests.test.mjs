import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {parseAccess} from "../src/lib/auth/policy.ts";
import {normalizeDomain,requestInput} from "../src/lib/requests/input.ts";

test("domain and request inputs reject URLs, wildcards, malformed domains and blank requests",()=>{
  assert.equal(normalizeDomain(" EMPRESA.TEST "),"empresa.test");
  for(const domain of ["@empresa.test","https://empresa.test","*.empresa.test","empresa","a..test","-a.test","a-.test","a.test/path","a test.com"])assert.throws(()=>normalizeDomain(domain));
  const form=new FormData();form.set("title","  Consulta  ");form.set("description"," Detalle ");
  assert.deepEqual(requestInput(form),{title:"Consulta",description:"Detalle"});
  form.set("description"," ");assert.throws(()=>requestInput(form));
  assert.equal(parseAccess({email:"a@empresa.test",grants:[],requester_client:{id:"10000000-0000-0000-0000-000000000001",name:"A"}}).grants.length,0);
  for(const requester_client of [true,{}, {id:"bad",name:"A"},{id:"10000000-0000-0000-0000-000000000001",name:""}])assert.equal(parseAccess({email:"a@empresa.test",grants:[],requester_client}),null);
});

test("domain requester migration enforces verified identity, client binding and revocation",async(t)=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid,provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  for(const name of ["202611020001_access_foundation","202611020002_user_administration","202611020003_external_requests"])
    await db.exec(await readFile(new URL("../supabase/migrations/"+name+".sql",import.meta.url),"utf8"));
  const emails=["admin@toch.test","person@empresa.test","person@otra.test","person@sub.empresa.test","unverified@empresa.test","disabled@empresa.test","contract@empresa.test"];
  const ids=emails.map((_,i)=>"00000000-0000-0000-0000-"+String(i+1).padStart(12,"0"));
  for(let i=0;i<emails.length;i++){
    await db.query("insert into auth.users values($1,$2,now())",[ids[i],emails[i]]);
    await db.query("insert into auth.identities values($1,'google',$2)",[ids[i],JSON.stringify({email:emails[i],email_verified:i!==4})]);
  }
  const admin=(await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",[emails[0],ids[0]])).rows[0].id;
  await db.query("insert into public.access_grants(account_id,role) values($1,'toch_admin')",[admin]);
  async function asUser(i,fn,provider="google"){
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[i],JSON.stringify({app_metadata:{provider}})]);
    try{return await fn();}finally{await db.exec("reset role");}
  }
  let a,b,domain;
  await asUser(0,async()=>{
    a=(await db.query("select public.admin_create_client('A','external') as id")).rows[0].id;
    b=(await db.query("select public.admin_create_client('B','external') as id")).rows[0].id;
    domain=(await db.query("select public.admin_save_domain(null,$1,'EMPRESA.TEST',true,null) as id",[a])).rows[0].id;
  });
  const submit=(id,title="Consulta",description="Detalle")=>db.query("select public.submit_external_request($1,$2,$3) as id",[id,title,description]);
  const requestId="30000000-0000-0000-0000-000000000001";
  await t.test("verified domain grants requester access without creating a management account",async()=>{
    await asUser(1,async()=>{
      await db.query("select public.bind_my_account()");
      const access=parseAccess((await db.query("select public.get_my_access() as access")).rows[0].access);
      assert.deepEqual(access.requester_client,{id:a,name:"A"});assert.deepEqual(access.grants,[]);
      assert.equal((await db.query("select * from public.app_accounts")).rows.length,0);
      assert.equal((await db.query("select * from public.clients")).rows.length,0);
      assert.equal((await db.query("select * from public.client_domains")).rows.length,0);
      await assert.rejects(db.query("select public.admin_create_client('Escalation','external')"),/Access denied/);
      await assert.rejects(db.query("select public.admin_save_domain(null,$1,'otra.test',true,null)",[a]),/Access denied/);
      await assert.rejects(db.query("insert into public.client_domains(client_id,domain) values($1,'evil.test')",[a]),/permission denied/i);
    });
    assert.equal((await db.query("select count(*)::int as n from public.app_accounts")).rows[0].n,1);
  });
  await t.test("exact domain mapping rejects unknown, subdomain, unverified and non-Google identities",async()=>{
    for(const i of [2,3,4])await asUser(i,async()=>{
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null);
      await assert.rejects(submit(requestId),/Access denied/);
    });
    await asUser(1,()=>assert.rejects(submit(requestId),/Access denied/),"email");
    await db.exec("set role anon");
    try{await assert.rejects(submit(requestId),/permission denied/i);}finally{await db.exec("reset role");}
  });
  await t.test("submission derives client and sender, is idempotent and exposes no tickets to requester",async()=>{
    await asUser(1,async()=>{
      assert.equal((await submit(requestId)).rows[0].id,requestId);
      assert.equal((await submit(requestId)).rows[0].id,requestId);
      assert.equal((await db.query("select * from public.incoming_requests")).rows.length,0);
      await assert.rejects(db.query("insert into public.incoming_requests(id,client_id,requester_user_id,requester_email,title,description) values($1,$2,$3,'fake@otra.test','X','X')",[requestId,b,ids[1]]),/permission denied/i);
      await assert.rejects(submit("30000000-0000-0000-0000-000000000002"," ","X"),/Invalid request/);
    });
    const rows=(await db.query("select client_id,requester_user_id,requester_email from public.incoming_requests")).rows;
    assert.deepEqual(rows,[{client_id:a,requester_user_id:ids[1],requester_email:emails[1]}]);
  });
  await t.test("one active domain cannot authorize two clients, and invalid domains are rejected in SQL",async()=>{
    await asUser(0,async()=>{
      await assert.rejects(db.query("select public.admin_save_domain(null,$1,'empresa.test',true,null)",[b]),/duplicate key/i);
      for(const value of ["*.empresa.test","https://empresa.test","a..test"])await assert.rejects(db.query("select public.admin_save_domain(null,$1,$2,true,null)",[b,value]));
    });
  });
  await t.test("individual deactivation overrides domain eligibility",async()=>{
    await db.query("insert into public.app_accounts(email,is_active) values($1,false)",[emails[5]]);
    await asUser(5,async()=>{
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null);
      await assert.rejects(submit(requestId),/Access denied/);
    });
  });
  await t.test("contract admin and requester coexist without another account or extra management grants",async()=>{
    const account=(await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",[emails[6],ids[6]])).rows[0].id;
    await db.query("insert into public.access_grants(account_id,role,client_id) values($1,'client_contract_admin',$2)",[account,a]);
    await asUser(6,async()=>{
      const access=parseAccess((await db.query("select public.get_my_access() as access")).rows[0].access);
      assert.equal(access.grants.length,1);assert.equal(access.requester_client.id,a);
      assert.equal((await db.query("select * from public.incoming_requests")).rows.length,1);
      await assert.rejects(db.query("update public.incoming_requests set title='Changed'"),/permission denied/i);
    });
  });
  await t.test("revoking domain immediately blocks sessions and stale edits; client deactivation also revokes",async()=>{
    const version=(await db.query("select updated_at from public.client_domains where id=$1",[domain])).rows[0].updated_at;
    await asUser(0,async()=>{
      await db.query("select public.admin_save_domain($1,$2,'empresa.test',false,$3)",[domain,a,version]);
      await assert.rejects(db.query("select public.admin_save_domain($1,$2,'empresa.test',true,$3)",[domain,a,version]),/Domain changed/);
    });
    await asUser(1,async()=>{
      assert.equal((await db.query("select public.get_my_access() as access")).rows[0].access,null);
      await assert.rejects(submit(requestId),/Access denied/);
    });
    await db.query("update public.client_domains set is_active=true where id=$1",[domain]);
    await db.query("update public.clients set is_active=false where id=$1",[a]);
    await asUser(1,()=>assert.rejects(submit(requestId),/Access denied/));
    assert.equal((await db.query("select count(*)::int as n from public.incoming_requests")).rows[0].n,1);
  });
});

