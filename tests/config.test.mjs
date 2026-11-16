import { test } from "node:test";
import assert from "node:assert/strict";
import { getAppOrigin, getSupabaseConfig } from "../src/lib/supabase/config.ts";

test("configuration rejects privileged keys and unsafe canonical origins",()=> {
  const saved={...process.env};
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_secret_fake";
    assert.equal(getSupabaseConfig(),null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_fake";
    assert.ok(getSupabaseConfig());
    process.env.NEXT_PUBLIC_SUPABASE_URL="http://unsafe.example.test";
    assert.equal(getSupabaseConfig(),null);
    for(const origin of ["http://evil.example.test","https://example.test/path","https://user:password@example.test","https://example.test/?next=evil"]){
      process.env.APP_URL=origin;
      assert.throws(()=>getAppOrigin());
    }
    process.env.APP_URL="http://127.0.0.1:3000";
    assert.equal(getAppOrigin(),"http://127.0.0.1:3000");
    delete process.env.APP_URL;
    assert.throws(()=>getAppOrigin());
  } finally {
    for(const key of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","APP_URL"]){
      if(saved[key]===undefined) delete process.env[key]; else process.env[key]=saved[key];
    }
  }
});
