import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {validateDocument,attachmentType,maxFileBytes} from "../src/lib/requests/rich-content.ts";
const assetId="40000000-0000-0000-0000-000000000001";
const doc={type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Prueba",marks:[{type:"textStyle",attrs:{fontFamily:"Georgia",color:"#ff0000"}}]}]},{type:"image",attrs:{attachmentId:assetId,src:"blob:local-preview",alt:"Captura"}}]};
test("rich content retains approved fonts, colors and image references without unsafe HTML",()=>{
  const result=validateDocument(doc,[assetId]);
  assert.equal(result.document.content[0].content[0].marks[0].attrs.fontFamily,"Georgia");
  assert.equal(result.document.content[1].attrs.src,"attachment:"+assetId);
  assert.equal(result.text,"Prueba");
  assert.throws(()=>validateDocument(doc,[]));
  for(const invalid of [{type:"script"},{type:"doc",content:[{type:"text",text:"X",marks:[{type:"link",attrs:{href:"javascript:alert(1)"}}]}]},{type:"doc",content:[]}])assert.throws(()=>validateDocument(invalid,[]));
  assert.equal(attachmentType("Prueba.docx",100),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  for(const name of ["x.html","x.svg","x.exe"])assert.throws(()=>attachmentType(name,100));
  assert.throws(()=>attachmentType("x.png",maxFileBytes+1));
});

test("private attachments and rich requests enforce ownership, scope, upload completion and immutability",async(t)=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid,provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage to anon,authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  for(const name of ["202611020001_access_foundation","202611020002_user_administration","202611020003_external_requests","202611030004_request_rich_content"]){
    const sql=await readFile(new URL("../supabase/migrations/"+name+".sql",import.meta.url),"utf8");
    try{await db.exec(sql);}catch(error){throw new Error(name+": "+error.message+" at "+error.position+" "+sql.slice(Number(error.position)-150,Number(error.position)+150));}
  }
  const a="10000000-0000-0000-0000-000000000001",b="10000000-0000-0000-0000-000000000002",request="30000000-0000-0000-0000-000000000001";
  await db.query("insert into public.clients(id,name,client_type) values($1,'A','external'),($2,'B','external')",[a,b]);
  await db.query("insert into public.client_domains(client_id,domain) values($1,'a.test'),($2,'b.test')",[a,b]);
  const emails=["requester@a.test","other@a.test","requester@b.test","manager@toch.test","contract@b.test"];
  const ids=emails.map((_,i)=>"00000000-0000-0000-0000-"+String(i+1).padStart(12,"0"));
  for(let i=0;i<emails.length;i++){
    await db.query("insert into auth.users values($1,$2,now())",[ids[i],emails[i]]);
    await db.query("insert into auth.identities values($1,'google',$2)",[ids[i],JSON.stringify({email:emails[i],email_verified:true})]);
    if(i>=3){const account=(await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",[emails[i],ids[i]])).rows[0].id;
      await db.query("insert into public.access_grants(account_id,role,client_id) values($1,$2,$3)",[account,i===3?"account_manager":"client_contract_admin",i===3?a:b]);}
  }
  async function asUser(i,fn,claims={app_metadata:{provider:"google"}}){
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[i],JSON.stringify(claims)]);
    try{return await fn();}finally{await db.exec("reset role");}
  }
  const reserve=(id=assetId,bytes=100)=>db.query("select public.reserve_request_attachment($1,$2,'capture.png','image/png',$3) as path",[id,request,bytes]);
  const submit=(document=validateDocument(doc,[assetId]).document,assets=[assetId])=>db.query("select public.submit_external_request_rich($1,'Consulta',$2,$3) as id",[request,JSON.stringify(document),assets]);
  let path;
  await t.test("only an eligible requester can reserve uploads; bucket is private and scoped paths cannot be forged",async()=>{
    assert.equal((await db.query("select public from storage.buckets")).rows[0].public,false);
    await asUser(3,()=>assert.rejects(reserve(),/Access denied/));
    await asUser(0,async()=>{
      path=(await reserve()).rows[0].path;
      assert.equal((await reserve()).rows[0].path,path);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('request-attachments','arbitrary/path','{}')"),/row-level security/i);
      await assert.rejects(reserve("40000000-0000-0000-0000-000000000002",10485761),/Invalid attachment/);
    });
    await asUser(1,()=>assert.rejects(reserve(),/Attachment conflict/));
    await asUser(2,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('request-attachments',$1,'{}')",[path]),/row-level security/i));
  });
  await t.test("unuploaded and mismatched objects cannot be attached",async()=>{
    await asUser(0,()=>assert.rejects(submit(),/Attachment not uploaded/));
    await asUser(0,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('request-attachments',$1,$2)",[path,JSON.stringify({mimetype:"image/png",size:99})]));
    await asUser(0,()=>assert.rejects(submit(),/Attachment not uploaded/));
    await db.query("update storage.objects set metadata=$1 where name=$2",[JSON.stringify({mimetype:"image/png",size:100}),path]);
  });
  await t.test("database rejects unsafe rich nodes and dangling images even through direct API",async()=>{
    await asUser(0,async()=>{
      await assert.rejects(submit({type:"doc",content:[{type:"text",text:"X",marks:[{type:"textStyle",attrs:{color:"url(javascript:alert(1))"}}]}]}),/Invalid request/);
      await assert.rejects(submit({type:"doc",content:[{type:"image",attrs:{attachmentId:assetId,src:"https://tracker.test/x"}}]}),/Invalid request/);
      await assert.rejects(submit(validateDocument(doc,[assetId]).document,[]),/Invalid image/);
    });
  });
  await t.test("only owner may discard unsubmitted files; metadata cannot be removed while object exists",async()=>{
    const temporary="40000000-0000-0000-0000-000000000009";
    let temporaryPath;
    await asUser(0,async()=>{
      temporaryPath=(await reserve(temporary)).rows[0].path;
      await db.query("insert into storage.objects(bucket_id,name,metadata) values('request-attachments',$1,$2)",[temporaryPath,JSON.stringify({mimetype:"image/png",size:100})]);
      await assert.rejects(db.query("select public.discard_request_attachment($1)",[temporary]),/Delete draft object first/);
    });
    await asUser(1,()=>assert.rejects(db.query("select public.discard_request_attachment($1)",[temporary]),/Access denied/));
    await asUser(0,async()=>{
      await db.query("delete from storage.objects where name=$1",[temporaryPath]);
      await db.query("select public.discard_request_attachment($1)",[temporary]);
      assert.equal((await db.query("select * from public.request_attachments where id=$1",[temporary])).rows.length,0);
    });
  });
  await t.test("commits document and attachments atomically; retry does not duplicate or overwrite",async()=>{
    await asUser(0,async()=>{
      assert.equal((await submit()).rows[0].id,request);
      const migration=await readFile(new URL("../supabase/migrations/202611030005_request_reference.sql",import.meta.url),"utf8");
      await db.exec("reset role");
      await db.exec(migration);
      await db.exec("set role authenticated");
      const reference=await db.query("select public.submit_external_request_with_reference($1,'Consulta',$2,$3) as reference",[request,JSON.stringify(validateDocument(doc,[assetId]).document),[assetId]]);
      assert.equal(reference.rows[0].reference,"000001");
      assert.equal((await submit()).rows[0].id,request);
      assert.equal((await db.query("select * from public.request_attachments")).rows.length,0);
      assert.equal((await db.query("select * from storage.objects")).rows.length,0);
      await assert.rejects(reserve("40000000-0000-0000-0000-000000000003"),/already submitted/);
      await assert.rejects(db.query("select public.discard_request_attachment($1)",[assetId]),/Access denied/);
      assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,0);
    });
    const stored=(await db.query("select description_document from public.incoming_requests")).rows;
    assert.equal(stored.length,1);assert.equal(stored[0].description_document.content[1].attrs.src,"attachment:"+assetId);
    assert.deepEqual(stored[0].description_document.content[0].content[0].marks[0].attrs,{fontFamily:"Georgia",color:"#ff0000"});
    assert.equal((await db.query("select submitted from public.request_attachments")).rows[0].submitted,true);
  });
  await t.test("management reads only its own client files; requesters have no ticket browsing or overwrite",async()=>{
    await asUser(3,async()=>{
      assert.equal((await db.query("select * from public.request_attachments")).rows.length,1);
      assert.equal((await db.query("select * from storage.objects")).rows.length,1);
      await assert.rejects(db.query("update storage.objects set name='overwrite'"),/permission denied/i);
    });
    for(const i of [1,2,4])await asUser(i,async()=>{
      assert.equal((await db.query("select * from public.request_attachments")).rows.length,0);
      assert.equal((await db.query("select * from storage.objects")).rows.length,0);
    });
  });
  await t.test("conversion rejects unauthorized actors and foreign projects, and retries reuse the task", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611030006_convert_request.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202611150018_convert_request_existing_project.sql", import.meta.url), "utf8"));
    const project = (await db.query(
      "insert into public.projects (client_id,name) values ($1,'Proyecto de prueba') returning id", [a],
    )).rows[0].id;
    const foreign = (await db.query(
      "insert into public.projects (client_id,name) values ($1,'Otro proyecto') returning id", [b],
    )).rows[0].id;
    const convert = (projectId, name) => db.query(
      "select public.convert_request_to_task($1,$2,$3) as number", [request, projectId, name],
    );
    await asUser(0, () => assert.rejects(convert(null, "Proyecto"), /Solicitud no disponible/));
    await asUser(3, async () => {
      await assert.rejects(convert(foreign, null), /Proyecto no disponible/);
      await assert.rejects(convert(null, "Proyecto nuevo"), /Seleccioná un proyecto existente/);
      const first = await convert(project, null);
      assert.deepEqual(await convert(project, null), first);
      const tasks = (await db.query("select source_request_id,status from public.tasks")).rows;
      assert.deepEqual(tasks, [{ source_request_id: request, status: "pending" }]);
    });
    assert.equal((await db.query("select count(*)::int as count from public.projects")).rows[0].count, 2);
    await asUser(4, async () => assert.equal((await db.query("select id from public.tasks")).rows.length, 0));
  });
  await t.test("collaborators can read converted content and attachments only through their assigned project", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611030007_task_read_details.sql", import.meta.url), "utf8"));
    const task = (await db.query("select id,project_id from public.tasks where source_request_id=$1", [request])).rows[0];
    const account = (await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",
      [emails[1], ids[1]])).rows[0].id;
    await db.query("insert into public.access_grants(account_id,role,project_id) values($1,'collaborator',$2)", [account, task.project_id]);
    const read = async () => (await db.query("select public.read_task_content($1) as content", [task.id])).rows[0].content;
    await asUser(1, async () => {
      const content = await read();
      assert.equal(content.attachments[0].id, assetId);
      assert.equal((await db.query("select id from storage.objects")).rows.length, 1);
      assert.equal((await db.query("select id from public.incoming_requests")).rows.length, 0);
    });
    await asUser(4, async () => assert.equal(await read(), null));
  });
  await t.test("client collaborators can reply with an attachment only on their own open tasks", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611030008_client_collaborator.sql", import.meta.url), "utf8"));
    const task = (await db.query("select id from public.tasks where source_request_id=$1", [request])).rows[0];
    const owner = (await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",
      [emails[0], ids[0]])).rows[0].id;
    await db.query("insert into public.access_grants(account_id,role,client_id) values($1,'client_collaborator',$2)", [owner, a]);
    await db.query("update public.access_grants set role='client_collaborator', project_id=null, client_id=$1 where account_id=(select id from public.app_accounts where auth_user_id=$2)", [a, ids[1]]);
    const reply = () => db.query("select public.reply_to_task($1,'Seguimiento','nota.txt',decode('6f6b','hex'))", [task.id]);
    await asUser(1, async () => {
      assert.equal((await db.query("select id from public.tasks")).rows.length, 0);
      await assert.rejects(reply(), /Access denied/);
    });
    await asUser(0, async () => {
      assert.equal((await db.query("select id from public.incoming_requests")).rows.length, 1);
      assert.equal((await db.query("select id from public.tasks")).rows.length, 1);
      assert.equal((await db.query("select id from storage.objects")).rows.length, 1);
      await reply();
      assert.equal((await db.query("select filename from public.task_replies")).rows[0].filename, "nota.txt");
    });
    await asUser(1, async () => assert.equal((await db.query("select id from public.task_replies")).rows.length, 0));
    await db.query("update public.tasks set status='closed' where id=$1", [task.id]);
    await asUser(0, () => assert.rejects(reply(), /Task closed/));
  });
  await t.test("only TOCH administrators can export account and client assignments", async () => {
    await db.exec("alter table auth.users add column raw_user_meta_data jsonb, add column last_sign_in_at timestamptz");
    await db.exec(await readFile(new URL("../supabase/migrations/202611030010_user_access_report.sql", import.meta.url), "utf8"));
    const report = () => db.query("select public.export_user_access() as report");
    for (const i of [0, 1, 2, 3, 4]) await asUser(i, () => assert.rejects(report(), /Access denied/));
    const account = (await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id",
      [emails[2], ids[2]])).rows[0].id;
    await db.query("insert into public.access_grants(account_id,role) values($1,'toch_admin')", [account]);
    await asUser(2, async () => {
      const rows = (await report()).rows[0].report;
      assert.equal(rows.find(row => row.email === emails[3]).client, "A");
      assert.equal(rows.find(row => row.email === emails[0]).role, "client_collaborator");
      assert.ok(rows.every(row => !Object.hasOwn(row, "task_id")));
    });
    await db.query("delete from public.access_grants where account_id=$1", [account]);
    await db.query("delete from public.app_accounts where id=$1", [account]);
  });
  await t.test("only the client's contract administrator can close; the responsible collaborator can change operational status", async () => {
    const task = (await db.query("select id,project_id from public.tasks")).rows[0];
    await db.query("update public.tasks set status='pending'");
    await db.exec(await readFile(new URL("../supabase/migrations/202611030009_task_management.sql", import.meta.url), "utf8"));
    const responsible = (await db.query("select id from public.app_accounts where auth_user_id=$1", [ids[1]])).rows[0].id;
    await db.query("update public.access_grants set role='collaborator', client_id=null, project_id=$1 where account_id=$2", [task.project_id, responsible]);
    const manage = (action, value, expected) => db.query(
      "select public.task_management($1,$2,$3,$4,$5)", [task.id, task.project_id, action, value, expected],
    );
    await asUser(1, () => assert.rejects(manage("status", "in_progress", "pending"), /denied/));
    await asUser(3, () => manage("assign", responsible, ""));
    await asUser(1, async () => {
      await assert.rejects(manage("status", "closed", "pending"), /denied/);
      await manage("status", "in_progress", "pending");
      await assert.rejects(manage("status", "waiting", "pending"), /Task changed/);
    });
    await asUser(0, () => assert.rejects(manage("status", "closed", "in_progress"), /denied/));
    await asUser(3, () => assert.rejects(manage("status", "closed", "in_progress"), /denied/));
    await asUser(4, () => assert.rejects(manage("status", "closed", "in_progress"), /denied/));
    await db.query("update public.access_grants set client_id=$1 where role='client_contract_admin'", [a]);
    await asUser(4, async () => {
      await assert.rejects(manage("status", "resolved", "in_progress"), /denied/);
      await manage("status", "closed", "in_progress");
    });
    await asUser(1, () => assert.rejects(manage("status", "resolved", "closed"), /denied/));
    await asUser(0, async () => assert.deepEqual(
      (await db.query("select status,actor_email from public.task_status_events order by id")).rows,
      [{status:"pending",actor_email:null},{status:"in_progress",actor_email:emails[1]},{status:"closed",actor_email:emails[4]}],
    ));
    await asUser(2, async () => assert.equal((await db.query("select id from public.task_status_events")).rows.length, 0));
    await db.exec(await readFile(new URL("../supabase/migrations/202611030011_task_workflow.sql", import.meta.url), "utf8"));
    await asUser(3, () => manage("status", "development", "closed"));
    await asUser(1, () => manage("status", "client_query", "development"));
    await asUser(0, async () => {
      await db.query("select public.reply_to_task($1,'Respuesta',null,null)", [task.id]);
      assert.equal((await db.query("select status from public.tasks")).rows[0].status, "client_query");
      await assert.rejects(manage("status", "development", "client_query"), /denied/);
    });
    await asUser(1, () => manage("status", "development", "client_query"));
    await asUser(3, () => assert.rejects(manage("status", "closed", "development"), /denied/));
    await asUser(4, () => manage("status", "closed", "development"));
    await db.query("update public.tasks set status='pending', responsible_id=null where id=$1", [task.id]);
    await asUser(1, async () => {
      await manage("take", "take", "");
      await assert.rejects(manage("take", "take", ""), /denied/);
      assert.deepEqual((await db.query("select status,responsible_id from public.tasks")).rows,
        [{status:"development",responsible_id:responsible}]);
    });
    await db.exec(await readFile(new URL("../supabase/migrations/202611040012_manual_time_drafts.sql", import.meta.url), "utf8"));
    const draft = id => db.query(
      "select public.save_manual_time_draft($1,$2,'2026-11-04',61,'Revisión',true)",
      [id, task.id],
    );
    const draftId = "50000000-0000-0000-0000-000000000001";
    const secondDraftId = "50000000-0000-0000-0000-000000000002";
    await asUser(0, () => assert.rejects(draft(draftId), /Time entry denied/));
    await asUser(1, async () => {
      await draft(draftId);
      await draft(draftId);
      await draft(secondDraftId);
      assert.equal((await db.query("select sum(seconds)::int as total from public.time_entries")).rows[0].total, 122);
    });
    await asUser(4, () => manage("status", "closed", "development"));
    await asUser(1, async () => {
      await draft(draftId);
      await assert.rejects(draft("50000000-0000-0000-0000-000000000003"), /Task closed/);
    });
    await db.exec(await readFile(new URL("../supabase/migrations/202611040013_weekly_hours.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202611140014_optional_manual_time_detail.sql", import.meta.url), "utf8"));
    await asUser(3, () => manage("status", "development", "closed"));
    await asUser(1, async () => {
      const saveWithoutDetail = (id, billable) => db.query(
        "select public.save_manual_time_draft($1,$2,'2026-11-04',1800,'',$3)",
        [id, task.id, billable],
      );
      await saveWithoutDetail("50000000-0000-0000-0000-000000000003", false);
      await assert.rejects(saveWithoutDetail("50000000-0000-0000-0000-000000000004", null), /not-null constraint/);
    });
    const sessionId = "60000000-0000-0000-0000-000000000001";
    const timer = (action, session = sessionId, detail = null, billable = null) =>
      db.query("select public.manage_timer($1,$2,$3,$4,$5)", [action, session, task.id, detail, billable]);
    await asUser(1, async () => {
      await timer("start");
      await assert.rejects(timer("start", "60000000-0000-0000-0000-000000000002"), /duplicate key/);
      await timer("pause");
    });
    await db.query("update public.timer_segments set started_at='2026-11-04 02:59:00+00', ended_at='2026-11-04 03:02:00+00' where session_id=$1", [sessionId]);
    await asUser(4, () => manage("status", "closed", "development"));
    await asUser(1, () => assert.rejects(timer("resume"), /Task unavailable/));
    await asUser(1, () => assert.rejects(timer("classify", sessionId, "Trabajo", true), /Access denied/));
    await asUser(3, () => timer("classify", sessionId, "Trabajo", true));
    await asUser(3, () => timer("classify", sessionId, "Trabajo", true));
    const split = await db.query("select work_date::text as day,seconds from public.time_entries where timer_session_id=$1 order by work_date", [sessionId]);
    assert.deepEqual(split.rows, [{day:"2026-11-03",seconds:60},{day:"2026-11-04",seconds:120}]);
    await asUser(1, () => db.query("select public.review_hours('2026-11-02',null)"));
    await asUser(3, () => db.query("select public.review_hours(null,$1)", [draftId]));
    await asUser(1, async () => assert.equal((await db.query(
      "select count(*)::int as total from public.time_entries where approved_at is not null",
    )).rows[0].total, 1));
  });

  await t.test("verified email codes register only eligible external collaborators and preserve existing roles", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611140015_client_email_access.sql", import.meta.url), "utf8"));
    const otp = { app_metadata: { provider: "email" }, amr: [{ method: "otp" }] };
    const linkedOtp = { ...otp, app_metadata: { provider: "google" } };
    const activate = () => db.query("select public.activate_client_code_account()");
    const access = async () => (await db.query("select public.get_my_access() as access")).rows[0].access;
    await asUser(0, () => assert.rejects(activate(), /Access denied/));
    const newUser = "00000000-0000-0000-0000-000000000006";
    const newEmail = "new@a.test";
    ids.push(newUser);
    await db.query("insert into auth.users values($1,$2,now())", [newUser, newEmail]);
    await db.query("insert into auth.identities values($1,'email',$2)", [newUser, JSON.stringify({ email: newEmail })]);
    await asUser(5, async () => {
      await activate();
      await activate();
      assert.deepEqual((await access()).grants.map(g => [g.role, g.client_id]), [["client_collaborator", a]]);
      assert.equal((await db.query("select id from public.incoming_requests")).rows.length, 0);
    }, otp);
    assert.equal((await db.query("select count(*)::int as count from public.access_audit where actor_id=$1 and action='client_self_registered'", [newUser])).rows[0].count, 1);
    await asUser(0, async () => {
      await activate();
      await activate();
      const result = await access();
      assert.deepEqual(result.grants.map(g => [g.role, g.client_id]), [["client_collaborator", a]]);
      assert.equal(result.requester_client.id, a);
      assert.equal((await db.query("select id from public.incoming_requests where id=$1", [request])).rows.length, 1);
    }, linkedOtp);
    await asUser(4, () => assert.rejects(activate(), /Access denied/), linkedOtp);
    await db.query("update public.access_grants set client_id=$1 where role='client_contract_admin'", [b]);
    await asUser(4, async () => {
      await activate();
      assert.deepEqual((await access()).grants.map(g => g.role), ["client_contract_admin"]);
    }, linkedOtp);
    await db.query("insert into public.client_domains(client_id, domain) values($1,'toch.test')", [a]);
    await asUser(3, async () => {
      await assert.rejects(activate(), /Access denied/);
      assert.equal(await access(), null);
    }, linkedOtp);
    await db.query("update public.app_accounts set is_active=false where email=$1", [emails[0]]);
    await asUser(0, async () => {
      await assert.rejects(activate(), /Access denied/);
      assert.equal(await access(), null);
    }, linkedOtp);
    await db.query("update public.client_domains set is_active=false where client_id=$1", [b]);
    await asUser(2, () => assert.rejects(activate(), /Access denied/), linkedOtp);
  });

  await t.test("temporary passwords restrict access and TOCH can add the contract role within the same company", async () => {
    await db.exec("alter table auth.users add column encrypted_password text, add column raw_app_meta_data jsonb");
    await db.exec(await readFile(new URL("../supabase/migrations/202611140016_client_password_access.sql", import.meta.url), "utf8"));
    const email = "password@a.test";
    const user = "00000000-0000-0000-0000-000000000007";
    ids.push(user);
    const activate = () => db.query("select public.complete_client_password($1)", [user]);
    const access = async () => (await db.query("select public.get_my_access() as access")).rows[0].access;
    const reserve = (address) => db.query("select * from public.reserve_client_password($1)", [address]);
    assert.equal((await reserve("new@b.test")).rows.length, 0);
    assert.equal((await reserve(email)).rows.length, 1);
    assert.equal((await reserve(email)).rows.length, 0);
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,encrypted_password) values($1,$2,now(),$3,'test-initial-hash')", [user,email,'{"tete_password_signup":true}']);
    await db.query("select public.prepare_client_password($1)", [user]);
    await db.query("insert into public.incoming_requests(id,client_id,requester_user_id,requester_email,title,description) values(gen_random_uuid(),$1,$2,$3,'Solicitud propia','Detalle propio')", [a,user,email]);
    const password = timestamp => ({ app_metadata: { provider: "email" }, amr: [{ method: "password", timestamp }] });
    const temporary = password(Math.floor(Date.now() / 1000));
    const register = () => db.query("select public.register_client_with_temporary_password()");
    await asUser(6, () => assert.rejects(register(), /Access denied/));
    await asUser(6, async () => {
      assert.equal((await db.query("select public.client_password_pending() as pending")).rows[0].pending, true);
      await register();
      await register();
      assert.equal(await access(), null);
      const { rows } = await db.query("select title from public.read_temporary_client_requests()");
      assert.deepEqual(rows, [{ title: "Solicitud propia" }]);
      await assert.rejects(activate(), /permission denied/);
    }, temporary);
    assert.deepEqual((await db.query(
      "select g.role,g.client_id from public.access_grants g join public.app_accounts a on a.id=g.account_id where a.auth_user_id=$1", [user],
    )).rows, [{ role: "client_collaborator", client_id: a }]);
    assert.equal((await db.query("select count(*)::int as count from public.access_audit where actor_id=$1 and action='client_self_registered'", [user])).rows[0].count, 1);
    await assert.rejects(activate(), /Access denied/);
    await db.query("update auth.users set encrypted_password='test-replacement-hash' where id=$1", [user]);
    await activate();
    await asUser(6, async () => {
      assert.equal(await access(), null);
      assert.equal((await db.query("select * from public.read_temporary_client_requests()")).rows.length, 0);
    }, temporary);
    const permanent = password(Math.floor(Date.now() / 1000) + 2);
    await asUser(6, async () => assert.deepEqual((await access()).grants.map(g => g.role), ["client_collaborator"]), permanent);

    const admin = (await db.query("insert into public.app_accounts(email,auth_user_id) values($1,$2) returning id", [emails[2], ids[2]])).rows[0].id;
    await db.query("insert into public.access_grants(account_id,role) values($1,'toch_admin')", [admin]);
    const target = (await db.query("select id,updated_at from public.app_accounts where auth_user_id=$1", [user])).rows[0];
    const assign = (client) => db.query("select public.admin_save_account($1,$2,true,$3,$4)", [
      target.id, email, JSON.stringify([
        { role: "client_collaborator", client_id: a },
        { role: "client_contract_admin", client_id: client },
      ]), target.updated_at,
    ]);
    await asUser(6, () => assert.rejects(assign(a), /Access denied/), permanent);
    await asUser(2, () => assert.rejects(assign(b), /Role combination not approved|Unavailable scope/));
    await asUser(2, () => assign(a));
    await asUser(6, async () => {
      assert.deepEqual((await access()).grants.map(g => g.role), ["client_collaborator", "client_contract_admin"]);
      assert.equal((await db.query("select id from public.incoming_requests where id=$1", [request])).rows.length, 1);
    }, permanent);
  });

  await t.test("manual invitations grant only the bound collaborator role after acceptance", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611140017_client_invitation.sql", import.meta.url), "utf8"));
    const email = "invited@a.test";
    const user = "00000000-0000-0000-0000-000000000008";
    const invitation = "00000000-0000-0000-0000-000000000009";
    const digest = "a".repeat(64);
    const reserve = address => db.query("select public.reserve_client_invitation($1,$2) as ok", [address, invitation]);
    const complete = () => db.query("select public.complete_client_invitation($1,$2) as ok", [digest, user]);
    const resolve = () => db.query("select public.client_invitation_user($1) as id", [digest]);
    const claims = method => ({ app_metadata: { provider: "email" }, amr: [{ method, timestamp: Math.floor(Date.now() / 1000) + 2 }] });
    ids.push(user);

    await asUser(2, () => assert.rejects(reserve(email), /permission denied/));
    assert.equal((await reserve("invited@unknown.test")).rows[0].ok, false);
    assert.equal((await reserve("password@a.test")).rows[0].ok, false);
    assert.equal((await reserve(email)).rows[0].ok, true);
    assert.equal((await reserve(email)).rows[0].ok, false);

    await db.query("insert into auth.users(id,email) values($1,$2)", [user,email]);
    assert.equal((await db.query("select public.publish_client_invitation($1,$2,$3,$4) as ok", [email, invitation, user, digest])).rows[0].ok, true);
    assert.equal((await resolve()).rows[0].id, user);
    assert.equal((await complete()).rows[0].ok, false);

    await db.query("update auth.users set email_confirmed_at=now(), encrypted_password='test-chosen-hash' where id=$1", [user]);
    await db.exec("update public.client_domains set is_active=false where domain='a.test'");
    assert.equal((await complete()).rows[0].ok, false);
    await db.exec("update public.client_domains set is_active=true where domain='a.test'");
    assert.equal((await complete()).rows[0].ok, true);
    assert.equal((await complete()).rows[0].ok, false);
    assert.equal((await resolve()).rows[0].id, null);

    const access = async () => (await db.query("select public.get_my_access() as access")).rows[0].access;
    await asUser(7, async () => assert.equal(await access(), null), claims("otp"));
    await asUser(7, async () => assert.deepEqual((await access()).grants.map(g => g.role), ["client_collaborator"]), claims("password"));
  });

  await t.test("TOCH administrator can operate on tasks without project or client grants", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/202611150020_global_admin_workflow.sql", import.meta.url), "utf8"));
    const { rows: [task] } = await db.query("select id, project_id from public.tasks where source_request_id=$1", [request]);
    const { rows: [admin] } = await db.query("select id from public.app_accounts where auth_user_id=$1", [ids[2]]);
    await db.query("update public.tasks set status='pending', responsible_id=null where id=$1", [task.id]);
    const manage = (action, value = null, expected = null) => db.query(
      "select public.task_management($1,$2,$3,$4,$5) as result", [task.id, task.project_id, action, value, expected],
    );
    await asUser(2, async () => {
      const { rows: [{ result }] } = await manage(null);
      assert.equal(result.canTake, true);
      assert.ok(result.choices.some(choice => choice.id === admin.id));
      await manage("take");
      await manage("status", "closed", "development");
      await manage("status", "development", "closed");
      await manage("assign", admin.id, admin.id);
    });
  });
});
