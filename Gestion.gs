/**
 * SICAM · server/Gestion.gs
 * Gestión: historial, proyección de presupuesto, ciclo de vida, mantenimiento, bajas, kits y avisos.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

// ===== NUEVO: HISTORIAL Y PROYECCIÓN (para la ficha y el dashboard) =====

/** Historial de reportes y reparaciones de un activo */
function obtenerHistorialActivo(id) {
  try {
    var ss = getDB();
    var hoja = ss.getSheetByName('Reportes');
    if (!hoja || hoja.getLastRow() < 2) return [];
    var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 8).getValues();
    var buscado = normalizarId(id).toUpperCase();
    var out = [];
    for (var i = 0; i < datos.length; i++) {
      var idRep = normalizarId(datos[i][1]).toUpperCase();
      if (idRep === buscado) {
        out.push({
          fecha: String(datos[i][0] || ''),
          tipo: String(datos[i][3] || '').toUpperCase(),
          detalle: String(datos[i][4] || ''),
          estadoAnterior: String(datos[i][5] || ''),
          reportadoPor: String(datos[i][6] || ''),
          foto: String(datos[i][7] || '')
        });
      }
    }
    return out.reverse();
  } catch (e) { return []; }
}

/** Proyección de presupuesto: reposición de dañados + 20% de reparación */
function obtenerProyeccionPresupuesto() {
  try {
    var lista = obtenerListaActivos();
    var reposicion = 0, reparacion = 0, activosDanados = 0, activosMant = 0;
    var costoTotal = 0, n = 0;
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      var c = Number(a.costo) || 0;
      if (c > 0) { costoTotal += c; n++; }
      var e = String(a.estado || '').toLowerCase();
      var costoBase = c > 0 ? c : 350;
      if (e.indexOf('dañ') >= 0 || e.indexOf('dan') >= 0 || e.indexOf('roto') >= 0) {
        reposicion += costoBase;
        activosDanados++;
      } else if (e.indexOf('manten') >= 0) {
        reparacion += costoBase * 0.20;
        activosMant++;
      }
    }
    return {
      reposicion: reposicion,
      reparacion: reparacion,
      total: reposicion + reparacion,
      activosDanados: activosDanados,
      activosMantenimiento: activosMant,
      costoPromedio: n ? (costoTotal / n) : 0
    };
  } catch (e) {
    return { reposicion: 0, reparacion: 0, total: 0, activosDanados: 0, activosMantenimiento: 0, costoPromedio: 0 };
  }
}

// =====================================================================
// ===== GESTIÓN: avisos, ciclo de vida, bajas y donaciones, kits =====
// Todo vive en hojas nuevas (Mantenimiento, Bajas, Kits); el Catalogo
// sigue con sus columnas A–K. La configuración de avisos se guarda en
// las Propiedades del script (no en el código).
// =====================================================================


function propsGestion_() { return PropertiesService.getScriptProperties(); }

function configGestion_() {
  var p = propsGestion_().getProperties();
  return {
    correos: String(p.AVISO_CORREOS || ''),
    telegramToken: String(p.AVISO_TELEGRAM_TOKEN || ''),
    telegramChat: String(p.AVISO_TELEGRAM_CHAT || ''),
    mesesDefecto: Number(p.MANT_MESES_DEFECTO) || 12,
    mesesEquipo: Number(p.MANT_MESES_EQUIPO) || 6,
    inicio: String(p.MANT_INICIO || '')
  };
}


function triggerResumen_() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) if (ts[i].getHandlerFunction() === 'enviarResumenMantenimiento') return ts[i];
  return null;
}

