import { useDialog } from '../hooks/useDialog.js';

const SECTIONS = [
  {
    icon: '01',
    title: 'Orientati nell’app',
    body: [
      'La sidebar contiene gli esami, gli strumenti di importazione e il pulsante Account e impostazioni.',
      'La parte centrale alterna Calendario ed Esami. Su telefono le due aree si cambiano dalla barra inferiore.',
    ],
    tips: [
      'Questa guida appare automaticamente solo al primo accesso.',
      'Puoi riaprirla in qualsiasi momento dal pulsante ? nella sidebar.',
    ],
  },
  {
    icon: '02',
    title: 'Inserisci gli esami',
    body: [
      'Premi Esame o Aggiungi per creare un esame con date, ore rimanenti, preparazione attuale, obiettivo e preferenze di studio.',
      'Ogni componente — scritto, orale, progetto o parziale — può avere più appelli, una data preferita, alternative ed eventuali date bloccate.',
    ],
    tips: [
      'Descrivi con AI compila il modulo partendo da testo o dettatura.',
      'Programma, materiali e storico raccoglie la checklist degli argomenti, il materiale disponibile e gli eventuali tentativi precedenti.',
      'Il riepilogo Impatto sul piano segnala carichi troppo intensi e sovrapposizioni con altri esami.',
    ],
  },
  {
    icon: '03',
    title: 'Importa dalle immagini',
    body: [
      'Il pulsante immagine nella sidebar accetta uno o più screenshot del calendario universitario.',
      'L’AI confronta le immagini, riconosce gli esami, unisce i duplicati e prepara delle bozze modificabili prima del salvataggio.',
    ],
    tips: [
      'Controlla sempre date, anno e tipo di prova prima di confermare l’importazione.',
    ],
  },
  {
    icon: '04',
    title: 'Genera il Piano AI',
    body: [
      'Piano AI propone tre strategie alternative e sceglie soltanto appelli disponibili da oggi in avanti.',
      'Puoi indicare priorità personali, giorni di studio e fasce precise per mattina, pomeriggio e sera.',
    ],
    tips: [
      'Ogni fascia attiva diventa una sessione completa: 09:00–12:00 genera un unico blocco 09:00–12:00.',
      'Le date bloccate restano vincoli assoluti; appelli preferiti, dipendenze tra prove, buffer e ore rimanenti guidano la scelta del piano.',
      'Il piano decide la materia assegnata, non gli argomenti da studiare: note e task restano personali.',
      'Se esiste già un piano viene richiesta una conferma prima di sostituirlo.',
    ],
  },
  {
    icon: '05',
    title: 'Usa il calendario',
    body: [
      'La vista Mese mostra appelli e sessioni in modo sintetico; la vista Settimana posiziona ogni evento sul suo orario reale.',
      'La settimana copre la giornata fino alle 00:00, è scorrevole e mostra la linea dell’ora corrente.',
    ],
    tips: [
      'Il simbolo di avviso segnala più esami nello stesso giorno.',
      'Con un piano attivo puoi passare da Solo piano a Tutte le date.',
      'Oggi riporta immediatamente il calendario alla data corrente.',
    ],
  },
  {
    icon: '06',
    title: 'Gestisci le sessioni',
    body: [
      'Premi Sessione per creare manualmente blocchi ricorrenti scegliendo materia, intervallo di date, orari, durata, pause e giorni.',
      'Aprendo una sessione puoi modificarne data, ora iniziale, ora finale e note, segnarla come completata oppure eliminarla.',
    ],
    tips: [
      'Le sessioni generate dal piano rispettano le fasce impostate dall’utente.',
      'Ogni sessione è indipendente: una modifica non altera automaticamente le altre.',
    ],
  },
  {
    icon: '07',
    title: 'Organizza i task',
    body: [
      'Dentro ogni sessione puoi creare una lista di task personalizzata.',
      'Ogni task può essere completato, rinominato, eliminato e associato a un orario specifico.',
    ],
    tips: [
      'I task appartengono alla singola sessione e non vengono copiati sugli altri giorni.',
      'Puoi usare le note della sessione per l’obiettivo generale e i task per le attività concrete.',
    ],
  },
  {
    icon: '08',
    title: 'Controlla esami e progresso',
    body: [
      'La vista Esami mostra prossima data futura, urgenza, percentuale di sessioni completate e prossimi blocchi di studio.',
      'La linea di progressione ordina gli esami scelti dal piano e distingue completati, corrente e futuri.',
    ],
    tips: [
      'Gli stati disponibili sono Da iniziare, In corso, Parziale, Completato, Non superato e Saltato.',
      'La progressione può essere nascosta dalle impostazioni.',
    ],
  },
  {
    icon: '09',
    title: 'Modifica appelli ed eventi',
    body: [
      'Clicca un appello nel calendario per modificarne data, ora e aula oppure aprire l’editor completo dell’esame.',
      'Le date bloccate restano protette dalle modifiche accidentali.',
    ],
    tips: [
      'Dopo un esame puoi registrare l’esito e il voto dalla scheda dell’esame.',
    ],
  },
  {
    icon: '10',
    title: 'Esporta il calendario',
    body: [
      'Esporta crea un file compatibile con Apple Calendar oppure collegamenti per Google Calendar.',
      'Quando il piano è attivo vengono esportate le date selezionate; usa Tutte le date se vuoi includere ogni appello.',
    ],
    tips: [],
  },
  {
    icon: '11',
    title: 'Personalizza Sessionly',
    body: [
      'Apri Account e impostazioni nella parte bassa della sidebar.',
      'Puoi scegliere tema, palette, font, densità, animazioni, vista iniziale, stile delle sessioni e visibilità della progressione.',
    ],
    tips: [
      'La chiave Groq si configura nella sezione Intelligenza AI.',
      'La sezione Account mostra l’utente connesso e permette di uscire.',
    ],
  },
];

export function HelpModal({ onClose }) {
  const dialogRef = useDialog(onClose);
  return (
    <div className="help-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="help-hd">
          <div>
            <span className="help-eyebrow">Benvenuto in Sessionly</span>
            <h1 id="help-title" className="help-title">Come funziona l’applicazione</h1>
            <p className="help-subtitle">
              Dall’inserimento degli esami alla gestione quotidiana delle sessioni.
              Questa schermata viene mostrata automaticamente soltanto al primo accesso.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="help-body scroll">
          <div className="help-grid">
            {SECTIONS.map((section) => (
              <article key={section.icon} className="help-card">
                <div className="help-card-hd">
                  <span className="help-tag">{section.icon}</span>
                  <h3 className="help-card-title">{section.title}</h3>
                </div>
                <div className="help-card-body">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="help-para">{paragraph}</p>
                  ))}
                  {section.tips.length > 0 && (
                    <ul className="help-tips">
                      {section.tips.map((tip) => (
                        <li key={tip}>
                          <span className="help-tip-icon">→</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="help-footer">
            <span>Puoi riaprire questa guida dal pulsante ? nella sidebar.</span>
            <button className="btn" onClick={onClose}>Inizia a usare Sessionly</button>
          </div>
        </div>
      </div>
    </div>
  );
}
