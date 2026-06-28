import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase.js';
import {
  fetchExams, upsertExam, deleteExamData,
  fetchStudyWindows,
  fetchDatePicks,
  updateStudyWindowComplete, clearPlan,
  buildStudyEvents, replacePlanAtomically, deleteEvent,
  fetchEvents, updateEvent, createManualSessions,
  fetchOnboardingCompleted, completeOnboarding,
  updateExamDateAndTasks,
} from './lib/db.js';
import { hasGroqKey } from './utils/groq.js';
import { Sidebar } from './components/Sidebar.jsx';
import { MonthHeader } from './components/MonthHeader.jsx';
import { CalendarGrid } from './components/CalendarGrid.jsx';
import { WeekGrid } from './components/WeekGrid.jsx';
import { LandingScreen } from './components/LandingScreen.jsx';
import { StudyTimeline } from './components/StudyTimeline.jsx';
import { EmailConfirmedScreen } from './components/EmailConfirmedScreen.jsx';
import { ExamDashboard } from './components/ExamDashboard.jsx';
import { TodayDashboard } from './components/TodayDashboard.jsx';
import { ToastStack } from './components/ToastStack.jsx';

const lazyNamed = (loader, name) =>
  lazy(() => loader().then((module) => ({ default: module[name] })));

const AuthModal = lazyNamed(() => import('./components/AuthModal.jsx'), 'AuthModal');
const ExamForm = lazyNamed(() => import('./components/ExamForm.jsx'), 'ExamForm');
const SettingsModal = lazyNamed(() => import('./components/SettingsModal.jsx'), 'SettingsModal');
const CalendarExportModal = lazyNamed(() => import('./components/CalendarExportModal.jsx'), 'CalendarExportModal');
const GroqKeyModal = lazyNamed(() => import('./components/GroqKeyModal.jsx'), 'GroqKeyModal');
const AIPlanModal = lazyNamed(() => import('./components/AIPlanModal.jsx'), 'AIPlanModal');
const ImageImportModal = lazyNamed(() => import('./components/ImageImportModal.jsx'), 'ImageImportModal');
const HelpModal = lazyNamed(() => import('./components/HelpModal.jsx'), 'HelpModal');
const EventDetailModal = lazyNamed(() => import('./components/EventDetailModal.jsx'), 'EventDetailModal');
const NewSessionModal = lazyNamed(() => import('./components/NewSessionModal.jsx'), 'NewSessionModal');
const DaySummaryModal = lazyNamed(() => import('./components/DaySummaryModal.jsx'), 'DaySummaryModal');
const OnboardingModal = lazyNamed(() => import('./components/OnboardingModal.jsx'), 'OnboardingModal');

const TWEAKS_LS_KEY = 'sessionly-tweaks';

const TWEAK_DEFAULTS = {
  palette: 'classic',
  font: 'unbounded',
  studyStyle: 'band',
  sliderStyle: 'ticks',
  defaultView: 'month',
  density: 'comfortable',
  animations: true,
  showTimeline: true,
  dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
};

