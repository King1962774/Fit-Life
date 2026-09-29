/* ============================================================
   Configuración de Supabase
   ============================================================
   Completa estos dos valores con los de tu proyecto de Supabase:
   Panel de Supabase → Project Settings → API.

   SUPABASE_URL      -> "Project URL"
   SUPABASE_ANON_KEY -> "anon public" key (NO uses la "service_role")

   Estos valores no son secretos sensibles: la anon key está protegida
   por las políticas de Row Level Security (RLS) definidas en
   supabase/schema.sql, así que es seguro incluirla en el código del
   frontend que sirves desde tu propio servidor.
   ============================================================ */

export const SUPABASE_URL = "https://vigypnqezjxxtsdlpdgh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZ3lwbnFlemp4eHRzZGxwZGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDI5NjgsImV4cCI6MjEwNDgxODk2OH0.t8cPTGTTiIn2X4tk7M1_Wz2uA0Oef_7OQEy5gqhwRVw";
