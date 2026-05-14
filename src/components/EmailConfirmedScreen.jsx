export function EmailConfirmedScreen({ onContinue }) {
  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-brand">Sessionly</div>

        <div className="email-confirmed-badge">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="ornament">~ ❦ ~</div>

        <h1 className="landing-title">Email confermata.</h1>

        <p className="landing-blurb">
          Il tuo account è attivo. Sei pronto a pianificare la tua sessione di esami con Sessionly.
        </p>

        <button className="btn landing-cta" onClick={onContinue}>
          Vai all'app
        </button>
      </div>
    </div>
  );
}
