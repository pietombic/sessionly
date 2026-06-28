import { useState } from 'react';
import { getGroqKey } from '../utils/groq.js';
import { useDialog } from '../hooks/useDialog.js';

const PALETTES = [
  { id: 'classic', name: 'Classico', colors: ['#1e2b45', '#f6f5f8', '#6366f1'] },
  { id: 'warm', name: 'Caldo', colors: ['#2b1f1a', '#f7efe2', '#b8642a'] },
  { id: 'cool', name: 'Fresco', colors: ['#142536', '#eef2ed', '#4f7d6e'] },
];

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-copy">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-section-controls">{children}</div>
    </section>
  );
}

function SettingsChoice({ value, options, onChange, ariaLabel }) {
  return (
    <div className="settings-choice" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SettingsToggle({ label, description, checked, onChange }) {
  return (
    <div className="settings-toggle-row">
      <div>
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <button
        type="button"
        className={`settings-switch ${checked ? 'active' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function SettingsModal({
  tweaks,
  onTweak,
  onGroqKey,
  onImport,
  onHelp,
  user,
  onLogout,
  onClose,
}) {
  const dialogRef = useDialog(onClose);
  const [tab, setTab] = useState('appearance');
  const initial = user?.email?.trim()?.[0]?.toUpperCase() || 'U';

  return (
    <div className="modal-backdrop settings-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div className="modal-hd settings-header">
          <div>
            <h2 id="settings-modal-title">Impostazioni</h2>
            <div className="sub">Personalizza Sessionly e gestisci il tuo account.</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Sezioni impostazioni">
            {[
              ['appearance', 'Aspetto'],
              ['calendar', 'Calendario'],
              ['ai', 'Intelligenza AI'],
              ['account', 'Account'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {tab === 'appearance' && (
              <>
                <SettingsSection title="Tema" description="Scegli il contrasto più comodo per l’ambiente in cui studi.">
                  <SettingsChoice
                    value={tweaks.dark ? 'dark' : 'light'}
                    ariaLabel="Tema"
                    options={[
                      { value: 'light', label: 'Chiaro' },
                      { value: 'dark', label: 'Scuro' },
                    ]}
                    onChange={(value) => onTweak('dark', value === 'dark')}
                  />
                </SettingsSection>

                <SettingsSection title="Palette" description="Modifica il carattere cromatico dell’interfaccia.">
                  <div className="settings-palettes">
                    {PALETTES.map((palette) => (
                      <button
                        key={palette.id}
                        className={tweaks.palette === palette.id ? 'active' : ''}
                        onClick={() => onTweak('palette', palette.id)}
                      >
                        <span className="settings-palette-colors">
                          {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
                        </span>
                        <span>{palette.name}</span>
                      </button>
                    ))}
                  </div>
                </SettingsSection>

                <SettingsSection title="Font dei titoli" description="Il testo operativo resta sempre semplice e leggibile.">
                  <SettingsChoice
                    value={tweaks.font}
                    ariaLabel="Font titoli"
                    options={[
                      { value: 'unbounded', label: 'Unbounded' },
                      { value: 'lora', label: 'Lora' },
                      { value: 'playfair', label: 'Playfair' },
                    ]}
                    onChange={(value) => onTweak('font', value)}
                  />
                </SettingsSection>

                <SettingsSection title="Spaziatura" description="Riduci gli spazi quando vuoi vedere più contenuti insieme.">
                  <SettingsChoice
                    value={tweaks.density}
                    ariaLabel="Densità interfaccia"
                    options={[
                      { value: 'comfortable', label: 'Comoda' },
                      { value: 'compact', label: 'Compatta' },
                    ]}
                    onChange={(value) => onTweak('density', value)}
                  />
                </SettingsSection>

                <SettingsToggle
                  label="Animazioni"
                  description="Transizioni leggere per modali, schede ed eventi."
                  checked={tweaks.animations}
                  onChange={(value) => onTweak('animations', value)}
                />
              </>
            )}

            {tab === 'calendar' && (
              <>
                <SettingsSection title="Vista iniziale" description="La vista usata quando apri l’applicazione.">
                  <SettingsChoice
                    value={tweaks.defaultView}
                    ariaLabel="Vista iniziale calendario"
                    options={[
                      { value: 'month', label: 'Mese' },
                      { value: 'week', label: 'Settimana' },
                    ]}
                    onChange={(value) => onTweak('defaultView', value)}
                  />
                </SettingsSection>

                <SettingsSection title="Sessioni di studio" description="Scegli come distinguere le sessioni dagli esami.">
                  <SettingsChoice
                    value={tweaks.studyStyle}
                    ariaLabel="Stile sessioni"
                    options={[
                      { value: 'band', label: 'Bordo' },
                      { value: 'tratteggio', label: 'Tratteggio' },
                      { value: 'dotted', label: 'Punti' },
                      { value: 'underline', label: 'Linea' },
                    ]}
                    onChange={(value) => onTweak('studyStyle', value)}
                  />
                </SettingsSection>

                <SettingsSection title="Slider dei carichi" description="Aspetto dei controlli effort e difficoltà.">
                  <SettingsChoice
                    value={tweaks.sliderStyle}
                    ariaLabel="Stile slider"
                    options={[
                      { value: 'ticks', label: 'Tacche' },
                      { value: 'bars', label: 'Barre' },
                      { value: 'column', label: 'Colonne' },
                    ]}
                    onChange={(value) => onTweak('sliderStyle', value)}
                  />
                </SettingsSection>

                <SettingsToggle
                  label="Mostra progressione esami"
                  description="Visualizza la linea cronologica sotto la toolbar."
                  checked={tweaks.showTimeline}
                  onChange={(value) => onTweak('showTimeline', value)}
                />
              </>
            )}

            {tab === 'ai' && (
              <>
                <SettingsSection
                  title="Chiave Groq"
                  description="Usata per generare piani e importare esami dalle immagini. Rimane salvata solo nel browser."
                >
                  <div className="settings-ai-card">
                    <span className={getGroqKey() ? 'configured' : ''}>
                      {getGroqKey() ? 'Configurata' : 'Non configurata'}
                    </span>
                    <button className="btn ghost" onClick={onGroqKey}>
                      {getGroqKey() ? 'Modifica chiave' : 'Aggiungi chiave'}
                    </button>
                  </div>
                </SettingsSection>
                <SettingsSection
                  title="Importazione esami"
                  description="Riconosci esami e appelli da uno o più screenshot."
                >
                  <button className="btn ghost" onClick={onImport}>Importa da immagini</button>
                </SettingsSection>
              </>
            )}

            {tab === 'account' && (
              <>
                <div className="settings-account-card">
                  <span className="settings-account-avatar">{initial}</span>
                  <div>
                    <strong>{user?.email || 'Account Sessionly'}</strong>
                    <span>Account attualmente connesso</span>
                  </div>
                </div>
                <SettingsSection title="Sessione account" description="Disconnetti questo dispositivo dal tuo account.">
                  <button className="btn danger settings-logout" onClick={onLogout}>
                    Esci dall’account
                  </button>
                </SettingsSection>
                <SettingsSection title="Guida" description="Rivedi in qualsiasi momento tutte le funzioni di Sessionly.">
                  <button className="btn ghost" onClick={onHelp}>
                    Come si usa Sessionly
                  </button>
                </SettingsSection>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
