/**
 * app_admin.js - Controlador del Portal Administrativo para el Terapeuta
 * Controla admin.html, gestión de login, dashboard de estados, tiempos y descargas.
 */

let curStep = 0;
let sessions = [];
let activeSession = {
  id: "",
  n1: "", n2: "",
  a1: "", a2: "",
  rel: "", est: "", hij: "",
  ns: 1, fec: "", ter: "",
  m1: "", m2: "",
  areas: [],
  dur: "", prev: "", sc1: "",
  questions: [],
  enf: [],
  obs: "", tar: "",
  dtot: 60, hi: "09:00",
  t1: 10, t2: 20, t3: 20, t4: 10,
  prox: "", frec: "Semanal",
  status: "Con Respuesta"
};

// Carga inicial
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar base de datos híbrida (offline/online)
  await initDatabase();
  
  // Si ya tenemos una clave guardada en base de datos de esta sesión (autenticación persistida en memoria)
  if (verifiedPassword || !onlineMode) {
    // Si estamos offline o ya logueados, saltar el login
    checkAndShowPortal();
  }

  // Escuchar cambios de archivo de importación
  const importFile = document.getElementById("import-file");
  if (importFile) {
    importFile.addEventListener("change", handleImportJSON);
  }
});

/**
 * Muestra notificaciones Toast
 */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }
}

/**
 * Intenta iniciar sesión con la clave administrativa provista
 */
async function loginAdmin() {
  const passField = document.getElementById("admin-pass");
  const password = passField ? passField.value : "";
  const errorDiv = document.getElementById("login-error");
  
  if (!password) {
    alert("Por favor, ingrese una clave.");
    return;
  }

  try {
    // Probar cargando las sesiones usando la contraseña
    sessions = await fetchAllSessions(password);
    
    // Si no arroja error, contraseña es correcta!
    verifiedPassword = password;
    if (errorDiv) errorDiv.style.display = "none";
    
    checkAndShowPortal();
    showToast("Sesión iniciada correctamente.");
  } catch (error) {
    console.error(error);
    if (errorDiv) {
      errorDiv.textContent = "⚠️ " + error.message;
      errorDiv.style.display = "block";
    }
  }
}

/**
 * Cierra la sesión del administrador
 */
function logoutAdmin() {
  verifiedPassword = "";
  document.getElementById("dashboard-section").style.display = "none";
  document.getElementById("wizard-section").style.display = "none";
  document.getElementById("login-section").style.display = "flex";
  
  const passField = document.getElementById("admin-pass");
  if (passField) passField.value = "";
  
  showToast("Sesión cerrada.");
}

/**
 * Pasa la vista del Login al Dashboard del Administrador
 */
function checkAndShowPortal() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "block";
  loadAdminDashboard();
}

/**
 * Carga y renderiza las dos bandejas del Dashboard (Pendientes y Completados)
 */
