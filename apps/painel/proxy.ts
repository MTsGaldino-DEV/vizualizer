import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão e manda quem não está logado para /login (padrão @supabase/ssr, via Context7).
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, headers) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) resposta.headers.set(k, v as string);
      },
    },
  });
  // Não colocar nada entre createServerClient e getClaims (doc do Supabase).
  const { data } = await sb.auth.getClaims();

  const p = request.nextUrl.pathname;
  if (!data?.claims && !p.startsWith("/login") && !p.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    for (const c of resposta.cookies.getAll()) redirect.cookies.set(c); // não perde renovação de sessão
    return redirect;
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|marca/|sw.js|manifest.webmanifest|icone-|favicon).*)"],
};
