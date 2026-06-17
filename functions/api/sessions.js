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

  // 1. OBTENER SESIONES (GET) - Protegido
  if (method === "GET") {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== ADMIN_PASSWORD) {
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

  // 2. GUARDAR / ACTUALIZAR SESIÓN (POST) - Público para creación, protegido para edición
  if (method === "POST") {
    try {
      const body = await request.json();
      
      // Si se está editando una sesión existente (tiene ID), requerir autenticación
      if (body.id) {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== ADMIN_PASSWORD) {
          return new Response(
            JSON.stringify({ error: "No autorizado para editar registros clínicos." }),
            { status: 401, headers: corsHeaders }
          );
        }
      } else {
        // Generar un ID único para la nueva ficha clínica enviada por el paciente
        body.id = "session_" + Date.now();
        // Por defecto, lo enviado por el paciente está en estado "Pendiente"
        body.status = "Pendiente";
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
      await KV.delete(`session_${sessionId}`);
      return new Response(
        JSON.stringify({ success: true, message: `Sesión ${sessionId} eliminada.` }),
        { status: 200, headers: corsHeaders }
      );
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
