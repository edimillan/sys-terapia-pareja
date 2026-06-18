/**
 * functions/api/sessions.js - Cloudflare Pages Function
 * API Endpoint para gestionar las sesiones clínicas en la nube usando Cloudflare KV.
 */

// Clave administrativa por defecto para operaciones protegidas
const ADMIN_PASSWORD = "admin123";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const KV = env.SESSIONS_KV;

  // Encabezados de CORS para pruebas locales si son necesarias
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8"
  };

  // Responder a peticiones preflight OPTIONS
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Si no está configurada la base de datos KV en Cloudflare
  if (!KV) {
    return new Response(
      JSON.stringify({ error: "SESSIONS_KV is not bound to this Cloudflare Pages deployment." }),
      { status: 500, headers: corsHeaders }
    );
  }

  // 1. OBTENER SESIONES (GET) - Protegido para listado, público para ID específico (filtrado)
  if (method === "GET") {
    const authHeader = request.headers.get("Authorization");
    const sessionId = url.searchParams.get("id");
    const isAdmin = authHeader === ADMIN_PASSWORD;

    // A. Consultar una sesión específica por ID (Pública o de Admin)
    if (sessionId) {
      try {
        const val = await KV.get(`session_${sessionId}`);
        if (!val) {
          return new Response(
            JSON.stringify({ error: "Sesión no encontrada." }),
            { status: 404, headers: corsHeaders }
          );
        }
        
        const session = JSON.parse(val);
        
        if (isAdmin) {
          // Si es admin, retornar la sesión completa
          return new Response(JSON.stringify(session), { status: 200, headers: corsHeaders });
        } else {
          // Si es público (pareja), sanitizar para ocultar notas privadas del terapeuta
          const sanitized = {
            id: session.id,
            n1: session.n1,
            n2: session.n2,
            ns: session.ns,
            fec: session.fec,
            ter: session.ter,
            questions: session.questions && session.questions.length > 0 ? session.questions : [
              { q: "¿Qué esperan lograr activamente al venir a terapia?", a: session.q1 || "" },
              { q: "¿Cuándo fue el último periodo donde se sintieron bien en pareja?", a: session.q2 || "" },
              { q: "¿Cómo suelen manejar el conflicto? (¿Quién persigue y quién se distancia?)", a: session.q3 || "" },
              { q: "¿Qué sienten que la otra persona no logra entender de ustedes?", a: session.q4 || "" },
              { q: "¿Qué cosas positivas los mantienen unidos aún hoy?", a: session.q5 || "" }
            ],
            status: session.status
          };
          return new Response(JSON.stringify(sanitized), { status: 200, headers: corsHeaders });
        }
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Error al leer sesión: " + err.message }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // B. Listar todas las sesiones (Solo Admin)
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "No autorizado. Ingrese la clave administrativa correcta." }),
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      // Listar todas las claves con el prefijo "session_"
      const list = await KV.list({ prefix: "session_" });
      const sessions = [];
      
      // Obtener el valor de cada clave de manera concurrente
      const promises = list.keys.map(async (key) => {
        const val = await KV.get(key.name);
        if (val) {
          try {
            sessions.push(JSON.parse(val));
          } catch (e) {
            console.error("Error parseando registro KV:", key.name);
          }
        }
      });
      
      await Promise.all(promises);
      
      // Ordenar por fecha descendente
      sessions.sort((a, b) => new Date(b.fec || 0) - new Date(a.fec || 0));

      return new Response(JSON.stringify(sessions), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Error al leer base de datos KV: " + err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // 2. GUARDAR / ACTUALIZAR SESIÓN (POST) - Público para creación, protegido para edición (excepto respuestas de pareja)
  if (method === "POST") {
    try {
      const body = await request.json();
      const authHeader = request.headers.get("Authorization");
      const isAdmin = authHeader === ADMIN_PASSWORD;

      if (!body.id) {
        // Generar un ID único para la nueva ficha clínica
        body.id = "session_" + Date.now();
        // Si no es el administrador (es un paciente), forzar el estado en "Nuevo Registro" y guardar fecha
        if (!isAdmin) {
          body.status = "Nuevo Registro";
          const date = new Date();
          const offsetDate = new Date(date.getTime() - (5 * 60 * 60 * 1000)); // GMT-5
          const pad = (n) => n.toString().padStart(2, '0');
          body.fec_envio = `${pad(offsetDate.getUTCDate())}/${pad(offsetDate.getUTCMonth()+1)}/${offsetDate.getUTCFullYear()} ${pad(offsetDate.getUTCHours())}:${pad(offsetDate.getUTCMinutes())} hs`;
        }
      } else {
        // Si se está editando una sesión existente (tiene ID)
        if (!isAdmin) {
          // ¡PACIENTE RESPONDIENDO SUS PREGUNTAS!
          // Leemos la sesión existente en KV para no perder observaciones o datos clínicos
          const val = await KV.get(`session_${body.id}`);
          if (!val) {
            return new Response(
              JSON.stringify({ error: "Sesión no encontrada para actualizar." }),
              { status: 404, headers: corsHeaders }
            );
          }
          const existing = JSON.parse(val);

          // Mezclar: Mantener lo que el terapeuta ya rellenó, pero actualizar las respuestas
          existing.questions = body.questions;
          // Actualizar estado a "Resuelto" al ser enviado por el paciente
          existing.status = "Resuelto";
          
          // Registrar fecha y hora de recepción
          const date = new Date();
          const offsetDate = new Date(date.getTime() - (5 * 60 * 60 * 1000)); // GMT-5
          const pad = (n) => n.toString().padStart(2, '0');
          existing.fec_envio = `${pad(offsetDate.getUTCDate())}/${pad(offsetDate.getUTCMonth()+1)}/${offsetDate.getUTCFullYear()} ${pad(offsetDate.getUTCHours())}:${pad(offsetDate.getUTCMinutes())} hs`;

          // Usar el registro mezclado para guardar
          await KV.put(`session_${existing.id}`, JSON.stringify(existing));

          return new Response(
            JSON.stringify({ success: true, session: existing }),
            { status: 200, headers: corsHeaders }
          );
        }
      }

      // Validar duplicidad de ns (número de sesión) para la misma pareja
      const n1 = (body.n1 || '').toLowerCase().trim();
      const n2 = (body.n2 || '').toLowerCase().trim();
      const ns = parseInt(body.ns) || 0;

      if (n1 && n2 && ns > 0) {
        const list = await KV.list({ prefix: "session_" });
        for (const key of list.keys) {
          if (key.name === `session_${body.id}`) continue;
          const val = await KV.get(key.name);
          if (val) {
            try {
              const s = JSON.parse(val);
              if (s.id !== body.id) {
                const s1 = (s.n1 || '').toLowerCase().trim();
                const s2 = (s.n2 || '').toLowerCase().trim();
                const sameCouple = (s1 === n1 && s2 === n2) || (s1 === n2 && s2 === n1);
                if (sameCouple && parseInt(s.ns) === ns) {
                  return new Response(
                    JSON.stringify({ error: `La pareja ya tiene registrada una Sesión N° ${ns}. Por favor, asigne otro número de sesión para evitar errores.` }),
                    { status: 400, headers: corsHeaders }
                  );
                }
              }
            } catch (e) {}
          }
        }
      }

      // Guardar en la base de datos KV de Cloudflare (clave: session_<id>)
      await KV.put(`session_${body.id}`, JSON.stringify(body));

      return new Response(
        JSON.stringify({ success: true, session: body }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Error al guardar sesión: " + err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // 3. ELIMINAR SESIÓN (DELETE) - Protegido
  if (method === "DELETE") {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "No autorizado." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const sessionId = url.searchParams.get("id");
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "ID de sesión faltante." }),
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      if (sessionId === "all") {
        const list = await KV.list({ prefix: "session_" });
        const deletePromises = list.keys.map(key => KV.delete(key.name));
        await Promise.all(deletePromises);
        return new Response(
          JSON.stringify({ success: true, message: "Todos los registros eliminados." }),
          { status: 200, headers: corsHeaders }
        );
      } else {
        await KV.delete(`session_${sessionId}`);
        return new Response(
          JSON.stringify({ success: true, message: `Sesión ${sessionId} eliminada.` }),
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Error al eliminar sesión: " + err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Método no soportado
  return new Response(
    JSON.stringify({ error: `Method ${method} Not Allowed` }),
    { status: 405, headers: corsHeaders }
  );
}