/** Lo que ve el panel de Avisos (el token de Telegram nunca sale del servidor) */
function obtenerConfigAvisos(token) {
  var permiso = exigirRol_(token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  return configAvisos_(true);
}

/** completo = false: solo los meses de mantenimiento (para directivos, sin correos ni Telegram) */
function configAvisos_(completo) {
  var c = configGestion_();
  if (!completo) return { mesesDefecto: c.mesesDefecto, mesesEquipo: c.mesesEquipo };
  var cuota = null;
  try { cuota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  var resumen = false;
  try { resumen = !!triggerResumen_(); } catch (e2) {}
  return {
    correos: c.correos, telegramChat: c.telegramChat, telegramConfigurado: !!(c.telegramToken && c.telegramChat),
    mesesDefecto: c.mesesDefecto, mesesEquipo: c.mesesEquipo, resumenSemanal: resumen, cuotaCorreo: cuota
  };
}

/** datos: { usuario, correos, telegramToken?, telegramChat, quitarTelegram?, mesesDefecto, mesesEquipo, resumenSemanal } */
function guardarConfigAvisos(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  try {
    var correos = String(datos.correos || '').split(/[\s,;]+/).filter(function (x) { return x; });
    for (var i = 0; i < correos.length; i++) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correos[i])) return { exito: false, mensaje: 'Correo no válido: ' + correos[i] };
    }
    var p = propsGestion_();
    var nuevos = {
      AVISO_CORREOS: correos.join(', '),
      AVISO_TELEGRAM_CHAT: String(datos.telegramChat || '').trim(),
      MANT_MESES_DEFECTO: String(Math.max(1, Math.min(120, Number(datos.mesesDefecto) || 12))),
      MANT_MESES_EQUIPO: String(Math.max(1, Math.min(120, Number(datos.mesesEquipo) || 6)))
    };
    var token = String(datos.telegramToken || '').trim();
    if (token) nuevos.AVISO_TELEGRAM_TOKEN = token;
    p.setProperties(nuevos);
    if (datos.quitarTelegram) { p.deleteProperty('AVISO_TELEGRAM_TOKEN'); p.deleteProperty('AVISO_TELEGRAM_CHAT'); }

    // Resumen semanal: lunes 7:00
    var t = triggerResumen_();
    if (datos.resumenSemanal && !t) {
      ScriptApp.newTrigger('enviarResumenMantenimiento').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
    } else if (!datos.resumenSemanal && t) {
      ScriptApp.deleteTrigger(t);
    }
    return { exito: true, mensaje: 'Avisos guardados.', config: configAvisos_(true) };
  } catch (e) {
    return { exito: false, mensaje: 'Error al guardar: ' + e.message };
  }
}

function escHtmlServ_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envía un aviso por correo y/o Telegram a los encargados.
 * Devuelve { correo: bool, telegram: bool, errores: [] }. Nunca lanza error.
 */
function enviarAviso_(asunto, lineas, enlace) {
  var c = configGestion_();
  var res = { correo: false, telegram: false, errores: [] };
  var destinos = c.correos.split(/[\s,;]+/).filter(function (x) { return x; });
  if (destinos.length) {
    try {
      var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#172936">' +
        '<h2 style="color:#0b304a;margin:0 0 10px">' + escHtmlServ_(asunto) + '</h2>' +
        lineas.map(function (l) { return '<p style="margin:4px 0">' + escHtmlServ_(l) + '</p>'; }).join('') +
        (enlace ? '<p style="margin-top:14px"><a href="' + escHtmlServ_(enlace) + '" style="background:#155b88;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Abrir en SICAM</a></p>' : '') +
        '<p style="color:#71808c;font-size:12px;margin-top:18px">SICAM · Centro Escolar General Francisco Morazán</p></div>';
      MailApp.sendEmail({ to: destinos.join(','), subject: 'SICAM · ' + asunto, htmlBody: html, body: lineas.join('\n') + (enlace ? '\n' + enlace : ''), name: 'SICAM' });
      res.correo = true;
    } catch (e) { res.errores.push('Correo: ' + e.message); }
  }
  if (c.telegramToken && c.telegramChat) {
    try {
      var texto = '<b>' + escHtmlServ_(asunto) + '</b>\n' + lineas.map(escHtmlServ_).join('\n') + (enlace ? '\n' + enlace : '');
      var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + c.telegramToken + '/sendMessage', {
        method: 'post', muteHttpExceptions: true,
        payload: { chat_id: c.telegramChat, text: texto.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: 'true' }
      });
      if (r.getResponseCode() === 200) res.telegram = true;
      else res.errores.push('Telegram: ' + r.getContentText().slice(0, 200));
    } catch (e2) { res.errores.push('Telegram: ' + e2.message); }
  }
  return res;
}

