/**
 * SICAM · server/BaseDeDatos.gs
 * Script de la base de datos: deja la hoja de cálculo lista y ordenada.
 * Se ejecuta UNA vez desde el editor de Apps Script (elige "prepararBaseDeDatos" y presiona Ejecutar).
 * Se puede repetir sin riesgo: no borra datos con contenido.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 *
 * Qué hace:
 *   1. Crea las hojas que falten con sus encabezados (Prestamos, Auditorias, Eliminados, Roles…).
 *   2. Da formato a los encabezados con los colores de SICAM y los deja fijos al bajar.
 *   3. Borra las filas vacías que quedaron en medio de los datos.
 *   4. Completa la hoja Estado con el ciclo de vida que usa la aplicación.
 *   5. Cifra las contraseñas que estaban escritas en texto normal y unifica los roles.
 *   6. Agrega listas desplegables (rol, estado y ubicación) para evitar errores al escribir a mano.
 *   7. Corrige nombres mal escritos (ej. "Elmer Antonio Soto Hernadez" → "Elmer Antonio Sorto Hernández").
 *   8. Quita las aulas 100 y 200, que no existen.
 */

/**
 * Encabezados de cada hoja (el orden de las columnas es el que lee el servidor).
 * Es una función (y no una variable) para que funcione sin importar el orden de los archivos .gs.
 */
function esquemaBD_() {
  return {
    Catalogo: ['ID_Activo', 'Nombre', 'Categoria', 'Marca_Modelo', 'Ubicacion', 'Asignado_A', 'Costo', 'Estado', 'Observaciones', 'URL_Foto', 'Vector_IA'],
    Reportes: ['Fecha', 'ID_Activo', 'Nombre', 'Tipo_Falla', 'Detalle', 'Estado_Anterior', 'Reportado_Por', 'Foto'],
    Usuarios: ['Usuario', 'Contraseña', 'Nombre', 'Rol', 'Metodo', 'Fecha'],
    Aulas: ['ID_Aula', 'Nombre_Aula', 'Edificio', 'Planta'],
    Personal: ['ID_Personal', 'Nombre_Completo', 'Cargo'],
    Categorias: ['Codigo', 'Nombre', 'Grupo'],
    Estado: ['Estado', 'Descripcion'],
    Prestamos: COLS_PRESTAMO,
    Mantenimiento: ['ID_Activo', 'Fecha_Alta', 'Ultimo_Mantenimiento', 'Intervalo_Meses'],
    Bajas: ['Fecha', 'ID_Activo', 'Nombre', 'Categoría', 'Ubicación', 'Costo', 'Estado_Anterior', 'Destino', 'Detalle', 'Responsable', 'Acta'],
    Kits: ['ID_Kit', 'Nombre', 'Aula', 'IDs_Activos', 'Creado', 'Actualizado', 'Responsable'],
    Auditorias: ['Fecha', 'Aula', 'Esperados', 'Presentes', 'Ausentes', 'No_pertenecen', 'IDs_Ausentes', 'IDs_No_pertenecen', 'Auditor'],
    Eliminados: ['Fecha_Eliminacion', 'Eliminado_Por', 'Motivo', 'ID_Activo', 'Nombre', 'Categoria', 'Marca_Modelo', 'Ubicacion',
      'Asignado_A', 'Costo', 'Estado', 'Observaciones', 'URL_Foto', 'Vector_IA'],
    Roles: ['Rol', 'Quién es', 'Qué puede hacer']
  };
}

/** Ciclo de vida de un bien (hoja Estado) */
var ESTADOS_BD = [
  ['Excelente', 'Como nuevo'],
  ['Bueno', 'Funciona bien'],
  ['Regular', 'Se puede usar, pero tiene desgaste'],
  ['Dañado', 'No se puede usar hasta repararlo'],
  ['En Mantenimiento', 'Se reportó una falla y está en reparación'],
  ['Para Baja', 'Ya no conviene repararlo; espera la decisión de la Dirección'],
  ['De Baja', 'Salió del inventario (donación, reciclaje o repuestos)']
];

