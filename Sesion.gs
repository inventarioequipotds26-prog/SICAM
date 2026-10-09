/**
 * SICAM · server/Sesion.gs
 * Sesiones y roles. Al iniciar sesión el servidor entrega una llave (token) aleatoria;
 * el navegador la manda en cada acción y el servidor averigua quién es y qué rol tiene
 * leyendo la hoja Usuarios. Así nadie puede hacerse pasar por otro cambiando su navegador.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 *
 * Roles (columna D de la hoja Usuarios):
 *   Usuario        → docentes y estudiantes colaboradores: consultan, escanean y reportan fallas.
 *   Directivo      → Dirección y Subdirección: ven todo, autorizan bajas, auditan e imprimen informes.
 *   Administrador  → encargado del inventario: puede hacer todo.
 */

/** Convierte lo escrito en la hoja ("admin", "Director", "Subdirectora"…) en uno de los tres roles */
function rolNormalizado_(texto) {
  var t = sinTildes_(String(texto || ''));
  if (t.indexOf('admin') >= 0) return ROL_ADMIN;
  if (t.indexOf('direct') >= 0 || t.indexOf('director') >= 0 || t.indexOf('subdirec') >= 0) return ROL_DIRECTIVO;
  return ROL_USUARIO;
}

/** Crea una sesión nueva para el correo dado y devuelve su llave */
function crearSesion_(email) {
  var props = PropertiesService.getScriptProperties();
  var ahora = Date.now();
  // Limpia las sesiones vencidas para no llenar las propiedades del script
  var todas = props.getProperties();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('ses_') !== 0) return;
    try { if (JSON.parse(todas[k]).exp < ahora) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  props.setProperty('ses_' + token, JSON.stringify({ u: String(email).toLowerCase(), exp: ahora + SESION_DIAS * 86400000 }));
  return token;
}

/**
 * Devuelve { email, nombre, rol } del dueño de la llave, o null si la llave no existe o venció.
 * El rol se lee siempre de la hoja, así un cambio de rol aplica de inmediato.
 */
function sesion_(token) {
  token = String(token || '').replace(/[^a-f0-9]/gi, '');
  if (!token) return null;
  var guardada = PropertiesService.getScriptProperties().getProperty('ses_' + token);
  if (!guardada) return null;
  var s;
  try { s = JSON.parse(guardada); } catch (e) { return null; }
  if (!s || s.exp < Date.now()) return null;
  var datos = _getHojaUsuarios().getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0] || '').trim().toLowerCase() === s.u) {
      return { email: s.u, nombre: String(datos[i][2] || s.u).trim(), rol: rolNormalizado_(datos[i][3]) };
    }
  }
  return null; // la cuenta se borró de la hoja
}

/**
 * Revisa que la llave sea válida y que su rol esté entre los permitidos.
 * Devuelve { ses } si puede, o { error: { exito:false, mensaje } } si no.
 */
function exigirRol_(token, roles) {
  var ses = sesion_(token);
  if (!ses) return { error: { exito: false, sesionVencida: true, mensaje: 'Tu sesión venció. Vuelve a iniciar sesión.' } };
  if (roles && roles.indexOf(ses.rol) < 0) {
    var nombres = roles.map(function (r) { return r === ROL_ADMIN ? 'un administrador' : (r === ROL_DIRECTIVO ? 'un directivo' : 'un usuario'); });
    return { error: { exito: false, mensaje: 'Esta acción solo la puede hacer ' + nombres.join(' o ') + '.' } };
  }
  return { ses: ses };
}

/**
 * true cuando la función se ejecuta desde el editor de Apps Script por el dueño del sistema.
 * Así las funciones de mantenimiento (preparar la base de datos, sembrar categorías…)
 * no se pueden llamar desde el navegador de otra persona.
 */
function desdeEditor_() {
  try {
    var activo = Session.getActiveUser().getEmail();
    return !!activo && activo === Session.getEffectiveUser().getEmail();
  } catch (e) { return false; }
}
var MENSAJE_SOLO_EDITOR = 'Esta función se ejecuta desde el editor de Apps Script (botón ▶ Ejecutar).';

/** Cierra la sesión en el servidor (la llave deja de servir) */
function cerrarSesionServidor(token) {
  token = String(token || '').replace(/[^a-f0-9]/gi, '');
  if (token) PropertiesService.getScriptProperties().deleteProperty('ses_' + token);
  return { exito: true };
}

/** Datos actuales de la sesión (el navegador los pide al abrir para saber el rol vigente) */
function obtenerSesion(token) {
  var ses = sesion_(token);
  if (!ses) return { exito: false, sesionVencida: true, mensaje: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  return { exito: true, email: ses.email, nombre: ses.nombre, rol: ses.rol };
}

/* ---------- Administración de usuarios (solo administradores) ---------- */

/** Lista de cuentas sin contraseñas */
function obtenerUsuarios(token) {
  var p = exigirRol_(token, [ROL_ADMIN]);
  if (p.error) return p.error;
  var datos = _getHojaUsuarios().getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < datos.length; i++) {
    if (!String(datos[i][0] || '').trim()) continue;
    lista.push({
      email: String(datos[i][0]).trim(), nombre: String(datos[i][2] || '').trim(),
      rol: rolNormalizado_(datos[i][3]), metodo: String(datos[i][4] || 'email'),
      fecha: datos[i][5] instanceof Date ? fechaCorta_(datos[i][5]) : String(datos[i][5] || '')
    });
  }
  return { exito: true, usuarios: lista, yo: p.ses.email };
}

/** Cambia el rol de una cuenta. No deja quitar el último administrador. */
function cambiarRolUsuario(datos) {
  return conCandado_(function () {
    var p = exigirRol_(datos && datos.token, [ROL_ADMIN]);
    if (p.error) return p.error;
    var rol = String(datos.rol || '');
    if ([ROL_USUARIO, ROL_DIRECTIVO, ROL_ADMIN].indexOf(rol) < 0) return { exito: false, mensaje: 'Rol no válido.' };
    var email = String(datos.email || '').trim().toLowerCase();
    var hoja = _getHojaUsuarios();
    var filas = hoja.getDataRange().getValues();
    var fila = -1, admins = 0;
    for (var i = 1; i < filas.length; i++) {
      if (rolNormalizado_(filas[i][3]) === ROL_ADMIN) admins++;
      if (String(filas[i][0] || '').trim().toLowerCase() === email) fila = i;
    }
    if (fila < 0) return { exito: false, mensaje: 'No se encontró la cuenta ' + email + '.' };
    if (rolNormalizado_(filas[fila][3]) === ROL_ADMIN && rol !== ROL_ADMIN && admins <= 1) {
      return { exito: false, mensaje: 'Debe quedar al menos un administrador.' };
    }
    hoja.getRange(fila + 1, 4).setValue(rol);
    return { exito: true, mensaje: String(filas[fila][2] || email) + ' ahora es ' + rol + '.' };
  });
}
