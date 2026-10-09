/**
 * SICAM · server/Prestamos.gs
 * Préstamos de bienes a estudiantes, docentes o responsables: registrar, editar, cerrar y eliminar.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

// =====================================================================
// Préstamos de mobiliario y equipo a estudiantes, docentes o responsables.
// Hoja "Prestamos" (se crea sola). Estados: Activo → Devuelto | Perdido | No devuelto.
// =====================================================================


function getHojaPrestamos_(ss) {
  var h = ss.getSheetByName('Prestamos');
  if (!h) {
    h = ss.insertSheet('Prestamos');
    h.appendRow(COLS_PRESTAMO);
    h.setFrozenRows(1);
    h.getRange('E:E').setNumberFormat('@');   // el documento siempre como texto (no pierde ceros)
  }
  return h;
}

/** DUI salvadoreño: 8 dígitos + dígito verificador (00000000-0) */
function validarDui_(dui) {
  var m = String(dui || '').replace(/\s/g, '').match(/^(\d{8})-?(\d)$/);
  if (!m) return false;
  var suma = 0;
  for (var i = 0; i < 8; i++) suma += Number(m[1].charAt(i)) * (9 - i);
  var dv = (10 - (suma % 10)) % 10;
  return dv === Number(m[2]);
}

/** NIE (Número de Identificación Estudiantil): solo números, de 5 a 10 dígitos */
function validarNie_(nie) { return /^\d{5,10}$/.test(String(nie || '').replace(/\s/g, '')); }

function formatearDocumento_(tipo, doc) {
  var d = String(doc || '').replace(/[\s-]/g, '');
  return tipo === 'DUI' ? d.slice(0, 8) + '-' + d.slice(8) : d;
}

/** Fecha 'yyyy-MM-dd' (del formulario) → Date a medianoche */
function fechaIso_(v) {
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : aFecha_(v);
}

function hoyMedianoche_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

