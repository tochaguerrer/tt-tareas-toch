"use client";
import {createBrowserClient} from "@supabase/ssr";
import {getSupabaseConfig} from "./config";
export function createBrowserSupabase(){
  const config=getSupabaseConfig();
  if(!config)throw new Error("El acceso todavía está en configuración.");
  return createBrowserClient(config.url,config.key);
}