async function loadAdminDashboard() {
  try {
    sessions = await fetchAllSessions(verifiedPassword);
  } catch (e) {
    alert("Error al cargar sesiones: " + e.message);
    logoutAdmin();
    return;
  }

  const pendingTbody = document.getElementById("pending-tbody");
  const completedTbody = document.getElementById("completed-tbody");
  const searchInput = document.getElementById("db-search");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  // Filtrar si hay una búsqueda activa
  const filtered = sessions.filter(s => {
    const term = `${s.n1} ${s.n2} ${s.ter} ${s.fec}`.toLowerCase();
    return term.includes(query);
  });

  // Dividir por estados
  const pending = filtered.filter(s => s.status === "Nuevo Registro" || s.status === "Enviado" || s.status === "Resuelto" || s.status === "Sin Respuesta" || s.status === "Respuestas Completadas" || s.status === "Pendiente" || s.status === "Programado");
  const completed = filtered.filter(s => s.status === "Finalizado" || s.status === "Con Respuesta" || s.status === "Completado" || !s.status);

  // Renderizar Fichas Pendientes
  if (pendingTbody) {
    if (pending.length === 0) {
      pendingTbody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state" style="padding: 2rem 1rem;">
              <i class="ti ti-mail-opened"></i>
              <p>No hay fichas de ingreso pendientes en la bandeja de entrada.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      pendingTbody.innerHTML = pending.map(s => {
        let statusChip = "";
        if (s.status === "Nuevo Registro") {
          statusChip = `<span class="chip chip-blue" style="background-color: #e2f1ff; color: #1e74cd; border: 1px solid rgba(30,116,205,0.2);"><i class="ti ti-user-plus"></i> Nuevo Registro</span>`;
        } else if (s.status === "Resuelto" || s.status === "Respuestas Completadas") {
          statusChip = `<span class="chip chip-green"><i class="ti ti-circle-check"></i> Resuelto</span>`;
        } else if (s.status === "Programado") {
          statusChip = `<span class="chip chip-purple" style="background-color: #f3e8ff; color: #6b21a8; border: 1px solid rgba(107,33,168,0.2);"><i class="ti ti-calendar-time"></i> Programado</span>`;
        } else {
          // "Enviado", "Sin Respuesta", "Pendiente"
          statusChip = `<span class="chip chip-amber"><i class="ti ti-mail-forward"></i> Enviado</span>`;
        }

        // Acciones
        let actionsHtml = "";
        if (s.status === "Nuevo Registro") {
          actionsHtml = `
            <button class="btn btn-sage" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--teal-main); border-color: var(--teal-main);" onclick="loadSessionEditor('${s.id}')">
              <i class="ti ti-pencil-edit"></i> Revisar y Asignar
            </button>
          `;
        } else if (s.status === "Resuelto" || s.status === "Respuestas Completadas" || s.status === "Programado") {
          // Quitar compartir por WhatsApp/Correo
          actionsHtml = `
            <button class="btn btn-sage" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="loadSessionEditor('${s.id}')">
              <i class="ti ti-pencil-edit"></i> Completar Sesión
            </button>
          `;
        } else {
          // "Enviado". Mostrar compartir y completar
          actionsHtml = `
            <button class="action-btn" title="Compartir enlace de preguntas" onclick="openShareModal('${s.id}')" style="background-color: var(--teal-light); color: var(--teal-dark);">
              <i class="ti ti-share"></i>
            </button>
            <button class="btn btn-sage" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="loadSessionEditor('${s.id}')">
              <i class="ti ti-pencil-edit"></i> Completar Sesión
            </button>
          `;
        }

        // Agregar botón borrar
        actionsHtml += `
          <button class="action-btn del" title="Eliminar" onclick="confirmDelete('${s.id}', '${s.n1}', '${s.n2}')">
            <i class="ti ti-trash"></i>
          </button>
        `;

        return `
          <tr>
            <td style="font-weight: 600; color: var(--sage-dark);">
              ${s.n1 || '—'} <span style="font-weight: normal; color: var(--text-light);">y</span> ${s.n2 || '—'}
            </td>
            <td>${s.fec_envio || s.fec || '—'}</td>
            <td style="text-align: center;">${statusChip}</td>
            <td>
              <div class="actions">
                ${actionsHtml}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  // Renderizar Historial Completado
  if (completedTbody) {
    if (completed.length === 0) {
      completedTbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state" style="padding: 2.5rem 1rem;">
              <i class="ti ti-folder-open"></i>
              <p>No se encontraron expedientes clínicos completados.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      const seenCouples = new Set();
      completedTbody.innerHTML = completed.map(s => {
        const n1Key = (s.n1 || '').toLowerCase().trim();
        const n2Key = (s.n2 || '').toLowerCase().trim();
        const coupleKey = [n1Key, n2Key].sort().join('|');
        const isLatest = !seenCouples.has(coupleKey);
        seenCouples.add(coupleKey);

        const plusButton = isLatest ? `
          <button class="action-btn" title="Nueva Sesión" onclick="createNewSessionFromExisting('${s.id}')" style="background-color: var(--sage-light); color: var(--sage-dark);">
            <i class="ti ti-plus"></i>
          </button>
        ` : '';

        return `
          <tr>
            <td style="font-weight: 600; color: var(--sage-dark);">
              ${s.n1 || '—'} <span style="font-weight: normal; color: var(--text-light);">y</span> ${s.n2 || '—'}
            </td>
            <td>${s.fec || '—'}</td>
            <td style="text-align: center;">
              <span class="chip chip-green" style="margin-bottom: 4px; display: inline-block;">Sesión ${s.ns || 1}</span><br>
              <span class="chip chip-teal"><i class="ti ti-check"></i> Finalizado</span>
            </td>
            <td>${s.ter || '—'}</td>
            <td>${s.frec || '—'}</td>
            <td>
              <div class="actions">
                ${plusButton}
                <button class="action-btn" title="Compartir enlace" onclick="openShareModal('${s.id}')" style="background-color: var(--teal-light); color: var(--teal-dark);">
                  <i class="ti ti-share"></i>
                </button>
                <button class="action-btn" title="Editar Sesión" onclick="loadSessionEditor('${s.id}')">
                  <i class="ti ti-edit"></i>
                </button>
                <button class="action-btn" title="Descargar PDF" onclick="downloadSinglePDF('${s.id}')">
                  <i class="ti ti-file-type-pdf"></i>
                </button>
                <button class="action-btn del" title="Eliminar" onclick="confirmDelete('${s.id}', '${s.n1}', '${s.n2}')">
                  <i class="ti ti-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }
  }
}

/**
 * Filtra las listas del dashboard
 */
function filterSessions() {
  loadAdminDashboard();
}

/**
 * Confirma y borra una sesión de la base de datos
 */
async function confirmDelete(id, n1, n2) {
  const name = `${n1} & ${n2}`.trim() || "esta pareja";
  if (confirm(`¿Está seguro de que desea eliminar permanentemente el registro de ${name}?`)) {
    try {
      await deleteSession(id, verifiedPassword);
      showToast("Registro eliminado con éxito.");
      loadAdminDashboard();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
  }
}

/**
 * Carga los datos de una ficha en el editor del terapeuta
 * @param {string} id - ID de la sesión.
 */
/**
 * Bloquea o desbloquea los campos demográficos y número de sesión para edición
 */
function setDemographicsEditable(editable) {
  // Datos fijos llenados por la pareja: siempre bloqueados
  const fixedFields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij'];
  fixedFields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.setAttribute("readonly", "true");
      if (el.tagName === "SELECT") {
        el.setAttribute("disabled", "true");
      }
    }
  });

  // Campos de asignación de la sesión: editables si la sesión no está finalizada
  const assignFields = ['ns', 'ter', 'fec'];
  assignFields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      if (editable) {
        el.removeAttribute("readonly");
        el.removeAttribute("disabled");
      } else {
        el.setAttribute("readonly", "true");
        if (el.tagName === "SELECT") {
          el.setAttribute("disabled", "true");
        }
      }
    }
  });
}





