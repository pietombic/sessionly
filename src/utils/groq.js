const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
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
  "examApproach": "teorico|pratico|misto",
  "pages": <numero pagine o null>,
  "pdfCount": <numero pdf o null>,
  "topics": ["argomento1", "argomento2"],
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

Regole examApproach: esami con esercizi/lab/codice/problemi → pratico | solo teoria/orale → teorico | entrambi → misto

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
    examApproach: ['teorico', 'pratico', 'misto'].includes(parsed.examApproach) ? parsed.examApproach : null,
    pages: parsed.pages ? Number(parsed.pages) : null,
    pdfCount: parsed.pdfCount ? Number(parsed.pdfCount) : null,
    topics: Array.isArray(parsed.topics) ? parsed.topics.filter(Boolean) : [],
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

export async function generateSessionPlan(exams, preferences, includeStudyBlocks, studyPrefs) {
  const apiKey = getGroqKey();
  if (!apiKey) {
    const err = new Error('Chiave Groq non configurata.');
    err.code = 'NO_KEY';
    throw err;
  }

  const today = formatDateISO(new Date());

  const examSummaries = exams
    .filter((e) => e.components.some((c) => c.dates.some((d) => d.date)))
    .map((e) => {
      const comps = e.components
        .filter((c) => c.dates.some((d) => d.date))
        .map((c) => {
          const dates = c.dates
            .filter((d) => d.date)
            .map((d) => `${formatDateISO(d.date)}${d.locked ? ' [BLOCCATA]' : ''}`)
            .join(', ');
          return `  - ${c.name}: ${dates}`;
        })
        .join('\n');
      return `id: "${e.id}", nome: "${e.name}", effort: ${e.effort}/10, difficoltà: ${e.difficulty}/10\n${comps}`;
    })
    .join('\n\n');

  const studyBlocksRule = includeStudyBlocks
    ? `Per ogni piano includi finestre di studio ottimali. Regole: effort 7-10 → 10-15 giorni prima dell'esame, effort 4-6 → 5-9 giorni, effort 1-3 → 2-4 giorni. La finestra deve finire almeno 1 giorno prima dell'esame. Inizia le finestre da oggi (${today}) o successivamente.`
    : 'Non includere blocchi di studio (study_windows deve essere array vuoto []).';

  const prefsNote = studyPrefs
    ? `Preferenze studio dell'utente:
- Orari preferiti: ${[studyPrefs.morning && 'mattina (9-12)', studyPrefs.afternoon && 'pomeriggio (14-18)', studyPrefs.evening && 'sera (19-22)'].filter(Boolean).join(', ') || 'non specificati'}
- Durata sessione: ${studyPrefs.sessionHours} ore di studio consecutivo poi pausa
Tieni conto di questi orari nella label dei blocchi di studio (es. "Mattina: ripasso capitoli 1-4 · 2h").`
    : '';

  const systemPrompt = `Sei un assistente accademico esperto in pianificazione della sessione universitaria italiana.
Data di oggi: ${today}.

Proponi ESATTAMENTE 3 alternative di piano della sessione esami. Per ogni piano scegli UNA data specifica per ogni componente di ogni esame.
Regole scelta date:
- Date [BLOCCATA] → sempre scelte
- Rispetta le preferenze dell'utente sull'ordine
- Distribuisci gli esami nel tempo evitando sovrapposizioni
- Considera effort e difficoltà per l'ordinamento: esami più semplici prima se c'è poco tempo
- Per esami con approccio pratico/misto: includi tempo per esercizi e prove simulate nei blocchi di studio
- Per esami teorici: includi tempo per ripasso e consolidamento
- Le 3 alternative devono differire realmente nell'ordine e nella scelta delle date

${studyBlocksRule}
${prefsNote}

Rispondi SOLO con JSON valido, senza markdown.`;

  const userPrompt = `Esami disponibili:\n${examSummaries}\n\nPreferenze utente: "${preferences || 'Nessuna preferenza specifica'}"\n\nRestituisci:\n{"plans": [{"description": "breve razionale del piano", "date_picks": [{"examId": "...", "componentName": "...", "date": "YYYY-MM-DD"}], "study_windows": [{"examId": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "label": "..."}]}]}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
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
  const plans = parsed.plans || (Array.isArray(parsed) ? parsed : []);

  return plans.slice(0, 3).map((plan) => ({
    description: plan.description || '',
    date_picks: (plan.date_picks || []).map((p) => ({
      examId: p.examId,
      componentName: p.componentName,
      date: p.date,
    })),
    study_windows: (plan.study_windows || []).map((w) => ({
      examId: w.examId,
      start: w.start,
      end: w.end,
      label: w.label || 'Studio',
    })),
  }));
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

// ── Image → exams extraction (vision model) ──────────────────────────────────

function inferType(components) {
  const names = new Set((components || []).map((c) => c.name));
  if (names.has('Parziale 1') && names.has('Orale')) return 'parziali-orale';
  if (names.has('Parziale 1')) return 'parziali';
  if (names.has('Scritto') && names.has('Pratico') && names.has('Progetto')) return 'scritto-prat-pj';
  if (names.has('Scritto') && names.has('Pratico')) return 'scritto-prat';
  if (names.has('Scritto') && names.has('Orale')) return 'scritto-orale';
  if (names.has('Progetto') && names.has('Discussione')) return 'progetto';
  if (names.has('Scritto')) return 'scritto';
  if (names.has('Orale')) return 'orale';
  return 'scritto-orale';
}

function reviveExamDrafts(rawExams) {
  return rawExams.map((e, ei) => ({
    name: e.name || 'Esame senza nome',
    tag: e.tag || 'amber',
    effort: 5,
    difficulty: 5,
    priority: 'media',
    status: 'todo',
    notes: '',
    partial1Done: false,
    partial1Grade: 18,
    examApproach: null,
    pages: '',
    pdfCount: '',
    topics: '',
    type: inferType(e.components),
    components: (e.components || [{ name: 'Scritto', dates: [] }]).map((c) => ({
      name: c.name,
      dates: (c.dates || []).map((d, di) => ({
        id: `img_${ei}_${di}_${Date.now()}`,
        date: d.date ? new Date(d.date + 'T00:00:00') : null,
        time: d.time && d.time !== 'null' ? d.time : '',
        room: d.room && d.room !== 'null' ? d.room : '',
        locked: false,
      })),
    })),
  }));
}

// Accepts an array of { base64, mimeType } — all images sent in one request so the
// model can cross-reference between screenshots (e.g. infer missing month headers).
export async function extractExamsFromImages(images) {
  const apiKey = getGroqKey();
  if (!apiKey) {
    const err = new Error('Chiave Groq non configurata.');
    err.code = 'NO_KEY';
    throw err;
  }

  const today = formatDateISO(new Date());
  const currentYear = new Date().getFullYear();
  const n = images.length;

  const imageBlocks = images.map(({ base64, mimeType }) => ({
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${base64}` },
  }));

  const prompt = `Queste sono ${n} immagin${n === 1 ? 'e' : 'i'} di screenshot del calendario esami universitari italiani, potenzialmente dello stesso calendario visto in pagine o sezioni diverse.

═══ FASE 1 — ESTRAZIONE ═══
Ragiona su TUTTE le immagini insieme:
- Se lo stesso esame appare in più screenshot, unisci le informazioni — non duplicarlo.
- Se l'intestazione del mese manca in uno screenshot, usa il contesto delle altre immagini per dedurre le date corrette.
- Se una data appare incompleta (es. manca l'anno o il mese), inferiscila dal contesto visibile nelle altre immagini.

Data di oggi: ${today}. Se l'anno non è visibile né deducibile, usa ${currentYear} per date future, ${currentYear + 1} se già passate.

═══ FASE 2 — MAPPA LE COMPONENTI ═══
Il nome della componente nel JSON DEVE essere ESATTAMENTE uno di questi valori canonici:
  "Scritto" | "Orale" | "Pratico" | "Progetto" | "Discussione" | "Parziale 1" | "Parziale 2"

Regole di mappatura (esempi):
- "esame scritto", "esame totale", "prova scritta", "scritto LP", "totale LP", qualsiasi variante scritta → "Scritto"
- "esame orale", "orale LP", "prova orale", qualsiasi variante orale → "Orale"
- "laboratorio", "lab", "prova pratica" → "Pratico"
- "1° parziale", "primo parziale", "parziale 1", "I parziale" → "Parziale 1"
- "2° parziale", "secondo parziale", "parziale 2", "II parziale" → "Parziale 2"
- "progetto" → "Progetto"
- "discussione progetto", "discussione" → "Discussione"
NON usare mai nomi inventati o copiati dallo screenshot. Solo i valori canonici sopra.

═══ FASE 3 — DEDUPLICAZIONE ═══
Prima di restituire il JSON, ricontrolla l'elenco esami:
- Nomi simili o abbreviati dello stesso corso DEVONO essere uniti in un unico esame (es. "Calcolo di Probabilità e Statistica" e "Probabilità e Statistica" sono lo stesso esame).
- Mantieni il nome più completo e unisci tutte le date delle componenti.
- Verifica che non ci siano date duplicate all'interno della stessa componente.

Restituisci SOLO JSON valido senza markdown:
{"exams": [
  {
    "name": "Nome Esame completo",
    "tag": "amber|brick|sage|plum|teal|ochre|indigo",
    "components": [
      {
        "name": "Scritto|Orale|Pratico|Progetto|Discussione|Parziale 1|Parziale 2",
        "dates": [{"date": "YYYY-MM-DD", "time": "HH:MM o null", "room": "aula o null"}]
      }
    ]
  }
]}

Regole tag: informatica/reti → indigo o teal | matematica/fisica → amber o brick | scienze → sage | lingue → plum | economia → ochre | altro → amber`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageBlocks,
        ],
      }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Groq: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Risposta Groq vuota');

  const clean = content.replace(/```(?:json)?\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  const rawExams = parsed.exams || (Array.isArray(parsed) ? parsed : []);
  return reviveExamDrafts(rawExams);
}

// Single-image variant kept for backwards compatibility.
export async function extractExamsFromImage(base64, mimeType) {
  return extractExamsFromImages([{ base64, mimeType }]);
}

