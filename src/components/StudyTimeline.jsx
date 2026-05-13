const DONE_STATUSES = new Set(['done', 'failed', 'saltato']);

export function StudyTimeline({ exams, datePicks, today }) {
  if (!datePicks || datePicks.length === 0) return null;

  const earliestPick = {};
  for (const p of datePicks) {
    if (!earliestPick[p.examId] || p.date < earliestPick[p.examId]) {
      earliestPick[p.examId] = p.date;
    }
  }

  const ordered = exams
    .filter((e) => earliestPick[e.id])
    .sort((a, b) => earliestPick[a.id] - earliestPick[b.id]);

  if (ordered.length === 0) return null;

  let currentIdx = ordered.findIndex((e) => !DONE_STATUSES.has(e.status));
  if (currentIdx === -1) currentIdx = ordered.length;

  return (
    <div className="study-timeline-wrap">
      <div className="study-timeline">
        {ordered.map((exam, i) => {
          const isDone  = exam.status === 'done';
          const isFail  = DONE_STATUSES.has(exam.status) && exam.status !== 'done';
          const isCurr  = i === currentIdx;
          const state   = isDone ? 'done' : isFail ? 'failed' : isCurr ? 'current' : 'todo';
          const lineSt  = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'todo';
          const short   = exam.name.split(' ').slice(0, 3).join(' ');

          return (
            <div key={exam.id} className="tl-item">
              {i > 0 && <div className={`tl-line tl-line-${lineSt}`} />}
              <span className={`tl-label tl-label-${state}`}>{short}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
