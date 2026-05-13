const SECTIONS = [
  {
    icon: '＋',
    title: 'Aggiungi esami',
    tag: '01',
    body: [
      'Premi il pulsante + Aggiungi nella barra sinistra per inserire un esame manualmente.',
      'Per ogni esame puoi specificare nome, tipologia (scritto+orale, parziali, progetto…), tutte le date disponibili per ogni componente, effort e difficoltà.',
      'Puoi inserire più date alternative per scritto e orale: l\'AI sceglierà quella ottimale quando generi il piano.',
    ],
    tips: [
      { icon: '✦', text: 'Premi "Descrivi con AI" per descrivere l\'esame a parole — anche con il microfono — e il form si compila automaticamente.' },
      { icon: '📷', text: 'Usa il bottone fotocamera accanto ad "Aggiungi" per caricare uno screenshot del calendario universitario: l\'AI rileva tutti gli esami.' },
    ],
  },
  {
    icon: '✦',
    title: 'Piano AI',
    tag: '02',
    body: [
      'Premi Piano AI per generare un piano della sessione personalizzato. L\'AI sceglie UNA data ottimale tra quelle disponibili per ogni componente di ogni esame.',
      'L\'AI propone 3 alternative di piano con ordini diversi — sceglie quella che ti convince di più.',
    ],
    tips: [
      { icon: '→', text: 'Prima di generare puoi specificare le tue preferenze: "voglio fare prima Reti perché è più semplice".' },
      { icon: '→', text: 'Scegli gli orari di studio (mattina/pomeriggio/sera) e la durata delle sessioni (1h, 1.5h, 2h, 3h).' },
      { icon: '→', text: 'Attiva "Includi blocchi di studio" per vedere nel calendario quando prepararti.' },
    ],
  },
  {
    icon: '◉',
    title: 'Tutte le date / Rimuovi piano',
    tag: '03',
    body: [
      'Con un piano AI attivo, il calendario mostra solo le date scelte dall\'AI.',
      'Il toggle "Tutte le date" (accanto a Esporta) mostra anche le date scartate.',
      '"Rimuovi piano" cancella le date scelte e i blocchi di studio.',
    ],
    tips: [
      { icon: '⚠', text: 'Se generi un nuovo piano mentre ne esiste già uno, verrà chiesta una conferma prima di sovrascriverlo.' },
    ],
  },
  {
    icon: '📅',
    title: 'Calendario',
    tag: '04',
    body: [
      'La vista Mese mostra il calendario mensile con chip colorati per le date degli esami e blocchi di studio.',
      'La vista Settimana mostra 7 colonne con nomi completi degli esami e orari.',
      'I chip conflitto (⚠) segnalano più esami nello stesso giorno.',
    ],
    tips: [
      { icon: '→', text: 'Clicca su un chip esame per aprire e modificare quell\'esame.' },
      { icon: '→', text: 'Clicca su un blocco di studio per segnarlo come completato (barrato). Ri-clicca per annullare.' },
    ],
  },
  {
    icon: '▬',
    title: 'Linea di progressione',
    tag: '05',
    body: [
      'La barra sotto la toolbar appare quando hai un piano AI attivo. Mostra gli esami in ordine cronologico collegati da linee.',
    ],
    tips: [
      { icon: '●', text: 'Verde = esame superato (status "Completato").' },
      { icon: '●', text: 'Azzurro = l\'esame che stai preparando ora (il primo non ancora superato).' },
      { icon: '●', text: 'Grigio = esami futuri da preparare.' },
    ],
  },
  {
    icon: '⏱',
    title: 'Timer Pomodoro',
    tag: '06',
    body: [
      'Il bottone ⏱ in basso a sinistra apre un timer per le sessioni di studio. Supporta la tecnica Pomodoro: sessioni di lavoro alternate a pause.',
    ],
    tips: [
      { icon: '→', text: 'Clicca ⚙ per personalizzare: studio 15/25/30/45/60 min, pausa 5/10/15/20 min.' },
      { icon: '→', text: 'I pallini mostrano quante sessioni consecutive hai completato.' },
      { icon: '→', text: 'Quando è in esecuzione il bottone mostra il tempo rimanente anche da chiuso.' },
    ],
  },
  {
    icon: '📋',
    title: 'Dettagli programma',
    tag: '07',
    body: [
      'Nella scheda di ogni esame, sotto "Note", trovi la sezione collassabile "Dettagli programma".',
      'Inserisci il tipo di studio (Teorico / Misto / Pratico), il numero di pagine, il numero di PDF e gli argomenti del programma riga per riga.',
      'L\'AI userà questi dati per generare blocchi di studio più precisi: con approccio Pratico riserva tempo agli esercizi, con Teorico al ripasso.',
    ],
    tips: [],
  },
  {
    icon: '⬆',
    title: 'Esporta',
    tag: '08',
    body: [
      'Premi Esporta per salvare gli esami su Apple Calendar (.ics) o Google Calendar (link diretti).',
      'Con un piano AI attivo vengono esportate solo le date scelte dall\'AI.',
      'Per esportare tutte le date, attiva prima il toggle "Tutte le date".',
    ],
    tips: [],
  },
  {
    icon: '●',
    title: 'Stato degli esami',
    tag: '09',
    body: [
      'Ogni esame ha uno stato visibile nella card sidebar: Da iniziare, In corso, Parziale, Completato, Non superato, Saltato.',
      'Se la data dell\'esame è già passata, nella scheda appare la sezione "Com\'è andata?" con i pulsanti Superato / Non superato / Saltato.',
    ],
    tips: [
      { icon: '→', text: 'Lo stato "Completato" (done) segna l\'esame come verde nella linea di progressione.' },
    ],
  },
  {
    icon: '⚙',
    title: 'Impostazioni',
    tag: '10',
    body: [
      'Il pannello ⚙ in basso a destra permette di personalizzare l\'aspetto:',
    ],
    tips: [
      { icon: '→', text: 'Font: Unbounded (default), Lora, Playfair Display, Cormorant Garamond.' },
      { icon: '→', text: 'Palette colori: Classico, Caldo, Fresco.' },
      { icon: '→', text: 'Stile blocchi studio: Tratteggio, Banda, Puntinato, Sottolineato.' },
      { icon: '→', text: 'Tema chiaro/scuro (rilevato automaticamente dal sistema, poi salvato).' },
      { icon: '→', text: 'Chiave API Groq: ottienila gratis su console.groq.com e inseriscila qui.' },
    ],
  },
  {
    icon: '🔑',
    title: 'Chiave API Groq',
    tag: '11',
    body: [
      'Tutte le funzioni AI (descrizione vocale, piano sessione, importazione immagine) usano Groq — un servizio gratuito.',
      'Vai su console.groq.com → "API Keys" → crea una nuova chiave e incollala nel pannello ⚙.',
      'La chiave è salvata solo nel browser (localStorage) e non viene mai inviata ai nostri server.',
    ],
    tips: [
      { icon: '→', text: 'Modello testo: llama-3.3-70b-versatile. Modello visione: llama-4-scout-17b.' },
    ],
  },
];