/** Se llama desde reportarFalla: avisa a mantenimiento en el instante */
function notificarFalla_(datos, estadoAnterior, urlFoto) {
  var c = configGestion_();
  if (!c.correos && !(c.telegramToken && c.telegramChat)) return null;
  var a = null;
  try {
    var lista = obtenerListaActivos();
    var b = normalizarId(datos.id).toUpperCase();
    for (var i = 0; i < lista.length; i++) if (normalizarId(lista[i].id).toUpperCase() === b) { a = lista[i]; break; }
  } catch (e) {}
  var lineas = [
    'Bien: ' + (datos.nombre || (a && a.nombre) || '') + ' (' + datos.id + ')',
    'Ubicación: ' + ((a && a.ubicacion) || 'sin dato'),
    'Falla: ' + (datos.tipoFalla || 'Falla') + (datos.detalle ? ' · ' + datos.detalle : ''),
    'Estado anterior: ' + (estadoAnterior || '—') + ' → ' + (datos.nuevoEstado || 'En Mantenimiento'),
    'Reportó: ' + (datos.reportadoPor || 'Anónimo') + ' · ' + fechaAhora_()
  ];
  if (urlFoto) lineas.push('Foto: ' + urlFoto);
  return enviarAviso_('Falla reportada en ' + ((a && a.ubicacion) || datos.id), lineas, obtenerUrlWebApp() + '?id=' + encodeURIComponent(datos.id));
}

/** Botón "Probar aviso" (también se puede ejecutar desde el editor para dar el permiso de correo) */
function probarAvisos(token) {
  if (!desdeEditor_()) {
    var permiso = exigirRol_(token, [ROL_ADMIN]);
    if (permiso.error) return permiso.error;
  }
  var r = enviarAviso_('Aviso de prueba', ['Si recibes este mensaje, los avisos de SICAM funcionan.', 'Enviado: ' + fechaAhora_()], obtenerUrlWebApp());
  if (!r.correo && !r.telegram && !r.errores.length) return { exito: false, mensaje: 'No hay correos ni Telegram configurados.' };
  var ok = [];
  if (r.correo) ok.push('correo');
  if (r.telegram) ok.push('Telegram');
  return {
    exito: ok.length > 0,
    mensaje: (ok.length ? 'Aviso enviado por ' + ok.join(' y ') + '. ' : '') + (r.errores.length ? 'Problemas: ' + r.errores.join(' · ') : '')
  };
}

// ----- Ciclo de vida y mantenimiento preventivo -----

/** Hoja Mantenimiento: ID_Activo | Fecha_Alta | Ultimo_Mantenimiento | Intervalo_Meses (las dos últimas son opcionales y se pueden editar a mano) */
function getHojaMantenimiento_(ss) {
  var h = ss.getSheetByName('Mantenimiento');
  if (!h) {
    h = ss.insertSheet('Mantenimiento');
    h.appendRow(['ID_Activo', 'Fecha_Alta', 'Ultimo_Mantenimiento', 'Intervalo_Meses']);
    h.setFrozenRows(1);
  }
  return h;
}

/** Fecha de una celda: acepta Date o texto dd/MM/yyyy [HH:mm] */
function aFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fechaCorta_(d) {
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
}

function esDeBaja_(estado) { return /^\s*de baja/i.test(String(estado || '')); }

/** Equipos electrónicos llevan mantenimiento más seguido */
function esEquipo_(a) {
  var t = sinTildes_((a.nombre || '') + ' ' + (a.categoria || ''));
  return /computad|laptop|proyector|impresor|televis|monitor|tablet|equipo|electr|aire acond|ventilador|parlante|bocina|camara|router|cpu/.test(t);
}

function sumarMeses_(d, meses) {
  var r = new Date(d.getTime());
  r.setMonth(r.getMonth() + meses);
  return r;
}

