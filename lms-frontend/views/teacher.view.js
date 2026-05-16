/* ============================================================
   views/teacher.view.js
   Pure render functions for Teacher role — returns HTML strings only.
   No direct DOM manipulation; controllers handle that.
   ============================================================ */

"use strict";

const TeacherView = {

  dashboard(user, subjects = null) {
    if (!subjects) {
      return `
        <div class="welcome-banner">
          <div>
            <div class="welcome-title">Hello, ${escHtml(user.name.split(' ')[0])}! 👩‍🏫</div>
            <div class="welcome-sub">Loading your subjects…</div>
          </div>
          <div class="welcome-emoji">📚</div>
        </div>
        <div class="stat-grid mb-4">
          <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📚</div><div><div class="stat-value">—</div><div class="stat-label">My Subjects</div></div></div>
        </div>
        <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading…</div></div>`;
    }
    if (subjects.length === 0) {
      return `
        <div class="welcome-banner">
          <div>
            <div class="welcome-title">Hello, ${escHtml(user.name.split(' ')[0])}! 👩‍🏫</div>
            <div class="welcome-sub">No subjects assigned yet. Contact your administrator.</div>
          </div>
          <div class="welcome-emoji">📚</div>
        </div>
        <div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No subjects assigned</div></div>`;
    }
    const cards = subjects.map(sub => `
      <div class="teacher-subject-card">
        <div class="teacher-subject-header">
          <span class="teacher-subject-name">${escHtml(sub.subject_name)}</span>
          <span class="badge badge-maroon">${escHtml(sub.class_name)}</span>
        </div>
        <div class="teacher-subject-details">
          <div>🏫 ${escHtml(sub.grade_level)}</div>
          <div>⏰ ${sub.schedule ? escHtml(sub.schedule) : 'No schedule'}</div>
        </div>
        <div class="teacher-subject-actions">
          <button class="btn btn-xs btn-outline" onclick="TeacherController.viewStudentsForSubject(${sub.subject_id}, ${sub.class_id}, '${escHtml(sub.subject_name)}')">👥 View Students</button>
          <button class="btn btn-xs btn-outline" onclick="TeacherController.openAddModuleForSubject(${sub.subject_id}, ${sub.class_id})">📤 Upload Material</button>
          <button class="btn btn-xs btn-primary" onclick="DashboardController.loadSection('modules')">📋 Manage Activities</button>
        </div>
      </div>
    `).join('');
    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Hello, ${escHtml(user.name.split(' ')[0])}! 👩‍🏫</div>
          <div class="welcome-sub">Your assigned subjects & sections</div>
        </div>
        <div class="welcome-emoji">📚</div>
      </div>
      <div class="stat-grid mb-4">
        <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📚</div><div><div class="stat-value">${subjects.length}</div><div class="stat-label">Assigned Subjects</div></div></div>
      </div>
      <div class="teacher-subjects-grid">${cards}</div>`;
  },

  mySubjects(user, subjects = null) {
    if (!subjects) return `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading subjects…</div></div>`;
    if (subjects.length === 0) return `<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No subjects assigned</div></div>`;
    const rows = subjects.map(sub => `
      <div class="subject-item" data-searchable>
        <div class="subject-color-dot" style="background:var(--maroon)"></div>
        <div style="font-size:30px">📘</div>
        <div class="subject-info">
          <div class="subject-name">${escHtml(sub.subject_name)}</div>
          <div class="subject-teacher">${escHtml(sub.class_name)} · ${sub.schedule ? escHtml(sub.schedule) : 'No schedule'}</div>
        </div>
        <div class="subject-actions">
          <button class="btn btn-xs btn-outline" onclick="TeacherController.viewStudentsForSubject(${sub.subject_id}, ${sub.class_id}, '${escHtml(sub.subject_name)}')">👥 Students</button>
          <button class="btn btn-xs btn-outline" onclick="TeacherController.openAddModuleForSubject(${sub.subject_id}, ${sub.class_id})">📤 Upload</button>
          <button class="btn btn-xs btn-primary" onclick="DashboardController.loadSection('modules')">📋 Activities</button>
        </div>
      </div>
    `).join('');
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>My Subjects</h2><p>Subjects assigned to you</p></div>
      </div>
      <div class="subject-list">${rows}</div>`;
  },

  modules(user, apiModules = null) {
    if (apiModules === null) {
      return `
        <div class="section-header">
          <div class="section-header-left"><h2>Modules</h2><p id="module-count">Loading…</p></div>
          <div class="flex gap-2"><div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div><button class="btn btn-primary" onclick="TeacherController.openAddModule()">➕ Add Module</button></div>
        </div>
        <div class="module-grid" id="teacher-module-grid"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading modules…</div></div></div>`;
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
      const style   = SUBJECT_STYLES[m._subject_name] || { color: 'var(--maroon)', icon: '📚' };
      const hasFile = !!m.file_url;
      const fileBtn = hasFile
        ? `<a class="btn btn-xs btn-primary" href="${API_BASE}${escHtml(m.file_url)}" target="_blank" rel="noopener">📂 Open PDF</a>`
        : `<span class="btn btn-xs btn-outline" style="opacity:.5;cursor:default">No file</span>`;
      const termLabel = m.term ? `${m.term} Term` : '';
      const meta = [termLabel, m.file_name ? `📎 ${escHtml(m.file_name)}` : ''].filter(Boolean).join(' · ');
      return `<div class="module-card" data-searchable>
        <div class="module-card-header">
          <div class="module-card-subject" style="color:${style.color}">${style.icon} ${escHtml(m._subject_name || 'Unknown')}</div>
          <div class="module-card-title">${escHtml(m.title)}</div>
          <div class="module-card-desc">${escHtml(m.description || '')}</div>
        </div>
        <div class="module-card-footer">
          <span class="module-card-meta">${meta || 'No file attached'}</span>
          <div class="flex gap-1">${fileBtn}<button class="btn btn-xs btn-danger" onclick="TeacherController.deleteModule(${m.id})">🗑️</button></div>
        </div>
      </div>`;
    }).join('');

    const grid = cards || `<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">No modules yet</div><button class="btn btn-primary" onclick="TeacherController.openAddModule()">Add Module</button></div>`;
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>Modules</h2><p id="module-count">${apiModules.length} module(s) uploaded</p></div>
        <div class="flex gap-2"><div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div><button class="btn btn-primary" onclick="TeacherController.openAddModule()">➕ Add Module</button></div>
      </div>
      <div class="module-grid" id="teacher-module-grid">${grid}</div>`;
  },

  activities(user, apiActivities = null) {
    const TYPE_LABELS = {
      quiz:             '📝 Quiz',
      long_quiz:        '📋 Long Quiz',
      task_performance: '🎯 Task Performance',
      exam:             '📜 Exam',
      lab_exercise:     '🔬 Lab Exercise',
      assignment:       '📌 Assignment',
      other:            '📄 Other',
    };
    const FORMAT_LABELS = {
      multiple_choice: '🔘 Multiple Choice',
      checkbox:        '☑️ Checkbox',
      enumeration:     '📝 Fill in Blank',
      freeform:        '✍️ Essay',
      assignment:      '📋 Assignment',
      hybrid:          '🔀 Hybrid',
    };

    if (apiActivities === null) {
      return `
        <div class="section-header">
          <div class="section-header-left"><h2>Activities & Quizzes</h2><p id="act-count">Loading…</p></div>
          <div class="flex gap-2">
            <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search activities…" /></div>
            <button class="btn btn-primary" onclick="TeacherController.openAddActivity()">➕ Create Activity</button>
          </div>
        </div>
        <div id="teacher-activity-grid">
          <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading activities…</div></div>
        </div>`;
    }

    if (!apiActivities.length) {
      return `
        <div class="section-header">
          <div class="section-header-left"><h2>Activities & Quizzes</h2><p>0 activities</p></div>
          <button class="btn btn-primary" onclick="TeacherController.openAddActivity()">➕ Create Activity</button>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No activities yet</div>
          <div class="empty-state-sub">Create your first quiz, exam, or assignment for students.</div>
          <button class="btn btn-primary mt-3" onclick="TeacherController.openAddActivity()">➕ Create Activity</button>
        </div>`;
    }

    const cards = apiActivities.map(a => {
      const typeLabel   = TYPE_LABELS[a.activity_type]  || a.activity_type;
      const formatLabel = FORMAT_LABELS[a.format_type]  || a.format_type;
      const gradeBadge  = a.grading_mode === 'auto'
        ? `<span class="badge badge-green" style="font-size:10px">⚡ Auto</span>`
        : `<span class="badge badge-gold"  style="font-size:10px">✏️ Manual</span>`;
      const dueLabel   = a.due_date   ? `Due: ${new Date(a.due_date).toLocaleDateString()}`     : 'No due date';
      const startLabel = a.start_date ? `Opens: ${new Date(a.start_date).toLocaleDateString()}` : '';
      const qCount     = a.questions?.length ?? 0;
      const maxPts     = a.max_score ?? (a.questions?.reduce((s, q) => s + q.points, 0) ?? 0);
      const pubBadge   = a.is_published
        ? `<span class="badge badge-green" style="font-size:10px">Published</span>`
        : `<span class="badge badge-gray"  style="font-size:10px">Draft</span>`;
      const customType = a.activity_type === 'other' && a.activity_type_custom
        ? ` · ${escHtml(a.activity_type_custom)}` : '';

      return `
        <div class="activity-card" data-searchable style="border:1px solid var(--gray-200);border-radius:10px;padding:16px;background:white;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                <span class="badge badge-maroon" style="font-size:11px">${escHtml(typeLabel)}${escHtml(customType)}</span>
                <span class="badge" style="background:var(--gray-100);color:var(--gray-700);font-size:11px">${escHtml(formatLabel)}</span>
                ${gradeBadge}
                ${pubBadge}
              </div>
              <div style="font-weight:600;font-size:15px;margin-bottom:4px">${escHtml(a.title)}</div>
              ${a.instructions ? `<div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">${escHtml(a.instructions.slice(0,120))}${a.instructions.length > 120 ? '…' : ''}</div>` : ''}
              <div style="font-size:12px;color:var(--gray-400);display:flex;gap:16px;flex-wrap:wrap">
                <span>📊 ${qCount} question${qCount !== 1 ? 's' : ''} · ${maxPts} pts</span>
                <span>📅 ${dueLabel}</span>
                ${startLabel ? `<span>🕑 ${startLabel}</span>` : ''}
                <span>📬 ${a.submission_count ?? 0} submitted</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;min-width:100px">
              <button class="btn btn-xs btn-outline" onclick="TeacherController.openGradeActivity(${a.id})">📊 Submissions</button>
              <button class="btn btn-xs btn-outline" onclick="TeacherController.openEditActivity(${a.id})">✏️ Edit</button>
              <button class="btn btn-xs btn-danger"  onclick="TeacherController.deleteActivity(${a.id})">🗑️ Delete</button>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Activities & Quizzes</h2>
          <p id="act-count">${apiActivities.length} activity(s)</p>
        </div>
        <div class="flex gap-2">
          <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search activities…" /></div>
          <button class="btn btn-primary" onclick="TeacherController.openAddActivity()">➕ Create Activity</button>
        </div>
      </div>
      <div id="teacher-activity-grid">${cards}</div>`;
  },

  grades(user) {
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>Grade Records</h2><p id="grade-count">Loading…</p></div>
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search grades…" /></div>
      </div>
      <div id="grades-table-wrap">
        <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading grades…</div></div>
      </div>`;
  },
};
