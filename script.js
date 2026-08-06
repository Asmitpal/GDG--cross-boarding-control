/* =========================================================================
   CROSS-BOARDING CONTROL
   Coordinates HR, IT and hiring-manager tasks for a new hire's access
   provisioning. All state is user-generated — nothing is seeded.
   ========================================================================= */

const STORAGE_KEY = 'crossboarding-state-v1';

const DEVICE_TIERS = {
  standard:{ label:'Standard laptop', budget:1400 },
  dev:{ label:'Dev laptop (high-spec)', budget:2400 },
  design:{ label:'Creative workstation laptop', budget:3000 }
};

const DEPARTMENTS = ['Engineering','Product','Design','Sales','Marketing','Finance','Legal','People','Customer Support','Operations'];

const DEFAULT_DEPT_RULES = {
  'Engineering':{ deviceTier:'dev', extras:['github'] },
  'Product':{ deviceTier:'dev', extras:['github'] },
  'Design':{ deviceTier:'design', extras:['adobe'] },
  'Sales':{ deviceTier:'standard', extras:['salesforce'] },
  'Marketing':{ deviceTier:'standard', extras:['hubspot'] },
  'Finance':{ deviceTier:'standard', extras:['netsuite'] },
  'Legal':{ deviceTier:'standard', extras:['netsuite'] },
  'People':{ deviceTier:'standard', extras:[] },
  'Customer Support':{ deviceTier:'standard', extras:['zendesk'] },
  'Operations':{ deviceTier:'standard', extras:[] }
};

const EXTRA_SYSTEMS = {
  github:{ label:'GitHub org access', system:'GitHub' },
  salesforce:{ label:'Salesforce access', system:'Salesforce' },
  adobe:{ label:'Adobe Creative Cloud license', system:'Adobe' },
  hubspot:{ label:'HubSpot access', system:'HubSpot' },
  zendesk:{ label:'Zendesk access', system:'Zendesk' },
  netsuite:{ label:'NetSuite access', system:'NetSuite' }
};

const DEFAULT_SLA = { identity:24, collab:12, hardware:48, appAccess:24, elevated:12, none:48 };

function defaultRules(){
  return {
    departments: JSON.parse(JSON.stringify(DEFAULT_DEPT_RULES)),
    deviceTiers: JSON.parse(JSON.stringify(DEVICE_TIERS)),
    sla: JSON.parse(JSON.stringify(DEFAULT_SLA))
  };
}

function defaultState(){
  return { hires:[], escalations:[], rules: defaultRules() };
}

let STATE = defaultState();
let VIEW = { name:'manifest', hireId:null };
let LOADED = false;

/* ---------------------------- persistence ---------------------------- */

async function loadState(){
  try{
    let val = null;
    if(typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function'){
      const res = await window.storage.get(STORAGE_KEY, false);
      if(res && res.value) val = res.value;
    } else if(typeof localStorage !== 'undefined') {
      val = localStorage.getItem(STORAGE_KEY);
    }
    if(val){
      const parsed = JSON.parse(val);
      STATE = Object.assign(defaultState(), parsed);
      if(!STATE.rules) STATE.rules = defaultRules();
    }
  }catch(e){
    // no saved state yet — start fresh
    STATE = defaultState();
  }
  LOADED = true;
  render();
}

async function saveState(){
  try{
    const str = JSON.stringify(STATE);
    if(typeof window !== 'undefined' && window.storage && typeof window.storage.set === 'function'){
      await window.storage.set(STORAGE_KEY, str, false);
    } else if(typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, str);
    }
  }catch(e){
    showToast('Could not save — your changes may not persist.');
  }
}

/* ------------------------------- utils -------------------------------- */

function uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function now(){ return Date.now(); }
function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'});
}
function daysUntil(dateStr){
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((target.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  return diff;
}
function startLabel(dateStr){
  const d = daysUntil(dateStr);
  if(d > 0) return `Starts in ${d}d`;
  if(d === 0) return `Starts today`;
  return `Started ${Math.abs(d)}d ago`;
}
function hoursSince(ts){ return (now() - ts) / 3600000; }
function timeAgo(ts){
  const h = hoursSince(ts);
  if(h < 1) return Math.max(1, Math.round(h*60)) + 'm ago';
  if(h < 24) return Math.round(h) + 'h ago';
  return Math.round(h/24) + 'd ago';
}
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.classList.remove('show'), 2600);
}