function loadTweaks() {
  try {
    const saved = localStorage.getItem(TWEAKS_LS_KEY);
    if (saved) return { ...TWEAK_DEFAULTS, ...JSON.parse(saved) };
  } catch { }
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

function dateKey(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function examTaskMoves(previousExam, nextExam) {
  if (!previousExam) return [];
  const moves = [];
  previousExam.components?.forEach((oldComponent, componentIndex) => {
    const newComponent = nextExam.components?.find((component) => component.name === oldComponent.name)
      || nextExam.components?.[componentIndex];
    if (!newComponent) return;
    oldComponent.dates?.forEach((oldDate, dateIndex) => {
      const newDate = oldDate.id
        ? newComponent.dates?.find((date) => date.id === oldDate.id)
        : newComponent.dates?.[dateIndex];
      const oldKey = dateKey(oldDate.date);
      const newKey = dateKey(newDate?.date);
      if (!oldKey || !newKey) return;
      if (oldKey === newKey && oldComponent.name === newComponent.name) return;
      moves.push({
        oldRef: `exam:${previousExam.id}:${oldComponent.name}:${oldKey}`,
        newRef: `exam:${nextExam.id}:${newComponent.name}:${newKey}`,
        oldComponent: oldComponent.name,
        newComponent: newComponent.name,
        oldDate: oldKey,
        newDate: newKey,
      });
    });
  });
  return moves;
}

function applyPickMoves(picks, examId, moves) {
  return picks.map((pick) => {
    if (pick.examId !== examId) return pick;
    const move = moves.find((entry) =>
      entry.oldComponent === pick.componentName
      && entry.oldDate === dateKey(pick.date)
    );
    if (!move) return pick;
    return {
      ...pick,
      componentName: move.newComponent,
      date: new Date(`${move.newDate}T00:00:00`),
    };
  });
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
  const [showEmailConfirmed, setShowEmailConfirmed] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    return hash.get('type') === 'signup' || query.get('type') === 'signup';
  });

  // ── App data ───────────────────────────────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [studyWindows, setStudyWindows] = useState([]);
  const [datePicks, setDatePicks] = useState([]);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [tweaks, setTweaks] = useState(loadTweaks);
  const setTweak = (key, val) => setTweaks((prev) => ({ ...prev, [key]: val }));

  const [today, setToday] = useState(() => new Date());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [view, setView] = useState(() => tweaks.defaultView || 'month');
  const [workspaceView, setWorkspaceView] = useState(() => {
    try {
      const saved = localStorage.getItem('sessionly-workspace-view');
      return ['today', 'calendar', 'exams'].includes(saved) ? saved : 'today';
    }
    catch { return 'today'; }
  });
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return localStorage.getItem('sessionly-sidebar-hidden') === 'true'; }
    catch { return false; }
  });
  const mobileTab = workspaceView;
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showGroqKeyModal, setShowGroqKeyModal] = useState(false);
  const [showAIPlanModal, setShowAIPlanModal] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [helpMode, setHelpMode] = useState(null);
  const [groqKeyAfterSave, setGroqKeyAfterSave] = useState(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);
  const [daySummary, setDaySummary] = useState(null);
  const [toasts, setToasts] = useState([]);
  const initializedUserRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current.slice(-3), { id, type, message }]);
  }, []);

  const changeWorkspace = useCallback((nextView) => {
    setWorkspaceView(nextView);
  }, []);

  // Apply tweaks to <html> data-attributes and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = tweaks.palette;
    root.dataset.font = tweaks.font;
    root.dataset.dark = tweaks.dark ? '1' : '0';
    root.dataset.density = tweaks.density;
    root.dataset.animations = tweaks.animations ? '1' : '0';
    try { localStorage.setItem(TWEAKS_LS_KEY, JSON.stringify(tweaks)); } catch { }
  }, [tweaks]);

  // Persist main workspace preference
  useEffect(() => {
    try { localStorage.setItem('sessionly-workspace-view', workspaceView); }
    catch { }
  }, [workspaceView]);

  useEffect(() => {
    try { localStorage.setItem('sessionly-sidebar-hidden', String(sidebarHidden)); }
    catch { }
  }, [sidebarHidden]);

  useEffect(() => {
    let timeout;
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 50);
      timeout = window.setTimeout(() => {
        setToday(new Date());
        scheduleMidnightRefresh();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnightRefresh();
    return () => window.clearTimeout(timeout);
  }, []);

  // ── Load data from Supabase ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [examsData, windowsData, picksData, eventsData] = await Promise.all([
        fetchExams(),
        fetchStudyWindows(),
        fetchDatePicks(),
        fetchEvents(),
      ]);
      setExams(examsData);
      setStudyWindows(windowsData);
      setDatePicks(picksData);
      setEvents(eventsData);
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const syncOnboarding = useCallback(async (currentUser) => {
    if (!currentUser?.id) return;
    const fallbackKey = `sessionly-onboarding-completed:${currentUser.id}`;
    let localCompleted = false;
    try { localCompleted = localStorage.getItem(fallbackKey) === '1'; } catch { }

    try {
      const remoteCompleted = await fetchOnboardingCompleted(currentUser.id);
      const completed = remoteCompleted || localCompleted;
      setHelpMode(completed ? null : 'onboarding');

      // Se il database non era disponibile durante una chiusura precedente,
      // riallinea automaticamente il valore remoto dal fallback locale.
      if (localCompleted && !remoteCompleted) {
        completeOnboarding(currentUser.id).catch(() => {});
      }
    } catch (err) {
      console.warn('Preferenza onboarding non disponibile:', err);
      setHelpMode(localCompleted ? null : 'onboarding');
    }
  }, []);

  const initializeAuthenticatedUser = useCallback((currentUser) => {
    if (!currentUser?.id) return;
    if (initializedUserRef.current === currentUser.id) return;
    initializedUserRef.current = currentUser.id;
    loadData();
    syncOnboarding(currentUser);
  }, [loadData, syncOnboarding]);

  // ── Auth lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setAuthReady(true);
      if (sessionUser) initializeAuthenticatedUser(sessionUser);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setAuthReady(true);
      if (newUser) {
        setShowAuthModal(false);
        initializeAuthenticatedUser(newUser);
      } else {
        initializedUserRef.current = null;
        setExams([]);
        setStudyWindows([]);
        setDatePicks([]);
        setEvents([]);
        setHelpMode(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeAuthenticatedUser]);

  const completeFirstRun = async () => {
    setHelpMode(null);
    if (!user?.id) return;

    const fallbackKey = `sessionly-onboarding-completed:${user.id}`;
    try { localStorage.setItem(fallbackKey, '1'); } catch { }

    try {
      await completeOnboarding(user.id);
    } catch (err) {
      console.warn('Impossibile salvare onboarding nel database:', err);
    }
  };

  const closeHelp = () => {
    if (helpMode === 'onboarding') {
      completeFirstRun();
    } else {
      setHelpMode(null);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Exam CRUD ──────────────────────────────────────────────────────────────
  const saveExam = async (draft) => {
    const previousExams = exams;
    const mode = modal?.mode;
    let savedExam;
    if (mode === 'edit') {
      savedExam = { ...draft, id: modal.id };
      setExams((prev) => prev.map((e) => e.id === modal.id ? savedExam : e));
    } else {
      savedExam = { ...draft, id: 'ex_' + Date.now() };
    setExams((prev) => [...prev, savedExam]);
    }
    try {
      const previousExam = mode === 'edit'
        ? previousExams.find((exam) => exam.id === savedExam.id)
        : null;
      const taskMoves = examTaskMoves(previousExam, savedExam);
      await upsertExam(savedExam, user.id, taskMoves);
      if (taskMoves.length) {
        setDatePicks((current) => applyPickMoves(current, savedExam.id, taskMoves));
      }
      setModal(null);
      notify('success', mode === 'edit' ? 'Esame aggiornato.' : 'Esame aggiunto.');
    } catch (err) {
      setExams(previousExams);
      notify('error', `Errore salvataggio: ${err.message}`);
      throw err;
    }
  };

  const deleteExam = async (id) => {
    try {
      await deleteExamData(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
      setStudyWindows((prev) => prev.filter((s) => s.examId !== id));
      setDatePicks((prev) => prev.filter((p) => p.examId !== id));
      setEvents((prev) => prev.filter((event) => event.exam_id !== id));
      setModal(null);
      setSelectedId(null);
      notify('success', 'Esame eliminato.');
    } catch (err) {
      notify('error', `Errore eliminazione: ${err.message}`);
      throw err;
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

  const handleSelectPlan = async (plan, studyPrefs) => {
    setShowAIPlanModal(false);
    const previous = { datePicks, studyWindows, events };

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
      label: '',
    }));

    try {
      const eventRows = await buildStudyEvents(plan.study_windows, exams, {
        ...studyPrefs,
        slotAssignments: plan.slot_assignments || [],
      }, user.id);

      setDatePicks(picksForState);
      setStudyWindows(windows);
      setShowAllDates(false);

      await replacePlanAtomically(picksForDb, windows, eventRows);

      // Ricarica per avere gli ID server-assigned di windows e sessioni
      const [windowsData, picksData, eventsData] = await Promise.all([
        fetchStudyWindows(), fetchDatePicks(), fetchEvents(),
      ]);
      setStudyWindows(windowsData);
      setDatePicks(picksData);
      setEvents(eventsData);
      changeWorkspace('today');
      notify('success', 'Piano AI creato e aggiunto al calendario.');
    } catch (err) {
      setDatePicks(previous.datePicks);
      setStudyWindows(previous.studyWindows);
      setEvents(previous.events);
      notify('error', `Errore salvataggio piano: ${err.message}`);
    }
  };

  const handleRemovePlan = async () => {
    const previous = { datePicks, studyWindows, events };
    setDatePicks([]);
    setStudyWindows([]);
    setEvents((current) => current.filter((event) =>
      !(event.origin === 'ai' && event.status === 'planned')
    ));
    setShowAllDates(false);
    try {
      await clearPlan();
      notify('success', 'Piano rimosso.');
    } catch (err) {
      setDatePicks(previous.datePicks);
      setStudyWindows(previous.studyWindows);
      setEvents(previous.events);
      notify('error', `Errore rimozione piano: ${err.message}`);
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
      setStudyWindows((prev) =>
        prev.map((w) => w.id === windowId ? { ...w, completed: !newCompleted } : w)
      );
      notify('error', `Errore aggiornamento: ${err.message}`);
    }
  };

  const handleOpenEventDetail = (detail) => setEventDetail(detail);

  const handleSaveExamDate = async (examId, componentName, oldDateISO, patch) => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;
    const updatedExam = {
      ...exam,
      components: exam.components.map((c) =>
        c.name === componentName
          ? {
              ...c,
              dates: c.dates.map((d) => {
                const dISO = d.date
                  ? `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`
                  : '';
                return dISO === oldDateISO ? { ...d, ...patch } : d;
              }),
            }
          : c
      ),
    };
    // Update state directly (bypasses modal check in saveExam)
    setExams((prev) => prev.map((e) => e.id === examId ? updatedExam : e));
    try {
      const nextDate = patch.date
        ? `${patch.date.getFullYear()}-${String(patch.date.getMonth() + 1).padStart(2, '0')}-${String(patch.date.getDate()).padStart(2, '0')}`
        : oldDateISO;
      await updateExamDateAndTasks(updatedExam, componentName, oldDateISO, nextDate);
      setDatePicks((current) => applyPickMoves(current, examId, [{
        oldComponent: componentName,
        newComponent: componentName,
        oldDate: oldDateISO,
        newDate: nextDate,
      }]));
      notify('success', 'Data dell’esame aggiornata.');
    } catch (err) {
      setExams((prev) => prev.map((e) => e.id === examId ? exam : e));
      notify('error', `Errore salvataggio data: ${err.message}`);
      throw err;
    }
  };

  // Aggiorna una singola sessione (status / notes / title) — solo quell'evento.
  const handleUpdateSession = async (eventId, patch) => {
    const prev = events.find((e) => e.id === eventId);
    setEvents((es) => es.map((e) => e.id === eventId ? { ...e, ...patch } : e));
    try {
      await updateEvent(eventId, patch);
    } catch (err) {
      if (prev) setEvents((es) => es.map((e) => e.id === eventId ? prev : e));
      notify('error', `Errore aggiornamento sessione: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteSession = async (eventId) => {
    const removed = events.find((e) => e.id === eventId);
    setEvents((es) => es.filter((e) => e.id !== eventId));
    try {
      await deleteEvent(eventId);
      notify('success', 'Sessione eliminata.');
      return true;
    } catch (err) {
      if (removed) {
        setEvents((es) => [...es, removed].sort(
          (a, b) => new Date(a.start_time) - new Date(b.start_time)
        ));
      }
      notify('error', `Errore eliminazione sessione: ${err.message}`);
      return false;
    }
  };

  const handleCreateSessions = async (params) => {
    try {
      const created = await createManualSessions(params);
      if (created?.length) setEvents((es) => [...es, ...created]);
      notify('success', `${created?.length || 0} session${created?.length === 1 ? 'e creata' : 'i create'}.`);
    } catch (err) {
      notify('error', `Errore creazione sessioni: ${err.message}`);
      throw err;
    }
  };

  const handleImportExams = async (drafts) => {
    setShowImageImport(false);
    const newExams = drafts.map((d) => ({ ...d, id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2) }));
    const previousExams = exams;
    setExams((prev) => [...prev, ...newExams]);
    try {
      await Promise.all(newExams.map((e) => upsertExam(e, user.id)));
      notify('success', `${newExams.length} esam${newExams.length === 1 ? 'e importato' : 'i importati'}.`);
    } catch (err) {
      setExams(previousExams);
      notify('error', `Errore salvataggio: ${err.message}`);
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
    const now = new Date();
    setToday(now);
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const navWeek = (delta) => {
    setWeekStart((ws) => new Date(ws.getTime() + delta * 7 * 86400000));
  };

  const goTodayWeek = () => {
    const now = new Date();
    setToday(now);
    setWeekStart(getWeekStart(now));
  };

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
        <Suspense fallback={null}>
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </Suspense>
      </>
    );
  }

  if (showEmailConfirmed) {
    return (
      <EmailConfirmedScreen
        onContinue={() => {
          history.replaceState(null, '', window.location.pathname);
          setShowEmailConfirmed(false);
        }}
      />
    );
  }

  if (dataLoading && exams.length === 0) return <AppLoading />;

  const initial = modal?.mode === 'edit' ? exams.find((e) => e.id === modal.id) : null;
  const hasPlan = datePicks.length > 0;

  return (
    <div className={`app${sidebarHidden ? ' sidebar-collapsed' : ''}`} data-mobile-tab={mobileTab}>
      <a className="skip-link" href="#main-content">Vai al contenuto principale</a>
      {sidebarHidden && (
        <button
          className="sidebar-reveal-button"
          onClick={() => setSidebarHidden(false)}
          title="Mostra barra laterale"
          aria-label="Mostra barra laterale"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M11 9l3 3-3 3" />
          </svg>
        </button>
      )}
      <Sidebar
        exams={exams}
        studyWindows={studyWindows}
        datePicks={datePicks}
        today={today}
        selectedId={selectedId}
        onSelect={openEdit}
        onAdd={() => setModal({ mode: 'new' })}
        onImportImage={() => setShowImageImport(true)}
        onHelp={() => setHelpMode('guide')}
        user={user}
        onOpenSettings={() => setShowSettings(true)}
        onCollapse={() => setSidebarHidden(true)}
      />

      <main className="main" id="main-content">
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
          workspaceView={workspaceView}
          onWorkspaceView={changeWorkspace}
          onNewExam={() => setModal({ mode: 'new' })}
          onNewSession={() => setShowNewSession(true)}
        />

        {tweaks.showTimeline && workspaceView === 'calendar' && (
          <StudyTimeline exams={exams} datePicks={datePicks} today={today} />
        )}

        {exams.length === 0 ? (
          <EmptyState onAdd={() => setModal({ mode: 'new' })} />
        ) : workspaceView === 'today' ? (
          <TodayDashboard
            exams={exams}
            events={events}
            datePicks={datePicks}
            today={today}
            onOpenSession={handleOpenEventDetail}
            onNewSession={() => setShowNewSession(true)}
            onOpenExam={openEdit}
            onOpenCalendar={() => changeWorkspace('calendar')}
          />
        ) : workspaceView === 'exams' ? (
          <ExamDashboard
            exams={exams}
            events={events}
            datePicks={datePicks}
            today={today}
            onSelectExam={openEdit}
          />
        ) : view === 'week' ? (
          <WeekGrid
            weekStart={weekStart}
            exams={exams}
            events={events}
            datePicks={datePicks}
            showAllDates={showAllDates}
            today={today}
            studyStyle={tweaks.studyStyle}
            onSelectExam={openEdit}
            onToggleStudyComplete={handleToggleStudyComplete}
            onRemoveStudyWindow={handleDeleteSession}
            onOpenEventDetail={handleOpenEventDetail}
            onMoveSession={handleUpdateSession}
          />
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            exams={exams}
            events={events}
            datePicks={datePicks}
            showAllDates={showAllDates}
            today={today}
            studyStyle={tweaks.studyStyle}
            onSelectExam={openEdit}
            onToggleStudyComplete={handleToggleStudyComplete}
            onRemoveStudyWindow={handleDeleteSession}
            onOpenEventDetail={handleOpenEventDetail}
            onOpenDaySummary={setDaySummary}
          />
        )}
      </main>

      <Suspense fallback={null}>
        {modal && (
          <ExamForm
            initial={initial}
            allExams={exams}
            sliderStyle={tweaks.sliderStyle}
            today={today}
            onClose={() => setModal(null)}
            onSave={saveExam}
            onDelete={deleteExam}
            onNoGroqKey={() => { setGroqKeyAfterSave(null); setShowGroqKeyModal(true); }}
          />
        )}

        {showExport && (
          <CalendarExportModal
            exams={exams}
            datePicks={datePicks}
            showAllDates={showAllDates}
            studyEvents={events}
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

        {helpMode === 'onboarding' && (
          <OnboardingModal
            onComplete={completeFirstRun}
            onOpenGuide={() => {
              completeFirstRun();
              setHelpMode('guide');
            }}
          />
        )}

        {helpMode === 'guide' && <HelpModal onClose={closeHelp} />}

        {daySummary && (
          <DaySummaryModal
            summary={daySummary}
            onOpenEvent={(detail) => {
              setDaySummary(null);
              handleOpenEventDetail(detail);
            }}
            onClose={() => setDaySummary(null)}
          />
        )}

        {eventDetail && (
          <EventDetailModal
            detail={eventDetail}
            onSaveExamDate={handleSaveExamDate}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onOpenFullEditor={(examId) => {
              setEventDetail(null);
              openEdit(examId);
            }}
            onClose={() => setEventDetail(null)}
          />
        )}

        {showNewSession && (
          <NewSessionModal
            exams={exams}
            today={today}
            onCreate={handleCreateSessions}
            onClose={() => setShowNewSession(false)}
          />
        )}

        {showSettings && (
          <SettingsModal
            tweaks={tweaks}
            onTweak={(key, value) => {
              setTweak(key, value);
              if (key === 'defaultView') setView(value);
            }}
            onGroqKey={() => {
              setShowSettings(false);
              setShowGroqKeyModal(true);
            }}
            onImport={() => {
              setShowSettings(false);
              setShowImageImport(true);
            }}
            onHelp={() => {
              setShowSettings(false);
              setHelpMode('guide');
            }}
            user={user}
            onLogout={handleLogout}
            onClose={() => setShowSettings(false)}
          />
        )}
      </Suspense>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <nav className="mobile-tabbar" aria-label="Navigazione">
        <button
          className={`mobile-tab ${mobileTab === 'today' ? 'active' : ''}`}
          onClick={() => {
            changeWorkspace('today');
          }}
          aria-label="Oggi"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" />
          </svg>
          <span>Oggi</span>
        </button>
        <button
          className={`mobile-tab ${mobileTab === 'calendar' ? 'active' : ''}`}
          onClick={() => {
            changeWorkspace('calendar');
          }}
          aria-label="Calendario"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Calendario</span>
        </button>
        <button
          className={`mobile-tab ${mobileTab === 'exams' ? 'active' : ''}`}
          onClick={() => {
            changeWorkspace('exams');
          }}
          aria-label="Esami"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span>Esami</span>
        </button>
        <button
          className="mobile-tab"
          onClick={() => setShowSettings(true)}
          aria-label="Account e impostazioni"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3" />
            <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
          </svg>
          <span>Account</span>
        </button>
      </nav>
    </div>
  );
}
