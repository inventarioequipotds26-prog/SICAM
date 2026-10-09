/**
 * SICAM · server/Reportes.gs
 * Reportes de daños, reparaciones, observaciones sugeridas y auditorías de aula.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

var OBS_GENERAL = [
  'Rotura o golpe', 'Falta de pieza', 'Rayado o manchado', 'Desgaste por uso',
  'Inestable o flojo', 'No funciona', 'Oxidación'
];

var REGLAS_OBS = [
  { claves: ['silla', 'pupitre', 'butaca', 'banca', 'banco$', 'taburete'], obs: [
    'Pata floja o rota', 'Respaldo roto o flojo', 'Asiento roto o rajado', 'Falta tornillo o remache',
    'Estructura oxidada', 'Inestable (cojea)', 'Rayado o escrito', 'Pintura/barniz desgastado'] },
  { claves: ['escritorio', 'mesa', 'meson', 'mueble'], obs: [
    'Superficie dañada o rajada', 'Pata floja o rota', 'Gaveta no abre o no cierra', 'Falta cerradura o llave',
    'Rayado o manchado', 'Madera hinchada por humedad', 'Estructura oxidada', 'Falta tornillo'] },
  { claves: ['armario', 'estante', 'archivero', 'librero', 'gabinete', 'casillero', 'locker', 'repisa', 'vitrina'], obs: [
    'Puerta floja o rota', 'Falta cerradura o llave', 'Entrepaño dañado', 'Bisagra dañada',
    'Estructura oxidada', 'Humedad o comején', 'Falta pieza'] },
  { claves: ['pizarra', 'pizarron', 'tablero', 'cartelera'], obs: [
    'Superficie rayada o desgastada', 'Ya no borra bien', 'Marco roto o suelto', 'Mal sujeta a la pared',
    'Falta borrador o repisa'] },
  { claves: ['impresora', 'fotocopiadora', 'multifuncional', 'escaner'], obs: [
    'No enciende', 'Atasca el papel', 'Sin tinta o tóner', 'Imprime con manchas o rayas',
    'No conecta con la computadora', 'Falta cable o bandeja'] },
  { claves: ['computadora', 'computador', 'laptop', 'cpu$', 'monitor', 'tablet', 'tableta', 'teclado', 'mouse', 'raton', 'servidor', 'router', 'switch$', 'ups$', 'scanner'], obs: [
    'No enciende', 'Pantalla dañada', 'Teclado o mouse no funciona', 'Lento o se traba',
    'No conecta a la red', 'Falta cable o cargador', 'La batería no carga', 'Necesita limpieza/mantenimiento'] },
  { claves: ['proyector', 'canon$', 'televisor', 'television', 'tv$', 'pantalla', 'bocina', 'parlante', 'altavoz', 'amplificador', 'microfono', 'radio$', 'sonido', 'grabadora', 'reproductor', 'baffle', 'bafle', 'megafono', 'minicomponente', 'tocadisco', 'tocacinta', 'ecualizador'], obs: [
    'No enciende', 'Sin imagen o imagen distorsionada', 'Sin audio o con ruido', 'Control remoto dañado o faltante',
    'Falta cable', 'Lámpara agotada', 'Carcasa golpeada'] },
  { claves: ['ventilador', 'abanico', 'aire acondicionado', 'climatizador', 'extractor'], obs: [
    'No enciende', 'Hace ruido', 'Aspas dañadas o flojas', 'Gira lento o no gira',
    'Control de velocidad dañado', 'No enfría', 'Gotea agua', 'Cable dañado'] },
  { claves: ['lampara', 'luminaria', 'reflector', 'foco$'], obs: [
    'No enciende', 'Falta foco o tubo', 'Balastro dañado', 'Soporte flojo', 'Cable expuesto'] },
  { claves: ['microscopio', 'balanza', 'probeta', 'laboratorio', 'telescopio', 'termometro'], obs: [
    'Lente sucio o dañado', 'Falta pieza o accesorio', 'Descalibrado', 'Piezas oxidadas', 'No enciende'] },
  { claves: ['robot', 'arduino', 'kit$', 'sensor', 'servo$', 'impresora 3d'], obs: [
    'Faltan piezas o sensores', 'Motor/servo no responde', 'Cables sueltos o dañados',
    'Batería agotada o hinchada', 'Placa dañada', 'No enciende'] },
  { claves: ['balon', 'pelota', 'red$', 'colchoneta', 'aro$', 'porteria', 'cancha'], obs: [
    'Desinflado', 'Desgastado', 'Roto o rasgado', 'Falta pieza o red', 'Oxidado'] },
  { claves: ['telefono', 'conmutador', 'intercomunicador', 'fax$'], obs: [
    'Sin tono o no funciona', 'Auricular dañado', 'Teclado dañado', 'Falta cable', 'No suena el timbre'] },
  { claves: ['refrigeradora', 'conservador', 'frigorifico', 'enfriadora'], obs: [
    'No enfría', 'Gotea agua', 'Puerta o empaque dañado', 'Hace ruido', 'No enciende'] },
  { claves: ['extinguidor', 'extintor'], obs: [
    'Vencido o sin recarga', 'Sin precinto', 'Manómetro fuera de rango', 'Manguera dañada', 'Soporte flojo'] },
  { claves: ['taladro', 'sierra', 'esmerilador', 'soldador', 'torno$', 'compresor', 'lijador', 'cepillador', 'soplador', 'pulidora'], obs: [
    'No enciende', 'Hace ruido o vibra', 'Cable dañado', 'Falta accesorio (disco, broca…)',
    'Protección o guarda dañada', 'Piezas oxidadas'] },
  { claves: ['guitarra', 'piano', 'teclado musical', 'flauta', 'tambor', 'bombo', 'trompeta', 'violin', 'marimba', 'organo'], obs: [
    'Desafinado', 'Cuerda o parche roto', 'Rajadura', 'Falta accesorio', 'Estuche dañado'] }
];

var REGLAS_OBS_GRUPO = {
  'Mobiliario': ['Pata floja o rota', 'Falta tornillo o pieza', 'Superficie dañada', 'Inestable o flojo', 'Rayado o manchado', 'Estructura oxidada'],
  'Equipo de oficina': ['No funciona', 'Falta pieza o accesorio', 'Rotura o golpe', 'Desgaste por uso', 'Rayado o manchado'],
  'Aparatos eléctricos': ['No enciende', 'Cable dañado', 'Hace ruido', 'Falta pieza o accesorio', 'Carcasa golpeada'],
  'Audiovisual': ['No enciende', 'Sin imagen o audio', 'Falta cable o control', 'Carcasa golpeada'],
  'Laboratorio': ['Falta pieza o accesorio', 'Descalibrado', 'Piezas oxidadas', 'Vidrio roto o rajado', 'No funciona'],
  'Deportivos': ['Desgastado', 'Roto o rasgado', 'Desinflado', 'Falta pieza'],
  'Instrumentos musicales': ['Desafinado', 'Cuerda o parche roto', 'Rajadura', 'Falta accesorio'],
  'Sonido / TV': ['No enciende', 'Sin imagen o audio', 'Falta cable o control', 'Carcasa golpeada'],
  'Equipo telefónico': ['Sin tono o no funciona', 'Falta cable', 'Pieza dañada'],
  'Equipo de medición': ['Descalibrado', 'Pantalla o escala dañada', 'Falta pieza o estuche', 'Batería agotada'],
  'Electricidad y electrónica': ['No enciende', 'Cable o punta dañada', 'Descalibrado', 'Falta accesorio', 'Pantalla dañada'],
  'Mecánica general': ['No enciende', 'Piezas oxidadas', 'Falta accesorio', 'Hace ruido o vibra', 'Protección dañada'],
  'Refrigeración': ['No enfría', 'Gotea agua', 'Hace ruido', 'Puerta o empaque dañado'],
  'Equipo médico': ['Falta pieza o accesorio', 'Descalibrado', 'No funciona', 'Desgaste por uso']
};

function sinTildes_(t) {
  return String(t || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');
}

function observacionesComunes(nombre, grupo) {
  var n = ' ' + sinTildes_(nombre) + ' ';
  var mejor = null;
  var mejorPos = 1e9;
  for (var i = 0; i < REGLAS_OBS.length; i++) {
    var claves = REGLAS_OBS[i].claves;
    for (var j = 0; j < claves.length; j++) {
      var k = claves[j];
      var pos = -1;
      if (k.charAt(k.length - 1) === '$') {
        k = k.slice(0, -1);
        var p1 = n.indexOf(' ' + k + ' ');
        var p2 = n.indexOf(' ' + k + 's ');
        pos = (p1 >= 0 && p2 >= 0) ? Math.min(p1, p2) : Math.max(p1, p2);
      } else {
        pos = n.indexOf(' ' + k);
      }
      if (pos >= 0 && pos < mejorPos) { mejorPos = pos; mejor = REGLAS_OBS[i].obs; }
    }
  }
  if (mejor) return mejor;
  var g = String(grupo || '').trim();
  if (REGLAS_OBS_GRUPO[g]) return REGLAS_OBS_GRUPO[g];
  return OBS_GENERAL;
}

function obtenerObservacionesComunes(nombre, grupo) {
  return observacionesComunes(nombre, grupo);
}

function marcarReparado(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  datos.reparadoPor = permiso.ses.nombre;
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (!hoja) return { exito: false, mensaje: 'No existe la hoja Catalogo' };

    var fila = buscarFilaPorId_(hoja, datos.id);
    var buscado = normalizarId(datos.id).toUpperCase();
    if (fila === -1) return { exito: false, mensaje: 'Activo no encontrado: ' + buscado };

    var nuevoEstado = String(datos.nuevoEstado || 'Bueno').trim() || 'Bueno';
    var actual = hoja.getRange(fila, 8, 1, 2).getValues()[0];
    var estadoActual = actual[0];
    var obsActual = String(actual[1] || '');
    var fecha = fechaAhora_();
    var quien = String(datos.reparadoPor || '').trim();
    var nota = '[' + fecha + '] REPARADO' + (datos.detalle ? ': ' + datos.detalle : '') +
      (quien ? ' (por ' + quien + ')' : '');

    hoja.getRange(fila, 8, 1, 2).setValues([[nuevoEstado, obsActual ? (obsActual + ' | ' + nota) : nota]]);

    var hojaRep = getHojaReportes_(ss);
    hojaRep.appendRow([fecha, datos.id, datos.nombre || '', 'REPARADO', datos.detalle || '', estadoActual, quien || 'Anónimo', '']);
    invalidarCache_();

    return { exito: true, mensaje: 'Listo: el activo quedó en "' + nuevoEstado + '".', estado: nuevoEstado, nota: nota };
  } catch (error) {
    return { exito: false, mensaje: 'Error al marcar como reparado: ' + error.message };
  }
}

/**
 * Reporte de falla (ficha, escaneo QR o Reporte exprés).
 * datos: { id, nombre, tipoFalla, detalle, reportadoPor, nuevoEstado, foto_base64?, coincidenciaIA? }
 */
