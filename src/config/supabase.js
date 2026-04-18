// src/config/supabase.js
import { createClient } from "@supabase/supabase-js";

// Validar que las variables existan
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ Faltan variables de Supabase en .env');
  console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ (oculta)' : '✗');
  process.exit(1);
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);