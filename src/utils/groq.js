const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

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

export async function generateStudyPlan(exams) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY non trovata nel file .env');

  const examSummaries = exams
    .filter((e) => firstExamDate(e))
    .map((e) => {
      const dates = e.components
        .flatMap((c) => c.dates
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
