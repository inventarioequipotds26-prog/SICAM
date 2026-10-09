/**
 * SICAM · server/Usuarios.gs
 * Usuarios: registro, inicio de sesión con contraseña cifrada y acceso con Google.
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

// ===== AUTENTICACIÓN =====

function _getHojaUsuarios() {
  var ss = getDB();
  var hoja = ss.getSheetByName('Usuarios');
  if (!hoja) {
    hoja = ss.insertSheet('Usuarios');
    hoja.appendRow(['Usuario', 'Contraseña', 'Nombre', 'Rol', 'Metodo', 'Fecha']);
  } else if (hoja.getLastColumn() < 6) {
    hoja.getRange(1, 5, 1, 2).setValues([['Metodo', 'Fecha']]);
  }
  return hoja;
}

/** Contraseñas nuevas se guardan cifradas (sha256 con sal). Las viejas en texto siguen funcionando. */
function cifrarContrasena_(pass, sal) {
  sal = sal || Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + pass, Utilities.Charset.UTF_8);
  var hex = bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  return 'sha256$' + sal + '$' + hex;
}

function contrasenaCorrecta_(guardada, escrita) {
  var g = String(guardada == null ? '' : guardada).trim();
  if (!g) return false;
  if (g.indexOf('sha256$') === 0) {
    var partes = g.split('$');
    return cifrarContrasena_(escrita, partes[1]) === g;
  }
  return g === String(escrita).trim();
}

/** Datos que recibe el navegador al entrar, con una llave de sesión nueva (ver server/Sesion.gs) */
function datosUsuario_(fila, metodo) {
  var email = String(fila[0] || '').trim();
  return {
    exito: true,
    nombre: String(fila[2] || fila[0] || 'Usuario').trim() || 'Usuario',
    rol: rolNormalizado_(fila[3]),
    email: email,
    metodo: metodo || String(fila[4] || 'email').trim() || 'email',
    token: crearSesion_(email)
  };
}

/** Paso 1 del formulario estilo Google: ¿existe la cuenta? */
function verificarCuenta(usuario) {
  try {
    var userIn = String(usuario || '').trim().toLowerCase();
    if (!userIn) return { existe: false, mensaje: 'Escribe tu correo o usuario.' };
    var datos = _getHojaUsuarios().getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0] || '').trim().toLowerCase() === userIn) {
        var soloGoogle = String(datos[i][4] || '') === 'google' && !String(datos[i][1] || '').trim();
        return { existe: true, nombre: String(datos[i][2] || '').trim(), soloGoogle: soloGoogle };
      }
    }
    return { existe: false, mensaje: 'No encontramos esa cuenta. Revisa el correo o crea una cuenta.' };
  } catch (e) {
    return { existe: false, mensaje: 'Error en el servidor: ' + e.message };
  }
}

function validarUsuario(usuario, contrasena) {
  try {
    var userIn = String(usuario || '').trim().toLowerCase();
    var passIn = String(contrasena || '');
    if (!userIn || !passIn) return { exito: false, mensaje: 'Ingresa usuario y contraseña.' };
    var datos = _getHojaUsuarios().getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0] || '').trim().toLowerCase() !== userIn) continue;
      if (contrasenaCorrecta_(datos[i][1], passIn)) return datosUsuario_(datos[i]);
      if (String(datos[i][4] || '') === 'google' && !String(datos[i][1] || '').trim()) {
        return { exito: false, mensaje: 'Esta cuenta se creó con Google. Usa “Continuar con Google”.' };
      }
      return { exito: false, mensaje: 'Contraseña incorrecta. Inténtalo de nuevo.' };
    }
    return { exito: false, mensaje: 'No encontramos esa cuenta.' };
  } catch (e) {
    return { exito: false, mensaje: 'Error en el servidor: ' + e.message };
  }
}

function registrarUsuario(datos) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (eL) { return { exito: false, mensaje: 'El sistema está ocupado, intenta de nuevo.' }; }
  try {
    var email = String(datos.usuario || datos.email || '').trim().toLowerCase();
    var pass = String(datos.contrasena || '');
    var nombre = limpiarTexto_(datos.nombre, 80);

    if (!nombre) return { exito: false, mensaje: 'Ingresa tu nombre completo.' };
    if (!email || email.length < 3) return { exito: false, mensaje: 'Ingresa un correo o usuario válido.' };
    if (email.indexOf('@') >= 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { exito: false, mensaje: 'El correo no es válido.' };
    if (pass.length < 6) return { exito: false, mensaje: 'La contraseña debe tener al menos 6 caracteres.' };

    var hoja = _getHojaUsuarios();
    var datosH = hoja.getDataRange().getValues();
    for (var i = 1; i < datosH.length; i++) {
      if (String(datosH[i][0] || '').trim().toLowerCase() === email) {
        return { exito: false, mensaje: 'Ya existe una cuenta con ese correo/usuario. Inicia sesión.' };
      }
    }
    // Las cuentas nuevas siempre son "Usuario"; un administrador cambia el rol en Gestión › Usuarios.
    hoja.appendRow([email, cifrarContrasena_(pass), nombre, ROL_USUARIO, 'email', fechaAhora_()]);
    return { exito: true, mensaje: 'Cuenta creada. ¡Bienvenido!', nombre: nombre, rol: ROL_USUARIO, email: email, metodo: 'email', token: crearSesion_(email) };
  } catch (e) {
    return { exito: false, mensaje: 'Error al registrar: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Busca o crea la cuenta de un correo de Google YA VERIFICADO.
 * Es privada (termina en _): el navegador no puede llamarla para hacerse pasar por otra persona.
 */
function loginConGoogle_(email, nombre, fotoUrl) {
  try {
    email = String(email || '').trim().toLowerCase();
    nombre = String(nombre || '').trim() || email.split('@')[0] || 'Usuario Google';
    if (!email || email.indexOf('@') < 0) return { exito: false, mensaje: 'No se pudo obtener el correo de Google.' };

    var hoja = _getHojaUsuarios();
    var datos = hoja.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0] || '').trim().toLowerCase() === email) {
        var u = datosUsuario_(datos[i], 'google');
        u.foto = fotoUrl || '';
        return u;
      }
    }
    hoja.appendRow([email, '', nombre, ROL_USUARIO, 'google', fechaAhora_()]);
    return { exito: true, nombre: nombre, rol: ROL_USUARIO, email: email, metodo: 'google', foto: fotoUrl || '', nuevo: true, token: crearSesion_(email) };
  } catch (e) {
    return { exito: false, mensaje: 'Error con Google: ' + e.message };
  }
}

