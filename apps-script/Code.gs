/**
 * Cobros Streaming
 * Control de cobros de cuentas de streaming con recordatorios por WhatsApp.
 * Creada y de autoría del Ing. Moisés Mendoza.
 *
 * Este script es el SERVIDOR de datos (API). La app que se instala en el celular está en
 * GitHub Pages (index.html) y se conecta aquí con la URL /exec y una clave.
 *
 * Implementar como Aplicación web:  Ejecutar como: Yo  ·  Acceso: Cualquier usuario.
 * La clave protege los datos: la primera vez que la app se conecta, la clave que escribas
 * queda guardada como la clave del servidor. Para cambiarla, ejecuta reiniciarClave() en el editor.
 *
 * Cada amigo que quiera sus propios datos hace su propia copia de este script y conecta la
 * app con su URL y su clave.
 */

const APP_URL = 'https://moydominguez044-stack.github.io/-CobroStreaming/';

const APP_NAME = 'Cobros Streaming';
const SCHEMA_VERSION = '1';

const SHEETS = {
  Servicios:     ['id', 'nombre', 'precio', 'color', 'activo'],
  Clientes:      ['id', 'nombre', 'telefono', 'notas', 'ultimoAviso', 'activo'],
  Suscripciones: ['id', 'clienteId', 'servicioId', 'perfil', 'precio', 'diaCorte', 'vencimiento', 'activo', 'creado'],
  Pagos:         ['id', 'fecha', 'clienteId', 'suscripcionId', 'meses', 'monto', 'nota', 'desde', 'hasta'],
  Config:        ['clave', 'valor']
};

const DEFAULT_CONFIG = {
  negocio: 'Mis Cuentas Streaming',
  moneda: 'C$',
  codigoPais: '505',
  diasAntes: '3',
  horaResumen: '7',
  plantilla:
    'Hola {nombre} 👋\n\n' +
    'Te recuerdo el pago de tus cuentas:\n{detalle}\n\n' +
    '*Total: {total}*\n\n' +
    '¡Gracias! — {negocio}'
};

const SERVICIOS_INICIALES = [
  ['Netflix', '#E50914'], ['Disney+', '#113CCF'], ['Max', '#5822B4'],
  ['Prime Video', '#00A8E1'], ['Spotify', '#1DB954'], ['YouTube Premium', '#FF0033'],
  ['Paramount+', '#0064FF'], ['Crunchyroll', '#F47521']
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* =========================================================
 * Web app
 * ========================================================= */

/** Abrir la URL /exec en el navegador lleva a la app instalable. */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:system-ui,sans-serif;text-align:center;padding:40px 16px">' +
    '<h2>📺 ' + APP_NAME + '</h2><p>Este es el servidor de datos. La app está aquí:</p>' +
    '<p><a target="_top" style="background:#4338ca;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700" href="' + APP_URL + '">Abrir la app</a></p></div>'
  ).setTitle(APP_NAME);
}

const API_FUNCIONES = {
  getData: getData, saveServicio: saveServicio, deleteServicio: deleteServicio,
  saveCliente: saveCliente, deleteCliente: deleteCliente, saveSuscripcion: saveSuscripcion,
  deleteSuscripcion: deleteSuscripcion, registrarPagos: registrarPagos, deletePago: deletePago,
  marcarAviso: marcarAviso, saveConfig: saveConfig, activarResumen: activarResumen
};

/**
 * API JSON. Cuerpo: {"key": "...", "fn": "getData", "args": [...]}
 * Responde {"ok": true, "data": ...} o {"ok": false, "error": "..."}.
 */
function doPost(e) {
  let res;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    validarClave_(req.key);
    const fn = API_FUNCIONES[req.fn];
    if (!fn) throw new Error('Función no permitida: ' + req.fn);
    res = { ok: true, data: fn.apply(null, req.args || []) };
  } catch (err) {
    res = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function hashClave_(k) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cobros|' + k));
}

