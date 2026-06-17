/**
 * app_public.js - Controlador del Formulario Público para Parejas (Pacientes)
 * Controla index.html con las secciones Pareja, Motivo y Sesión.
 */

let curStep = 0;
let activeSession = {
  n1: "", n2: "",
  a1: "", a2: "",
  rel: "", est: "", hij: "",
  ns: 1, fec: "", ter: "",
  m1: "", m2: "",
  areas: [],
  dur: "", prev: "", sc1: "",
  questions: [
    { q: "¿Qué esperan lograr activamente al asistir a esta terapia?", a: "" },
    { q: "¿Cuándo fue el último periodo en el que se sintieron felices en pareja?", a: "" },
    { q: "¿Cómo suelen reaccionar y manejar los desacuerdos o discusiones?", a: "" },
    { q: "¿Qué sienten que la otra persona no logra entender o valorar de ustedes?", a: "" },
    { q: "¿Qué aspectos positivos los mantiene unidos y valoran hoy de su relación?", a: "" }
  ],
  status: "Sin Respuesta"
};

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar base de datos híbrida (offline/online)
  await initDatabase();

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');

  if (sessionId) {
    // Modo de enlace de sesión único para la pareja
    // 1. Ocultar stepper, barra de progreso y otras secciones
    const stepper = document.getElementById("stepper");
    if (stepper) stepper.style.display = "none";
    
    const progTrack = document.querySelector(".progress-track");
    if (progTrack) progTrack.style.display = "none";
    
    const p0 = document.getElementById("p0");
    if (p0) p0.classList.remove("active");
    
    const p1 = document.getElementById("p1");
    if (p1) p1.classList.remove("active");
    
    const p2 = document.getElementById("p2");
    if (p2) p2.classList.add("active");
    
    const btnBack = document.getElementById("btn-back");
    if (btnBack) btnBack.style.display = "none";
    
    const defaultInfoBox = document.getElementById("default-info-box");
    if (defaultInfoBox) defaultInfoBox.style.display = "none";
    
    const addQuestionContainer = document.getElementById("add-question-container");
    if (addQuestionContainer) addQuestionContainer.style.display = "none";

    // Cambiar texto de cabecera si es posible
    const headerP = document.querySelector(".header-text p");
    if (headerP) headerP.textContent = "Por favor completen sus respuestas para la sesión clínica";

    // 2. Cargar datos de la sesión (Online / Offline Fallback)
    let sessionData = null;
    if (onlineMode) {
      try {
        const response = await fetch(`api/sessions?id=${sessionId}&_=${Date.now()}`);
        if (response.ok) {
          sessionData = await response.json();
        } else {
          console.error("Error al obtener la sesión pública.");
        }
      } catch (e) {
        console.warn("Fallo fetch online, intentando offline:", e);
      }
    }
    
    if (!sessionData) {
      const localData = localStorage.getItem('TEACOMPANO_SESSIONS');
      if (localData) {
        try {
          const list = JSON.parse(localData);
          sessionData = list.find(s => s.id === sessionId);
        } catch (e) {
          console.error("Error parseando LocalStorage:", e);
        }
      }
    }

    if (sessionData) {
      activeSession = { ...activeSession, ...sessionData };
      
      // Mostrar Banner de Bienvenida personalizado
      const welcomeBanner = document.getElementById("welcome-partner-banner");
      const welcomeText = document.getElementById("welcome-partner-text");
      if (welcomeBanner && welcomeText) {
        welcomeText.innerHTML = `Hola <strong>${sessionData.n1 || ''}</strong> y <strong>${sessionData.n2 || ''}</strong>, por favor respondan a las siguientes preguntas para su Sesión N° <strong>${sessionData.ns || 1}</strong> con <strong>${sessionData.ter || 'su terapeuta'}</strong>:`;
        welcomeBanner.style.display = "block";
      }
    } else {
      alert("Error: No se pudo encontrar la sesión con el enlace provisto.");
    }
  } else {
    // Comportamiento de registro normal
    // Fecha de hoy por defecto para la ficha
    const today = new Date().toISOString().split('T')[0];
    const fecInput = document.getElementById("fec");
    if (fecInput) fecInput.value = today;
  }

  // Renderizar preguntas
  renderQuestions();
});