/* --------------------------- task graph engine -------------------------- */

function computeHardwareBudget(department, level, rules){
  const deptRule = rules.departments[department] || { deviceTier:'standard' };
  const tier = rules.deviceTiers[deptRule.deviceTier] || rules.deviceTiers.standard;
  let budget = tier.budget;
  if(level === 'exec') budget += 500;
  return budget;
}

function generateTaskGraph(hire, rules){
  const deptRule = rules.departments[hire.department] || { deviceTier:'standard', extras:[] };
  const tier = rules.deviceTiers[deptRule.deviceTier] || rules.deviceTiers.standard;
  const sla = rules.sla;
  const elevated = hire.level !== 'ic';
  const tasks = [];

  function push(owner, label, system, requiresApproval, slaHours, accessLevel){
    tasks.push({
      id: uid('task'),
      owner, label, system: system || null,
      requiresApproval: !!requiresApproval,
      accessLevel: accessLevel || null,
      status: requiresApproval ? 'awaiting_approval' : 'pending',
      slaHours,
      unlockedAt: requiresApproval ? null : now(),
      createdAt: now(),
      completedAt: null,
      escalated: false
    });
  }

  // HR
  push('HR', 'Send offer packet & tax forms', 'Payroll', false, sla.none);
  push('HR', 'Enroll in benefits', 'Payroll', false, sla.none);
  push('HR', 'Add to payroll system', 'Payroll', false, sla.none);
  push('HR', 'Schedule Day-1 orientation', null, false, sla.none);

  // Manager
  push('MANAGER', 'Schedule welcome intro meeting', null, false, sla.collab);
  push('MANAGER', 'Assign onboarding buddy', null, false, sla.collab);
  push('MANAGER', 'Set 30-60-90 check-in schedule', null, false, sla.none);

  // IT — common
  push('IT', 'Provision company email & SSO', 'Okta', true, sla.identity, elevated ? 'elevated' : 'standard');
  push('IT', 'Add to Slack workspace', 'Slack', false, sla.collab);
  push('IT', `Order ${tier.label.toLowerCase()}`, 'Hardware', true, sla.hardware);
  push('IT', 'Provision VPN access', 'Okta', true, sla.identity, 'standard');

  // IT — department extras
  (deptRule.extras || []).forEach(key => {
    const ex = EXTRA_SYSTEMS[key];
    if(ex) push('IT', 'Grant ' + ex.label.charAt(0).toLowerCase() + ex.label.slice(1), ex.system, true, sla.appAccess, elevated ? 'elevated' : 'standard');
  });

  // IT — elevated review for managers/execs
  if(elevated){
    push('IT', 'Elevated permissions security review', 'Okta', true, sla.elevated, 'elevated');
  }

  return tasks;
}

/* ------------------------------ hire logic ------------------------------ */

function addHire(data){
  const hire = {
    id: uid('hire'),
    name: data.name,
    jobTitle: data.jobTitle,
    department: data.department,
    level: data.level,
    startDate: data.startDate,
    managerName: data.managerName,
    managerHandle: data.managerHandle,
    createdAt: now()
  };
  hire.tasks = generateTaskGraph(hire, STATE.rules);
  const hasApproval = hire.tasks.some(t => t.requiresApproval);
  hire.approval = {
    status: hasApproval ? 'pending' : 'not_required',
    hardwareBudget: computeHardwareBudget(hire.department, hire.level, STATE.rules),
    submittedAt: now(),
    resolvedAt: null
  };
  STATE.hires.unshift(hire);
  saveState();
  return hire;
}

function getHire(id){ return STATE.hires.find(h => h.id === id); }

function recomputeTaskStatus(task){
  if(task.status === 'awaiting_approval' || task.status === 'rejected') return;
  if(task.completedAt){ task.status = 'done'; return; }
  if(task.unlockedAt && hoursSince(task.unlockedAt) > task.slaHours){
    task.status = 'blocked';
  } else {
    task.status = 'pending';
  }
}

function hireStatus(hire){
  if(hire.approval.status === 'pending') return 'awaiting';
  const live = hire.tasks.filter(t => t.status !== 'rejected');
  if(live.some(t => t.status === 'blocked')) return 'blocked';
  if(live.length && live.every(t => t.status === 'done')) return 'cleared';
  return 'provisioning';
}