async function loadSessionEditor(id) {
  const allSess = await fetchAllSessions(verifiedPassword);
  const session = allSess.find(s => s.id === id);
  if (!session) return;

  activeSession = { ...session };

  // Llenar inputs de texto
  const fields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij', 'ns', 'fec', 'ter', 
                  'm1', 'm2', 'dur', 'prev', 'obs', 'tar',
                  'dtot', 'hi', 't1', 't2', 't3', 't4', 'prox', 'frec'];
  
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.value = activeSession[f] !== undefined ? activeSession[f] : "";
    }
  });

  // Los campos de asignación (ns, ter, fec) son editables siempre que la sesión no esté finalizada/completada
  const isSessionEditable = activeSession.status !== "Finalizado" && activeSession.status !== "Completado";
  setDemographicsEditable(isSessionEditable);

  // Cargar y renderizar preguntas dinámicas
  activeSession.questions = getSessionQuestions(activeSession);
  renderQuestions();

  // Si no tiene terapeuta asignado aún (ficha recién enviada por paciente), asignar terapeuta vacío o último
  const terInput = document.getElementById("ter");
  if (terInput && !terInput.value && sessions.length > 0) {
    const completedOnes = sessions.filter(s => s.ter);
    if (completedOnes.length > 0) {
      terInput.value = completedOnes[0].ter;
      activeSession.ter = completedOnes[0].ter;
    }
  }

  // Marcar tags de áreas de conflicto
  document.querySelectorAll("#areas .tag").forEach(t => {
    const text = t.textContent.trim();
    if (activeSession.areas && activeSession.areas.includes(text)) {
      t.classList.add("on");
    } else {
      t.classList.remove("on");
    }
  });



  // Marcar escala de compromiso
  document.querySelectorAll("#sc1 .snum").forEach(s => {
    const val = parseInt(s.textContent.trim());
    if (activeSession.sc1 === val) {
      s.classList.add("on");
    } else {
      s.classList.remove("on");
    }
  });

  // Mostrar editor
  document.getElementById("dashboard-section").style.display = "none";
  document.getElementById("wizard-section").style.display = "block";
  
  calcT();
  go(0);
  showToast("Cargando expediente clínico...");
}

/**
 * Cancela la edición y vuelve al listado
 */
