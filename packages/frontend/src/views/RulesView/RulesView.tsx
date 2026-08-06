import { useState, useEffect } from 'react';
import { useRules, useUpdateRules } from '../../api/hooks.js';
import styles from './RulesView.module.css';

const DEPARTMENTS = [
  'Engineering','Product','Design','Sales','Marketing',
  'Finance','Legal','People','Customer Support','Operations',
];

const EXTRA_KEYS = ['github','salesforce','adobe','hubspot','zendesk','netsuite'];
const EXTRA_LABELS: Record<string, string> = {
  github:     'GitHub org access',
  salesforce: 'Salesforce access',
  adobe:      'Adobe Creative Cloud license',
  hubspot:    'HubSpot access',
  zendesk:    'Zendesk access',
  netsuite:   'NetSuite access',
};

const SLA_LABELS: Record<string, string> = {
  identity:  'Identity / SSO',
  collab:    'Collaboration tools',
  hardware:  'Hardware orders',
  appAccess: 'App access',
  elevated:  'Elevated review',
  none:      'No system (manual)',
};

export function RulesView() {
  const { data: rules, isLoading } = useRules();
  const { mutate: updateRules, isPending, isSuccess } = useUpdateRules();

  const [localSla,  setLocalSla]  = useState<Record<string, number>>({});
  const [localDepts, setLocalDepts] = useState<Record<string, { deviceTier: string; extras: string[] }>>({});

  useEffect(() => {
    if (rules) {
      setLocalSla(rules.sla);
      setLocalDepts(JSON.parse(JSON.stringify(rules.departments)));
    }
  }, [rules]);

  if (isLoading) return <div className={styles.wrap}><p style={{ color: 'var(--ink-soft)' }}>Loading rules…</p></div>;
  if (!rules)    return null;

  const handleSave = () => {
    updateRules({ sla: localSla, departments: localDepts });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2>Role mapping rules</h2>
          <div className={styles.headSub}>
            How department and level translate into a task graph. Edits apply to hires added from now on.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSuccess && <span className={styles.saved}>✓ Saved</span>}
          <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* SLA defaults */}
      <div className={styles.slaCard}>
        <h4>Default SLA (hours)</h4>
        <div className={styles.slaGrid}>
          {Object.keys(localSla).map(key => (
            <div key={key} className={styles.slaField}>
              <label>{SLA_LABELS[key] ?? key}</label>
              <input
                type="number"
                min={1}
                value={localSla[key]}
                onChange={e =>
                  setLocalSla(prev => ({ ...prev, [key]: Math.max(1, Number(e.target.value) || 1) }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Department rules */}
      <div className={styles.rulesGrid}>
        {DEPARTMENTS.map(dept => {
          const rule = localDepts[dept] ?? { deviceTier: 'standard', extras: [] };
          return (
            <div key={dept} className={styles.ruleCard}>
              <h4>{dept}</h4>
              <div className={styles.ruleRow}>
                <span>Device tier</span>
                <select
                  value={rule.deviceTier}
                  onChange={e =>
                    setLocalDepts(prev => ({
                      ...prev,
                      [dept]: { ...prev[dept]!, deviceTier: e.target.value },
                    }))
                  }
                >
                  {Object.entries(rules.deviceTiers).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.extrasList}>
                {EXTRA_KEYS.map(key => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={rule.extras.includes(key)}
                      onChange={e => {
                        setLocalDepts(prev => {
                          const curr = prev[dept]?.extras ?? [];
                          return {
                            ...prev,
                            [dept]: {
                              ...prev[dept]!,
                              extras: e.target.checked
                                ? [...curr, key]
                                : curr.filter(k => k !== key),
                            },
                          };
                        });
                      }}
                    />
                    {EXTRA_LABELS[key] ?? key}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footerNote}>
        Changes to these rules apply to new hires only — existing clearance sequences stay accurate to what was approved.
      </div>
    </div>
  );
}
