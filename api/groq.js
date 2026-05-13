import { createClient } from '@supabase/supabase-js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DAILY_LIMIT = 30;

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

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json(groqError('Non autenticato'));

  const sb = supabaseAdmin();
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json(groqError('Token non valido'));

  // ── Rate limit ────────────────────────────────────────────────────────────
  const { data: rl, error: rlErr } = await sb
    .rpc('check_and_increment_rate_limit', { p_user_id: user.id, p_limit: DAILY_LIMIT });

  if (!rlErr && rl?.length > 0 && !rl[0].allowed) {
    return res.status(429).json(
      groqError(
        `Hai raggiunto il limite giornaliero di ${DAILY_LIMIT} chiamate AI. Riprova domani oppure inserisci la tua chiave Groq in ⚙ Impostazioni per accesso illimitato.`,
        'RATE_LIMIT'
      )
    );
  }

  // ── Proxy to Groq ─────────────────────────────────────────────────────────
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json(groqError('Chiave Groq non configurata sul server'));

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await groqRes.json();
    return res.status(groqRes.ok ? 200 : groqRes.status).json(data);
  } catch (err) {
    console.error('[groq proxy]', err);
    return res.status(500).json(groqError('Errore nel contattare Groq'));
  }
}
