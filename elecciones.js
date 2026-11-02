// Módulo Elecciones: centros, mesas, candidatos, carga y verificación de actas, resultados y auditoría.
// Usa las utilidades de index.html (S, db, A, VIEWS, h, $, fmt, mt, accion, render, telWa, exportar).

TABLAS.push('e_candidatos', 'e_centros', 'e_mesas', 'e_testigos');
MODULOS.elecciones.grupos = [
  ['Resultados', [['e_resumen', 'ti-chart-bar', 'Resultados'], ['e_auditoria', 'ti-alert-triangle', 'Auditoría']]],
  ['Actas', [['e_cargar', 'ti-file-upload', 'Cargar actas'], ['e_verificar', 'ti-shield-check', 'Verificar']]],
  ['Configuración', [['e_centros', 'ti-building-community', 'Centros y mesas'], ['e_candidatos', 'ti-user-star', 'Candidatos'], ['e_testigos', 'ti-users-group', 'Testigos']]]
];
Object.assign(S, { e_candidatos: [], e_centros: [], e_mesas: [], e_testigos: [],
  eSoloVerif: false, eCentro: '', eMesa: '', eVerif: null, eVerCentro: null, eMsg: null });
try { const m = localStorage.getItem('cp_modulo'); if (MODULOS[m]) S.modulo = m; } catch {}

const COLORES = ['#1E5FA3', '#F47A20', '#127A3E', '#8E44AD', '#C0392B', '#16A085', '#D4A017', '#7F8C8D'];
const ESTADOS = { pendiente: 'Pendiente', cargada: 'Cargada', verificada: 'Verificada', incidencia: 'Incidencia' };

const cands = () => [...S.e_candidatos].sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre));
const centroDe = id => S.e_centros.find(c => c.id === id);
const mesasDe = cid => S.e_mesas.filter(m => m.centro_id === cid).sort((a, b) => a.numero - b.numero);
const conDatos = m => ['cargada', 'verificada', 'incidencia'].includes(m.estado);
const contadas = () => S.e_mesas.filter(m => S.eSoloVerif ? m.estado === 'verificada' : m.estado === 'cargada' || m.estado === 'verificada');
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const fpct = n => n.toLocaleString('es-VE', { maximumFractionDigits: 1 }) + '%';
const chip = e => `<span class="est ${e}">${ESTADOS[e] || e}</span>`;
const nombreMesa = m => `${h(centroDe(m.centro_id)?.nombre || 'Centro')} · Mesa ${m.numero}`;
const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const avatar = (c, px = 40) => c.foto
  ? `<img src="${h(c.foto)}" alt="" style="width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 3px ${h(c.color)}">`
  : `<span style="width:${px}px;height:${px}px;border-radius:50%;background:${h(c.color)};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(px * .38)}px;flex-shrink:0">${h(iniciales(c.nombre))}</span>`;

// Reduce la foto a un cuadrado pequeño para guardarla junto al candidato.
function fotoReducida(file, lado = 240) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = lado;
      const m = Math.min(img.width, img.height);
      cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(img.src); ok(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(file);
  });
}
const msg = () => { const x = S.eMsg; S.eMsg = null; return x ? `<p class="${x.ok ? 'okm' : 'err'}" style="margin:0 0 12px">${h(x.t)}</p>` : ''; };

function sumar(mesas) {
  const ids = new Set(S.e_candidatos.map(c => c.id));
  const votos = {}; ids.forEach(id => votos[id] = 0);
  let nulos = 0, votantes = 0, electores = 0;
  for (const m of mesas) {
    let s = 0;
    for (const [k, v] of Object.entries(m.votos || {})) if (ids.has(k)) { votos[k] += Number(v) || 0; s += Number(v) || 0; }
    nulos += Number(m.nulos) || 0;
    votantes += m.votantes != null ? Number(m.votantes) : s + (Number(m.nulos) || 0);
    electores += Number(m.electores) || 0;
  }
  const validos = Object.values(votos).reduce((a, b) => a + b, 0);
  return { votos, nulos, validos, votantes, electores };
}

function lider(r) {
  const o = cands().map(c => ({ c, v: r.votos[c.id] || 0 })).sort((a, b) => b.v - a.v);
  return o[0] && o[0].v > 0 ? o[0] : null;
}

const vacioE = (titulo, texto, tab, boton) => `<div class="card" style="text-align:center;padding:36px 20px">
  <h3 style="justify-content:center">${titulo}</h3><p class="sub" style="margin:0 0 14px">${texto}</p>
  <button class="pri" data-a="tab" data-v="${tab}">${boton}</button></div>`;

