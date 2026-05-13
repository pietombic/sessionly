export const TODAY = new Date(2026, 5, 11);

const d = (y, m, day, h, min) => {
  const dt = new Date(y, m - 1, day);
  if (h != null) dt.setHours(h, min || 0, 0, 0);
  return dt;
};

export const TAG_COLORS = [
  { name: 'amber',  hex: '#c9a84c' },
  { name: 'brick',  hex: '#9e3a2b' },
  { name: 'sage',   hex: '#6b8e6f' },
  { name: 'plum',   hex: '#6e4a6e' },
  { name: 'teal',   hex: '#3e6e7a' },
  { name: 'ochre',  hex: '#b87333' },
  { name: 'indigo', hex: '#4a5d8f' },
];

export const TAG_CSS = {
  amber:  'var(--tag-amber)',
  brick:  'var(--tag-brick)',
  sage:   'var(--tag-sage)',
  plum:   'var(--tag-plum)',
  teal:   'var(--tag-teal)',
  ochre:  'var(--tag-ochre)',
  indigo: 'var(--tag-indigo)',
};

export const TYPES = [
  { id: 'scritto',         label: 'Solo Scritto',                 short: 'S',   components: ['Scritto'] },
  { id: 'orale',           label: 'Solo Orale',                   short: 'O',   components: ['Orale'] },
  { id: 'scritto-orale',   label: 'Scritto + Orale',              short: 'SO',  components: ['Scritto', 'Orale'] },
  { id: 'scritto-prat',    label: 'Scritto + Pratico',            short: 'SP',  components: ['Scritto', 'Pratico'] },
  { id: 'scritto-prat-pj', label: 'Scritto + Pratico + Progetto', short: 'SPP', components: ['Scritto', 'Pratico', 'Progetto'] },
  { id: 'parziali',        label: 'Parziale 1 + Parziale 2',     short: 'P1+P2', components: ['Parziale 1', 'Parziale 2'] },
  { id: 'parziali-orale',  label: 'Parziali + Orale',            short: 'P+O', components: ['Parziale 1', 'Parziale 2', 'Orale'] },
  { id: 'progetto',        label: 'Progetto + Discussione',       short: 'PD',  components: ['Progetto', 'Discussione'] },
];

let _id = 1000;
const nextId = () => 'e' + (_id++);

