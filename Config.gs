/**
 * SICAM · config/Config.gs
 * Configuración general del sistema: hoja de cálculo, códigos y reglas fijas.
 * Para instalar el sistema en otra escuela solo hay que cambiar SPREADSHEET_ID y CODIGO_CENTRO.
 */

/** ID de la hoja de cálculo de Google que funciona como base de datos */
var SPREADSHEET_ID = '1yrrFjU3N3ePPtGqez_WQXUY7EuNdhHk3_-EXymAxeR8';

/** Código fijo del centro escolar (Centro Escolar General Francisco Morazán) */
var CODIGO_CENTRO = '11532';

/** Máximo de fotos por bien */
var MAX_FOTOS = 5;

/** Roles (columna D de la hoja Usuarios) y duración de una sesión */
var ROL_USUARIO = 'Usuario';
var ROL_DIRECTIVO = 'Directivo';
var ROL_ADMIN = 'Administrador';
var SESION_DIAS = 30;

/** Caché del inventario (acelera la carga: evita leer toda la hoja en cada vista) */
var CACHE_CLAVE = 'sicam_activos_v2';
var CACHE_SEGUNDOS = 300;      // 5 min; también se borra al guardar, reportar o reparar
var CACHE_TROZO = 90000;       // CacheService admite ~100 KB por clave

/** Espacios que NO existen en la escuela: se ignoran aunque aparezcan en la hoja Aulas */
var AULAS_INEXISTENTES = ['Aula 100', 'Aula 200'];

/** Ciclo de vida: Excelente → Bueno → Regular → En Mantenimiento → Para Baja → De Baja (destino) */
var ESTADOS_CICLO = ['Excelente', 'Bueno', 'Regular', 'Dañado', 'En Mantenimiento', 'Para Baja'];
var DESTINOS_BAJA = ['Repuestos', 'Reparar', 'Donación', 'Reciclaje'];
var FALLAS_PARA_BAJA = 3;          // fallas en 12 meses para proponer la baja
var DIAS_AVISO_PROXIMO = 30;       // "próximos" = vencen en 30 días o menos

/** Préstamos: tipos de persona, condiciones de devolución y columnas de la hoja "Prestamos" */
var TIPOS_PERSONA = ['Estudiante', 'Docente', 'Responsable'];
var CONDICIONES_DEVOLUCION = ['Bueno', 'Regular', 'Dañado'];
var COLS_PRESTAMO = ['ID_Prestamo', 'Fecha_Prestamo', 'Tipo_Persona', 'Tipo_Documento', 'Documento', 'Nombre_Completo',
  'Grado', 'Seccion', 'Telefono', 'IDs_Activos', 'Bienes', 'Fecha_Limite', 'Estado', 'Fecha_Cierre',
  'Condicion_Devolucion', 'Observaciones', 'Registrado_Por', 'Cerrado_Por'];