// ---------- Resultados ----------
function vEResumen() {
  const C = cands(), total = S.e_mesas.length;
  if (!C.length) return vacioE('Empieza registrando los candidatos', 'Luego agrega los centros y mesas, y carga las actas.', 'e_candidatos', 'Ir a Candidatos');
  if (!total) return vacioE('Agrega los centros de votación', 'Cada centro con su número de mesas.', 'e_centros', 'Ir a Centros y mesas');
  const cont = contadas(), r = sumar(cont);
  const orden = C.map(c => ({ c, v: r.votos[c.id] || 0 })).sort((a, b) => b.v - a.v);
  const dif = orden.length > 1 ? orden[0].v - orden[1].v : 0;
  const sectores = [...new Set([...CFG.SECTORES, ...S.e_centros.map(c => c.sector).filter(Boolean)])];
  const avance = pct(cont.length, total);

  const porSector = sectores.map(s => {
    const ms = S.e_mesas.filter(m => centroDe(m.centro_id)?.sector === s);
    if (!ms.length) return '';
    const mc = ms.filter(m => cont.includes(m)), rs = sumar(mc), l = lider(rs);
    return `<tr><td><b>${h(s)}</b></td><td class="num">${mc.length}/${ms.length}</td>
      ${C.map(c => `<td class="num">${fpct(pct(rs.votos[c.id] || 0, rs.validos))}</td>`).join('')}
      <td class="num">${fpct(pct(rs.votantes, rs.electores))}</td>
      <td>${l ? `<span class="dot" style="background:${h(l.c.color)}"></span>${h(l.c.nombre)}` : '—'}</td></tr>`;
  }).join('');

  const porCentro = [...S.e_centros].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(ce => {
    const ms = mesasDe(ce.id), mc = ms.filter(m => cont.includes(m)), rs = sumar(mc), l = lider(rs);
    return `<tr><td><b>${h(ce.nombre)}</b><div class="sub">${h(ce.sector || '')}${ce.codigo ? ' · ' + h(ce.codigo) : ''}</div></td>
      <td class="num">${mc.length}/${ms.length}</td>
      <td>${l ? `<span class="dot" style="background:${h(l.c.color)}"></span>${h(l.c.nombre)}` : '—'}</td>
      <td class="num">${l ? fpct(pct(l.v, rs.validos)) : '—'}</td>
      <td class="num">${fpct(pct(rs.votantes, rs.electores))}</td>
      <td><button class="mini" data-a="eIrCentro" data-v="${ce.id}">Actas</button></td></tr>`;
  }).join('');

  return `
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
    <div><div class="sub">${h(CFG.ELECCION_NOMBRE || 'Conteo interno')}</div>
      <div class="big" style="color:var(--azul3)">Escrutado ${fpct(avance)}</div>
      <div class="sub">Corte: ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}${DEMO ? '' : ' · se actualiza solo cada 20 s'}</div></div>
    <div style="flex:1;min-width:200px;max-width:420px"><div class="bar"><div style="width:${avance}%"></div></div></div>
    <div class="acts" style="align-items:center">
      <label class="switch" style="gap:10px">Solo verificadas <input type="checkbox" id="eSoloVerif" ${S.eSoloVerif ? 'checked' : ''}></label>
      <button class="mini" data-a="eRefrescar"><i class="ti ti-refresh"></i> Actualizar</button>
    </div>
  </div>
  <div class="grid" style="margin-bottom:16px">
    ${mt('ti-file-certificate', 'Mesas escrutadas', `${fmt(cont.length)} / ${fmt(total)}`, fpct(avance))}
    ${mt('ti-users', 'Participación', fpct(pct(r.votantes, r.electores)), `${fmt(r.votantes)} de ${fmt(r.electores)} electores`)}
    ${mt('ti-checks', 'Votos válidos', fmt(r.validos))}
    ${mt('ti-ban', 'Nulos', fmt(r.nulos), fpct(pct(r.nulos, r.validos + r.nulos)), 'n')}
  </div>
  <div class="card"><h3><i class="ti ti-chart-bar"></i> Resultados por candidato</h3>
    ${marcador(orden, r.validos)}
    ${orden.length > 1 && r.validos ? `<p class="sub" style="margin:12px 0 0">Ventaja de <b>${h(orden[0].c.nombre)}</b>: ${fmt(dif)} votos (${(Math.round((pct(orden[0].v, r.validos) - pct(orden[1].v, r.validos)) * 10) / 10).toLocaleString('es-VE')} puntos).</p>` : ''}
  </div>
  <div class="card"><h3><i class="ti ti-map-pin"></i> Por parroquia</h3><div class="scroll"><table class="tabla">
    <tr><th>Parroquia</th><th class="num">Mesas</th>${C.map(c => `<th class="num"><span class="dot" style="background:${h(c.color)}"></span>${h(c.nombre)}</th>`).join('')}<th class="num">Particip.</th><th>Líder</th></tr>
    ${porSector}</table></div></div>
  <div class="card"><h3><i class="ti ti-building-community"></i> Por centro de votación</h3><div class="scroll"><table class="tabla">
    <tr><th>Centro</th><th class="num">Mesas</th><th>Líder</th><th class="num">%</th><th class="num">Particip.</th><th></th></tr>
    ${porCentro}</table></div></div>`;
}

// Los dos primeros enfrentados arriba, una barra con el reparto de todos (1.º a la izquierda, 2.º a la derecha) y el resto en fila.
function marcador(orden, validos) {
  const [a, b, ...resto] = orden;
  const lado = ({ c, v }, der) => `<div class="lado${der ? ' der' : ''}">${avatar(c, 64)}<div style="min-width:0">
    <div class="nom">${h(c.nombre)}</div>
    <div class="pc" style="color:${h(c.color)}">${fpct(pct(v, validos))}</div>
    <div class="vt">${fmt(v)} votos</div></div></div>`;
  const tramo = ({ c, v }, gris) => v ? `<div title="${h(c.nombre)}: ${fpct(pct(v, validos))}" style="width:${pct(v, validos)}%;background:${gris ? '#B8C1CC' : h(c.color)}"></div>` : '';
  return `
  <div class="duelo">${lado(a, false)}${b ? lado(b, true) : ''}</div>
  <div class="reparto">${tramo(a, false)}${[...resto].reverse().map(x => tramo(x, true)).join('')}${b ? tramo(b, false) : ''}</div>
  <div class="mitad">50%</div>
  ${resto.length ? `<div class="resto">${resto.map(({ c, v }) => `<div class="it">${avatar(c, 46)}
    <div class="n">${h(c.nombre)}</div><div class="p">${fpct(pct(v, validos))}</div><div class="v">${fmt(v)}</div></div>`).join('')}</div>` : ''}`;
}