function hireReadiness(hire){
  const live = hire.tasks.filter(t => t.status !== 'rejected' && t.status !== 'awaiting_approval');
  if(!live.length) return 0;
  const done = live.filter(t => t.status === 'done').length;
  return Math.round((done / live.length) * 100);
}

function ownerProgress(hire, owner){
  const tasks = hire.tasks.filter(t => t.owner === owner && t.status !== 'rejected');
  if(!tasks.length) return { pct:100, state:'green' };
  const done = tasks.filter(t => t.status === 'done').length;
  const blocked = tasks.some(t => t.status === 'blocked');
  const awaiting = tasks.some(t => t.status === 'awaiting_approval');
  return {
    pct: Math.round((done / tasks.length) * 100),
    state: blocked ? 'red' : (awaiting ? 'amber' : 'green')
  };
}

function toggleTaskDone(hireId, taskId, checked){
  const hire = getHire(hireId);
  if(!hire) return;
  const task = hire.tasks.find(t => t.id === taskId);
  if(!task || task.status === 'awaiting_approval' || task.status === 'rejected') return;
  task.completedAt = checked ? now() : null;
  recomputeTaskStatus(task);
  saveState();
  render();
}

function approveHire(hireId, decision){
  const hire = getHire(hireId);
  if(!hire) return;
  const container = document.querySelector(`[data-pass-for="${hireId}"]`);

  if(decision === 'reject'){
    hire.tasks.forEach(t => { if(t.requiresApproval && t.status === 'awaiting_approval') t.status = 'rejected'; });
    hire.approval.status = 'rejected';
    hire.approval.resolvedAt = now();
    showToast(`Access request for ${hire.name} rejected.`);
  } else {
    // read any edited access levels + budget from the DOM
    if(container){
      container.querySelectorAll('[data-task-select]').forEach(sel => {
        const t = hire.tasks.find(tt => tt.id === sel.dataset.taskSelect);
        if(t) t.accessLevel = sel.value;
      });
      const budgetInput = container.querySelector('[data-budget-input]');
      if(budgetInput) hire.approval.hardwareBudget = Number(budgetInput.value) || hire.approval.hardwareBudget;
    }
    hire.tasks.forEach(t => {
      if(t.requiresApproval && t.status === 'awaiting_approval'){
        t.status = 'pending';
        t.unlockedAt = now();
      }
    });
    hire.approval.status = 'approved';
    hire.approval.resolvedAt = now();
    showToast(`Access approved for ${hire.name}. Provisioning unlocked.`);
  }
  saveState();
  render();
}

/* ------------------------------ escalations ------------------------------ */

function runEscalationCheck(silent){
  let added = 0;
  STATE.hires.forEach(hire => {
    hire.tasks.forEach(task => {
      if(task.status === 'awaiting_approval' || task.status === 'rejected' || task.completedAt) return;
      if(!task.unlockedAt) return;
      const overdue = hoursSince(task.unlockedAt) - task.slaHours;
      if(overdue > 0 && !task.escalated){
        task.escalated = true;
        task.status = 'blocked';
        STATE.escalations.unshift({
          id: uid('esc'),
          hireId: hire.id,
          hireName: hire.name,
          taskId: task.id,
          taskLabel: task.label,
          owner: task.owner,
          slaHours: task.slaHours,
          overdueHours: Math.round(overdue),
          timestamp: now()
        });
        added++;
      } else if(overdue > 0){
        task.status = 'blocked';
      }
    });
  });
  if(added){
    saveState();
    render();
    if(!silent) showToast(`${added} new blocker${added>1?'s':''} flagged.`);
  } else if(!silent){
    showToast('No new blockers — everything is within SLA.');
  }
}

/* --------------------------------- render -------------------------------- */

function render(){
  if(!LOADED){
    document.getElementById('app').innerHTML = `<div class="main"><p class="page-sub">Loading manifest…</p></div>`;
    return;
  }
  const app = document.getElementById('app');
  app.innerHTML = renderTopbar() + '<div class="main">' + renderView() + '</div>';
}

