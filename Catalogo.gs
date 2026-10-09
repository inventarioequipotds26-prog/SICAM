/**
 * SICAM · server/Catalogo.gs
 * Catálogo de bienes: códigos del Manual Escolar, generación de IDs, listas y registro de activos (Crear).
 * Todos los archivos .gs comparten el mismo espacio global en Apps Script.
 */

function extraerCodigoBien(categoria) {
  var s = String(categoria || '').trim();
  if (!s) return '';
  var m = s.match(/^(\d{2,6})/);
  return m ? m[1] : '';
}

/**
 * Genera el siguiente ID: 11532-{codigoBien}-0001, 0002, 0003…
 */
function generarIdActivo(codigoBien) {
  var codigo = String(codigoBien || '').replace(/\D/g, '');
  if (!codigo) codigo = '0000';
  var prefijo = CODIGO_CENTRO + '-' + codigo + '-';
  var maxNum = 0;
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (hoja) {
      var last = hoja.getLastRow();
      if (last >= 2) {
        var ids = hoja.getRange(2, 1, last - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          var id = normalizarId(ids[i][0]);
          if (id.indexOf(prefijo) === 0) {
            var cola = id.substring(prefijo.length);
            var n = parseInt(cola, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        }
      }
    }
  } catch (e) {}
  var siguiente = maxNum + 1;
  var seq = ('0000' + siguiente).slice(-4);
  return prefijo + seq;
}

/**
 * Grupo según el prefijo del código del manual.
 */
function grupoPorCodigo(cod) {
  var c = String(cod || '');
  if (c.indexOf('01') === 0) return 'Equipo de oficina';
  if (c.indexOf('03') === 0) return 'Aparatos eléctricos';
  if (c.indexOf('04') === 0) return 'Ingeniería y dibujo';
  if (c.indexOf('07') === 0) return 'Audiovisual';
  if (c.indexOf('11') === 0) return 'Mobiliario';
  if (c.indexOf('12') === 0) return 'Instrumentos musicales';
  if (c.indexOf('13') === 0) return 'Deportivos';
  if (c.indexOf('14') === 0) return 'Objetos de museo';
  if (c.indexOf('15') === 0) return 'Artículos varios';
  if (c.indexOf('21') === 0) return 'Equipo médico';
  if (c.indexOf('31') === 0) return 'Equipo de medición';
  if (c.indexOf('32') === 0) return 'Laboratorio';
  if (c.indexOf('33') === 0) return 'Arte y oficio';
  if (c.indexOf('41') === 0) return 'Equipo agrícola';
  if (c.indexOf('44') === 0) return 'Reproducción e imprenta';
  if (c.indexOf('53') === 0) return 'Equipo telefónico';
  if (c.indexOf('54') === 0) return 'Sonido / TV';
  if (c.indexOf('55') === 0) return 'Equipo de energía';
  if (c.indexOf('56') === 0) return 'Refrigeración';
  if (c.indexOf('57') === 0) return 'Acueducto';
  if (c.indexOf('61') === 0 || c.indexOf('62') === 0) return 'Electricidad y electrónica';
  if (c.indexOf('65') === 0) return 'Transporte';
  if (c.indexOf('68') === 0) return 'Mecánica general';
  if (c.indexOf('71') === 0) return 'Animales';
  return 'Otros';
}

/**
 * Manual de Codificación de Bienes completo
 */
function codigosManualEscolar() {
  return [
    ['0101', 'CAJA REGISTRADORA'],
    ['0102', 'CALCULADORA ELECTRICA'],
    ['0103', 'CALCULADORA ELECTRONICA'],
    ['0104', 'PROTECTORA DE CHEQUES'],
    ['0105', 'CONTOMETRO'],
    ['0107', 'ENGRAPADORA GRANDE'],
    ['0108', 'COMPUTADORA PORTATIL'],
    ['0109', 'EQUIPO MULTIFUNCIONAL'],
    ['0110', 'MAQUINA DE ESCRIBIR MECANICA'],
    ['0111', 'MAQUINA DE ESCRIBIR ELECTRICA'],
    ['0112', 'PERFORADORA Y/O ENCUADERNADORA'],
    ['0113', 'TECLADO'],
    ['0114', 'C.P.U.'],
    ['0115', 'MOUSE'],
    ['0116', 'SCANNER'],
    ['0117', 'LAMINADORA'],
    ['0118', 'SWITCH (EQUIPO DE COMPUTO)'],
    ['0119', 'AUDIFONO CON MICROFONO'],
    ['0124', 'UPS'],
    ['0199', 'OTROS EQUIPO DE OFICINA'],
    ['0301', 'ASPIRADORA'],
    ['0302', 'BATIDORA'],
    ['0303', 'CAFETERA'],
    ['0305', 'ESTERILIZADOR ELECTRICO'],
    ['0306', 'EXTRACTOR DE AIRE'],
    ['0309', 'LAMPARA INFRAROJA'],
    ['0310', 'LAMPARA DE RAYOS ULTRAVIOLETA'],
    ['0311', 'LICUADORA'],
    ['0312', 'OLLA DE PRESION'],
    ['0315', 'SECADORA ELECTRICA'],
    ['0316', 'TOSTADORA DE PAN'],
    ['0318', 'VENTILADOR DE MESA'],
    ['0319', 'VENTILADOR DE PEDESTAL'],
    ['0320', 'VENTILADOR DE TECHO/PARED'],
    ['0321', 'REFLECTOR'],
    ['0323', 'PLANCHA ELECTRICA'],
    ['0324', 'BARRA DE LUZ'],
    ['0325', 'LAVADORA'],
    ['0399', 'OTROS APARATOS ELECTRICOS'],
    ['0401', 'BRUJULA'],
    ['0402', 'CINTA METRICA'],
    ['0403', 'ESCALIMETRO'],
    ['0404', 'ESTUCHE DE DIBUJO'],
    ['0405', 'MESA DE DIBUJO'],
    ['0406', 'MIRA'],
    ['0408', 'NIVEL'],
    ['0409', 'PANTOGRAFO'],
    ['0410', 'PLANIMETRO'],
    ['0412', 'REGLA DE CALCULO'],
    ['0413', 'REGLA T'],
    ['0414', 'TEODOLITO'],
    ['0415', 'TRIPODE'],
    ['0417', 'MICROMETRO'],
    ['0418', 'POLIPASTO (POLEA)'],
    ['0420', 'DINAMOMETRO'],
    ['0422', 'BOMBA HIDRAULICA'],
    ['0424', 'CRIBA'],
    ['0434', 'ESPECTOMETRO'],
    ['0435', 'SONOMETRO'],
    ['0438', 'BANCO OPTICO'],
    ['0440', 'APARATO DE VIBRACION'],
    ['0441', 'GIROSCOPIO'],
    ['0443', 'RODILLO METALICO'],
    ['0444', 'PLANO DE FRICCION'],
    ['0445', 'GRAMIL'],
    ['0499', 'OTROS INGENIERIA Y DIBUJO'],
    ['0701', 'CAMARA DE FILMACION'],
    ['0702', 'CAMARA FOTOGRAFICA'],
    ['0703', 'EDITOR DE CINE (PEGADOR DE PELICULAS)'],
    ['0704', 'FOTOMETRO (MEDIDOR DE LUZ)'],
    ['0705', 'GLOBO TERRESTRE'],
    ['0706', 'LAMINA DE PROYECCION'],
    ['0707', 'LAMPARA DE FILMACION'],
    ['0708', 'LECTOR DE MICROFILM'],
    ['0709', 'MAPA'],
    ['0710', 'PANTALLA DE PROYECCION'],
    ['0711', 'PROYECTOR DE CINE'],
    ['0712', 'PROYECTOR DE SLIDES'],
    ['0713', 'PROYECTOR DE VISTA OPACA'],
    ['0714', 'RETROPROYECTOR (LIBRO O PAGINA)'],
    ['0715', 'TANQUE DE REVELADO'],
    ['0716', 'MATERIAL DE ANATOMIA'],
    ['0717', 'ROTAFOLIO'],
    ['0718', 'PROYECTOR DE CAÑON'],
    ['0719', 'CAMARA AUDIOVISUAL'],
    ['0799', 'OTROS EQUIPO AUDIOVISUAL'],
    ['1102', 'ARCHIVADOR'],
    ['1103', 'ARMARIO'],
    ['1104', 'ATRIL'],
    ['1105', 'BANCA BIPERSONAL GRANDE'],
    ['1106', 'BANCA BIPERSONAL MEDIANA'],
    ['1107', 'BANCA BIPERSONAL PEQUEÑA'],
    ['1108', 'BANCA TIPO ESPERA'],
    ['1109', 'BANCO TIPO LABORATORIO'],
    ['1110', 'BOTIQUIN'],
    ['1111', 'BURO TELEFONICO'],
    ['1112', 'CAJA DE SEGURIDAD'],
    ['1113', 'CAMA'],
    ['1114', 'CAMAROTE'],
    ['1115', 'SOFA'],
    ['1116', 'CANAPE'],
    ['1117', 'SILLON DE SALA'],
    ['1118', 'CONSOLA'],
    ['1119', 'ALACENA O PANTRY'],
    ['1120', 'CUNA'],
    ['1121', 'MESA TRAPEZOIDAL'],
    ['1122', 'ESCRITORIO L'],
    ['1123', 'MUEBLE PARA TELEVISOR'],
    ['1124', 'ESCRITORIO EJECUTIVO'],
    ['1125', 'ESCRITORIO SECRETARIAL'],
    ['1126', 'ESCRITORIO CATEDRA'],
    ['1127', 'ESTANTE CASILLERO'],
    ['1129', 'ESTANTE'],
    ['1130', 'GAVETERO'],
    ['1131', 'MUEBLE PARA COMPUTADORA'],
    ['1133', 'LIBRERA'],
    ['1134', 'MESA BIPERSONAL GRANDE'],
    ['1135', 'MESA BIPERSONAL MEDIANA'],
    ['1136', 'MESA BIPERSONAL PEQUEÑA'],
    ['1137', 'MESA DE LABORATORIO'],
    ['1138', 'MESA'],
    ['1139', 'MESA MECANOGRAFICA'],
    ['1140', 'MESA CATEDRA'],
    ['1141', 'MESA UNIPERSONAL GRANDE'],
    ['1142', 'MESA UNIPERSONAL MEDIANA'],
    ['1143', 'MESA UNIPERSONAL PEQUEÑA'],
    ['1144', 'PAPELERA DE ESCRITORIO'],
    ['1145', 'PERCHERA'],
    ['1146', 'PIZARRA'],
    ['1147', 'PUPITRE BIPERSONAL GRANDE'],
    ['1148', 'PUPITRE BIPERSONAL MEDIANO'],
    ['1149', 'PUPITRE BIPERSONAL PEQUEÑO'],
    ['1153', 'PUPITRE UNIPERSONAL GRANDE'],
    ['1154', 'PUPITRE UNIPERSONAL MEDIANO'],
    ['1155', 'PUPITRE UNIPERSONAL PEQUEÑO'],
    ['1156', 'PUPITRE PLURIPERSONAL'],
    ['1157', 'SILLA BUTACA'],
    ['1158', 'SILLA CATEDRA'],
    ['1160', 'SILLA GIRATORIA'],
    ['1162', 'SILLA PLEGADIZA'],
    ['1163', 'SILLA DE ESPERA'],
    ['1164', 'SILLON EJECUTIVO'],
    ['1165', 'SILLA UNIPERSONAL GRANDE'],
    ['1166', 'SILLA UNIPERSONAL MEDIANA'],
    ['1167', 'SILLA UNIPERSONAL PEQUEÑA'],
    ['1169', 'TARJETERO'],
    ['1170', 'MOSTRADOR'],
    ['1171', 'TOCADOR'],
    ['1173', 'VITRINA'],
    ['1176', 'CLOSET'],
    ['1177', 'BANCO DE TALLER'],
    ['1178', 'ESCALERA'],
    ['1199', 'OTROS MOBILIARIO'],
    ['1201', 'ACORDEON'],
    ['1202', 'ARMONIO'],
    ['1203', 'ARPA'],
    ['1204', 'BATERIA'],
    ['1205', 'BOMBO'],
    ['1206', 'BONGOS'],
    ['1207', 'BUGLE'],
    ['1208', 'CAMPANOLOGO'],
    ['1209', 'CLARINETE'],
    ['1210', 'CLAVES'],
    ['1211', 'COLOMBINA'],
    ['1212', 'CONCERTINA'],
    ['1213', 'CONTRABAJO'],
    ['1214', 'CONTRAFAGOTE'],
    ['1215', 'CORNETA'],
    ['1216', 'CORNO'],
    ['1217', 'FAGOTE'],
    ['1218', 'FLAUTA'],
    ['1219', 'FLAUTIN'],
    ['1220', 'GONG'],
    ['1221', 'GUITARRA'],
    ['1222', 'LIRA'],
    ['1223', 'MANDOLINA'],
    ['1224', 'MELODICA'],
    ['1225', 'OBOE'],
    ['1226', 'PANDERETA'],
    ['1227', 'PIANO'],
    ['1228', 'PICOLA'],
    ['1229', 'PLATILLOS'],
    ['1230', 'REDOBLANTE'],
    ['1231', 'SAXO'],
    ['1232', 'TIMBAL'],
    ['1233', 'TRIANGULO'],
    ['1234', 'TROMBON'],
    ['1235', 'TROMPETA'],
    ['1236', 'TAMBORCITO'],
    ['1237', 'TUBA'],
    ['1238', 'VIOLA'],
    ['1239', 'VIOLIN'],
    ['1240', 'VIOLONCELLO'],
    ['1241', 'XILOFONO'],
    ['1242', 'ORGANO'],
    ['1243', 'MARIMBA'],
    ['1299', 'OTROS INSTRUMENTOS MUSICALES'],
    ['1301', 'ARMAS DE FUEGO'],
    ['1302', 'COLUMPIO'],
    ['1303', 'EQUIPO GIMNASTICO'],
    ['1304', 'PESAS'],
    ['1306', 'MESA DE PING-PONG'],
    ['1307', 'EQUIPO DE TENNIS'],
    ['1308', 'TROFEOS'],
    ['1316', 'RUEDA DE AVIONCITOS'],
    ['1317', 'RUEDA DE CABALLITOS'],
    ['1318', 'RUEDA DE CARRITOS LOCOS'],
    ['1319', 'RUEDA DE LANCHITAS'],
    ['1320', 'MESA DE FUTBOLITO'],
    ['1321', 'TRENCITO'],
    ['1322', 'LANCHA'],
    ['1399', 'OTROS ARTICULOS DEPORTIVOS'],
    ['1401', 'BUSTO'],
    ['1402', 'ESCULTURA'],
    ['1403', 'OBJETO ARQUEOLOGICO'],
    ['1404', 'PINTURA (TEMPERA U OLEO)'],
    ['1499', 'OTROS OBJETOS DE MUSEO'],
    ['1501', 'ASTA'],
    ['1502', 'BANDERA'],
    ['1503', 'ESCUDO'],
    ['1504', 'CARRETILLA DE REPARTO'],
    ['1505', 'CAMPANA'],
    ['1506', 'COCINA'],
    ['1507', 'CORTADORA DE GRAMA'],
    ['1508', 'CORTINA'],
    ['1509', 'EXTINGUIDOR DE FUEGO'],
    ['1510', 'TIMBRE'],
    ['1511', 'ESPEJO'],
    ['1512', 'LAMPARA'],
    ['1513', 'HORNO'],
    ['1514', 'PULIDORA'],
    ['1599', 'OTROS ARTICULOS VARIOS'],
    ['2101', 'CAMA HOSPITALARIA'],
    ['2102', 'ESTETOSCOPIO'],
    ['2103', 'UNIDAD DENTAL'],
    ['2104', 'RESUCITADOR DE EMERGENCIA'],
    ['2105', 'SILLA ORTOPEDICA'],
    ['2106', 'OTOSCOPIO'],
    ['2107', 'TENSIOMETRO'],
    ['2199', 'OTROS EQUIPO MEDICO'],
    ['3101', 'ALTIMETRO'],
    ['3102', 'ANEMOGRAFO'],
    ['3103', 'BALANZA'],
    ['3104', 'BAROMETRO'],
    ['3105', 'BASCULA'],
    ['3106', 'CRONOMETRO'],
    ['3107', 'RELOJ MARCADOR'],
    ['3109', 'RELOJ'],
    ['3111', 'TACOMETRO'],
    ['3113', 'JUEGO DE PESAS'],
    ['3114', 'BALANCIN'],
    ['3199', 'OTROS EQUIPO DE MEDICION'],
    ['3201', 'EQUIPO DE LABORATORIO DE BIOLOGIA'],
    ['3202', 'EQUIPO DE LABORATORIO DE FISICA'],
    ['3203', 'EQUIPO DE LABORATORIO DE QUIMICA'],
    ['3204', 'MICROSCOPIO'],
    ['3299', 'OTROS EQUIPO DE LABORATORIO'],
    ['3301', 'MAQUINA DE COSER'],
    ['3302', 'MAQUINA DE COSER INDUSTRIAL'],
    ['3399', 'OTROS ARTE Y OFICIO'],
    ['4101', 'ABONADORA'],
    ['4102', 'ARADO'],
    ['4103', 'CENTRIFUGA PARA PRUEBA DE GRASA'],
    ['4104', 'CLASIFICADORA DE HUEVOS'],
    ['4105', 'CRIADORA'],
    ['4106', 'COMEDERO'],
    ['4107', 'CULTIVADORA MECANICA MANUAL'],
    ['4108', 'CHAPODADORA'],
    ['4109', 'CHASIS PARA TRAILER'],
    ['4110', 'DESCREMADORA'],
    ['4111', 'DESGRANADORA'],
    ['4112', 'DESPICADORA ELECTRICA'],
    ['4113', 'ENFRIADORA DE LECHE'],
    ['4114', 'EQUIPO DE ASPERJAR'],
    ['4115', 'EQUIPO DE ESPOLVOREAR'],
    ['4116', 'ESPARCIDORA MECANICA'],
    ['4117', 'ESTAMPADORA DE CERA'],
    ['4118', 'EXTRACTORA DE CERA'],
    ['4119', 'EXTRACTORA DE MIEL'],
    ['4120', 'GRANERO'],
    ['4122', 'INCUBADORA'],
    ['4125', 'MANTEQUILLERA'],
    ['4126', 'MESCLADORA DE ALIMENTOS'],
    ['4127', 'MOLINO DE MARTILLO'],
    ['4128', 'MOLINO PARA HACER QUESO'],
    ['4129', 'ORDENADORA'],
    ['4130', 'PASTEURIZADORA'],
    ['4131', 'PRENSA PARA QUESO'],
    ['4132', 'PICADORA DE ZACATE'],
    ['4133', 'RASTRA'],
    ['4134', 'SEMBRADORA'],
    ['4135', 'SILO'],
    ['4136', 'SUBSUELADOR'],
    ['4137', 'TANQUE PARA HACER QUESO'],
    ['4138', 'TRACTOR'],
    ['4139', 'TRILLADORA'],
    ['4199', 'OTROS EQUIPO AGRICOLA'],
    ['4401', 'AMPLIADORA'],
    ['4402', 'CALIBRADOR'],
    ['4403', 'CAMARA PARA NEGATIVO OFFSET'],
    ['4404', 'COSEDORA'],
    ['4405', 'COMPAGINADORA'],
    ['4406', 'CORTADORA'],
    ['4407', 'CHIBALETE'],
    ['4408', 'CRISOL DE FUNDICION'],
    ['4409', 'DOBLADORA'],
    ['4411', 'ESTAMPADORA (DORADOR)'],
    ['4412', 'FOTOCOPIADORA'],
    ['4413', 'FUNDIDORA'],
    ['4415', 'GAVINETE'],
    ['4416', 'GRABADORA DE CINTA'],
    ['4417', 'GUILLOTINA'],
    ['4419', 'LAMPARA DE LUZ DE PUNTO'],
    ['4420', 'LEVANTADORA DE PLIEGOS'],
    ['4421', 'LINOTIPO'],
    ['4422', 'MAQUINA DE ROTULAR DIRECCIONES'],
    ['4423', 'MAQUINA DE TIPOGRAFIA'],
    ['4424', 'MESA DE IMPOSICION'],
    ['4425', 'MESA DE RETOQUE'],
    ['4426', 'MIMEOGRAFO'],
    ['4427', 'MULTILIT'],
    ['4428', 'NUMERADOR'],
    ['4429', 'PORTAGALERA'],
    ['4430', 'PORTAMAGAZINES'],
    ['4431', 'PRENSA AL VACIO PARA OFFSET'],
    ['4432', 'PRENSA DE ENCUADERNACION'],
    ['4433', 'QUEMADOR'],
    ['4435', 'RAUQUEADORA'],
    ['4436', 'SACAPRUEBA'],
    ['4437', 'SIERRA PARA CORTAR LINGOTES'],
    ['4438', 'TANQUE REVELADOR DE PLACAS OFFSET'],
    ['4439', 'TROQUELADORA'],
    ['4440', 'LIBRADORES'],
    ['4441', 'CIZALLA'],
    ['4442', 'IMPRESOR'],
    ['4499', 'OTROS REPRODUCCION E IMPRENTA'],
    ['5301', 'CONMUTADOR'],
    ['5302', 'EQUIPO DE RADIO TELEFONO'],
    ['5303', 'INTERCOMUNICADOR'],
    ['5304', 'PLANTA TELEFONICA'],
    ['5305', 'TELEFONO'],
    ['5306', 'VIPER'],
    ['5308', 'FAX'],
    ['5399', 'OTROS EQUIPO TELEFONICO'],
    ['5401', 'AMPLIFICADOR'],
    ['5402', 'ANTENA'],
    ['5403', 'BAFLE'],
    ['5404', 'BOCINA'],
    ['5405', 'GRABADORA'],
    ['5406', 'LOCUTORIO'],
    ['5407', 'MEGAFONO'],
    ['5408', 'MICROFONO'],
    ['5409', 'PEDESTAL'],
    ['5410', 'MINICOMPONENTE'],
    ['5411', 'RADIO'],
    ['5412', 'TELEVISOR'],
    ['5413', 'TOCACINTA'],
    ['5414', 'TOCADISCO'],
    ['5415', 'CAMARA DE VIDEO'],
    ['5416', 'RADIO GRABADORA'],
    ['5417', 'MONITOR'],
    ['5418', 'VIDEO GRABADORA'],
    ['5419', 'ECUALIZADOR'],
    ['5420', 'EQUIPO DE SONIDO'],
    ['5499', 'OTROS EQUIPO DE SONIDO'],
    ['5501', 'ACUMULADOR'],
    ['5502', 'CALDERA'],
    ['5503', 'GENERADOR DE ENERGIA'],
    ['5504', 'MOTOR DE COMBUSTION'],
    ['5505', 'MOTOR ELECTRICO'],
    ['5506', 'TRANSFORMADOR'],
    ['5599', 'OTROS EQUIPO DE ENERGIA'],
    ['5601', 'AIRE ACONDICIONADO'],
    ['5602', 'CONSERVADOR'],
    ['5603', 'CUARTO FRIO'],
    ['5604', 'FRIGORIFICO'],
    ['5605', 'REFRIGERADORA'],
    ['5699', 'OTROS EQUIPO REFRIGERANTE'],
    ['5701', 'BOMBA PROVEEDORA DE AGUA'],
    ['5703', 'FILTROS'],
    ['5799', 'OTROS EQUIPO DE ACUEDUCTO'],
    ['6101', 'AMPERIMETRO'],
    ['6102', 'ARKANCADOR'],
    ['6103', 'BOBINADORA'],
    ['6104', 'CAJA DE RESISTENCIA'],
    ['6105', 'CAPACIMETRO'],
    ['6106', 'CONDENSADOR VARIABLE'],
    ['6107', 'CONTADOR DE CICLOS'],
    ['6108', 'CONTADOR DIGITAL'],
    ['6109', 'CONVERTIDOR'],
    ['6110', 'COSIMETRO'],
    ['6111', 'DINAMETRO'],
    ['6112', 'ELEVADOR DE VOLTAJE'],
    ['6113', 'EMBOBINADOR'],
    ['6114', 'EQUIPO DE OPTEN'],
    ['6115', 'FACIMETRO'],
    ['6116', 'FLUXOMETRO'],
    ['6117', 'FRECUENSIMETRO'],
    ['6118', 'REGULADOR DE VOLTAJE'],
    ['6119', 'GALVANOMETRO'],
    ['6120', 'GAUSIOMETRO'],
    ['6121', 'GENERADOR'],
    ['6126', 'GENOMETRO'],
    ['6128', 'INDUCTANCIA PATRON'],
    ['6129', 'LUXOMETRO'],
    ['6130', 'MEDIDOR'],
    ['6133', 'MEGAMETRO'],
    ['6134', 'MOTOGENERADOR'],
    ['6135', 'OSCILOSCOPIO'],
    ['6136', 'POTENCIOMETRO'],
    ['6137', 'PREAMPLIFICADOR'],
    ['6138', 'PROBADOR'],
    ['6142', 'PUENTE'],
    ['6143', 'RASTREADOR'],
    ['6144', 'REANTANCIA VARIABLE'],
    ['6145', 'REGULADOR DE CAMPO'],
    ['6148', 'SET EXPERIMENTAL'],
    ['6153', 'SINCIRONOSCOPIO'],
    ['6156', 'TABLERO DIDACTICO'],
    ['6157', 'TESTER'],
    ['6158', 'TRANSFORMADOR'],
    ['6161', 'TRAZADOR DE CURVA'],
    ['6162', 'VATIHORIMETRO'],
    ['6163', 'VOLT-AMPERIMETRO'],
    ['6164', 'WATIMETRO'],
    ['6165', 'CAJA DECADA'],
    ['6166', 'AUTO TRANSFORMADOR VARIABLE'],
    ['6167', 'POLIMETRO VTV.N'],
    ['6168', 'SWITCH ELECTRONICO Y CORRIENTE'],
    ['6169', 'ANALIZADOR DE CIRCUITO'],
    ['6170', 'TRANSEPTOR'],
    ['6172', 'RECEPTOR DIDACTICO DE RADIO'],
    ['6173', 'TRANSMISOR DIDACTICO DE RADIO'],
    ['6174', 'DEMOSTRADOR VARIABLE MAGNETICO'],
    ['6176', 'INDUCTANCIA VARIABLE'],
    ['6178', 'ENTRENADOR ELECTRONICO'],
    ['6179', 'EPIDOSCOPIO'],
    ['6180', 'PRUEBA DE LINEA DE TRANSMISION'],
    ['6181', 'BANCO BASICO DE PRUEBA'],
    ['6182', 'VOLTIMETRO'],
    ['6184', 'TERMOMETRO DE ESCALA F'],
    ['6185', 'WATIHORIMETRO (KWH)'],
    ['6188', 'SINCROSCOPIO'],
    ['6191', 'OMETRO'],
    ['6192', 'RECTIFICADOR DE SILICON Y SELENIO'],
    ['6193', 'TRANSMISOR ESTROBOSCOPIO'],
    ['6194', 'RELAY FOTOCELDA MECANICO'],
    ['6195', 'CONTROL DE SECUENCIA ELECTRONICO'],
    ['6196', 'FRENO ELECTROMAGNETICO'],
    ['6197', 'STROBOSCOPIO'],
    ['6199', 'OTROS ELECTRICIDAD Y ELECTRONICA'],
    ['6201', 'BASE PORTA TUBO'],
    ['6202', 'PHOTO TRANSISTOR'],
    ['6203', 'PEINE CAMBIADOR DE CIRCUITO'],
    ['6204', 'DOBLADOR DE TENSION'],
    ['6205', 'OSCIALADOR DE A.F. Y R.F.'],
    ['6206', 'MICRODECK (TABLERO DE CONEXION)'],
    ['6207', 'CONTRACTOR'],
    ['6299', 'OTROS DIODO Y RECTIFICADOR'],
    ['6501', 'AUTOBUS'],
    ['6502', 'AUTOMOVIL'],
    ['6503', 'BICICLETA'],
    ['6504', 'CAMION'],
    ['6505', 'CAMIONETILLA'],
    ['6506', 'CARRETA O TRAILER'],
    ['6507', 'CARRETILLA DE MANO'],
    ['6508', 'FURGONETA'],
    ['6509', 'JEEP'],
    ['6510', 'MICROBUS'],
    ['6511', 'MOTOCICLETA'],
    ['6512', 'MOTONETA'],
    ['6513', 'PANEL'],
    ['6514', 'PICK-UP'],
    ['6515', 'TRICICLO'],
    ['6599', 'OTROS EQUIPO DE TRANSPORTE'],
    ['6802', 'AFILADOR DE HERRAMIENTAS'],
    ['6803', 'AJUSTADOR DE COLA'],
    ['6804', 'ALINEADOR DE DIRECCION'],
    ['6805', 'ALINEADOR DE VIELA'],
    ['6806', 'ASENTADOR DE MOTOR'],
    ['6808', 'ASERRADOR PARA METAL'],
    ['6809', 'BALANCEADOR DE LLANTA'],
    ['6810', 'CAJA DE COLA'],
    ['6811', 'CANTEADOR'],
    ['6812', 'CARGADOR DE BATERIA'],
    ['6813', 'CEPILLADOR'],
    ['6816', 'COMPRESOR DE AIRE'],
    ['6817', 'COMPROBADOR'],
    ['6823', 'DOBLADORA'],
    ['6826', 'ELEVADOR'],
    ['6827', 'ENGRASADORA'],
    ['6828', 'ENRRINADOR O DESENRRINADOR'],
    ['6829', 'EQUIPO DE AUTO ANALIZADOR MECANICO'],
    ['6830', 'ESCOPLADOR'],
    ['6831', 'ESMERILADOR'],
    ['6832', 'ESPICHERA'],
    ['6833', 'FRESADOR UNIVERSAL'],
    ['6837', 'GRUA'],
    ['6842', 'LIJADOR'],
    ['6844', 'LIMPIADOR DE BUJIA'],
    ['6845', 'MARMOL DE AJUSTE'],
    ['6846', 'MARMOL DE TRAZAJADO'],
    ['6847', 'PERFORADOR DE CILINDRO'],
    ['6848', 'PRENSA'],
    ['6862', 'RECTIFICADOR'],
    ['6863', 'REMACHADOR DE FRICCION'],
    ['6867', 'SARGENTO (PARA PRENSAR)'],
    ['6868', 'SIERRA'],
    ['6872', 'SOLDADOR'],
    ['6877', 'TECLE'],
    ['6878', 'TORNO'],
    ['6880', 'TOPE DE SEGURIDAD'],
    ['6884', 'TROMPO (PARA MOLDURA DE MADERA)'],
    ['6885', 'VACUOMETRO'],
    ['6886', 'VEHICULO SECCIONADO'],
    ['6887', 'YUNQUE'],
    ['6888', 'MARCO PARA SIERRA'],
    ['6889', 'TALADRO'],
    ['6890', 'SOPLADOR ELECTRICO'],
    ['6891', 'TARRAJA'],
    ['6892', 'CORTATUBO'],
    ['6893', 'LLAVE STILLSON'],
    ['6899', 'OTROS MECANICA GENERAL'],
    ['7101', 'VERTEBRADOS'],
    ['7102', 'INVERTEBRADOS']
  ];
}

function obtenerBienesCatalogo() {
  var out = [];
  try {
    var ss = getDB();
    var h = ss.getSheetByName('Categorias') || ss.getSheetByName('Categorías') || ss.getSheetByName('Categoria');
    if (h && h.getLastRow() >= 2) {
      var data = h.getRange(2, 1, h.getLastRow(), 3).getValues();
      for (var i = 0; i < data.length; i++) {
        var cod = String(data[i][0] || '').trim();
        var nom = String(data[i][1] || '').trim();
        var grp = String(data[i][2] || '').trim();
        if (!cod && !nom) continue;
        if (cod && !/^\d/.test(cod) && !nom) { nom = cod; cod = ''; }
        if (!grp) grp = grupoPorCodigo(cod);
        if (cod || nom) out.push({ codigo: cod, nombre: nom || cod, grupo: grp });
      }
    }
  } catch (e) {}
  if (!out.length) {
    var emb = codigosManualEscolar();
    for (var e2 = 0; e2 < emb.length; e2++) {
      out.push({ codigo: emb[e2][0], nombre: emb[e2][1], grupo: grupoPorCodigo(emb[e2][0]) });
    }
  }
  return out;
}

function sembrarCategoriasManual() {
  if (!desdeEditor_()) return { exito: false, mensaje: MENSAJE_SOLO_EDITOR };
  var ss = getDB();
  var hoja = ss.getSheetByName('Categorias') || ss.getSheetByName('Categorías') || ss.getSheetByName('Categoria');
  if (!hoja) hoja = ss.insertSheet('Categorias');
  hoja.clear();
  hoja.getRange(1, 1, 1, 3).setValues([['Codigo', 'Nombre', 'Grupo']]);
  var lista = codigosManualEscolar();
  var filas = [];
  for (var i = 0; i < lista.length; i++) {
    var cod = lista[i][0];
    var nom = lista[i][1];
    filas.push([cod, nom, grupoPorCodigo(cod)]);
  }
  if (filas.length) hoja.getRange(2, 1, filas.length, 3).setValues(filas);
  return { ok: true, filas: filas.length };
}

function obtenerListas() {
  try {
    var cache = CacheService.getScriptCache();
    var guardado = cache.get('sicam_listas_v6');
    if (guardado) return JSON.parse(guardado);
  } catch (eC) {}
  var res = leerListas_();
  try {
    var json = JSON.stringify(res);
    if (json.length < 95000 && res.bienes && res.bienes.length) CacheService.getScriptCache().put('sicam_listas_v6', json, 600);
  } catch (eP) {}
  return res;
}

function leerListas_() {
  try {
    var ss = getDB();
    function vals(nombres, col) {
      var h = null;
      for (var i = 0; i < nombres.length; i++) {
        h = ss.getSheetByName(nombres[i]);
        if (h) break;
      }
      if (!h) return [];
      var last = h.getLastRow();
      if (last < 2) return [];
      var data = h.getRange(col + '2:' + col + last).getValues();
      var out = [];
      for (var j = 0; j < data.length; j++) {
        if (data[j][0] !== '' && data[j][0] !== null) out.push(data[j][0]);
      }
      return out;
    }

    var bienes = obtenerBienesCatalogo();
    var gruposMap = {};
    var grupos = [];
    for (var g = 0; g < bienes.length; g++) {
      var gr = bienes[g].grupo || 'Otros';
      if (!gruposMap[gr]) { gruposMap[gr] = true; grupos.push(gr); }
    }
    grupos.sort(function (a, b) { return String(a).localeCompare(String(b), 'es'); });

    var estados = vals(['Estado', 'Estados'], 'A');
    // Se agregan los estados del ciclo de vida que falten en la hoja Estado
    ESTADOS_CICLO.forEach(function (x) {
      if (!estados.some(function (y) { return sinTildes_(y) === sinTildes_(x); })) estados.push(x);
    });
    return {
      aulas: (function () {
        var nombres = [], vistos = {};
        estructuraEscuela().map(function (x) { return x.nombre; }).concat(vals(['Aulas', 'Aula'], 'B')).forEach(function (n) {
          var k = claveAula_(n);
          if (n !== '' && !vistos[k] && aulaExiste_(n)) { vistos[k] = true; nombres.push(String(n)); }
        });
        return nombres;
      })(),
      personal: vals(['Personal', 'Profesores'], 'B'),
      categorias: grupos,
      bienes: bienes,
      estados: estados.length ? estados : ['Bueno', 'Regular', 'Dañado', 'En Mantenimiento']
    };
  } catch (err) {
    var bienesFb = [];
    try { bienesFb = obtenerBienesCatalogo(); } catch (e2) {}
    var gruposFb = [];
    var mapFb = {};
    for (var i = 0; i < bienesFb.length; i++) {
      var gg = bienesFb[i].grupo || 'Otros';
      if (!mapFb[gg]) { mapFb[gg] = true; gruposFb.push(gg); }
    }
    return {
      aulas: [], personal: [], categorias: gruposFb, bienes: bienesFb,
      estados: ['Bueno', 'Regular', 'Dañado', 'En Mantenimiento']
    };
  }
}

function guardarActivoMaster(datos) {
  var permiso = exigirRol_(datos && datos.token, [ROL_ADMIN]);
  if (permiso.error) return permiso.error;
  datos.usuario = permiso.ses.nombre;
  // El candado evita que dos registros simultáneos reciban el mismo ID
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (eLock) { return { exito: false, mensaje: 'El sistema está ocupado, intenta de nuevo.' }; }
  try {
    var ss = getDB();
    var hoja = getHojaCatalogo(ss);
    if (!hoja) return { exito: false, mensaje: 'No existe la hoja Catalogo' };

    // Validación en el servidor (además de la del formulario)
    var error = validarActivo_(datos);
    if (error) return { exito: false, mensaje: error };

    var codigoBien = String(datos.codigo_bien || '').replace(/\D/g, '');
    if (!codigoBien) codigoBien = extraerCodigoBien(datos.categoria);
    if (!codigoBien) codigoBien = extraerCodigoBien(datos.nombre);
    if (!codigoBien) codigoBien = '1199';
    var idUnico = generarIdActivo(codigoBien);
    var urlFoto = 'Sin foto';

    var listaFotos = [];
    if (datos.fotos_base64 && datos.fotos_base64.length) listaFotos = datos.fotos_base64;
    else if (datos.foto_base64) listaFotos = [datos.foto_base64];
    var urls = [];
    for (var f = 0; f < listaFotos.length && f < MAX_FOTOS; f++) {
      var u = guardarFotoDrive_(listaFotos[f], idUnico + '_' + (f + 1) + '.jpg');
      if (u) urls.push(u);
    }
    if (urls.length) urlFoto = urls.join(' | ');

    hoja.appendRow([
      idUnico,
      limpiarTexto_(datos.nombre, 120),
      limpiarTexto_(datos.categoria, 120),
      limpiarTexto_(datos.marca, 80),
      limpiarTexto_(datos.ubicacion, 80),
      limpiarTexto_(datos.asignado || 'Sin asignar', 120),
      (datos.costo != null && datos.costo !== '') ? Number(datos.costo) : 0,
      limpiarTexto_(datos.estado || 'Bueno', 40),
      limpiarTexto_(datos.observaciones, 1000),
      urlFoto,
      JSON.stringify(datos.vector_ia || [])
    ]);
    try { getHojaMantenimiento_(ss).appendRow([idUnico, new Date(), '', '']); } catch (eM) {}
    SpreadsheetApp.flush();
    invalidarCache_();

    return { exito: true, mensaje: 'Activo registrado: ' + idUnico, id: idUnico };
  } catch (error) {
    return { exito: false, mensaje: 'Error al guardar: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}