/** Explicación de cada rol (hoja Roles) */
function rolesBD_() {
  return [
    [ROL_USUARIO, 'Docentes y estudiantes colaboradores', 'Consultar el inventario y el mapa, escanear códigos QR y reportar fallas.'],
    [ROL_DIRECTIVO, 'Dirección y Subdirección', 'Todo lo del usuario, más: ver préstamos y gestión, auditar aulas, autorizar bajas e imprimir informes.'],
    [ROL_ADMIN, 'Encargado del inventario', 'Todo: registrar, editar y eliminar bienes, préstamos, mantenimiento, kits, avisos y roles de usuarios.']
  ];
}

/** Correcciones de ortografía: [hoja, columna, texto mal escrito, texto correcto] */
var CORRECCIONES_BD = [
  ['Catalogo', 6, 'Elmer Antonio Soto Hernadez', 'Elmer Antonio Sorto Hernández'],
  ['Catalogo', 6, 'Elmer Antonio Soto Hernández', 'Elmer Antonio Sorto Hernández'],
  ['Catalogo', 6, 'Elmer Antonio Sorto Hernadez', 'Elmer Antonio Sorto Hernández'],
  ['Personal', 2, 'Elmer Antonio Soto Hernadez', 'Elmer Antonio Sorto Hernández'],
  ['Personal', 2, 'Elmer Antonio Soto Hernández', 'Elmer Antonio Sorto Hernández'],
  ['Personal', 2, 'Elmer Antonio Sorto Hernadez', 'Elmer Antonio Sorto Hernández']
];

/** Color de los encabezados (azul marino del logo) */
var COLOR_ENCABEZADO = '#01265d';

