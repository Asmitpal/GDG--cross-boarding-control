import { Link } from 'react-router-dom';
import { useEscalations } from '../../api/hooks.js';
import styles from './EscalationsView.module.css';

function timeAgo(dateStr: string): string {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (h < 1)  return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function EscalationsView() {
  const { data: escalations, isLoading } = useEscalations();

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2>Escalations</h2>
          <div className={styles.headSub}>
            {escalations?.length
              ? `${escalations.length} flagged since tracking began.`
              : 'Automated pings when a task runs past its SLA.'}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className={styles.empty}><p>Loading escalations…</p></div>
      )}

      {!isLoading && (!escalations || escalations.length === 0) && (
        <div className={styles.empty}>
          <h3>No escalations yet</h3>
          <p>
            When a task sits unlocked past its SLA without being marked done, it shows up here —
            and a notification is sent to Slack.
          </p>
        </div>
      )}

      {escalations && escalations.length > 0 && (
        <div className={styles.feed}>
          {escalations.map(esc => (
            <div key={esc.id} className={styles.feedItem}>
              <div className={styles.feedMsg}>
                <b>{esc.task?.owner ?? esc.owner}</b>
                {' · '}
                {esc.task?.label ?? 'Task'}
                {' for '}
                <Link to={`/hires/${esc.hireId}`} className={styles.hireLink}>
                  <b>{esc.hire?.fullName ?? 'Hire'}</b>
                </Link>
                {' is '}
                <b>{esc.overdueHours}h</b>
                {' past its '}
                {esc.task?.slaHours ?? 24}h SLA.

                <div className={styles.feedMeta}>
                  <span className={styles.ownerChip}>{esc.owner}</span>
                  {esc.task?.system && (
                    <span className={styles.sysChip}>{esc.task.system}</span>
                  )}
                </div>
              </div>

              <div className={styles.feedRight}>
                <span className={styles.feedTime}>{timeAgo(esc.notifiedAt)}</span>
                <span className={styles.overdueTag}>+{esc.overdueHours}h overdue</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
