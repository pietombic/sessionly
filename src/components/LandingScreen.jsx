export function LandingScreen({ onOpenAuth }) {
  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-brand">Sessionly</div>

        <div className="ornament">~ ❦ ~</div>

        <h1 className="landing-title">Il tuo piano di studio, ordinato.</h1>

        <p className="landing-blurb">
          Inserisci i tuoi esami, lascia che l'AI pianifichi le sessioni di studio,
          esporta tutto su Apple Calendar o Google Calendar.
          Elegante, semplice, pensato per gli studenti universitari.
        </p>

        <button className="btn landing-cta" onClick={onOpenAuth}>
          Accedi o Registrati
        </button>

        <div className="landing-steps">
          <div className="step">
            <div className="num">01</div>
            <h4>Inserisci</h4>
            <p>Nome, tipologia, date e aule — anche più appelli alternativi.</p>
          </div>
          <div className="step">
            <div className="num">02</div>
            <h4>Pianifica con AI</h4>
            <p>Groq analizza effort e difficoltà e genera i blocchi di studio nel calendario.</p>
          </div>
          <div className="step">
            <div className="num">03</div>
            <h4>Esporta</h4>
            <p>Scarica l'ICS per Apple Calendar o aggiungi ogni esame a Google Calendar.</p>
          </div>
        </div>
      </div>

      <a
        href="https://github.com/pietombic/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 32,
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: 'var(--ink-soft)',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          opacity: 0.7,
          transition: 'opacity .15s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        Creato da Pietro Tombaccini · pietombic
      </a>
    </div>
  );
}
