/* ============================================================
   views/views.js
   Pure render functions — return HTML strings only.
   No direct DOM manipulation here; controllers handle that.
   ============================================================ */

"use strict";

/* ══════════════════════════════════════════════════════════════
   ADMIN VIEWS
   ══════════════════════════════════════════════════════════════ */
const AdminView = {

  /** Main admin dashboard with overview stats */
  dashboard(user) {
    const users      = userModel.getAll();
    const teachers   = userModel.getByRole('teacher');
    const students   = userModel.getByRole('student');
    const modules    = moduleModel.getAll();
    const activities = activityModel.getAll();

    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Good day, ${escHtml(user.name.split(' ')[0])}! 👋</div>
          <div class="welcome-sub">Here's an overview of the IJED Learning Management System.</div>
        </div>
        <div class="welcome-emoji">👨‍💼</div>
      </div>

      <div class="stat-grid mb-4">
        ${this._statCard('👥', '#fde8ec', users.length,      'Total Users')}
        ${this._statCard('👩‍🏫', '#e6f4ea', teachers.length,  'Teachers')}
        ${this._statCard('🎓', '#fff0e6',  students.length,   'Students')}
        ${this._statCard('📄', '#e8f0fa',  modules.length,    'Modules')}
        ${this._statCard('📝', '#fde8ec',  activities.length, 'Activities')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap;">
        <div class="card">
          <div class="card-header"><span class="card-title">Recent Users</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                ${users.slice(-5).reverse().map(u => `
                  <tr>
                    <td><strong>${escHtml(u.name)}</strong></td>
                    <td><span class="badge badge-maroon">${escHtml(u.role)}</span></td>
                    <td class="text-sm text-muted">${fmtDate(u.createdAt)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Quick Actions</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-primary w-full" style="justify-content:center" onclick="AdminController.openAddUser()">➕ Add New User</button>
            <button class="btn btn-outline w-full" style="justify-content:center" onclick="DashboardController.loadSection('manage-teachers')">👩‍🏫 Manage Teachers</button>
            <button class="btn btn-outline w-full" style="justify-content:center" onclick="DashboardController.loadSection('manage-students')">🎓 Manage Students</button>
            <button class="btn btn-outline w-full" style="justify-content:center" onclick="DashboardController.loadSection('manage-users')">👥 All Users</button>
          </div>
        </div>
      </div>`;
  },

  _statCard(icon, bg, value, label) {
    return `<div class="stat-card">
      <div class="stat-icon" style="background:${bg}">${icon}</div>
      <div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
    </div>`;
  },

  /* ── Unified Manage Users (all non-admin) ──────────────── */
  manageUsers() {
    const users    = userModel.getAllIncluding().filter(u => u.role !== 'admin');
    const teachers = users.filter(u => u.role === 'teacher');
    const students = users.filter(u => u.role === 'student');
    const sections = sectionModel.getAll();
    const activeCount = users.filter(u => u.isActive).length;

    return `
      <div class="um-page">
        <!-- Page header -->
        <div class="um-header">
          <div>
            <h2 style="margin:0;font-size:22px;color:var(--maroon-dark)">Manage Users</h2>
            <p style="margin:4px 0 0;color:var(--gray-400);font-size:13px">
              ${activeCount} active · ${teachers.filter(t=>t.isActive).length} teachers · ${students.filter(s=>s.isActive).length} students
            </p>
          </div>
          <div class="um-header-actions">
            <button class="btn btn-outline btn-sm" onclick="AdminController.exportCSV('all')">⬇ Export CSV</button>
            <button class="btn btn-outline btn-sm" onclick="AdminController.openImportCSV()">⬆ Import CSV</button>
            <button class="btn btn-primary"        onclick="AdminController.openAddUser()">➕ Add User</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="um-tabs">
          <button class="um-tab active" id="tab-all"      onclick="AdminController._switchTab('all')">All Users (${users.length})</button>
          <button class="um-tab"        id="tab-teachers" onclick="AdminController._switchTab('teachers')">👩‍🏫 Teachers (${teachers.length})</button>
          <button class="um-tab"        id="tab-students" onclick="AdminController._switchTab('students')">🎓 Students (${students.length})</button>
          <button class="um-tab"        id="tab-sections" onclick="AdminController._switchTab('sections')">🏫 Sections (${sections.length})</button>
          <button class="um-tab"        id="tab-audit"    onclick="AdminController._switchTab('audit')">📋 Audit Log</button>
        </div>

        <!-- Tab panes -->
        <div id="um-pane-all">      ${this._allUsersPane(users)}</div>
        <div id="um-pane-teachers"  style="display:none">${this._teachersPane(teachers)}</div>
        <div id="um-pane-students"  style="display:none">${this._studentsPane(students, sections)}</div>
        <div id="um-pane-sections"  style="display:none">${this._sectionsPane(sections)}</div>
        <div id="um-pane-audit"     style="display:none">${this._auditPane()}</div>
      </div>`;
  },

  /* ── All Users pane ─────────────────────────────────────── */
  _allUsersPane(users) {
    const rows = users.map(u => {
      const roleTag = `<span class="badge badge-${u.role === 'teacher' ? 'blue' : 'green'}">${u.role}</span>`;
      const extra   = u.role === 'teacher'
        ? escHtml(u.subject || '—')
        : `${escHtml(u.grade||'')} ${escHtml(u.section||'')}`.trim() || '—';
      return `<tr data-searchable>
        <td><strong>${escHtml(u.name)}</strong></td>
        <td class="text-sm">${escHtml(u.email)}</td>
        <td>${roleTag}</td>
        <td class="text-sm">${extra}</td>
        <td class="text-sm text-muted">${fmtDate(u.createdAt)}</td>
        <td><span class="badge ${u.isActive ? 'badge-green' : 'badge-red'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-xs btn-outline" onclick="AdminController.openEditUser('${u.id}')">✏️ Edit</button>
            <button class="btn btn-xs btn-danger"  onclick="AdminController.deleteUser('${u.id}')">🗑 Remove</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search by name, email, section…"/></div>
        <select class="form-control" style="width:140px" onchange="AdminController._filterRole(this.value)">
          <option value="">All Roles</option><option value="teacher">Teacher</option><option value="student">Student</option>
        </select>
        <select class="form-control" style="width:140px" onchange="AdminController._filterStatus(this.value)">
          <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Subject / Section</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="user-table-body">${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ── Teachers pane ──────────────────────────────────────── */
  _teachersPane(teachers) {
    const cards = teachers.map(t => {
      const subjects  = subjectModel.getByTeacher(t.id);
      const schedules = scheduleModel.getByTeacher(t.id);
      const sections  = sectionModel.getByAdviser(t.id);
      const subjectTags = subjects.map(s =>
        `<span class="tag" style="background:${s.color}20;color:${s.color};border:1px solid ${s.color}40">${s.icon} ${escHtml(s.name)}</span>`
      ).join('') || '<span class="text-muted" style="font-size:12px">No subjects assigned</span>';
      const sectionTags = sections.map(sec =>
        `<span class="tag tag-section">${escHtml(sec.gradeLevel)} – ${escHtml(sec.name)}</span>`
      ).join('') || '<span class="text-muted" style="font-size:12px">No advisory section</span>';

      const schRows = schedules.map(sch => {
        const sub = subjectModel.getById(sch.subjectId);
        const sec = sectionModel.getById(sch.sectionId);
        return `<div class="sch-row"><span class="sch-day">${sch.day.slice(0,3)}</span><span class="sch-time">${sch.timeStart}–${sch.timeEnd}</span><span class="sch-info">${sub?escHtml(sub.name):'?'} · ${sec?escHtml(sec.gradeLevel+' '+sec.name):'?'} · ${escHtml(sch.room)}</span></div>`;
      }).join('') || '<div class="text-muted" style="font-size:12px;padding:4px 0">No schedules yet</div>';

      return `
        <div class="teacher-card ${t.isActive ? '' : 'card-inactive'}">
          <div class="teacher-card-header">
            <div class="teacher-avatar">${t.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
            <div class="teacher-info">
              <div class="teacher-name">${escHtml(t.name)}</div>
              <div class="teacher-email">${escHtml(t.email)}</div>
              <span class="badge ${t.isActive ? 'badge-green' : 'badge-red'}" style="font-size:11px">${t.isActive?'Active':'Inactive'}</span>
            </div>
            <div class="teacher-actions">
              <button class="btn btn-xs btn-outline" onclick="AdminController.openEditTeacher('${t.id}')">✏️ Edit</button>
              <button class="btn btn-xs btn-outline" onclick="AdminController.openAssignSchedule('${t.id}')">📅 Schedule</button>
              <button class="btn btn-xs btn-danger"  onclick="AdminController.deleteUser('${t.id}')">🗑</button>
            </div>
          </div>
          <div class="teacher-card-body">
            <div class="teacher-section-label">Subjects</div>
            <div class="teacher-tags">${subjectTags}</div>
            <div class="teacher-section-label" style="margin-top:10px">Advisory Section</div>
            <div class="teacher-tags">${sectionTags}</div>
            <div class="teacher-section-label" style="margin-top:10px">Weekly Schedule</div>
            <div class="sch-list">${schRows}</div>
          </div>
        </div>`;
    }).join('') || '<div class="empty-state"><div class="empty-state-icon">👩‍🏫</div><div class="empty-state-title">No teachers yet</div></div>';

    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" placeholder="Search teachers…" oninput="AdminController._filterCards(this.value,'teacher-card')"/></div>
        <button class="btn btn-primary" onclick="AdminController.openAddUser('teacher')">➕ Add Teacher</button>
      </div>
      <div class="teacher-grid">${cards}</div>`;
  },

  /* ── Students pane ──────────────────────────────────────── */
  _studentsPane(students, sections) {
    const sectionOpts = sections.map(s =>
      `<option value="${s.id}">${escHtml(s.gradeLevel)} – ${escHtml(s.name)}</option>`
    ).join('');

    // Group by section
    const bySection = {};
    students.forEach(s => {
      const key = s.section ? `${s.grade||''}|${s.section}` : '__none__';
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(s);
    });

    const sectionBlocks = Object.keys(bySection).map(key => {
      const grp = bySection[key];
      const [grade, sec] = key === '__none__' ? ['', 'Unassigned'] : key.split('|');
      const matchedSec = sections.find(s => s.gradeLevel === grade && s.name === sec);
      const adviser    = matchedSec ? userModel.getById(matchedSec.adviserId) : null;

      const rows = grp.map(u => {
        const grades = gradeModel.getByStudent(u.id);
        const avg    = grades.length
          ? Math.round(grades.reduce((s,g) => s + g.score/g.maxScore*100, 0) / grades.length)
          : null;
        const avgBadge = avg !== null
          ? `<span class="grade-pill ${avg>=75?'grade-pass':'grade-fail'}">${avg}%</span>`
          : '<span class="text-muted" style="font-size:12px">—</span>';

        return `<tr data-searchable data-section="${key}">
          <td><strong>${escHtml(u.name)}</strong></td>
          <td class="text-sm">${escHtml(u.email)}</td>
          <td class="text-sm text-muted">${fmtDate(u.createdAt)}</td>
          <td>${avgBadge}</td>
          <td><span class="badge ${u.isActive ? 'badge-green' : 'badge-red'}">${u.isActive?'Active':'Inactive'}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-xs btn-outline" onclick="AdminController.openEditUser('${u.id}')">✏️ Edit</button>
              <button class="btn btn-xs btn-outline" onclick="AdminController.viewStudentProfile('${u.id}')">👁 View</button>
              <button class="btn btn-xs btn-danger"  onclick="AdminController.deleteUser('${u.id}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('');

      return `
        <div class="section-block">
          <div class="section-block-header">
            <span class="section-block-title">🏫 ${escHtml(grade)} – ${escHtml(sec)}</span>
            ${adviser ? `<span class="section-block-adviser">Adviser: ${escHtml(adviser.name)}</span>` : ''}
            <span class="section-block-count">${grp.length} student${grp.length!==1?'s':''}</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Enrolled</th><th>Avg Grade</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('') || '<div class="empty-state"><div class="empty-state-icon">🎓</div><div class="empty-state-title">No students yet</div></div>';

    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" id="student-search" placeholder="Search students…" oninput="AdminController._filterStudents(this.value)"/></div>
        <select class="form-control" style="width:200px" onchange="AdminController._filterBySection(this.value)">
          <option value="">All Sections</option>${sectionOpts}
        </select>
        <button class="btn btn-primary" onclick="AdminController.openAddUser('student')">➕ Add Student</button>
        <button class="btn btn-outline btn-sm" onclick="AdminController.exportCSV('student')">⬇ Export</button>
      </div>
      <div id="student-section-blocks">${sectionBlocks}</div>`;
  },

  /* ── Sections pane ──────────────────────────────────────── */
  _sectionsPane(sections) {
    const rows = sections.map(sec => {
      const adviser  = userModel.getById(sec.adviserId);
      const students = userModel.getByRole('student').filter(u => u.grade === sec.gradeLevel && u.section === sec.name);
      const schCount = scheduleModel.getBySection(sec.id).length;
      return `<tr>
        <td><strong>${escHtml(sec.gradeLevel)} – ${escHtml(sec.name)}</strong></td>
        <td class="text-sm">${escHtml(sec.room)}</td>
        <td class="text-sm">${adviser ? escHtml(adviser.name) : '<span class="text-muted">Unassigned</span>'}</td>
        <td class="text-sm">${students.length} students</td>
        <td class="text-sm">${schCount} periods</td>
        <td class="text-sm text-muted">${escHtml(sec.schoolYear)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-xs btn-outline" onclick="AdminController.openEditSection('${sec.id}')">✏️ Edit</button>
            <button class="btn btn-xs btn-outline" onclick="AdminController.viewSectionSchedule('${sec.id}')">📅 Schedule</button>
            <button class="btn btn-xs btn-danger"  onclick="AdminController.deleteSection('${sec.id}')">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="um-toolbar">
        <button class="btn btn-primary" onclick="AdminController.openAddSection()">➕ Add Section</button>
      </div>
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Section</th><th>Room</th><th>Adviser</th><th>Students</th><th>Periods/Week</th><th>School Year</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ── Audit Log pane ─────────────────────────────────────── */
  _auditPane() {
    const logs = auditModel.getRecent(100);
    if (!logs.length) return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No audit records yet</div></div>`;

    const actionColor = { CREATE:'#2e6b3e', UPDATE:'#1a4a8a', DELETE:'#b71c1c', ASSIGN:'#c04a00', IMPORT:'#6a0dad' };
    const rows = logs.map(l => {
      const admin = userModel.getById(l.adminId);
      const dt    = new Date(l.timestamp);
      const fmt   = dt.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) + ' ' + dt.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
      const col   = actionColor[l.action] || '#666';
      return `<tr>
        <td><span class="tag" style="background:${col}20;color:${col};border:1px solid ${col}40;font-size:11px;font-weight:700">${l.action}</span></td>
        <td class="text-sm">${escHtml(l.entity)}</td>
        <td class="text-sm">${escHtml(l.details)}</td>
        <td class="text-sm">${admin ? escHtml(admin.name) : 'System'}</td>
        <td class="text-sm text-muted">${fmt}</td>
      </tr>`;
    }).join('');

    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" placeholder="Search logs…" oninput="AdminController._filterTable(this.value,'audit-body')"/></div>
        <button class="btn btn-outline btn-sm" onclick="AdminController.clearAuditLog()">🗑 Clear Log</button>
      </div>
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Action</th><th>Entity</th><th>Details</th><th>Admin</th><th>Timestamp</th></tr></thead>
            <tbody id="audit-body">${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ── Redirect helpers (old nav items still work) ────────── */
  manageTeachers() {
    const view = this.manageUsers();
    // We'll switch tab after render via postRender
    AdminController._pendingTab = 'teachers';
    return view;
  },

  manageStudents() {
    AdminController._pendingTab = 'students';
    return this.manageUsers();
  },

  settings(user) {
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>Settings</h2><p>Manage your account preferences</p></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:820px;">
        <div class="card">
          <div class="card-header"><span class="card-title">Profile Information</span></div>
          <div class="card-body">
            <div class="form-group"><label class="form-label">Full Name</label>
              <input class="form-control" id="settings-name" value="${escHtml(user.name)}" /></div>
            <div class="form-group"><label class="form-label">Email Address</label>
              <input class="form-control" id="settings-email" value="${escHtml(user.email)}" /></div>
            <button class="btn btn-primary" onclick="AdminController.saveSettings()">Save Changes</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Change Password</span></div>
          <div class="card-body">
            <div class="form-group"><label class="form-label">New Password</label>
              <input class="form-control" type="password" id="settings-pw" placeholder="Enter new password" /></div>
            <div class="form-group"><label class="form-label">Confirm Password</label>
              <input class="form-control" type="password" id="settings-pw2" placeholder="Confirm new password" /></div>
            <button class="btn btn-primary" onclick="AdminController.changePassword()">Update Password</button>
          </div>
        </div>
      </div>`;
  },
};
/* ══════════════════════════════════════════════════════════════
   TEACHER VIEWS
   ══════════════════════════════════════════════════════════════ */
const TeacherView = {

  dashboard(user) {
    const subjects   = subjectModel.getByTeacher(user.id);
    const modules    = moduleModel.getByTeacher(user.id);
    const activities = activityModel.getByTeacher(user.id);
    const myActIds   = new Set(activities.map(a => a.id));
    const gradesGiven = gradeModel.getAll().filter(g => myActIds.has(g.activityId));

    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Hello, ${escHtml(user.name.split(' ')[0])}! 👩‍🏫</div>
          <div class="welcome-sub">Here's a summary of your teaching activities.</div>
        </div>
        <div class="welcome-emoji">📚</div>
      </div>

      <div class="stat-grid mb-4">
        <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📚</div>
          <div><div class="stat-value">${subjects.length}</div><div class="stat-label">My Subjects</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e6f4ea">📄</div>
          <div><div class="stat-value">${modules.length}</div><div class="stat-label">Modules Uploaded</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fff0e6">📝</div>
          <div><div class="stat-value">${activities.length}</div><div class="stat-label">Activities</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e8f0fa">📊</div>
          <div><div class="stat-value">${gradesGiven.length}</div><div class="stat-label">Grades Given</div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
          <div class="card-header"><span class="card-title">My Subjects</span></div>
          <div class="card-body" style="padding:16px;">
            <div class="subject-list">
              ${subjects.map(s => `
                <div class="subject-item">
                  <div class="subject-color-dot" style="background:${s.color}"></div>
                  <div class="subject-info">
                    <div class="subject-name">${escHtml(s.name)}</div>
                    <div class="subject-teacher">${escHtml(s.description || '')}</div>
                  </div>
                  <span>${s.icon}</span>
                </div>`).join('') || '<p class="text-muted text-sm">No subjects assigned</p>'}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Recent Activities</span></div>
          <div class="card-body" style="padding:12px 16px;">
            ${activities.slice(0, 4).map(a => `
              <div class="activity-card" style="padding:12px 14px;margin-bottom:8px;">
                <div class="activity-type-icon" style="${typeBg(a.type)}">${typeEmoji(a.type)}</div>
                <div>
                  <div class="activity-title" style="font-size:13px;">${escHtml(a.title)}</div>
                  <div class="activity-meta">Due: ${fmtDate(a.dueDate)} · ${a.points} pts</div>
                </div>
              </div>`).join('') || '<p class="text-muted text-sm">No activities yet</p>'}
          </div>
        </div>
      </div>`;
  },

  mySubjects(user) {
    const subjects = subjectModel.getByTeacher(user.id);
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>My Subjects</h2><p>Subjects assigned to you</p></div>
      </div>
      <div class="module-grid">
        ${subjects.map(s => `
          <div class="module-card">
            <div class="module-card-header" style="border-left:4px solid ${s.color}">
              <div class="module-card-subject" style="color:${s.color}">${s.icon} Subject</div>
              <div class="module-card-title">${escHtml(s.name)}</div>
              <div class="module-card-desc">${escHtml(s.description || 'No description provided.')}</div>
            </div>
            <div class="module-card-footer">
              <span class="badge badge-maroon">${moduleModel.getBySubject(s.id).length} modules</span>
              <span class="badge badge-gold">${activityModel.getBySubject(s.id).length} activities</span>
            </div>
          </div>`).join('') ||
          '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No subjects assigned</div></div>'}
      </div>`;
  },

  modules(user) {
    const modules = moduleModel.getByTeacher(user.id);
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Modules</h2>
          <p>${modules.length} module(s) uploaded</p>
        </div>
        <div class="flex gap-2">
          <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div>
          <button class="btn btn-primary" onclick="TeacherController.openAddModule()">➕ Add Module</button>
        </div>
      </div>
      <div class="module-grid">
        ${modules.map(m => {
          const sub = subjectModel.getById(m.subjectId);
          return `<div class="module-card" data-searchable>
            <div class="module-card-header">
              <div class="module-card-subject" style="color:${sub ? sub.color : 'var(--maroon)'}">
                ${sub ? sub.icon + ' ' : ''} ${escHtml(sub ? sub.name : 'Unknown')}
              </div>
              <div class="module-card-title">${escHtml(m.title)}</div>
              <div class="module-card-desc">${escHtml(m.description)}</div>
            </div>
            <div class="module-card-footer">
              <span class="module-card-meta">📎 ${escHtml(m.fileLabel)} · Week ${m.week}</span>
              <div class="flex gap-1">
                <button class="btn btn-xs btn-outline" onclick="TeacherController.openEditModule('${m.id}')">✏️</button>
                <button class="btn btn-xs btn-danger"  onclick="TeacherController.deleteModule('${m.id}')">🗑️</button>
              </div>
            </div>
          </div>`;
        }).join('') ||
          `<div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <div class="empty-state-title">No modules yet</div>
            <div class="empty-state-desc">Upload your first module to get started.</div>
            <button class="btn btn-primary" onclick="TeacherController.openAddModule()">Add Module</button>
          </div>`}
      </div>`;
  },

  activities(user) {
    const activities = activityModel.getByTeacher(user.id);
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Activities & Quizzes</h2>
          <p>${activities.length} created</p>
        </div>
        <button class="btn btn-primary" onclick="TeacherController.openAddActivity()">➕ Create Activity</button>
      </div>
      ${activities.map(a => {
        const sub         = subjectModel.getById(a.subjectId);
        const submissions = gradeModel.getByActivity(a.id);
        return `<div class="activity-card">
          <div class="activity-type-icon" style="${typeBg(a.type)}">${typeEmoji(a.type)}</div>
          <div class="activity-body">
            <div class="activity-title">${escHtml(a.title)}</div>
            <div class="activity-meta">
              ${sub ? sub.name : 'Unknown'} · Due: ${fmtDate(a.dueDate)} · ${a.points} pts ·
              <span class="badge badge-gray">${submissions.length} submitted</span>
            </div>
            <div class="activity-actions">
              <button class="btn btn-xs btn-outline" onclick="TeacherController.openGradeActivity('${a.id}')">📊 Grade</button>
              <button class="btn btn-xs btn-outline" onclick="TeacherController.openEditActivity('${a.id}')">✏️ Edit</button>
              <button class="btn btn-xs btn-danger"  onclick="TeacherController.deleteActivity('${a.id}')">🗑️ Delete</button>
            </div>
          </div>
          <span class="badge badge-maroon">${a.type}</span>
        </div>`;
      }).join('') ||
        `<div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No activities created yet</div>
          <button class="btn btn-primary mt-3" onclick="TeacherController.openAddActivity()">Create Activity</button>
        </div>`}`;
  },

  grades(user) {
    const activities = activityModel.getByTeacher(user.id);
    const actIds     = new Set(activities.map(a => a.id));
    const grades     = gradeModel.getAll().filter(g => actIds.has(g.activityId));
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Grade Records</h2>
          <p>${grades.length} grade entries</p>
        </div>
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search grades…" /></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Activity</th><th>Subject</th><th>Score</th><th>Grade</th><th>Remarks</th><th>Date</th></tr>
            </thead>
            <tbody>
              ${grades.map(g => {
                const student  = userModel.getById(g.studentId);
                const activity = activityModel.getById(g.activityId);
                const subject  = subjectModel.getById(g.subjectId);
                const pct      = Math.round(g.score / g.maxScore * 100);
                return `<tr data-searchable>
                  <td><strong>${escHtml(student ? student.name : '?')}</strong></td>
                  <td class="text-sm">${escHtml(activity ? activity.title : '?')}</td>
                  <td><span class="badge badge-maroon">${escHtml(subject ? subject.name : '?')}</span></td>
                  <td>${g.score}/${g.maxScore}</td>
                  <td><span class="grade-pill ${gradeClass(pct)}">${gradeLabel(pct)}</span></td>
                  <td class="text-sm text-muted">${escHtml(g.remarks || '—')}</td>
                  <td class="text-sm text-muted">${fmtDate(g.gradedAt)}</td>
                </tr>`;
              }).join('') ||
                '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No grades recorded yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },
};

/* ══════════════════════════════════════════════════════════════
   STUDENT VIEWS
   ══════════════════════════════════════════════════════════════ */
const StudentView = {

  dashboard(user) {
    const grades     = gradeModel.getByStudent(user.id);
    const subjects   = subjectModel.getAll();
    const activities = activityModel.getAll();
    const modules    = moduleModel.getAll();
    const avg = grades.length
      ? Math.round(grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length)
      : 0;

    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Hi, ${escHtml(user.name.split(' ')[0])}! 🎓</div>
          <div class="welcome-sub">Keep learning — every step forward counts!</div>
        </div>
        <div class="welcome-emoji">📖</div>
      </div>

      <div class="stat-grid mb-4">
        <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📚</div>
          <div><div class="stat-value">${subjects.length}</div><div class="stat-label">Enrolled Subjects</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e6f4ea">📄</div>
          <div><div class="stat-value">${modules.length}</div><div class="stat-label">Available Modules</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fff0e6">📋</div>
          <div><div class="stat-value">${activities.length}</div><div class="stat-label">Activities</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e8f0fa">📊</div>
          <div><div class="stat-value">${avg}%</div><div class="stat-label">Average Score</div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
          <div class="card-header"><span class="card-title">My Subjects</span></div>
          <div class="card-body subject-list" style="padding:14px;">
            ${subjects.map(s => {
              const teacher = userModel.getById(s.teacherId);
              return `<div class="subject-item">
                <div class="subject-color-dot" style="background:${s.color}"></div>
                <div style="font-size:26px">${s.icon}</div>
                <div class="subject-info">
                  <div class="subject-name">${escHtml(s.name)}</div>
                  <div class="subject-teacher">Teacher: ${escHtml(teacher ? teacher.name : '?')}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Recent Grades</span></div>
          <div class="card-body" style="padding:14px;">
            ${grades.length ? grades.slice(0, 6).map(g => {
              const act = activityModel.getById(g.activityId);
              const sub = subjectModel.getById(g.subjectId);
              const pct = Math.round(g.score / g.maxScore * 100);
              return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-100)">
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600">${escHtml(act ? act.title : '?')}</div>
                  <div style="font-size:12px;color:var(--gray-400)">${escHtml(sub ? sub.name : '?')}</div>
                </div>
                <span class="grade-pill ${gradeClass(pct)}">${gradeLabel(pct)}</span>
              </div>`;
            }).join('') : '<p class="text-muted text-sm">No grades recorded yet</p>'}
          </div>
        </div>
      </div>`;
  },

  mySubjects() {
    const subjects = subjectModel.getAll();
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>My Subjects</h2><p>All enrolled subjects this term</p></div>
      </div>
      <div class="subject-list">
        ${subjects.map(s => {
          const teacher = userModel.getById(s.teacherId);
          return `<div class="subject-item">
            <div class="subject-color-dot" style="background:${s.color};width:16px;height:16px"></div>
            <div style="font-size:30px">${s.icon}</div>
            <div class="subject-info">
              <div class="subject-name">${escHtml(s.name)}</div>
              <div class="subject-teacher">Teacher: ${escHtml(teacher ? teacher.name : '?')} · ${escHtml(s.description || '')}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="badge badge-maroon">${moduleModel.getBySubject(s.id).length} modules</span>
              <span class="badge badge-gold">${activityModel.getBySubject(s.id).length} activities</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  },

  modules() {
    const mods = moduleModel.getAll();
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Learning Modules</h2>
          <p>${mods.length} modules available</p>
        </div>
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div>
      </div>
      <div class="module-grid">
        ${mods.map(m => {
          const sub = subjectModel.getById(m.subjectId);
          return `<div class="module-card" data-searchable>
            <div class="module-card-header">
              <div class="module-card-subject" style="color:${sub ? sub.color : 'var(--maroon)'}">
                ${sub ? sub.icon + ' ' : ''} ${escHtml(sub ? sub.name : '?')}
              </div>
              <div class="module-card-title">${escHtml(m.title)}</div>
              <div class="module-card-desc">${escHtml(m.description)}</div>
            </div>
            <div class="module-card-footer">
              <span class="module-card-meta">Week ${m.week} · 📎 ${escHtml(m.fileLabel)}</span>
              <button class="btn btn-xs btn-primary"
                onclick="Toast.show('Module opened (file preview not available in demo)', 'info')">
                Open 📖
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  },

  activities(user) {
    const activities = activityModel.getAll();
    const grades     = gradeModel.getByStudent(user.id);
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>Activities</h2>
          <p>${activities.length} assigned activities</p>
        </div>
      </div>
      ${activities.map(a => {
        const sub  = subjectModel.getById(a.subjectId);
        const done = grades.find(g => g.activityId === a.id);
        return `<div class="activity-card">
          <div class="activity-type-icon" style="${typeBg(a.type)}">${typeEmoji(a.type)}</div>
          <div class="activity-body">
            <div class="activity-title">${escHtml(a.title)}</div>
            <div class="activity-meta">${sub ? sub.name : '?'} · ${a.points} pts · Due: ${fmtDate(a.dueDate)}</div>
            <div class="activity-meta" style="color:var(--gray-600)">${escHtml(a.description)}</div>
            <div class="activity-actions mt-2">
              ${done
                ? `<span class="badge badge-green">✓ Submitted · Score: ${done.score}/${done.maxScore}</span>`
                : `<button class="btn btn-xs btn-primary" onclick="StudentController.submitActivity('${a.id}')">📤 Submit</button>`}
            </div>
          </div>
          <span class="badge ${done ? 'badge-green' : 'badge-gray'}">${done ? 'Done' : 'Pending'}</span>
        </div>`;
      }).join('')}`;
  },

  myGrades(user) {
    const grades = gradeModel.getByStudent(user.id);
    const avg    = grades.length
      ? Math.round(grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length)
      : 0;
    return `
      <div class="section-header">
        <div class="section-header-left">
          <h2>My Grades</h2>
          <p>Average: <strong style="color:var(--maroon)">${avg}%</strong> · ${grades.length} records</p>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Activity</th><th>Subject</th><th>Score</th><th>%</th><th>Grade</th><th>Remarks</th><th>Date</th></tr>
            </thead>
            <tbody>
              ${grades.length ? grades.map(g => {
                const act = activityModel.getById(g.activityId);
                const sub = subjectModel.getById(g.subjectId);
                const pct = Math.round(g.score / g.maxScore * 100);
                return `<tr>
                  <td><strong>${escHtml(act ? act.title : '?')}</strong></td>
                  <td><span class="badge badge-maroon">${escHtml(sub ? sub.name : '?')}</span></td>
                  <td>${g.score}/${g.maxScore}</td>
                  <td>${pct}%</td>
                  <td><span class="grade-pill ${gradeClass(pct)}">${gradeLabel(pct)}</span></td>
                  <td class="text-sm text-muted">${escHtml(g.remarks || '—')}</td>
                  <td class="text-sm text-muted">${fmtDate(g.gradedAt)}</td>
                </tr>`;
              }).join('') : '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No grades recorded yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },
};

/* ══════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ══════════════════════════════════════════════════════════════ */
const CalendarView = {
  render(user) {
    const roleLabel  = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }[user.role] || user.role;
    const roleColors = {
      admin:   { bg: '#fde8ec', color: '#8b0020' },
      teacher: { bg: '#e8f0fa', color: '#1a4a8a' },
      student: { bg: '#e6f4ea', color: '#2e6b3e' },
    };
    const rc = roleColors[user.role] || roleColors.student;
    return `
      <div class="cal-page">
        <div class="cal-left">

          <!-- Role badge -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;
                      background:${rc.bg};border-radius:10px;padding:10px 14px">
            <span style="font-size:22px">${user.role==='admin'?'🧑‍💼':user.role==='teacher'?'👩‍🏫':'🎓'}</span>
            <div>
              <div style="font-weight:700;font-size:14px;color:${rc.color}">${escHtml(user.name)}</div>
              <div style="font-size:12px;color:${rc.color};opacity:.8;text-transform:capitalize">${roleLabel} Calendar</div>
            </div>
          </div>

          <!-- Month navigator -->
          <div class="card" style="margin-bottom:14px">
            <div class="cal-nav">
              <button class="btn btn-outline btn-sm" onclick="CalendarController.prev()">‹</button>
              <span id="cal-month-label" style="font-weight:700;font-size:16px"></span>
              <button class="btn btn-outline btn-sm" onclick="CalendarController.next()">›</button>
            </div>
            <div class="cal-grid">
              <div class="cal-dow">Sun</div><div class="cal-dow">Mon</div>
              <div class="cal-dow">Tue</div><div class="cal-dow">Wed</div>
              <div class="cal-dow">Thu</div><div class="cal-dow">Fri</div>
              <div class="cal-dow">Sat</div>
              <div id="cal-grid-body" style="display:contents"></div>
            </div>
          </div>

          <!-- Upcoming events -->
          <div class="card" style="margin-bottom:14px">
            <div class="card-header"><div class="card-title">⏰ Upcoming</div></div>
            <div id="cal-upcoming-list" style="padding:10px 14px;display:flex;flex-direction:column;gap:8px"></div>
          </div>

          <!-- Legend -->
          <div class="card">
            <div class="card-header"><div class="card-title">🏷 Event Types</div></div>
            <div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px">
              ${[
                ['#d4a017','Holiday / No Class'],
                ['#1a4a8a','Meeting'],
                ['#8b0020','Exam'],
                ['#2e6b3e','Activity Due'],
                ['#c04a00','Announcement'],
                ['#6d0019','Student Due Date'],
              ].map(([c,l]) => `<span style="display:flex;align-items:center;gap:5px;font-size:12px">
                <span style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span>${l}
              </span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Day detail panel -->
        <div class="cal-right">
          <div class="card" style="min-height:520px">
            <div id="cal-day-panel" style="padding:20px;overflow-y:auto;max-height:75vh"></div>
          </div>
        </div>
      </div>
    `;
  }
};
