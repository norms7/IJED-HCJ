/* ============================================================

   views/student.view.js

   Pure render functions for Student role — returns HTML strings only.

   No direct DOM manipulation; controllers handle that.

   ============================================================ */



"use strict";



const StudentView = {



  /**

   * Render the student dashboard.

   * @param {object} user  - current user session object

   * @param {object|null} stats - result from api.getStudentDashboardStats(), or null while loading

   * @param {Array}  subjects  - result from api.getStudentSubjects()

   * @param {Array}  recentGrades - graded ActivitySubmissions (with _activity + _subject attached)

   */

  dashboard(user, stats = null, subjects = [], recentGrades = []) {

    const firstName = escHtml((user.full_name || user.name || 'Student').split(' ')[0]);



    /* ── Stat card values (show skeleton dashes while loading) ─────────── */

    const enrolledVal  = stats ? stats.enrolled_subjects : '—';

    const modulesVal   = stats ? `${stats.modules.done}/${stats.modules.total}` : '—/—';

    const activitiesVal = stats ? `${stats.activities.done}/${stats.activities.total}` : '—/—';

    const avgVal       = stats ? `${stats.average_score}%` : '—%';



    /* Progress bar widths (capped 0–100) */

    const modPct  = stats && stats.modules.total   ? Math.min(100, Math.round(stats.modules.done   / stats.modules.total   * 100)) : 0;

    const actPct  = stats && stats.activities.total ? Math.min(100, Math.round(stats.activities.done / stats.activities.total * 100)) : 0;



    /* Average score colour */

    const avgNum  = stats ? stats.average_score : 0;

    const avgColor = avgNum >= 90 ? '#22c55e' : avgNum >= 75 ? '#f59e0b' : '#ef4444';



    /* ── Subject list ──────────────────────────────────────────────────── */

    const NAMED = {

      'Mathematics':        { color: '#8b1a2e', icon: '➕' },

      'Science':            { color: '#2e6b3e', icon: '🔬' },

      'English':            { color: '#1a4a8a', icon: '📖' },

      'Filipino':           { color: '#c04a00', icon: '🇵🇭' },

      'MAPEH':              { color: '#6a0dad', icon: '🎨' },

      'Araling Panlipunan': { color: '#0d6e8a', icon: '🌐' },

      'TLE':                { color: '#7a5500', icon: '🔧' },

    };

    const subjectHTML = subjects.length

      ? subjects.map((s, i) => {

          const info = NAMED[s.subject_name] || { color: '#555', icon: '📚' };

          return `

            <div class="db-subject-item" style="display:flex;align-items:center;gap:12px;padding:9px 10px;margin:4px 0;border-radius:10px;border-left:3px solid ${info.color};background:linear-gradient(90deg,${info.color}12 0%,transparent 80%);transition:background .18s;">

              <div style="width:36px;height:36px;border-radius:9px;background:${info.color};display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;box-shadow:0 2px 6px ${info.color}44">${info.icon}</div>

              <div style="flex:1;min-width:0">

                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1a1a2e">${escHtml(s.subject_name)}</div>

                <div style="font-size:11px;color:var(--gray-400);margin-top:1px">${escHtml(s.class_name || '—')}</div>

              </div>

              <span style="font-size:16px;color:${info.color};opacity:.45;flex-shrink:0">›</span>

            </div>`;

        }).join('')

      : `<p class="text-muted text-sm" style="padding:12px 0">No subjects enrolled yet</p>`;



    /* ── Recent grades list ────────────────────────────────────────────── */

    const gradesHTML = recentGrades.length

      ? recentGrades.slice(0, 6).map(sub => {

          if (!sub.is_graded || sub.score === null) {

            return `

              <div style="display:flex;align-items:center;gap:12px;padding:9px 10px;margin:4px 0;border-radius:10px;border-left:3px solid #d1d5db;background:#fafafa;">

                <div style="width:36px;height:36px;border-radius:50%;border:2px solid #e5e7eb;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#aaa;font-weight:700">?</div>

                <div style="flex:1;min-width:0">

                  <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1a1a2e">${escHtml(sub._activity || '?')}</div>

                  <div style="font-size:11px;color:var(--gray-400);margin-top:1px">${escHtml(sub._subject || '?')}</div>

                </div>

                <span class="badge badge-gray" style="font-size:10px;flex-shrink:0">Pending</span>

              </div>`;

          }

          const pct  = sub.max_score > 0 ? Math.round((sub.score ?? 0) / sub.max_score * 100) : 0;

          const gc   = pct >= 90 ? 'badge-green' : pct >= 75 ? 'badge-gold' : 'badge-red';

          const gl   = pct >= 90 ? 'Excellent'  : pct >= 75 ? 'Passing'    : 'Needs Work';

          const ringColor = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444';

          const ringBg    = pct >= 90 ? '#e6f4ea'  : pct >= 75 ? '#fff8e1'  : '#fde8ec';

          const borderCol = pct >= 90 ? '#22c55e'  : pct >= 75 ? '#f59e0b'  : '#ef4444';

          return `

            <div style="display:flex;align-items:center;gap:12px;padding:9px 10px;margin:4px 0;border-radius:10px;border-left:3px solid ${borderCol};background:linear-gradient(90deg,${borderCol}10 0%,transparent 80%);">

              <div style="width:36px;height:36px;border-radius:50%;border:2.5px solid ${ringColor};background:${ringBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:800;color:${ringColor}">${pct}%</div>

              <div style="flex:1;min-width:0">

                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1a1a2e">${escHtml(sub._activity || '?')}</div>

                <div style="font-size:11px;color:var(--gray-400);margin-top:1px">${escHtml(sub._subject || '?')} · ${sub.score}/${sub.max_score}</div>

              </div>

              <span class="badge ${gc}" style="font-size:10px;flex-shrink:0">${gl}</span>

            </div>`;

        }).join('')

      : `<p class="text-muted text-sm" style="padding:12px 0">No activity submissions yet</p>`;



    return `

      <div class="welcome-banner">

        <div class="welcome-text">

          <div class="welcome-title">Hi, ${firstName}! 🎓</div>

          <div class="welcome-sub">Keep learning — every step forward counts!</div>

        </div>

        <div class="welcome-emoji">📖</div>

      </div>



      <div class="stat-grid mb-4">



        <!-- Enrolled Subjects -->

        <div class="stat-card">

          <div class="stat-icon" style="background:#fde8ec">📚</div>

          <div>

            <div class="stat-value">${enrolledVal}</div>

            <div class="stat-label">Enrolled Subjects</div>

          </div>

        </div>



        <!-- Modules progress -->

        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px">

          <div style="display:flex;align-items:center;gap:12px;width:100%">

            <div class="stat-icon" style="background:#e6f4ea;flex-shrink:0">📄</div>

            <div style="flex:1">

              <div class="stat-value">${modulesVal}</div>

              <div class="stat-label">Modules Read</div>

            </div>

          </div>

          <div style="width:100%;height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden">

            <div style="height:100%;width:${modPct}%;background:#22c55e;border-radius:3px;transition:width .4s ease"></div>

          </div>

        </div>



        <!-- Activities progress -->

        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px">

          <div style="display:flex;align-items:center;gap:12px;width:100%">

            <div class="stat-icon" style="background:#fff0e6;flex-shrink:0">📋</div>

            <div style="flex:1">

              <div class="stat-value">${activitiesVal}</div>

              <div class="stat-label">Activities Done</div>

            </div>

          </div>

          <div style="width:100%;height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden">

            <div style="height:100%;width:${actPct}%;background:#f59e0b;border-radius:3px;transition:width .4s ease"></div>

          </div>

        </div>



        <!-- Average score -->

        <div class="stat-card">

          <div class="stat-icon" style="background:#e8f0fa">📊</div>

          <div>

            <div class="stat-value" style="color:${avgColor}">${avgVal}</div>

            <div class="stat-label">Average Score</div>

          </div>

        </div>



      </div>



      <div class="dashboard-panels">

        <div class="card">

          <div class="card-header" style="border-bottom:1px solid var(--gray-100);padding-bottom:10px">

            <span class="card-title" style="display:flex;align-items:center;gap:7px">

              <span style="font-size:16px">📚</span> My Subjects

              ${subjects.length ? `<span style="font-size:11px;font-weight:500;color:var(--gray-400);margin-left:2px">${subjects.length} enrolled</span>` : ''}

            </span>

          </div>

          <div class="card-body" style="padding:4px 10px 8px">${subjectHTML}</div>

        </div>

        <div class="card">

          <div class="card-header" style="border-bottom:1px solid var(--gray-100);padding-bottom:10px">

            <span class="card-title" style="display:flex;align-items:center;gap:7px">

              <span style="font-size:16px">🏆</span> Recent Grades

              ${recentGrades.length ? `<span style="font-size:11px;font-weight:500;color:var(--gray-400);margin-left:2px">${Math.min(recentGrades.length,6)} latest</span>` : ''}

            </span>

          </div>

          <div class="card-body" style="padding:4px 10px 8px">${gradesHTML}</div>

        </div>

      </div>`;

  },



  mySubjects(apiSubjects = null, apiModules = [], apiActivities = []) {

    if (apiSubjects === null) {

      return `

        <div class="section-header">

          <div class="section-header-left"><h2>My Subjects</h2><p>All enrolled subjects this term</p></div>

          <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search subjects…" /></div>

        </div>

        <div class="subject-list" id="student-subjects-list">

          <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading subjects…</div></div>

        </div>`;

    }



    const PALETTE = [

      { color: '#8b1a2e', icon: '➕' }, { color: '#2e6b3e', icon: '🔬' },

      { color: '#1a4a8a', icon: '📖' }, { color: '#c04a00', icon: '🇵🇭' },

      { color: '#6a0dad', icon: '🎨' }, { color: '#0d6e8a', icon: '🌐' },

      { color: '#7a5500', icon: '📐' }, { color: '#3d3d3d', icon: '📚' },

    ];

    const NAMED = {

      'Mathematics':        { color: '#8b1a2e', icon: '➕' },

      'Science':            { color: '#2e6b3e', icon: '🔬' },

      'English':            { color: '#1a4a8a', icon: '📖' },

      'Filipino':           { color: '#c04a00', icon: '🇵🇭' },

      'MAPEH':              { color: '#6a0dad', icon: '🎨' },

      'Araling Panlipunan': { color: '#0d6e8a', icon: '🌐' },

      'TLE':                { color: '#7a5500', icon: '🔧' },

    };

    const TERM_ORDER  = ['1st Term', '2nd Term', '3rd Term', '4th Term'];

    const TERM_LABELS = { '1st': '1st Term', '2nd': '2nd Term', '3rd': '3rd Term', '4th': '4th Term' };

    const API_BASE    = 'https://ijed-hcj-1.onrender.com';



    if (!apiSubjects || !apiSubjects.length) {

      return `

        <div class="section-header">

          <div class="section-header-left"><h2>My Subjects</h2><p>All enrolled subjects this term</p></div>

        </div>

        <div class="empty-state" style="margin-top:40px">

          <div class="empty-state-icon">📭</div>

          <div class="empty-state-title">No Subjects Yet</div>

          <div class="empty-state-desc">You have not been enrolled in any subjects yet. Please contact your admin or adviser.</div>

        </div>`;

    }



    const modulesBySubjectTerm = {};

    (apiModules || []).forEach(m => {

      const sid  = m.subject_id;

      const term = TERM_LABELS[m.term || ''] || (m.term ? m.term + ' Term' : 'Other');

      if (!modulesBySubjectTerm[sid]) modulesBySubjectTerm[sid] = {};

      if (!modulesBySubjectTerm[sid][term]) modulesBySubjectTerm[sid][term] = [];

      modulesBySubjectTerm[sid][term].push(m);

    });



    const activitiesBySubjectTerm = {};

    (apiActivities || []).forEach(a => {

      const sid  = a.subject_id;

      const term = TERM_LABELS[a.term || ''] || (a.term ? a.term + ' Term' : 'Other');

      if (!activitiesBySubjectTerm[sid]) activitiesBySubjectTerm[sid] = {};

      if (!activitiesBySubjectTerm[sid][term]) activitiesBySubjectTerm[sid][term] = [];

      activitiesBySubjectTerm[sid][term].push(a);

    });



    function buildTermContent(subjectId) {

      const mByTerm  = modulesBySubjectTerm[subjectId]    || {};

      const aByTerm  = activitiesBySubjectTerm[subjectId] || {};

      const allTerms = [...new Set([...Object.keys(mByTerm), ...Object.keys(aByTerm)])];

      allTerms.sort((a, b) => {

        const ia = TERM_ORDER.indexOf(a), ib = TERM_ORDER.indexOf(b);

        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);

      });



      if (!allTerms.length) {

        return `<div class="subject-accordion-empty">

          <span style="font-size:28px;opacity:.4">📭</span>

          <p>No modules or activities posted yet for this subject.</p>

        </div>`;

      }



      const TYPE_MAP = { quiz:'Quiz', long_quiz:'Long Quiz', task_performance:'Task Perf.', exam:'Exam', lab_exercise:'Lab', assignment:'Assignment', other:'Other' };



      return allTerms.map(term => {

        const modules   = mByTerm[term]  || [];

        const activites = aByTerm[term]  || [];



        const moduleRows = modules.map(m => {

          const hasFile = !!m.file_url;

          const resolvedUrl = m.file_url && m.file_url.startsWith('http') ? m.file_url : `${API_BASE}${m.file_url}`;

          return `<div class="accordion-content-item">

            <span class="acc-item-icon">📄</span>

            <span class="acc-item-label">${escHtml(m.title)}${m.description ? '<span class="acc-item-desc">' + escHtml(m.description) + '</span>' : ''}</span>

            ${hasFile

              ? `<a class="btn btn-xs btn-primary" href="${escHtml(resolvedUrl)}" target="_blank" rel="noopener" onclick="StudentController.trackModuleRead(${m.id})">Open 📖</a>`

              : `<span class="btn btn-xs btn-outline" style="opacity:.45;cursor:default;pointer-events:none">No file</span>`}

          </div>`;

        }).join('');



        const actRows = activites.map(a => {

          const typeLabel   = TYPE_MAP[a.activity_type] || a.activity_type || 'Activity';

          const statusColor = { open:'#2e6b3e', graded:'#1a4a8a', submitted:'#6a0dad', past_due:'#c00', not_open:'#888' }[a.status] || '#666';

          const statusLabel = a.status_label || a.status || '';

          const dueStr      = a.due_date

            ? new Date(a.due_date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})

            : '';

          return `<div class="accordion-content-item">

            <span class="acc-item-icon">📝</span>

            <span class="acc-item-label">${escHtml(a.title || a.activity_type)}

              <span class="acc-item-desc">${escHtml(typeLabel)}${dueStr ? ' · Due: ' + dueStr : ''}</span>

            </span>

            <span style="font-size:11px;font-weight:600;color:${statusColor};white-space:nowrap">${escHtml(statusLabel)}</span>

          </div>`;

        }).join('');



        return `<div class="accordion-term-section">

          <div class="accordion-term-heading">

            <span class="acc-term-badge">${escHtml(term)}</span>

            <span class="acc-term-counts">${modules.length} module${modules.length !== 1 ? 's' : ''} · ${activites.length} activit${activites.length !== 1 ? 'ies' : 'y'}</span>

          </div>

          ${modules.length  ? '<div class="acc-section-label">📚 Modules</div>'    + moduleRows : ''}

          ${activites.length ? '<div class="acc-section-label">📝 Activities</div>' + actRows    : ''}

        </div>`;

      }).join('');

    }



    const cards = apiSubjects.map((s, idx) => {

      const style  = NAMED[s.subject_name] || PALETTE[idx % PALETTE.length];

      const sid    = s.subject_id;

      const mCount = (apiModules    || []).filter(m => m.subject_id === sid).length;

      const aCount = (apiActivities || []).filter(a => a.subject_id === sid).length;



      return `

        <div class="student-subject-card" data-searchable data-subject-id="${sid}">

          <div class="student-subject-card-header">

            <div style="width:44px;height:44px;border-radius:10px;background:${style.color};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${style.icon}</div>

            <div class="subject-info" style="flex:1">

              <div class="subject-name">${escHtml(s.subject_name)}</div>

              <div class="subject-teacher">

                Class: <strong>${escHtml(s.class_name || '—')}</strong>

                <span style="margin-left:10px;font-size:11px;color:var(--gray-400)">

                  ${mCount} module${mCount !== 1 ? 's' : ''} · ${aCount} activit${aCount !== 1 ? 'ies' : 'y'}

                </span>

              </div>

            </div>

            <span class="accordion-chevron" style="font-size:18px;color:var(--gray-400);transition:transform .25s;flex-shrink:0">▾</span>

          </div>

          <div class="subject-accordion-body" style="max-height:0;overflow:hidden;transition:max-height .3s ease">

            <div class="subject-accordion-inner">

              ${buildTermContent(sid)}

            </div>

          </div>

        </div>`;

    }).join('');



    return `

      <div class="section-header">

        <div class="section-header-left">

          <h2>My Subjects</h2>

          <p>${apiSubjects.length} enrolled subject${apiSubjects.length !== 1 ? 's' : ''} · click a subject to expand</p>

        </div>

        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search subjects…" /></div>

      </div>

      <div class="subject-list" id="student-subjects-list">${cards}</div>`;

  },



  modules(apiModules = null) {

    if (apiModules === null) {

      return `<div class="section-header"><div class="section-header-left"><h2>Learning Modules</h2><p id="module-count">Loading…</p></div><div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div></div><div class="module-grid" id="student-module-grid"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading modules…</div></div></div>`;

    }



    const SUBJECT_STYLES = {

      'Mathematics': { color: '#8b0020', icon: '➕' },

      'Science':     { color: '#2e6b3e', icon: '🔬' },

      'English':     { color: '#1a4a8a', icon: '📖' },

      'Filipino':    { color: '#c04a00', icon: '🇵🇭' },

      'MAPEH':       { color: '#6a0dad', icon: '🎨' },

    };

    const API_BASE = 'https://ijed-hcj-1.onrender.com';



    const cards = apiModules.map(m => {

      const style     = SUBJECT_STYLES[m._subject_name] || { color: 'var(--maroon)', icon: '📚' };

      const termLabel = m.term ? `${m.term} Term` : '';

      const meta      = [termLabel, m.fi
