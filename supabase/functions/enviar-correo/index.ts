// Envía los correos con Brevo. Corre en Supabase (Edge Functions); la clave de Brevo vive ahí, nunca en el navegador.
// Secretos en Supabase: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME. SUPABASE_URL y SUPABASE_ANON_KEY ya vienen.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Claves nuevas (SUPABASE_PUBLISHABLE_KEYS, un JSON) o la clásica (SUPABASE_ANON_KEY), la que exista.
const clave = (nueva: string, clasica: string) => {
  try { return Object.values(JSON.parse(Deno.env.get(nueva) ?? ''))[0] as string; } catch { return Deno.env.get(clasica)!; }
};
const sb = createClient(Deno.env.get('SUPABASE_URL')!, clave('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Cualquier error inesperado vuelve con los permisos del navegador (CORS) y el motivo, en vez de un "Failed to fetch".
Deno.serve(async (req) => {
  try { return await atender(req); }
  catch (e) { console.error(e); return json(500, { error: 'Falla en la función de correos: ' + ((e as Error)?.message || e) }); }
});

async function atender(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  if (!Deno.env.get('BREVO_API_KEY') || !Deno.env.get('BREVO_SENDER_EMAIL')) return json(500, { error: 'Faltan los secretos BREVO_API_KEY o BREVO_SENDER_EMAIL en Supabase.' });

  // Solo alguien con sesión iniciada en el panel puede enviar.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const { data: quien } = await sb.auth.getUser(token);
  if (!quien?.user) return json(401, { error: 'Sesión no válida. Vuelve a entrar.' });

  let { mensajes } = await req.json().catch(() => ({}));
  mensajes = (mensajes || []).filter((m: { email: string }) => /\S+@\S+\.\S+/.test(m.email));
  if (!mensajes.length) return json(400, { error: 'No hay destinatarios' });

  type Mensaje = { email: string; nombre: string; asunto: string; texto: string; html?: string };
  const sender = { email: Deno.env.get('BREVO_SENDER_EMAIL'), name: Deno.env.get('BREVO_SENDER_NAME') };
  const brevo = (body: unknown) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, ...body as object })
  });

  let enviados = 0;
  // Correos con diseño propio (html), como la bienvenida al equipo: uno por llamada.
  for (const m of mensajes.filter((m: Mensaje) => m.html) as Mensaje[]) {
    const r = await brevo({ to: [{ email: m.email, name: m.nombre }], subject: m.asunto, htmlContent: m.html, textContent: m.texto });
    if (!r.ok) return json(502, { error: `Brevo: ${await r.text()}`, enviados });
    enviados++;
  }
  // Avisos de texto: Brevo acepta varias versiones por llamada; se envía en grupos de 100.
  const simples = mensajes.filter((m: Mensaje) => !m.html) as Mensaje[];
  for (let i = 0; i < simples.length; i += 100) {
    const grupo = simples.slice(i, i + 100);
    const r = await brevo({
      subject: grupo[0].asunto,
      htmlContent: '<p>{{params.cuerpo}}</p>',
      messageVersions: grupo.map(m => ({
        to: [{ email: m.email, name: m.nombre }],
        subject: m.asunto,
        params: { cuerpo: esc(m.texto).replace(/\n/g, '<br>') }
      }))
    });
    if (!r.ok) return json(502, { error: `Brevo: ${await r.text()}`, enviados });
    enviados += grupo.length;
  }
  return json(200, { enviados });
}