function reportarFalla(datos) {
  // Cualquier persona puede reportar (también desde la ficha pública del QR).
  // Si tiene sesión, el reporte queda a su nombre.
  var quien = sesion_(datos && datos.token);
  if (quien) datos.reportadoPor = quien.nombre;
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (!hoja) return { exito: false, mensaje: 'No existe la hoja Catalogo' };

    datos.tipoFalla = limpiarTexto_(datos.tipoFalla, 200);
    datos.detalle = limpiarTexto_(datos.detalle, 500);
    datos.reportadoPor = limpiarTexto_(datos.reportadoPor, 120);
    if (!datos.tipoFalla && !datos.detalle) return { exito: false, mensaje: 'Indica qué le pasa al bien.' };
    var filaEncontrada = buscarFilaPorId_(hoja, datos.id);
    var buscado = normalizarId(datos.id).toUpperCase();
    if (filaEncontrada === -1) return { exito: false, mensaje: 'Activo no encontrado: ' + buscado };

    var actual = hoja.getRange(filaEncontrada, 8, 1, 2).getValues()[0];
    var estadoActual = actual[0];
    var obsActual = actual[1];
    var fecha = fechaAhora_();
    var nuevoEstado = datos.nuevoEstado || 'En Mantenimiento';
    var nota = '[' + fecha + '] ' + (datos.tipoFalla || 'Falla') +
      (datos.detalle ? ': ' + datos.detalle : '');

    var urlFoto = '';
    if (datos.foto_base64) {
      try { urlFoto = guardarFotoDrive_(datos.foto_base64, buscado + '_reporte_' + Date.now() + '.jpg'); } catch (eF) {}
    }

    hoja.getRange(filaEncontrada, 8, 1, 2).setValues([[nuevoEstado, obsActual ? (obsActual + ' | ' + nota) : nota]]);

    var detalle = String(datos.detalle || '');
    if (datos.coincidenciaIA != null && datos.coincidenciaIA !== '') {
      detalle += (detalle ? ' ' : '') + '[IA: foto coincide ' + datos.coincidenciaIA + '%]';
    }

    var hojaRep = getHojaReportes_(ss);
    hojaRep.appendRow([
      fecha, datos.id, datos.nombre || '', datos.tipoFalla || '',
      detalle, estadoActual, datos.reportadoPor || 'Anónimo', urlFoto
    ]);
    invalidarCache_();

    // Aviso inmediato a mantenimiento (correo y/o Telegram, si están configurados)
    var aviso = null;
    try { aviso = notificarFalla_(datos, estadoActual, urlFoto); } catch (eA) {}
    var avisado = aviso && (aviso.correo || aviso.telegram);

    return { exito: true, mensaje: 'Reporte enviado. El activo quedó en "' + nuevoEstado + '".' + (avisado ? ' Se avisó a mantenimiento.' : ''), nota: nota, estado: nuevoEstado };
  } catch (error) {
    return { exito: false, mensaje: 'Error al reportar: ' + error.message };
  }
}

