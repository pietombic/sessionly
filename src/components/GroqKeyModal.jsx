import { useState } from 'react';
import { saveGroqKey, getGroqKey } from '../utils/groq.js';

export function GroqKeyModal({ onClose, onSaved }) {
  const existing = getGroqKey();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) { setError('Inserisci una chiave valida.'); return; }
    if (!trimmed.startsWith('gsk_')) { setError('La chiave Groq inizia con "gsk_".'); return; }
    saveGroqKey(trimmed);
    onSaved(trimmed);
  };

  const handleRemove = () => {
    saveGroqKey(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h2>Configura Groq AI</h2>
            <div className="sub">La chiave viene salvata solo sul tuo browser, mai sui server.</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          <div style={{
            padding: '12px 14px',
            background: 'color-mix(in oklch, var(--paper) 80%, var(--accent) 8%)',
            border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
            borderRadius: 4,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ink-soft)',
          }}>
            Groq è <strong style={{ color: 'var(--ink)' }}>gratuito</strong> — non serve carta di credito.
            Registrati su{' '}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-deep)', fontWeight: 500 }}
            >
              console.groq.com/keys
            </a>
            , crea una API key e incollala qui.
          </div>

          <div className="field">
            <label className="field-label">
              {existing ? 'Nuova chiave (sostituisce quella esistente)' : 'Chiave API Groq'}
            </label>
            <input
              type="password"
              className="input mono"
              placeholder="gsk_••••••••••••••••••••••••"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            {existing && (
              <span className="field-hint">
                Chiave attuale: {existing.slice(0, 8)}••••••••{existing.slice(-4)}
              </span>
            )}
            {error && (
              <span style={{ color: 'var(--warn)', fontSize: 12 }}>⚠ {error}</span>
            )}
          </div>
        </div>

        <div className="modal-ft">
          <div>
            {existing && (
              <button className="btn danger" onClick={handleRemove}>
                Rimuovi chiave
              </button>
            )}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Annulla</button>
            <button className="btn" onClick={handleSave} disabled={!key.trim()}>
              Salva e genera piano
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