function renderTopbar(){
  const pendingApprovals = STATE.hires.filter(h => h.approval.status === 'pending').length;
  const openEscalations = STATE.escalations.length;
  const tabs = [
    {name:'manifest', label:'Manifest', badge: pendingApprovals},
    {name:'new', label:'New Hire', badge:0},
    {name:'rules', label:'Role Mapping', badge:0},
    {name:'escalations', label:'Escalations', badge: openEscalations}
  ];
  return `
  <div class="topbar">
    <div class="brand">
      <div class="brand-name">Cross-Boarding Control</div>
      <div class="brand-tag">HR · IT · Manager clearance sequencing</div>
    </div>
    <div class="nav">
      ${tabs.map(t => `
        <button class="nav-btn ${VIEW.name===t.name?'active':''}" data-action="nav" data-view="${t.name}">
          <span class="label">${t.label}</span>
          ${t.badge>0 ? `<span class="nav-badge">${t.badge}</span>` : ''}
        </button>
      `).join('')}
    </div>
  </div>`;
}

function renderView(){
  if(VIEW.name === 'new') return renderNewHireForm();
  if(VIEW.name === 'rules') return renderRules();
  if(VIEW.name === 'escalations') return renderEscalations();
  if(VIEW.name === 'detail') return renderDetail(VIEW.hireId);
  return renderManifest();
}

function renderManifest(){
  if(!STATE.hires.length){
    return `
    <div class="page-head">
      <div><h2>Manifest</h2><div class="page-sub">Every hire currently moving through clearance.</div></div>
    </div>
    <div class="empty">
      <h3>The manifest is empty</h3>
      <p>Add a new hire to generate their HR, IT and manager task graph automatically, based on role and department.</p>
      <button class="btn btn-primary" data-action="nav" data-view="new">+ Add new hire</button>
    </div>`;
  }

  const rows = STATE.hires.map(hire => {
    const status = hireStatus(hire);
    const readiness = hireReadiness(hire);
    const owners = ['HR','IT','MANAGER'];
    return `
    <div class="manifest-row" data-action="open" data-hire-id="${hire.id}">
      <div>
        <div class="hire-name">${esc(hire.name)}</div>
        <div class="hire-role">${esc(hire.jobTitle)} · ${esc(hire.department)}</div>
      </div>
      <div class="start-info">${esc(fmtDate(new Date(hire.startDate).getTime()))}<br><span class="start-days">${startLabel(hire.startDate)}</span></div>
      <div class="clearance-strip">
        ${owners.map(o => {
          const p = ownerProgress(hire, o);
          return `<div class="seg"><div class="seg-fill ${p.state==='amber'?'is-amber':(p.state==='red'?'is-red':'')}" style="width:${p.pct}%"></div></div>`;
        }).join('<div class="seg-dot"></div>')}
      </div>
      <div>${renderStamp(status)}</div>
      <div class="readiness">${readiness}%</div>
    </div>`;
  }).join('');

  return `
  <div class="page-head">
    <div><h2>Manifest</h2><div class="page-sub">${STATE.hires.length} hire${STATE.hires.length>1?'s':''} in the pipeline.</div></div>
    <button class="btn btn-primary" data-action="nav" data-view="new">+ Add new hire</button>
  </div>
  <div class="manifest">${rows}</div>`;
}

function renderStamp(status){
  const map = {
    awaiting:{cls:'stamp-awaiting', label:'Awaiting approval'},
    provisioning:{cls:'stamp-provisioning', label:'Provisioning'},
    blocked:{cls:'stamp-blocked', label:'Blocked'},
    cleared:{cls:'stamp-cleared', label:'Cleared'}
  };
  const s = map[status] || map.provisioning;
  return `<span class="stamp ${s.cls}">${s.label}</span>`;
}

