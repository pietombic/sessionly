import { useState, useRef, useCallback } from 'react';
import { extractExamsFromImages } from '../utils/groq.js';
import { TAG_CSS } from '../data.js';
import { useDialog } from '../hooks/useDialog.js';

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function fmtDate(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function ExamDraftCard({ draft, selected, onToggle }) {
  const allDates = draft.components.flatMap((c) =>
    c.dates.filter((d) => d.date).map((d) => `${c.name} · ${fmtDate(d.date)}${d.time ? ' ' + d.time : ''}${d.room ? ' · ' + d.room : ''}`)
  );

  return (
    <div
      className={`import-draft-card ${selected ? 'selected' : ''}`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      style={{ '--tag': TAG_CSS[draft.tag] }}
    >
      <div className="import-draft-sel">
        <div className={`import-check ${selected ? 'on' : ''}`}>
          {selected ? '✓' : ''}
        </div>
      </div>
      <div className="import-draft-body">
        <div className="import-draft-name">{draft.name}</div>
        {allDates.length > 0 ? (
          <div className="import-draft-dates">
            {allDates.map((s, i) => (
              <span key={i} className="import-date-chip">{s}</span>
            ))}
          </div>
        ) : (
          <div className="import-draft-nodates">Nessuna data rilevata</div>
        )}
      </div>
    </div>
  );
}

export function ImageImportModal({ onImport, onNoGroqKey, onClose }) {
  const dialogRef = useDialog(onClose);
  const [dragging, setDragging] = useState(false);
  // images: { id, url, base64, mimeType } — loaded but not yet analysed
  const [images, setImages] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const reads = await Promise.all(
      validFiles.map(
        (f) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ url: e.target.result, file: f });
            reader.readAsDataURL(f);
          })
      )
    );

    setImages((prev) => [
      ...prev,
      ...reads.map((r, i) => ({
        id: `${Date.now()}_${i}`,
        url: r.url,
        base64: r.url.split(',')[1],
        mimeType: r.file.type,
      })),
    ]);
    setError(null);
    // Reset results so user knows they need to re-analyse after adding more
    setDrafts(null);
    setSelected(new Set());
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const extracted = await extractExamsFromImages(
        images.map(({ base64, mimeType }) => ({ base64, mimeType }))
      );
      if (!extracted || extracted.length === 0) {
        throw new Error("Nessun esame trovato nelle immagini. Prova con screenshot più chiari.");
      }
      setDrafts(extracted);
      setSelected(new Set(extracted.map((_, i) => i)));
    } catch (err) {
      if (err.code === 'NO_KEY') { onNoGroqKey(); return; }
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const removeImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setDrafts(null);
    setSelected(new Set());
    setError(null);
  };

  const toggleAll = () => {
    if (!drafts) return;
    if (selected.size === drafts.length) setSelected(new Set());
    else setSelected(new Set(drafts.map((_, i) => i)));
  };

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleImport = () => {
    if (!drafts) return;
    onImport(drafts.filter((_, i) => selected.has(i)));
  };

  const reset = () => {
    setImages([]);
    setDrafts(null);
    setSelected(new Set());
    setError(null);
  };

  const hasDrafts = drafts !== null && drafts.length > 0;
  const selectedCount = selected.size;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal modal-import" role="dialog" aria-modal="true" aria-labelledby="image-import-title">
        <div className="modal-hd">
          <div>
            <h2 id="image-import-title">Importa dal calendario</h2>
            <div className="sub">
              Carica uno o più screenshot — l'AI li analizza tutti insieme per ricostruire date e nomi completi.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className={`modal-body import-body${hasDrafts ? ' import-body-split' : ''}`} style={{ gap: 0, padding: 0 }}>

          {/* Left: dropzone + thumbnail strip */}
          <div className="import-left" style={{ justifyContent: images.length > 0 ? 'flex-start' : 'center' }}>

            {/* Dropzone */}
            <div
              className={`import-dropzone ${images.length > 0 ? 'compact' : ''} ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !analyzing && fileRef.current?.click()}
              style={{ cursor: analyzing ? 'default' : 'pointer' }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              {images.length > 0 ? (
                <>
                  <div className="import-dropzone-icon" style={{ fontSize: 18 }}>＋</div>
                  <div className="import-dropzone-text">Aggiungi altre foto</div>
                </>
              ) : (
                <>
                  <div className="import-dropzone-icon">📷</div>
                  <div className="import-dropzone-text">Seleziona gli screenshot</div>
                  <div className="import-dropzone-sub import-dropzone-sub-drag">o trascina qui i file</div>
                  <div className="import-dropzone-formats">JPG · PNG · WebP · HEIC</div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 0 && (
              <div className="import-thumbs">
                {images.map((img) => (
                  <div key={img.id} className={`import-thumb ${analyzing ? 'import-thumb-loading' : 'import-thumb-ready'}`}>
                    <img src={img.url} alt="" />
                    {analyzing && (
                      <div className="import-thumb-overlay">
                        <div className="spinner-sm" />
                      </div>
                    )}
                    {!analyzing && (
                      <button
                        className="import-thumb-remove"
                        onClick={() => removeImage(img.id)}
                        title="Rimuovi"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {analyzing && (
              <div className="import-loading">
                <div className="spinner" />
                <span>
                  Analisi {images.length} {images.length === 1 ? 'immagine' : 'immagini'} in corso…
                </span>
              </div>
            )}

            {error && (
              <div className="ai-error" style={{ margin: '12px 0 0' }}>
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {images.length > 0 && !analyzing && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="btn"
                  onClick={handleAnalyze}
                  style={{ flex: 1 }}
                >
                  Analizza {images.length} {images.length === 1 ? 'foto' : 'foto'}
                </button>
                <button className="import-change-btn" onClick={reset} title="Ricomincia">
                  ↩
                </button>
              </div>
            )}
          </div>

          {/* Right: extracted exams */}
          {hasDrafts && (
            <div className="import-right">
              <div className="import-right-hd">
                <span>
                  Trovati <strong>{drafts.length}</strong> esami
                </span>
                <button className="btn-text" onClick={toggleAll}>
                  {selected.size === drafts.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                </button>
              </div>
              <div className="import-drafts-list scroll">
                {drafts.map((draft, i) => (
                  <ExamDraftCard
                    key={i}
                    draft={draft}
                    selected={selected.has(i)}
                    onToggle={() => toggle(i)}
                  />
                ))}
              </div>
              <div className="import-right-hint">
                Clicca su ogni esame in sidebar per personalizzare effort, difficoltà e note.
              </div>
            </div>
          )}
        </div>

        <div className="modal-ft">
          {hasDrafts ? (
            <>
              <span className="field-hint">
                {selectedCount} {selectedCount === 1 ? 'esame selezionato' : 'esami selezionati'}
              </span>
              <button
                className="btn"
                onClick={handleImport}
                disabled={selectedCount === 0}
              >
                Importa {selectedCount > 0 ? selectedCount : ''} {selectedCount === 1 ? 'esame' : 'esami'}
              </button>
            </>
          ) : (
            <>
              <span className="field-hint">
                Gli screenshot vengono analizzati tramite Groq AI — non vengono salvati.
              </span>
              <button className="btn ghost" onClick={onClose}>Chiudi</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
