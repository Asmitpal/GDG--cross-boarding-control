import type { Task, TaskOwner } from '../../api/types.js';
import styles from './TaskGroup.module.css';

interface Props {
  owner:       TaskOwner;
  tasks:       Task[];
  onToggle:    (taskId: string, completed: boolean) => void;
  isToggling?: boolean;
}

const OWNER_LABELS: Record<TaskOwner, string> = {
  HR:      'HR tasks',
  IT:      'IT tasks',
  MANAGER: 'Hiring manager tasks',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (h < 1)  return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function TaskRow({ task, onToggle, isToggling }: { task: Task; onToggle: (id: string, v: boolean) => void; isToggling?: boolean }) {
  const isAwaiting = task.status === 'AWAITING_APPROVAL';
  const isRejected = task.status === 'REJECTED';
  const isDone     = task.status === 'DONE';
  const isBlocked  = task.status === 'BLOCKED';
  const isDisabled = isAwaiting || isRejected || isToggling;

  let slaText = '';
  if      (isAwaiting) slaText = 'Waiting on manager approval';
  else if (isRejected) slaText = 'Request rejected';
  else if (isDone)     slaText = `Completed ${timeAgo(task.completedAt)}`;
  else if (isBlocked)  slaText = `Overdue — SLA was ${task.slaHours}h`;
  else if (task.unlockedAt) slaText = `SLA ${task.slaHours}h · unlocked ${timeAgo(task.unlockedAt)}`;

  return (
    <div
      className={[
        styles.taskRow,
        isAwaiting     ? styles.awaiting : '',
        task.isEscalated ? styles.escalated : '',
      ].join(' ')}
    >
      <input
        type="checkbox"
        className={styles.check}
        checked={isDone}
        disabled={isDisabled}
        onChange={e => onToggle(task.id, e.target.checked)}
      />
      <div className={styles.body}>
        <div className={`${styles.label} ${isDone ? styles.done : ''}`}>{task.label}</div>
        <div className={styles.sub}>
          {task.system && <span className={styles.chip}>{task.system}</span>}
          {task.accessLevel && (
            <span className={`${styles.chip} ${task.accessLevel === 'ELEVATED' ? styles.elevated : ''}`}>
              {task.accessLevel.toLowerCase()}
            </span>
          )}
          {task.isEscalated && <span className={styles.escalateBadge}>Escalated</span>}
          <span className={`${styles.slaText} ${isBlocked ? styles.overdue : ''}`}>{slaText}</span>
        </div>
      </div>
    </div>
  );
}

export function TaskGroup({ owner, tasks, onToggle, isToggling }: Props) {
  if (!tasks.length) return null;
  return (
    <div className={styles.group}>
      <div className={styles.head}>
        <span className={styles.gateTag}>{owner}</span>
        <span className={styles.ownerTitle}>{OWNER_LABELS[owner]}</span>
      </div>
      <div className={styles.taskList}>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} isToggling={isToggling} />
        ))}
      </div>
    </div>
  );
}
