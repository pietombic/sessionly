export const PROOF_OPTIONS = [
  { id: 'written', label: 'Scritto', short: 'S', description: 'Prova scritta unica o suddivisa in parziali' },
  { id: 'oral', label: 'Orale', short: 'O', description: 'Colloquio o interrogazione orale' },
  { id: 'project', label: 'Progetto', short: 'P', description: 'Consegna di un progetto o elaborato' },
  { id: 'practical', label: 'Pratico', short: 'PR', description: 'Laboratorio o prova pratica' },
  { id: 'discussion', label: 'Discussione', short: 'D', description: 'Discussione del progetto o dell’elaborato' },
];

const NAMES = {
  written: 'Scritto',
  oral: 'Orale',
  project: 'Progetto',
  practical: 'Pratico',
  discussion: 'Discussione',
};

export function componentKind(component) {
  if (component?.kind) return component.kind;
  const name = component?.name || '';
  if (/^Parziale\s+\d+/i.test(name)) return 'partial';
  return Object.entries(NAMES).find(([, label]) => label === name)?.[0] || 'written';
}

export function isPartialComponent(component) {
  return componentKind(component) === 'partial';
}

export function componentNeedsPlanning(component) {
  return component?.required !== false && component?.status !== 'completed';
}

export function emptyExamDate(id = `date_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`) {
  return {
    id,
    date: null,
    time: '',
    room: '',
    locked: false,
    preference: 'alternative',
  };
}

export function createExamComponent(kind, partialNumber = null) {
  const isPartial = kind === 'partial';
  const name = isPartial ? `Parziale ${partialNumber}` : NAMES[kind];
  return {
    id: `component_${kind}_${partialNumber || name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name,
    status: 'pending',
    grade: null,
    gradeLode: false,
    required: true,
    dates: [emptyExamDate()],
  };
}

export function normalizeExamComponents(components, legacy = {}) {
  const normalized = (components || []).map((component, index) => {
    const kind = componentKind(component);
    const partialMatch = component.name?.match(/^Parziale\s+(\d+)/i);
    const partialNumber = partialMatch ? Number(partialMatch[1]) : null;
    const legacyCompleted = partialNumber === 1 && legacy?.partial1Done;
    return {
      ...component,
      id: component.id || `component_${kind}_${index}`,
      kind,
      status: component.status || (legacyCompleted ? 'completed' : 'pending'),
      grade: component.grade ?? (legacyCompleted ? legacy?.partial1Grade ?? null : null),
      gradeLode: !!component.gradeLode,
      required: component.required !== false,
      dates: (component.dates || []).map((date, dateIndex) => ({
        ...emptyExamDate(`date_${index}_${dateIndex}`),
        ...date,
        preference: date.preference || 'alternative',
      })),
    };
  });
  const hasPartials = normalized.some(isPartialComponent);
  const hasFirstPartial = normalized.some((component) => component.name === 'Parziale 1');
  if (legacy?.partial1Done && hasPartials && !hasFirstPartial) {
    normalized.unshift({
      ...createExamComponent('partial', 1),
      id: 'component_legacy_partial_1',
      status: 'completed',
      grade: legacy?.partial1Grade ?? null,
      dates: [],
    });
  }
  return normalized;
}

export function deriveLegacyExamType(components) {
  const names = new Set((components || []).map((component) => component.name));
  const hasPartials = [...names].some((name) => /^Parziale\s+\d+/i.test(name));
  if (hasPartials) return names.has('Orale') ? 'parziali-orale' : 'parziali';
  if (names.size === 1 && names.has('Scritto')) return 'scritto';
  if (names.size === 1 && names.has('Orale')) return 'orale';
  if (names.has('Scritto') && names.has('Orale') && names.size === 2) return 'scritto-orale';
  return 'custom';
}

export function selectedProofs(components) {
  const selected = new Set();
  (components || []).forEach((component) => {
    const kind = componentKind(component);
    selected.add(kind === 'partial' ? 'written' : kind);
  });
  return selected;
}