/**
 * Muestra alertas visuales temporales (Toast)
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
 * Alterna la selección de etiquetas (tags)
 */
function tog(el) {
  el.classList.toggle("on");
}

/**
 * Selecciona un valor en la escala numérica de compromiso
 */
function scl(wrapperId, el) {
  document.querySelectorAll(`#${wrapperId} .snum`).forEach(s => s.classList.remove("on"));
  el.classList.add("on");
}

/**
 * Navegación entre pestañas del formulario del paciente
 * @param {number} stepIdx - Índice del paso (0 a 2).
 */
function go(stepIdx) {
  // Sincronizar datos de los inputs al objeto de datos
  syncFormToActiveSession();

  // Validaciones obligatorias de paso
  if (stepIdx > curStep) {
    if (curStep === 0 && (!activeSession.n1 || !activeSession.n2)) {
      alert("Por favor, ingresen el nombre de ambos integrantes de la pareja.");
      return;
    }
  }

  curStep = stepIdx;

  // Mostrar página correspondiente
  document.querySelectorAll(".page").forEach((page, i) => {
    page.classList.toggle("active", i === stepIdx);
  });

  // Actualizar stepper visual
  document.querySelectorAll(".step").forEach((step, i) => {
    step.classList.toggle("active", i === stepIdx);
    step.classList.toggle("done", i < stepIdx);
  });

  // Actualizar barra de progreso superior (basada en 3 pasos)
  const progWidth = ((stepIdx + 1) / 3 * 100);
  document.getElementById("prog").style.width = `${progWidth}%`;

  // Hacer scroll al inicio
  document.querySelector(".header").scrollIntoView({ behavior: 'smooth' });
}

/**
 * Recolecta la información de los inputs y la asocia al objeto activeSession
 */
function syncFormToActiveSession() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');

  // Si hay ID de sesión, NO sobreescribimos los campos demográficos ni motivos en el activeSession
  if (!sessionId) {
    const fields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij', 'ns', 'fec', 'ter', 
                    'm1', 'm2', 'dur', 'prev'];
    
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

    // Áreas de conflicto
    activeSession.areas = [...document.querySelectorAll("#areas .tag.on")].map(t => t.textContent.trim());

    // Escala de compromiso
    const selSnum = document.querySelector("#sc1 .snum.on");
    activeSession.sc1 = selSnum ? parseInt(selSnum.textContent.trim()) : "";
  }

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
 * Renderiza la lista de preguntas dinámicas en el contenedor
 */