// ---------- Auditoría ----------
function alertas() {
  const out = [], cs = cands();
  const conTestigo = new Set(S.e_testigos.filter(t => t.rol === 'Testigo de mesa').map(t => t.centro_id + '|' + t.mesa));
  for (const m of S.e_mesas) {
    const sinTestigo = !conTestigo.has(m.centro_id + '|' + m.numero);
    if (sinTestigo) out.push({ n: 'info', m, t: 'Mesa sin testigo asignado' });
    if (!conDatos(m)) continue;
    const r = sumar([m]), part = pct(r.votantes, m.electores);
    if (m.estado === 'incidencia') out.push({ n: 'alta', m, t: 'Incidencia: ' + (m.observacion || 'revisar acta') });
    if (m.electores && part > 100) out.push({ n: 'alta', m, t: `Votaron más que los electores (${fpct(part)})` });
    else if (m.electores && part > 90) out.push({ n: 'media', m, t: `Participación inusualmente alta (${fpct(part)})` });
    const l = lider(r);
    if (l && r.validos >= 50 && pct(l.v, r.validos) >= 90) out.push({ n: 'media', m, t: `Votación concentrada: ${l.c.nombre} con ${fpct(pct(l.v, r.validos))}` });
    if (r.votantes >= 20 && pct(r.nulos, r.votantes) > 10) out.push({ n: 'media', m, t: `Muchos nulos (${fpct(pct(r.nulos, r.votantes))})` });
    if (!DEMO && !m.foto) out.push({ n: 'info', m, t: 'Acta cargada sin foto' });
  }
  return out.filter(a => cs.length || a.n === 'info');
}

function vEAuditoria() {
  if (!S.e_mesas.length) return vacioE('Aún no hay mesas', 'Agrega los centros de votación para empezar la auditoría.', 'e_centros', 'Ir a Centros y mesas');
  const al = alertas(), orden = { alta: 0, media: 1, info: 2 };
  const n = k => al.filter(a => a.n === k).length;
  const etiqueta = { alta: '<span class="est incidencia">Grave</span>', media: '<span class="pill no" style="cursor:default">Revisar</span>', info: '<span class="est pendiente">Aviso</span>' };
  const pend = S.e_mesas.filter(m => m.estado === 'pendiente').length, carg = S.e_mesas.filter(m => m.estado === 'cargada').length;
  return `
  <div class="grid" style="margin-bottom:16px">
    ${mt('ti-alert-octagon', 'Alertas graves', fmt(n('alta')), 'Incidencias y cuadres imposibles')}
    ${mt('ti-alert-triangle', 'Para revisar', fmt(n('media')), 'Patrones inusuales', 'n')}
    ${mt('ti-hourglass', 'Actas pendientes', fmt(pend), `${fmt(carg)} cargadas sin verificar`)}
  </div>
  <div class="card"><h3><i class="ti ti-list-check"></i> Alertas</h3>
    ${al.length ? [...al].sort((a, b) => orden[a.n] - orden[b.n]).map(a => `<div class="row"><div><b>${nombreMesa(a.m)}</b><div class="sub">${h(a.t)}</div></div>
      <div class="acts" style="align-items:center">${etiqueta[a.n]}<button class="mini" data-a="eIrMesa" data-v="${a.m.id}">Ver acta</button></div></div>`).join('')
      : '<div class="vacio">Sin alertas por ahora.</div>'}
  </div>`;
}

// ---------- Cargar actas ----------
function inputsVotos(pref, m) {
  return `<div class="grid">${cands().map(c => `<div><label class="f"><span class="dot" style="background:${h(c.color)}"></span>${h(c.nombre)}</label>
    <input id="${pref}_v_${c.id}" type="number" min="0" step="1" inputmode="numeric" value="${m ? h(m.votos?.[c.id] ?? '') : ''}"></div>`).join('')}
    <div><label class="f">Nulos</label><input id="${pref}_nulos" type="number" min="0" step="1" inputmode="numeric" value="${m ? h(m.nulos ?? '') : ''}"></div>
    <div><label class="f">Total votantes (según acta)</label><input id="${pref}_votantes" type="number" min="0" step="1" inputmode="numeric" value="${m ? h(m.votantes ?? '') : ''}"></div></div>
    <p class="sub" id="${pref}_suma" style="margin:10px 0 0"></p>`;
}

function leerVotos(pref) {
  const votos = {};
  for (const c of cands()) {
    const raw = $(`${pref}_v_${c.id}`).value;
    if (raw === '') return { error: `Falta el número de votos de ${c.nombre} (pon 0 si no tiene).` };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return { error: `Los votos de ${c.nombre} deben ser un número entero.` };
    votos[c.id] = n;
  }
  const nulos = $(`${pref}_nulos`).value === '' ? 0 : Number($(`${pref}_nulos`).value);
  const vr = $(`${pref}_votantes`).value, votantes = vr === '' ? null : Number(vr);
  if (!Number.isInteger(nulos) || nulos < 0 || (votantes !== null && (!Number.isInteger(votantes) || votantes < 0))) return { error: 'Nulos y votantes deben ser números enteros.' };
  return { votos, nulos, votantes };
}

function actualizarSuma(pref) {
  const el = $(`${pref}_suma`); if (!el) return;
  let s = 0; for (const c of cands()) s += Number($(`${pref}_v_${c.id}`)?.value) || 0;
  s += Number($(`${pref}_nulos`)?.value) || 0;
  const vr = $(`${pref}_votantes`)?.value;
  el.innerHTML = `Suma de votos + nulos: <b>${fmt(s)}</b>` + (vr === '' || vr == null ? '' : Number(vr) === s
    ? ' · <span style="color:var(--ok)"><i class="ti ti-check"></i> cuadra con el acta</span>'
    : ` · <span style="color:var(--err)"><i class="ti ti-x"></i> no cuadra con ${fmt(vr)}</span>`);
}

