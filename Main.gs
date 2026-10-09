/**
 * SICAM · server/Main.gs
 * Punto de entrada de la aplicación web: doGet, include de archivos HTML y acceso a la hoja de cálculo.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

function getDB() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function listarNombresHojas(ss) {
  var hojas = ss.getSheets();
  var nombres = [];
  for (var i = 0; i < hojas.length; i++) {
    nombres.push(hojas[i].getName());
  }
  return nombres;
}

/**
 * Encuentra la hoja del catálogo por nombre o por IDs CEFRAM
 */
function getHojaCatalogo(ss) {
  var candidatos = ['Catalogo', 'Catálogo', 'catalogo', 'CATALOGO', 'Inventario', 'inventario'];
  for (var i = 0; i < candidatos.length; i++) {
    var h = ss.getSheetByName(candidatos[i]);
    if (h && h.getLastRow() > 1) return h;
  }
  for (var j = 0; j < candidatos.length; j++) {
    var h2 = ss.getSheetByName(candidatos[j]);
    if (h2) return h2;
  }
  var hojas = ss.getSheets();
  for (var k = 0; k < hojas.length; k++) {
    var hoja = hojas[k];
    var last = hoja.getLastRow();
    if (last < 2) continue;
    var colA = hoja.getRange(1, 1, Math.min(last, 30), 1).getValues();
    for (var r = 0; r < colA.length; r++) {
      var v = String(colA[r][0] || '');
      if (v.indexOf('CEFRAM') >= 0 || v.indexOf(CODIGO_CENTRO + '-') === 0 || v.indexOf('11532-') === 0) return hoja;
    }
  }
  return hojas.length ? hojas[0] : null;
}

function normalizarId(v) {
  var s = String(v == null ? '' : v);
  try { s = decodeURIComponent(s); } catch (e) {}
  s = s.replace(/^["']+|["']+$/g, '');
  s = s.replace(/[\u00A0\u2007\u202F\uFEFF\u200B\u200C\u200D\r\n\t]/g, '');
  s = s.replace(/\s+/g, '');
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
  s = s.trim();
  return s;
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  var urlApp = obtenerUrlWebApp();
  var vistasValidas = ['inicio', 'inventario', 'escanear', 'reporte', 'mapa', 'registrar', 'qr', 'gestion', 'prestamos', 'ayuda'];

  // Regreso desde Google (inicio de sesión)
  var loginGoogle = null;
  if (params.code && params.state) loginGoogle = completarLoginGoogle_(params);
  else if (params.error && params.state) loginGoogle = { exito: false, mensaje: 'Inicio con Google cancelado.' };

  var idParam = params.id || params.ID || params.Id || params.codigo || '';
  if (idParam) {
    var t = HtmlService.createTemplateFromFile('Ficha');
    t.idActivo = normalizarId(idParam);
    t.urlApp = urlApp;
    var desde = String(params.from || '').toLowerCase();
    t.desde = (vistasValidas.indexOf(desde) >= 0) ? desde : '';
    return t.evaluate()
      .setTitle('SICAM - Ficha de Activo')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var vista = String(params.vista || (params.page === 'qr' ? 'qr' : 'inicio')).toLowerCase();
  if (vistasValidas.indexOf(vista) < 0) vista = 'inicio';

  var tIndex = HtmlService.createTemplateFromFile('Index');
  tIndex.vistaInicial = vista;
  tIndex.urlApp = urlApp;
  tIndex.loginGoogle = loginGoogle ? JSON.stringify(loginGoogle) : '';
  return tIndex
    .evaluate()
    .setTitle('SICAM - Inventario CEFRAM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Convierte un valor a texto JavaScript seguro para las plantillas HTML.
 * Se usa con <?!= ?> (sin escape automático). Antes se usaba <?= JSON.stringify() ?>
 * y Apps Script lo volvía a escapar, dejando la URL con comillas: por eso la ficha
 * abría "Página no encontrada" y los QR salían como texto.
 */
function jsonParaPlantilla(v) {
  return JSON.stringify(v == null ? '' : String(v))
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Aulas con edificio y planta: estructura fija + hoja Aulas (columnas C y D) */
function obtenerAulasMaestra() {
  try {
    var g = CacheService.getScriptCache().get('sicam_aulas_v5');
    if (g) return JSON.parse(g);
  } catch (e) {}
  var mapa = {};
  var orden = [];
  var fijos = {};   // los espacios de estructuraEscuela() mandan sobre lo escrito en la hoja Aulas
  var poner = function (o, desdeHoja) {
    var k = claveAula_(o.nombre);
    if (!mapa[k]) { mapa[k] = { nombre: o.nombre, edificio: '', planta: '' }; orden.push(k); }
    if (!desdeHoja) fijos[k] = true;
    else if (fijos[k]) return;
    if (o.edificio) mapa[k].edificio = o.edificio;
    if (o.planta) mapa[k].planta = Number(o.planta) || o.planta;
  };
  estructuraEscuela().forEach(poner);
  try {
    var h = getDB().getSheetByName('Aulas') || getDB().getSheetByName('Aula');
    if (h && h.getLastRow() >= 2) {
      var rows = h.getRange(2, 1, h.getLastRow() - 1, 4).getValues();
      for (var r = 0; r < rows.length; r++) {
        var nom = String(rows[r][1] || rows[r][0] || '').trim();
        if (nom && aulaExiste_(nom)) poner({ nombre: nom, edificio: String(rows[r][2] || '').trim(), planta: rows[r][3] }, true);
      }
    }
  } catch (e2) {}
  var out = orden.map(function (k) { return mapa[k]; });
  try { CacheService.getScriptCache().put('sicam_aulas_v5', JSON.stringify(out), 600); } catch (e3) {}
  return out;
}

/**
 * Inserta el contenido de otro archivo HTML del proyecto (estilos o scripts).
 * Se usan nombres con carpeta, por ejemplo 'css/Estilos' o 'js/App'. Si en el editor
 * de Apps Script el archivo se creó sin la carpeta (solo 'Estilos'), también lo encuentra.
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    var corto = String(filename).split('/').pop();
    if (corto === filename) throw e;
    return HtmlService.createHtmlOutputFromFile(corto).getContent();
  }
}

function obtenerUrlWebApp() {
  return ScriptApp.getService().getUrl();
}