function validarClave_(key) {
  key = String(key || '').trim();
  if (key.length < 4) throw new Error('CLAVE: escribe una clave de al menos 4 caracteres.');
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty('API_KEY_HASH');
  if (!guardada) {
    // Primera conexión: esta clave queda como la clave del servidor.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (!props.getProperty('API_KEY_HASH')) props.setProperty('API_KEY_HASH', hashClave_(key));
    } finally { lock.releaseLock(); }
    return;
  }
  if (guardada !== hashClave_(key)) throw new Error('CLAVE: la clave no es correcta.');
}

/** Ejecútalo desde el editor si olvidaste la clave: la próxima clave que uses en la app será la nueva. */
function reiniciarClave() {
  PropertiesService.getScriptProperties().deleteProperty('API_KEY_HASH');
}

/* =========================================================
 * Almacenamiento (una hoja de cálculo por usuario)
 * ========================================================= */

let _ss = null;

function ss_() {
  if (_ss) return _ss;
  const props = PropertiesService.getUserProperties();
  const id = props.getProperty('SS_ID');
  let ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(APP_NAME + ' — Datos');
    props.setProperty('SS_ID', ss.getId());
    props.deleteProperty('SCHEMA');
  }
  if (props.getProperty('SCHEMA') !== SCHEMA_VERSION) {
    prepararHojas_(ss);
    props.setProperty('SCHEMA', SCHEMA_VERSION);
  }
  _ss = ss;
  return ss;
}

function prepararHojas_(ss) {
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1e1b4b').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });

  // Quitar la hoja vacía que trae por defecto
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });

  // Config por defecto
  const cfgSh = ss.getSheetByName('Config');
  if (cfgSh.getLastRow() < 2) {
    const rows = Object.keys(DEFAULT_CONFIG).map(function (k) { return [k, DEFAULT_CONFIG[k]]; });
    cfgSh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  }

  // Servicios comunes (precio vacío para que el usuario lo defina)
  const svSh = ss.getSheetByName('Servicios');
  if (svSh.getLastRow() < 2) {
    const rows = SERVICIOS_INICIALES.map(function (s) { return [nuevoId_(), s[0], '', s[1], 'si']; });
    svSh.getRange(2, 1, rows.length, 5).setNumberFormat('@').setValues(rows);
  }
}

function tz_() {
  return Session.getScriptTimeZone() || 'America/Managua';
}

function hoy_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

function nuevoId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function read_(name) {
  const sh = ss_().getSheetByName(name);
  const vals = sh.getDataRange().getValues();
  const h = vals.shift() || [];
  return vals
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      const o = {};
      h.forEach(function (k, i) { o[k] = norm_(r[i]); });
      return o;
    });
}

function upsert_(name, obj) {
  const headers = SHEETS[name];
  const sh = ss_().getSheetByName(name);
  if (!obj.id) obj.id = nuevoId_();
  const row = headers.map(function (k) { return obj[k] === undefined || obj[k] === null ? '' : String(obj[k]); });
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  const idx = ids.indexOf(String(obj.id));
  const rowNum = idx >= 0 ? idx + 2 : sh.getLastRow() + 1;
  sh.getRange(rowNum, 1, 1, headers.length).setNumberFormat('@').setValues([row]);
  return obj;
}

function borrar_(name, id) {
  const sh = ss_().getSheetByName(name);
  if (sh.getLastRow() < 2) return;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
  const idx = ids.indexOf(String(id));
  if (idx >= 0) sh.deleteRow(idx + 2);
}