function vECargar() {
  if (!cands().length) return vacioE('Primero registra los candidatos', 'Así el acta tendrá una casilla por candidato.', 'e_candidatos', 'Ir a Candidatos');
  if (!S.e_centros.length) return vacioE('Primero agrega los centros', 'Cada centro con sus mesas.', 'e_centros', 'Ir a Centros y mesas');
  const centros = [...S.e_centros].sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!S.eCentro || !centroDe(S.eCentro)) S.eCentro = centros[0].id;
  const ms = mesasDe(S.eCentro), m = ms.find(x => x.id === S.eMesa);
  return `${msg()}
  <div class="card"><div class="grid">
    <div><label class="f">Centro de votación</label><select id="eSelCentro">${centros.map(c => {
      const t = mesasDe(c.id), k = t.filter(conDatos).length;
      return `<option value="${c.id}" ${c.id === S.eCentro ? 'selected' : ''}>${h(c.nombre)} (${k}/${t.length})</option>`; }).join('')}</select></div>
    <div><label class="f">Mesa</label><select id="eSelMesa"><option value="">Elige una mesa</option>${ms.map(x => `<option value="${x.id}" ${x.id === S.eMesa ? 'selected' : ''}>Mesa ${x.numero} · ${ESTADOS[x.estado]}</option>`).join('')}</select></div>
  </div>
  <div class="acts" style="margin-top:12px">${ms.map(x => `<button class="mini" data-a="eSelMesa" data-v="${x.id}" style="${x.id === S.eMesa ? 'border-color:var(--azul);background:var(--celeste)' : ''}">Mesa ${x.numero} ${chip(x.estado)}</button>`).join('')}</div></div>
  ${m ? `<div class="card"><div class="acts" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0"><i class="ti ti-file-certificate"></i> ${nombreMesa(m)}</h3>${chip(m.estado)}</div>
    <p class="sub" style="margin:-4px 0 12px">${m.electores ? fmt(m.electores) + ' electores en esta mesa' : 'Electores de la mesa no indicados'}${m.cargado_en ? ' · cargada ' + new Date(m.cargado_en).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}</p>
    ${m.estado === 'verificada' ? `<div class="aviso" style="background:var(--okbg);color:var(--ok);border-color:#BFE3CC"><i class="ti ti-shield-check"></i> Esta acta ya fue verificada. Si la cambias, deberá verificarse otra vez.</div>` : ''}
    ${m.estado === 'incidencia' && m.observacion ? `<div class="aviso"><i class="ti ti-alert-triangle"></i> ${h(m.observacion)}</div>` : ''}
    ${inputsVotos('x', conDatos(m) ? m : null)}
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Observación</label><input id="x_obs" placeholder="Acta con tachadura, testigo no firmó…"></div>
      ${DEMO ? '' : '<div><label class="f">Foto del acta</label><input id="x_foto" type="file" accept="image/*" capture="environment"></div>'}
    </div>
    <div class="acts" style="margin-top:14px">
      <button class="pri" data-a="eGuardarActa" data-v="${m.id}"><i class="ti ti-device-floppy"></i> Guardar acta</button>
      ${m.foto ? `<button data-a="eVerFoto" data-v="${h(m.foto)}"><i class="ti ti-photo"></i> Ver foto</button>` : ''}
    </div><p class="err" id="x_err"></p></div>` : ''}`;
}

// ---------- Verificar actas (doble digitación) ----------
function vEVerificar() {
  const ordenar = l => l.sort((a, b) => (centroDe(a.centro_id)?.nombre || '').localeCompare(centroDe(b.centro_id)?.nombre || '') || a.numero - b.numero);
  const porVer = ordenar(S.e_mesas.filter(m => m.estado === 'cargada'));
  const inc = ordenar(S.e_mesas.filter(m => m.estado === 'incidencia'));
  const ver = S.e_mesas.filter(m => m.estado === 'verificada').length;
  const m = S.e_mesas.find(x => x.id === S.eVerif);
  if (m) return `<div class="card"><h3><i class="ti ti-shield-check"></i> Verificar ${nombreMesa(m)}</h3>
    <div class="aviso" style="background:var(--celeste2);color:var(--azul);border-color:var(--celeste)"><i class="ti ti-info-circle"></i> Verificación a ciegas: otra persona copia los números directo del acta o de la foto, sin ver lo que se cargó. El sistema compara.</div>
    ${inputsVotos('y', null)}
    <div class="acts" style="margin-top:14px"><button class="pri" data-a="eComparar" data-v="${m.id}"><i class="ti ti-arrows-diff"></i> Comparar</button>
      ${m.foto ? `<button data-a="eVerFoto" data-v="${h(m.foto)}"><i class="ti ti-photo"></i> Ver foto</button>` : ''}
      <button data-a="eCancelarVerif">Cancelar</button></div><p class="err" id="y_err"></p></div>`;
  const fila = (x, extra) => `<div class="row"><div><b>${nombreMesa(x)}</b><div class="sub">${x.cargado_en ? 'Cargada ' + new Date(x.cargado_en).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}${x.observacion ? ' · ' + h(x.observacion) : ''}</div></div><div class="acts">${extra}</div></div>`;
  return `${msg()}
  <div class="grid" style="margin-bottom:16px">
    ${mt('ti-clock', 'Por verificar', fmt(porVer.length))}
    ${mt('ti-shield-check', 'Verificadas', fmt(ver), fpct(pct(ver, S.e_mesas.length)) + ' del total')}
    ${mt('ti-alert-triangle', 'Con incidencia', fmt(inc.length), '', 'n')}
  </div>
  <div class="card"><h3><i class="ti ti-clock"></i> Por verificar</h3>
    ${porVer.length ? porVer.map(x => fila(x, `<button class="mini pri" data-a="eIniciarVerif" data-v="${x.id}">Verificar</button>`)).join('') : '<div class="vacio">No hay actas esperando verificación.</div>'}</div>
  <div class="card"><h3><i class="ti ti-alert-triangle"></i> Con incidencia</h3>
    ${inc.length ? inc.map(x => fila(x, `<button class="mini" data-a="eIrMesa" data-v="${x.id}">Corregir</button><button class="mini" data-a="eIniciarVerif" data-v="${x.id}">Verificar</button>`)).join('') : '<div class="vacio">Sin incidencias.</div>'}</div>`;
}

