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
  q1: "", q2: "", q3: "", q4: "", q5: "",
  status: "Pendiente"
};

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar base de datos híbrida (offline/online)
  await initDatabase();

  // Fecha de hoy por defecto para la ficha
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("fec").value = today;
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
  const fields = ['n1', 'n2', 'a1', 'a2', 'rel', 'est', 'hij', 'ns', 'fec', 'ter', 
                  'm1', 'm2', 'dur', 'prev', 'q1', 'q2', 'q3', 'q4', 'q5'];
  
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

/**
 * Envía el formulario finalizado a la base de datos (Cloudflare KV o LocalStorage)
 */
async function submitPatientForm() {
  syncFormToActiveSession();

  if (!activeSession.n1 || !activeSession.n2) {
    alert("Por favor, completen los nombres de ambos integrantes.");
    go(0);
    return;
  }

  try {
    // Forzar el estado en "Pendiente" al enviar por el paciente
    activeSession.status = "Pendiente";
    
    // Guardar en la base de datos (conmuta automáticamente a LocalStorage si está offline)
    await saveSession(activeSession);
    
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
  const wizard = document.getElementById("wizard-section");
  if (wizard) {
    wizard.innerHTML = `
      <div class="body-content" style="text-align: center; padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; animation: fadeIn 0.6s ease-out;">
        <div style="width: 80px; height: 80px; background-color: var(--success-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 2.5rem; box-shadow: var(--shadow-md);">
          <i class="ti ti-circle-check"></i>
        </div>
        <h2 style="font-family: var(--font-display); color: var(--sage-dark); font-size: 1.8rem; font-weight: 700;">¡Formulario Enviado con Éxito!</h2>
        <p style="color: var(--text-muted); max-width: 500px; font-size: 0.95rem; line-height: 1.6;">
          Gracias por completar sus datos iniciales. Su terapeuta ya tiene acceso a esta información para nuestra sesión de terapia de pareja.
        </p>
        <div class="divider" style="width: 100%; max-width: 300px; margin: 1rem 0;"></div>
        <p style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">
          Salud Mental 360 · TeAcompaño Centro Psicológico
        </p>
      </div>
    `;
  }
}