function renderQuestions() {
  const container = document.getElementById("questions-container");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');
  const isSessionLink = !!sessionId;

  container.innerHTML = "";
  activeSession.questions.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "q-card";
    
    if (isSessionLink) {
      // Si es un link de sesión para la pareja, mostrar la pregunta como texto (no editable) y sin botón de eliminar
      card.innerHTML = `
        <div style="margin-bottom: 0.5rem;">
          <label style="font-weight: 600; font-size: 0.95rem; color: var(--sage-dark); font-family: var(--font-primary); display: block;">
            ${idx + 1}. ${item.q}
          </label>
          <input type="hidden" class="q-input" value="${item.q}">
        </div>
        <textarea class="q-textarea" placeholder="Escriban su respuesta aquí..." style="width: 100%; min-height: 100px;">${item.a || ''}</textarea>
      `;
    } else {
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 0.5rem;">
          <input type="text" class="q-input" value="${item.q}" placeholder="Escribe la pregunta..." style="font-weight: 600; width: 100%; border: none; border-bottom: 1px solid var(--border-color); background: transparent; padding: 4px 0; font-size: 0.95rem; color: var(--sage-dark); font-family: var(--font-body);">
          <button type="button" class="action-btn del" onclick="deleteQuestion(${idx})" title="Eliminar pregunta" style="background: none; border: none; color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 4px;">
            <i class="ti ti-trash"></i>
          </button>
        </div>
        <textarea class="q-textarea" placeholder="Escriban su respuesta aquí..." style="width: 100%; min-height: 80px;">${item.a || ''}</textarea>
      `;
    }
    container.appendChild(card);
  });
}

/**
 * Agrega una pregunta vacía al formulario
 */
function addQuestionField() {
  // Sincronizar primero para no perder cambios de lo escrito hasta ahora
  syncFormToActiveSession();
  activeSession.questions.push({ q: "", a: "" });
  renderQuestions();
}

/**
 * Elimina una pregunta por su índice
 */
function deleteQuestion(idx) {
  syncFormToActiveSession();
  activeSession.questions.splice(idx, 1);
  renderQuestions();
}

/**
 * Envía el formulario finalizado a la base de datos (Cloudflare KV o LocalStorage)
 */
async function submitPatientForm() {
  syncFormToActiveSession();

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');

  if (!sessionId && (!activeSession.n1 || !activeSession.n2)) {
    alert("Por favor, completen los nombres de ambos integrantes.");
    go(0);
    return;
  }

  try {
    if (sessionId) {
      if (onlineMode) {
        const response = await fetch('api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: sessionId,
            questions: activeSession.questions
          })
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Error al enviar respuestas.");
        }
      } else {
        // Modo offline
        const localData = localStorage.getItem('TEACOMPANO_SESSIONS');
        if (localData) {
          const list = JSON.parse(localData);
          const idx = list.findIndex(s => s.id === sessionId);
          if (idx !== -1) {
            list[idx].questions = activeSession.questions;
            list[idx].status = "Respuestas Completadas";
            localStorage.setItem('TEACOMPANO_SESSIONS', JSON.stringify(list));
          }
        }
      }
    } else {
      // Al registrarse por primera vez, el paciente ya responde las preguntas iniciales
      activeSession.status = "Respuestas Completadas";
      await saveSession(activeSession);
    }
    
    // Mostrar pantalla de éxito y limpiar
    showSuccessScreen();
  } catch (error) {
    alert("Hubo un problema al enviar sus datos: " + error.message);
  }
}

/**
 * Reemplaza el formulario con un mensaje de éxito estético
 */
function showSuccessScreen() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');
  const isSessionLink = !!sessionId;

  const wizard = document.getElementById("wizard-section");
  if (wizard) {
    wizard.innerHTML = `
      <div class="body-content" style="text-align: center; padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; animation: fadeIn 0.6s ease-out;">
        <div style="width: 80px; height: 80px; background-color: var(--success-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 2.5rem; box-shadow: var(--shadow-md);">
          <i class="ti ti-circle-check"></i>
        </div>
        <h2 style="font-family: var(--font-display); color: var(--sage-dark); font-size: 1.8rem; font-weight: 700;">¡Respuestas Enviadas con Éxito!</h2>
        <p style="color: var(--text-muted); max-width: 500px; font-size: 0.95rem; line-height: 1.6;">
          ${isSessionLink 
            ? "Muchas gracias por responder a las preguntas de esta sesión. Sus respuestas ya han sido enviadas a su terapeuta." 
            : "Gracias por completar sus datos iniciales. Su terapeuta ya tiene acceso a esta información para nuestra sesión de terapia de pareja."}
        </p>
        <div class="divider" style="width: 100%; max-width: 300px; margin: 1rem 0;"></div>
        <p style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">
          Salud Mental 360 · TeAcompaño Centro Psicológico
        </p>
      </div>
    `;
  }
}