// ---------- Centros y mesas ----------
function vECentros() {
  const lista = [...S.e_centros].sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `${msg()}
  <div class="card"><h3><i class="ti ti-plus"></i> Nuevo centro de votación</h3>
    <div class="grid">
      <div><label class="f">Nombre</label><input id="z_nombre" placeholder="U.E. Simón Bolívar"></div>
      <div><label class="f">Código CNE (opcional)</label><input id="z_codigo" placeholder="180101001"></div>
      <div><label class="f">Parroquia</label><select id="z_sector">${CFG.SECTORES.map(s => `<option>${h(s)}</option>`).join('')}</select></div>
      <div><label class="f">Número de mesas</label><input id="z_mesas" type="number" min="1" step="1" placeholder="4"></div>
      <div><label class="f">Electores por mesa (opcional)</label><input id="z_elec" type="number" min="0" step="1" placeholder="600"></div>
    </div>
    <div class="acts" style="margin-top:12px"><button class="pri" data-a="eGuardarCentro"><i class="ti ti-plus"></i> Agregar centro</button>
      <button data-a="eImportar"><i class="ti ti-file-spreadsheet"></i> Importar Excel</button><input type="file" id="eArchivo" accept=".xlsx,.xls,.csv" class="hide"></div>
    <p class="sub" style="margin:8px 0 0">Excel con columnas: centro, codigo, parroquia, mesa, electores (una fila por mesa).</p>
    <p class="err" id="z_err"></p></div>
  <div class="card"><h3><i class="ti ti-building-community"></i> Centros (${lista.length}) · ${fmt(S.e_mesas.length)} mesas · ${fmt(S.e_mesas.reduce((a, m) => a + (Number(m.electores) || 0), 0))} electores</h3>
    ${lista.length ? lista.map(c => {
      const ms = mesasDe(c.id), abierto = S.eVerCentro === c.id;
      return `<div class="row"><div><b>${h(c.nombre)}</b><div class="sub">${h(c.sector || '')}${c.codigo ? ' · ' + h(c.codigo) : ''} · ${ms.length} mesas · ${fmt(ms.reduce((a, m) => a + (Number(m.electores) || 0), 0))} electores · ${ms.filter(conDatos).length} actas</div></div>
        <div class="acts"><button class="mini" data-a="eVerCentro" data-v="${c.id}"><i class="ti ti-chevron-${abierto ? 'up' : 'down'}"></i> Mesas</button>
        <button class="mini del" data-a="eBorrarCentro" data-v="${c.id}"><i class="ti ti-trash"></i></button></div></div>
        ${abierto ? `<div class="scroll" style="margin:0 0 12px"><table class="tabla"><tr><th>Mesa</th><th>Electores</th><th>Estado</th><th></th></tr>
          ${ms.map(m => `<tr><td><b>${m.numero}</b></td><td><input id="z_me_${m.id}" type="number" min="0" step="1" value="${h(m.electores ?? '')}" style="max-width:120px"></td><td>${chip(m.estado)}</td>
            <td><button class="mini del" data-a="eBorrarMesa" data-v="${m.id}"><i class="ti ti-trash"></i></button></td></tr>`).join('')}</table>
          <button class="mini" style="margin-top:8px" data-a="eAgregarMesa" data-v="${c.id}"><i class="ti ti-plus"></i> Agregar mesa</button></div>` : ''}`;
    }).join('') : '<div class="vacio">Agrega los centros de votación del municipio o impórtalos desde Excel.</div>'}
  </div>`;
}

// ---------- Candidatos ----------
function vECandidatos() {
  const C = cands();
  return `<div class="card"><h3><i class="ti ti-user-plus"></i> Nuevo candidato</h3>
    <div class="grid">
      <div><label class="f">Nombre</label><input id="k_nombre" placeholder="Nombre y apellido"></div>
      <div><label class="f">Organización o tarjeta</label><input id="k_org" placeholder="Partido, grupo o plancha"></div>
      <div><label class="f">Color</label><input id="k_color" type="color" value="${COLORES[C.length % COLORES.length]}" style="height:40px;padding:4px"></div>
      <div><label class="f">Foto (opcional)</label><input id="k_foto" type="file" accept="image/*"></div>
    </div>
    <div style="margin-top:12px"><button class="pri" data-a="eGuardarCand"><i class="ti ti-plus"></i> Agregar</button></div><p class="err" id="k_err"></p></div>
  <div class="card"><h3><i class="ti ti-user-star"></i> Candidatos (${C.length})</h3>
    ${C.length ? C.map((c, i) => `<div class="row"><div style="display:flex;align-items:center;gap:12px">
        <label title="Cambiar foto" style="cursor:pointer;position:relative">${avatar(c, 52)}
          <span style="position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:50%;background:#fff;border:1px solid var(--borde);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--azul)"><i class="ti ti-camera"></i></span>
          <input type="file" id="k_fot_${c.id}" accept="image/*" class="hide"></label>
        <div><b>${h(c.nombre)}</b><div class="sub">${h(c.organizacion || 'Sin organización')}</div></div></div>
      <div class="acts" style="align-items:center"><input type="color" id="k_col_${c.id}" value="${h(c.color)}" title="Color" style="width:34px;height:30px;padding:2px">
        ${c.foto ? `<button class="mini" data-a="eQuitarFoto" data-v="${c.id}" title="Quitar foto"><i class="ti ti-photo-off"></i></button>` : ''}<button class="mini" data-a="eMoverCand" data-v="${c.id}" data-d="-1" ${i === 0 ? 'style="visibility:hidden"' : ''}><i class="ti ti-arrow-up"></i></button>
        <button class="mini" data-a="eMoverCand" data-v="${c.id}" data-d="1" ${i === C.length - 1 ? 'style="visibility:hidden"' : ''}><i class="ti ti-arrow-down"></i></button>
        <button class="mini del" data-a="borrar" data-t="e_candidatos" data-v="${c.id}"><i class="ti ti-trash"></i></button></div></div>`).join('')
      : '<div class="vacio">Agrega a todos los candidatos que aparecen en la boleta, en el mismo orden.</div>'}
  </div>`;
}