function cancelForm() {
  // Asegurar que los campos vuelvan a ser editables por defecto
  setDemographicsEditable(true);
  document.getElementById("wizard-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "block";
  loadAdminDashboard();
}

/**
 * Valida si la pareja ya tiene una sesión registrada con el mismo número (ns)
 */
function checkDuplicateSession(sessionObj) {
  const n1 = (sessionObj.n1 || '').toLowerCase().trim();
  const n2 = (sessionObj.n2 || '').toLowerCase().trim();
  const ns = parseInt(sessionObj.ns) || 0;

  if (!n1 || !n2 || ns <= 0) return false;

  return sessions.some(s => {
    if (s.id === sessionObj.id) return false; // Ignorar el mismo registro
    const s1 = (s.n1 || '').toLowerCase().trim();
    const s2 = (s.n2 || '').toLowerCase().trim();
    const sameCouple = (s1 === n1 && s2 === n2) || (s1 === n2 && s2 === n1);
    return sameCouple && parseInt(s.ns) === ns;
  });
}

/**
 * Guarda los datos del editor en la base de datos (con estado "Finalizado")
 */
async function saveActiveSession(targetStatus = 'Finalizado') {
  syncFormToActiveSession();
  
  if (!activeSession.n1 || !activeSession.n2) {
    alert("Faltan completar datos demográficos obligatorios (Nombres).");
    return;
  }

  if (checkDuplicateSession(activeSession)) {
    alert(`⚠️ La pareja ya tiene registrada una Sesión N° ${activeSession.ns}. Por favor, asigne otro número de sesión para evitar errores.`);
    return;
  }

  try {
    activeSession.status = targetStatus;
    
    await saveSession(activeSession, verifiedPassword);
    if (targetStatus === 'Programado') {
      showToast("📅 Sesión programada correctamente.");
    } else {
      showToast("Expediente guardado e indexado en el historial.");
    }
    cancelForm();
  } catch (error) {
    alert("Error al guardar cambios: " + error.message);
  }
}

/**
 * Navega por el stepper del editor
 */
function go(stepIdx) {
  syncFormToActiveSession();

  if (stepIdx > curStep) {
    if (curStep === 0 && (!activeSession.n1 || !activeSession.n2)) {
      alert("Por favor, ingresen el nombre de ambos integrantes de la pareja.");
      return;
    }
  }

  curStep = stepIdx;
  
  document.querySelectorAll(".page").forEach((page, i) => {
    page.classList.toggle("active", i === stepIdx);
  });
  
  document.querySelectorAll(".step").forEach((step, i) => {
    step.classList.toggle("active", i === stepIdx);
    step.classList.toggle("done", i < stepIdx);
  });
  
  const progWidth = ((stepIdx + 1) / 5 * 100);
  document.getElementById("prog").style.width = `${progWidth}%`;
  
  if (stepIdx === 4) {
    buildSum();
  }
  
  document.querySelector(".stepper").scrollIntoView({ behavior: 'smooth' });
}

/**
 * Sincroniza controles del DOM al objeto
 */
function syncFormToActiveSession() {
  const fields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij', 'ns', 'fec', 'ter', 
                  'm1', 'm2', 'dur', 'prev', 'obs', 'tar',
                  'dtot', 'hi', 't1', 't2', 't3', 't4', 'prox', 'frec'];
  
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      if (el.type === 'number') {
        activeSession[f] = el.value ? parseInt(el.value) : "";
      } else {
        activeSession[f] = el.value;
      }
    }
  });

  activeSession.areas = [...document.querySelectorAll("#areas .tag.on")].map(t => t.textContent.trim());
  
  const selSnum = document.querySelector("#sc1 .snum.on");
  activeSession.sc1 = selSnum ? parseInt(selSnum.textContent.trim()) : "";

  // Sincronizar preguntas dinámicas
  activeSession.questions = [];
  document.querySelectorAll("#questions-container .q-card").forEach(card => {
    const qInput = card.querySelector(".q-input");
    const aTextarea = card.querySelector(".q-textarea");
    if (qInput) {
      activeSession.questions.push({
        q: qInput.value,
        a: aTextarea ? aTextarea.value : ""
      });
    }
  });
}

/**
 * Toggles tag style
 */
function tog(el) {
  el.classList.toggle("on");
}

/**
 * Sets scale rating
 */
function scl(wrapperId, el) {
  document.querySelectorAll(`#${wrapperId} .snum`).forEach(s => s.classList.remove("on"));
  el.classList.add("on");
}

/**
 * Calcula bloques de tiempo de la sesión
 */
function calcT() {
  const totInput = document.getElementById("dtot");
  const tot = totInput ? parseInt(totInput.value) || 60 : 60;
  
  const t1 = parseInt(document.getElementById("t1").value) || 0;
  const t2 = parseInt(document.getElementById("t2").value) || 0;
  const t3 = parseInt(document.getElementById("t3").value) || 0;
  const t4 = parseInt(document.getElementById("t4").value) || 0;
  
  const used = t1 + t2 + t3 + t4;
  const rest = tot - used;
  
  const hiVal = document.getElementById("hi").value || "09:00";
  const [hh, mm] = hiVal.split(":").map(Number);
  const endTime = new Date(2000, 0, 1, hh, mm + tot);
  const hFin = endTime.getHours().toString().padStart(2, '0') + ':' + endTime.getMinutes().toString().padStart(2, '0');
  
  const cls = rest === 0 ? 'chip-green' : rest < 0 ? 'chip-red' : 'chip-amber';
  const txt = rest === 0 ? 'Tiempo exacto' : rest > 0 ? `${rest} min libres` : `${Math.abs(rest)} min excedidos`;
  
  const resultDiv = document.getElementById("tresult");
  if (resultDiv) {
    resultDiv.innerHTML = `
      <div class="time-bar">
        <div class="time-seg" style="width: ${Math.min((t1 / tot) * 100, 100)}%; background-color: var(--sage-main);"></div>
        <div class="time-seg" style="width: ${Math.min((t2 / tot) * 100, 100)}%; background-color: var(--terracotta-main);"></div>
        <div class="time-seg" style="width: ${Math.min((t3 / tot) * 100, 100)}%; background-color: var(--teal-main);"></div>
        <div class="time-seg" style="width: ${Math.min((t4 / tot) * 100, 100)}%; background-color: var(--sage-mid);"></div>
      </div>
      <div class="time-legend">
        <span class="tleg"><span class="tleg-dot" style="background-color: var(--sage-main);"></span>Apertura: ${t1}m</span>
        <span class="tleg"><span class="tleg-dot" style="background-color: var(--terracotta-main);"></span>Exploración: ${t2}m</span>
        <span class="tleg"><span class="tleg-dot" style="background-color: var(--teal-main);"></span>Intervención: ${t3}m</span>
        <span class="tleg"><span class="tleg-dot" style="background-color: var(--sage-mid);"></span>Cierre: ${t4}m</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 1.25rem; flex-wrap: wrap;">
        <span class="chip ${cls}"><i class="ti ti-activity"></i> ${txt}</span>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">
          Fin estimado: <strong style="color: var(--text-main); font-size: 0.85rem;">${hFin} hs</strong>
        </span>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">
          Usado: <strong style="color: var(--text-main); font-size: 0.85rem;">${used} / ${tot} min</strong>
        </span>
      </div>
    `;
  }
}

