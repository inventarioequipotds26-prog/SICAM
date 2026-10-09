/**
 * SICAM · server/Activos.gs
 * Lectura de activos (Leer): lista completa, estadísticas, ficha de un bien y sus fotos.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

function obtenerCatalogo() {
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (!hoja) return [];
    var last = hoja.getLastRow();
    if (last < 2) return [];
    var datos = hoja.getRange(1, 1, last, 11).getValues();
    var catalogo = [];
    for (var i = 1; i < datos.length; i++) {
      var vectorString = datos[i][10];
      if (vectorString && vectorString !== '' && vectorString !== '[]') {
        try {
          catalogo.push({
            id: String(datos[i][0]).trim(),
            nombre: datos[i][1],
            categoria: datos[i][2],
            marca: datos[i][3],
            ubicacion: datos[i][4],
            asignado: datos[i][5],
            costo: datos[i][6],
            estado: datos[i][7],
            vector: JSON.parse(vectorString)
          });
        } catch (e) {}
      }
    }
    return catalogo;
  } catch (e) { return []; }
}

/**
 * Lista de activos (sin el vector de IA, que es muy pesado).
 * Usa caché de 5 minutos; forzar = true la vuelve a leer de la hoja.
 */
function obtenerListaActivos(forzar) {
  if (!forzar) {
    var enCache = leerCacheActivos_();
    if (enCache) return enCache;
  }
  var lista = leerListaActivosHoja_();
  guardarCacheActivos_(lista);
  return lista;
}

function leerListaActivosHoja_() {
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (!hoja) return [];
    var last = hoja.getLastRow();
    if (last < 2) return [];
    // Solo columnas A–J: la K guarda el vector de IA y hace lenta la lectura
    var datos = hoja.getRange(1, 1, last, 10).getValues();
    var lista = [];
    for (var i = 1; i < datos.length; i++) {
      var id = String(datos[i][0] == null ? '' : datos[i][0]).trim();
      if (!id || id.toLowerCase() === 'id_activo' || id.toLowerCase() === 'id') continue;
      lista.push({
        id: id,
        nombre: String(datos[i][1] || ''),
        categoria: String(datos[i][2] || ''),
        marca: String(datos[i][3] || ''),
        ubicacion: String(datos[i][4] || ''),
        asignado: String(datos[i][5] || ''),
        costo: Number(datos[i][6]) || 0,
        estado: String(datos[i][7] || ''),
        observaciones: String(datos[i][8] || ''),
        urlFoto: String(datos[i][9] || '')
      });
    }
    // Marca los bienes que están prestados ahora mismo
    var prestados = mapaPrestados_(ss);
    for (var p = 0; p < lista.length; p++) {
      var pr = prestados[normalizarId(lista[p].id).toUpperCase()];
      if (pr) { lista[p].prestamo = pr.id; lista[p].prestamoHasta = pr.limite; }
    }
    return lista;
  } catch (e) { return []; }
}

function obtenerEstadisticas() {
  try {
    var lista = obtenerListaActivos();
    var total = lista.length;
    var valor = 0;
    var mantenimiento = 0;
    var danado = 0;
    var bueno = 0;
    var porCategoria = {};
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      valor += Number(a.costo) || 0;
      var est = (a.estado || '').toLowerCase();
      if (est.indexOf('manten') >= 0) mantenimiento++;
      else if (est.indexOf('dañ') >= 0 || est.indexOf('dan') >= 0) danado++;
      else bueno++;
      var cat = a.categoria || 'Sin categoría';
      porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    }
    return {
      total: total, valor: valor, mantenimiento: mantenimiento,
      danado: danado, bueno: bueno, porCategoria: porCategoria
    };
  } catch (e) {
    return { total: 0, valor: 0, mantenimiento: 0, danado: 0, bueno: 0, porCategoria: {} };
  }
}

function extraerIdDrive(url) {
  if (!url) return '';
  var s = String(url);
  var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(s.trim())) return s.trim();
  return '';
}

