// Configuración del panel. Cambia estos valores y vuelve a publicar.
window.APP_CONFIG = {
  // Lo que se ve arriba. Por ahora neutro, sin nombre de candidato.
  TITULO: "Agenda Páez",
  SUBTITULO: "Municipio Páez, Portuguesa",

  // Firma para usar en mensajes con {candidato}. Déjalo vacío para no firmar.
  CANDIDATO: "",

  // Usuarios que ven todo (Campaña, Elecciones y Recaudación). Si cambias la lista, cámbiala también en supabase.sql (función es_admin).
  ADMIN_EMAILS: ["psi.hectordavidgarcia@gmail.com"],
  // Usuarios que solo ven la Agenda.
  SOLO_AGENDA: ["contacto.hectorgarcia@gmail.com"],
  // Único usuario que crea, borra y cambia claves de los demás (pestaña Usuarios). Si lo cambias, cámbialo también en supabase/functions/usuarios/index.ts.
  GESTOR_USUARIOS: "psi.hectordavidgarcia@gmail.com",
  // Los demás entran solo con usuario (ej. "maria"), que en Supabase se crea como maria@agendapaez.app
  DOMINIO_USUARIOS: "agendapaez.app",

  // Déjalos vacíos para usar el modo prueba (datos solo en este navegador).
  SUPABASE_URL: "https://blphpkpxompsryrknvfo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_b_6-hMJLXVj3k6fGQYQaPg_-TUdqB0N",

  // Nombres de las funciones en Supabase (Edge Functions).
  FUNCIONES: { usuarios: "clever-responder", correo: "quick-endpoint" },

  // La bienvenida al equipo sale por EmailJS (desde el Gmail de Héctor). Los avisos de actividades siguen por Brevo.
  // Si queda vacío, la bienvenida también sale por Brevo. En la plantilla de EmailJS: To = {{to_email}}, Subject = {{asunto}}, contenido = {{{contenido_html}}}.
  EMAILJS: { publicKey: "MWss_HjzGA__pAoSv", serviceId: "chato", templateBienvenida: "chato bienvenida" },

  META_MENSUAL_USD: 2000,

  // Nombre del conteo que se muestra en Resultados.
  ELECCION_NOMBRE: "Conteo interno del equipo",
  SECTORES: ["Acarigua", "Payara", "Pimpinela", "Ramón Peraza"]
};
