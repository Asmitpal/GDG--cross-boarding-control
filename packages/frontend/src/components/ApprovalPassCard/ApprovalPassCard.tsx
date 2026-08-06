import { useState } from 'react';
import type { Hire, AccessLevel, Task } from '../../api/types.js';
import { useApprovalDecision } from '../../api/hooks.js';
import styles from './ApprovalPassCard.module.css';

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  hire: Hire;
}

export function ApprovalPassCard({ hire }: Props) {
  const approvalTasks = hire.tasks.filter(
    t => t.requiresApproval && t.status === 'AWAITING_APPROVAL',
  );

  const [budget, setBudget] = useState<number>(hire.approval?.hardwareBudget ?? 0);
  const [overrides, setOverrides] = useState<Record<string, AccessLevel>>({});

  const { mutate: decide, isPending } = useApprovalDecision(hire.id);

  const handleApprove = () => {
    decide({
      decision:             'APPROVED',
      hardwareBudget:       budget,
      accessLevelOverrides: overrides,
    });
  };

  const handleReject = () => {
    if (!confirm(`Reject access request for ${hire.fullName}? This cannot be undone.`)) return;
    decide({ decision: 'REJECTED' });
  };

  // Rejected state
  if (hire.approval?.status === 'REJECTED') {
    return (
      <div className={styles.rejectedBanner}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--red-ink)' }}>
          Access request rejected
        </span>
        <p className={styles.rejectedText}>
          The hiring manager declined this request on {fmtDate(hire.approval.resolvedAt)}.
          IT-provisioned tasks tied to that approval are closed.
        </p>
      </div>
    );
  }

  // Pending state (show the boarding pass)
  if (hire.approval?.status !== 'PENDING') return null;

  return (
    <div className={styles.pass}>
      <div className={styles.main}>
        <span className={styles.badge}>Approval required</span>
        <h3 className={styles.title}>Access &amp; provisioning request</h3>
        <p className={styles.hint}>
          Review requested access before IT provisioning tasks unlock.
          Adjust access level per system if needed.
        </p>

        <div className={styles.taskList}>
          {approvalTasks.map((task: Task) => (
            <div key={task.id} className={styles.taskItem}>
              <div>
                <div className={styles.taskLabel}>{task.label}</div>
                <div className={styles.taskChip}>{task.system ?? 'General'}</div>
              </div>
              {task.accessLevel ? (
                <select
                  className={styles.select}
                  value={overrides[task.id] ?? task.accessLevel}
                  onChange={e =>
                    setOverrides(prev => ({ ...prev, [task.id]: e.target.value as AccessLevel }))
                  }
                >
                  <option value="STANDARD">Standard</option>
                  <option value="ELEVATED">Elevated</option>
                </select>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.stub}>
        <div>
          <div className={styles.budgetLabel}>Hardware budget</div>
          <input
            type="number"
            className={styles.budgetInput}
            value={budget}
            min={0}
            onChange={e => setBudget(Number(e.target.value))}
          />
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnApprove}`}
            onClick={handleApprove}
            disabled={isPending}
          >
            {isPending ? 'Processing…' : 'Approve request'}
          </button>
          <button
            className={`${styles.btn} ${styles.btnReject}`}
            onClick={handleReject}
            disabled={isPending}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