// ---------- Testigos ----------
function vETestigos() {
  const T = S.e_testigos, C = [...S.e_centros].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const cubiertas = new Set(T.filter(t => t.rol === 'Testigo de mesa').map(t => t.centro_id + '|' + t.mesa)).size;
  const nombreC = id => centroDe(id)?.nombre || 'Sin centro';
  return `<div class="grid" style="margin-bottom:16px">
    ${mt('ti-shield-check', 'Mesas con testigo', fpct(pct(cubiertas, S.e_mesas.length)), `${fmt(cubiertas)} de ${fmt(S.e_mesas.length)}`)}
    ${mt('ti-users-group', 'Personas registradas', fmt(T.length), `${fmt(T.filter(t => t.confirmado).length)} confirmadas`)}
  </div>
  <div class="card"><h3><i class="ti ti-user-plus"></i> Nuevo testigo o coordinador</h3>
    <div class="grid">
      <div><label class="f">Nombre</label><input id="w_nombre" placeholder="Carlos Rivas"></div>
      <div><label class="f">Teléfono</label><input id="w_tel" placeholder="0414-1234567"></div>
      <div><label class="f">Centro</label><select id="w_centro">${C.length ? C.map(c => `<option value="${c.id}">${h(c.nombre)}</option>`).join('') : '<option value="">Primero agrega un centro</option>'}</select></div>
      <div><label class="f">Mesa</label><input id="w_mesa" type="number" min="1" step="1" placeholder="1"></div>
      <div><label class="f">Rol</label><select id="w_rol"><option>Testigo de mesa</option><option>Coordinador de centro</option><option>Movilización</option></select></div>
    </div>
    <div style="margin-top:12px"><button class="pri" data-a="eGuardarTestigo"><i class="ti ti-plus"></i> Agregar</button></div><p class="err" id="w_err"></p></div>
  <div class="card"><div class="acts" style="justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0"><i class="ti ti-users-group"></i> Equipo del día</h3>
    ${T.length ? '<button class="mini" data-a="eExportarTestigos"><i class="ti ti-download"></i> Exportar a Excel</button>' : ''}</div>
    ${T.length ? [...T].sort((a, b) => nombreC(a.centro_id).localeCompare(nombreC(b.centro_id)) || (a.mesa || 0) - (b.mesa || 0)).map(t => `<div class="row"><div><b>${h(t.nombre)}</b>
        <div class="sub">${h(t.rol)} · ${h(nombreC(t.centro_id))}${t.mesa ? ' · mesa ' + h(t.mesa) : ''} · ${h(t.telefono)}</div></div>
      <div class="acts"><button class="pill ${t.confirmado ? 'ok' : 'no'}" data-a="eToggleTestigo" data-v="${t.id}">${t.confirmado ? 'Confirmado' : 'Por confirmar'}</button>
      ${telWa(t.telefono) ? `<button class="mini" data-a="eWaTestigo" data-v="${t.id}"><i class="ti ti-brand-whatsapp"></i></button>` : ''}
      <button class="mini del" data-a="borrar" data-t="e_testigos" data-v="${t.id}"><i class="ti ti-trash"></i></button></div></div>`).join('')
      : '<div class="vacio">Registra a los testigos de cada mesa.</div>'}
  </div>`;
}

Object.assign(VIEWS, { e_resumen: vEResumen, e_auditoria: vEAuditoria, e_cargar: vECargar, e_verificar: vEVerificar, e_centros: vECentros, e_candidatos: vECandidatos, e_testigos: vETestigos });

// ---------- Acciones ----------
async function recargarE() { for (const t of ['e_candidatos', 'e_centros', 'e_mesas', 'e_testigos']) S[t] = await db.list(t); }

