// Crea, lista, borra y cambia la clave de los usuarios del panel. La clave secreta de Supabase vive en Netlify, nunca en el navegador.
// Variables en Netlify: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

// Única persona que puede administrar usuarios. Si lo cambias, cámbialo también en config.js (GESTOR_USUARIOS).
const GESTOR = 'psi.hectordavidgarcia@gmail.com';
// Nadie puede borrar a los administradores desde el panel.
const PROTEGIDOS = ['contacto.hectorgarcia@gmail.com', GESTOR];

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  const env = process.env;

  // Solo el gestor, con sesión iniciada, puede usar esta función.
  const token = (event.headers.authorization || '').replace(/^Bearer /, '');
  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!token || !u.ok) return json(401, { error: 'Sesión no válida. Vuelve a entrar.' });
  if ((await u.json()).email?.toLowerCase() !== GESTOR) return json(403, { error: 'Solo el gestor puede administrar usuarios.' });

  let accion, email, password, id;
  try { ({ accion, email, password, id } = JSON.parse(event.body || '{}')); } catch { return json(400, { error: 'Datos inválidos' }); }

  const admin = (ruta, opciones = {}) => fetch(`${env.SUPABASE_URL}/auth/v1/admin/users${ruta}`, {
    ...opciones,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
  });
  const responder = async (r, ok) => r.ok ? json(200, ok ?? {}) : json(r.status, { error: (await r.json().catch(() => ({}))).msg || `Supabase respondió ${r.status}` });

  if (accion === 'listar') {
    const r = await admin('?per_page=1000');
    if (!r.ok) return responder(r);
    const { users } = await r.json();
    return json(200, { usuarios: users.map(x => ({ id: x.id, email: x.email, created_at: x.created_at, ultimo: x.last_sign_in_at })) });
  }

  if (accion === 'crear' || accion === 'clave') {
    if (!password || password.length < 6) return json(400, { error: 'La clave debe tener al menos 6 caracteres.' });
  }

  if (accion === 'crear') {
    email = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'Usuario no válido.' });
    return responder(await admin('', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) }));
  }

  if (accion === 'clave') return responder(await admin(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ password }) }));

  if (accion === 'borrar') {
    const r = await admin(`/${encodeURIComponent(id)}`);
    if (!r.ok) return responder(r);
    if (PROTEGIDOS.includes((await r.json()).email?.toLowerCase())) return json(400, { error: 'No se puede borrar a un administrador.' });
    return responder(await admin(`/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  }

  return json(400, { error: 'Acción no válida' });
};
