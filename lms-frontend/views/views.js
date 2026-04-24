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

  /** Main admin dashboard – now expects stats object from API */
  dashboard(user, stats = null) {
    // If stats not provided yet, show loading skeleton
    if (!stats) {
      return `
        <div class="welcome-banner">
          <div>
            <div class="welcome-title">Good day, ${escHtml(user.name?.split(' ')[0] || 'Admin')}! 👋</div>
            <div class="welcome-sub">Loading dashboard data...</div>
          </div>
          <div class="welcome-emoji">👨‍💼</div>
        </div>
        <div class="stat-grid mb-4">
          <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">👥</div><div><div class="stat-value">—</div><div class="stat-label">Total Users</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#e6f4ea">👩‍🏫</div><div><div class="stat-value">—</div><div class="stat-label">Teachers</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#fff0e6">🎓</div><div><div class="stat-value">—</div><div class="stat-label">Students</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#e8f0fa">📄</div><div><div class="stat-value">—</div><div class="stat-label">Modules</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📝</div><div><div class="stat-value">—</div><div class="stat-label">Activities</div></div></div>
        </div>
        <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading...</div></div>`;
    }

    const totalUsers = stats.total_users || 0;
    const teachers = stats.total_teachers || 0;
    const students = stats.total_students || 0;
    const modules = stats.total_modules || 0;
    const activities = stats.total_activities || 0;
    const recentUsers = stats.recent_users || [];

    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Good day, ${escHtml(user.name?.split(' ')[0] || 'Admin')}! 👋</div>
          <div class="welcome-sub">Here's an overview of the IJED Learning Management System.</div>
        </div>
        <div class="welcome-emoji">👨‍💼</div>
      </div>

      <div class="stat-grid mb-4">
        ${this._statCard('👥', '#fde8ec', totalUsers, 'Total Users')}
        ${this._statCard('👩‍🏫', '#e6f4ea', teachers, 'Teachers')}
        ${this._statCard('🎓', '#fff0e6', students, 'Students')}
        ${this._statCard('📄', '#e8f0fa', modules, 'Modules')}
        ${this._statCard('📝', '#fde8ec', activities, 'Activities')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap;">
        <div class="card">
          <div class="card-header"><span class="card-title">Recent Users</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                ${recentUsers.map(u => `
                  <tr>
                    <td><strong>${escHtml(u.full_name)}</strong></td>
                    <td><span class="badge badge-maroon">${escHtml(u.role?.name || u.role)}</span></td>
                    <td class="text-sm text-muted">${fmtDate(u.created_at)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" class="text-muted text-center">No users yet</td></tr>'}
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

  /* ── Unified Manage Users (placeholder – data loaded in controller) ── */
  manageUsers() {
    return `
      <div class="um-page">
        <div class="um-header">
          <div>
            <h2 style="margin:0;font-size:22px;color:var(--maroon-dark)">Manage Users</h2>
            <p id="um-stats" style="margin:4px 0 0;color:var(--gray-400);font-size:13px">Loading...</p>
          </div>
          <div class="um-header-actions">
            <button class="btn btn-outline btn-sm" onclick="AdminController.exportCSV('all')">⬇ Export CSV</button>
            <button class="btn btn-outline btn-sm" onclick="AdminController.openImportCSV()">⬆ Import CSV</button>
            <button class="btn btn-primary" onclick="AdminController.openAddUser()">➕ Add User</button>
          </div>
        </div>
        <div class="um-tabs" id="um-tabs">
          <button class="um-tab active" data-tab="all">All Users (<span id="tab-all-count">0</span>)</button>
          <button class="um-tab" data-tab="teachers">👩‍🏫 Teachers (<span id="tab-teachers-count">0</span>)</button>
          <button class="um-tab" data-tab="students">🎓 Students (<span id="tab-students-count">0</span>)</button>
          <button class="um-tab" data-tab="sections">🏫 Sections (<span id="tab-sections-count">0</span>)</button>
          <button class="um-tab" data-tab="audit">📋 Audit Log</button>
        </div>
        <div id="um-pane-all"></div>
        <div id="um-pane-teachers" style="display:none"></div>
        <div id="um-pane-students" style="display:none"></div>
        <div id="um-pane-sections" style="display:none"></div>
        <div id="um-pane-audit" style="display:none"></div>
      </div>`;
  },

  /* ── All Users pane (accepts API user objects) ── */
  _allUsersPane(users) {
    if (!users.length) return '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">No users found</div></div>';
    const rows = users.map(u => {
      const roleTag = `<span class="badge badge-${u.role?.name === 'teacher' ? 'blue' : u.role?.name === 'student' ? 'green' : 'maroon'}">${u.role?.name || u.role}</span>`;
      const extra = u.role?.name === 'teacher' ? '—' : (u.student_number || '—');
      return `<tr data-searchable>
        <td><strong>${escHtml(u.full_name)}</strong></td>
        <td class="text-sm">${escHtml(u.email)}</td>
        <td>${roleTag}</td>
        <td class="text-sm">${extra}</td>
        <td class="text-sm text-muted">${fmtDate(u.created_at)}</td>
        <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-xs btn-outline" onclick="AdminController.openEditUser(${u.id})">✏️ Edit</button>
            <button class="btn btn-xs btn-danger" onclick="AdminController.deleteUser(${u.id})">🗑 Remove</button>
          </div>
         </td>
       </tr>`;
    }).join('');

    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search by name, email…"/></div>
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
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>LRN / ID</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="user-table-body">${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ── Teachers pane (renders teacher cards) ── */
  _teachersPane(teachers) {
    if (!teachers.length) return '<div class="empty-state"><div class="empty-state-icon">👩‍🏫</div><div class="empty-state-title">No teachers yet</div></div>';
    const cards = teachers.map(t => this._teacherCard(t)).join('');
    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" placeholder="Search teachers…" oninput="AdminController._filterCards(this.value,'teacher-card')"/></div>
        <button class="btn btn-primary" onclick="AdminController.openAddUser('teacher')">➕ Add Teacher</button>
      </div>
      <div class="teacher-grid">${cards}</div>`;
  },

  /* ── Teacher card (handles API teacher objects) ── */
  _teacherCard(t) {
    const fullName = `${t.user.first_name} ${t.user.last_name}`;
    const email = t.user.email;
    const isActive = t.user.is_active;
    const initials = fullName.split(' ').map(n => n[0] || '').join('').slice(0,2).toUpperCase() || '?';
    let assignmentsHtml = '';
    let schRows = '';
    if (t.class_assignments && t.class_assignments.length) {
      assignmentsHtml = t.class_assignments.map(a => `
        <div class="assignment-item">
          <div class="assignment-subject">📘 ${escHtml(a.subject.name)}</div>
          <div class="assignment-class">🏫 ${escHtml(a.class_.name)} (${escHtml(a.class_.grade_level || '')})</div>
          <div class="assignment-schedule">⏰ ${a.schedule || 'No schedule'}</div>
        </div>
      `).join('');
      schRows = t.class_assignments.map(a => `
        <div class="sch-row">
          <span class="sch-info" style="font-size:12px">
            <strong>${escHtml(a.subject.name)}</strong> · ${escHtml(a.class_.name)} · ${escHtml(a.schedule || 'No schedule')}
          </span>
        </div>
      `).join('');
    } else {
      assignmentsHtml = '<div class="text-muted">No subjects assigned</div>';
      schRows = '<div class="text-muted">No schedule</div>';
    }
    return `
      <div class="teacher-card ${isActive ? '' : 'card-inactive'}">
        <div class="teacher-card-header">
          <div class="teacher-avatar">${initials}</div>
          <div class="teacher-info">
            <div class="teacher-name">${escHtml(fullName)}</div>
            <div class="teacher-email">${escHtml(email)}</div>
            <span class="badge ${isActive ? 'badge-green' : 'badge-red'}">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="teacher-actions">
            <button class="btn btn-xs btn-outline" onclick="AdminController.openEditUser(${t.user.id})">✏️ Edit</button>
            <button class="btn btn-xs btn-danger" onclick="AdminController.deleteUser(${t.user.id})">🗑</button>
          </div>
        </div>
        <div class="teacher-card-body">
          <div class="teacher-section-label">📚 ASSIGNMENTS</div>
          <div class="assignments-list">${assignmentsHtml}</div>
          <div class="teacher-section-label" style="margin-top:10px">📅 WEEKLY SCHEDULE</div>
          <div class="sch-list">${schRows}</div>
        </div>
      </div>`;
  },

  /* ── Students pane (accepts API student objects and sections) ── */
  _studentsPane(students, sections) {
    if (!students.length) return '<div class="empty-state"><div class="empty-state-icon">🎓</div><div class="empty-state-title">No students yet</div></div>';

    const sectionMap = {};
    sections.forEach(sec => { sectionMap[sec.id] = sec.name; });

    const bySection = {};
    students.forEach(s => {
      const sectionId = s.section_assignments?.[0]?.section_id || 'unassigned';
      if (!bySection[sectionId]) bySection[sectionId] = [];
      bySection[sectionId].push(s);
    });

    const sectionBlocks = Object.keys(bySection).map(sectionId => {
      const grp = bySection[sectionId];
      const sectionName = sectionId === 'unassigned' ? 'Unassigned' : (sectionMap[sectionId] || 'Unknown Section');
      const rows = grp.map(s => {
        const fullName = `${s.user.first_name} ${s.user.last_name}`;
        const lrn = s.student_number || '—';
        return `<tr data-searchable>
          <td><strong>${escHtml(fullName)}</strong></td>
          <td class="text-sm">${escHtml(s.user.email)}</td>
          <td class="text-sm">${escHtml(lrn)}</td>
          <td class="text-sm">${escHtml(sectionName)}</td>
          <td class="text-sm"><span class="badge ${s.user.is_active ? 'badge-green' : 'badge-red'}">${s.user.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="actions-cell">
            <button class="btn btn-xs btn-outline" onclick="AdminController.openEditUser(${s.user.id})">✏️ Edit</button>
            <button class="btn btn-xs btn-primary" onclick="AdminController.openEnrollSubjects(${s.id}, '${escHtml(fullName)}')">📚 Subjects</button>
            <button class="btn btn-xs btn-danger" onclick="AdminController.deleteUser(${s.user.id})">🗑</button>
          </td>
        </tr>`;
      }).join('');
      return `
        <div class="section-block">
          <div class="section-block-header">
            <span class="section-block-title">🏫 ${escHtml(sectionName)}</span>
            <span class="section-block-count">${grp.length} student${grp.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>LRN</th><th>Section</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="um-toolbar">
        <div class="search-box"><span>🔍</span><input type="text" id="student-search" placeholder="Search students…" oninput="AdminController._filterStudents(this.value)"/></div>
        <button class="btn btn-primary" onclick="AdminController.openAddUser('student')">➕ Add Student</button>
        <button class="btn btn-outline btn-sm" onclick="AdminController.exportCSV('student')">⬇ Export</button>
      </div>
      <div id="student-section-blocks">${sectionBlocks}</div>`;
  },

  /* ── Sections pane (accepts API sections) ── */
_sectionsPane(sections) {
  if (!sections || !sections.length) {
    return '<div class="empty-state"><div class="empty-state-icon">🏫</div><div class="empty-state-title">No sections yet</div><button class="btn btn-primary mt-3" onclick="AdminController.openAddSection()">➕ Add Section</button></div>';
  }
  const rows = sections.map(sec => `
    <tr>
      <td><strong>${escHtml(sec.name)}</strong> (Class ID: ${sec.class_id})</td>
      <td class="text-sm">—</td>
      <td class="text-sm">—</td>
      <td class="text-sm">—</td>
      <td class="text-sm">—</td>
      <td class="text-sm text-muted">—</td>
      <td class="actions-cell">
        <button class="btn btn-xs btn-outline" onclick="AdminController.openEditSection(${sec.id})">✏️ Edit</button>
        <button class="btn btn-xs btn-danger" onclick="AdminController.deleteSection(${sec.id})">🗑</button>
      </td>
    </tr>
  `).join('');
  return `
    <div class="um-toolbar"><button class="btn btn-primary" onclick="AdminController.openAddSection()">➕ Add Section</button></div>
    <div class="card table-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Section</th><th>Room</th><th>Adviser</th><th>Students</th><th>School Year</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
},

  /* ── Audit Log pane (still uses localStorage – kept as is) ── */
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

  /* ── Redirect helpers (old nav items) ── */
  manageTeachers() {
    AdminController._pendingTab = 'teachers';
    return this.manageUsers();
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
    const SUBJECT_STYLES = { 'Mathematics': { color: '#8b0020', icon: '➕' }, 'Science': { color: '#2e6b3e', icon: '🔬' }, 'English': { color: '#1a4a8a', icon: '📖' }, 'Filipino': { color: '#c04a00', icon: '🇵🇭' }, 'MAPEH': { color: '#6a0dad', icon: '🎨' } };
    const API_BASE = 'https://ijed-hcj.onrender.com';
    const cards = apiModules.map(m => {
      const style   = SUBJECT_STYLES[m._subject_name] || { color: 'var(--maroon)', icon: '📚' };
      const hasFile = !!m.file_url;
      const fileBtn = hasFile ? `<a class="btn btn-xs btn-primary" href="${API_BASE}${escHtml(m.file_url)}" target="_blank" rel="noopener">📂 Open PDF</a>` : `<span class="btn btn-xs btn-outline" style="opacity:.5;cursor:default">No file</span>`;
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
      const typeLabel   = TYPE_LABELS[a.activity_type]   || a.activity_type;
      const formatLabel = FORMAT_LABELS[a.format_type]   || a.format_type;
      const gradeBadge  = a.grading_mode === 'auto'
        ? `<span class="badge badge-green" style="font-size:10px">⚡ Auto</span>`
        : `<span class="badge badge-gold"  style="font-size:10px">✏️ Manual</span>`;
      const dueLabel   = a.due_date   ? `Due: ${new Date(a.due_date).toLocaleDateString()}`   : 'No due date';
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
    // Rendered as a loading shell — _postRender fills it via API
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

/* ══════════════════════════════════════════════════════════════
   STUDENT VIEWS (unchanged – still uses localStorage models)
   ══════════════════════════════════════════════════════════════ */
const StudentView = {

  dashboard(user) {
    const grades     = gradeModel.getByStudent(user.id);
    const subjects   = subjectModel.getAll();
    const activities = activityModel.getAll();
    const modules    = moduleModel.getAll();
    const avg = grades.length ? Math.round(grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length) : 0;
    return `
      <div class="welcome-banner">
        <div>
          <div class="welcome-title">Hi, ${escHtml(user.name.split(' ')[0])}! 🎓</div>
          <div class="welcome-sub">Keep learning — every step forward counts!</div>
        </div>
        <div class="welcome-emoji">📖</div>
      </div>
      <div class="stat-grid mb-4">
        <div class="stat-card"><div class="stat-icon" style="background:#fde8ec">📚</div><div><div class="stat-value">${subjects.length}</div><div class="stat-label">Enrolled Subjects</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e6f4ea">📄</div><div><div class="stat-value">${modules.length}</div><div class="stat-label">Available Modules</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fff0e6">📋</div><div><div class="stat-value">${activities.length}</div><div class="stat-label">Activities</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#e8f0fa">📊</div><div><div class="stat-value">${avg}%</div><div class="stat-label">Average Score</div></div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card"><div class="card-header"><span class="card-title">My Subjects</span></div><div class="card-body subject-list" style="padding:14px;">${subjects.map(s => {
          const teacher = userModel.getById(s.teacherId);
          return `<div class="subject-item"><div class="subject-color-dot" style="background:${s.color}"></div><div style="font-size:26px">${s.icon}</div><div class="subject-info"><div class="subject-name">${escHtml(s.name)}</div><div class="subject-teacher">Teacher: ${escHtml(teacher ? teacher.name : '?')}</div></div></div>`;
        }).join('')}</div></div>
        <div class="card"><div class="card-header"><span class="card-title">Recent Grades</span></div><div class="card-body" style="padding:14px;">${grades.length ? grades.slice(0, 6).map(g => {
          const act = activityModel.getById(g.activityId);
          const sub = subjectModel.getById(g.subjectId);
          const pct = Math.round(g.score / g.maxScore * 100);
          return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-100)"><div style="flex:1"><div style="font-size:13px;font-weight:600">${escHtml(act ? act.title : '?')}</div><div style="font-size:12px;color:var(--gray-400)">${escHtml(sub ? sub.name : '?')}</div></div><span class="grade-pill ${gradeClass(pct)}">${gradeLabel(pct)}</span></div>`;
        }).join('') : '<p class="text-muted text-sm">No grades recorded yet</p>'}</div></div>
      </div>`;
  },

  mySubjects() {
    const subjects = subjectModel.getAll();
    return `
      <div class="section-header"><div class="section-header-left"><h2>My Subjects</h2><p>All enrolled subjects this term</p></div></div>
      <div class="subject-list">${subjects.map(s => {
        const teacher = userModel.getById(s.teacherId);
        return `<div class="subject-item"><div class="subject-color-dot" style="background:${s.color};width:16px;height:16px"></div><div style="font-size:30px">${s.icon}</div><div class="subject-info"><div class="subject-name">${escHtml(s.name)}</div><div class="subject-teacher">Teacher: ${escHtml(teacher ? teacher.name : '?')} · ${escHtml(s.description || '')}</div></div><div style="display:flex;gap:8px;align-items:center"><span class="badge badge-maroon">${moduleModel.getBySubject(s.id).length} modules</span><span class="badge badge-gold">${activityModel.getBySubject(s.id).length} activities</span></div></div>`;
      }).join('')}</div>`;
  },

  modules(apiModules = null) {
    if (apiModules === null) {
      return `<div class="section-header"><div class="section-header-left"><h2>Learning Modules</h2><p id="module-count">Loading…</p></div><div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div></div><div class="module-grid" id="student-module-grid"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading modules…</div></div></div>`;
    }
    const SUBJECT_STYLES = { 'Mathematics': { color: '#8b0020', icon: '➕' }, 'Science': { color: '#2e6b3e', icon: '🔬' }, 'English': { color: '#1a4a8a', icon: '📖' }, 'Filipino': { color: '#c04a00', icon: '🇵🇭' }, 'MAPEH': { color: '#6a0dad', icon: '🎨' } };
    const API_BASE = 'https://ijed-hcj.onrender.com';
    const cards = apiModules.map(m => {
      const style = SUBJECT_STYLES[m._subject_name] || { color: 'var(--maroon)', icon: '📚' };
      const termLabel = m.term ? `${m.term} Term` : '';
      const meta = [termLabel, m.file_name ? `📎 ${escHtml(m.file_name)}` : ''].filter(Boolean).join(' · ');
      const hasFile = !!m.file_url;
      return `<div class="module-card" data-searchable><div class="module-card-header"><div class="module-card-subject" style="color:${style.color}">${style.icon} ${escHtml(m._subject_name || '?')}</div><div class="module-card-title">${escHtml(m.title)}</div><div class="module-card-desc">${escHtml(m.description || '')}</div></div><div class="module-card-footer"><span class="module-card-meta">${meta || 'No attachment'}</span>${hasFile ? `<a class="btn btn-xs btn-primary" href="${API_BASE}${escHtml(m.file_url)}" target="_blank" rel="noopener">Open 📖</a>` : `<span class="btn btn-xs btn-outline" style="opacity:.5;cursor:default">No file</span>`}</div></div>`;
    }).join('');
    const grid = cards || `<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No modules available</div><div class="empty-state-desc">Your teacher has not uploaded any modules yet.</div></div>`;
    return `<div class="section-header"><div class="section-header-left"><h2>Learning Modules</h2><p id="module-count">${apiModules.length} module(s) available</p></div><div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search modules…" /></div></div><div class="module-grid" id="student-module-grid">${grid}</div>`;
  },

  /** Loading skeleton shown while API fetches */
  activitiesLoading() {
    return `
      <div class="section-header">
        <div class="section-header-left"><h2>Activities &amp; Quizzes</h2><p id="act-student-count">Loading…</p></div>
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search activities…" oninput="StudentController._filterActivities(this.value)" /></div>
      </div>
      <div id="student-activity-list">
        <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading activities…</div></div>
      </div>`;
  },

  /** Render the full student activities list from API data — Canvas/table style */
  activities(apiActivities) {
    const TYPE_LABELS = { quiz:'Quiz', long_quiz:'Long Quiz', task_performance:'Task Performance', exam:'Exam', lab_exercise:'Lab Exercise', assignment:'Assignment', other:'Other' };
    const FMT_LABELS  = { multiple_choice:'Multiple Choice', checkbox:'Checkbox', enumeration:'Enumeration', freeform:'Free-form', assignment:'Assignment', hybrid:'Hybrid' };

    const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const fmtTime  = d => d ? new Date(d).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '';
    const fmtFull  = d => d ? `${fmtDate(d)}<br><span style="color:var(--gray-500);font-size:11px">${fmtTime(d)}</span>` : '—';

    if (!apiActivities || !apiActivities.length) {
      return `
        <div class="section-header">
          <div class="section-header-left"><h2>Activities &amp; Quizzes</h2><p>No activities yet</p></div>
        </div>
        <div class="empty-state" style="margin-top:40px">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">No Activities Yet</div>
          <div class="empty-state-sub">Your teacher hasn't posted any activities for your subjects yet. Check back later!</div>
        </div>`;
    }

    const rows = apiActivities.map(a => {
      const typeLabel = TYPE_LABELS[a.activity_type] || a.activity_type;
      const fmtLabel  = FMT_LABELS[a.format_type]   || a.format_type;
      const sub       = a.submission;
      const isPastDue = a.is_past_due === true;
      // can_answer: trust API; fallback = no submission + not past due (handles timezone drift)
      const canAnswer = a.can_answer === true || (!sub && !isPastDue);

      /* ── Assignment cell: icon + title + tags ── */
      const typeIcon = `<div style="width:32px;height:32px;background:var(--rose-tint);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📝</div>`;
      const gradingTag = a.grading_mode === 'auto'
        ? `<span class="badge badge-gold" style="font-size:10px">⚡ Auto</span>`
        : `<span class="badge badge-gray" style="font-size:10px">✏️ Manual</span>`;

      /* Status badge — use API status as source of truth */
      const _statusMap = {
        graded:    ['badge-green',  '\u2705 Graded'],
        submitted: ['badge-blue',   '\uD83D\uDCE4 Submitted'],
        past_due:  ['badge-danger', '\u26D4 Past Due'],
        not_open:  ['badge-gray',   '\uD83D\uDD12 Not Yet Open'],
        open:      ['badge-maroon', '\uD83D\uDFE2 Open'],
      };
      const [_sCls, _sLbl] = _statusMap[a.status] || ['badge-maroon', '\uD83D\uDFE2 Open'];
      const statusBadge = `<span class="badge ${_sCls}" style="font-size:10px">${_sLbl}</span>`;

      const assignmentCell = `
        <td style="padding:14px 16px">
          <div style="display:flex;align-items:flex-start;gap:10px">
            ${typeIcon}
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--maroon);margin-bottom:3px">${escHtml(a.title)}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                <span class="badge badge-maroon" style="font-size:10px">${escHtml(typeLabel)}</span>
                <span class="badge badge-blue"   style="font-size:10px">${escHtml(fmtLabel)}</span>
                ${gradingTag}
                ${statusBadge}
              </div>
            </div>
          </div>
        </td>`;

      /* ── Start / Due ── */
      const startCell = `<td style="padding:14px 12px;font-size:12px;color:var(--gray-600);white-space:nowrap">${fmtFull(a.start_date)}</td>`;
      const dueStyle  = isPastDue && !sub ? 'color:#c0392b;font-weight:600' : 'color:var(--gray-600)';
      const dueCell   = `<td style="padding:14px 12px;font-size:12px;${dueStyle};white-space:nowrap">${fmtFull(a.due_date)}</td>`;

      /* ── % of overall (max_score shown as pts weight) ── */
      const pctCell = `<td style="padding:14px 12px;font-size:12px;color:var(--gray-600);text-align:center">${a.max_score != null ? a.max_score + ' pts' : '—'}</td>`;

      /* ── Submitted ── */
      const submittedCell = sub
        ? `<td style="padding:14px 12px;text-align:center"><span style="color:#2e6b3e;font-size:18px" title="Submitted ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : ''}">✓</span></td>`
        : `<td style="padding:14px 12px;text-align:center"><span style="color:var(--gray-400);font-size:16px">—</span></td>`;

      /* ── Graded ── */
      let gradedCell = '';
      if (!sub) {
        gradedCell = `<td style="padding:14px 12px;text-align:center"><span style="color:var(--gray-400);font-size:16px">—</span></td>`;
      } else if (sub.is_graded) {
        gradedCell = `<td style="padding:14px 12px;text-align:center"><span style="color:#2e6b3e;font-size:18px">✓</span></td>`;
      } else {
        gradedCell = `<td style="padding:14px 12px;text-align:center"><span style="color:#c0392b;font-size:18px" title="Awaiting grade">✗</span></td>`;
      }

      /* ── Score ── */
      let scoreCell = '';
      if (!sub) {
        /* No submission at all */
        if (isPastDue) {
          scoreCell = `<td style="padding:14px 12px;text-align:center">
            <div style="font-size:13px;font-weight:600;color:#c0392b">0 / ${a.max_score ?? '?'}</div>
            <div style="font-size:10px;color:#c0392b">No submission</div>
          </td>`;
        } else {
          scoreCell = `<td style="padding:14px 12px;text-align:center;font-size:13px;color:var(--gray-400)">? / ${a.max_score ?? '?'}</td>`;
        }
      } else if (sub.is_graded && sub.score != null) {
        const pct = sub.max_score ? Math.round(sub.score / sub.max_score * 100) : 0;
        scoreCell = `<td style="padding:14px 12px;text-align:center">
          <div style="font-size:13px;font-weight:700;color:#1a1a2e">${sub.score} / ${sub.max_score ?? a.max_score}</div>
          <div style="font-size:11px;color:var(--gray-500)">${pct}%</div>
        </td>`;
      } else {
        /* Submitted but not yet graded */
        scoreCell = `<td style="padding:14px 12px;text-align:center;font-size:13px;color:var(--gray-500)">? / ${sub.max_score ?? a.max_score ?? '?'}<br><span style="font-size:10px">Pending</span></td>`;
      }

      /* ── Grade ── */
      let gradeCell = '';
      if (sub && sub.is_graded && sub.grade) {
        const passed = parseFloat(sub.grade) <= 3.00;
        const gradeColor = passed ? '#2e6b3e' : '#c0392b';
        const gradeBg    = passed ? '#e6f4ea' : '#fde8ec';
        gradeCell = `<td style="padding:14px 12px;text-align:center">
          <span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${gradeBg};color:${gradeColor};font-weight:700;font-size:13px">${escHtml(sub.grade)}</span>
        </td>`;
      } else if (sub && !sub.is_graded) {
        gradeCell = `<td style="padding:14px 12px;text-align:center;font-size:13px;color:var(--gray-400)">?</td>`;
      } else {
        gradeCell = `<td style="padding:14px 12px;text-align:center;font-size:13px;color:var(--gray-400)">—</td>`;
      }

      /* ── Action ── */
      let actionCell = '';
      if (canAnswer) {
        actionCell = `<td style="padding:14px 12px;text-align:center">
          <button class="btn btn-primary btn-xs" onclick="StudentController.openActivity(${a.id})">✏️ Start</button>
        </td>`;
      } else if (sub) {
        actionCell = `<td style="padding:14px 12px;text-align:center">
          <button class="btn btn-outline btn-xs" onclick="StudentController.viewResult(${a.id})">👁 View</button>
        </td>`;
      } else if (isPastDue) {
        actionCell = `<td style="padding:14px 12px;text-align:center">
          <span class="badge badge-danger" style="font-size:10px">No Late Submissions</span>
        </td>`;
      } else {
        actionCell = `<td style="padding:14px 12px;text-align:center"><span style="color:var(--gray-400);font-size:12px">—</span></td>`;
      }

      const rowBg = sub && sub.is_graded ? '' : (isPastDue && !sub ? 'background:#fffafa' : '');
      return `
        <tr data-searchable style="${rowBg}">
          ${assignmentCell}
          ${startCell}
          ${dueCell}
          ${pctCell}
          ${submittedCell}
          ${gradedCell}
          ${scoreCell}
          ${gradeCell}
          ${actionCell}
        </tr>`;
    }).join('');

    return `
      <div class="section-header">
        <div class="section-header-left"><h2>Activities &amp; Quizzes</h2><p id="act-student-count">${apiActivities.length} activity(s)</p></div>
        <div class="search-box"><span>🔍</span><input type="text" id="global-search" placeholder="Search activities…" oninput="StudentController._filterActivities(this.value)" /></div>
      </div>
      <div class="table-wrap" style="margin-top:8px;border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;background:white;box-shadow:0 1px 4px rgba(0,0,0,.05)">
        <table class="activity-table">
          <thead>
            <tr>
              <th style="text-align:left">Assignment</th>
              <th style="text-align:left">Start</th>
              <th style="text-align:left">Due</th>
              <th style="text-align:center">Points</th>
              <th style="text-align:center">Submitted</th>
              <th style="text-align:center">Graded</th>
              <th style="text-align:center">Score</th>
              <th style="text-align:center">Grade</th>
              <th style="text-align:center">Action</th>
            </tr>
          </thead>
          <tbody id="student-activity-list">
            ${rows}
          </tbody>
        </table>
      </div>`;
  },

  /** Activity answering screen – shown when student opens an activity */
  activityAnswerSheet(activity) {
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

    const questions = (activity.questions || []).map((q, idx) => {
      let answerWidget = '';

      if (q.question_type === 'multiple_choice') {
        const choices = q.choices.map((c, ci) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;cursor:pointer;margin-bottom:6px;transition:background .15s" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <input type="radio" name="q_${q.id}" value="${ci}" style="accent-color:var(--maroon)" />
            <span style="font-size:14px">${escHtml(c.choice_text)}</span>
          </label>`).join('');
        answerWidget = `<div style="margin-top:10px">${choices}</div>`;

      } else if (q.question_type === 'checkbox') {
        const choices = q.choices.map((c, ci) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;cursor:pointer;margin-bottom:6px;transition:background .15s" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">
            <input type="checkbox" name="q_${q.id}" value="${ci}" style="accent-color:var(--maroon)" />
            <span style="font-size:14px">${escHtml(c.choice_text)}</span>
          </label>`).join('');
        answerWidget = `<div style="margin-top:10px">${choices}<small style="color:var(--gray-500);font-size:11px">Select all that apply.</small></div>`;

      } else if (q.question_type === 'fill_blank' || q.question_type === 'enumeration') {
        answerWidget = `<input type="text" id="q_${q.id}" class="form-control" placeholder="Type your answer here…" style="margin-top:10px" />`;

      } else {
        // essay / freeform
        answerWidget = `<textarea id="q_${q.id}" class="form-control" rows="4" placeholder="Write your answer here…" style="margin-top:10px;resize:vertical"></textarea>`;
      }

      return `
        <div class="activity-card" style="border:1px solid var(--gray-200);border-radius:10px;padding:18px 20px;background:white;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-size:13px;font-weight:700;color:var(--maroon)">Question ${idx + 1}</div>
            <span class="badge badge-gold">${q.points} pt${q.points !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:14px;font-weight:600;color:#1a1a2e;line-height:1.5">${escHtml(q.question_text)}</div>
          ${answerWidget}
        </div>`;
    }).join('');

    const totalPts = (activity.questions || []).reduce((s, q) => s + q.points, 0);

    return `
      <div style="max-width:720px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <button class="btn btn-ghost btn-sm" onclick="DashboardController.loadSection('activities')">← Back</button>
          <div>
            <h2 style="margin:0;font-size:18px">${escHtml(activity.title)}</h2>
            <div style="font-size:12px;color:var(--gray-500)">⏰ Due: ${fmtDate(activity.due_date)} · 🎯 ${totalPts} pts total</div>
          </div>
        </div>
        ${activity.instructions ? `
          <div style="padding:14px 16px;background:#fff9e6;border:1px solid #f0c040;border-radius:8px;margin-bottom:20px;font-size:13px;color:#7a5c00">
            <strong>📌 Instructions:</strong> ${escHtml(activity.instructions)}
          </div>` : ''}
        <div id="answer-sheet-questions">${questions || '<div class="empty-state"><div class="empty-state-title">No questions found.</div></div>'}</div>
        ${activity.questions && activity.questions.length ? `
          <div style="position:sticky;bottom:0;background:white;border-top:1px solid var(--gray-200);padding:14px 0;display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
            <button class="btn btn-outline" onclick="DashboardController.loadSection('activities')">Cancel</button>
            <button class="btn btn-primary" id="submit-activity-btn" onclick="StudentController.confirmSubmit(${activity.id})">📤 Submit Activity</button>
          </div>` : ''}
      </div>`;
  },

  /** Result screen shown after submitting or viewing past submission */
  activityResult(activity, result) {
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const pct = result.max_score ? Math.round(result.score / result.max_score * 100) : null;

    const answerMap = {};
    (result.answers || []).forEach(a => { answerMap[a.question_id] = a; });

    const questions = (activity.questions || []).map((q, idx) => {
      const ans = answerMap[q.id];
      const correctIcon = ans ? (ans.is_correct === true ? '✅' : ans.is_correct === false ? '❌' : '📝') : '—';
      const ptsEarned   = ans ? (ans.points_earned ?? '?') : 0;

      let answerDisplay = '—';
      if (ans && ans.answer_value != null) {
        if (q.question_type === 'multiple_choice' || q.question_type === 'checkbox') {
          // Map index(es) back to choice text if available
          try {
            const idxs = q.question_type === 'checkbox' ? JSON.parse(ans.answer_value) : [parseInt(ans.answer_value)];
            const labels = idxs.map(i => q.choices[i]?.choice_text || `Choice ${i}`);
            answerDisplay = labels.join(', ');
          } catch { answerDisplay = ans.answer_value; }
        } else {
          answerDisplay = ans.answer_value;
        }
      }

      const rowBg = ans ? (ans.is_correct === true ? '#e6f4ea' : ans.is_correct === false ? '#fde8ec' : '#fff9e6') : '';

      return `
        <div style="border:1px solid var(--gray-200);border-radius:10px;padding:14px 18px;background:${rowBg || 'white'};margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-size:13px;font-weight:700;color:var(--maroon)">Q${idx + 1} ${correctIcon}</div>
            <span class="badge badge-gold">${ptsEarned} / ${q.points} pt${q.points !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:#1a1a2e;margin:6px 0">${escHtml(q.question_text)}</div>
          <div style="font-size:13px;color:#444">Your answer: <em>${escHtml(answerDisplay)}</em></div>
        </div>`;
    }).join('');

    return `
      <div style="max-width:720px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <button class="btn btn-ghost btn-sm" onclick="DashboardController.loadSection('activities')">← Back to Activities</button>
        </div>

        <div style="padding:24px;background:white;border:1px solid var(--gray-200);border-radius:12px;margin-bottom:20px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">${result.is_graded ? '🏆' : '⏳'}</div>
          <div style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:4px">${escHtml(activity.title)}</div>
          ${result.is_graded ? `
            <div style="font-size:32px;font-weight:800;color:var(--maroon);margin:10px 0">${result.score} <span style="font-size:18px;color:#888">/ ${result.max_score} pts</span></div>
            <div style="font-size:15px;color:#555">${pct}% · Grade: <strong>${result.grade || '—'}</strong></div>
            ${result.remarks ? `<div style="margin-top:6px;font-size:13px;color:#666">📝 ${escHtml(result.remarks)}</div>` : ''}
          ` : `
            <div style="font-size:14px;color:#1a4a8a;margin-top:8px">Submitted on ${fmtDate(result.submitted_at)}</div>
            <div style="font-size:13px;color:#888;margin-top:4px">Your work is with your teacher for review. Grade will be posted once evaluated.</div>
          `}
        </div>

        ${activity.questions && activity.questions.length ? `
          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:12px">Answer Review</div>
          ${questions}
        ` : ''}
      </div>`;
  },

  myGrades(user) {
    const grades = gradeModel.getByStudent(user.id);
    const avg = grades.length ? Math.round(grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length) : 0;
    return `
      <div class="section-header"><div class="section-header-left"><h2>My Grades</h2><p>Average: <strong style="color:var(--maroon)">${avg}%</strong> · ${grades.length} records</p></div></div>
      <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Activity</th><th>Subject</th><th>Score</th><th>%</th><th>Grade</th><th>Remarks</th><th>Date</th></tr></thead><tbody>${grades.length ? grades.map(g => {
        const act = activityModel.getById(g.activityId);
        const sub = subjectModel.getById(g.subjectId);
        const pct = Math.round(g.score / g.maxScore * 100);
        return `<tr><td><strong>${escHtml(act ? act.title : '?')}</strong></td><td><span class="badge badge-maroon">${escHtml(sub ? sub.name : '?')}</span></td><td>${g.score}/${g.maxScore}</td><td>${pct}%</td><td><span class="grade-pill ${gradeClass(pct)}">${gradeLabel(pct)}</span></td><td class="text-sm text-muted">${escHtml(g.remarks || '—')}</td><td class="text-sm text-muted">${fmtDate(g.gradedAt)}</td></tr>`;
      }).join('') : '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No grades recorded yet</td></td>'}</tbody></table></div></div>`;
  },
};

