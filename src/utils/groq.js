const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const LS_KEY = 'sessionly-groq-key';

export function getGroqKey() {
  return localStorage.getItem(LS_KEY) || import.meta.env.VITE_GROQ_API_KEY || null;
}

export function saveGroqKey(key) {
  if (key) localStorage.setItem(LS_KEY, key.trim());
  else localStorage.removeItem(LS_KEY);
}

export function hasGroqKey() {
  return !!getGroqKey();
}

function formatDateISO(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function firstExamDate(exam) {
  const all = exam.components
    .flatMap((c) => c.dates.map((d) => d.date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return all[0] || null;
}

export async function extractExamFromDescription(description) {
  const apiKey = getGroqKey();
  if (!apiKey) {
    const err = new Error('Chiave Groq non configurata.');
    err.code = 'NO_KEY';
    throw err;
  }

  const today = formatDateISO(new Date());
  const currentYear = new Date().getFullYear();

  const systemPrompt = `Sei un assistente che estrae informazioni su un esame universitario da una descrizione in italiano.
Data di oggi: ${today} (anno ${currentYear}).

Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "name": "Nome esame correttamente capitalizzato",
  "tag": "amber|brick|sage|plum|teal|ochre|indigo",
  "effort": <1-10>,
  "difficulty": <1-10>,
  "components": [
    {
      "name": "Scritto|Orale|Pratico|Progetto|Discussione|Parziale 1|Parziale 2",
      "dates": [{ "date": "YYYY-MM-DD", "time": "HH:MM o null", "room": "aula o null", "locked": false }]
    }
  ]
}

Regole effort (studio richiesto):
  tante slide / molto materiale → 7-8 | tantissimo → 9-10 | normale → 5 | poco → 2-3

Regole difficulty (difficoltà concettuale):
  abbastanza semplice / facile → 3-4 | normale → 5 | difficile/ostico → 7-8 | matematica pesante → 8-9

Regole date: se l'anno manca usa ${currentYear} se la data è futura, altrimenti ${currentYear + 1}.
  Distingui le date per componente. Includi orali condizionali.

Regole tag: informatica/reti → indigo o teal | matematica/fisica → amber o brick
  scienze → sage | lingue/lettere → plum | economia → ochre | generico → amber

Rispondi SOLO con JSON valido, zero markdown.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Descrizione: "${description}"` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Groq: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Risposta Groq vuota');

  const parsed = JSON.parse(content);

  return {
    ...parsed,
    effort: Math.min(10, Math.max(1, Math.round(parsed.effort ?? 5))),
    difficulty: Math.min(10, Math.max(1, Math.round(parsed.difficulty ?? 5))),
    components: (parsed.components || []).map((c) => ({
      name: c.name,
      dates: (c.dates || []).map((d) => ({
        date: d.date ? new Date(d.date + 'T00:00:00') : null,
        time: d.time && d.time !== 'null' ? d.time : '',
        room: d.room && d.room !== 'null' ? d.room : '',
        locked: !!d.locked,
      })),
    })),
  };
}

export async function generateStudyPlan(exams) {
  const apiKey = getGroqKey();
  if (!apiKey) {
    const err = new Error('Chiave Groq non configurata.');
    err.code = 'NO_KEY';
    throw err;
  }

  const examSummaries = exams
    .filter((e) => firstExamDate(e))
    .map((e) => {
      const dates = e.components
        .flatMap((c) =>
          c.dates
            .filter((d) => d.date)
            .map((d) => `${c.name}: ${formatDateISO(d.date)}${d.locked ? ' (BLOCCATA)' : ''}`)
        )
        .join(', ');
      return `- id: "${e.id}", nome: "${e.name}", effort: ${e.effort}/10, difficoltà: ${e.difficulty}/10, date: ${dates}`;
    })
    .join('\n');

  const today = formatDateISO(new Date());

  const systemPrompt = `Sei un assistente accademico esperto in pianificazione universitaria italiana.
Devi suggerire finestre di studio ottimali per ogni esame, in formato JSON.
Considera:
- Effort alto (7-10) → finestra lunga (10-15 giorni)
- Effort medio (4-6) → finestra media (5-9 giorni)
- Effort basso (1-3) → finestra breve (2-4 giorni)
- La finestra deve finire almeno 1 giorno prima della prima data dell'esame
- Non sovrapporre troppo le finestre degli esami più vicini temporalmente
- Inizia le finestre da oggi (${today}) o successivamente
Rispondi SOLO con un oggetto JSON valido, senza markdown.`;

  const userPrompt = `Esami da pianificare:\n${examSummaries}\n\nRestituisci un JSON nel formato:\n{"study_windows": [{"examId": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "label": "breve descrizione focus studio"}]}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Groq: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Risposta Groq vuota');

  const parsed = JSON.parse(content);
  const windows = parsed.study_windows || parsed.windows || (Array.isArray(parsed) ? parsed : []);

  return windows
    .filter((w) => w.examId && w.start && w.end)
    .map((w) => ({
      examId: w.examId,
      start: new Date(w.start + 'T00:00:00'),
      end: new Date(w.end + 'T00:00:00'),
      label: w.label || 'Studio',
    }));
}