/** Punto de entrada: ejecútalo desde el editor. Devuelve (y escribe en el registro) lo que hizo. */
function prepararBaseDeDatos() {
  if (!desdeEditor_()) return { exito: false, mensaje: MENSAJE_SOLO_EDITOR };
  var ss = getDB();
  var log = [];
  var ESQUEMA_BD = esquemaBD_(), ROLES_BD = rolesBD_();

  // 1 y 2. Hojas y encabezados
  Object.keys(ESQUEMA_BD).forEach(function (nombre) {
    var h = ss.getSheetByName(nombre);
    if (!h) { h = ss.insertSheet(nombre); log.push('Hoja creada: ' + nombre); }
    var enc = ESQUEMA_BD[nombre];
    var actual = h.getLastRow() >= 1 ? h.getRange(1, 1, 1, enc.length).getValues()[0] : [];
    if (!String(actual[0] || '').trim()) h.getRange(1, 1, 1, enc.length).setValues([enc]);
    else {
      // Completa solo los encabezados que falten, sin renombrar los existentes
      var faltan = false;
      for (var c = 0; c < enc.length; c++) if (!String(actual[c] || '').trim()) { actual[c] = enc[c]; faltan = true; }
      if (faltan) { h.getRange(1, 1, 1, enc.length).setValues([actual]); log.push('Encabezados completados en ' + nombre); }
    }
    h.getRange(1, 1, 1, enc.length)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground(COLOR_ENCABEZADO);
    h.setFrozenRows(1);
  });

  // 3. Filas vacías en medio de los datos
  log.push(quitarFilasVacias_(ss.getSheetByName('Catalogo'), null, 'Catalogo'));
  log.push(quitarFilasVacias_(ss.getSheetByName('Aulas'), null, 'Aulas'));
  log.push(quitarFilasVacias_(ss.getSheetByName('Reportes'), null, 'Reportes'));
  // En Personal hay filas con solo el número de ID: se consideran vacías si no tienen nombre ni cargo
  log.push(quitarFilasVacias_(ss.getSheetByName('Personal'), [2, 3], 'Personal'));

  // 4. Hoja Estado
  var hEstado = ss.getSheetByName('Estado');
  if (hEstado.getLastRow() > 1) hEstado.getRange(2, 1, hEstado.getLastRow() - 1, 2).setValues(
    hEstado.getRange(2, 1, hEstado.getLastRow() - 1, 2).getValues().map(function () { return ['', '']; }));
  hEstado.getRange(2, 1, ESTADOS_BD.length, 2).setValues(ESTADOS_BD);
  quitarFilasVacias_(hEstado, null, 'Estado');
  log.push('Hoja Estado con el ciclo de vida completo (' + ESTADOS_BD.length + ' estados).');

  // Hoja Roles
  var hRoles = ss.getSheetByName('Roles');
  hRoles.getRange(2, 1, ROLES_BD.length, 3).setValues(ROLES_BD);

  // 5. Usuarios: contraseñas cifradas y roles unificados
  var hU = ss.getSheetByName('Usuarios');
  var cifradas = 0;
  if (hU.getLastRow() > 1) {
    var u = hU.getRange(2, 1, hU.getLastRow() - 1, 4).getValues();
    u.forEach(function (fila) {
      var pass = String(fila[1] || '');
      if (pass && pass.indexOf('sha256$') !== 0) { fila[1] = cifrarContrasena_(pass); cifradas++; }
      fila[3] = rolNormalizado_(fila[3]);
      fila[0] = String(fila[0] || '').trim();
    });
    hU.getRange(2, 1, u.length, 4).setValues(u);
  }
  log.push('Usuarios: ' + cifradas + ' contraseña(s) cifrada(s); roles unificados (Usuario, Directivo, Administrador).');

  // 6. Listas desplegables y formatos
  var dv = SpreadsheetApp.newDataValidation;
  hU.getRange('D2:D').setDataValidation(dv().requireValueInList([ROL_USUARIO, ROL_DIRECTIVO, ROL_ADMIN], true).setAllowInvalid(false).build());
  var hCat = ss.getSheetByName('Catalogo');
  // Estado: aviso (no bloqueo) porque los dados de baja llevan el destino entre paréntesis
  hCat.getRange('H2:H').setDataValidation(dv().requireValueInList(ESTADOS_BD.map(function (e) { return e[0]; }), true).setAllowInvalid(true).build());
  hCat.getRange('E2:E').setDataValidation(dv().requireValueInRange(ss.getSheetByName('Aulas').getRange('B2:B'), true).setAllowInvalid(true).build());
  hCat.getRange('G2:G').setNumberFormat('$#,##0.00');
  ss.getSheetByName('Prestamos').getRange('E:E').setNumberFormat('@');
  log.push('Listas desplegables en Usuarios (Rol) y Catalogo (Estado y Ubicación).');

  // 7. Nombres mal escritos
  var corregidos = 0;
  CORRECCIONES_BD.forEach(function (c) {
    var h = ss.getSheetByName(c[0]);
    if (!h || h.getLastRow() < 2) return;
    var r = h.getRange(2, c[1], h.getLastRow() - 1, 1);
    var v = r.getValues(), cambio = false;
    v.forEach(function (f) { if (String(f[0]).trim() === c[2]) { f[0] = c[3]; cambio = true; corregidos++; } });
    if (cambio) r.setValues(v);
  });
  if (corregidos) log.push('Ortografía: ' + corregidos + ' nombre(s) corregido(s).');

  // 8. Aulas que no existen
  var aulas = actualizarAulas();
  log.push('Aulas: ' + aulas.nuevas + ' agregada(s) y ' + aulas.borradas + ' quitada(s) (100 y 200 no existen).');

  invalidarCache_();
  log = log.filter(function (x) { return x; });
  Logger.log(log.join('\n'));
  return log;
}

/**
 * Borra las filas vacías de una hoja (de abajo hacia arriba para no desordenar los números de fila).
 * columnas: si se indica (ej. [2, 3]), la fila se considera vacía cuando esas columnas están vacías.
 */
function quitarFilasVacias_(hoja, columnas, nombre) {
  if (!hoja || hoja.getLastRow() < 2) return '';
  var ancho = Math.max(1, hoja.getLastColumn());
  var datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues();
  var borradas = 0;
  for (var i = datos.length - 1; i >= 0; i--) {
    var revisar = columnas ? columnas.map(function (c) { return datos[i][c - 1]; }) : datos[i];
    var vacia = revisar.every(function (v) { return String(v == null ? '' : v).trim() === ''; });
    if (vacia) { hoja.deleteRow(i + 2); borradas++; }
  }
  return borradas ? nombre + ': ' + borradas + ' fila(s) vacía(s) eliminada(s).' : '';
}