/** Lee todos los préstamos como objetos */
function leerPrestamos_(ss) {
  var h = ss.getSheetByName('Prestamos');
  if (!h || h.getLastRow() < 2) return [];
  var hoy = hoyMedianoche_();
  return h.getRange(2, 1, h.getLastRow() - 1, COLS_PRESTAMO.length).getValues().map(function (r, i) {
    var limite = aFecha_(r[11]);
    var estado = String(r[12] || 'Activo');
    return {
      fila: i + 2, id: String(r[0]), fecha: r[1] instanceof Date ? fechaCorta_(r[1]) : String(r[1] || ''),
      tipoPersona: String(r[2] || ''), tipoDoc: String(r[3] || ''), documento: String(r[4] || ''),
      nombre: String(r[5] || ''), grado: String(r[6] || ''), seccion: String(r[7] || ''), telefono: String(r[8] || ''),
      ids: String(r[9] || '').split(/\s*,\s*/).filter(function (x) { return x; }),
      bienes: String(r[10] || ''), limite: fechaCorta_(limite), limiteIso: limite ? Utilities.formatDate(limite, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      estado: estado, cierre: r[13] instanceof Date ? fechaCorta_(r[13]) : String(r[13] || ''),
      condicion: String(r[14] || ''), observaciones: String(r[15] || ''),
      registradoPor: String(r[16] || ''), cerradoPor: String(r[17] || ''),
      vencido: estado === 'Activo' && !!limite && limite < hoy,
      diasRestantes: limite ? Math.round((limite - hoy) / 86400000) : null
    };
  }).filter(function (p) { return p.id; });
}

/** { ID_ACTIVO: {id, limite} } de los préstamos activos */
function mapaPrestados_(ss) {
  var out = {};
  try {
    leerPrestamos_(ss || getDB()).forEach(function (p) {
      if (p.estado !== 'Activo' && p.estado !== 'No devuelto') return;   // "No devuelto" sigue fuera de la escuela
      p.ids.forEach(function (id) { out[normalizarId(id).toUpperCase()] = { id: p.id, limite: p.limite, estado: p.estado }; });
    });
  } catch (e) {}
  return out;
}

/** Para la ficha pública del QR: solo dice si está prestado y hasta cuándo (sin datos personales) */
function prestamoPublico_(idActivo) {
  var p = mapaPrestados_()[normalizarId(idActivo).toUpperCase()];
  return p ? { prestado: true, hasta: p.limite } : null;
}

/**
 * Valida y normaliza los datos de un préstamo. Devuelve { error } o { datos }.
 * Reglas: Estudiante → NIE y grado obligatorios. Docente o Responsable → DUI obligatorio.
 */
function validarPrestamo_(d, esEdicion) {
  var tipo = String(d.tipoPersona || '');
  if (TIPOS_PERSONA.indexOf(tipo) < 0) return { error: 'Elige si es Estudiante, Docente o Responsable.' };
  var tipoDoc = tipo === 'Estudiante' ? 'NIE' : 'DUI';
  var doc = String(d.documento || '').replace(/\s/g, '');
  if (tipoDoc === 'NIE' && !validarNie_(doc)) return { error: 'El NIE debe tener solo números (de 5 a 10 dígitos).' };
  if (tipoDoc === 'DUI' && !validarDui_(doc)) return { error: 'El DUI no es válido. Formato: 00000000-0 (revisa el último dígito).' };
  var nombre = limpiarTexto_(d.nombre, 100);
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(nombre) || nombre.split(' ').filter(function (x) { return x.length > 1; }).length < 2) {
    return { error: 'Escribe el nombre completo (nombre y apellido, solo letras).' };
  }
  var grado = limpiarTexto_(d.grado, 40);
  var seccion = limpiarTexto_(d.seccion, 5).toUpperCase();
  if (tipo === 'Estudiante' && !grado) return { error: 'Elige el grado del estudiante.' };
  if (seccion && !/^[A-Z]$/.test(seccion)) return { error: 'La sección es una sola letra (A, B, C…).' };
  var tel = String(d.telefono || '').replace(/[\s-]/g, '');
  if (tel && !/^[267]\d{7}$/.test(tel)) return { error: 'El teléfono debe tener 8 dígitos y empezar con 2, 6 o 7.' };
  var limite = fechaIso_(d.fechaLimite);
  var hoy = hoyMedianoche_();
  if (!limite) return { error: 'Elige la fecha de devolución.' };
  if (!esEdicion && limite < hoy) return { error: 'La fecha de devolución no puede ser anterior a hoy.' };
  var max = new Date(hoy.getTime()); max.setFullYear(max.getFullYear() + 1);
  if (limite > max) return { error: 'El préstamo no puede durar más de un año.' };
  return { datos: {
    tipo: tipo, tipoDoc: tipoDoc, documento: formatearDocumento_(tipoDoc, doc), nombre: nombre,
    grado: tipo === 'Estudiante' ? grado : (grado || ''), seccion: seccion,
    telefono: tel ? tel.slice(0, 4) + '-' + tel.slice(4) : '', limite: limite,
    observaciones: limpiarTexto_(d.observaciones, 500)
  } };
}

/** Lista para la vista Préstamos (más recientes primero) */
function obtenerPrestamos(token) {
  // Los préstamos traen NIE y DUI: solo los ven administradores y directivos
  var permiso = exigirRol_(token, [ROL_ADMIN, ROL_DIRECTIVO]);
  if (permiso.error) return permiso.error;
  try {
    var lista = leerPrestamos_(getDB());
    lista.reverse();
    return { exito: true, prestamos: lista };
  } catch (e) {
    return { exito: false, mensaje: 'Error al leer los préstamos: ' + e.message, prestamos: [] };
  }
}

/**
 * CREATE: registra un préstamo.
 * datos: { tipoPersona, documento, nombre, grado, seccion, telefono, ids:[...], fechaLimite:'yyyy-MM-dd', observaciones, usuario }
 */