/**
 * Dibuja tarjetas del paso de resumen
 */
function buildSum() {
  syncFormToActiveSession();
  
  const sumcont = document.getElementById("sumcont");
  if (!sumcont) return;

  const n1 = activeSession.n1 || "Persona 1";
  const n2 = activeSession.n2 || "Persona 2";
  const areasStr = activeSession.areas.length > 0 ? activeSession.areas.join(", ") : "Ninguna seleccionada";
  
  // Obtener y formatear preguntas y respuestas
  const questionsList = getSessionQuestions(activeSession);
  let qHtml = "";
  if (questionsList && questionsList.length > 0) {
    questionsList.forEach((q, i) => {
      qHtml += `
        <div style="margin-bottom: 0.75rem; border-left: 3px solid var(--sage-main); padding-left: 10px; text-align: left;">
          <p style="font-weight: 600; font-size: 0.85rem; color: var(--sage-dark); margin-bottom: 2px;">P${i+1}: ${q.q}</p>
          <p style="font-size: 0.85rem; color: var(--text-main); font-style: italic; white-space: pre-wrap; margin-left: 4px;">${q.a || 'Sin respuesta'}</p>
        </div>
      `;
    });
  }

  sumcont.innerHTML = `
    <div class="sum-grid">
      <div class="sum-card">
        <div class="sum-title">👫 Pareja Atendida</div>
        <div class="sum-val">${n1} y ${n2}</div>
      </div>
      <div class="sum-card">
        <div class="sum-title">📊 Relación y Sesión</div>
        <div class="sum-val">Relación: ${activeSession.rel || '—'} · Sesión N° ${activeSession.ns || 1} (${activeSession.frec || '—'})</div>
      </div>
      <div class="sum-card">
        <div class="sum-title">📅 Fecha y Profesional</div>
        <div class="sum-val">${activeSession.fec || '—'} · Terapeuta: ${activeSession.ter || '—'}</div>
      </div>
      <div class="sum-card">
        <div class="sum-title">❤️ Compromiso Relacional</div>
        <div class="sum-val">${activeSession.sc1 ? activeSession.sc1 + ' / 10' : '—'}</div>
      </div>
      <div class="sum-card" style="grid-column: span 2;">
        <div class="sum-title">⚠️ Áreas de conflicto detectadas</div>
        <div class="sum-val">${areasStr}</div>
      </div>
      <div class="sum-card" style="grid-column: span 2;">
        <div class="sum-title">❓ Preguntas y Respuestas de la Sesión</div>
        <div class="sum-val" style="display: flex; flex-direction: column; gap: 0.4rem; font-weight: normal; color: var(--text-main);">
          ${qHtml || 'No hay preguntas registradas.'}
        </div>
      </div>
      <div class="sum-card" style="grid-column: span 2;">
        <div class="sum-title">📝 Tarea Asignada para la casa</div>
        <div class="sum-val">${activeSession.tar || 'Ninguna tarea asignada.'}</div>
      </div>
    </div>
  `;
}

/**
 * Obtiene el resumen para consulta con IA
 */
