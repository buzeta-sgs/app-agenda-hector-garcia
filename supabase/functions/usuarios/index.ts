// Crea, lista, borra y cambia la clave de los usuarios del panel. Corre en Supabase (Edge Functions), nunca en el navegador.
// Supabase ya trae SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Si tu proyecto usa claves nuevas, agrega el secreto SB_SECRET_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Única persona que puede administrar usuarios. Si lo cambias, cámbialo también en config.js (GESTOR_USUARIOS).
const GESTOR = 'psi.hectordavidgarcia@gmail.com';
// Nadie puede borrar a estas cuentas desde el panel.
const PROTEGIDOS = ['contacto.hectorgarcia@gmail.com', GESTOR];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Claves nuevas (SUPABASE_SECRET_KEYS, un JSON) o la clásica (SUPABASE_SERVICE_ROLE_KEY), la que exista.
const clave = (nueva: string, clasica: string) => {
  try { return Object.values(JSON.parse(Deno.env.get(nueva) ?? ''))[0] as string; } catch { return Deno.env.get(clasica)!; }
};
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET_KEY') ?? clave('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  // Solo el gestor, con sesión iniciada, puede usar esta función.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const { data: quien } = await sb.auth.getUser(token);
  if (!quien?.user) return json(401, { error: 'Sesión no válida. Vuelve a entrar.' });
  if (quien.user.email?.toLowerCase() !== GESTOR) return json(403, { error: 'Solo el gestor puede administrar usuarios.' });

  let { accion, email, password, id } = await req.json().catch(() => ({}));
  const responder = (error: { message: string } | null, ok: unknown = {}) => error ? json(400, { error: error.message }) : json(200, ok);

  if (accion === 'listar') {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) return responder(error);
    return json(200, { usuarios: data.users.map(x => ({ id: x.id, email: x.email, created_at: x.created_at, ultimo: x.last_sign_in_at })) });
  }

  if (accion === 'crear' || accion === 'clave') {
    if (!password || password.length < 6) return json(400, { error: 'La clave debe tener al menos 6 caracteres.' });
  }

  if (accion === 'crear') {
    email = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'Usuario no válido.' });
    return responder((await sb.auth.admin.createUser({ email, password, email_confirm: true })).error);
  }

  if (accion === 'clave') return responder((await sb.auth.admin.updateUserById(id, { password })).error);

  if (accion === 'borrar') {
    const { data, error } = await sb.auth.admin.getUserById(id);
    if (error) return responder(error);
    if (PROTEGIDOS.includes(data.user.email?.toLowerCase() ?? '')) return json(400, { error: 'No se puede borrar esta cuenta.' });
    return responder((await sb.auth.admin.deleteUser(id)).error);
  }

  return json(400, { error: 'Acción no válida' });
});
