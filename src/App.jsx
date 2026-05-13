import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import {
  fetchExams, upsertExam, removeExam,
  fetchStudyWindows, replaceStudyWindows, removeStudyWindowsForExam,
  fetchDatePicks, replaceDatePicks, removeDatePicksForExam,
  updateStudyWindowComplete, clearPlan,
} from './lib/db.js';
import { TODAY } from './data.js';
import { hasGroqKey } from './utils/groq.js';
import { Sidebar } from './components/Sidebar.jsx';
import { MonthHeader } from './components/MonthHeader.jsx';
import { CalendarGrid } from './components/CalendarGrid.jsx';
import { WeekGrid } from './components/WeekGrid.jsx';
import { ExamForm } from './components/ExamForm.jsx';
import { TweaksPanel } from './components/TweaksPanel.jsx';
import { CalendarExportModal } from './components/CalendarExportModal.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { LandingScreen } from './components/LandingScreen.jsx';
import { GroqKeyModal } from './components/GroqKeyModal.jsx';
import { AIPlanModal } from './components/AIPlanModal.jsx';
import { StudyTimeline } from './components/StudyTimeline.jsx';
import { PomodoroTimer } from './components/PomodoroTimer.jsx';
import { ImageImportModal } from './components/ImageImportModal.jsx';
import { HelpModal } from './components/HelpModal.jsx';

const TWEAKS_LS_KEY = 'sessionly-tweaks';

const TWEAK_DEFAULTS = {
  palette: 'classic',
  font: 'unbounded',
  studyStyle: 'tratteggio',
  sliderStyle: 'ticks',
  dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  showOnboarding: false,
};

