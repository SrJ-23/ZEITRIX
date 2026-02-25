
import { createClient } from '@supabase/supabase-js';

// Access environment variables using Vite's import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. La conexión a la base de datos fallará.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
