const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PROXY_URL = '/api/groq';
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
  return true; // proxy always available; user key is optional for unlimited access
}

import { supabase } from '../lib/supabase.js';

async function getSessionToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Single fetch helper: uses user's own key if set, otherwise goes through server proxy.
async function groqFetch(body) {
  const userKey = getGroqKey();

  if (userKey) {
    return fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userKey}` },
      body: JSON.stringify(body),
    });
  }

  const token = await getSessionToken();
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  // Surface rate-limit errors with a specific code so callers can handle them
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error?.message || 'Limite giornaliero raggiunto');
    err.code = data?.error?.code || 'RATE_LIMIT';
    throw err;
  }

  return res;
}

function formatDateISO(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function extractExamFromDescription(description) {
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
      "dates": [{ "date": "YYYY-MM-DD", "time": "HH:MM o null", "room": "aula o null", "locked": false, "preference": "alternative" }]
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

  const response = await groqFetch({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Descrizione: "${description}"` },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
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
        preference: ['preferred', 'alternative', 'excluded'].includes(d.preference)
          ? d.preference
          : 'alternative',
      })),
    })),
  };
}

export async function generateSessionPlan(exams, preferences, includeStudyBlocks, studyPrefs) {
  const today = formatDateISO(new Date());
  const currentYear = new Date().getFullYear();
  const todayTime = new Date(today + 'T00:00:00').getTime();

  // Un nuovo piano considera solo appelli da oggi in avanti. Le date storiche
  // restano salvate nell'esame, ma non vengono inviate al modello.
  const validExams = exams
    .filter((e) => !['done', 'failed', 'saltato'].includes(e.status))
    .map((e) => ({
      ...e,
      components: e.components
        .map((c) => ({
          ...c,
          dates: c.dates.filter((d) =>
            d.date
            && d.preference !== 'excluded'
            && new Date(formatDateISO(d.date) + 'T00:00:00').getTime() >= todayTime
          ),
        }))
        .filter((c) => c.dates.length > 0),
    }))
    .filter((e) => e.components.length > 0);

  if (validExams.length === 0) {
    throw new Error('Nessun esame con date disponibili per generare un piano.');
  }

  const examSummaries = validExams
    .map((e) => {
      const comps = e.components
        .filter((c) => c.dates.some((d) => d.date))
        .map((c) => {
          const dates = c.dates
            .filter((d) => d.date)
            .map((d) => {
              const iso = formatDateISO(d.date);
              const flags = [
                d.locked ? '[BLOCCATA]' : '',
                d.preference === 'preferred' ? '[PREFERITA]' : '',
                d.time   ? `ore ${d.time}` : '',
                d.room   ? `aula ${d.room}` : '',
              ].filter(Boolean).join(' ');
              return flags ? `${iso} ${flags}` : iso;
            })
            .join(' | ');
          return `  - ${c.name}: ${dates}`;
        })
        .join('\n');

      return [
        `id: "${e.id}"`,
        `nome: "${e.name}"`,
        `effort: ${e.effort}/10`,
        `difficoltà: ${e.difficulty}/10`,
        `ore rimanenti: ${
          Number(e.remainingHours || 0)
          || e.topicItems?.filter((topic) => topic.status !== 'ready')
            .reduce((sum, topic) => sum + Number(topic.estimatedHours || 0), 0)
          || 'non stimate'
        }`,
        `preparazione attuale: ${e.preparationPercent ?? 0}%`,
        `obiettivo: ${e.targetGrade || 'superare'}`,
        `priorità personale: ${e.priority || 'media'}`,
        `buffer richiesto: ${e.reviewBufferDays ?? 1} giorni`,
        `momento preferito: ${e.preferredTime || 'indifferente'}`,
        `durata blocchi preferita: ${e.preferredBlockLength || 'media'}`,
        `dipendenza prove: ${e.componentDependency || 'indipendenti'}`,
        `approccio: ${e.examApproach ?? 'non specificato'}`,
        `argomenti: ${
          e.topicItems?.length
            ? e.topicItems.map((topic) =>
                `${topic.name} [${topic.status || 'todo'}, importanza ${topic.importance || 'normal'}, difficoltà ${topic.difficulty || 5}/10, ${topic.estimatedHours || '?'}h]`
              ).join('; ')
            : 'non specificati'
        }`,
        `materiale mancante: ${e.missingMaterial || 'nessuno indicato'}`,
        `tentativi precedenti: ${e.attemptHistory?.count || 0}; problemi: ${e.attemptHistory?.issues || 'non indicati'}`,
        comps,
      ].join('\n');
    })
    .join('\n\n');

  // ── Fasce orarie ───────────────────────────────────────────────────────────
  const DEFAULT_SLOT = { label: 'mattina', start: '09:00', end: '11:00' };

  // Supporta sia il vecchio schema (morning/afternoon/evening) sia il nuovo (studySlots)
  let activeSlots;
  if (studyPrefs?.studySlots) {
    activeSlots = studyPrefs.studySlots
      .filter((s) => s.enabled)
      .map((s) => ({
        label: (() => {
          const h = parseInt(s.start.split(':')[0], 10);
          if (h < 12) return 'mattina';
          if (h < 17) return 'pomeriggio';
          return 'sera';
        })(),
        start: s.start,
        end: s.end,
      }));
    if (activeSlots.length === 0) activeSlots = [DEFAULT_SLOT];
  } else {
    const slots = studyPrefs
      ? [
          studyPrefs.morning   && { label: 'mattina',    start: '09:00', end: '12:00' },
          studyPrefs.afternoon && { label: 'pomeriggio', start: '14:00', end: '18:00' },
          studyPrefs.evening   && { label: 'sera',       start: '19:00', end: '22:00' },
        ].filter(Boolean)
      : [DEFAULT_SLOT];
    activeSlots = slots.length > 0 ? slots : [DEFAULT_SLOT];
  }

  const slotDesc = activeSlots.map((s) => `${s.label} (${s.start}–${s.end})`).join(', ');

  // ── Giorni e intensità ────────────────────────────────────────────────────
  const DAYS_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const studyDays = studyPrefs?.studyDays ?? [1, 2, 3, 4, 5];
  const skipDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !studyDays.includes(d));
  const studyDaysDesc = skipDays.length > 0
    ? `Non schedulare studio nei giorni: ${skipDays.map((d) => DAYS_IT[d]).join(', ')}`
    : 'Tutti i giorni della settimana disponibili';

  // ── Prompt blocchi di studio ───────────────────────────────────────────────
  const studyBlocksRule = includeStudyBlocks
    ? `
## STUDY WINDOWS
Genera una sola finestra temporale per ogni esame. Le singole sessioni e gli
orari vengono creati localmente usando esattamente le fasce scelte dall'utente.

### Durata intervallo
Calcola la durata usando prima di tutto le ore rimanenti, la preparazione attuale
e il buffer richiesto. Usa effort soltanto quando le ore non sono disponibili.

Vincoli:
- end deve rispettare il buffer richiesto per quell'esame
- start non può essere prima di oggi (${today})
- Se due finestre si sovrappongono → priorità all'esame con effort più alto
- Nessuna sessione di studio nei giorni in cui cade un altro esame
- Non decidere argomenti, capitoli, esercizi o contenuti da studiare

### Fasce orarie disponibili
${slotDesc}. Ogni fascia è una sessione completa e indivisibile.

### Disponibilità giorni
${studyDaysDesc}

### Campo label
Deve essere sempre una stringa vuota. Il contenuto viene personalizzato
esclusivamente dall'utente.`
    : `## STUDY WINDOWS\nstudy_windows deve essere [] per ogni piano.`;

  // ── System prompt ──────────────────────────────────────────────────────────
  const systemPrompt = `Sei un assistente accademico esperto in pianificazione della sessione universitaria italiana.
Data di oggi: ${today}. Anno corrente: ${currentYear}.

## OBIETTIVO
Genera ESATTAMENTE 3 piani alternativi. Ogni piano sceglie UNA data per ogni componente
di ogni esame. I piani devono rappresentare strategie realmente diverse.

## SCHEMA OUTPUT — rispondi SOLO con JSON valido, zero markdown
{
  "plans": [
    {
      "id": 1,
      "label": "Piano Conservativo",         // nome breve della strategia
      "rationale": "1 frase che spiega la logica",
      "date_picks": [
        { "examId": "...", "componentName": "...", "date": "YYYY-MM-DD" }
      ],
      "study_windows": [
        {
          "examId": "...",
          "start": "YYYY-MM-DD",
          "end": "YYYY-MM-DD",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "label": ""
        }
      ]
    }
  ]
}

## REGOLE DATE
- Date [BLOCCATA] → identiche in tutti e 3 i piani, non modificarle mai
- Date [PREFERITA] → sceglile prima delle alternative quando non creano conflitti
- Non scegliere mai date precedenti a oggi (${today})
- Scegli soltanto una delle date elencate per quella specifica componente
- Nessun esame nello stesso giorno di un altro
- Almeno 2 giorni di margine tra esami consecutivi quando possibile
- Se due date bloccate coincidono → segnalalo nel campo rationale
- Rispetta le dipendenze tra prove: sequenziale, attesa risultato o stessa sessione
- Considera obiettivo di voto, ore rimanenti, preparazione e tentativi precedenti

## DIFFERENZIAZIONE TRA I 3 PIANI
- Piano 1 "Conservativo": inizia dagli esami più semplici (effort/difficulty bassa)
- Piano 2 "Aggressivo":   affronta prima gli esami più pesanti
- Piano 3 "Bilanciato":   alterna difficile/semplice per mantenere la motivazione

## ORDINAMENTO ESAMI (priorità decrescente)
1. Vincoli delle date bloccate e dipendenze tra prove
2. Preferenze esplicite dell'utente e appelli [PREFERITA]
3. Ore rimanenti, preparazione, priorità e obiettivo
4. Strategia del piano (vedi sopra)
5. Margine minimo tra esami

${studyBlocksRule}`;

  // ── User prompt ────────────────────────────────────────────────────────────
  const userPrompt = `Esami:\n${examSummaries}\n\nPreferenze: "${preferences?.trim() || 'Nessuna preferenza specifica'}"`;

  // ── Chiamata Groq ──────────────────────────────────────────────────────────
  const response = await groqFetch({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Groq: ${response.status}`);
  }

  const data    = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Risposta Groq vuota');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Risposta Groq non è JSON valido.');
  }

  const plans = Array.isArray(parsed.plans) ? parsed.plans : [];
  if (plans.length === 0) throw new Error('Groq non ha restituito piani validi.');

  const addDays = (iso, amount) => {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + amount);
    return formatDateISO(d);
  };

  const allowedByComponent = new Map();
  validExams.forEach((exam) => {
    exam.components.forEach((component) => {
      allowedByComponent.set(
        `${exam.id}::${component.name}`,
        component.dates
          .slice()
          .sort((a, b) => {
            const rank = (date) => date.locked ? 0 : date.preference === 'preferred' ? 1 : 2;
            return rank(a) - rank(b) || a.date - b.date;
          })
          .map((d) => formatDateISO(d.date))
      );
    });
  });

  return plans.slice(0, 3).map((plan, i) => {
    const warnings = [];
    const rawPicks = new Map(
      (plan.date_picks || []).map((p) => [`${p.examId}::${p.componentName}`, p.date])
    );

    // Ogni componente riceve sempre una data futura realmente disponibile.
    // Se il modello omette o inventa una data, viene usato il primo appello
    // valido (o quello bloccato) invece di salvare un valore errato.
    let date_picks = validExams.flatMap((exam) =>
      exam.components.map((component) => {
        const key = `${exam.id}::${component.name}`;
        const allowed = allowedByComponent.get(key) || [];
        const proposed = rawPicks.get(key);
        const locked = component.dates.find((d) => d.locked);
        const fallback = locked ? formatDateISO(locked.date) : allowed[0];
        return {
          examId: exam.id,
          componentName: component.name,
          date: locked
            ? fallback
            : allowed.includes(proposed) ? proposed : fallback,
        };
      })
    );

    // Applica localmente le dipendenze anche se il modello restituisce un piano
    // incompleto: le regole non dipendono dall'affidabilità del testo generato.
    validExams.forEach((exam) => {
      if (exam.componentDependency === 'same-session' && exam.components.length > 1) {
        const dateSets = exam.components.map((component) =>
          new Set(allowedByComponent.get(`${exam.id}::${component.name}`) || [])
        );
        const lockedDates = [...new Set(exam.components.flatMap((component) =>
          component.dates
            .filter((date) => date.locked)
            .map((date) => formatDateISO(date.date))
        ))];
        const commonDate = lockedDates.length > 1
          ? null
          : lockedDates.length === 1
          ? lockedDates[0]
          : [...dateSets[0]].find((date) => dateSets.every((set) => set.has(date)));
        if (lockedDates.length > 1) {
          warnings.push(`${exam.name}: le prove hanno date bloccate diverse e non possono essere riunite nella stessa sessione.`);
        }
        if (commonDate) {
          if (dateSets.every((set) => set.has(commonDate))) {
            date_picks = date_picks.map((pick) =>
              pick.examId === exam.id ? { ...pick, date: commonDate } : pick
            );
          } else {
            warnings.push(`${exam.name}: la data bloccata non è disponibile per tutte le prove della stessa sessione.`);
          }
        } else if (lockedDates.length <= 1) {
          warnings.push(`${exam.name}: nessuna data comune disponibile per sostenere le prove nella stessa sessione.`);
        }
      }

      if (['sequential', 'wait-result'].includes(exam.componentDependency)) {
        let previousDate = null;
        exam.components.forEach((component) => {
          const key = `${exam.id}::${component.name}`;
          const current = date_picks.find((pick) =>
            pick.examId === exam.id && pick.componentName === component.name
          );
          if (!current) return;
          if (previousDate && current.date <= previousDate) {
            const hasLockedDate = component.dates.some((date) => date.locked);
            if (hasLockedDate) {
              warnings.push(`${exam.name}: la data bloccata di ${component.name} non rispetta l'ordine delle prove.`);
            } else {
              const nextValid = (allowedByComponent.get(key) || []).find((date) => date > previousDate);
              if (nextValid) current.date = nextValid;
              else warnings.push(`${exam.name}: non esiste una data successiva valida per ${component.name}.`);
            }
          }
          previousDate = current.date;
        });
      }
    });

    // La pianificazione delle sessioni è deterministica e locale. L'AI sceglie
    // le date degli esami, non i contenuti né gli orari delle sessioni.
    const study_windows = includeStudyBlocks
      ? validExams.map((exam) => {
          const deadline = date_picks
            .filter((p) => p.examId === exam.id)
            .map((p) => p.date)
            .sort()[0];
          if (!deadline || deadline <= today) return null;
          const availableHoursPerStudyDay = activeSlots.reduce((sum, slot) => {
            const [startHour, startMinute] = slot.start.split(':').map(Number);
            const [endHour, endMinute] = slot.end.split(':').map(Number);
            return sum + Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
          }, 0);
          const remainingHours = Number(exam.remainingHours || 0)
            || exam.topicItems?.filter((topic) => topic.status !== 'ready')
              .reduce((sum, topic) => sum + Number(topic.estimatedHours || 0), 0)
            || 0;
          const focusedStudyDays = remainingHours > 0
            ? Math.max(1, Math.ceil(remainingHours / Math.max(availableHoursPerStudyDay, 1)))
            : exam.effort >= 7 ? 14 : exam.effort >= 4 ? 8 : 4;
          const weeklyAvailability = Math.max(1, studyDays.length);
          const prepDays = Math.max(
            focusedStudyDays,
            Math.ceil(focusedStudyDays * 7 / weeklyAvailability)
          );
          const bufferDays = Math.max(0, Number(exam.reviewBufferDays ?? 1));
          const end = addDays(deadline, -(bufferDays + 1));
          if (end < today) {
            warnings.push(`${exam.name}: troppo vicino per rispettare il buffer richiesto; nessuna sessione automatica creata.`);
            return null;
          }
          const proposedStart = addDays(end, -(prepDays - 1));
          const start = proposedStart < today ? today : proposedStart;
          if (start > end) {
            warnings.push(`${exam.name}: intervallo di preparazione non valido; nessuna sessione automatica creata.`);
            return null;
          }
          return {
            examId: exam.id,
            start,
            end,
            deadline,
            start_time: null,
            end_time: null,
            label: '',
          };
        }).filter(Boolean)
      : [];

    return {
      id:          plan.id ?? i + 1,
      label:       plan.label       || `Piano ${i + 1}`,
      rationale:   plan.rationale   || plan.description || '',
      date_picks,
      study_windows,
      warnings,
    };
  });
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
        preference: 'alternative',
      })),
    })),
  }));
}

// Accepts an array of { base64, mimeType } — all images sent in one request so the
// model can cross-reference between screenshots (e.g. infer missing month headers).
export async function extractExamsFromImages(images) {
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

  const response = await groqFetch({
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
