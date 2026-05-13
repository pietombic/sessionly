# Sessionly

**Sessionly** is an AI-powered exam session planner for Italian university students. Add your exams, let the AI build an optimised study schedule — complete with date picks, timed study blocks, and a week-view time grid — then export everything to Apple or Google Calendar.

> The app UI is in Italian.

---

## Features

### Exams
- Add exams manually: name, type (scritto+orale, parziali, progetto…), multiple date options per component, effort & difficulty sliders
- **Describe with AI** — type or dictate a free-form description; the form fills itself automatically (name, dates, approach, topics, pages, PDF count)
- **Import from screenshot** — upload one or more photos of your university exam calendar; the AI reads all images together to cross-reference dates, merge duplicates and map component names to canonical values

### AI Session Planner
- Generates **3 alternative plans**, each picking one optimal date per exam component
- Takes into account effort, difficulty, exam approach (teorico / pratico / misto) and any free-text preferences you type
- Configurable study preferences: time slots (morning 9–12 / afternoon 14–18 / evening 19–22) and session duration (1 h – 3 h)
- Optional **study blocks**: AI schedules when to prepare each exam, with precise start/end times stored and rendered in the calendar
- Double confirmation before overwriting an existing plan

### Calendar
- **Month view** — colour-coded chips, conflict warnings, study blocks styled with four patterns (tratteggio, banda, puntinato, sottolineato)
- **Week view** — full time grid (7–23 h) with events positioned at their actual times; study blocks show start/end times; current-time indicator
- Click a study block to mark it as done (strikethrough); click again to undo
- Toggle **Tutte le date** to reveal unselected dates when a plan is active
- **Rimuovi piano** clears AI picks and study blocks

### Study timeline
Horizontal bar below the toolbar showing exams in chronological order — green for passed, blue for current, grey for upcoming.

### Export
- Export to **Apple Calendar** (.ics download)
- Export to **Google Calendar** (direct links)
- With an active plan, only AI-picked dates are exported; toggle *Tutte le date* first to export everything

### Pomodoro Timer
Floating button (bottom-left) with configurable work intervals (15 / 25 / 30 / 45 / 60 min) and break intervals (5 / 10 / 15 / 20 min). Session counter visible even when the panel is closed.

### Appearance
Font, colour palette (Classico / Caldo / Fresco), study-block style, light/dark mode — all saved to `localStorage`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Auth & DB | Supabase (PostgreSQL + Row Level Security) |
| AI — text | Groq `llama-3.3-70b-versatile` |
| AI — vision | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| Analytics | Vercel Analytics |
| Fonts | Google Fonts (Unbounded, Lora, Playfair Display, Cormorant Garamond, DM Sans, JetBrains Mono) |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/pietombic/sessionly.git
cd sessionly
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL editor** and run the full contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Copy your project URL and `anon` key from **Project Settings → API**

### 3. Get a Groq API key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** and create a new key

The Groq free tier is sufficient for personal use.

### 4. Configure environment variables

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GROQ_API_KEY=your-groq-key   # optional — can be set in-app instead
```

> The Groq key can also be entered directly inside the app (⚙ → *Chiave API Groq*). It is stored only in `localStorage` and never sent to any server other than Groq.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project structure

```
src/
├── components/
│   ├── AIPlanModal.jsx       # 3-plan generator with study preferences
│   ├── CalendarGrid.jsx      # Month view
│   ├── WeekGrid.jsx          # Week view — time grid
│   ├── ExamForm.jsx          # Add / edit exam (with AI + voice)
│   ├── ImageImportModal.jsx  # Multi-image calendar import
│   ├── StudyTimeline.jsx     # Horizontal progress bar
│   ├── PomodoroTimer.jsx     # Floating Pomodoro widget
│   ├── HelpModal.jsx         # In-app guide
│   └── ...
├── lib/
│   ├── db.js                 # Supabase queries
│   └── supabase.js           # Client initialisation
├── utils/
│   ├── groq.js               # All Groq API calls
│   ├── calendarExport.js     # .ics generation + Google Calendar links
│   └── dates.js              # Date helpers
├── App.jsx
├── data.js                   # Tag colours, exam type definitions
├── main.jsx
└── styles.css                # Single-file CSS with custom properties
supabase/
└── schema.sql                # Full DB schema (run once in Supabase SQL editor)
```

---

## Deployment

The project is a static Vite SPA — deploy anywhere that serves static files. For Vercel:

```bash
npm run build   # outputs to dist/
```

Set the three environment variables in your Vercel project settings. Vercel Analytics is already wired in.

---

## License

MIT — see [LICENSE](LICENSE).

---

Made by [Pietro Tombaccini](https://github.com/pietombic)
