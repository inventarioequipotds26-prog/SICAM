/**
 * SICAM · server/Aulas.gs
 * Aulas y mapa 2D: estructura de edificios y plantas, y depuración de la hoja Aulas.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

function obtenerDatosMapa() {
  try {
    var lista = obtenerListaActivos();
    var porAula = {};
    var sinUbicacion = [];

    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      var ubi = String(a.ubicacion || '').trim();
      if (!ubi || ubi === '—' || ubi.toLowerCase() === 'sin asignar') {
        sinUbicacion.push(a);
        continue;
      }
      if (!porAula[ubi]) {
        porAula[ubi] = { nombre: ubi, activos: [], total: 0, bueno: 0, regular: 0, danado: 0, mantenimiento: 0 };
      }
      porAula[ubi].activos.push(a);
      porAula[ubi].total++;
      var est = (a.estado || '').toLowerCase();
      if (est.indexOf('manten') >= 0) porAula[ubi].mantenimiento++;
      else if (est.indexOf('dañ') >= 0 || est.indexOf('dan') >= 0 || est.indexOf('roto') >= 0) porAula[ubi].danado++;
      else if (est.indexOf('regular') >= 0) porAula[ubi].regular++;
      else porAula[ubi].bueno++;
    }

    var aulas = [];
    for (var k in porAula) if (porAula.hasOwnProperty(k)) aulas.push(porAula[k]);
    aulas.sort(function (x, y) { return String(x.nombre).localeCompare(String(y.nombre), 'es'); });

    var ss = getDB();
    var hojaAulas = ss.getSheetByName('Aulas') || ss.getSheetByName('Aula');
    var listaAulasMaestra = [];
    if (hojaAulas && hojaAulas.getLastRow() >= 2) {
      var rows = hojaAulas.getRange(2, 1, hojaAulas.getLastRow(), 3).getValues();
      for (var r = 0; r < rows.length; r++) {
        var nom = String(rows[r][1] || rows[r][0] || '').trim();
        if (nom) listaAulasMaestra.push({ id: String(rows[r][0] || ''), nombre: nom, edificio: String(rows[r][2] || '') });
      }
    }

    return { aulas: aulas, sinUbicacion: sinUbicacion, listaAulasMaestra: listaAulasMaestra, totalActivos: lista.length };
  } catch (e) {
    return { aulas: [], sinUbicacion: [], listaAulasMaestra: [], totalActivos: 0, error: e.message };
  }
}

function pedirPermisoCompletoDrive() {
  DriveApp.createFolder('Carpeta_Temporal_Borrar').setTrashed(true);
}

// ===== ESTRUCTURA DE LA ESCUELA (mapa 2D por edificio y planta) =====

/**
 * Edificios, plantas y espacios. El mapa los usa aunque la hoja Aulas no los tenga,
 * y también aparecen en la lista de ubicaciones al registrar.
 * Para cambiar la distribución, edita esta lista (o las columnas C y D de la hoja Aulas).
 */
function estructuraEscuela() {
  var out = [];
  function rango(edificio, planta, desde, hasta) {
    for (var n = desde; n <= hasta; n++) out.push({ nombre: 'Aula ' + n, edificio: edificio, planta: planta });
  }
  function lista(edificio, planta, nombres) {
    for (var i = 0; i < nombres.length; i++) out.push({ nombre: nombres[i], edificio: edificio, planta: planta });
  }
  rango('Edificio Verde', 1, 108, 114);
  rango('Edificio Verde', 2, 208, 214);
  rango('Edificio Naranja', 1, 101, 107);   // el Aula 100 no existe
  rango('Edificio Naranja', 2, 201, 207);   // el Aula 200 no existe
  lista('Edificio Principal', 1, ['Cocina', 'Comedor', 'Salón de Deporte', 'Salón de Reparación']);
  lista('Edificio Principal', 2, ['Dirección', 'Robótica', 'Registro Académico', 'Laboratorio', 'Subdirección']);
  return out;
}


function aulaExiste_(nombre) {
  var k = claveAula_(nombre);
  for (var i = 0; i < AULAS_INEXISTENTES.length; i++) if (claveAula_(AULAS_INEXISTENTES[i]) === k) return false;
  return true;
}

function claveAula_(n) { return sinTildes_(String(n || '')).replace(/\s+/g, ' ').trim(); }

/**
 * Llena/actualiza la hoja Aulas con la estructura de la escuela.
 * No borra filas: solo agrega las que faltan y completa Edificio y Planta.
 * Ejecútala una vez desde el editor (▶ actualizarAulas).
 */
function actualizarAulas() {
  if (!desdeEditor_()) return { exito: false, mensaje: MENSAJE_SOLO_EDITOR };
  var ss = getDB();
  var hoja = ss.getSheetByName('Aulas') || ss.insertSheet('Aulas');
  if (hoja.getLastRow() < 1) hoja.appendRow(['ID_Aula', 'Nombre_Aula', 'Edificio', 'Planta']);
  hoja.getRange(1, 1, 1, 4).setValues([['ID_Aula', 'Nombre_Aula', 'Edificio', 'Planta']]);
  // Borra las filas de espacios que no existen (Aula 100 y Aula 200), de abajo hacia arriba
  var borradas = 0;
  for (var b = hoja.getLastRow(); b >= 2; b--) {
    var fb = hoja.getRange(b, 1, 1, 2).getValues()[0];
    if (!aulaExiste_(fb[1] || fb[0]) || /^(100|200)$/.test(String(fb[0]).trim()) && !String(fb[1]).trim()) { hoja.deleteRow(b); borradas++; }
  }
  var last = hoja.getLastRow();
  var filas = last >= 2 ? hoja.getRange(2, 1, last - 1, 4).getValues() : [];
  var indice = {};
  for (var i = 0; i < filas.length; i++) indice[claveAula_(filas[i][1] || filas[i][0])] = i;
  var est = estructuraEscuela();
  var nuevas = [];
  for (var j = 0; j < est.length; j++) {
    var e = est[j];
    var k = claveAula_(e.nombre);
    var id = (e.nombre.match(/\d+/) || [e.nombre])[0];
    if (indice[k] != null) {
      filas[indice[k]][2] = e.edificio;
      filas[indice[k]][3] = e.planta;
    } else {
      nuevas.push([id, e.nombre, e.edificio, e.planta]);
    }
  }
  if (filas.length) hoja.getRange(2, 1, filas.length, 4).setValues(filas);
  if (nuevas.length) hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 4).setValues(nuevas);
  try { CacheService.getScriptCache().removeAll(['sicam_aulas_v5', 'sicam_listas_v6']); } catch (e2) {}
  Logger.log('Aulas actualizadas. Nuevas: ' + nuevas.length + ' · Borradas: ' + borradas);
  return { ok: true, nuevas: nuevas.length, borradas: borradas };
}

/** Antes borraba la hoja; ahora solo actualiza sin perder datos */
function llenarAulas() { return actualizarAulas(); }