export const INITIAL_EXAMS = [
  {
    id: 'analisi2',
    name: 'Analisi Matematica II',
    code: 'MAT-202',
    tag: 'brick',
    type: 'parziali-orale',
    effort: 9,
    difficulty: 9,
    priority: 'alta',
    status: 'active',
    partial1Done: true,
    partial1Grade: 26,
    notes: 'Parziale 1 superato a marzo. Concentrarsi su serie di Fourier ed equazioni differenziali per il Parziale 2.',
    components: [
      { name: 'Parziale 2', dates: [
        { id: nextId(), date: d(2026, 6, 24), time: '09:00', room: 'Aula Magna', locked: true },
      ]},
      { name: 'Orale', dates: [
        { id: nextId(), date: d(2026, 7, 8), time: '14:30', room: 'DIMA 3.04', locked: false },
      ]},
    ],
  },
  {
    id: 'fisica2',
    name: 'Fisica Generale II',
    code: 'FIS-105',
    tag: 'indigo',
    type: 'scritto-orale',
    effort: 8,
    difficulty: 7,
    priority: 'alta',
    status: 'todo',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Elettromagnetismo + ottica. Esercitarsi su circuiti RLC.',
    components: [
      { name: 'Scritto', dates: [
        { id: nextId(), date: d(2026, 6, 30), time: '14:00', room: 'B1', locked: false },
        { id: nextId(), date: d(2026, 7, 21), time: '14:00', room: 'B1', locked: false },
      ]},
      { name: 'Orale', dates: [
        { id: nextId(), date: d(2026, 7, 6), time: '10:00', room: 'FIS-201', locked: false },
      ]},
    ],
  },
  {
    id: 'algo',
    name: 'Algoritmi e Strutture Dati',
    code: 'INF-220',
    tag: 'sage',
    type: 'scritto-prat-pj',
    effort: 7,
    difficulty: 6,
    priority: 'media',
    status: 'active',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Il progetto va consegnato 3 giorni prima dello scritto. Idee: grafo metro di Milano.',
    components: [
      { name: 'Progetto', dates: [
        { id: nextId(), date: d(2026, 6, 26), time: '23:59', room: 'GitLab', locked: true },
      ]},
      { name: 'Scritto', dates: [
        { id: nextId(), date: d(2026, 6, 30), time: '09:00', room: 'INF-Lab 1', locked: false },
      ]},
      { name: 'Pratico', dates: [
        { id: nextId(), date: d(2026, 7, 2), time: '15:00', room: 'INF-Lab 2', locked: false },
      ]},
    ],
  },
  {
    id: 'circuiti',
    name: 'Elettrotecnica',
    code: 'ING-INF-04',
    tag: 'amber',
    type: 'scritto-orale',
    effort: 6,
    difficulty: 7,
    priority: 'media',
    status: 'todo',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Circuiti in regime sinusoidale, trasformatori.',
    components: [
      { name: 'Scritto', dates: [
        { id: nextId(), date: d(2026, 7, 14), time: '09:00', room: 'C2', locked: false },
      ]},
      { name: 'Orale', dates: [
        { id: nextId(), date: d(2026, 7, 22), time: '11:00', room: 'EE-105', locked: false },
      ]},
    ],
  },
  {
    id: 'lingua',
    name: 'Inglese Tecnico B2',
    code: 'LIN-B2',
    tag: 'teal',
    type: 'scritto',
    effort: 3,
    difficulty: 4,
    priority: 'bassa',
    status: 'todo',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Idoneità — basta superarlo.',
    components: [
      { name: 'Scritto', dates: [
        { id: nextId(), date: d(2026, 7, 16), time: '15:00', room: 'CLA', locked: false },
      ]},
    ],
  },
  {
    id: 'sistemi',
    name: 'Sistemi Operativi',
    code: 'INF-310',
    tag: 'plum',
    type: 'scritto-prat',
    effort: 7,
    difficulty: 8,
    priority: 'alta',
    status: 'todo',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Sincronizzazione, deadlock, memoria virtuale. Pratico in C.',
    components: [
      { name: 'Scritto', dates: [
        { id: nextId(), date: d(2026, 7, 9), time: '09:00', room: 'INF-Aula 4', locked: false },
      ]},
      { name: 'Pratico', dates: [
        { id: nextId(), date: d(2026, 7, 10), time: '14:00', room: 'INF-Lab 3', locked: false },
      ]},
    ],
  },
  {
    id: 'fondchem',
    name: 'Chimica',
    code: 'CHI-101',
    tag: 'ochre',
    type: 'orale',
    effort: 4,
    difficulty: 5,
    priority: 'bassa',
    status: 'partial',
    partial1Done: false,
    partial1Grade: 18,
    notes: 'Solo orale, materiale già rivisto a maggio.',
    components: [
      { name: 'Orale', dates: [
        { id: nextId(), date: d(2026, 6, 19), time: '10:30', room: 'CHI-A', locked: false },
      ]},
    ],
  },
];

export const INITIAL_STUDY_WINDOWS = [
  { examId: 'analisi2', start: d(2026, 6, 13), end: d(2026, 6, 23), label: 'Ripasso EDO + Fourier' },
  { examId: 'algo',     start: d(2026, 6, 18), end: d(2026, 6, 25), label: 'Progetto + algoritmi' },
  { examId: 'fisica2',  start: d(2026, 6, 22), end: d(2026, 6, 29), label: 'Elettromag + ottica' },
  { examId: 'sistemi',  start: d(2026, 7, 1),  end: d(2026, 7, 8),  label: 'Concorrenza + memoria' },
  { examId: 'circuiti', start: d(2026, 7, 8),  end: d(2026, 7, 13), label: 'Esercizi circuiti' },
  { examId: 'fondchem', start: d(2026, 6, 15), end: d(2026, 6, 18), label: 'Ripasso veloce' },
];