function getSummaryAIPrompt() {
  syncFormToActiveSession();
  
  const n1 = activeSession.n1 || "Persona 1";
  const n2 = activeSession.n2 || "Persona 2";
  const areasStr = activeSession.areas.length > 0 ? activeSession.areas.join(", ") : "Ninguna";
  
  let qText = "";
  if (activeSession.questions && activeSession.questions.length > 0) {
    activeSession.questions.forEach((q, i) => {
      qText += `Pregunta ${i+1}: "${q.q}" -> Respuesta: "${q.a}". `;
    });
  }
  
  return `Pareja: ${n1} (${activeSession.a1 || '—'} años) y ${n2} (${activeSession.a2 || '—'} años). ` + 
         `Tiempo de relación: ${activeSession.rel || '—'}. Estado civil: ${activeSession.est || '—'}. Hijos: ${activeSession.hij || '—'}. ` +
         `Sesión clínica N° ${activeSession.ns || 1} de fecha ${activeSession.fec || '—'}. Terapeuta: ${activeSession.ter || '—'}. ` +
         `Motivo de ${n1}: "${activeSession.m1 || '—'}". Motivo de ${n2}: "${activeSession.m2 || '—'}". ` +
         `Áreas de conflicto: ${areasStr}. Compromiso de pareja: ${activeSession.sc1 || '—'}/10. Duración del conflicto: ${activeSession.dur || '—'}. ` +
         qText +
         `Observaciones clínicas: "${activeSession.obs || '—'}". Tarea escolar asignada: "${activeSession.tar || '—'}".`;
}

/**
 * Helper para obtener preguntas dinámicas con fallback a q1..q5
 */
function getSessionQuestions(s) {
  if (s.questions && s.questions.length > 0) {
    return s.questions;
  }
  return [
    { q: "¿Qué esperan lograr activamente al venir a terapia?", a: s.q1 || "" },
    { q: "¿Cuándo fue el último periodo donde se sintieron bien en pareja?", a: s.q2 || "" },
    { q: "¿Cómo suelen manejar el conflicto? (¿Quién persigue y quién se distancia?)", a: s.q3 || "" },
    { q: "¿Qué sienten que la otra persona no logra entender de ustedes?", a: s.q4 || "" },
    { q: "¿Qué cosas positivas los mantienen unidos aún hoy?", a: s.q5 || "" }
  ];
}

/**
 * Renderiza las preguntas dinámicas en el editor del admin
 */