function conLock_(fn) {
  const lock = LockService.getUserLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getConfig_() {
  const cfg = Object.assign({}, DEFAULT_CONFIG);
  read_('Config').forEach(function (r) { if (r.clave) cfg[r.clave] = r.valor; });
  return cfg;
}

/* =========================================================
 * Fechas
 * ========================================================= */

function partes_(s) {
  const p = String(s).split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

function diasDelMes_(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }

/** Suma n meses a una fecha yyyy-MM-dd respetando el día de corte (si el mes es más corto, usa el último día). */
function sumarMeses_(base, n, diaCorte) {
  const b = partes_(base);
  const total = (b.y * 12 + (b.m - 1)) + Number(n);
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const dc = Number(diaCorte) || b.d;
  const d = Math.min(dc, diasDelMes_(y, m));
  return y + '-' + pad_(m) + '-' + pad_(d);
}

function diffDias_(a, b) {
  const pa = partes_(a), pb = partes_(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

function fechaCorta_(s) {
  const p = partes_(s);
  return pad_(p.d) + '/' + pad_(p.m);
}

function mesLabel_(s, hoy) {
  const p = partes_(s);
  const hy = partes_(hoy).y;
  return MESES[p.m - 1] + (p.y !== hy ? ' ' + String(p.y).slice(2) : '');
}

function dinero_(n, moneda) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  const partes = v.toFixed(2).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const txt = partes[1] === '00' ? partes[0] : partes.join('.');
  return (moneda ? moneda + ' ' : '') + txt;
}

/* =========================================================
 * Cálculo de cobros y meses acumulados
 * ========================================================= */

const ORDEN_ESTADO = { vencido: 0, hoy: 1, proximo: 2, aldia: 3, pausada: 4, sin: 5 };

function telefonoWa_(tel, codigoPais) {
  let t = String(tel || '').replace(/\D/g, '');
  if (!t) return '';
  if (t.length <= 8 && codigoPais) t = String(codigoPais).replace(/\D/g, '') + t;
  return t;
}

function calcular_(cfg, servicios, clientes, subs, hoy) {
  const diasAntes = Number(cfg.diasAntes) || 0;
  const moneda = cfg.moneda || '';
  const sMap = {};
  servicios.forEach(function (s) { sMap[s.id] = s; });

  const cMap = {};
  clientes.forEach(function (c) {
    cMap[c.id] = Object.assign({}, c, { subs: [], total: 0, deuda: 0, mesesPendientes: 0, estado: 'sin', proximaFecha: '' });
  });

  const subsOut = subs.map(function (su) {
    const sv = sMap[su.servicioId] || { nombre: '(servicio eliminado)', precio: '0', color: '#888888' };
    const precio = su.precio !== '' ? Number(su.precio) || 0 : Number(sv.precio) || 0;
    const venc = su.vencimiento;
    const pendientes = [];
    if (su.activo !== 'no' && venc && venc <= hoy) {
      let k = 0, d = venc;
      while (d <= hoy && k < 120) {
        pendientes.push(d);
        k++;
        d = sumarMeses_(venc, k, su.diaCorte);
      }
    }
    const meses = pendientes.length;
    const dias = venc ? diffDias_(hoy, venc) : null;

    let estado = 'aldia';
    if (su.activo === 'no') estado = 'pausada';
    else if (meses > 0) estado = (venc === hoy && meses === 1) ? 'hoy' : 'vencido';
    else if (dias !== null && dias <= diasAntes) estado = 'proximo';

    const deuda = meses * precio;
    const aCobrar = estado === 'proximo' ? precio : deuda;
    const nombre = sv.nombre + (su.perfil ? ' (' + su.perfil + ')' : '');

    let linea;
    if (estado === 'vencido') {
      linea = '• ' + nombre + ': ' + meses + (meses === 1 ? ' mes' : ' meses') + ' (' +
        pendientes.map(function (p) { return mesLabel_(p, hoy); }).join(', ') + ') — ' + dinero_(deuda, moneda);
    } else if (estado === 'hoy') {
      linea = '• ' + nombre + ': vence hoy — ' + dinero_(precio, moneda);
    } else if (estado === 'proximo') {
      linea = '• ' + nombre + ': vence el ' + fechaCorta_(venc) + ' — ' + dinero_(precio, moneda);
    } else {
      linea = '• ' + nombre + ': próximo pago el ' + (venc ? fechaCorta_(venc) : '—') + ' — ' + dinero_(precio, moneda);
    }

    const out = Object.assign({}, su, {
      servicioNombre: sv.nombre, color: sv.color || '#888888', precioEfectivo: precio,
      mesesPendientes: meses, pendientes: pendientes.map(function (p) { return mesLabel_(p, hoy); }),
      diasParaVencer: dias, estado: estado, deuda: deuda, aCobrar: aCobrar, linea: linea
    });

    const c = cMap[su.clienteId];
    if (c) {
      c.subs.push(out);
      if (estado !== 'pausada') {
        if (ORDEN_ESTADO[estado] < ORDEN_ESTADO[c.estado]) c.estado = estado;
        c.deuda += deuda;
        c.mesesPendientes += meses;
        if (estado === 'vencido' || estado === 'hoy' || estado === 'proximo') c.total += aCobrar;
        if (venc && (!c.proximaFecha || venc < c.proximaFecha)) c.proximaFecha = venc;
      } else if (c.estado === 'sin') {
        c.estado = 'pausada';
      }
    }
    return out;
  });

  const resumen = { porCobrar: 0, vencidos: 0, hoy: 0, proximos: 0, clientes: clientes.length, cuentas: 0, ingresoMensual: 0 };

  const clientesOut = Object.keys(cMap).map(function (id) {
    const c = cMap[id];
    const activas = c.subs.filter(function (s) { return s.estado !== 'pausada'; });
    const conCobro = activas.filter(function (s) { return ['vencido', 'hoy', 'proximo'].indexOf(s.estado) >= 0; });
    const lineas = (conCobro.length ? conCobro : activas).map(function (s) { return s.linea; });
    const total = conCobro.length ? c.total : activas.reduce(function (a, s) { return a + s.precioEfectivo; }, 0);

    c.mensaje = String(cfg.plantilla || DEFAULT_CONFIG.plantilla)
      .replace(/\{nombre\}/g, (c.nombre || '').split(' ')[0])
      .replace(/\{nombreCompleto\}/g, c.nombre || '')
      .replace(/\{detalle\}/g, lineas.join('\n'))
      .replace(/\{total\}/g, dinero_(total, moneda))
      .replace(/\{meses\}/g, String(c.mesesPendientes))
      .replace(/\{negocio\}/g, cfg.negocio || '');

    const tel = telefonoWa_(c.telefono, cfg.codigoPais);
    c.wa = tel ? 'https://wa.me/' + tel + '?text=' + encodeURIComponent(c.mensaje) : '';
    c.avisadoHoy = c.ultimoAviso === hoy;

    if (c.estado === 'vencido') resumen.vencidos++;
    if (c.estado === 'hoy') resumen.hoy++;
    if (c.estado === 'proximo') resumen.proximos++;
    resumen.porCobrar += c.deuda;
    resumen.cuentas += activas.length;
    resumen.ingresoMensual += activas.reduce(function (a, s) { return a + s.precioEfectivo; }, 0);
    return c;
  });

  clientesOut.sort(function (a, b) {
    return (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) ||
      String(a.proximaFecha || '9999').localeCompare(String(b.proximaFecha || '9999')) ||
      String(a.nombre).localeCompare(String(b.nombre));
  });

  return { clientes: clientesOut, subs: subsOut, resumen: resumen };
}

/* =========================================================
 * API para la interfaz
 * ========================================================= */

function getData() {
  const cfg = getConfig_();
  const hoy = hoy_();
  const servicios = read_('Servicios');
  const clientes = read_('Clientes').filter(function (c) { return c.activo !== 'no'; });
  const subs = read_('Suscripciones');
  const pagos = read_('Pagos').sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  const calc = calcular_(cfg, servicios, clientes, subs, hoy);

  const mesActual = hoy.slice(0, 7);
  calc.resumen.cobradoMes = pagos
    .filter(function (p) { return String(p.fecha).slice(0, 7) === mesActual; })
    .reduce(function (a, p) { return a + (Number(p.monto) || 0); }, 0);

  return {
    hoy: hoy,
    config: cfg,
    servicios: servicios,
    clientes: calc.clientes,
    suscripciones: calc.subs,
    pagos: pagos,
    resumen: calc.resumen,
    ssUrl: ss_().getUrl(),
    resumenActivo: resumenActivo_(),
    email: Session.getEffectiveUser().getEmail()
  };
}

function saveServicio(o) {
  return conLock_(function () {
    upsert_('Servicios', {
      id: o.id, nombre: String(o.nombre || '').trim(), precio: Number(o.precio) || 0,
      color: o.color || '#6366f1', activo: o.activo === 'no' ? 'no' : 'si'
    });
    return getData();
  });
}

function deleteServicio(id) {
  return conLock_(function () {
    const usado = read_('Suscripciones').some(function (s) { return s.servicioId === id; });
    if (usado) throw new Error('Este servicio tiene cuentas asignadas. Elimínalas o cámbialas primero.');
    borrar_('Servicios', id);
    return getData();
  });
}

function saveCliente(o) {
  return conLock_(function () {
    const prev = o.id ? read_('Clientes').filter(function (c) { return c.id === o.id; })[0] : null;
    upsert_('Clientes', {
      id: o.id, nombre: String(o.nombre || '').trim(), telefono: String(o.telefono || '').trim(),
      notas: o.notas || '', ultimoAviso: prev ? prev.ultimoAviso : '', activo: 'si'
    });
    return getData();
  });
}

function deleteCliente(id) {
  return conLock_(function () {
    read_('Suscripciones').filter(function (s) { return s.clienteId === id; })
      .forEach(function (s) { borrar_('Suscripciones', s.id); });
    borrar_('Clientes', id);
    return getData();
  });
}

function saveSuscripcion(o) {
  return conLock_(function () {
    if (!o.clienteId || !o.servicioId) throw new Error('Falta el cliente o el servicio.');
    if (!o.vencimiento) throw new Error('Indica la próxima fecha de pago.');
    const prev = o.id ? read_('Suscripciones').filter(function (s) { return s.id === o.id; })[0] : null;
    upsert_('Suscripciones', {
      id: o.id, clienteId: o.clienteId, servicioId: o.servicioId, perfil: o.perfil || '',
      precio: o.precio === '' || o.precio === null || o.precio === undefined ? '' : Number(o.precio),
      diaCorte: Number(o.diaCorte) || partes_(o.vencimiento).d,
      vencimiento: o.vencimiento, activo: o.activo === 'no' ? 'no' : 'si',
      creado: prev ? prev.creado : hoy_()
    });
    return getData();
  });
}

function deleteSuscripcion(id) {
  return conLock_(function () {
    borrar_('Suscripciones', id);
    return getData();
  });
}

/**
 * Registra uno o varios pagos.
 * lista: [{ suscripcionId, meses, monto, fecha, nota }]
 * Cada pago adelanta la próxima fecha de pago tantos meses como se pagaron.
 */
function registrarPagos(lista) {
  return conLock_(function () {
    const subs = read_('Suscripciones');
    (lista || []).forEach(function (p) {
      const meses = Math.max(1, Math.floor(Number(p.meses) || 1));
      const su = subs.filter(function (s) { return s.id === p.suscripcionId; })[0];
      if (!su) throw new Error('No se encontró la cuenta del pago.');
      const fecha = p.fecha || hoy_();
      const desde = su.vencimiento || fecha;
      const hasta = sumarMeses_(desde, meses, su.diaCorte);
      su.vencimiento = hasta;
      upsert_('Suscripciones', su);
      upsert_('Pagos', {
        fecha: fecha, clienteId: su.clienteId, suscripcionId: su.id, meses: meses,
        monto: Number(p.monto) || 0, nota: p.nota || '', desde: desde, hasta: hasta
      });
    });
    return getData();
  });
}

/** Anula un pago: si la cuenta no se ha movido desde ese pago, devuelve la fecha de vencimiento a la anterior. */
function deletePago(id) {
  return conLock_(function () {
    const pago = read_('Pagos').filter(function (p) { return p.id === id; })[0];
    if (!pago) return getData();
    const su = read_('Suscripciones').filter(function (s) { return s.id === pago.suscripcionId; })[0];
    if (su && su.vencimiento === pago.hasta && pago.desde) {
      su.vencimiento = pago.desde;
      upsert_('Suscripciones', su);
    }
    borrar_('Pagos', id);
    return getData();
  });
}

function marcarAviso(clienteId) {
  return conLock_(function () {
    const c = read_('Clientes').filter(function (x) { return x.id === clienteId; })[0];
    if (c) { c.ultimoAviso = hoy_(); upsert_('Clientes', c); }
    return true;
  });
}

function saveConfig(o) {
  return conLock_(function () {
    const sh = ss_().getSheetByName('Config');
    const actual = getConfig_();
    Object.keys(o || {}).forEach(function (k) { actual[k] = o[k]; });
    const rows = Object.keys(actual).map(function (k) { return [k, String(actual[k])]; });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
    sh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
    if (resumenActivo_()) instalarResumen_(Number(actual.horaResumen) || 7);
    return getData();
  });
}

/* =========================================================
 * Resumen diario por correo (recordatorio automático)
 * ========================================================= */

function resumenActivo_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'resumenDiario'; });
}