/**
 * Calcula, para cada bien vigente, cuándo le toca mantenimiento y cuántas fallas tuvo en 12 meses.
 * Base: último REPARADO/MANTENIMIENTO en Reportes, o la fecha escrita en la hoja Mantenimiento,
 * o la fecha de alta, o el día en que se activó el control (MANT_INICIO).
 */
function calcularCicloVida_() {
  var ss = getDB();
  var c = configGestion_();
  var p = propsGestion_();
  if (!c.inicio) { c.inicio = fechaCorta_(new Date()); p.setProperty('MANT_INICIO', c.inicio); }
  var inicio = aFecha_(c.inicio);

  var hm = getHojaMantenimiento_(ss);
  var extra = {};
  if (hm.getLastRow() > 1) {
    hm.getRange(2, 1, hm.getLastRow() - 1, 4).getValues().forEach(function (r) {
      var id = normalizarId(r[0]).toUpperCase();
      if (id) extra[id] = { alta: aFecha_(r[1]), ultimo: aFecha_(r[2]), meses: Number(r[3]) || 0 };
    });
  }

  var ultimoMant = {}, fallas = {};
  var hace12 = new Date(); hace12.setFullYear(hace12.getFullYear() - 1);
  var hr = ss.getSheetByName('Reportes');
  if (hr && hr.getLastRow() > 1) {
    hr.getRange(2, 1, hr.getLastRow() - 1, 4).getValues().forEach(function (r) {
      var id = normalizarId(r[1]).toUpperCase();
      var f = aFecha_(r[0]);
      if (!id || !f) return;
      var tipo = String(r[3] || '').toUpperCase();
      if (tipo === 'REPARADO' || tipo.indexOf('MANTENIMIENTO') === 0) {
        if (!ultimoMant[id] || f > ultimoMant[id]) ultimoMant[id] = f;
      } else if (tipo.indexOf('TRASLADO') !== 0 && tipo.indexOf('BAJA') !== 0 && tipo.indexOf('CICLO') !== 0 && f >= hace12) {
        fallas[id] = (fallas[id] || 0) + 1;
      }
    });
  }

  var hoy = new Date();
  var lista = obtenerListaActivos();
  var out = [];
  lista.forEach(function (a) {
    if (esDeBaja_(a.estado)) return;
    var id = normalizarId(a.id).toUpperCase();
    var ex = extra[id] || {};
    var ultimo = ultimoMant[id] || null;
    if (ex.ultimo && (!ultimo || ex.ultimo > ultimo)) ultimo = ex.ultimo;
    var base = ultimo || ex.alta || inicio;
    var origen = ultimo ? 'mantenimiento' : (ex.alta ? 'alta' : 'inicio');
    var meses = ex.meses || (esEquipo_(a) ? c.mesesEquipo : c.mesesDefecto);
    var proximo = sumarMeses_(base, meses);
    var dias = Math.floor((proximo.getTime() - hoy.getTime()) / 86400000);
    out.push({
      id: a.id, nombre: a.nombre, categoria: a.categoria, ubicacion: a.ubicacion, estado: a.estado,
      ultimo: fechaCorta_(ultimo), base: fechaCorta_(base), origen: origen, meses: meses,
      proximo: fechaCorta_(proximo), dias: dias, fallas12: fallas[id] || 0
    });
  });
  return { items: out, inicio: c.inicio };
}

/** Todo lo que necesita la vista Gestión en una sola llamada */
function obtenerGestion(token) {
  var permiso = exigirRol_(token, [ROL_ADMIN, ROL_DIRECTIVO]);
  if (permiso.error) return permiso.error;
  try {
    var ciclo = calcularCicloVida_();
    var vencidos = [], proximos = [], proponer = [], alDia = 0;
    ciclo.items.forEach(function (x) {
      var e = String(x.estado || '').toLowerCase();
      if (x.fallas12 >= FALLAS_PARA_BAJA && e.indexOf('baja') < 0) proponer.push(x);
      if (x.dias < 0) vencidos.push(x);
      else if (x.dias <= DIAS_AVISO_PROXIMO) proximos.push(x);
      else alDia++;
    });
    vencidos.sort(function (a, b) { return a.dias - b.dias; });
    proximos.sort(function (a, b) { return a.dias - b.dias; });
    proponer.sort(function (a, b) { return b.fallas12 - a.fallas12; });
    return {
      exito: true,
      inicio: ciclo.inicio,
      vencidos: vencidos, proximos: proximos, proponer: proponer, alDia: alDia,
      bajas: leerBajas_(),
      kits: leerKits_(),
      config: configAvisos_(permiso.ses.rol === ROL_ADMIN)
    };
  } catch (e) {
    return { exito: false, mensaje: 'Error al cargar la gestión: ' + e.message };
  }
}

