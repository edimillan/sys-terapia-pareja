/**
 * db.js - Conector híbrido de Base de Datos para Terapia de Pareja
 * Gestiona el almacenamiento local (LocalStorage) y la sincronización remota (Cloudflare KV API).
 */

const STORAGE_KEY = 'TEACOMPANO_SESSIONS';
let onlineMode = false;
let verifiedPassword = ""; // Se guarda la contraseña introducida por el admin

/**
 * Comprueba si la API de Cloudflare está disponible en la ruta relativa actual.
 * Si detecta un error de red (p. ej., abriendo con file://), se conmuta automáticamente a LocalStorage.
 */
async function checkOnlineState() {
  try {
    const response = await fetch('api/sessions', { method: 'OPTIONS' });
    // Si la respuesta es exitosa o da 401/405, la API existe
    onlineMode = true;
    console.log("Conectado a Cloudflare Pages API. Modo online habilitado.");
  } catch (error) {
    onlineMode = false;
    console.warn("No se pudo conectar a la API. Usando base de datos LocalStorage (Modo offline).");
  }
}

/**
 * Inicializa la base de datos de sesiones. Si está en modo offline y no hay datos en LocalStorage,
 * carga la plantilla por defecto.
 */
async function initDatabase() {
  await checkOnlineState();
  
  if (!onlineMode) {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (!localData) {
      const fallbackData = getFallbackData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
      console.log('Base de datos offline inicializada con datos de plantilla.');
      return fallbackData;
    }
    return JSON.parse(localData);
  }
  // En modo online, las consultas requerirán la contraseña administrativa, la cual se solicitará en el login.
  return [];
}

/**
 * Obtiene todas las sesiones.
 * @param {string} password - Contraseña administrativa (necesaria para el modo online).
 * @returns {Promise<Array>} Listado de sesiones clínicas.
 */
async function fetchAllSessions(password = "") {
  if (onlineMode) {
    const passToUse = password || verifiedPassword;
    const response = await fetch(`api/sessions?_=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Authorization': passToUse
      }
    });

    if (response.status === 401) {
      throw new Error("Clave de acceso incorrecta.");
    }
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al obtener las sesiones de la nube.");
    }
    
    verifiedPassword = passToUse; // Guardar contraseña válida en memoria
    return await response.json();
  } else {
    // Modo offline
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data).sort((a, b) => new Date(b.fec || 0) - new Date(a.fec || 0));
    } catch (e) {
      console.error('Error al parsear base de datos LocalStorage:', e);
      return [];
    }
  }
}

/**
 * Guarda una sesión clínica (crea o edita).
 * @param {object} sessionData - Datos del formulario.
 * @param {string} password - Contraseña del administrador (si se está editando en modo online).
 * @returns {Promise<object>} La sesión clínica guardada.
 */
async function saveSession(sessionData, password = "") {
  let updatedSession = { ...sessionData };

  if (onlineMode) {
    const passToUse = password || verifiedPassword;
    const response = await fetch('api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': passToUse
      },
      body: JSON.stringify(updatedSession)
    });

    if (response.status === 401) {
      throw new Error("Clave incorrecta. No tiene permisos para guardar.");
    }
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al guardar en Cloudflare KV.");
    }

    const result = await response.json();
    return result.session;
  } else {
    // Modo offline
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    if (updatedSession.id) {
      const idx = sessions.findIndex(s => s.id === updatedSession.id);
      if (idx !== -1) {
        sessions[idx] = updatedSession;
      } else {
        sessions.push(updatedSession);
      }
    } else {
      updatedSession.id = 'session_' + Date.now();
      updatedSession.status = 'Pendiente'; // Estado inicial para paciente
      sessions.push(updatedSession);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return updatedSession;
  }
}

/**
 * Elimina una sesión de la base de datos.
 * @param {string} id - ID de la sesión.
 * @param {string} password - Contraseña de administrador.
 * @returns {Promise<boolean>} True si la operación fue exitosa.
 */
async function deleteSession(id, password = "") {
  if (onlineMode) {
    const passToUse = password || verifiedPassword;
    const response = await fetch(`api/sessions?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': passToUse
      }
    });

    if (response.status === 401) {
      throw new Error("Clave incorrecta. Permiso de borrado denegado.");
    }
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al borrar la sesión.");
    }
    return true;
  } else {
    // Modo offline
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = sessions.filter(s => s.id !== id);
    if (sessions.length !== filtered.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    }
  }
}

