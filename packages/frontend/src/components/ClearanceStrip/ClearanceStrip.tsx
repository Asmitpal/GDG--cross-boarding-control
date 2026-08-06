import styles from './ClearanceStrip.module.css';

interface OwnerProgress {
  pct:   number;
  state: 'green' | 'amber' | 'red';
}

interface Props {
  ownerProgress: Record<string, OwnerProgress>;
}

const OWNERS = ['HR', 'IT', 'MANAGER'] as const;

export function ClearanceStrip({ ownerProgress }: Props) {
  return (
    <div className={styles.strip}>
      {OWNERS.map((owner, i) => {
        const p = ownerProgress[owner] ?? { pct: 0, state: 'green' };
        return (
          <span key={owner} style={{ display: 'contents' }}>
            {i > 0 && <div className={styles.dot} />}
            <div className={styles.seg}>
              <div
                className={`${styles.segFill} ${p.state === 'amber' ? styles.amber : p.state === 'red' ? styles.red : ''}`}
                style={{ width: `${p.pct}%` }}
              />
            </div>
          </span>
        );
      })}
    </div>
  );
}
