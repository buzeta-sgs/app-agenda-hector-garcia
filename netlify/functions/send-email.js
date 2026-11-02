// Envía los correos con Brevo. La clave de Brevo vive en Netlify, nunca en el navegador.
// Variables en Netlify: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, SUPABASE_URL, SUPABASE_ANON_KEY

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  const env = process.env;

  // Solo alguien con sesión iniciada en el panel puede enviar.
  const token = (event.headers.authorization || '').replace(/^Bearer /, '');
  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!token || !u.ok) return json(401, { error: 'Sesión no válida. Vuelve a entrar.' });

  let mensajes;
  try { ({ mensajes } = JSON.parse(event.body || '{}')); } catch { return json(400, { error: 'Datos inválidos' }); }
  mensajes = (mensajes || []).filter(m => /\S+@\S+\.\S+/.test(m.email));
  if (!mensajes.length) return json(400, { error: 'No hay destinatarios' });

  let enviados = 0;
  // Brevo acepta varias versiones por llamada; se envía en grupos de 100.
  for (let i = 0; i < mensajes.length; i += 100) {
    const grupo = mensajes.slice(i, i + 100);
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        subject: grupo[0].asunto,
        htmlContent: '<p>{{params.cuerpo}}</p>',
        messageVersions: grupo.map(m => ({
          to: [{ email: m.email, name: m.nombre }],
          subject: m.asunto,
          params: { cuerpo: esc(m.texto).replace(/\n/g, '<br>') }
        }))
      })
    });
    if (!r.ok) return json(502, { error: `Brevo: ${await r.text()}`, enviados });
    enviados += grupo.length;
  }
  return json(200, { enviados });
};
