import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/supabase/config";
import { getAccess } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const origin = getAppOrigin();
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/ingresar?estado=error";
  try {
    if (code && !request.nextUrl.searchParams.has("error")) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Bind management accounts; requester access is derived from verified domain.
        const { error: bindError } = await supabase.rpc("bind_my_account");
        if (bindError) {
          await supabase.auth.signOut({ scope: "local" });
        } else {
          const access = await getAccess();
          if (access) destination = access.grants.length ? "/inicio" : "/inicio/solicitudes";
          else {
            await supabase.auth.signOut({ scope: "local" });
            destination = "/ingresar?estado=no-autorizado";
          }
        }
      }
    }
  } catch { /* Never reflect OAuth codes, tokens or database errors in the URL. */ }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