function registrarPrestamo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var v = validarPrestamo_(datos, false);
    if (v.error) return { exito: false, mensaje: v.error };
    var ids = (datos.ids || []).map(normalizarId).filter(function (x) { return x; });
    if (!ids.length) return { exito: false, mensaje: 'Agrega al menos un bien al préstamo.' };
    if (ids.length > 50) return { exito: false, mensaje: 'Máximo 50 bienes por préstamo.' };

    var ss = getDB();
    var prestados = mapaPrestados_(ss);
    var catalogo = {};
    obtenerListaActivos(true).forEach(function (a) { catalogo[normalizarId(a.id).toUpperCase()] = a; });
    var nombres = [], hechos = [];
    for (var i = 0; i < ids.length; i++) {
      var k = ids[i].toUpperCase();
      var a = catalogo[k];
      if (!a) return { exito: false, mensaje: 'No existe el bien ' + ids[i] + '.' };
      if (prestados[k]) return { exito: false, mensaje: a.nombre + ' (' + a.id + ') ya está prestado en ' + prestados[k].id + '.' };
      if (/baja/i.test(a.estado)) return { exito: false, mensaje: a.nombre + ' (' + a.id + ') está dado de baja y no se puede prestar.' };
      nombres.push(a.nombre + ' (' + a.id + ')');
      hechos.push(a);
    }

    var h = getHojaPrestamos_(ss);
    var max = 0;
    if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var n = Number(String(r[0]).replace(/\D/g, '')) || 0; if (n > max) max = n;
    });
    var id = 'PRE-' + ('000' + (max + 1)).slice(-4);
    var d = v.datos;
    var usuario = limpiarTexto_(datos.usuario, 120) || 'Anónimo';
    h.appendRow([id, new Date(), d.tipo, d.tipoDoc, d.documento, d.nombre, d.grado, d.seccion, d.telefono,
      hechos.map(function (a) { return a.id; }).join(', '), nombres.join('; '), d.limite, 'Activo', '', '', d.observaciones, usuario, '']);

    var fecha = fechaAhora_();
    var rep = hechos.map(function (a) {
      return [fecha, a.id, a.nombre, 'PRÉSTAMO', id + ' a ' + d.nombre + ' (' + d.tipo + ') hasta ' + fechaCorta_(d.limite), a.estado, usuario, ''];
    });
    var hr = getHojaReportes_(ss);
    hr.getRange(hr.getLastRow() + 1, 1, rep.length, 8).setValues(rep);
    invalidarCache_();
    return { exito: true, mensaje: 'Préstamo ' + id + ' registrado.', id: id,
      // Sin objetos Date: google.script.run devuelve null si la respuesta trae una fecha
      comprobante: { id: id, fecha: fecha, limite: fechaCorta_(d.limite), registradoPor: usuario,
        persona: { tipo: d.tipo, tipoDoc: d.tipoDoc, documento: d.documento, nombre: d.nombre, grado: d.grado,
          seccion: d.seccion, telefono: d.telefono, observaciones: d.observaciones },
        bienes: hechos.map(function (a) { return { id: a.id, nombre: a.nombre, ubicacion: a.ubicacion, estado: a.estado, costo: a.costo }; }) } };
  });
}

/** UPDATE: corrige los datos de la persona o la fecha límite de un préstamo activo */
function editarPrestamo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var ss = getDB();
    var p = leerPrestamos_(ss).filter(function (x) { return x.id === datos.id; })[0];
    if (!p) return { exito: false, mensaje: 'No se encontró el préstamo.' };
    if (p.estado !== 'Activo') return { exito: false, mensaje: 'Solo se pueden editar préstamos activos.' };
    var v = validarPrestamo_(datos, true);
    if (v.error) return { exito: false, mensaje: v.error };
    var d = v.datos;
    var h = getHojaPrestamos_(ss);
    h.getRange(p.fila, 3, 1, 7).setValues([[d.tipo, d.tipoDoc, d.documento, d.nombre, d.grado, d.seccion, d.telefono]]);
    h.getRange(p.fila, 12).setValue(d.limite);
    h.getRange(p.fila, 16).setValue(d.observaciones);
    invalidarCache_();
    return { exito: true, mensaje: 'Préstamo ' + p.id + ' actualizado.' };
  });
}

