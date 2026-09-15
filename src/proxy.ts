import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Pages consultables sans compte, chacune pour une raison précise :
  //  · "/a-propos" : la page projet exigée par le guide de communication
  //    Interreg (p. 5), qui doit être accessible à tous ;
  //  · "/demande" : la porte d'entrée du guichet. Un guichet unique où il
  //    faudrait déjà être invité pour se manifester ne serait pas un guichet.
  //    Le dépôt n'ouvre aucun compte, et la RLS n'autorise là que l'insertion,
  //    jamais la lecture (cf. migration 010) ;
  //  · "/suivi" : le porteur y consulte l'état de sa demande avec le lien
  //    personnel remis au dépôt. La page ne lit rien directement — elle passe
  //    par une fonction qui ne renvoie que ce qui le concerne, jamais les
  //    notes internes (cf. migration 012) ;
  //  · "/reinitialiser" : quelqu'un qui a perdu son mot de passe ne peut par
  //    définition pas être connecté pour le changer. Le jeton est à usage
  //    unique et vérifié côté base (cf. migration 015) ;
  //  · "/login", "/bootstrap", "/invite" : les portes d'authentification.
  const publicPaths = [
    "/login",
    "/bootstrap",
    "/invite",
    "/a-propos",
    "/demande",
    "/suivi",
    "/reinitialiser",
  ];

  // La comparaison est volontairement stricte : chemin identique, ou suivi d'un
  // « / ». Un simple startsWith laisserait passer "/demandes" — la file de
  // travail réservée à l'équipe — parce que "/demande" en est un préfixe. Le
  // piège est invisible à la lecture et n'ouvrirait qu'une seule route, ce qui
  // le rend d'autant plus facile à manquer.
  const chemin = request.nextUrl.pathname;
  const isPublic = publicPaths.some((p) => chemin === p || chemin.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