function renderQuestions() {
  const container = document.getElementById("questions-container");
  if (!container) return;

  container.innerHTML = "";
  activeSession.questions.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "q-card";
    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 0.5rem;">
        <input type="text" class="q-input" value="${item.q}" placeholder="Escribe la pregunta..." style="font-weight: 600; width: 100%; border: none; border-bottom: 1px solid var(--border-color); background: transparent; padding: 4px 0; font-size: 0.95rem; color: var(--sage-dark); font-family: var(--font-body);">
        <button type="button" class="action-btn del" onclick="deleteQuestion(${idx})" title="Eliminar pregunta" style="background: none; border: none; color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 4px;">
          <i class="ti ti-trash"></i>
        </button>
      </div>
      <textarea class="q-textarea" placeholder="Respuesta del paciente/terapeuta..." style="width: 100%; min-height: 80px;">${item.a || ''}</textarea>
    `;
    container.appendChild(card);
  });
}

/**
 * Agrega pregunta en el panel de administración
 */
function addQuestionField() {
  syncFormToActiveSession();
  activeSession.questions.push({ q: "", a: "" });
  renderQuestions();
}

/**
 * Elimina pregunta en el panel de administración
 */
function deleteQuestion(idx) {
  syncFormToActiveSession();
  activeSession.questions.splice(idx, 1);
  renderQuestions();
}

/**
 * Crea una nueva sesión clínica (S2, S3, etc.) clonando los datos demográficos de una pareja existente
 */
async function createNewSessionFromExisting(id) {
  const allSess = await fetchAllSessions(verifiedPassword);
  const session = allSess.find(s => s.id === id);
  if (!session) return;

  // Buscar todas las sesiones de esta pareja para calcular la sesión más alta
  const n1Key = (session.n1 || '').toLowerCase().trim();
  const n2Key = (session.n2 || '').toLowerCase().trim();
  
  const coupleSessions = allSess.filter(s => {
    const s1 = (s.n1 || '').toLowerCase().trim();
    const s2 = (s.n2 || '').toLowerCase().trim();
    return (s1 === n1Key && s2 === n2Key) || (s1 === n2Key && s2 === n1Key);
  });
  
  const maxNs = coupleSessions.reduce((max, s) => {
    const num = parseInt(s.ns) || 1;
    return num > max ? num : max;
  }, 0);
  
  const nextNs = maxNs + 1;

  // Clonamos demográficos pero limpiamos campos específicos de la sesión individual
  activeSession = {
    id: "", // Vacío para crear nueva clave en KV/LocalStorage
    n1: session.n1 || "",
    n2: session.n2 || "",
    a1: session.a1 || "",
    a2: session.a2 || "",
    rel: session.rel || "",
    est: session.est || "",
    hij: session.hij || "",
    ns: nextNs, // Siguiente número de sesión calculado dinámicamente
    fec: new Date().toISOString().split('T')[0], // Fecha actual
    ter: session.ter || "",
    m1: "", m2: "", // Vaciar motivos
    areas: session.areas || [], // Mantener áreas de conflicto detectadas como base
    dur: session.dur || "",
    prev: session.prev || "",
    sc1: "", // Vaciar compromiso (a recalcular)
    questions: (session.questions && session.questions.length > 0) ? 
               session.questions.map(q => ({ q: q.q, a: "" })) : // Copiar preguntas pero vaciar respuestas
               [
                 { q: "¿Qué esperan lograr activamente al venir a terapia?", a: "" },
                 { q: "¿Cuándo fue el último periodo donde se sintieron bien en pareja?", a: "" },
                 { q: "¿Cómo suelen manejar el conflicto? (¿Quién persigue y quién se distancia?)", a: "" },
                 { q: "¿Qué sienten que la otra persona no logra entender de ustedes?", a: "" },
                 { q: "¿Qué cosas positivas los mantienen unidos aún hoy?", a: "" }
               ],
    obs: "", // Vaciar observaciones para escribir nuevas
    tar: "", // Vaciar tarea asignada
    dtot: 60, hi: "09:00", // Tiempos iniciales
    t1: 10, t2: 20, t3: 20, t4: 10,
    prox: "", frec: session.frec || "Semanal",
    status: "Enviado"
  };

  // Llenar inputs de texto
  const fields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij', 'ns', 'fec', 'ter', 
                  'm1', 'm2', 'dur', 'prev', 'obs', 'tar',
                  'dtot', 'hi', 't1', 't2', 't3', 't4', 'prox', 'frec'];
  
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.value = activeSession[f] !== undefined ? activeSession[f] : "";
    }
  });

  // Marcar tags de áreas
  document.querySelectorAll("#areas .tag").forEach(t => {
    const text = t.textContent.trim();
    t.classList.toggle("on", activeSession.areas.includes(text));
  });



  // Desmarcar escala de compromiso
  document.querySelectorAll("#sc1 .snum").forEach(s => {
    s.classList.remove("on");
  });

  // Hacer editables los campos de asignación (ns, ter, fec) para la nueva sesión
  setDemographicsEditable(true);

  // Cargar y renderizar preguntas dinámicas vacías
  renderQuestions();

  // Abrir editor
  document.getElementById("dashboard-section").style.display = "none";
  document.getElementById("wizard-section").style.display = "block";
  
  calcT();
  go(0);
  showToast(`Creando Sesión ${activeSession.ns} para ${activeSession.n1} & ${activeSession.n2}...`);
}

/**
 * Copia el prompt en portapapeles
 */
function copyAIPrompt() {
  const text = "Tengo lista la ficha de terapia de pareja de TeAcompaño. Con estos datos detallados, bríndame recomendaciones clínicas muy específicas, dinámicas de resolución de conflictos sugeridas y puntos clave para abordar en la próxima sesión:\n\n" + getSummaryAIPrompt();
  
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Prompt copiado en portapapeles. ¡Listo para pegar en la IA!");
  }).catch(err => {
    alert("No se pudo copiar de forma automática.");
  });
}

// ── EXPORTACIONES DESDE EDITOR ──
function downloadPDF() {
  syncFormToActiveSession();
  exportPDF(activeSession);
}

// ── EXPORTACIONES DESDE HISTORIAL ──
function downloadSinglePDF(id) {
  const session = sessions.find(s => s.id === id);
  if (session) exportPDF(session);
}

// ── COPIAS DE RESPALDO Y RESTAURACIÓN ──
function triggerDatabaseExport() {
  exportDatabase(verifiedPassword);
  showToast("📥 Copia de seguridad JSON descargada.");
}

function triggerImportClick() {
  document.getElementById("import-file").click();
}

async function handleImportJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (confirm("Importar este respaldo reemplazará los registros clínicos actuales. ¿Desea continuar?")) {
    try {
      const success = await importDatabase(file);
      if (success) {
        showToast("✅ Base de datos restaurada correctamente.");
        loadAdminDashboard();
      }
    } catch (error) {
      alert(`Error al importar respaldo: ${error.message}`);
    }
  }
  event.target.value = "";
}

async function triggerDatabaseClear() {
  if (confirm("⚠️ ¿Está seguro de que desea eliminar todos los registros de parejas? Esta acción no se puede deshacer y borrará todo el historial clínico.")) {
    if (confirm("🚨 ¿Confirmar eliminación completa de la base de datos?")) {
      try {
        const success = await clearAllSessions(verifiedPassword);
        if (success) {
          showToast("🗑️ Base de datos vaciada por completo.");
          loadAdminDashboard();
        }
      } catch (error) {
        alert(`Error al vaciar la base de datos: ${error.message}`);
      }
    }
  }
}

let currentShareSessionId = null;

// ── MODAL DE COMPARTIDO ──
function openShareModal(id = null) {
  currentShareSessionId = id;
  document.getElementById("share-modal").style.display = "flex";
  
  const coupleInput = document.getElementById("share-couple-name");
  const therapistInput = document.getElementById("share-therapist-name");
  const emailInput = document.getElementById("share-email");
  
  if (emailInput) emailInput.value = ""; // Limpiar por defecto
  
  if (id) {
    // Buscar la sesión
    const s = sessions.find(sess => sess.id === id);
    if (s) {
      if (coupleInput) coupleInput.value = `${s.n1} y ${s.n2}`;
      if (therapistInput && s.ter) therapistInput.value = s.ter;
    }
  } else {
    if (coupleInput) coupleInput.value = "";
    if (therapistInput && !therapistInput.value && sessions.length > 0) {
      const completed = sessions.filter(s => s.ter);
      if (completed.length > 0) {
        therapistInput.value = completed[0].ter;
      }
    }
  }
  
  updateShareLinks();
}

function closeShareModal() {
  document.getElementById("share-modal").style.display = "none";
}

/**
 * Genera el enlace dinámico y la vista previa del mensaje
 */
function updateShareLinks() {
  const couple = document.getElementById("share-couple-name").value.trim() || "{Nombre de la pareja}";
  const therapist = document.getElementById("share-therapist-name").value.trim() || "{Nombre del terapeuta}";
  
  // Calcular la URL pública del formulario (index.html en el mismo servidor) de manera robusta
  let baseLink = "";
  if (window.location.protocol === "file:") {
    baseLink = window.location.href.split("?")[0].replace("admin.html", "index.html");
  } else {
    const path = window.location.pathname;
    if (path.endsWith("/admin.html")) {
      baseLink = window.location.origin + path.replace("/admin.html", "/index.html");
    } else if (path.endsWith("/admin")) {
      baseLink = window.location.origin + path.substring(0, path.length - 6) + "/index.html";
    } else {
      baseLink = window.location.origin + path.replace("admin", "index");
    }
  }
  
  let textMessage = "";
  if (currentShareSessionId) {
    const s = sessions.find(sess => sess.id === currentShareSessionId);
    const ns = s ? s.ns : "X";
    const fullLink = `${baseLink}?id=${currentShareSessionId}`;
    textMessage = `Hola ${couple}!\n\nPara su Sesión N° ${ns} de terapia de pareja en Salud Mental 360 · TeAcompaño, por favor ingresen al siguiente enlace para responder a las preguntas de reflexión:\n🔗 ${fullLink}\n\nNos vemos pronto en la sesión.\nAtentamente,\n${therapist}`;
  } else {
    textMessage = `Hola ${couple}!\n\nPara nuestra sesión de terapia de pareja en Salud Mental 360 · TeAcompaño, por favor ingresen al siguiente enlace para completar su formulario de ingreso inicial:\n🔗 ${baseLink}\n\nNos vemos pronto en la sesión.\nAtentamente,\n${therapist}`;
  }
  
  document.getElementById("share-message-preview").textContent = textMessage;
}

/**
 * Abre la API de WhatsApp con el mensaje estructurado
 */
function shareViaWhatsApp() {
  const text = encodeURIComponent(document.getElementById("share-message-preview").textContent);
  const url = `https://api.whatsapp.com/send?text=${text}`;
  window.open(url, '_blank');
}