/** Cambia el estado (col H) de varios bienes y deja constancia en Reportes */
function aplicarEstados_(ss, ids, nuevoEstado, tipo, detalle, usuario, nuevaUbicacion) {
  var hoja = getHojaCatalogo(ss);
  var last = hoja.getLastRow();
  var datos = hoja.getRange(1, 1, last, 8).getValues();
  var fila = {};
  for (var i = 1; i < datos.length; i++) fila[normalizarId(datos[i][0]).toUpperCase()] = i;
  var fecha = fechaAhora_();
  var rep = [], hechos = [], noEncontrados = [];
  ids.forEach(function (idRaw) {
    var id = normalizarId(idRaw).toUpperCase();
    var i = fila[id];
    if (i == null) { noEncontrados.push(idRaw); return; }
    var anterior = datos[i][7];
    if (nuevoEstado) hoja.getRange(i + 1, 8).setValue(nuevoEstado);
    if (nuevaUbicacion != null) hoja.getRange(i + 1, 5).setValue(nuevaUbicacion);
    rep.push([fecha, datos[i][0], datos[i][1], tipo, detalle || '', nuevaUbicacion != null ? datos[i][4] : anterior, usuario || 'Anónimo', '']);
    hechos.push({ id: String(datos[i][0]), nombre: String(datos[i][1] || ''), categoria: String(datos[i][2] || ''),
      ubicacion: String(datos[i][4] || ''), costo: Number(datos[i][6]) || 0, estadoAnterior: String(anterior || '') });
  });
  if (rep.length) {
    var hr = getHojaReportes_(ss);
    hr.getRange(hr.getLastRow() + 1, 1, rep.length, 8).setValues(rep);
  }
  invalidarCache_();
  return { hechos: hechos, noEncontrados: noEncontrados };
}

function conCandado_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { exito: false, mensaje: 'El sistema está ocupado, intenta de nuevo.' }; }
  try { return fn(); }
  catch (e2) { return { exito: false, mensaje: 'Error: ' + e2.message }; }
  finally { lock.releaseLock(); }
}

/** datos: { ids:[...], detalle, nuevoEstado ('' = sin cambio), usuario } */
function registrarMantenimiento(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var ids = datos.ids || [];
    if (!ids.length) return { exito: false, mensaje: 'Selecciona al menos un bien.' };
    var r = aplicarEstados_(getDB(), ids, String(datos.nuevoEstado || ''), 'MANTENIMIENTO PREVENTIVO',
      String(datos.detalle || ''), datos.usuario);
    return { exito: true, mensaje: 'Mantenimiento registrado en ' + r.hechos.length + ' bien(es).' +
      (r.noEncontrados.length ? ' No encontrados: ' + r.noEncontrados.join(', ') : '') };
  });
}

/** Pasa bienes a "Para Baja" (o a otro estado del ciclo). datos: { ids, estado, motivo, usuario } */
function cambiarEstadoCiclo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var estado = String(datos.estado || 'Para Baja');
    if (ESTADOS_CICLO.indexOf(estado) < 0) return { exito: false, mensaje: 'Estado no válido.' };
    var r = aplicarEstados_(getDB(), datos.ids || [], estado, 'CICLO: ' + estado, String(datos.motivo || ''), datos.usuario);
    return { exito: true, mensaje: r.hechos.length + ' bien(es) pasaron a "' + estado + '".' };
  });
}

// ----- Bajas y donaciones -----