/**
 * Elimina todos los registros de parejas de la base de datos.
 * @param {string} password - Contraseña de administrador.
 * @returns {Promise<boolean>} True si la operación fue exitosa.
 */
async function clearAllSessions(password = "") {
  if (onlineMode) {
    const passToUse = password || verifiedPassword;
    const response = await fetch('api/sessions?id=all', {
      method: 'DELETE',
      headers: {
        'Authorization': passToUse
      }
    });

    if (response.status === 401) {
      throw new Error("Clave incorrecta. Permiso de borrado denegado.");
    }
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al vaciar la base de datos.");
    }
    return true;
  } else {
    // Modo offline
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return true;
  }
}

/**
 * Exporta el volcado completo de la base de datos como archivo JSON (Copia de seguridad)
 */
async function exportDatabase(password = "") {
  try {
    const sessions = await fetchAllSessions(password);
    const jsonStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_FichasClinicas_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert("Error al exportar base de datos: " + error.message);
  }
}

/**
 * Importa y sobrescribe la base de datos actual con un archivo de respaldo.
 * @param {File} file - El archivo JSON cargado.
 * @returns {Promise<boolean>}
 */
async function importDatabase(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) {
          reject(new Error("Formato inválido. Debe ser una lista JSON de sesiones."));
          return;
        }

        if (onlineMode) {
          // Si estamos online, subimos cada sesión una por una a Cloudflare KV
          let successCount = 0;
          for (const sess of importedData) {
            await saveSession(sess, verifiedPassword);
            successCount++;
          }
          console.log(`Sincronizadas ${successCount} sesiones importadas en la nube.`);
          resolve(true);
        } else {
          // Si estamos offline, sobrescribimos LocalStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData));
          resolve(true);
        }
      } catch (err) {
        reject(new Error("Error al procesar la importación: " + err.message));
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Helper con los datos de plantilla para inicialización local (offline)
 */
function getFallbackData() {
  return [
    {
      "id": "session_1718567200000",
      "n1": "Carlos Mendoza",
      "n2": "Mariana Gómez",
      "a1": 34,
      "a2": 31,
      "rel": "5 años (Casados)",
      "est": "Casados",
      "hij": "Sí, 1",
      "ns": 1,
      "fec": "2026-06-16",
      "ter": "Psic. Sofía Ramírez",
      "m1": "Siento que la comunicación se ha roto por completo. Todo termina en discusión y ya no compartimos tiempo de calidad juntos.",
      "m2": "Siento que él está siempre a la defensiva y enfocado en su trabajo. Cuando intento hablar de lo que siento, evade la conversación.",
      "areas": ["Comunicación", "Distancia emocional", "Roles en el hogar"],
      "dur": "6-12 meses",
      "prev": "No",
      "sc1": 8,
      "q1": "Restablecer un canal de comunicación respetuoso y volver a conectar emocionalmente como al principio de la relación.",
      "q2": "Hace aproximadamente un año, durante nuestras últimas vacaciones de verano, donde pudimos conversar tranquilos y relajarnos.",
      "q3": "Carlos tiende a retirarse (evasión) mientras que Mariana insiste en hablar inmediatamente, lo que eleva el tono y genera discusiones de tono elevado.",
      "q4": "Mariana siente que Carlos no comprende el estrés que le genera llevar la mayor parte de las tareas del hogar además de su trabajo.",
      "q5": "El amor mutuo que aún se tienen, el compromiso por su hijo de 3 años y el deseo compartido de no disolver la familia.",
      "enf": ["Gottman", "Terapia Focalizada en Emociones (EFT)"],
      "obs": "Se observa una dinámica de perseguidor-distanciador muy marcada. Mariana muestra frustración con reclamos y crítica, mientras que Carlos se desconecta y responde con defensividad. Hay contacto visual intermitente pero ambos cooperan en la sesión.",
      "tar": "Ejercicio de 'La Hora del Diálogo' (15 minutos al día, sin pantallas, usando turnos de habla de 3 minutos sin interrumpirse ni juzgarse).",
      "dtot": 60,
      "hi": "10:00",
      "t1": 10,
      "t2": 20,
      "t3": 20,
      "t4": 10,
      "prox": "2026-06-23",
      "frec": "Semanal",
      "status": "Completado"
    },
    {
      "id": "session_1718570800000",
      "n1": "Alejandro Ruiz",
      "n2": "Gabriela Silva",
      "a1": 42,
      "a2": 39,
      "rel": "12 años (Convivientes)",
      "est": "Convivientes",
      "hij": "Sí, 2",
      "ns": 4,
      "fec": "2026-06-15",
      "ter": "Psic. Sofía Ramírez",
      "m1": "Estamos tratando de reconstruir la confianza luego de un periodo muy difícil el año pasado. Ha habido mentiras financieras.",
      "m2": "Sé que cometí un error al ocultar deudas, pero siento que el castigo es eterno y ya no sé cómo demostrar mi arrepentimiento.",
      "areas": ["Economía", "Infidelidad", "Celos"],
      "dur": "1-3 años",
      "prev": "Sí, individual",
      "sc1": 7,
      "q1": "Superar el resentimiento de la traición y establecer acuerdos financieros transparentes.",
      "q2": "Hace dos años, antes de que se descubriera el problema financiero, cuando compramos nuestro automóvil juntos.",
      "q3": "Alejandro fiscaliza y cuestiona constantemente los gastos, lo que provoca que Gabriela se sientan acorralada y tienda a mentir u ocultar cosas por temor a su reacción.",
      "q4": "Gabriela siente que Alejandro no valora su esfuerzo diario por cambiar y mantener el orden familiar.",
      "q5": "La historia compartida de 12 años, el bienestar de sus dos hijos en común y la convicción de que todavía pueden ser felices juntos.",
      "enf": ["TCC de Pareja", "Sistémico familiar"],
      "obs": "Alejandro presenta una postura rígida, con dificultad para flexibilizar el perdón. Gabriela muestra alta ansiedad y sumisión reactiva. En esta sesión se logró establecer un acuerdo mínimo de cuenta compartida para gastos de la casa.",
      "tar": "Diseño conjunto de un presupuesto mensual de gastos familiares con roles bien definidos y una cuenta de ahorros transparente.",
      "dtot": 60,
      "hi": "16:30",
      "t1": 12,
      "t2": 18,
      "t3": 20,
      "t4": 10,
      "prox": "2026-06-29",
      "frec": "Quincenal",
      "status": "Completado"
    },
    {
      "id": "session_1718581600000",
      "n1": "Mateo Pérez",
      "n2": "Valeria Rojas",
      "a1": 28,
      "a2": 27,
      "rel": "3 años (Novios)",
      "est": "Novios",
      "hij": "No",
      "ns": 1,
      "fec": "2026-06-17",
      "ter": "Psic. Sofía Ramírez",
      "m1": "Me siento presionado a dar el siguiente paso (matrimonio). Pienso que todavía somos jóvenes y debemos consolidar nuestras carreras profesionales antes de casarnos.",
      "m2": "Siento que Mateo evade los compromisos a largo plazo. Siempre que intento conversar sobre planes de boda, cambia de tema o se irrita.",
      "areas": ["Comunicación", "Otro"],
      "dur": "3–6 meses",
      "prev": "No",
      "sc1": 6,
      "q1": "Saber si realmente tenemos un proyecto de vida compatible y si queremos caminar hacia el mismo destino.",
      "q2": "Hace unos seis meses, cuando nos mudamos a vivir juntos en nuestro primer departamento alquilado.",
      "q3": "Evadimos el tema por días, hasta que Valeria explota en reclamos y Mateo sale a caminar solo para evitar discutir.",
      "q4": "Valeria siente que Mateo no comprende su necesidad de seguridad y proyección familiar. Mateo siente que Valeria no valora su esfuerzo por dar estabilidad actual.",
      "q5": "La gran amistad y complicidad que tenemos, el sentido del humor compartido y la atracción física.",
      "status": "Pendiente"
    },
    {
      "id": "session_1718591200000",
      "n1": "Javier Ortega",
      "n2": "Elena Fuentes",
      "a1": 45,
      "a2": 46,
      "rel": "15 años (Casados)",
      "est": "Casados",
      "hij": "Sí, 3 o más",
      "ns": 8,
      "fec": "2026-06-10",
      "ter": "Psic. Sofía Ramírez",
      "m1": "Las discrepancias sobre las normas y disciplina de nuestros hijos adolescentes nos están destruyendo como pareja. Ya no somos un frente unido.",
      "m2": "Javier es demasiado rígido e impositivo con los chicos. Cuando intento mediar, se enoja conmigo y dice que desautorizo su palabra.",
      "areas": ["Crianza", "Comunicación", "Roles en el hogar"],
      "dur": "1-3 años",
      "prev": "Sí, como pareja",
      "sc1": 9,
      "q1": "Coordinar acuerdos claros de crianza y recuperar la intimidad y tiempo de pareja que hemos perdido por la rutina.",
      "q2": "Hace tres años, cuando hicimos un viaje corto solos por nuestro anniversary número doce.",
      "q3": "Discutimos frente a los hijos, lo que rompe la autoridad, o nos ignoramos durante días aplicando la ley del hielo.",
      "q4": "Elena siente que Javier no ve el agotamiento de lidiar con los chicos todo el día. Javier siente que Elena es demasiado permisiva y debilita las reglas básicas.",
      "q5": "El profundo respeto mutuo, el amor inquebrantable por nuestros tres hijos y el compromiso de sostener nuestro hogar.",
      "enf": ["Sistémico familiar", "Gottman"],
      "obs": "Se evidencia triangulación de los hijos en los conflictos conyugales. Se trabaja la reinstauración de la frontera conyugal frente a la filial. Ambos muestran alto nivel de compromiso, aunque con patrones arraigados de frustración.",
      "tar": "Establecer una 'reunión de padres' los domingos (30 min) a solas para acordar límites de la semana. Prohibido discutir normas frente a los hijos.",
      "dtot": 60,
      "hi": "18:00",
      "t1": 10,
      "t2": 15,
      "t3": 25,
      "t4": 10,
      "prox": "2026-06-24",
      "frec": "Quincenal",
      "status": "Completado"
    },
    {
      "id": "session_1718600800000",
      "n1": "Ricardo Castro",
      "n2": "Daniela Soto",
      "a1": 37,
      "a2": 35,
      "rel": "7 años (Convivientes)",
      "est": "Convivientes",
      "hij": "Sí, 2",
      "ns": 2,
      "fec": "2026-06-08",
      "ter": "Psic. Sofía Ramírez",
      "m1": "La economía del hogar y las deudas individuales están generando demasiada tensión. Siento que aporto más y no se valora.",
      "m2": "Ricardo maneja el dinero de forma muy controladora. Siento que debo pedirle permiso para cada gasto básico de los niños.",
      "areas": ["Economía", "Comunicación", "Roles en el hogar"],
      "dur": "6-12 meses",
      "prev": "No",
      "sc1": 8,
      "q1": "Transparentar las finanzas comunes y repartir las responsabilidades del hogar equitativamente.",
      "q2": "Hace un año, antes de comprar la casa y adquirir la hipoteca actual.",
      "q3": "Ricardo hace comentarios sarcásticos sobre los gastos, Daniela se siente herida, se retira y se niega a hablar por horas.",
      "q4": "Daniela siente que Ricardo la ve como una carga económica. Ricardo siente que toda la presión financiera recae sobre sus hombros.",
      "q5": "El deseo mutuo de construir un patrimonio para nuestros dos hijos pequeños y el amor que nos une desde jóvenes.",
      "enf": ["TCC de Pareja"],
      "obs": "Dinámica de control-sumisión reactiva por temas económicos. En la sesión se pacta estructurar una hoja de gastos clara. Mejoró el nivel de escucha respecto a la sesión anterior.",
      "tar": "Creación de un presupuesto excel compartido. Daniela anotará los gastos familiares comunes del mes y se revisarán juntos sin juzgar.",
      "dtot": 60,
      "hi": "12:00",
      "t1": 8,
      "t2": 22,
      "t3": 20,
      "t4": 10,
      "prox": "2026-06-22",
      "frec": "Quincenal",
      "status": "Completado"
    }
  ];
}