/**
 * Abre el gestor de correo predeterminado (mailto) con destinatario
 */
function shareViaEmail() {
  const emailInput = document.getElementById("share-email");
  const email = emailInput ? emailInput.value.trim() : "";
  const subject = encodeURIComponent("Cuestionario de Terapia de Pareja");
  const body = encodeURIComponent(document.getElementById("share-message-preview").textContent);
  
  const mailUrl = `mailto:${email}?subject=${subject}&body=${body}`;
  window.open(mailUrl, '_blank');
}

/**
 * Guardar sesión como Enviado y compartir enlace
 */
async function saveAndShareQuestions() {
  syncFormToActiveSession();
  
  if (!activeSession.n1 || !activeSession.n2) {
    alert("Faltan completar datos demográficos obligatorios (Nombres).");
    return;
  }

  if (checkDuplicateSession(activeSession)) {
    alert(`⚠️ La pareja ya tiene registrada una Sesión N° ${activeSession.ns}. Por favor, asigne otro número de sesión para evitar errores.`);
    return;
  }

  try {
    if (!activeSession.id) {
      activeSession.id = "session_" + Date.now();
    }
    
    // Forzar estado como Enviado
    activeSession.status = "Enviado";
    
    await saveSession(activeSession, verifiedPassword);
    
    // Recargar localmente
    sessions = await fetchAllSessions(verifiedPassword);
    
    showToast("Sesión guardada en estado Enviado.");
    
    // Cerrar editor y volver al dashboard
    document.getElementById("wizard-section").style.display = "none";
    document.getElementById("dashboard-section").style.display = "block";
    loadAdminDashboard();
    
    // Abrir modal de compartir
    openShareModal(activeSession.id);
  } catch (error) {
    alert("Error al guardar y compartir: " + error.message);
  }
}
