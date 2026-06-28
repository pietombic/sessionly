import { createClient } from '@supabase/supabase-js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DAILY_LIMIT = 30;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const ALLOWED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]);

function supabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function groqError(message, code) {
  return { error: { message, code } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(groqError('Method not allowed'));
  }

  const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  if (bodySize > MAX_BODY_BYTES) {
    return res.status(413).json(groqError('Richiesta troppo grande'));
  }
  if (!ALLOWED_MODELS.has(req.body?.model)) {
    return res.status(400).json(groqError('Modello non consentito'));
  }
  if (!Array.isArray(req.body?.messages) || req.body.messages.length === 0 || req.body.messages.length > 20) {
    return res.status(400).json(groqError('Messaggi non validi'));
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json(groqError('Non autenticato'));

  const sb = supabaseAdmin();
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json(groqError('Token non valido'));

  // ── Rate limit ────────────────────────────────────────────────────────────
  const { data: rl, error: rlErr } = await sb
    .rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_limit: DAILY_LIMIT });

  if (rlErr || !rl?.length) {
    return res.status(503).json(groqError('Controllo del limite temporaneamente non disponibile'));
  }

  if (!rl[0].allowed) {
    return res.status(429).json(
      groqError(
        `Hai raggiunto il limite giornaliero di ${DAILY_LIMIT} chiamate AI. Riprova domani oppure inserisci la tua chiave Groq nelle Impostazioni per accesso illimitato.`,
        'RATE_LIMIT'
      )
    );
  }

  // ── Proxy to Groq ─────────────────────────────────────────────────────────
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json(groqError('Chiave Groq non configurata sul server'));

  try {
    const safeBody = {
      model: req.body.model,
      messages: req.body.messages,
      temperature: Math.max(0, Math.min(1, Number(req.body.temperature ?? 0.2))),
      max_tokens: Math.max(1, Math.min(4096, Number(req.body.max_tokens ?? 4096))),
      ...(req.body.response_format?.type === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    };
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify(safeBody),
    });

    const data = await groqRes.json();
    return res.status(groqRes.ok ? 200 : groqRes.status).json(data);
  } catch (err) {
    console.error('[groq proxy]', err);
    return res.status(500).json(groqError('Errore nel contattare Groq'));
  }
}
