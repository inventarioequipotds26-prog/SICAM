/**
 * SICAM · server/Validacion.gs
 * Validación y limpieza de datos en el servidor (nunca se confía solo en el navegador).
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

/**
 * Limpia un texto antes de guardarlo en la hoja:
 * quita caracteres de control, espacios repetidos y lo corta a "max" caracteres.
 * Si empieza con = + - @ se le antepone ' para que Sheets no lo ejecute como fórmula.
 */
function limpiarTexto_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

/** Reglas mínimas de un activo. Devuelve el mensaje de error o '' si todo está bien. */
function validarActivo_(d) {
  var nombre = limpiarTexto_(d.nombre, 120);
  if (nombre.length < 3) return 'Escribe el nombre del bien (mínimo 3 letras).';
  if (!limpiarTexto_(d.ubicacion, 80)) return 'Elige la ubicación (aula o espacio).';
  if (d.costo !== '' && d.costo != null) {
    var c = Number(d.costo);
    if (isNaN(c) || c < 0 || c > 100000) return 'El costo debe ser un número entre 0 y 100000.';
  }
  return '';
}

/** ¿Existe en la hoja un ID exactamente igual? (para no confundir IDs parecidos) */
function existeIdExacto_(datos, buscadoUp) {
  for (var i = 1; i < datos.length; i++) if (normalizarId(datos[i][0]).toUpperCase() === buscadoUp) return true;
  return false;
}