/**
 * UPDATE: cierra un préstamo.
 * datos: { id, resultado: 'Devuelto' | 'Perdido' | 'No devuelto', condicion ('Bueno'|'Regular'|'Dañado', solo si Devuelto), observaciones, usuario }
 * - Devuelto en mal estado: el bien pasa a "Dañado" y queda el reporte.
 * - Perdido: el bien pasa a "Para Baja" (Dirección decide en Gestión › Bajas).
 */
function cerrarPrestamo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var resultado = String(datos.resultado || '');
    if (['Devuelto', 'Perdido', 'No devuelto'].indexOf(resultado) < 0) return { exito: false, mensaje: 'Elige cómo se cierra el préstamo.' };
    var condicion = resultado === 'Devuelto' ? String(datos.condicion || '') : '';
    if (resultado === 'Devuelto' && CONDICIONES_DEVOLUCION.indexOf(condicion) < 0) return { exito: false, mensaje: 'Indica en qué estado se devolvió.' };
    var obs = limpiarTexto_(datos.observaciones, 500);
    if (resultado !== 'Devuelto' && obs.length < 5) return { exito: false, mensaje: 'Describe qué pasó (mínimo 5 letras): queda en el acta.' };

    var ss = getDB();
    var p = leerPrestamos_(ss).filter(function (x) { return x.id === datos.id; })[0];
    if (!p) return { exito: false, mensaje: 'No se encontró el préstamo.' };
    if (p.estado !== 'Activo' && !(p.estado === 'No devuelto' && resultado !== 'No devuelto')) {
      return { exito: false, mensaje: 'Este préstamo ya está cerrado como "' + p.estado + '".' };
    }
    var usuario = limpiarTexto_(datos.usuario, 120) || 'Anónimo';
    var h = getHojaPrestamos_(ss);
    var obsFinal = [p.observaciones, obs ? '[' + fechaAhora_() + '] ' + resultado + ': ' + obs : ''].filter(function (x) { return x; }).join(' | ');
    h.getRange(p.fila, 13, 1, 4).setValues([[resultado, new Date(), condicion, obsFinal]]);
    h.getRange(p.fila, 18).setValue(usuario);

    var nuevoEstado = '';
    if (resultado === 'Perdido') nuevoEstado = 'Para Baja';
    else if (condicion === 'Dañado') nuevoEstado = 'Dañado';
    else if (condicion === 'Regular') nuevoEstado = 'Regular';
    var r = aplicarEstados_(ss, p.ids, nuevoEstado, 'PRÉSTAMO: ' + resultado,
      p.id + (condicion ? ' · devuelto en estado ' + condicion : '') + (obs ? ' · ' + obs : ''), usuario);
    var mensajes = {
      'Devuelto': 'Devolución registrada.',
      'Perdido': 'Préstamo cerrado como PERDIDO. Los bienes pasaron a "Para Baja".',
      'No devuelto': 'Préstamo marcado como NO DEVUELTO.'
    };
    return { exito: true, mensaje: mensajes[resultado], prestamo: p, bienes: r.hechos, resultado: resultado, fecha: fechaAhora_() };
  });
}

/** DELETE: borra un préstamo registrado por error (solo administradores) */
function eliminarPrestamo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var ss = getDB();
    var p = leerPrestamos_(ss).filter(function (x) { return x.id === datos.id; })[0];
    if (!p) return { exito: false, mensaje: 'No se encontró el préstamo.' };
    getHojaPrestamos_(ss).deleteRow(p.fila);
    invalidarCache_();
    return { exito: true, mensaje: 'Préstamo ' + p.id + ' eliminado.' };
  });
}
