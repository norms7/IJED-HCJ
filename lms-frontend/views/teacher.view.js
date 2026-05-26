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
      const resolvedUrl = m.file_url && m.file_url.startsWith('http') ? m.file_url : `${API_BASE}${m.file_url}`;
      const fileBtn = hasFile
        ? `<a class="btn btn-xs btn-primary" href="${escHtml(resolvedUrl)}" target="_blank" rel="noopener">📂 Open PDF</a>`
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

  // ── Digital Gradebook: Sections List ─────────────────────────────────────
  grades(user) {
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>📊 Digital Gradebook</h2>
          <p id="grade-count">Loading sections…</p>
        </div>
        <div class="flex gap-2">
          <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search sections…" /></div>
        </div>
      </div>
      <div id="gradebook-sections-wrap">
        <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading sections…</div></div>
      </div>`;
  },

  // ── Sections list table ───────────────────────────────────────────────────
  gradebookSectionsList(subjects) {
    if (!subjects || subjects.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No sections assigned</div>
        <div class="empty-state-sub">Contact your administrator to get sections assigned.</div>
      </div>`;
    }

    // Group by class (section)
    const sectionMap = {};
    subjects.forEach(sub => {
      const key = sub.class_id;
      if (!sectionMap[key]) {
        sectionMap[key] = {
          class_id:    sub.class_id,
          class_name:  sub.class_name,
          grade_level: sub.grade_level,
          subjects:    [],
        };
      }
      sectionMap[key].subjects.push(sub);
    });
    const sections = Object.values(sectionMap);

    const rows = sections.map(sec => `
      <tr data-searchable style="cursor:pointer" onclick="GradebookController.openSection(${sec.class_id}, '${escHtml(sec.class_name)}')">
        <td>
          <div style="font-weight:600;color:var(--maroon)">${escHtml(sec.class_name)}</div>
          <div style="font-size:12px;color:var(--gray-400)">${escHtml(sec.grade_level || '')}</div>
        </td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${sec.subjects.map(s => `<span class="badge badge-maroon" style="font-size:11px">${escHtml(s.subject_name)}</span>`).join('')}
          </div>
        </td>
        <td><span class="badge badge-gray" id="student-count-${sec.class_id}">Loading…</span></td>
        <td>
          <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();GradebookController.openSection(${sec.class_id}, '${escHtml(sec.class_name)}')">
            📊 View Gradebook
          </button>
        </td>
      </tr>`).join('');

    return `
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Subjects Handled</th>
                <th>Students</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  // ── Section Gradebook Detail Page ─────────────────────────────────────────
  gradebookSection(sectionName, students, activities, modules, subjects) {
    const studentCount = students.length;
    const totalActivities = activities.length;
    const totalModules = modules.length;

    // Build per-student grade summary rows
    const rows = students.map(stu => {
      const studentId   = stu.id;
      const fullName    = `${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || `Student #${studentId}`;
      const studentNum  = stu.student_number || stu.student_profile?.student_number || '—';

      // Submitted activities for this student
      const stuSubs = activities.reduce((acc, act) => {
        const sub = act._submissions?.find(s => s.student_id === studentId);
        if (sub) acc.push({ act, sub });
        return acc;
      }, []);
      const submittedCount = stuSubs.length;

      // Activity score totals
      let totalEarned = 0, totalPossible = 0;
      stuSubs.forEach(({ act, sub }) => {
        if (sub.is_graded && sub.score != null && act.max_score) {
          totalEarned   += sub.score;
          totalPossible += act.max_score;
        }
      });
      const activityPct = totalPossible > 0 ? Math.round(totalEarned / totalPossible * 100) : null;

      // Read modules
      const readCount = stu._modulesRead ?? 0;

      // Weighted grade computation (activities 60%, modules 40%, attendance TBD)
      // Weights: Activities 60%, Modules 40% — Attendance slot reserved for future
      const WEIGHT_ACTIVITIES = 0.60;
      const WEIGHT_MODULES    = 0.40;
      // WEIGHT_ATTENDANCE = 0.XX; // TODO: add attendance column when available

      const modulePct = totalModules > 0 ? Math.round((readCount / totalModules) * 100) : 0;

      let overallPct = null;
      if (activityPct !== null) {
        overallPct = Math.round(
          activityPct   * WEIGHT_ACTIVITIES +
          modulePct     * WEIGHT_MODULES
        );
      } else if (submittedCount === 0 && totalModules > 0) {
        overallPct = Math.round(modulePct * WEIGHT_MODULES);
      }

      // PH grading scale (DepEd transmutation)
      const finalGrade = overallPct !== null ? TeacherView._toPhGrade(overallPct) : '—';
      const gradeColor = finalGrade === '—' ? 'badge-gray'
        : parseFloat(finalGrade) <= 1.75  ? 'badge-green'
        : parseFloat(finalGrade) <= 2.50  ? 'badge-gold'
        : 'badge-danger';

      const actPctBadge = activityPct !== null
        ? `<span class="badge ${activityPct >= 75 ? 'badge-green' : 'badge-danger'}" style="font-size:11px">${activityPct}%</span>`
        : `<span class="badge badge-gray" style="font-size:11px">—</span>`;

      const overallBadge = overallPct !== null
        ? `<span class="badge ${overallPct >= 75 ? 'badge-green' : overallPct >= 60 ? 'badge-gold' : 'badge-danger'}" style="font-size:11px">${overallPct}%</span>`
        : `<span class="badge badge-gray" style="font-size:11px">—</span>`;

      return `<tr data-searchable>
        <td>
          <div style="font-weight:600">${escHtml(fullName)}</div>
        </td>
        <td style="font-size:13px;color:var(--gray-500)">${escHtml(studentNum)}</td>
        <td style="text-align:center">
          <span style="font-weight:600">${submittedCount}</span>/<span style="color:var(--gray-400)">${totalActivities}</span>
        </td>
        <td style="text-align:center">${actPctBadge}</td>
        <td style="text-align:center">
          <span style="font-weight:600">${readCount}</span>/<span style="color:var(--gray-400)">${totalModules}</span>
        </td>
        <td style="text-align:center">
          <span class="badge badge-gray" style="font-size:11px" title="Attendance tracking coming soon">— / —</span>
        </td>
        <td style="text-align:center">${overallBadge}</td>
        <td style="text-align:center">
          <span class="badge ${gradeColor}" style="font-size:12px;font-weight:700">${escHtml(String(finalGrade))}</span>
        </td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="GradebookController.viewStudentBreakdown(${studentId}, '${escHtml(fullName)}')">🔍 Details</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">No students enrolled in this section.</td></tr>`;

    return `
      <div class="section-header">
        <div class="section-header-left">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="DashboardController.loadSection('grades')" style="padding:4px 8px">← Back</button>
            <div>
              <h2>${escHtml(sectionName)} <span style="font-size:16px;font-weight:400;color:var(--gray-400)">(${studentCount} students)</span></h2>
              <p>Final Grade Summary · AY ${new Date().getFullYear()}–${new Date().getFullYear() + 1}</p>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search students…" /></div>
          <button class="btn btn-outline btn-sm" onclick="GradebookController.exportSection('${escHtml(sectionName)}')">
            📥 Export Excel
          </button>
        </div>
      </div>

      <!-- Grade Weight Legend -->
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div class="stat-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Total Students</div>
          <div style="font-size:22px;font-weight:700;color:var(--maroon)">${studentCount}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Activities (60%)</div>
          <div style="font-size:22px;font-weight:700;color:var(--maroon)">${totalActivities}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:140px;padding:12px 16px">
          <div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Modules (40%)</div>
          <div style="font-size:22px;font-weight:700;color:var(--maroon)">${totalModules}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:140px;padding:12px 16px;border:2px dashed var(--gray-200)">
          <div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">Attendance</div>
          <div style="font-size:13px;font-weight:600;color:var(--gray-400)">Coming Soon</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data-table" id="gradebook-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>LRN / Stud. No.</th>
                <th style="text-align:center">Activities<br><span style="font-weight:400;font-size:10px">(submitted/total)</span></th>
                <th style="text-align:center">Activity Score<br><span style="font-weight:400;font-size:10px">(60%)</span></th>
                <th style="text-align:center">Modules Read<br><span style="font-weight:400;font-size:10px">(read/total)</span></th>
                <th style="text-align:center">Attendance<br><span style="font-weight:400;font-size:10px">(future)</span></th>
                <th style="text-align:center">Overall %</th>
                <th style="text-align:center">Final Grade</th>
                <th>Breakdown</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <!-- PH Grade Scale Legend -->
      <div style="margin-top:16px;padding:14px 18px;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--gray-100);font-size:12px;color:var(--gray-500)">
        <strong style="color:var(--gray-600)">Grade Scale (DepEd Transmutation):</strong>
        1.00 (97-100%) · 1.25 (93-96%) · 1.50 (89-92%) · 1.75 (85-88%) · 2.00 (81-84%) ·
        2.25 (77-80%) · 2.50 (73-76%) · 2.75 (69-72%) · 3.00 (65-68%) · 5.00 (&lt;65% · Failed)
        <br><span style="color:var(--gray-400);margin-top:4px;display:block">
          Formula: (Activity% × 60%) + (Module Read% × 40%) · Attendance weight reserved for future integration.
        </span>
      </div>`;
  },

  // ── PH Grade Transmutation (DepEd) ───────────────────────────────────────
  _toPhGrade(pct) {
    if (pct >= 97) return '1.00';
    if (pct >= 93) return '1.25';
    if (pct >= 89) return '1.50';
    if (pct >= 85) return '1.75';
    if (pct >= 81) return '2.00';
    if (pct >= 77) return '2.25';
    if (pct >= 73) return '2.50';
    if (pct >= 69) return '2.75';
    if (pct >= 65) return '3.00';
    return '5.00';
  },
};