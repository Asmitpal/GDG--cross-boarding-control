import { Link, useParams } from 'react-router-dom';
import { useHire, useToggleTask } from '../../api/hooks.js';
import { StatusStamp } from '../../components/StatusStamp/StatusStamp.js';
import { ClearanceStrip } from '../../components/ClearanceStrip/ClearanceStrip.js';
import { ApprovalPassCard } from '../../components/ApprovalPassCard/ApprovalPassCard.js';
import { TaskGroup } from '../../components/TaskGroup/TaskGroup.js';
import styles from './HireDetailView.module.css';
import type { TaskOwner } from '../../api/types.js';

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function startLabel(dateStr: string): string {
  const target = new Date(dateStr + 'T00:00:00');
  const diff   = Math.ceil((target.getTime() - new Date().setHours(0,0,0,0)) / 86_400_000);
  if (diff > 0)  return `Starts in ${diff}d`;
  if (diff === 0) return 'Starts today';
  return `Started ${Math.abs(diff)}d ago`;
}

const OWNERS: { key: TaskOwner; label: string }[] = [
  { key: 'HR',      label: 'HR' },
  { key: 'IT',      label: 'IT' },
  { key: 'MANAGER', label: 'Hiring manager' },
];

export function HireDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: hire, isLoading, isError } = useHire(id ?? '');
  const { mutate: toggleTask, isPending: isToggling } = useToggleTask(id ?? '');

  const ownerProgress = OWNERS.reduce<Record<string, { pct: number; state: 'green' | 'amber' | 'red' }>>((acc, o) => {
    const tasks   = hire?.tasks.filter(t => t.owner === o.key && t.status !== 'REJECTED') ?? [];
    if (!tasks.length) { acc[o.key] = { pct: 100, state: 'green' }; return acc; }
    const done    = tasks.filter(t => t.status === 'DONE').length;
    const blocked = tasks.some(t => t.status === 'BLOCKED');
    const waiting = tasks.some(t => t.status === 'AWAITING_APPROVAL');
    acc[o.key] = {
      pct:   Math.round((done / tasks.length) * 100),
      state: blocked ? 'red' : waiting ? 'amber' : 'green',
    };
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.center}>
          <div className={styles.spinner} />
          Loading hire…
        </div>
      </div>
    );
  }

  if (isError || !hire) {
    return (
      <div className={styles.wrap}>
        <Link to="/" className={styles.backLink}>← Manifest</Link>
        <div className={styles.center}>Hire not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Link to="/" className={styles.backLink}>← Manifest</Link>

      <div className={styles.detailHead}>
        <div>
          <h2>{hire.fullName}</h2>
          <div className={styles.detailMeta}>
            {hire.jobTitle} · {hire.department} · {fmtDate(hire.startDate)} ({startLabel(hire.startDate)})
          </div>
          <div className={styles.detailMeta}>
            Hiring manager: {hire.managerName}{hire.managerHandle ? ` · ${hire.managerHandle}` : ''}
          </div>
          <div className={styles.stripWrap}>
            <div className={styles.stripLabel}>
              <span>Clearance</span>
              <span>{hire.readiness}%</span>
            </div>
            <ClearanceStrip ownerProgress={ownerProgress} />
          </div>
        </div>
        <StatusStamp status={hire.derivedStatus} />
      </div>

      {/* Approval pass */}
      <ApprovalPassCard hire={hire} />

      {/* Task groups */}
      {OWNERS.map(o => (
        <TaskGroup
          key={o.key}
          owner={o.key}
          tasks={hire.tasksByOwner?.[o.key] ?? hire.tasks.filter(t => t.owner === o.key)}
          onToggle={(taskId, completed) => toggleTask({ taskId, completed })}
          isToggling={isToggling}
        />
      ))}
    </div>
  );
}