async function subirFoto(file, carpeta) {
  const ruta = `${carpeta}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await sb.storage.from('actas').upload(ruta, file);
  if (error) throw error;
  return ruta;
}

Object.assign(A, {
  eRefrescar: () => accion(async () => { await recargarE(); render(); }),
  eIrCentro: ({ v }) => { S.eCentro = v; S.eMesa = ''; S.tab = 'e_cargar'; render(); scrollTo(0, 0); },
  eIrMesa: ({ v }) => { const m = S.e_mesas.find(x => x.id === v); if (!m) return; S.eCentro = m.centro_id; S.eMesa = v; S.tab = 'e_cargar'; render(); scrollTo(0, 0); },
  eSelMesa: ({ v }) => { S.eMesa = v; render(); },
  eVerFoto: ({ v }) => accion(async () => {
    const { data, error } = await sb.storage.from('actas').createSignedUrl(v, 600);
    if (error) throw error; window.open(data.signedUrl, '_blank');
  }),

  eGuardarActa: ({ v }) => accion(async () => {
    const m = S.e_mesas.find(x => x.id === v), r = leerVotos('x');
    if (r.error) { $('x_err').textContent = r.error; return; }
    const suma = Object.values(r.votos).reduce((a, b) => a + b, 0) + r.nulos, total = r.votantes ?? suma, problemas = [];
    if (r.votantes !== null && suma !== r.votantes) problemas.push(`La suma (${suma}) no cuadra con el total de votantes del acta (${r.votantes})`);
    if (m.electores && total > m.electores) problemas.push(`Votaron más personas (${total}) que electores de la mesa (${m.electores})`);
    if (problemas.length && !confirm(problemas.join('\n') + '\n\n¿Guardar igual y marcar la mesa con incidencia?')) return;
    const f = $('x_foto')?.files[0];
    const foto = f ? await subirFoto(f, centroDe(m.centro_id)?.codigo || m.centro_id) : m.foto || null;
    await db.update('e_mesas', m.id, { votos: r.votos, nulos: r.nulos, votantes: total, foto,
      estado: problemas.length ? 'incidencia' : 'cargada', observacion: [$('x_obs').value.trim(), ...problemas].filter(Boolean).join(' · ') || null,
      cargado_en: new Date().toISOString(), verificado_en: null });
    S.e_mesas = await db.list('e_mesas');
    const sig = mesasDe(m.centro_id).find(x => x.estado === 'pendiente');
    S.eMesa = sig ? sig.id : '';
    S.eMsg = { ok: !problemas.length, t: `Mesa ${m.numero} guardada${problemas.length ? ' con incidencia' : ''}.${sig ? ` Sigue la mesa ${sig.numero}.` : ''}` };
    render(); scrollTo(0, 0);
  }),

  eIniciarVerif: ({ v }) => { S.eVerif = v; S.tab = 'e_verificar'; render(); scrollTo(0, 0); },
  eCancelarVerif: () => { S.eVerif = null; render(); },
  eComparar: ({ v }) => accion(async () => {
    const m = S.e_mesas.find(x => x.id === v), r = leerVotos('y');
    if (r.error) { $('y_err').textContent = r.error; return; }
    const difs = [];
    for (const c of cands()) if ((m.votos?.[c.id] ?? 0) !== r.votos[c.id]) difs.push(`${c.nombre}: cargado ${m.votos?.[c.id] ?? 0}, verificado ${r.votos[c.id]}`);
    if ((m.nulos ?? 0) !== r.nulos) difs.push(`Nulos: cargado ${m.nulos ?? 0}, verificado ${r.nulos}`);
    if (r.votantes !== null && m.votantes !== r.votantes) difs.push(`Votantes: cargado ${m.votantes}, verificado ${r.votantes}`);
    if (difs.length) {
      await db.update('e_mesas', m.id, { estado: 'incidencia', observacion: 'No coincide la verificación: ' + difs.join('; ') });
      S.eMsg = { ok: false, t: `Mesa ${m.numero}: los números no coinciden. Quedó con incidencia para revisar el acta.` };
    } else {
      await db.update('e_mesas', m.id, { estado: 'verificada', observacion: null, verificado_en: new Date().toISOString() });
      S.eMsg = { ok: true, t: `Mesa ${m.numero} verificada: los números coinciden.` };
    }
    S.eVerif = null; S.e_mesas = await db.list('e_mesas'); render(); scrollTo(0, 0);
  }),

  eGuardarCentro: () => accion(async () => {
    const nombre = $('z_nombre').value.trim(), n = Math.round(Number($('z_mesas').value)), elec = Math.round(Number($('z_elec').value)) || null;
    if (!nombre || !(n > 0)) { $('z_err').textContent = 'Escribe el nombre y cuántas mesas tiene.'; return; }
    const [c] = await db.insert('e_centros', { nombre, codigo: $('z_codigo').value.trim() || null, sector: $('z_sector').value });
    await db.insert('e_mesas', Array.from({ length: n }, (_, i) => ({ centro_id: c.id, numero: i + 1, electores: elec, estado: 'pendiente', votos: {} })));
    await recargarE(); S.eMsg = { ok: true, t: `Centro ${nombre} agregado con ${n} mesas.` }; render();
  }),
  eVerCentro: ({ v }) => { S.eVerCentro = S.eVerCentro === v ? null : v; render(); },
  eAgregarMesa: ({ v }) => accion(async () => {
    const n = Math.max(0, ...mesasDe(v).map(m => m.numero)) + 1;
    await db.insert('e_mesas', { centro_id: v, numero: n, estado: 'pendiente', votos: {} });
    S.e_mesas = await db.list('e_mesas'); render();
  }),
  eBorrarMesa: ({ v }) => accion(async () => {
    const m = S.e_mesas.find(x => x.id === v);
    if (!confirm(`¿Borrar la mesa ${m.numero}${conDatos(m) ? ' y su acta cargada' : ''}?`)) return;
    await db.remove('e_mesas', v); S.e_mesas = await db.list('e_mesas'); render();
  }),
  eBorrarCentro: ({ v }) => accion(async () => {
    const c = centroDe(v);
    if (!confirm(`¿Borrar ${c.nombre} con todas sus mesas, actas y testigos?`)) return;
    if (DEMO) {
      local.set('e_mesas', local.get('e_mesas').filter(m => m.centro_id !== v));
      local.set('e_testigos', local.get('e_testigos').filter(t => t.centro_id !== v));
    }
    await db.remove('e_centros', v); await recargarE(); render();
  }),
  eImportar: () => $('eArchivo').click(),

  eGuardarCand: () => accion(async () => {
    const nombre = $('k_nombre').value.trim();
    if (!nombre) { $('k_err').textContent = 'Escribe el nombre del candidato.'; return; }
    const f = $('k_foto').files[0], foto = f ? await fotoReducida(f) : null;
    await db.insert('e_candidatos', { nombre, organizacion: $('k_org').value.trim() || null, color: $('k_color').value, foto, orden: S.e_candidatos.length });
    S.e_candidatos = await db.list('e_candidatos'); render();
  }),
  eQuitarFoto: ({ v }) => accion(async () => {
    await db.update('e_candidatos', v, { foto: null }); S.e_candidatos = await db.list('e_candidatos'); render();
  }),
  eMoverCand: ({ v, d }) => accion(async () => {
    const C = cands(), i = C.findIndex(c => c.id === v), j = i + Number(d);
    if (j < 0 || j >= C.length) return;
    [C[i], C[j]] = [C[j], C[i]];
    for (let k = 0; k < C.length; k++) if (C[k].orden !== k) await db.update('e_candidatos', C[k].id, { orden: k });
    S.e_candidatos = await db.list('e_candidatos'); render();
  }),

  eGuardarTestigo: () => accion(async () => {
    const nombre = $('w_nombre').value.trim(), centro_id = $('w_centro').value;
    if (!nombre || !centro_id) { $('w_err').textContent = 'Escribe el nombre y elige un centro.'; return; }
    await db.insert('e_testigos', { nombre, telefono: $('w_tel').value.trim(), centro_id, mesa: Math.round(Number($('w_mesa').value)) || null, rol: $('w_rol').value, confirmado: false });
    S.e_testigos = await db.list('e_testigos'); render();
  }),
  eToggleTestigo: ({ v }) => accion(async () => {
    const t = S.e_testigos.find(x => x.id === v);
    await db.update('e_testigos', v, { confirmado: !t.confirmado }); t.confirmado = !t.confirmado; render();
  }),
  eWaTestigo: ({ v }) => {
    const t = S.e_testigos.find(x => x.id === v), c = centroDe(t.centro_id);
    const texto = `Hola ${t.nombre.split(/\s+/)[0]}, te recordamos que eres ${t.rol.toLowerCase()} en ${c?.nombre || 'tu centro'}${t.mesa ? ', mesa ' + t.mesa : ''}. Al cierre, toma foto clara del acta completa con firmas y envíala. ¿Confirmas?`;
    window.open('https://wa.me/' + telWa(t.telefono) + '?text=' + encodeURIComponent(texto), '_blank');
  },
  eExportarTestigos: () => exportar(S.e_testigos.map(t => ({ nombre: t.nombre, telefono: t.telefono, rol: t.rol, centro: centroDe(t.centro_id)?.nombre || '', mesa: t.mesa, confirmado: t.confirmado ? 'sí' : 'no' })), 'testigos')
});

async function importarCentros(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const col = (r, ...ks) => { for (const k of Object.keys(r)) { const n = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); if (ks.includes(n)) return String(r[k]).trim(); } return ''; };
  const grupos = new Map();
  for (const r of filas) {
    const nombre = col(r, 'centro', 'nombre', 'centro de votacion');
    if (!nombre) continue;
    if (!grupos.has(nombre)) grupos.set(nombre, { codigo: col(r, 'codigo', 'cod', 'codigo cne'), sector: col(r, 'parroquia', 'sector') || CFG.SECTORES[0], mesas: [] });
    const g = grupos.get(nombre);
    g.mesas.push({ numero: Math.round(Number(col(r, 'mesa', 'numero', 'nro'))) || g.mesas.length + 1, electores: Math.round(Number(col(r, 'electores', 'votantes', 'inscritos'))) || null });
  }
  if (!grupos.size) { alert('No encontré centros. Revisa que haya una columna "centro".'); return; }
  let nMesas = 0;
  for (const [nombre, g] of grupos) {
    let c = S.e_centros.find(x => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!c) [c] = await db.insert('e_centros', { nombre, codigo: g.codigo || null, sector: g.sector });
    const ya = new Set(S.e_mesas.filter(m => m.centro_id === c.id).map(m => m.numero));
    const nuevas = g.mesas.filter(m => !ya.has(m.numero)).map(m => ({ centro_id: c.id, numero: m.numero, electores: m.electores, estado: 'pendiente', votos: {} }));
    if (nuevas.length) await db.insert('e_mesas', nuevas);
    nMesas += nuevas.length;
  }
  await recargarE(); S.eMsg = { ok: true, t: `Importados ${grupos.size} centros y ${nMesas} mesas.` }; render();
}

document.addEventListener('input', e => {
  const id = e.target.id || '';
  if (/^x_(v_|nulos|votantes)/.test(id)) actualizarSuma('x');
  if (/^y_(v_|nulos|votantes)/.test(id)) actualizarSuma('y');
});
document.addEventListener('change', e => {
  const t = e.target, id = t.id || '';
  if (id === 'eSelCentro') { S.eCentro = t.value; S.eMesa = ''; render(); }
  if (id === 'eSelMesa') { S.eMesa = t.value; render(); }
  if (id === 'eSoloVerif') { S.eSoloVerif = t.checked; render(); }
  if (id === 'eArchivo' && t.files[0]) accion(() => importarCentros(t.files[0]));
  if (id.startsWith('z_me_')) accion(async () => {
    const mid = id.slice(5), n = t.value === '' ? null : Math.round(Number(t.value));
    await db.update('e_mesas', mid, { electores: n }); const m = S.e_mesas.find(x => x.id === mid); if (m) m.electores = n;
  });
  if (id.startsWith('k_fot_') && t.files[0]) accion(async () => {
    await db.update('e_candidatos', id.slice(6), { foto: await fotoReducida(t.files[0]) });
    S.e_candidatos = await db.list('e_candidatos'); render();
  });
  if (id.startsWith('k_col_')) accion(async () => {
    const cid = id.slice(6); await db.update('e_candidatos', cid, { color: t.value });
    const c = S.e_candidatos.find(x => x.id === cid); if (c) c.color = t.value;
  });
});

// Resultados en vivo: con Supabase, refresca cada 20 s mientras se mira el panel de resultados.
setInterval(() => {
  if (DEMO || S.modulo !== 'elecciones' || S.tab !== 'e_resumen' || document.hidden) return;
  recargarE().then(render).catch(console.error);
}, 20000);