/** Vector de IA de un solo activo (para validar la foto de un reporte) */
function obtenerVectorActivo(id) {
  try {
    var hoja = getHojaCatalogo(getDB());
    if (!hoja) return [];
    var fila = buscarFilaPorId_(hoja, id);
    if (fila === -1) return [];
    var v = String(hoja.getRange(fila, 11).getValue() || '');
    return (v && v !== '[]') ? JSON.parse(v) : [];
  } catch (e) { return []; }
}

/**
 * Guarda el resultado de una auditoría exprés por aula.
 * datos: { aula, presentes:[ids], ausentes:[ids], ajenos:[ids], auditor }
 */
function guardarAuditoria(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN, ROL_DIRECTIVO]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  datos.auditor = permiso.ses.nombre;
  try {
    var ss = getDB();
    var hoja = ss.getSheetByName('Auditorias');
    if (!hoja) {
      hoja = ss.insertSheet('Auditorias');
      hoja.appendRow(['Fecha', 'Aula', 'Esperados', 'Presentes', 'Ausentes', 'No_pertenecen', 'IDs_Ausentes', 'IDs_No_pertenecen', 'Auditor']);
    }
    var pres = datos.presentes || [], aus = datos.ausentes || [], aje = datos.ajenos || [];
    hoja.appendRow([
      fechaAhora_(), String(datos.aula || ''), pres.length + aus.length,
      pres.length, aus.length, aje.length,
      aus.join(', '), aje.join(', '), String(datos.auditor || 'Anónimo')
    ]);
    return { exito: true, mensaje: 'Auditoría guardada en la hoja "Auditorias".' };
  } catch (e) {
    return { exito: false, mensaje: 'Error al guardar la auditoría: ' + e.message };
  }
}

/** Datos para el mapa 2D */