// ----- Inicio con Google (OAuth) que funciona dentro de Apps Script -----
// El botón de Google normal (One Tap) no funciona dentro de una Web App de Apps Script
// porque la página corre en un dominio googleusercontent.com que no se puede autorizar.
// Por eso se usa el flujo clásico: Google -> vuelve a esta Web App con ?code= -> el servidor
// lo canjea por el correo verificado. Requiere 2 propiedades del script (ver LEEME):
//   GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET

function configGoogle_() {
  var p = PropertiesService.getScriptProperties();
  return {
    id: String(p.getProperty('GOOGLE_CLIENT_ID') || '').trim(),
    secreto: String(p.getProperty('GOOGLE_CLIENT_SECRET') || '').trim(),
    // Si se define GOOGLE_REDIRECT_URI se usa esa (debe ser la URL /exec de la implementación)
    redirect: String(p.getProperty('GOOGLE_REDIRECT_URI') || '').trim() || obtenerUrlWebApp()
  };
}

/** Muestra en el registro la URL que hay que pegar en Google Cloud como "URI de redirección" */
function mostrarUrlRedireccion() {
  var url = obtenerUrlWebApp();
  Logger.log('URL desde el editor: ' + url);
  if (/\/dev$/.test(url)) {
    Logger.log('Esa termina en /dev (solo pruebas). Para Google usa la URL que termina en /exec: ' +
      'Implementar › Gestionar implementaciones › "URL de la aplicación web". ' +
      'Regístrala en Google Cloud y guárdala también en la propiedad GOOGLE_REDIRECT_URI.');
  }
  return url;
}

/** Devuelve la URL a la que el navegador debe ir para iniciar con Google */
function obtenerUrlLoginGoogle() {
  // 1) Si Apps Script ya conoce el correo (misma organización), no hace falta Google OAuth
  try {
    var activo = Session.getActiveUser().getEmail();
    if (activo) return { directo: true, email: activo };
  } catch (e) {}
  var cfg = configGoogle_();
  if (!cfg.id || !cfg.secreto) {
    return { error: 'El inicio con Google aún no está configurado. Falta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en las propiedades del script.' };
  }
  var estado = Utilities.getUuid();
  CacheService.getScriptCache().put('gstate_' + estado, '1', 600);
  var url = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(cfg.id) +
    '&redirect_uri=' + encodeURIComponent(cfg.redirect) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent('openid email profile') +
    '&prompt=select_account' +
    '&state=' + encodeURIComponent(estado);
  return { url: url };
}

/** Inicio directo cuando Apps Script ya sabe quién es el usuario */
function loginGoogleSesion() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) {}
  if (!email) return { exito: false, mensaje: 'No se pudo identificar tu cuenta de Google.' };
  return loginConGoogle_(email, email.split('@')[0], '');
}

/** Lo llama doGet cuando Google regresa con ?code=...&state=... */
function completarLoginGoogle_(params) {
  try {
    if (params.error) return { exito: false, mensaje: 'Inicio con Google cancelado.' };
    var cache = CacheService.getScriptCache();
    var estado = String(params.state || '');
    if (!estado || !cache.get('gstate_' + estado)) {
      return { exito: false, mensaje: 'La solicitud de Google expiró. Intenta de nuevo.', expirado: true };
    }
    cache.remove('gstate_' + estado);
    var cfg = configGoogle_();
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      payload: {
        code: String(params.code), client_id: cfg.id, client_secret: cfg.secreto,
        redirect_uri: cfg.redirect, grant_type: 'authorization_code'
      },
      muteHttpExceptions: true
    });
    var json = JSON.parse(resp.getContentText() || '{}');
    if (!json.id_token) return { exito: false, mensaje: 'Google no confirmó la cuenta: ' + (json.error_description || json.error || resp.getResponseCode()) };
    // El id_token llegó directo de Google por HTTPS: basta con leerlo y revisar audiencia y correo verificado
    var partes = json.id_token.split('.');
    var datos = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[1] + '==='.slice((partes[1].length + 3) % 4))).getDataAsString());
    if (datos.aud !== cfg.id) return { exito: false, mensaje: 'Token de Google no válido.' };
    if (datos.email_verified === false || datos.email_verified === 'false') return { exito: false, mensaje: 'Tu correo de Google no está verificado.' };
    return loginConGoogle_(datos.email, datos.name || datos.given_name || '', datos.picture || '');
  } catch (e) {
    return { exito: false, mensaje: 'Error con Google: ' + e.message };
  }
}