/* ══════════════════════════════════════════════════════════════
   CALENDAR VIEW (unchanged)
   ══════════════════════════════════════════════════════════════ */
const CalendarView = {
  render(user) {
    const roleLabel  = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }[user.role] || user.role;
    const roleColors = { admin: { bg: '#fde8ec', color: '#8b0020' }, teacher: { bg: '#e8f0fa', color: '#1a4a8a' }, student: { bg: '#e6f4ea', color: '#2e6b3e' } };
    const rc = roleColors[user.role] || roleColors.student;
    return `
      <div class="cal-page">
        <div class="cal-left">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:${rc.bg};border-radius:10px;padding:10px 14px">
            <span style="font-size:22px">${user.role==='admin'?'🧑‍💼':user.role==='teacher'?'👩‍🏫':'🎓'}</span>
            <div><div style="font-weight:700;font-size:14px;color:${rc.color}">${escHtml(user.name)}</div><div style="font-size:12px;color:${rc.color};opacity:.8;text-transform:capitalize">${roleLabel} Calendar</div></div>
          </div>
          <div class="card" style="margin-bottom:14px">
            <div class="cal-nav"><button class="btn btn-outline btn-sm" onclick="CalendarController.prev()">‹</button><span id="cal-month-label" style="font-weight:700;font-size:16px"></span><button class="btn btn-outline btn-sm" onclick="CalendarController.next()">›</button></div>
            <div class="cal-grid"><div class="cal-dow">Sun</div><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div><div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div><div class="cal-dow">Sat</div><div id="cal-grid-body" style="display:contents"></div></div>
          </div>
          <div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">⏰ Upcoming</div></div><div id="cal-upcoming-list" style="padding:10px 14px;display:flex;flex-direction:column;gap:8px"></div></div>
          <div class="card"><div class="card-header"><div class="card-title">🏷 Event Types</div></div><div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px">${[['#d4a017','Holiday / No Class'],['#1a4a8a','Meeting'],['#8b0020','Exam'],['#2e6b3e','Activity Due'],['#c04a00','Announcement'],['#6d0019','Student Due Date']].map(([c,l]) => `<span style="display:flex;align-items:center;gap:5px;font-size:12px"><span style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span>${l}</span>`).join('')}</div></div>
        </div>
        <div class="cal-right"><div class="card" style="min-height:520px"><div id="cal-day-panel" style="padding:20px;overflow-y:auto;max-height:75vh"></div></div></div>
      </div>`;
  }
};