export function HelpModal({ onClose }) {
  return (
    <div className="help-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="help-modal">
        <div className="help-hd">
          <div>
            <h1 className="help-title">Come si usa Sessionly</h1>
            <p className="help-subtitle">
              Guida completa a tutte le funzionalità — aggiornata ad ogni nuova versione.
            </p>
          </div>
          <button className="modal-close" style={{ width: 32, height: 32, fontSize: 18 }} onClick={onClose}>✕</button>
        </div>

        <div className="help-body scroll">
          <div className="help-grid">
            {SECTIONS.map((s) => (
              <div key={s.tag} className="help-card">
                <div className="help-card-hd">
                  <span className="help-tag">{s.tag}</span>
                  <span className="help-icon">{s.icon}</span>
                  <h3 className="help-card-title">{s.title}</h3>
                </div>
                <div className="help-card-body">
                  {s.body.map((p, i) => (
                    <p key={i} className="help-para">{p}</p>
                  ))}
                  {s.tips.length > 0 && (
                    <ul className="help-tips">
                      {s.tips.map((t, i) => (
                        <li key={i}>
                          <span className="help-tip-icon">{t.icon}</span>
                          <span>{t.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="help-footer">
            <span>Sessionly · creato da Pietro Tombaccini</span>
            <a
              href="https://github.com/pietombic/"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/pietombic
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
