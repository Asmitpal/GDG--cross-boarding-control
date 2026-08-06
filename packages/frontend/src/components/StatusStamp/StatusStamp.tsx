import type { HireStatus } from '../../api/types.js';
import styles from './StatusStamp.module.css';

const STATUS_MAP: Record<HireStatus, { cls: string; label: string }> = {
  AWAITING_APPROVAL: { cls: styles.awaiting,     label: 'Awaiting approval' },
  PROVISIONING:      { cls: styles.provisioning,  label: 'Provisioning' },
  BLOCKED:           { cls: styles.blocked,        label: 'Blocked' },
  CLEARED:           { cls: styles.cleared,        label: 'Cleared' },
};

interface Props {
  status: HireStatus;
}

export function StatusStamp({ status }: Props) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.PROVISIONING;
  return <span className={`${styles.stamp} ${s.cls}`}>{s.label}</span>;
}