function fotoComoDataUri(urlOId) {
  try {
    var fileId = extraerIdDrive(urlOId);
    if (!fileId) return '';
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var mime = blob.getContentType() || 'image/jpeg';
    var b64 = Utilities.base64Encode(blob.getBytes());
    return 'data:' + mime + ';base64,' + b64;
  } catch (e) { return ''; }
}

function obtenerActivoPorId(id) {
  var buscado = normalizarId(id);
  var buscadoUp = buscado.toUpperCase();

  try {
    var ss = getDB();
    var nombreLibro = ss.getName();
    var nombresHojas = listarNombresHojas(ss);
    var hoja = getHojaCatalogo(ss);
    var ejemplos = [];

    if (!hoja) {
      return { _error: true, mensaje: 'No existe la hoja Catalogo', buscado: buscado, libro: nombreLibro, totalFilas: 0, ejemplos: [], hojas: nombresHojas };
    }

    var last = hoja.getLastRow();
    if (last < 2) {
      return { _error: true, mensaje: 'Catalogo vacío', buscado: buscado, libro: nombreLibro, hojaUsada: hoja.getName(), totalFilas: 0, ejemplos: [], hojas: nombresHojas };
    }

    var datos = hoja.getRange(1, 1, last, 10).getDisplayValues();
    var urlApp = obtenerUrlWebApp();

    for (var i = 1; i < datos.length; i++) {
      var idFila = normalizarId(datos[i][0]);
      if (!idFila) continue;

      var low = idFila.toLowerCase();
      if (low === 'id_activo' || low === 'id') continue;

      if (ejemplos.length < 15) ejemplos.push(idFila);

      var idUp = idFila.toUpperCase();

      // Primero se busca el ID exacto; la coincidencia parcial solo se usa si no hay exacta
      var parcial = buscadoUp.length >= 6 && (idUp.indexOf(buscadoUp) >= 0 || buscadoUp.indexOf(idUp) >= 0);
      if (idUp !== buscadoUp && !(parcial && !existeIdExacto_(datos, buscadoUp))) continue;
      {
        var urlFoto = datos[i][9] || '';
        var fotos = parsearFotos(urlFoto);
        // La foto ya no se convierte a base64 aquí (era lo más lento de la ficha):
        // el navegador la pide directo a Drive y solo si falla usa obtenerFotoData.
        return {
          id: idFila,
          nombre: datos[i][1] || '',
          categoria: datos[i][2] || '',
          marca: datos[i][3] || '',
          ubicacion: datos[i][4] || '',
          asignado: datos[i][5] || '',
          costo: datos[i][6] || '',
          estado: datos[i][7] || '',
          observaciones: datos[i][8] || '',
          urlFoto: urlFoto,
          fotos: fotos,
          fotoData: '',
          obsComunes: observacionesComunes(datos[i][1], datos[i][2]),
          historial: obtenerHistorialActivo(idFila),
          prestamo: prestamoPublico_(idFila),
          urlApp: urlApp
        };
      }
    }

    return { _error: true, mensaje: 'No encontrado', buscado: buscado, libro: nombreLibro, hojaUsada: hoja.getName(), totalFilas: ejemplos.length, ejemplos: ejemplos, hojas: nombresHojas };
  } catch (err) {
    return { _error: true, mensaje: 'Error: ' + err.message, buscado: buscado, totalFilas: 0, ejemplos: [] };
  }
}

function parsearFotos(celda) {
  var s = String(celda || '');
  if (!s || s === 'Sin foto') return [];
  var partes = s.split('|');
  var out = [];
  for (var i = 0; i < partes.length; i++) {
    var u = String(partes[i]).trim();
    if (u && u !== 'Sin foto' && extraerIdDrive(u)) out.push(u);
  }
  return out;
}

function obtenerFotoData(url) {
  return fotoComoDataUri(url);
}

