/* ============================================================
   Cliente de Supabase (usado por storage.js y market.js)
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (SUPABASE_URL.includes("TU-PROYECTO") || SUPABASE_ANON_KEY.includes("TU-ANON-KEY")) {
  // eslint-disable-next-line no-console
  console.warn(
    "FitLife: falta configurar js/config.js con la URL y la anon key de tu proyecto de Supabase."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