function renderDetail(hireId){
  const hire = getHire(hireId);
  if(!hire) return `<p class="page-sub">Hire not found.</p><button class="btn" data-action="nav" data-view="manifest">← Back to manifest</button>`;

  const status = hireStatus(hire);
  const readiness = hireReadiness(hire);
  const owners = [
    {key:'HR', label:'HR'},
    {key:'IT', label:'IT'},
    {key:'MANAGER', label:'Hiring manager'}
  ];

  let html = `
  <button class="back-link" data-action="nav" data-view="manifest">← Manifest</button>
  <div class="detail-head">
    <div>
      <h2>${esc(hire.name)}</h2>
      <div class="detail-meta">${esc(hire.jobTitle)} · ${esc(hire.department)} · ${esc(fmtDate(new Date(hire.startDate).getTime()))} (${startLabel(hire.startDate)})</div>
      <div class="detail-meta">Hiring manager: ${esc(hire.managerName)}${hire.managerHandle ? ' · ' + esc(hire.managerHandle) : ''}</div>
      <div class="detail-strip-wrap">
        <div class="detail-strip-label"><span>Clearance</span><span>${readiness}%</span></div>
        <div class="clearance-strip">
          ${owners.map(o => {
            const p = ownerProgress(hire, o.key);
            return `<div class="seg"><div class="seg-fill ${p.state==='amber'?'is-amber':(p.state==='red'?'is-red':'')}" style="width:${p.pct}%"></div></div>`;
          }).join('<div class="seg-dot"></div>')}
        </div>
      </div>
    </div>
    <div>${renderStamp(status)}</div>
  </div>`;

  if(hire.approval.status === 'pending'){
    html += renderApprovalPass(hire);
  } else if(hire.approval.status === 'rejected'){
    html += `<div class="empty" style="text-align:left; padding:16px 20px; margin-bottom:24px;">
      <span class="stamp stamp-blocked">Access request rejected</span>
      <p style="margin:8px 0 0;">The hiring manager declined this request on ${esc(fmtDate(hire.approval.resolvedAt))}. IT-provisioned tasks tied to that approval are closed.</p>
    </div>`;
  }

  owners.forEach(o => {
    const tasks = hire.tasks.filter(t => t.owner === o.key);
    if(!tasks.length) return;
    html += `
    <div class="owner-group">
      <div class="owner-head"><span class="gate-tag">${o.key}</span><span class="owner-title">${o.label} tasks</span></div>
      <div class="task-list">
        ${tasks.map(t => renderTaskRow(hire, t)).join('')}
      </div>
    </div>`;
  });

  return html;
}

function renderTaskRow(hire, t){
  const isAwaiting = t.status === 'awaiting_approval';
  const isRejected = t.status === 'rejected';
  const isDone = t.status === 'done';
  const isBlocked = t.status === 'blocked';
  let subText = '';
  if(isAwaiting) subText = 'Waiting on manager approval';
  else if(isRejected) subText = 'Request rejected';
  else if(isDone) subText = 'Completed ' + timeAgo(t.completedAt);
  else if(isBlocked) subText = `Overdue — SLA was ${t.slaHours}h`;
  else subText = `SLA ${t.slaHours}h · unlocked ${timeAgo(t.unlockedAt)}`;

  return `
  <div class="task-row ${isAwaiting?'is-awaiting':''}">
    <input type="checkbox" class="task-check" ${isDone?'checked':''} ${isAwaiting||isRejected?'disabled':''}
      data-action="toggle-task" data-hire-id="${hire.id}" data-task-id="${t.id}">
    <div class="task-body">
      <div class="task-label ${isDone?'is-done':''}">${esc(t.label)}</div>
      <div class="task-sub">
        ${t.system ? `<span class="task-chip">${esc(t.system)}</span>` : ''}
        ${t.accessLevel ? `<span class="task-chip">${esc(t.accessLevel)}</span>` : ''}
        <span class="task-sla">${subText}</span>
      </div>
    </div>
  </div>`;
}