// ----- CRUD: editar y eliminar activos (crear = guardarActivoMaster, leer = obtenerListaActivos) -----

/**
 * Edita los datos de un activo (columnas B a I). El ID, las fotos y el vector de IA no cambian.
 * datos: { id, nombre, categoria, marca, ubicacion, asignado, costo, estado, observaciones, usuario }
 */
function editarActivo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var error = validarActivo_(datos);
    if (error) return { exito: false, mensaje: error };
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    var fila = buscarFilaPorId_(hoja, datos.id);
    if (fila === -1) return { exito: false, mensaje: 'No se encontró el activo ' + datos.id };

    var antes = hoja.getRange(fila, 2, 1, 8).getValues()[0];
    var nuevos = [
      limpiarTexto_(datos.nombre, 120), limpiarTexto_(datos.categoria, 120), limpiarTexto_(datos.marca, 80),
      limpiarTexto_(datos.ubicacion, 80), limpiarTexto_(datos.asignado || 'Sin asignar', 120),
      (datos.costo === '' || datos.costo == null) ? 0 : Number(datos.costo),
      limpiarTexto_(datos.estado || 'Bueno', 40), limpiarTexto_(datos.observaciones, 1000)
    ];
    var etiquetas = ['nombre', 'categoría', 'marca', 'ubicación', 'asignado', 'costo', 'estado', 'observaciones'];
    var cambios = [];
    for (var i = 0; i < nuevos.length; i++) if (String(antes[i]) !== String(nuevos[i])) cambios.push(etiquetas[i]);
    if (!cambios.length) return { exito: true, mensaje: 'No había cambios que guardar.' };

    hoja.getRange(fila, 2, 1, 8).setValues([nuevos]);
    getHojaReportes_(ss).appendRow([fechaAhora_(), datos.id, nuevos[0], 'EDICIÓN', 'Cambió: ' + cambios.join(', '),
      antes[6], limpiarTexto_(datos.usuario, 120) || 'Anónimo', '']);
    invalidarCache_();
    return { exito: true, mensaje: 'Cambios guardados (' + cambios.join(', ') + ').' };
  });
}

/**
 * Elimina un activo del Catalogo (solo administradores).
 * La fila completa se copia antes a la hoja "Eliminados", así se puede recuperar.
 * datos: { id, motivo, usuario }
 */
function eliminarActivo(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  return conCandado_(function () {
    var motivo = limpiarTexto_(datos.motivo, 300);
    if (motivo.length < 5) return { exito: false, mensaje: 'Escribe el motivo de la eliminación (mínimo 5 letras).' };
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    var fila = buscarFilaPorId_(hoja, datos.id);
    if (fila === -1) return { exito: false, mensaje: 'No se encontró el activo ' + datos.id };
    if (mapaPrestados_(ss)[normalizarId(datos.id).toUpperCase()]) {
      return { exito: false, mensaje: 'Este bien está prestado. Registra primero la devolución.' };
    }
    var ancho = Math.max(11, hoja.getLastColumn());
    var valores = hoja.getRange(fila, 1, 1, ancho).getValues()[0];
    var papelera = ss.getSheetByName('Eliminados');
    if (!papelera) {
      papelera = ss.insertSheet('Eliminados');
      papelera.appendRow(['Fecha_Eliminacion', 'Eliminado_Por', 'Motivo'].concat(hoja.getRange(1, 1, 1, ancho).getValues()[0]));
      papelera.setFrozenRows(1);
    }
    papelera.appendRow([fechaAhora_(), limpiarTexto_(datos.usuario, 120), motivo].concat(valores));
    hoja.deleteRow(fila);
    getHojaReportes_(ss).appendRow([fechaAhora_(), datos.id, valores[1], 'ELIMINADO', motivo, valores[7], limpiarTexto_(datos.usuario, 120), '']);
    invalidarCache_();
    return { exito: true, mensaje: 'Activo eliminado. Una copia quedó en la hoja "Eliminados".' };
  });
}