function loadTweaks() {
  try {
    const saved = localStorage.getItem(TWEAKS_LS_KEY);
    if (saved) return { ...TWEAK_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return TWEAK_DEFAULTS;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ── App data ───────────────────────────────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [studyWindows, setStudyWindows] = useState([]);
  const [datePicks, setDatePicks] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [tweaks, setTweaks] = useState(loadTweaks);
  const setTweak = (key, val) => setTweaks((prev) => ({ ...prev, [key]: val }));

  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(TODAY));
  const [view, setView] = useState('month');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showGroqKeyModal, setShowGroqKeyModal] = useState(false);
  const [showAIPlanModal, setShowAIPlanModal] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const [showHelp, setShowHelp] = useState(() => {
    try { return !localStorage.getItem('sessionly-help-seen'); } catch { return false; }
  });
  const [groqKeyAfterSave, setGroqKeyAfterSave] = useState(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Apply tweaks to <html> data-attributes and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = tweaks.palette;
    root.dataset.font = tweaks.font;
    root.dataset.dark = tweaks.dark ? '1' : '0';
    try { localStorage.setItem(TWEAKS_LS_KEY, JSON.stringify(tweaks)); } catch {}
  }, [tweaks]);

  // ── Load data from Supabase ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [examsData, windowsData, picksData] = await Promise.all([
        fetchExams(),
        fetchStudyWindows(),
        fetchDatePicks(),
      ]);
      setExams(examsData);
      setStudyWindows(windowsData);
      setDatePicks(picksData);
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Auth lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setAuthReady(true);
      if (newUser) {
        setShowAuthModal(false);
        loadData();
      } else {
        setExams([]);
        setStudyWindows([]);
        setDatePicks([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

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
      await upsertExam(savedExam, user.id);
    } catch (err) {
      setSaveError(`Errore salvataggio: ${err.message}`);
    }
  };

  const deleteExam = async (id) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
    setStudyWindows((prev) => prev.filter((s) => s.examId !== id));
    setDatePicks((prev) => prev.filter((p) => p.examId !== id));
    setModal(null);
    setSelectedId(null);

    try {
      await Promise.all([
        removeExam(id),
        removeStudyWindowsForExam(id),
        removeDatePicksForExam(id),
      ]);
    } catch (err) {
      setSaveError(`Errore eliminazione: ${err.message}`);
    }
  };

  // ── AI Plan ────────────────────────────────────────────────────────────────
  const handleAIPlan = () => {
    if (!hasGroqKey()) {
      setGroqKeyAfterSave('plan');
      setShowGroqKeyModal(true);
      return;
    }
    setShowAIPlanModal(true);
  };

  const handleSelectPlan = async (plan) => {
    setShowAIPlanModal(false);

    const picksForState = plan.date_picks.map((p) => ({
      examId: p.examId,
      componentName: p.componentName,
      date: new Date(p.date + 'T00:00:00'),
    }));

    const picksForDb = plan.date_picks.map((p) => ({
      examId: p.examId,
      componentName: p.componentName,
      date: p.date,
    }));

    const windows = plan.study_windows.map((w) => ({
      examId: w.examId,
      start: new Date(w.start + 'T00:00:00'),
      end: new Date(w.end + 'T00:00:00'),
      startTime: w.start_time || null,
      endTime: w.end_time || null,
      label: w.label || 'Studio',
    }));

    setDatePicks(picksForState);
    setStudyWindows(windows);
    setShowAllDates(false);

    try {
      await Promise.all([
        replaceDatePicks(picksForDb),
        replaceStudyWindows(windows),
      ]);
      // Reload to get server-assigned IDs for study windows (needed for completion toggle)
      const [windowsData, picksData] = await Promise.all([fetchStudyWindows(), fetchDatePicks()]);
      setStudyWindows(windowsData);
      setDatePicks(picksData);
    } catch (err) {
      setSaveError(`Errore salvataggio piano: ${err.message}`);
    }
  };

  const handleRemovePlan = async () => {
    setDatePicks([]);
    setStudyWindows([]);
    setShowAllDates(false);
    try {
      await clearPlan();
    } catch (err) {
      setSaveError(`Errore rimozione piano: ${err.message}`);
    }
  };

  const handleToggleStudyComplete = async (windowId) => {
    if (!windowId) return;
    const win = studyWindows.find((w) => w.id === windowId);
    if (!win) return;
    const newCompleted = !win.completed;
    setStudyWindows((prev) =>
      prev.map((w) => w.id === windowId ? { ...w, completed: newCompleted } : w)
    );
    try {
      await updateStudyWindowComplete(windowId, newCompleted);
    } catch (err) {
      setSaveError(`Errore aggiornamento: ${err.message}`);
    }
  };

  const handleImportExams = async (drafts) => {
    setShowImageImport(false);
    const newExams = drafts.map((d) => ({ ...d, id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2) }));
    setExams((prev) => [...prev, ...newExams]);
    setTweak('showOnboarding', false);
    try {
      await Promise.all(newExams.map((e) => upsertExam(e, user.id)));
    } catch (err) {
      setSaveError(`Errore salvataggio: ${err.message}`);
    }
  };

  const handleGroqKeySaved = () => {
    const runPlan = groqKeyAfterSave === 'plan';
    setShowGroqKeyModal(false);
    setGroqKeyAfterSave(null);
    if (runPlan) setShowAIPlanModal(true);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navMonth = (delta) => {
    let nm = month + delta;
    let ny = year;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setMonth(nm);
    setYear(ny);
  };

  const goToday = () => {
    setMonth(TODAY.getMonth());
    setYear(TODAY.getFullYear());
  };

  const navWeek = (delta) => {
    setWeekStart((ws) => new Date(ws.getTime() + delta * 7 * 86400000));
  };

  const goTodayWeek = () => setWeekStart(getWeekStart(TODAY));

  const openEdit = (id) => {
    setSelectedId(id);
    setModal({ mode: 'edit', id });
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (!authReady) return <AppLoading />;

  if (!user) {
    return (
      <>
        <LandingScreen onOpenAuth={() => setShowAuthModal(true)} />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    );
  }

  if (dataLoading && exams.length === 0) return <AppLoading />;

  const visibleExams = tweaks.showOnboarding ? [] : exams;
  const visibleStudy = tweaks.showOnboarding ? [] : studyWindows;
  const visiblePicks = tweaks.showOnboarding ? [] : datePicks;
  const initial = modal?.mode === 'edit' ? exams.find((e) => e.id === modal.id) : null;
  const hasPlan = visiblePicks.length > 0;

  return (
    <div className="app">
      <Sidebar
        exams={visibleExams}
        studyWindows={visibleStudy}
        today={TODAY}
        selectedId={selectedId}
        onSelect={openEdit}
        onAdd={() => setModal({ mode: 'new' })}
        onImportImage={() => setShowImageImport(true)}
        onHelp={() => setShowHelp(true)}
      />

      <main className="main">
        <MonthHeader
          year={year}
          month={month}
          weekStart={weekStart}
          onPrev={view === 'week' ? () => navWeek(-1) : () => navMonth(-1)}
          onNext={view === 'week' ? () => navWeek(1) : () => navMonth(1)}
          onToday={view === 'week' ? goTodayWeek : goToday}
          view={view}
          onView={setView}
          onAIPlan={handleAIPlan}
          hasPlan={hasPlan}
          onRemovePlan={handleRemovePlan}
          showAllDates={showAllDates}
          onToggleAllDates={() => setShowAllDates((v) => !v)}
          onExport={() => setShowExport(true)}
          user={user}
          onLogout={handleLogout}
        />

        {saveError && (
          <div className="ai-error" style={{ margin: '12px 32px 0' }}>
            <span>⚠</span>
            <span>{saveError}</span>
            <button
              style={{ marginLeft: 'auto', appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 16 }}
              onClick={() => setSaveError(null)}
            >✕</button>
          </div>
        )}

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

        <StudyTimeline exams={visibleExams} datePicks={visiblePicks} today={TODAY} />

        {tweaks.showOnboarding || exams.length === 0 ? (
          <EmptyState onAdd={() => setModal({ mode: 'new' })} />
        ) : view === 'week' ? (
          <WeekGrid
            weekStart={weekStart}
            exams={visibleExams}
            studyWindows={visibleStudy}
            datePicks={visiblePicks}
            showAllDates={showAllDates}
            today={TODAY}
            studyStyle={tweaks.studyStyle}
            onSelectExam={openEdit}
            onToggleStudyComplete={handleToggleStudyComplete}
          />
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            exams={visibleExams}
            studyWindows={visibleStudy}
            datePicks={visiblePicks}
            showAllDates={showAllDates}
            today={TODAY}
            studyStyle={tweaks.studyStyle}
            onSelectExam={openEdit}
            onToggleStudyComplete={handleToggleStudyComplete}
          />
        )}
      </main>

      {modal && (
        <ExamForm
          initial={initial}
          sliderStyle={tweaks.sliderStyle}
          today={TODAY}
          onClose={() => setModal(null)}
          onSave={saveExam}
          onDelete={deleteExam}
          onNoGroqKey={() => { setGroqKeyAfterSave(null); setShowGroqKeyModal(true); }}
        />
      )}

      {showExport && (
        <CalendarExportModal
          exams={exams}
          datePicks={visiblePicks}
          onClose={() => setShowExport(false)}
        />
      )}

      {showGroqKeyModal && (
        <GroqKeyModal
          onClose={() => setShowGroqKeyModal(false)}
          onSaved={handleGroqKeySaved}
        />
      )}

      {showAIPlanModal && (
        <AIPlanModal
          exams={exams}
          hasPlan={hasPlan}
          onSelectPlan={handleSelectPlan}
          onNoGroqKey={() => {
            setShowAIPlanModal(false);
            setGroqKeyAfterSave('plan');
            setShowGroqKeyModal(true);
          }}
          onClose={() => setShowAIPlanModal(false)}
        />
      )}

      {showImageImport && (
        <ImageImportModal
          onImport={handleImportExams}
          onNoGroqKey={() => { setShowImageImport(false); setGroqKeyAfterSave(null); setShowGroqKeyModal(true); }}
          onClose={() => setShowImageImport(false)}
        />
      )}

      {showHelp && <HelpModal onClose={() => {
        try { localStorage.setItem('sessionly-help-seen', '1'); } catch {}
        setShowHelp(false);
      }} />}

      <TweaksPanel tweaks={tweaks} onTweak={setTweak} onGroqKey={() => setShowGroqKeyModal(true)} />
      <PomodoroTimer />
    </div>
  );
}