function getHojaBajas_(ss) {
  var h = ss.getSheetByName('Bajas');
  if (!h) {
    h = ss.insertSheet('Bajas');
    h.appendRow(['Fecha', 'ID_Activo', 'Nombre', 'Categoría', 'Ubicación', 'Costo', 'Estado_Anterior', 'Destino', 'Detalle', 'Responsable', 'Acta']);
    h.setFrozenRows(1);
  }
  return h;
}

function leerBajas_() {
  var h = getDB().getSheetByName('Bajas');
  if (!h || h.getLastRow() < 2) return [];
  var desde = Math.max(2, h.getLastRow() - 299);   // últimas 300
  return h.getRange(desde, 1, h.getLastRow() - desde + 1, 11).getValues().map(function (r) {
    var f = aFecha_(r[0]);
    return { fecha: f ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(r[0] || ''),
      id: String(r[1] || ''), nombre: String(r[2] || ''), categoria: String(r[3] || ''), ubicacion: String(r[4] || ''),
      costo: Number(r[5]) || 0, estadoAnterior: String(r[6] || ''), destino: String(r[7] || ''), detalle: String(r[8] || ''),
      responsable: String(r[9] || ''), acta: String(r[10] || '') };
  }).reverse();
}

/**
 * Decide el destino de bienes "Para Baja".
 * Reparar → vuelve a "En Mantenimiento". Repuestos / Donación / Reciclaje → "De Baja (destino)".
 * datos: { ids, destino, detalle, usuario }
 */
function registrarBaja(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN, ROL_DIRECTIVO]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var destino = String(datos.destino || '');
    if (DESTINOS_BAJA.indexOf(destino) < 0) return { exito: false, mensaje: 'Elige un destino.' };
    var ids = datos.ids || [];
    if (!ids.length) return { exito: false, mensaje: 'Selecciona al menos un bien.' };
    var ss = getDB();
    var nuevoEstado = destino === 'Reparar' ? 'En Mantenimiento' : 'De Baja (' + destino + ')';
    var r = aplicarEstados_(ss, ids, nuevoEstado, 'BAJA: ' + destino, String(datos.detalle || ''), datos.usuario);
    var acta = 'ACTA-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
    var fecha = fechaAhora_();
    var filas = r.hechos.map(function (h) {
      return [fecha, h.id, h.nombre, h.categoria, h.ubicacion, h.costo, h.estadoAnterior, destino, String(datos.detalle || ''), datos.usuario || 'Anónimo', acta];
    });
    if (filas.length) {
      var hb = getHojaBajas_(ss);
      hb.getRange(hb.getLastRow() + 1, 1, filas.length, 11).setValues(filas);
    }
    return { exito: true, acta: acta, fecha: fecha, destino: destino, bienes: r.hechos,
      mensaje: (destino === 'Reparar' ? r.hechos.length + ' bien(es) volvieron a mantenimiento.' : r.hechos.length + ' bien(es) dados de baja para ' + destino.toLowerCase() + '.') };
  });
}

// ----- Kits de aula -----

function getHojaKits_(ss) {
  var h = ss.getSheetByName('Kits');
  if (!h) {
    h = ss.insertSheet('Kits');
    h.appendRow(['ID_Kit', 'Nombre', 'Aula', 'IDs_Activos', 'Creado', 'Actualizado', 'Responsable']);
    h.setFrozenRows(1);
  }
  return h;
}

function leerKits_() {
  var h = getDB().getSheetByName('Kits');
  if (!h || h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, 7).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]), nombre: String(r[1] || ''), aula: String(r[2] || ''),
      ids: String(r[3] || '').split(/\s*,\s*/).filter(function (x) { return x; }),
      actualizado: (aFecha_(r[5]) ? Utilities.formatDate(aFecha_(r[5]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(r[5] || '')),
      responsable: String(r[6] || '') };
  });
}

