/**
 * SICAM · server/Utilidades.gs
 * Utilidades del servidor: caché del inventario, fechas, búsqueda de filas y fotos en Drive.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

// ===== CACHÉ (acelera la carga: evita leer toda la hoja en cada vista) =====


function leerCacheActivos_() {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(CACHE_CLAVE + '_n'));
    if (!n) return null;
    var claves = [];
    for (var i = 0; i < n; i++) claves.push(CACHE_CLAVE + '_' + i);
    var partes = cache.getAll(claves);
    var json = '';
    for (var j = 0; j < n; j++) {
      var p = partes[CACHE_CLAVE + '_' + j];
      if (p == null) return null;
      json += p;
    }
    return JSON.parse(json);
  } catch (e) { return null; }
}

function guardarCacheActivos_(lista) {
  try {
    var json = JSON.stringify(lista);
    var obj = {};
    var n = Math.ceil(json.length / CACHE_TROZO) || 1;
    if (n > 90) return; // demasiado grande para la caché; se lee directo de la hoja
    for (var i = 0; i < n; i++) obj[CACHE_CLAVE + '_' + i] = json.substr(i * CACHE_TROZO, CACHE_TROZO);
    obj[CACHE_CLAVE + '_n'] = String(n);
    CacheService.getScriptCache().putAll(obj, CACHE_SEGUNDOS);
  } catch (e) {}
}

function invalidarCache_() {
  try { CacheService.getScriptCache().remove(CACHE_CLAVE + '_n'); } catch (e) {}
}

/** Fecha corta para notas y reportes */
function fechaAhora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

/** Hoja Reportes (la crea si no existe y agrega la columna Foto al final si falta) */
function getHojaReportes_(ss) {
  var hojaRep = ss.getSheetByName('Reportes');
  if (!hojaRep) {
    hojaRep = ss.insertSheet('Reportes');
    hojaRep.appendRow(['Fecha', 'ID_Activo', 'Nombre', 'Tipo_Falla', 'Detalle', 'Estado_Anterior', 'Reportado_Por', 'Foto']);
  } else if (hojaRep.getLastColumn() < 8) {
    hojaRep.getRange(1, 8).setValue('Foto');
  }
  return hojaRep;
}

/** Busca la fila (1-based) de un ID leyendo solo la columna A */
function buscarFilaPorId_(hoja, id) {
  var last = hoja.getLastRow();
  if (last < 2) return -1;
  var ids = hoja.getRange(1, 1, last, 1).getValues();
  var buscado = normalizarId(id).toUpperCase();
  for (var i = 1; i < ids.length; i++) {
    if (normalizarId(ids[i][0]).toUpperCase() === buscado) return i + 1;
  }
  return -1;
}

/** Guarda una foto base64 en la carpeta SICAM_Fotos y devuelve su URL */
function guardarFotoDrive_(b64, nombreArchivo) {
  var s = String(b64 || '');
  if (s.length < 50 || s.indexOf(',') < 0) return '';
  var carpetas = DriveApp.getFoldersByName('SICAM_Fotos');
  var carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder('SICAM_Fotos');
  var blob = Utilities.newBlob(Utilities.base64Decode(s.split(',')[1]), 'image/jpeg', nombreArchivo);
  var archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + archivo.getId();
}

/**
 * Extrae el código numérico del bien desde el valor de categoría.
 */
