import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateHire } from '../../api/hooks.js';
import type { HireLevel } from '../../api/types.js';
import styles from './NewHireForm.module.css';

const DEPARTMENTS = [
  'Engineering','Product','Design','Sales','Marketing',
  'Finance','Legal','People','Customer Support','Operations',
];

const LEVELS: { value: HireLevel; label: string }[] = [
  { value: 'IC',      label: 'Individual contributor' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EXEC',    label: 'Executive' },
];

export function NewHireForm() {
  const navigate = useNavigate();
  const { mutate: createHire, isPending, error } = useCreateHire();

  const [level, setLevel] = useState<HireLevel>('IC');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    createHire(
      {
        fullName:      (fd.get('fullName') as string).trim(),
        jobTitle:      (fd.get('jobTitle') as string).trim(),
        department:    fd.get('department') as string,
        level,
        startDate:     fd.get('startDate') as string,
        managerName:   (fd.get('managerName') as string).trim(),
        managerHandle: ((fd.get('managerHandle') as string) ?? '').trim() || undefined,
      },
      {
        onSuccess: (hire) => navigate(`/hires/${hire.id}`),
      },
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2>Add new hire</h2>
        <div className={styles.headSub}>
          Generates the HR, IT and manager task graph automatically from role and department.
        </div>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.error}>{(error as Error).message}</div>
        )}

        <div className={styles.field}>
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" type="text" name="fullName" required placeholder="e.g. Priya Nair" />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="jobTitle">Job title</label>
            <input id="jobTitle" type="text" name="jobTitle" required placeholder="e.g. Senior Backend Engineer" />
          </div>
          <div className={styles.field}>
            <label htmlFor="department">Department</label>
            <select id="department" name="department" required>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label>Level</label>
          <div className={styles.radioGroup}>
            {LEVELS.map(lv => (
              <label
                key={lv.value}
                className={`${styles.radioOpt} ${level === lv.value ? styles.checked : ''}`}
              >
                <input
                  type="radio"
                  name="level"
                  value={lv.value}
                  checked={level === lv.value}
                  onChange={() => setLevel(lv.value)}
                />
                {lv.label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="startDate">Start date</label>
            <input id="startDate" type="date" name="startDate" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="managerName">Hiring manager name</label>
            <input id="managerName" type="text" name="managerName" required placeholder="e.g. Jordan Lee" />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="managerHandle">Manager Slack handle or email (optional)</label>
          <input id="managerHandle" type="text" name="managerHandle" placeholder="e.g. @jordan or jordan@company.com" />
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isPending}
          >
            {isPending ? 'Generating…' : 'Generate clearance sequence'}
          </button>
          <Link to="/" className={`${styles.btn} ${styles.btnGhost}`}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
