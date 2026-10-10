import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configurado = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.startsWith('PEGA-AQUI');

export function crearCliente(opciones) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opciones);
}
