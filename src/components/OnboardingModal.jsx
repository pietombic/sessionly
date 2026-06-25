import { useState } from 'react';

const STEPS = [
  {
    number: '01',
    title: 'Inserisci i tuoi esami',
    copy: 'Aggiungi date, difficoltà e priorità. Puoi anche importarli da uno screenshot.',
  },
  {
    number: '02',
    title: 'Crea il tuo piano',
    copy: 'Scegli giorni e fasce orarie: Sessionly userà esattamente gli intervalli che indichi.',
  },
  {
    number: '03',
    title: 'Gestisci la giornata',
    copy: 'Dalla vista Oggi controlli il prossimo esame, le ore pianificate e le sessioni da completare.',
  },
];

export function OnboardingModal({ onComplete, onOpenGuide }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <div className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-progress" aria-label={`Passaggio ${step + 1} di ${STEPS.length}`}>
          {STEPS.map((entry, index) => (
            <span key={entry.number} className={index <= step ? 'is-active' : ''} />
          ))}
        </div>
        <div className="onboarding-content">
          <span className="onboarding-number">{current.number}</span>
          <h1 id="onboarding-title">{current.title}</h1>
          <p>{current.copy}</p>
          <div className="onboarding-mini-preview" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="onboarding-actions">
          <button className="btn ghost" onClick={onOpenGuide}>Guida completa</button>
          <div>
            {step > 0 && <button className="btn ghost" onClick={() => setStep((value) => value - 1)}>Indietro</button>}
            {step < STEPS.length - 1 ? (
              <button className="btn" onClick={() => setStep((value) => value + 1)}>Continua</button>
            ) : (
              <button className="btn" onClick={onComplete}>Inizia</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
