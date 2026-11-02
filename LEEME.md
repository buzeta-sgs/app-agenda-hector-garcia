# Panel de campaña · Páez

## Probar ya (sin cuentas)
Abre `index.html` en el navegador. Funciona en **modo prueba**: los datos quedan solo en ese navegador.

## Lo que necesitas para la versión real

| # | Qué | Para qué | Costo |
|---|-----|----------|-------|
| 1 | Cuenta **Supabase** (proyecto nuevo) | Guardar contactos, eventos, donaciones y el inicio de sesión | Gratis |
| 2 | Cuenta **Netlify** | Publicar el panel en internet | Gratis |
| 3 | Cuenta **Brevo** | Enviar correos (300 al día gratis) | Gratis |
| 4 | Un **correo de la campaña** (ej. Gmail) | Remitente de los correos | Gratis |
| 5 | Un **WhatsApp de la campaña** (ideal WhatsApp Business) | Desde ahí salen los avisos | Gratis |
| 6 | Opcional: **dominio** (ej. campanapaez.com) | Dirección propia y correos más confiables | ~12 USD/año |
| 7 | Lista de contactos en **Excel** | Columnas: nombre, telefono, correo, sector, acepta | — |

## Pasos
1. **Supabase**: crea el proyecto → *SQL Editor* → pega `supabase.sql` → *Run*.
   En *Authentication > Users > Add user > Create new user* crea solo a los dos administradores, marcando **Auto Confirm User**:
   - `psi.hectordavidgarcia@gmail.com` (ve todo) y `contacto.hectorgarcia@gmail.com` (solo Agenda).
   - El resto del equipo lo crea **psi.hectordavidgarcia@gmail.com** desde la pestaña **Usuarios** del panel
     (solo Campaña, sin Recaudación). Si crea el usuario **maria**, esa persona entra escribiendo **maria** y su clave.
2. **config.js**: pon el nombre del candidato, `SUPABASE_URL` y `SUPABASE_ANON_KEY`
   (Supabase > *Project Settings > API*).
3. **Brevo**: crea la cuenta, verifica el correo remitente (*Senders*) y copia una *API key* (SMTP & API).
4. **Netlify**: sube la carpeta con **Netlify CLI o GitHub** (Netlify Drop no sirve, porque el envío de correos usa una función).
   En *Site settings > Environment variables* agrega:
   `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase > *Project Settings > API*, la clave **service_role / secret**; sirve para crear usuarios).
   Esa clave va **solo** en Netlify, nunca en `config.js`.
5. Entra al panel con tu usuario, importa el Excel y envía el primer aviso.

## Cómo funciona WhatsApp
El panel abre WhatsApp contacto por contacto con el mensaje listo; tú solo le das enviar.
Es gratis y no arriesga el número. Si algún día son miles, se puede pasar a la API oficial de Meta.

## Reglas importantes
- Escribe solo a quien aceptó recibir mensajes (columna `acepta`).
- Activa **Período electoral** cuando el CNE convoque y revisa cada mensaje.
- Las donaciones se **registran**, el panel no cobra. Guarda nombre, monto y comprobante.