function renderApprovalPass(hire){
  const approvalTasks = hire.tasks.filter(t => t.requiresApproval && t.status === 'awaiting_approval');
  return `
  <div class="pass" data-pass-for="${hire.id}">
    <div class="pass-main">
      <span class="pass-badge">Approval required</span>
      <h3 class="pass-title">Access &amp; provisioning request</h3>
      <div class="pass-hint">Review requested access before IT provisioning tasks unlock. Adjust access level per system if needed.</div>
      <div style="margin-top:14px;">
        ${approvalTasks.map(t => `
          <div class="pass-task">
            <div>
              <div class="pass-task-label">${esc(t.label)}</div>
              <div class="pass-task-chip">${esc(t.system || 'General')}</div>
            </div>
            ${t.accessLevel ? `
              <select class="pass-select" data-task-select="${t.id}">
                <option value="standard" ${t.accessLevel==='standard'?'selected':''}>Standard</option>
                <option value="elevated" ${t.accessLevel==='elevated'?'selected':''}>Elevated</option>
              </select>` : '<span></span>'}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="pass-stub">
      <div>
        <div class="pass-budget-label">Hardware budget</div>
        <input type="number" class="pass-budget-input" data-budget-input value="${hire.approval.hardwareBudget}">
      </div>
      <div class="pass-actions">
        <button class="btn btn-approve" data-action="approve" data-hire-id="${hire.id}">Approve request</button>
        <button class="btn btn-reject" data-action="reject" data-hire-id="${hire.id}">Reject</button>
      </div>
    </div>
  </div>`;
}

function renderNewHireForm(){
  const levels = [
    {v:'ic', l:'Individual contributor'},
    {v:'manager', l:'Manager'},
    {v:'exec', l:'Executive'}
  ];
  return `
  <div class="page-head">
    <div><h2>Add new hire</h2><div class="page-sub">Generates the HR, IT and manager task graph automatically from role and department.</div></div>
  </div>
  <form class="form-card" id="new-hire-form">
    <div class="field">
      <label>Full name</label>
      <input type="text" name="name" required placeholder="e.g. Priya Nair">
    </div>
    <div class="field-row">
      <div class="field">
        <label>Job title</label>
        <input type="text" name="jobTitle" required placeholder="e.g. Senior Backend Engineer">
      </div>
      <div class="field">
        <label>Department</label>
        <select name="department" required>
          ${DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field">
      <label>Level</label>
      <div class="radio-group" id="level-group">
        ${levels.map((lv,i) => `
          <label class="radio-opt ${i===0?'checked':''}" data-level-opt="${lv.v}">
            <input type="radio" name="level" value="${lv.v}" ${i===0?'checked':''}> ${lv.l}
          </label>`).join('')}
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Start date</label>
        <input type="date" name="startDate" required>
      </div>
      <div class="field">
        <label>Hiring manager name</label>
        <input type="text" name="managerName" required placeholder="e.g. Jordan Lee">
      </div>
    </div>
    <div class="field">
      <label>Hiring manager Slack handle or email (optional)</label>
      <input type="text" name="managerHandle" placeholder="e.g. @jordan or jordan@company.com">
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">Generate clearance sequence</button>
      <button type="button" class="btn btn-ghost" data-action="nav" data-view="manifest">Cancel</button>
    </div>
  </form>`;
}

function renderEscalations(){
  if(!STATE.escalations.length){
    return `
    <div class="page-head">
      <div><h2>Escalations</h2><div class="page-sub">Automated pings when a task runs past its SLA.</div></div>
      <button class="btn" data-action="check-blockers">Check for blockers now</button>
    </div>
    <div class="empty">
      <h3>No escalations yet</h3>
      <p>When a task sits unlocked past its SLA without being marked done, it shows up here — as if posted to Slack or Teams.</p>
    </div>`;
  }
  return `
  <div class="page-head">
    <div><h2>Escalations</h2><div class="page-sub">${STATE.escalations.length} flagged since tracking began.</div></div>
    <button class="btn" data-action="check-blockers">Check for blockers now</button>
  </div>
  <div class="feed">
    ${STATE.escalations.map(e => `
      <div class="feed-item">
        <div class="feed-msg"><b>${esc(e.owner)}</b> · ${esc(e.taskLabel)} for <b>${esc(e.hireName)}</b> is ${e.overdueHours}h past its ${e.slaHours}h SLA.</div>
        <div class="feed-time">${timeAgo(e.timestamp)}</div>
      </div>
    `).join('')}
  </div>`;
}

function renderRules(){
  const sla = STATE.rules.sla;
  const slaLabels = {identity:'Identity / SSO', collab:'Collaboration tools', hardware:'Hardware orders', appAccess:'App access', elevated:'Elevated review', none:'No system (manual)'};
  return `
  <div class="page-head">
    <div><h2>Role mapping rules</h2><div class="page-sub">How job department and level translate into a task graph. Edits apply to hires added from now on.</div></div>
    <button class="btn btn-ghost" data-action="reset-data">Reset all data</button>
  </div>

  <div class="sla-card">
    <h4 style="font-size:13.5px;">Default SLA (hours)</h4>
    <div class="sla-grid">
      ${Object.keys(sla).map(k => `
        <div class="sla-field">
          <label>${slaLabels[k] || k}</label>
          <input type="number" min="1" value="${sla[k]}" data-sla-key="${k}">
        </div>
      `).join('')}
    </div>
  </div>

  <div class="rules-grid">
    ${DEPARTMENTS.map(dep => {
      const rule = STATE.rules.departments[dep] || {deviceTier:'standard', extras:[]};
      return `
      <div class="rule-card">
        <h4>${dep}</h4>
        <div class="rule-row">
          <span>Device tier</span>
          <select data-dept-tier="${dep}">
            ${Object.keys(STATE.rules.deviceTiers).map(tk => `<option value="${tk}" ${rule.deviceTier===tk?'selected':''}>${STATE.rules.deviceTiers[tk].label}</option>`).join('')}
          </select>
        </div>
        <div class="extras-list">
          ${Object.keys(EXTRA_SYSTEMS).map(key => `
            <label>
              <input type="checkbox" data-dept-extra="${dep}" data-extra-key="${key}" ${rule.extras.includes(key)?'checked':''}>
              ${EXTRA_SYSTEMS[key].label}
            </label>
          `).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>
  <div class="footer-note">Changes to these rules apply to new hires only, so existing clearance sequences stay accurate to what was approved.</div>
  `;
}

/* ------------------------------- events ------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  loadState();

  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if(!el) return;
    const action = el.dataset.action;

    if(action === 'nav'){
      VIEW = { name: el.dataset.view, hireId:null };
      render();
    }
    else if(action === 'open'){
      VIEW = { name:'detail', hireId: el.dataset.hireId };
      render();
    }
    else if(action === 'approve'){
      approveHire(el.dataset.hireId, 'approve');
    }
    else if(action === 'reject'){
      approveHire(el.dataset.hireId, 'reject');
    }
    else if(action === 'check-blockers'){
      runEscalationCheck(false);
    }
    else if(action === 'reset-data'){
      if(confirm('This clears every hire, task and escalation. This cannot be undone. Continue?')){
        STATE = defaultState();
        saveState();
        VIEW = {name:'manifest', hireId:null};
        render();
        showToast('All data cleared.');
      }
    }
  });

  document.body.addEventListener('change', (e) => {
    if(e.target.matches('[data-action="toggle-task"]')){
      toggleTaskDone(e.target.dataset.hireId, e.target.dataset.taskId, e.target.checked);
    }
    else if(e.target.closest('#level-group')){
      document.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('checked'));
      e.target.closest('.radio-opt').classList.add('checked');
    }
    else if(e.target.matches('[data-sla-key]')){
      const key = e.target.dataset.slaKey;
      STATE.rules.sla[key] = Math.max(1, Number(e.target.value) || 1);
      saveState();
    }
    else if(e.target.matches('[data-dept-tier]')){
      const dep = e.target.dataset.deptTier;
      STATE.rules.departments[dep].deviceTier = e.target.value;
      saveState();
    }
    else if(e.target.matches('[data-dept-extra]')){
      const dep = e.target.dataset.deptExtra;
      const key = e.target.dataset.extraKey;
      const rule = STATE.rules.departments[dep];
      if(e.target.checked){
        if(!rule.extras.includes(key)) rule.extras.push(key);
      } else {
        rule.extras = rule.extras.filter(k => k !== key);
      }
      saveState();
    }
  });

  document.body.addEventListener('submit', (e) => {
    if(e.target.id === 'new-hire-form'){
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get('name').trim(),
        jobTitle: fd.get('jobTitle').trim(),
        department: fd.get('department'),
        level: fd.get('level'),
        startDate: fd.get('startDate'),
        managerName: fd.get('managerName').trim(),
        managerHandle: (fd.get('managerHandle') || '').trim()
      };
      if(!data.name || !data.jobTitle || !data.startDate || !data.managerName){
        showToast('Fill in every required field.');
        return;
      }
      const hire = addHire(data);
      showToast(`Clearance sequence generated for ${hire.name}.`);
      VIEW = { name:'detail', hireId: hire.id };
      render();
    }
  });

  // periodic SLA check while the tab is open
  setInterval(() => runEscalationCheck(true), 60000);
});