function instalarResumen_(hora) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'resumenDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resumenDiario').timeBased().everyDays(1).atHour(hora).nearMinute(0).create();
}

function activarResumen(activar) {
  if (activar) instalarResumen_(Number(getConfig_().horaResumen) || 7);
  else ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'resumenDiario') ScriptApp.deleteTrigger(t);
  });
  return getData();
}

function esc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Se ejecuta todos los días: manda al correo del dueño la lista de cobros del día con botones de WhatsApp. */
function resumenDiario() {
  const cfg = getConfig_();
  const hoy = hoy_();
  const clientes = read_('Clientes').filter(function (c) { return c.activo !== 'no'; });
  const calc = calcular_(cfg, read_('Servicios'), clientes, read_('Suscripciones'), hoy);
  const pendientes = calc.clientes.filter(function (c) { return ['vencido', 'hoy', 'proximo'].indexOf(c.estado) >= 0; });
  if (!pendientes.length) return;

  const etiquetas = { vencido: 'Vencido', hoy: 'Vence hoy', proximo: 'Por vencer' };
  const colores = { vencido: '#dc2626', hoy: '#d97706', proximo: '#2563eb' };
  const url = APP_URL;

  const filas = pendientes.map(function (c) {
    const det = c.subs.filter(function (s) { return ['vencido', 'hoy', 'proximo'].indexOf(s.estado) >= 0; })
      .map(function (s) { return esc_(s.linea); }).join('<br>');
    const boton = c.wa
      ? '<a href="' + c.wa + '" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600">Enviar WhatsApp</a>'
      : '<span style="color:#888">Sin teléfono</span>';
    return '<tr><td style="padding:12px;border-bottom:1px solid #eee">' +
      '<div style="font-weight:700;font-size:15px">' + esc_(c.nombre) +
      ' <span style="color:' + colores[c.estado] + ';font-size:12px;font-weight:600">● ' + etiquetas[c.estado] + '</span></div>' +
      '<div style="color:#444;font-size:13px;margin:6px 0">' + det + '</div>' +
      '<div style="font-weight:700;margin-bottom:8px">Total: ' + esc_(dinero_(c.total, cfg.moneda)) + '</div>' +
      boton + '</td></tr>';
  }).join('');

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:560px">' +
    '<h2 style="margin:0 0 4px">Cobros de hoy — ' + esc_(cfg.negocio) + '</h2>' +
    '<p style="color:#555;margin:0 0 12px">' + pendientes.length + ' cliente(s) por cobrar. Toca el botón verde para abrir WhatsApp con el mensaje listo.</p>' +
    '<table style="width:100%;border-collapse:collapse">' + filas + '</table>' +
    (url ? '<p style="margin-top:16px"><a href="' + url + '">Abrir Cobros Streaming</a></p>' : '') +
    '</div>';

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '💸 Cobros de hoy: ' + pendientes.length + ' cliente(s) — ' + dinero_(
      pendientes.reduce(function (a, c) { return a + c.total; }, 0), cfg.moneda),
    htmlBody: html
  });
}
