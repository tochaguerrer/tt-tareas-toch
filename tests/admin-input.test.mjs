import { test } from "node:test";
import assert from "node:assert/strict";
import { accountMode, parseAccountInput } from "../src/lib/admin/account-input.ts";

const client="10000000-0000-0000-0000-000000000001";
const project="20000000-0000-0000-0000-000000000001";
function form(values) {
  const data=new FormData();
  for(const [key,value] of Object.entries(values)) for(const item of Array.isArray(value)?value:[value]) data.append(key,item);
  return data;
}
test("account input normalizes email and only grants explicit, scoped roles",()=> {
  const input=parseAccountInput(form({email:"  Person@Example.test  ",active:"on",mode:"manager_collaborator",clients:[client,client],projects:project}));
  assert.equal(input.email,"person@example.test");
  assert.deepEqual(input.grants,[{role:"account_manager",client_id:client,project_id:null},{role:"collaborator",client_id:null,project_id:project}]);
  assert.equal(accountMode(input.grants),"manager_collaborator");
});
test("account input rejects missing scope, unknown roles, invalid email and stale identifiers",()=> {
  for(const values of [
    {email:"bad",active:"on",mode:"toch_admin"},
    {email:"a@example.test",active:"on",mode:""},
    {email:"a@example.test",active:"on",mode:"solicitante"},
    {email:"a@example.test",active:"on",mode:"account_manager"},
    {email:"a@example.test",active:"on",mode:"collaborator",projects:"bad"},
    {email:"a@example.test",active:"on",mode:"client_contract_admin",clients:[client,project]},
    {email:"a@example.test",account_id:client,mode:"toch_admin"},
  ]) assert.throws(()=>parseAccountInput(form(values)));
  assert.deepEqual(parseAccountInput(form({email:"a@example.test"})).grants,[]);
});
