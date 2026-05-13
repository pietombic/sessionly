import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import {
  fetchExams, upsertExam, removeExam,
  fetchStudyWindows, replaceStudyWindows, removeStudyWindowsForExam,
} from './lib/db.js';
import { TODAY } from './data.js';
import { generateStudyPlan } from './utils/groq.js';
import { Sidebar } from './components/Sidebar.jsx';
import { MonthHeader } from './components/MonthHeader.jsx';
import { CalendarGrid } from './components/CalendarGrid.jsx';
import { ExamForm } from './components/ExamForm.jsx';
import { TweaksPanel } from './components/TweaksPanel.jsx';
import { CalendarExportModal } from './components/CalendarExportModal.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { LandingScreen } from './components/LandingScreen.jsx';

const TWEAK_DEFAULTS = {
  palette: 'classic',
  font: 'lora',
  studyStyle: 'tratteggio',
  sliderStyle: 'ticks',
  dark: false,
  showOnboarding: false,
};

function AppLoading() {
  return (
    <div className="app-loading">
      <div className="spinner" />
      <span>Caricamento…</span>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="empty">
      <div className="ornament">~ ❦ ~</div>
      <h2>La tua sessione, ordinata.</h2>
      <p className="blurb">
        Aggiungi gli esami che ti aspettano, indica effort e difficoltà,
        e lascia che il calendario ti dica cosa studiare e quando.
      </p>
      <div style={{ marginTop: 14 }}>
        <button className="btn" onClick={onAdd}>+ Aggiungi il primo esame</button>
      </div>
      <div className="steps">
        <div className="step">
          <div className="num">01</div>
          <h4>Inserisci</h4>
          <p>Nome, tipo, date. Anche più date alternative per scritto e orale.</p>
        </div>
        <div className="step">
          <div className="num">02</div>
          <h4>Pesa</h4>
          <p>Slider per effort e difficoltà. Le date bloccate si tengono ferme.</p>
        </div>
        <div className="step">
          <div className="num">03</div>
          <h4>Studia</h4>
          <p>Blocchi di studio generati dall'AI compaiono prima di ogni esame.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [authReady, setAuthReady] = useState(false); // true once we know if user is logged in
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ── App data ───────────────────────────────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [studyWindows, setStudyWindows] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const setTweak = (key, val) => setTweaks((prev) => ({ ...prev, [key]: val }));

  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth());
  const [view, setView] = useState('month');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Apply tweaks to <html> data-attributes for CSS token switching
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = tweaks.palette;
    root.dataset.font = tweaks.font;
    root.dataset.dark = tweaks.dark ? '1' : '0';
  }, [tweaks.palette, tweaks.font, tweaks.dark]);

  // ── Load data from Supabase ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [examsData, windowsData] = await Promise.all([fetchExams(), fetchStudyWindows()]);
      setExams(examsData);
      setStudyWindows(windowsData);
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Auth lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Check initial session (handles OAuth redirects automatically)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setAuthReady(true);
      if (newUser) {
        setShowAuthModal(false);
        loadData();
      } else {
        // Logged out — clear data
        setExams([]);
        setStudyWindows([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  // Load data when user first becomes available
  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Exam CRUD ──────────────────────────────────────────────────────────────
  const saveExam = async (draft) => {
    let savedExam;
    if (modal?.mode === 'edit') {
      savedExam = { ...draft, id: modal.id };
      setExams((prev) => prev.map((e) => e.id === modal.id ? savedExam : e));
    } else {
      savedExam = { ...draft, id: 'ex_' + Date.now() };
      setExams((prev) => [...prev, savedExam]);
    }
    setModal(null);
    setTweak('showOnboarding', false);

    try {
      await upsertExam(savedExam);
    } catch (err) {
      console.error('Errore salvataggio esame:', err);
    }
  };

  const deleteExam = async (id) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
    setStudyWindows((prev) => prev.filter((s) => s.examId !== id));
    setModal(null);
    setSelectedId(null);

    try {
      await Promise.all([removeExam(id), removeStudyWindowsForExam(id)]);
    } catch (err) {
      console.error('Errore eliminazione esame:', err);
    }
  };

  // ── AI Plan ────────────────────────────────────────────────────────────────
  const handleAIPlan = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const windows = await generateStudyPlan(exams);
      setStudyWindows(windows);
      await replaceStudyWindows(windows);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navMonth = (delta) => {
    setMonth((m) => {
      let nm = m + delta, ny = year;
      if (nm < 0) { nm = 11; ny--; }
      if (nm > 11) { nm = 0; ny++; }
      setYear(ny);
      return nm;
    });
  };

  const goToday = () => {
    setMonth(TODAY.getMonth());
    setYear(TODAY.getFullYear());
  };

  const openEdit = (id) => {
    setSelectedId(id);
    setModal({ mode: 'edit', id });
  };

  // ── Render states ──────────────────────────────────────────────────────────

  // 1. Waiting for Supabase to tell us if user is logged in
  if (!authReady) return <AppLoading />;

  // 2. Not logged in → Landing + optional auth modal
  if (!user) {
    return (
      <>
        <LandingScreen onOpenAuth={() => setShowAuthModal(true)} />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    );
  }

  // 3. Logged in but still fetching data
  if (dataLoading && exams.length === 0) return <AppLoading />;

  // 4. Full app
  const visibleExams = tweaks.showOnboarding ? [] : exams;
  const visibleStudy = tweaks.showOnboarding ? [] : studyWindows;
  const initial = modal?.mode === 'edit' ? exams.find((e) => e.id === modal.id) : null;

  return (
    <div className="app">
      <Sidebar
        exams={visibleExams}
        today={TODAY}
        selectedId={selectedId}
        onSelect={openEdit}
        onAdd={() => setModal({ mode: 'new' })}
      />

      <main className="main">
        <MonthHeader
          year={year}
          month={month}
          onPrev={() => navMonth(-1)}
          onNext={() => navMonth(1)}
          onToday={goToday}
          view={view}
          onView={setView}
          onAIPlan={handleAIPlan}
          aiLoading={aiLoading}
          onExport={() => setShowExport(true)}
          user={user}
          onLogout={handleLogout}
        />

        {aiError && (
          <div className="ai-error" style={{ margin: '12px 32px 0' }}>
            <span>⚠</span>
            <span>{aiError}</span>
            <button
              style={{ marginLeft: 'auto', appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 16 }}
              onClick={() => setAiError(null)}
            >✕</button>
          </div>
        )}

        {tweaks.showOnboarding || exams.length === 0 ? (
          <EmptyState onAdd={() => setModal({ mode: 'new' })} />
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            exams={visibleExams}
            studyWindows={visibleStudy}
            today={TODAY}
            studyStyle={tweaks.studyStyle}
            onSelectExam={openEdit}
          />
        )}
      </main>

      {modal && (
        <ExamForm
          initial={initial}
          sliderStyle={tweaks.sliderStyle}
          onClose={() => setModal(null)}
          onSave={saveExam}
          onDelete={deleteExam}
        />
      )}

      {showExport && (
        <CalendarExportModal
          exams={exams}
          onClose={() => setShowExport(false)}
        />
      )}

      <TweaksPanel tweaks={tweaks} onTweak={setTweak} />
    </div>
  );
}
