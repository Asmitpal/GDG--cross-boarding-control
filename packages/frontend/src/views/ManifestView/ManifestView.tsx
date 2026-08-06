import { Link } from 'react-router-dom';
import { useHires } from '../../api/hooks.js';
import { StatusStamp } from '../../components/StatusStamp/StatusStamp.js';
import { ClearanceStrip } from '../../components/ClearanceStrip/ClearanceStrip.js';
import styles from './ManifestView.module.css';

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

export function ManifestView() {
  const { data: hires, isLoading, isError } = useHires();

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2>Manifest</h2>
          <div className={styles.headSub}>Every hire currently moving through clearance.</div>
        </div>
        <Link to="/new" className={`${styles.btn} ${styles.btnPrimary}`}>+ Add new hire</Link>
      </div>

      {isLoading && (
        <div className={styles.manifest}>
          {[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {isError && (
        <div className={styles.empty}>
          <h3>Could not load hires</h3>
          <p>Check that the backend is running and try refreshing.</p>
        </div>
      )}

      {!isLoading && !isError && (!hires || hires.length === 0) && (
        <div className={styles.empty}>
          <h3>The manifest is empty</h3>
          <p>Add a new hire to generate their HR, IT and manager task graph automatically, based on role and department.</p>
          <Link to="/new" className={`${styles.btn} ${styles.btnPrimary}`}>+ Add new hire</Link>
        </div>
      )}

      {!isLoading && hires && hires.length > 0 && (
        <div className={styles.manifest}>
          {hires.map((hire, i) => (
            <Link
              key={hire.id}
              to={`/hires/${hire.id}`}
              className={styles.row}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div>
                <div className={styles.hireName}>{hire.fullName}</div>
                <div className={styles.hireRole}>{hire.jobTitle} · {hire.department}</div>
              </div>
              <div className={styles.startInfo}>
                {fmtDate(hire.startDate)}
                <br />
                <span className={styles.startDays}>{startLabel(hire.startDate)}</span>
              </div>
              <ClearanceStrip ownerProgress={hire.ownerProgress} />
              <StatusStamp status={hire.derivedStatus} />
              <div className={styles.readiness}>{hire.readiness}%</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
