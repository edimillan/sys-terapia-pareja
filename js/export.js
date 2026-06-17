/**
 * export.js - Generador de Informes Clínicos en PDF Oficiales de 2 Páginas
 * Reproduce fielmente el diseño, colores y distribución del archivo ficha_terapia_pareja_saludmental360.pdf.
 */

/**
 * Genera y descarga el informe clínico de la sesión en un PDF estructurado de exactamente 2 páginas.
 * @param {object} s - Objeto sesión con la información clínica completa.
 */
function exportPDF(s) {
  if (typeof window.jspdf === 'undefined') {
    alert('La librería PDF aún se está cargando. Intenta de nuevo en unos segundos.');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const margin = 15; // Margen izquierdo y derecho de 15mm
  const contentW = pageW - margin * 2; // Ancho útil de 180mm

  // Paleta de colores institucional
  const cSage = [122, 158, 126];       // Verde salvia de fondo
  const cSageDark = [74, 107, 78];     // Verde salvia oscuro de texto/títulos
  const cSageLight = [232, 240, 233];   // Fondo grisáceo verde claro
  const cOrange = [232, 131, 74];      // Naranja terracota de preguntas
  const cOrangeLight = [253, 240, 232]; // Fondo de preguntas
  const cCream = [247, 249, 247];      // Fondo crema claro para campos vacíos
  const cBorder = [208, 226, 209];     // Borde suave verde claro
  const cText = [44, 62, 45];          // Texto oscuro principal
  const cTextMuted = [110, 130, 112];   // Texto grisáceo para etiquetas

  // -------------------------------------------------------------------------
  // PAGINA 1: DATOS, MOTIVO, ÁREAS, COMPROMISO Y PREGUNTAS CLAVE
  // -------------------------------------------------------------------------
  
  // 1. ENCABEZADO INSTITUCIONAL
  doc.setFillColor(...cSage);
  doc.roundedRect(15, 10, contentW, 26, 4, 4, 'F');
  
  // Círculo logo blanco
  doc.setFillColor(255, 255, 255);
  doc.circle(28, 23, 9, 'F');
  // Símbolo del logo (corazones cruzados)
  doc.setFillColor(74, 158, 154); // Teal
  doc.ellipse(26, 21.5, 3.5, 4.8, 'F');
  doc.setFillColor(...cOrange);    // Orange
  doc.ellipse(30, 21.5, 3.5, 4.8, 'F');
  doc.setFillColor(255, 255, 255);
  doc.ellipse(28, 24, 2, 2.8, 'F');

  // Textos del Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Ficha de terapia de pareja', 41, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Registro clínico · Gestión de sesión', 41, 23.5);
  doc.setFontSize(7.5);
  doc.text('Salud Mental 360  ·  TeAcompaño Centro Psicológico  ·  Alianza por tu bienestar integral', 41, 29.5);

  // 2. SECCIÓN: DATOS DE LA PAREJA
  doc.setFillColor(241, 246, 242);
  doc.roundedRect(15, 41, contentW, 7, 2, 2, 'F');
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Datos de la pareja', 18, 46);

  // Fila 1 de Datos: Nombre P1 y Nombre P2
  drawInputBox(15, 51, 88, 10, 'NOMBRE — PERSONA 1', s.n1);
  drawInputBox(107, 51, 88, 10, 'NOMBRE — PERSONA 2', s.n2);

  // Fila 2 de Datos: Edad P1, Edad P2, Tiempo de relación, N° Sesión
  drawInputBox(15, 63, 21, 10, 'EDAD P1', s.a1);
  drawInputBox(38, 63, 21, 10, 'EDAD P2', s.a2);
  drawInputBox(61, 63, 66, 10, 'TIEMPO DE RELACIÓN', s.rel);
  drawInputBox(130, 63, 65, 10, 'N° DE SESIÓN', s.ns);

  // Fila 3 de Datos: Estado Civil, Hijos, Fecha
  drawInputBox(15, 75, 60, 10, 'ESTADO CIVIL', s.est);
  drawInputBox(77, 75, 58, 10, '¿TIENEN HIJOS?', s.hij);
  drawInputBox(137, 75, 58, 10, 'FECHA', s.fec);

  // Fila 4 de Datos: Terapeuta Responsable, Hora de sesión
  drawInputBox(15, 87, 118, 10, 'TERAPEUTA RESPONSABLE', s.ter);
  drawInputBox(135, 87, 60, 10, 'HORA DE SESIÓN', s.hi || '—');

  // 3. SECCIÓN: MOTIVO DE CONSULTA
  doc.setFillColor(241, 246, 242);
  doc.roundedRect(15, 102, contentW, 7, 2, 2, 'F');
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Motivo de consulta', 18, 107);

  // Cajas side-by-side de motivos (con altura de 18mm para acomodar texto largo)
  drawMotivoBox(15, 112, 88, 18, `Motivo — \${s.n1 || 'Persona 1'}`, s.m1);
  drawMotivoBox(107, 112, 88, 18, `Motivo — \${s.n2 || 'Persona 2'}`, s.m2);

  // Áreas de conflicto (Checkbox grid de 3 filas x 4 columnas)
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Áreas de conflicto identificadas (marcar con una X)', 15, 136);

  const areasList = [
    'Comunicación', 'Infidelidad', 'Sexualidad', 'Crianza',
    'Economía', 'Distancia emocional', 'Violencia verbal', 'Roles en el hogar',
    'Familia de origen', 'Celos', 'Duelo / pérdidas', 'Otro'
  ];

  let ax = 15;
  let ay = 140;
  const colW = 45;
  const rowH = 7;
  
  areasList.forEach((area, index) => {
    const active = s.areas && s.areas.includes(area);
    const col = index % 4;
    const row = Math.floor(index / 4);
    const currX = ax + col * colW;
    const currY = ay + row * rowH;
    
    // Dibujar cápsula
    doc.setFillColor(active ? 232 : 255, active ? 240 : 255, active ? 233 : 255);
    doc.setDrawColor(...cBorder);
    doc.roundedRect(currX, currY, 41, 5, 2.5, 2.5, 'FD');
    
    // Dibujar marca de X o vacío
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(active ? 74 : 150, active ? 107 : 150, active ? 78 : 150);
    doc.setFontSize(8.5);
    doc.text(active ? 'X' : ' ', currX + 3.5, currY + 3.6);
    
    // Nombre de área
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...cText);
    doc.setFontSize(7.5);
    doc.text(area, currX + 8, currY + 3.4);
  });

  // Fila adicional de Motivo: Duración y Terapia previa
  drawInputBox(15, 163, 88, 10, 'DURACIÓN DEL CONFLICTO PRINCIPAL', s.dur);
  drawInputBox(107, 163, 88, 10, 'TERAPIA PREVIA', s.prev);

  // Escala de compromiso 1-10 en caja horizontal
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Nivel de compromiso con la relación (1-10)', 15, 180);

  const activeScale = parseInt(s.sc1) || 0;
  const boxSpacing = 18;
  const boxW = 16;
  const boxH = 8;
  const scaleY = 184;

  for (let i = 0; i < 10; i++) {
    const val = i + 1;
    const isSelected = val === activeScale;
    const boxX = 15 + i * boxSpacing;

    doc.setFillColor(isSelected ? 122 : 255, isSelected ? 158 : 255, isSelected ? 126 : 255);
    doc.setDrawColor(...cBorder);
    doc.roundedRect(boxX, scaleY, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setTextColor(isSelected ? 255 : 110, isSelected ? 255 : 130, isSelected ? 255 : 112);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(val), boxX + 6.5, scaleY + 5.5);
  }
  
  // Etiquetas de la escala
  doc.setTextColor(...cTextMuted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Sin compromiso', 15, 195);
  doc.text('Muy comprometidos', 195, 195, { align: 'right' });

  // 4. SECCIÓN: PREGUNTAS CLAVE DE LA SESIÓN
  doc.setFillColor(241, 246, 242);
  doc.roundedRect(15, 199, contentW, 7, 2, 2, 'F');
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Preguntas clave de la sesión', 18, 204);

  // Columnas asimétricas de Preguntas (cabecera naranja y fondo crema naranja)
  // Columna 1 (Izquierda): P1, P2 y P3
  drawQuestionBox(15, 210, 88, 19, 'P1 ¿Qué esperan lograr con esta terapia?', s.q1);
  drawQuestionBox(15, 232, 88, 19, 'P2 ¿Cuándo fue el último momento en que se sintieron bien?', s.q2);
  drawQuestionBox(15, 254, 88, 22, 'P3 ¿Cómo manejan los conflictos? ¿Quién cede, quién se aleja?', s.q3);

  // Columna 2 (Derecha): P4 y P5
  drawQuestionBox(107, 210, 88, 31, 'P4 ¿Hay algo que sientes que el/la otro/a no comprende de ti?', s.q4);
  drawQuestionBox(107, 245, 88, 31, 'P5 ¿Qué los une aún? ¿Qué valoran de la relación?', s.q5);

  // Pie de Página - Página 1
  doc.setDrawColor(...cBorder);
  doc.line(15, 283, 195, 283);
  doc.setTextColor(...cTextMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Salud Mental 360 · TeAcompaño Centro Psicológico · Documento confidencial', 15, 288);
  doc.text('Página 1', 195, 288, { align: 'right' });

  // -------------------------------------------------------------------------
  // PAGINA 2: ENFOQUE, OBS, TAREAS, TIEMPO, PRÓXIMA CITA Y FIRMAS
  // -------------------------------------------------------------------------
  doc.addPage();

  // Encabezado de Página 2
  doc.setFillColor(...cSage);
  doc.roundedRect(15, 10, contentW, 26, 4, 4, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(28, 23, 9, 'F');
  doc.setFillColor(74, 158, 154);
  doc.ellipse(26, 21.5, 3.5, 4.8, 'F');
  doc.setFillColor(...cOrange);
  doc.ellipse(30, 21.5, 3.5, 4.8, 'F');
  doc.setFillColor(255, 255, 255);
  doc.ellipse(28, 24, 2, 2.8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Ficha de terapia de pareja', 41, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Registro clínico · Gestión de sesión', 41, 23.5);
  doc.setFontSize(7.5);
  doc.text('Salud Mental 360  ·  TeAcompaño Centro Psicológico  ·  Alianza por tu bienestar integral', 41, 29.5);

  // 1. SECCIÓN: ENFOQUE TERAPÉUTICO UTILIZADO
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Enfoque terapéutico utilizado (marcar)', 15, 44);

  const enfoquesList = ['Gottman', 'EFT', 'TCC de pareja', 'Sistémico', 'Narrativo', 'Gestalt', 'Psicodinámico'];
  
  // Dibujar cápsulas de enfoque
  let ex = 15;
  let ey = 48;
  const colWE = 45;
  const rowHE = 7;
  
  enfoquesList.forEach((enf, index) => {
    const active = s.enf && s.enf.includes(enf);
    const col = index % 4;
    const row = Math.floor(index / 4);
    const currX = ex + col * colWE;
    const currY = ey + row * rowHE;
    
    doc.setFillColor(active ? 74 : 255, active ? 158 : 255, active ? 154 : 255); // Usar color Teal si está activo
    doc.setDrawColor(...cBorder);
    doc.roundedRect(currX, currY, 41, 5, 2.5, 2.5, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(active ? 255 : 150);
    doc.setFontSize(8.5);
    doc.text(active ? 'X' : ' ', currX + 3.5, currY + 3.6);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(active ? 255 : cText[0], active ? 255 : cText[1], active ? 255 : cText[2]);
    doc.setFontSize(7.5);
    doc.text(enf, currX + 8, currY + 3.4);
  });

  // 2. SECCIÓN: OBSERVACIONES Y TAREAS
  // Cajas side-by-side de Observaciones y Tareas asignadas (altura 40mm)
  drawMotivoBox(15, 67, 88, 40, 'Observaciones clínicas del terapeuta', s.obs);
  drawMotivoBox(107, 67, 88, 40, 'Tarea asignada para próxima sesión', s.tar);

  // 3. SECCIÓN: GESTIÓN DEL TIEMPO
  doc.setFillColor(241, 246, 242);
  doc.roundedRect(15, 114, contentW, 7, 2, 2, 'F');
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Gestión del tiempo', 18, 119);

  // Fila 1 de Tiempos: Duración total, Hora Inicio, Hora Fin estimada, Fin Real
  const [hh, mm] = (s.hi || "09:00").split(":").map(Number);
  const duration = parseInt(s.dtot) || 60;
  const endTime = new Date(2000, 0, 1, hh, mm + duration);
  const hFin = endTime.getHours().toString().padStart(2, '0') + ':' + endTime.getMinutes().toString().padStart(2, '0');

  drawInputBox(15, 125, 41, 10, 'DURACIÓN TOTAL (MIN)', s.dtot);
  drawInputBox(60, 125, 41, 10, 'HORA DE INICIO', s.hi);
  drawInputBox(105, 125, 41, 10, 'HORA DE FIN ESTIMADA', hFin);
  drawInputBox(150, 125, 45, 10, 'FIN REAL', hFin); // Completa el fin real por defecto

  // Distribución de bloques de la sesión
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Distribución de la sesión', 15, 141);

  // 4 Bloques horizontales de colores
  // Bloque 1: Apertura / revisión
  doc.setFillColor(...cSage); // Sage green
  doc.roundedRect(15, 145, 41, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${s.t1 || 0} min`, 35.5, 149.2, { align: 'center' });
  doc.setTextColor(...cTextMuted);
  doc.setFontSize(7.5);
  doc.text('Apertura / revisión', 15, 154.5);

  // Bloque 2: Exploración del conflicto
  doc.setFillColor(...cOrange); // Orange
  doc.roundedRect(60, 145, 41, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`${s.t2 || 0} min`, 80.5, 149.2, { align: 'center' });
  doc.setTextColor(...cTextMuted);
  doc.setFontSize(7.5);
  doc.text('Exploración del conflicto', 60, 154.5);

  // Bloque 3: Intervención / técnica
  doc.setFillColor(74, 158, 154); // Teal
  doc.roundedRect(105, 145, 41, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`${s.t3 || 0} min`, 125.5, 149.2, { align: 'center' });
  doc.setTextColor(...cTextMuted);
  doc.setFontSize(7.5);
  doc.text('Intervención / técnica', 105, 154.5);

  // Bloque 4: Cierre / tarea nueva
  doc.setFillColor(179, 201, 182); // Sage mid
  doc.roundedRect(150, 145, 45, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`${s.t4 || 0} min`, 172.5, 149.2, { align: 'center' });
  doc.setTextColor(...cTextMuted);
  doc.setFontSize(7.5);
  doc.text('Cierre / tarea nueva', 150, 154.5);

  // Fila 2 de tiempos: Próxima sesión, frecuencia, hora
  drawInputBox(15, 160, 60, 10, 'PRÓXIMA SESIÓN — FECHA', s.prox);
  drawInputBox(80, 160, 58, 10, 'FRECUENCIA', s.frec);
  drawInputBox(143, 160, 52, 10, 'HORA', s.hi || '—');

  // 4. SECCIÓN: CIERRE DE SESIÓN (FIRMAS)
  doc.setFillColor(241, 246, 242);
  doc.roundedRect(15, 177, contentW, 7, 2, 2, 'F');
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Cierre de sesión', 18, 182);

  // Líneas de firma ordenadas en 3 columnas
  const sigY = 192;
  const lineY = 210;
  
  // Firma Persona 1
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Firma — Persona 1', 15, sigY);
  doc.setDrawColor(...cTextMuted);
  doc.line(15, lineY, 71, lineY);
  doc.setTextColor(...cText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Nombre: ${s.n1 || '________________'}`, 15, lineY + 5);

  // Firma Persona 2
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Firma — Persona 2', 77, sigY);
  doc.line(77, lineY, 133, lineY);
  doc.setTextColor(...cText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Nombre: ${s.n2 || '________________'}`, 77, lineY + 5);

  // Firma Terapeuta
  doc.setTextColor(...cSageDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Firma — Terapeuta', 139, sigY);
  doc.line(139, lineY, 195, lineY);
  doc.setTextColor(...cText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Reg. / CMP: ________________', 139, lineY + 5);

  // Pie de Página - Página 2
  doc.setDrawColor(...cBorder);
  doc.line(15, 283, 195, 283);
  doc.setTextColor(...cTextMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Salud Mental 360 · TeAcompaño Centro Psicológico · Documento confidencial', 15, 288);
  doc.text('Página 2', 195, 288, { align: 'right' });

  // -------------------------------------------------------------------------
  // FUNCIONES COMPARTIDAS DE DIBUJO DE CAJAS
  // -------------------------------------------------------------------------
  
  function drawInputBox(bx, by, bw, bh, label, val) {
    doc.setFillColor(...cCream);
    doc.setDrawColor(...cBorder);
    doc.roundedRect(bx, by, bw, bh, 1, 1, 'FD');
    
    doc.setTextColor(...cTextMuted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(label, bx + 2.5, by + 3.2);
    
    doc.setTextColor(...cText);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(val || ''), bx + 2.5, by + 7.8);
  }

  function drawMotivoBox(bx, by, bw, bh, label, val) {
    doc.setFillColor(...cCream);
    doc.setDrawColor(...cBorder);
    doc.roundedRect(bx, by, bw, bh, 1, 1, 'FD');
    
    doc.setTextColor(...cSageDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label, bx + 3, by + 4.5);
    
    doc.setTextColor(...cText);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    
    const lines = doc.splitTextToSize(String(val || ''), bw - 6);
    doc.text(lines, bx + 3, by + 9.5);
  }

  function drawQuestionBox(bx, by, bw, bh, label, val) {
    // Cabecera Naranja
    doc.setFillColor(...cOrange);
    doc.roundedRect(bx, by, bw, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(label, bx + 2.5, by + 3.6);
    
    // Cuerpo Naranja Claro
    doc.setFillColor(...cOrangeLight);
    doc.setDrawColor(...cOrange);
    doc.rect(bx, by + 5, bw, bh - 5, 'F');
    doc.roundedRect(bx, by, bw, bh, 1, 1, 'S'); // Borde exterior completo
    
    // Valor
    doc.setTextColor(...cText);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(String(val || ''), bw - 5);
    doc.text(lines, bx + 2.5, by + 9.2);
  }

  // Descargar PDF con nombre dinámico
  const p1 = String(s.n1 || 'P1').trim().replace(/\s+/g, '_');
  const p2 = String(s.n2 || 'P2').trim().replace(/\s+/g, '_');
  const dateStr = String(s.fec || '').replace(/-/g, '');
  doc.save(`Informe_TerapiaPareja_${p1}_${p2}_S${s.ns || '1'}_${dateStr}.pdf`);
  showToast('✅ Ficha clínica PDF descargada');
}
