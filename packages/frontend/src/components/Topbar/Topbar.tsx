import { NavLink } from 'react-router-dom';
import { useHires, useEscalations } from '../../api/hooks.js';
import styles from './Topbar.module.css';

export function Topbar() {
  const { data: hires }       = useHires();
  const { data: escalations } = useEscalations();

  const pendingApprovals = hires?.filter(h => h.approval?.status === 'PENDING').length ?? 0;
  const openEscalations  = escalations?.length ?? 0;

  const tabs: Array<{ to: string; label: string; badge: number; end?: boolean }> = [
    { to: '/',            label: 'Manifest',     badge: pendingApprovals, end: true },
    { to: '/new',         label: 'New Hire',     badge: 0 },
    { to: '/rules',       label: 'Role Mapping', badge: 0 },
    { to: '/escalations', label: 'Escalations',  badge: openEscalations },
  ];

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Cross-Boarding Control</div>
        <div className={styles.brandTag}>HR · IT · Manager clearance sequencing</div>
      </div>

      <nav className={styles.nav}>
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={!!tab.end}
            className={({ isActive }) =>
              `${styles.navBtn} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.label}>{tab.label}</span>
            {tab.badge > 0 && (
              <span className={styles.badge}>{tab.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