function filaKit_(h, id) {
  if (h.getLastRow() < 2) return -1;
  var ids = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

/** Crea o edita un kit. datos: { id?, nombre, aula, ids, usuario } */
function guardarKit(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var nombre = String(datos.nombre || '').trim();
    var ids = (datos.ids || []).map(String);
    if (!nombre) return { exito: false, mensaje: 'Ponle un nombre al kit.' };
    if (!ids.length) return { exito: false, mensaje: 'Marca al menos un mueble.' };
    var ss = getDB();
    var h = getHojaKits_(ss);
    var fecha = fechaAhora_();
    var fila = datos.id ? filaKit_(h, datos.id) : -1;
    if (fila > 0) {
      h.getRange(fila, 2, 1, 6).setValues([[nombre, String(datos.aula || ''), ids.join(', '), h.getRange(fila, 5).getValue(), fecha, datos.usuario || '']]);
      return { exito: true, mensaje: 'Kit actualizado.', id: datos.id };
    }
    var max = 0;
    leerKits_().forEach(function (k) { var n = Number(String(k.id).replace(/\D/g, '')) || 0; if (n > max) max = n; });
    var id = 'KIT-' + ('00' + (max + 1)).slice(-3);
    h.appendRow([id, nombre, String(datos.aula || ''), ids.join(', '), fecha, fecha, datos.usuario || '']);
    return { exito: true, mensaje: 'Kit creado: ' + id, id: id };
  });
}

function eliminarKit(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  var id = String(datos.id || '');
  return conCandado_(function () {
    var h = getHojaKits_(getDB());
    var fila = filaKit_(h, id);
    if (fila < 0) return { exito: false, mensaje: 'No se encontró el kit.' };
    h.deleteRow(fila);
    return { exito: true, mensaje: 'Kit eliminado. Los muebles no se tocaron.' };
  });
}

/** Mueve todo el kit a otra aula con una sola acción. datos: { id, aulaDestino, usuario } */
function moverKit(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var destino = String(datos.aulaDestino || '').trim();
    if (!destino) return { exito: false, mensaje: 'Elige el aula de destino.' };
    var ss = getDB();
    var h = getHojaKits_(ss);
    var fila = filaKit_(h, datos.id);
    if (fila < 0) return { exito: false, mensaje: 'No se encontró el kit.' };
    var k = h.getRange(fila, 1, 1, 3).getValues()[0];
    var ids = String(h.getRange(fila, 4).getValue() || '').split(/\s*,\s*/).filter(function (x) { return x; });
    var r = aplicarEstados_(ss, ids, '', 'TRASLADO', 'Kit ' + k[0] + ' "' + k[1] + '": ' + (k[2] || '?') + ' → ' + destino, datos.usuario, destino);
    h.getRange(fila, 3).setValue(destino);
    h.getRange(fila, 6, 1, 2).setValues([[fechaAhora_(), datos.usuario || '']]);
    return { exito: true, mensaje: r.hechos.length + ' mueble(s) trasladados a ' + destino + '.' +
      (r.noEncontrados.length ? ' No encontrados: ' + r.noEncontrados.join(', ') : '') };
  });
}

// ----- Resumen semanal (lo ejecuta el activador del lunes) -----

function enviarResumenMantenimiento() {
  var g = obtenerGestion();
  if (!g.exito) return;
  if (!g.vencidos.length && !g.proximos.length && !g.proponer.length) return;
  var lineas = [
    'Mantenimiento vencido: ' + g.vencidos.length + ' · Vence en 30 días: ' + g.proximos.length + ' · Proponer baja: ' + g.proponer.length, ''
  ];
  g.vencidos.slice(0, 25).forEach(function (x) {
    lineas.push('• ' + x.nombre + ' (' + x.id + ') · ' + (x.ubicacion || 'sin aula') + ' · vencido hace ' + (-x.dias) + ' días');
  });
  if (g.vencidos.length > 25) lineas.push('… y ' + (g.vencidos.length - 25) + ' más.');
  g.proponer.slice(0, 10).forEach(function (x) {
    lineas.push('• Proponer baja: ' + x.nombre + ' (' + x.id + ') · ' + x.fallas12 + ' fallas en 12 meses');
  });
  enviarAviso_('Resumen semanal de mantenimiento', lineas, obtenerUrlWebApp() + '?vista=gestion');
}
