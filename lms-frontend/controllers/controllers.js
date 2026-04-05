/* ============================================================
   controllers/controllers.js
   Business logic layer — connects Models to Views.
   Each controller handles a specific domain of the app.
   ============================================================ */

"use strict";
const api = new LMSAdminAPI("http://localhost:8000");

/* ══════════════════════════════════════════════════════════════
   APP CONTROLLER
   Global app state: page routing, sidebar, clock.
   ══════════════════════════════════════════════════════════════ */
const App = {
  sidebarCollapsed: false,

  /** Switch between 'landing', 'login', 'app' pages */
  showPage(page) {
    document.getElementById('page-landing').classList.toggle('hidden', page !== 'landing');
    document.getElementById('page-login').classList.toggle('hidden',   page !== 'login');
    document.getElementById('page-app').classList.toggle('hidden',     page !== 'app');
  },

  /** Toggle sidebar collapse (desktop) or open/close (mobile) */
  toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 768) {
      sb.classList.toggle('mobile-open');
      ov.classList.toggle('show');
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      sb.classList.toggle('collapsed', this.sidebarCollapsed);
    }
  },

  updateClock() {
    const el = document.getElementById('topbar-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  },

  /** Bootstrap the application */
  init() {
    // Dark mode — restore saved preference
    DarkMode.init();

    // Mobile sidebar: close on overlay click
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('sidebar-overlay').classList.remove('show');
    });

    // Live clock
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Restore session if user was already logged in
    const session = Storage.get('ijla_session');
    if (session) {
      this.showPage('app');
      DashboardController.load(session);
    } else {
      this.showPage('landing');
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   AUTH CONTROLLER
   Handles login, role selection, and logout.
   ══════════════════════════════════════════════════════════════ */
const AuthController = {
  selectedRole: 'admin',

  selectRole(role) {
    this.selectedRole = role;

    // Highlight active tab
    document.querySelectorAll('.role-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.role === role)
    );

    // Update demo credentials hint
    const hints = {
      admin:   `<strong>Demo (Admin):</strong> <code>admin@ijla.edu</code> / <code>admin123</code>`,
      teacher: `<strong>Demo (Teacher):</strong> <code>teacher1@ijla.edu</code> / <code>teacher123</code>`,
      student: `<strong>Demo (Student):</strong> <code>student1@ijla.edu</code> / <code>student123</code>`,
    };
    document.getElementById('demo-hint').innerHTML = hints[role] || '';
  },

  async login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    Toast.show('Please fill in all fields.', 'error');
    return;
  }

  try {
    const data = await api.login(email, password);
    const user = api.getCurrentUser();

    if (user.role !== this.selectedRole) {
      api.logout();
      Toast.show(`This account is a "${user.role}". Please select the correct role tab.`, 'error');
      return;
    }

    Toast.show(`Welcome back, ${data.full_name}! 👋`, 'success');
    App.showPage('app');
    DashboardController.load(user);
  } catch (err) {
    Toast.show(err.message || 'Invalid credentials.', 'error');
  }
},
  logout() {
    api.logout();
    Storage.remove('ijla_session');
    App.showPage('landing');
    Toast.show('You have been signed out.', 'info');
  },
};

/* ══════════════════════════════════════════════════════════════
   DASHBOARD CONTROLLER
   Manages the app shell: sidebar nav, section routing,
   topbar title, and post-render hooks.
   ══════════════════════════════════════════════════════════════ */
const DashboardController = {
  currentUser:    null,
  currentSection: 'dashboard',

  /** Navigation menus per role */
  navMenus: {
    admin: [
      { id: 'dashboard',       icon: '🏠', label: 'Dashboard' },
      { id: 'manage-users',    icon: '👥', label: 'Manage Users' },
      { id: 'manage-teachers', icon: '👩‍🏫', label: 'Manage Teachers' },
      { id: 'manage-students', icon: '🎓', label: 'Manage Students' },
      { id: 'calendar',        icon: '📅', label: 'Calendar' },
      { id: 'settings',        icon: '⚙️', label: 'Settings' },
    ],
    teacher: [
      { id: 'dashboard',   icon: '🏠', label: 'Dashboard' },
      { id: 'my-subjects', icon: '📚', label: 'My Subjects' },
      { id: 'modules',     icon: '📄', label: 'Modules' },
      { id: 'activities',  icon: '📝', label: 'Activities' },
      { id: 'grades',      icon: '📊', label: 'Grades' },
      { id: 'calendar',    icon: '📅', label: 'Calendar' },
    ],
    student: [
      { id: 'dashboard',   icon: '🏠', label: 'Dashboard' },
      { id: 'my-subjects', icon: '📚', label: 'My Subjects' },
      { id: 'modules',     icon: '📄', label: 'Modules' },
      { id: 'activities',  icon: '📋', label: 'Activities' },
      { id: 'my-grades',   icon: '📊', label: 'My Grades' },
      { id: 'calendar',    icon: '📅', label: 'Calendar' },
    ],
  },

  /** Initialize the dashboard for a logged-in user */
  async load(user) {
    
     if (user.full_name && !user.name) {
      user.name = user.full_name;
    }
    this.currentUser = user;

    // Support both API user shape { full_name } and local shape { name }
    const displayName = user.full_name || user.name || 'User';
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // Populate sidebar user info
    document.getElementById('sb-avatar').textContent     = initials;
    document.getElementById('sb-username').textContent   = displayName;
    document.getElementById('sb-role').textContent       = user.role;
    document.getElementById('topbar-avatar').textContent = initials;

    this.buildNav(user.role);
    this.loadSection('dashboard');

    // Load real stats from backend (admin only)
    if (user.role === 'admin') {
      try {
        const stats = await api.getDashboardStats();
        const el = id => document.getElementById(id);
        if (el('stat-users'))    el('stat-users').textContent    = stats.total_users;
        if (el('stat-teachers')) el('stat-teachers').textContent = stats.total_teachers;
        if (el('stat-students')) el('stat-students').textContent = stats.total_students;
        if (el('stat-modules'))  el('stat-modules').textContent  = stats.total_modules;
      } catch (err) {
        console.error('Dashboard stats error:', err.message);
      }
    }
  },

  /** Build sidebar navigation links for the given role */
  buildNav(role) {
    const nav   = document.getElementById('sidebar-nav');
    const items = this.navMenus[role] || [];
    nav.innerHTML = `<div class="nav-section-title">Main Menu</div>` +
      items.map(item => `
        <div class="nav-item" data-section="${item.id}"
          onclick="DashboardController.loadSection('${item.id}')">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </div>`).join('');
  },

  /** Load and render a named section into the content area */
  loadSection(sectionId) {
    this.currentSection = sectionId;

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.section === sectionId)
    );

    // Update topbar title
    const role = this.currentUser.role;
    const item = (this.navMenus[role] || []).find(i => i.id === sectionId);
    document.getElementById('topbar-title').textContent = item ? item.label : 'Dashboard';

    // Render and inject HTML
    const area = document.getElementById('content-area');
    area.innerHTML = this._render(sectionId);
    this._postRender(sectionId);
  },

  /** Route to the correct View render function */
  _render(id) {
    const role = this.currentUser.role;
    const user = this.currentUser;

    if (id === 'calendar') return CalendarView.render(this.currentUser);
    if (id === 'dashboard') {
      if (role === 'admin')   return AdminView.dashboard(user);
      if (role === 'teacher') return TeacherView.dashboard(user);
      if (role === 'student') return StudentView.dashboard(user);
    }
    if (role === 'admin') {
      if (id === 'manage-users')    return AdminView.manageUsers();
      if (id === 'manage-teachers') return AdminView.manageTeachers();
      if (id === 'manage-students') return AdminView.manageStudents();
      if (id === 'settings')        return AdminView.settings(user);
    }
    if (role === 'teacher') {
      if (id === 'my-subjects') return TeacherView.mySubjects(user);
      if (id === 'modules')     return TeacherView.modules(user);
      if (id === 'activities')  return TeacherView.activities(user);
      if (id === 'grades')      return TeacherView.grades(user);
    }
    if (role === 'student') {
      if (id === 'my-subjects') return StudentView.mySubjects();
      if (id === 'modules')     return StudentView.modules();
      if (id === 'activities')  return StudentView.activities(user);
      if (id === 'my-grades')   return StudentView.myGrades(user);
    }
    return `<div class="empty-state">
      <div class="empty-state-icon">🚧</div>
      <div class="empty-state-title">Section Coming Soon</div>
    </div>`;
  },

  /** Attach post-render event listeners (e.g. search) */
  _postRender(sectionId) {
    if (sectionId === 'calendar') {
      CalendarController._selectedDate = null;
      CalendarController.init();
      return;
    }
    // Handle pending tab switch (manageTeachers / manageStudents nav items)
    if (AdminController._pendingTab) {
      AdminController._switchTab(AdminController._pendingTab);
      AdminController._pendingTab = null;
    }
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('[data-searchable]').forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   ADMIN CONTROLLER
   Handles user CRUD, settings, and role management.
   ══════════════════════════════════════════════════════════════ */
const AdminController = {
  _pendingTab: null,

  /* ── Tab switching ──────────────────────────────────────── */
  _switchTab(tab) {
    ['all','teachers','students','sections','audit'].forEach(t => {
      const pane = document.getElementById(`um-pane-${t}`);
      const btn  = document.getElementById(`tab-${t}`);
      if (pane) pane.style.display = t === tab ? '' : 'none';
      if (btn)  btn.classList.toggle('active', t === tab);
    });
  },

  /* ── Filter helpers ─────────────────────────────────────── */
  _filterRole(val) {
    document.querySelectorAll('#user-table-body tr[data-searchable]').forEach(r => {
      const role = r.querySelector('.badge')?.textContent?.toLowerCase() || '';
      r.style.display = (!val || role === val) ? '' : 'none';
    });
  },

  _filterStatus(val) {
    document.querySelectorAll('#user-table-body tr[data-searchable]').forEach(r => {
      const status = r.querySelectorAll('.badge')[1]?.textContent?.toLowerCase() || '';
      r.style.display = (!val || status === val) ? '' : 'none';
    });
  },

  _filterCards(q, cls) {
    document.querySelectorAll('.' + cls).forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  _filterStudents(q) {
    document.querySelectorAll('[data-searchable]').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  _filterBySection(secId) {
    if (!secId) {
      document.querySelectorAll('.section-block').forEach(b => b.style.display = '');
      return;
    }
    const sec = sectionModel.getById(secId);
    if (!sec) return;
    const key = `${sec.gradeLevel}|${sec.name}`;
    document.querySelectorAll('.section-block').forEach(b => {
      const title = b.querySelector('.section-block-title')?.textContent || '';
      const match = title.includes(sec.gradeLevel) && title.includes(sec.name);
      b.style.display = match ? '' : 'none';
    });
  },

  _filterTable(q, bodyId) {
    document.querySelectorAll(`#${bodyId} tr`).forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  /* ── Add / Edit User ────────────────────────────────────── */
  openAddUser(preRole = 'student') {
    const sections = sectionModel.getAll();
    const teachers = userModel.getByRole('teacher');
    const sectionOpts = sections.map(s =>
      `<option value="${s.gradeLevel}|${s.name}">${escHtml(s.gradeLevel)} – ${escHtml(s.name)}</option>`
    ).join('');
    const teacherOpts = teachers.map(t =>
      `<option value="${t.id}">${escHtml(t.name)}</option>`
    ).join('');

    Modal.show('Add New User', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input class="form-control" id="f-name" placeholder="e.g. Juan dela Cruz" />
        </div>
        <div class="form-group">
          <label class="form-label">Role *</label>
          <select class="form-control" id="f-role" onchange="AdminController._toggleRoleFields()">
            <option value="teacher" ${preRole==='teacher'?'selected':''}>Teacher</option>
            <option value="student" ${preRole==='student'?'selected':''}>Student</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input class="form-control" id="f-email" type="email" placeholder="user@ijla.edu" />
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <div style="position:relative">
            <input class="form-control" id="f-password" type="password" placeholder="Min. 6 characters" style="padding-right:2.8rem" />
            <button type="button" onclick="(function(){var i=document.getElementById('f-password'),b=this;i.type=i.type==='password'?'text':'password';b.innerHTML=i.type==='password'?'&#128065;':'&#128064;';}).call(this)"
              style="position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;padding:.2rem;color:#888">&#128065;</button>
          </div>
        </div>
      </div>

      <div id="teacher-fields" style="${preRole==='teacher'?'':'display:none'}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Primary Subject</label>
            <input class="form-control" id="f-subject" placeholder="e.g. Mathematics" />
          </div>
          <div class="form-group">
            <label class="form-label">Employee ID</label>
            <input class="form-control" id="f-empid" placeholder="e.g. EMP-001" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Specialization</label>
          <input class="form-control" id="f-spec" placeholder="e.g. Science & Math" />
        </div>
      </div>

      <div id="student-fields" style="${preRole==='student'?'':'display:none'}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Grade Level</label>
            <select class="form-control" id="f-grade">
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Section</label>
            <select class="form-control" id="f-section">
              <option value="">— Select Section —</option>${sectionOpts}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">LRN (Learner Reference No.)</label>
            <input class="form-control" id="f-lrn" placeholder="12-digit LRN" maxlength="12" />
          </div>
          <div class="form-group">
            <label class="form-label">Guardian Name</label>
            <input class="form-control" id="f-guardian" placeholder="Parent / Guardian" />
          </div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.saveNewUser()">Add User</button>`
    );
  },

  _toggleRoleFields() {
    const role = document.getElementById('f-role').value;
    document.getElementById('teacher-fields').style.display = role === 'teacher' ? '' : 'none';
    document.getElementById('student-fields').style.display = role === 'student' ? '' : 'none';
  },

  saveNewUser() {
    const name     = document.getElementById('f-name').value.trim();
    const email    = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-password').value.trim();
    const role     = document.getElementById('f-role').value;

    if (!Validate.required(name,  'Full name')) return;
    if (!Validate.required(email, 'Email'))     return;
    if (!Validate.email(email))                 return;
    if (!Validate.minLength(password, 6))       return;

    // Duplicate email check
    if (userModel.getAllIncluding().some(u => u.email === email)) {
      Toast.show('Email already in use.', 'error'); return;
    }

    const userData = { name, email, password, role };
    if (role === 'teacher') {
      userData.subject = document.getElementById('f-subject').value.trim();
      userData.empId   = document.getElementById('f-empid').value.trim();
      userData.spec    = document.getElementById('f-spec').value.trim();
    }
    if (role === 'student') {
      const secVal = document.getElementById('f-section').value;
      const [grade, section] = secVal ? secVal.split('|') : [document.getElementById('f-grade').value, ''];
      userData.grade    = grade;
      userData.section  = section;
      userData.lrn      = document.getElementById('f-lrn').value.trim();
      userData.guardian = document.getElementById('f-guardian').value.trim();
    }

    const added = userModel.add(userData);
    auditModel.log('CREATE', 'user', `Added ${role} "${name}" (${email})`, DashboardController.currentUser.id);
    Modal.close();
    Toast.show(`User "${name}" added successfully!`, 'success');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  openEditUser(id) {
    const user = userModel.getById(id);
    if (!user) return;
    const sections  = sectionModel.getAll();
    const sectionOpts = sections.map(s => {
      const val = `${s.gradeLevel}|${s.name}`;
      const sel = user.grade === s.gradeLevel && user.section === s.name ? 'selected' : '';
      return `<option value="${val}" ${sel}>${escHtml(s.gradeLevel)} – ${escHtml(s.name)}</option>`;
    }).join('');

    const teacherExtra = user.role === 'teacher' ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Primary Subject</label>
          <input class="form-control" id="e-subject" value="${escHtml(user.subject||'')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Employee ID</label>
          <input class="form-control" id="e-empid" value="${escHtml(user.empId||'')}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Specialization</label>
        <input class="form-control" id="e-spec" value="${escHtml(user.spec||'')}" />
      </div>` : '';

    const studentExtra = user.role === 'student' ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Grade Level</label>
          <select class="form-control" id="e-grade">
            ${['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g =>
              `<option ${user.grade===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Section</label>
          <select class="form-control" id="e-section">
            <option value="">— None —</option>${sectionOpts}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">LRN</label>
          <input class="form-control" id="e-lrn" value="${escHtml(user.lrn||'')}" maxlength="12" />
        </div>
        <div class="form-group">
          <label class="form-label">Guardian</label>
          <input class="form-control" id="e-guardian" value="${escHtml(user.guardian||'')}" />
        </div>
      </div>` : '';

    Modal.show(`Edit User — ${escHtml(user.name)}`, `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-control" id="e-name" value="${escHtml(user.name)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-control" id="e-email" value="${escHtml(user.email)}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="e-active">
          <option value="1" ${user.isActive?'selected':''}>Active</option>
          <option value="0" ${!user.isActive?'selected':''}>Inactive</option>
        </select>
      </div>
      ${teacherExtra}${studentExtra}`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.saveEditUser('${id}')">Save Changes</button>`
    );
  },

  openEditTeacher(id) { this.openEditUser(id); },

  saveEditUser(id) {
    const user = userModel.getById(id);
    if (!user) return;
    const updates = {
      name:     document.getElementById('e-name').value.trim(),
      email:    document.getElementById('e-email').value.trim(),
      isActive: document.getElementById('e-active').value === '1',
    };
    if (!Validate.required(updates.name,  'Name'))  return;
    if (!Validate.required(updates.email, 'Email')) return;
    if (!Validate.email(updates.email))             return;

    if (user.role === 'teacher') {
      if (document.getElementById('e-subject')) updates.subject = document.getElementById('e-subject').value.trim();
      if (document.getElementById('e-empid'))   updates.empId   = document.getElementById('e-empid').value.trim();
      if (document.getElementById('e-spec'))    updates.spec    = document.getElementById('e-spec').value.trim();
    }
    if (user.role === 'student') {
      if (document.getElementById('e-grade'))    updates.grade    = document.getElementById('e-grade').value;
      if (document.getElementById('e-section')) {
        const secVal = document.getElementById('e-section').value;
        updates.section = secVal ? secVal.split('|')[1] : '';
        if (secVal) updates.grade = secVal.split('|')[0];
      }
      if (document.getElementById('e-lrn'))      updates.lrn      = document.getElementById('e-lrn').value.trim();
      if (document.getElementById('e-guardian')) updates.guardian = document.getElementById('e-guardian').value.trim();
    }

    userModel.update(id, updates);
    auditModel.log('UPDATE', 'user', `Updated ${user.role} "${updates.name}"`, DashboardController.currentUser.id);
    Modal.close();
    Toast.show('User updated successfully!', 'success');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  deleteUser(id) {
    const user = userModel.getById(id);
    if (!user) return;
    if (!confirm(`Remove "${user.name}" from the system?\n\nThis is a soft delete — the record is kept but deactivated.`)) return;
    userModel.softDelete(id);
    auditModel.log('DELETE', 'user', `Deactivated ${user.role} "${user.name}"`, DashboardController.currentUser.id);
    Toast.show(`"${user.name}" has been deactivated.`, 'info');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  /* ── Student profile view ───────────────────────────────── */
  viewStudentProfile(id) {
    const user     = userModel.getById(id);
    if (!user) return;
    const grades   = gradeModel.getByStudent(id);
    const subjects = subjectModel.getAll();
    const activities = activityModel.getAll();
    const sections  = sectionModel.getAll();
    const matchSec  = sections.find(s => s.gradeLevel === user.grade && s.name === user.section);
    const adviser   = matchSec ? userModel.getById(matchSec.adviserId) : null;

    const gradeRows = grades.map(g => {
      const act = activityModel.getById(g.activityId);
      const sub = subjectModel.getById(g.subjectId);
      const pct = Math.round(g.score / g.maxScore * 100);
      return `<tr>
        <td class="text-sm">${act ? escHtml(act.title) : '?'}</td>
        <td class="text-sm">${sub ? escHtml(sub.name) : '?'}</td>
        <td class="text-sm">${g.score}/${g.maxScore}</td>
        <td><span class="grade-pill ${pct>=75?'grade-pass':'grade-fail'}">${pct}%</span></td>
        <td class="text-sm text-muted">${fmtDate(g.gradedAt)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-muted text-center" style="padding:12px">No grades yet</td></tr>';

    const avg = grades.length ? Math.round(grades.reduce((s,g) => s + g.score/g.maxScore*100, 0) / grades.length) : null;

    Modal.show(`Student Profile — ${escHtml(user.name)}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <div class="form-label">Email</div><div>${escHtml(user.email)}</div>
          <div class="form-label" style="margin-top:8px">Grade & Section</div>
          <div>${escHtml(user.grade||'—')} – ${escHtml(user.section||'—')}</div>
          <div class="form-label" style="margin-top:8px">LRN</div>
          <div>${escHtml(user.lrn||'Not set')}</div>
        </div>
        <div>
          <div class="form-label">Guardian</div><div>${escHtml(user.guardian||'Not set')}</div>
          <div class="form-label" style="margin-top:8px">Adviser</div>
          <div>${adviser ? escHtml(adviser.name) : 'Unassigned'}</div>
          <div class="form-label" style="margin-top:8px">Overall Average</div>
          <div>${avg !== null ? `<span class="grade-pill ${avg>=75?'grade-pass':'grade-fail'}">${avg}%</span>` : 'No grades yet'}</div>
        </div>
      </div>
      <div class="form-label">Grade Records</div>
      <div class="table-wrap" style="max-height:260px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th>Activity</th><th>Subject</th><th>Score</th><th>Grade</th><th>Date</th></tr></thead>
          <tbody>${gradeRows}</tbody>
        </table>
      </div>`,
      `<button class="btn btn-outline" onclick="AdminController.openEditUser('${id}')">✏️ Edit</button>
       <button class="btn btn-ghost" onclick="Modal.close()">Close</button>`
    );
  },

  /* ── Schedule management ────────────────────────────────── */
  openAssignSchedule(teacherId) {
    const teacher  = userModel.getById(teacherId);
    const subjects = subjectModel.getAll();
    const sections = sectionModel.getAll();
    const existing = scheduleModel.getByTeacher(teacherId);

    const subOpts = subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    const secOpts = sections.map(s => `<option value="${s.id}">${escHtml(s.gradeLevel)} – ${escHtml(s.name)}</option>`).join('');
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const dayOpts = days.map(d => `<option value="${d}">${d}</option>`).join('');

    const existingRows = existing.map(sch => {
      const sub = subjectModel.getById(sch.subjectId);
      const sec = sectionModel.getById(sch.sectionId);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gray-100);font-size:13px">
        <span style="width:80px;font-weight:600">${sch.day.slice(0,3)}</span>
        <span>${sch.timeStart}–${sch.timeEnd}</span>
        <span style="flex:1">${sub?escHtml(sub.name):'?'} · ${sec?escHtml(sec.gradeLevel+' '+sec.name):'?'} · ${escHtml(sch.room)}</span>
        <button class="btn btn-xs btn-danger" onclick="AdminController.deleteSchedule('${sch.id}','${teacherId}')">✕</button>
      </div>`;
    }).join('') || '<div class="text-muted" style="font-size:13px;padding:6px 0">No schedules yet</div>';

    Modal.show(`Schedule — ${escHtml(teacher.name)}`, `
      <div style="margin-bottom:14px">
        <div class="form-label" style="font-weight:700">Current Schedule</div>
        <div id="sch-existing">${existingRows}</div>
      </div>
      <div class="form-label" style="font-weight:700;margin-bottom:8px">Add New Period</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Subject</label>
          <select class="form-control" id="sch-subject">${subOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Section</label>
          <select class="form-control" id="sch-section">${secOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Day</label>
          <select class="form-control" id="sch-day">${dayOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Start Time</label>
          <input class="form-control" id="sch-start" type="time" value="07:00" />
        </div>
        <div class="form-group">
          <label class="form-label">End Time</label>
          <input class="form-control" id="sch-end" type="time" value="08:00" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Room</label>
        <input class="form-control" id="sch-room" placeholder="e.g. Room 201" />
      </div>`,
      `<button class="btn btn-primary" onclick="AdminController.saveSchedule('${teacherId}')">➕ Add Period</button>
       <button class="btn btn-ghost"   onclick="Modal.close()">Done</button>`
    );
  },

  saveSchedule(teacherId) {
    const data = {
      teacherId,
      subjectId:  document.getElementById('sch-subject').value,
      sectionId:  document.getElementById('sch-section').value,
      day:        document.getElementById('sch-day').value,
      timeStart:  document.getElementById('sch-start').value,
      timeEnd:    document.getElementById('sch-end').value,
      room:       document.getElementById('sch-room').value.trim(),
    };
    if (data.timeEnd <= data.timeStart) { Toast.show('End time must be after start time.', 'error'); return; }
    if (scheduleModel.hasConflict(data)) { Toast.show('Schedule conflict detected! Check teacher time or room.', 'error'); return; }

    scheduleModel.add(data);
    const teacher = userModel.getById(teacherId);
    auditModel.log('ASSIGN', 'schedule', `Added ${data.day} ${data.timeStart}–${data.timeEnd} for ${teacher?.name||teacherId}`, DashboardController.currentUser.id);
    Toast.show('Schedule added!', 'success');
    // Refresh existing list
    this.openAssignSchedule(teacherId);
  },

  deleteSchedule(schId, teacherId) {
    scheduleModel.softDelete(schId);
    auditModel.log('DELETE', 'schedule', `Removed schedule ID ${schId}`, DashboardController.currentUser.id);
    Toast.show('Schedule removed.', 'info');
    this.openAssignSchedule(teacherId);
  },

  viewSectionSchedule(sectionId) {
    const sec  = sectionModel.getById(sectionId);
    if (!sec) return;
    const scheds = scheduleModel.getBySection(sectionId);
    const days   = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

    const rows = scheds.map(sch => {
      const teacher = userModel.getById(sch.teacherId);
      const subject = subjectModel.getById(sch.subjectId);
      return `<tr>
        <td class="text-sm" style="font-weight:600">${sch.day}</td>
        <td class="text-sm">${sch.timeStart}–${sch.timeEnd}</td>
        <td class="text-sm">${subject?escHtml(subject.name):'?'}</td>
        <td class="text-sm">${teacher?escHtml(teacher.name):'?'}</td>
        <td class="text-sm text-muted">${escHtml(sch.room)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-muted" style="padding:12px;text-align:center">No schedule yet</td></tr>';

    Modal.show(`Schedule — ${escHtml(sec.gradeLevel)} ${escHtml(sec.name)}`, `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Close</button>`
    );
  },

  /* ── Section CRUD ───────────────────────────────────────── */
  openAddSection() {
    const teachers = userModel.getByRole('teacher');
    const tOpts = teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    Modal.show('Add Section', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Grade Level *</label>
          <select class="form-control" id="sec-grade">
            ${['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g=>`<option>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Section Name *</label>
          <input class="form-control" id="sec-name" placeholder="e.g. Sampaguita" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Adviser</label>
          <select class="form-control" id="sec-adviser"><option value="">— None —</option>${tOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Room</label>
          <input class="form-control" id="sec-room" placeholder="e.g. Room 101" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">School Year</label>
        <input class="form-control" id="sec-sy" value="2024-2025" />
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.saveNewSection()">Add Section</button>`
    );
  },

  saveNewSection() {
    const name = document.getElementById('sec-name').value.trim();
    const grade = document.getElementById('sec-grade').value;
    if (!Validate.required(name, 'Section name')) return;
    const sec = sectionModel.add({
      name,
      gradeLevel:  grade,
      adviserId:   document.getElementById('sec-adviser').value || null,
      room:        document.getElementById('sec-room').value.trim(),
      schoolYear:  document.getElementById('sec-sy').value.trim(),
    });
    auditModel.log('CREATE', 'section', `Created section "${grade} – ${name}"`, DashboardController.currentUser.id);
    Modal.close();
    Toast.show(`Section "${grade} – ${name}" created!`, 'success');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  openEditSection(id) {
    const sec = sectionModel.getById(id);
    if (!sec) return;
    const teachers = userModel.getByRole('teacher');
    const tOpts = teachers.map(t => `<option value="${t.id}" ${sec.adviserId===t.id?'selected':''}>${escHtml(t.name)}</option>`).join('');
    Modal.show('Edit Section', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Grade Level</label>
          <select class="form-control" id="esec-grade">
            ${['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g=>`<option ${sec.gradeLevel===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Section Name</label>
          <input class="form-control" id="esec-name" value="${escHtml(sec.name)}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Adviser</label>
          <select class="form-control" id="esec-adviser"><option value="">— None —</option>${tOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Room</label>
          <input class="form-control" id="esec-room" value="${escHtml(sec.room||'')}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">School Year</label>
        <input class="form-control" id="esec-sy" value="${escHtml(sec.schoolYear||'')}" />
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.saveEditSection('${id}')">Save</button>`
    );
  },

  saveEditSection(id) {
    const name = document.getElementById('esec-name').value.trim();
    if (!Validate.required(name, 'Section name')) return;
    sectionModel.update(id, {
      name,
      gradeLevel: document.getElementById('esec-grade').value,
      adviserId:  document.getElementById('esec-adviser').value || null,
      room:       document.getElementById('esec-room').value.trim(),
      schoolYear: document.getElementById('esec-sy').value.trim(),
    });
    auditModel.log('UPDATE', 'section', `Updated section "${name}"`, DashboardController.currentUser.id);
    Modal.close();
    Toast.show('Section updated!', 'success');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  deleteSection(id) {
    const sec = sectionModel.getById(id);
    if (!sec) return;
    if (!confirm(`Delete section "${sec.gradeLevel} – ${sec.name}"?\n\nStudents in this section won't be deleted.`)) return;
    sectionModel.softDelete(id);
    auditModel.log('DELETE', 'section', `Deleted section "${sec.gradeLevel} – ${sec.name}"`, DashboardController.currentUser.id);
    Toast.show('Section deleted.', 'info');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  /* ── CSV Import / Export ────────────────────────────────── */
  exportCSV(type) {
    let rows, headers, filename;
    if (type === 'student') {
      headers = ['Name','Email','Grade','Section','LRN','Guardian','Status','Joined'];
      rows = userModel.getByRole('student').map(u =>
        [u.name,u.email,u.grade||'',u.section||'',u.lrn||'',u.guardian||'',u.isActive?'Active':'Inactive',u.createdAt]
      );
      filename = 'ijed_students.csv';
    } else {
      headers = ['Name','Email','Role','Subject/Grade','Section','Status','Joined'];
      rows = userModel.getAllIncluding().filter(u=>u.role!=='admin').map(u =>
        [u.name,u.email,u.role,u.subject||u.grade||'',u.section||'',u.isActive?'Active':'Inactive',u.createdAt]
      );
      filename = 'ijed_users.csv';
    }
    const csv = [headers, ...rows].map(r =>
      r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    auditModel.log('IMPORT', 'user', `Exported ${type} CSV`, DashboardController.currentUser.id);
    Toast.show(`Exported ${filename}`, 'success');
  },

  openImportCSV() {
    Modal.show('Import Users via CSV', `
      <p style="font-size:13px;color:var(--gray-600);margin-bottom:12px">
        CSV must have columns: <strong>Name, Email, Role, Password, Grade, Section</strong><br>
        Role values: <code>teacher</code> or <code>student</code>
      </p>
      <div class="form-group">
        <label class="form-label">Upload CSV File</label>
        <input class="form-control" type="file" id="csv-file" accept=".csv" />
      </div>
      <div id="csv-preview" style="font-size:12px;margin-top:8px;color:var(--gray-400)">No file selected</div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.processImportCSV()">Import</button>`
    );
    document.getElementById('csv-file').addEventListener('change', function() {
      document.getElementById('csv-preview').textContent = this.files[0]
        ? `Selected: ${this.files[0].name} (${(this.files[0].size/1024).toFixed(1)} KB)` : 'No file selected';
    });
  },

  processImportCSV() {
    const file = document.getElementById('csv-file')?.files?.[0];
    if (!file) { Toast.show('Please select a CSV file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const lines  = e.target.result.split('\n').filter(l => l.trim());
      const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
      let added = 0, skipped = 0;
      lines.slice(1).forEach(line => {
        const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
        const row  = {};
        header.forEach((h,i) => row[h] = (cols[i]||'').replace(/^"|"$/g,'').trim());
        if (!row.name || !row.email || !row.role) { skipped++; return; }
        if (userModel.getAllIncluding().some(u => u.email === row.email)) { skipped++; return; }
        const ud = { name:row.name, email:row.email, role:row.role, password:row.password||'changeme123' };
        if (row.role==='student') { ud.grade=row.grade||''; ud.section=row.section||''; }
        if (row.role==='teacher') { ud.subject=row.subject||''; }
        userModel.add(ud);
        added++;
      });
      auditModel.log('IMPORT', 'user', `CSV import: ${added} added, ${skipped} skipped`, DashboardController.currentUser.id);
      Modal.close();
      Toast.show(`Imported ${added} users. Skipped ${skipped} (duplicates/invalid).`, 'success');
      DashboardController.loadSection(DashboardController.currentSection);
    };
    reader.readAsText(file);
  },

  /* ── Audit log ──────────────────────────────────────────── */
  clearAuditLog() {
    if (!confirm('Clear all audit logs? This cannot be undone.')) return;
    localStorage.removeItem('ijed_audit_logs');
    Toast.show('Audit log cleared.', 'info');
    DashboardController.loadSection(DashboardController.currentSection);
  },

  /* ── Settings ───────────────────────────────────────────── */
  saveSettings() {
    const user  = DashboardController.currentUser;
    const name  = document.getElementById('settings-name').value.trim();
    const email = document.getElementById('settings-email').value.trim();
    if (!Validate.required(name, 'Name'))   return;
    if (!Validate.required(email, 'Email')) return;
    if (!Validate.email(email))             return;
    userModel.update(user.id, { name, email });
    DashboardController.currentUser = userModel.getById(user.id);
    Toast.show('Settings saved!', 'success');
  },

  changePassword() {
    const pw  = document.getElementById('settings-pw').value;
    const pw2 = document.getElementById('settings-pw2').value;
    if (pw !== pw2)          { Toast.show('Passwords do not match.', 'error'); return; }
    if (pw.length < 6)       { Toast.show('Password must be at least 6 characters.', 'error'); return; }
    userModel.update(DashboardController.currentUser.id, { password: pw });
    Toast.show('Password updated!', 'success');
  },
};
/* ══════════════════════════════════════════════════════════════
   TEACHER CONTROLLER
   Module CRUD, activity CRUD, grading.
   ══════════════════════════════════════════════════════════════ */
const TeacherController = {

  _getSubjectOptions(selected = '') {
    return subjectModel.getByTeacher(DashboardController.currentUser.id)
      .map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${escHtml(s.name)}</option>`)
      .join('');
  },

  openAddModule() {
    Modal.show('Upload New Module', `
      <div class="form-group">
        <label class="form-label">Module Title *</label>
        <input class="form-control" id="m-title" placeholder="e.g. Introduction to Algebra" />
      </div>
      <div class="form-group">
        <label class="form-label">Subject *</label>
        <select class="form-control" id="m-subject">${this._getSubjectOptions()}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="m-desc" placeholder="Brief description of the module…"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">File Label</label>
          <input class="form-control" id="m-file" placeholder="e.g. lesson1.pdf" />
        </div>
        <div class="form-group">
          <label class="form-label">Week Number</label>
          <input class="form-control" id="m-week" type="number" min="1" value="1" />
        </div>
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.saveModule()">Upload Module</button>`
    );
  },

  saveModule() {
    const title = document.getElementById('m-title').value.trim();
    if (!Validate.required(title, 'Module title')) return;

    const user = DashboardController.currentUser;
    moduleModel.add({
      title,
      description: document.getElementById('m-desc').value.trim(),
      subjectId:   document.getElementById('m-subject').value,
      teacherId:   user.id,
      fileLabel:   document.getElementById('m-file').value.trim() || 'module.pdf',
      week:        parseInt(document.getElementById('m-week').value) || 1,
    });
    Modal.close();
    Toast.show('Module uploaded successfully!', 'success');
    DashboardController.loadSection('modules');
  },

  openEditModule(id) {
    const m = moduleModel.getById(id);
    if (!m) return;
    Modal.show('Edit Module', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-control" id="em-title" value="${escHtml(m.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <select class="form-control" id="em-subject">${this._getSubjectOptions(m.subjectId)}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="em-desc">${escHtml(m.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">File Label</label>
          <input class="form-control" id="em-file" value="${escHtml(m.fileLabel)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Week</label>
          <input class="form-control" id="em-week" type="number" value="${m.week}" />
        </div>
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.updateModule('${id}')">Save Changes</button>`
    );
  },

  updateModule(id) {
    const title = document.getElementById('em-title').value.trim();
    if (!Validate.required(title, 'Module title')) return;
    moduleModel.update(id, {
      title,
      subjectId:   document.getElementById('em-subject').value,
      description: document.getElementById('em-desc').value.trim(),
      fileLabel:   document.getElementById('em-file').value.trim(),
      week:        parseInt(document.getElementById('em-week').value) || 1,
    });
    Modal.close();
    Toast.show('Module updated!', 'success');
    DashboardController.loadSection('modules');
  },

  deleteModule(id) {
    if (!confirm('Delete this module? It will be soft-deleted.')) return;
    moduleModel.softDelete(id);
    Toast.show('Module removed.', 'info');
    DashboardController.loadSection('modules');
  },

  openAddActivity() {
    Modal.show('Create Activity / Quiz', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-control" id="act-title" placeholder="Activity title" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Subject *</label>
          <select class="form-control" id="act-subject">${this._getSubjectOptions()}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="act-type">
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="essay">Essay</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Instructions / Description</label>
        <textarea class="form-control" id="act-desc" placeholder="Activity instructions…"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-control" id="act-due" type="date" />
        </div>
        <div class="form-group">
          <label class="form-label">Total Points</label>
          <input class="form-control" id="act-pts" type="number" min="1" value="20" />
        </div>
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.saveActivity()">Create</button>`
    );
  },

  saveActivity() {
    const title = document.getElementById('act-title').value.trim();
    if (!Validate.required(title, 'Activity title')) return;

    const user = DashboardController.currentUser;
    activityModel.add({
      title,
      description: document.getElementById('act-desc').value.trim(),
      subjectId:   document.getElementById('act-subject').value,
      teacherId:   user.id,
      type:        document.getElementById('act-type').value,
      dueDate:     document.getElementById('act-due').value,
      points:      parseInt(document.getElementById('act-pts').value) || 20,
    });
    Modal.close();
    Toast.show('Activity created!', 'success');
    DashboardController.loadSection('activities');
  },

  openEditActivity(id) {
    const a = activityModel.getById(id);
    if (!a) return;
    Modal.show('Edit Activity', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-control" id="ea-title" value="${escHtml(a.title)}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Subject</label>
          <select class="form-control" id="ea-subject">${this._getSubjectOptions(a.subjectId)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="ea-type">
            <option value="quiz"       ${a.type === 'quiz'       ? 'selected' : ''}>Quiz</option>
            <option value="assignment" ${a.type === 'assignment' ? 'selected' : ''}>Assignment</option>
            <option value="essay"      ${a.type === 'essay'      ? 'selected' : ''}>Essay</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="ea-desc">${escHtml(a.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-control" id="ea-due" type="date" value="${a.dueDate || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Points</label>
          <input class="form-control" id="ea-pts" type="number" value="${a.points}" />
        </div>
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.updateActivity('${id}')">Save</button>`
    );
  },

  updateActivity(id) {
    const title = document.getElementById('ea-title').value.trim();
    if (!Validate.required(title, 'Activity title')) return;
    activityModel.update(id, {
      title,
      subjectId:   document.getElementById('ea-subject').value,
      type:        document.getElementById('ea-type').value,
      description: document.getElementById('ea-desc').value.trim(),
      dueDate:     document.getElementById('ea-due').value,
      points:      parseInt(document.getElementById('ea-pts').value) || 20,
    });
    Modal.close();
    Toast.show('Activity updated!', 'success');
    DashboardController.loadSection('activities');
  },

  deleteActivity(id) {
    if (!confirm('Delete this activity?')) return;
    activityModel.softDelete(id);
    Toast.show('Activity removed.', 'info');
    DashboardController.loadSection('activities');
  },

  openGradeActivity(actId) {
    const activity = activityModel.getById(actId);
    const students = userModel.getByRole('student');
    const existing = gradeModel.getByActivity(actId);

    Modal.show(`📊 Grade: ${escHtml(activity.title)}`, `
      <p class="text-sm text-muted mb-4">Max score: <strong>${activity.points} pts</strong></p>
      <div style="max-height:380px;overflow-y:auto;">
        ${students.map(s => {
          const g = existing.find(gr => gr.studentId === s.id);
          return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-100)">
            <span style="flex:1;font-size:13px;font-weight:500">${escHtml(s.name)}</span>
            <input type="number" min="0" max="${activity.points}"
              placeholder="Score" value="${g ? g.score : ''}"
              id="grade-score-${s.id}" class="form-control" style="width:80px" />
            <input type="text"
              placeholder="Remarks" value="${g ? escHtml(g.remarks) : ''}"
              id="grade-rmk-${s.id}" class="form-control" style="width:130px" />
          </div>`;
        }).join('')}
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.saveGrades('${actId}')">Save Grades</button>`
    );
  },

  saveGrades(actId) {
    const activity = activityModel.getById(actId);
    const students = userModel.getByRole('student');
    let count = 0;

    students.forEach(s => {
      const scoreEl = document.getElementById(`grade-score-${s.id}`);
      const rmkEl   = document.getElementById(`grade-rmk-${s.id}`);
      const score   = parseFloat(scoreEl.value);
      if (isNaN(score)) return;

      const existing = gradeModel.getByActivity(actId).find(g => g.studentId === s.id);
      const data = {
        studentId:  s.id,
        activityId: actId,
        subjectId:  activity.subjectId,
        score,
        maxScore:   activity.points,
        remarks:    rmkEl.value.trim(),
      };
      if (existing) gradeModel.update(existing.id, data);
      else          gradeModel.add(data);
      count++;
    });

    Modal.close();
    Toast.show(`${count} grade(s) saved!`, 'success');
    DashboardController.loadSection('grades');
  },
};

/* ══════════════════════════════════════════════════════════════
   STUDENT CONTROLLER
   Activity submission flow.
   ══════════════════════════════════════════════════════════════ */
const StudentController = {

  submitActivity(actId) {
    const user     = DashboardController.currentUser;
    const activity = activityModel.getById(actId);
    const existing = gradeModel.getByActivity(actId).find(g => g.studentId === user.id);

    if (existing) {
      Toast.show('You have already submitted this activity!', 'info');
      return;
    }

    Modal.show(`📤 Submit: ${escHtml(activity.title)}`, `
      <div style="background:var(--rose-tint);border:1px solid var(--rose-mid);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px;font-size:13px;color:var(--maroon)">
        <strong>${escHtml(activity.title)}</strong> — ${activity.points} pts · Due: ${fmtDate(activity.dueDate)}
      </div>
      <div class="form-group">
        <label class="form-label">Your Answer / Work *</label>
        <textarea class="form-control" id="sub-answer" rows="5"
          placeholder="Write your answer, describe your work, or paste your response here…"></textarea>
      </div>`,
      `<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="StudentController.confirmSubmit('${actId}')">Submit Activity</button>`
    );
  },

  confirmSubmit(actId) {
    const answer = document.getElementById('sub-answer').value.trim();
    if (!Validate.required(answer, 'Your answer')) return;

    const user     = DashboardController.currentUser;
    const activity = activityModel.getById(actId);

    // Create a "pending review" grade entry
    gradeModel.add({
      studentId:  user.id,
      activityId: actId,
      subjectId:  activity.subjectId,
      score:      0,
      maxScore:   activity.points,
      remarks:    'Pending teacher review',
    });

    Modal.close();
    Toast.show('Activity submitted successfully! Awaiting grade from teacher.', 'success');
    DashboardController.loadSection('activities');
  },
};

/* ── Dark Mode ─────────────────────────────────────────────── */
const DarkMode = {
  KEY: 'ijed_dark_mode',

  init() {
    if (Storage.get(this.KEY) === true) {
      document.body.classList.add('dark-mode');
      this._setIcon(true);
    }
  },

  toggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    Storage.set(this.KEY, isDark);
    this._setIcon(isDark);
  },

  _setIcon(isDark) {
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  },
};

/* ══════════════════════════════════════════════════════════════
   CALENDAR CONTROLLER
   ══════════════════════════════════════════════════════════════ */
const CalendarController = {

  _viewYear:  null,
  _viewMonth: null,

  init() {
    const now = new Date();
    if (this._viewYear  === null) this._viewYear  = now.getFullYear();
    if (this._viewMonth === null) this._viewMonth = now.getMonth();
    this._render();
  },

  prev() {
    if (this._viewMonth === 0) { this._viewMonth = 11; this._viewYear--; }
    else this._viewMonth--;
    this._render();
  },

  next() {
    if (this._viewMonth === 11) { this._viewMonth = 0; this._viewYear++; }
    else this._viewMonth++;
    this._render();
  },

  _render() {
    const user  = DashboardController.currentUser;
    const year  = this._viewYear;
    const month = this._viewMonth;

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr    = new Date().toISOString().split('T')[0];
    const pad         = n => String(n).padStart(2, '0');
    const monthStr    = pad(month + 1);
    const monthName   = new Date(year, month).toLocaleString('default', { month: 'long' });

    // Merge stored events + auto-generated activity due dates
    const storedEvents = calendarModel.getForUser(user.id, user.role);
    const autoEvents   = this._buildActivityEvents(user);
    const allEvents    = [...storedEvents, ...autoEvents];

    const eventMap = {};
    allEvents.forEach(e => {
      if (!eventMap[e.date]) eventMap[e.date] = [];
      eventMap[e.date].push(e);
    });

    // Build upcoming events list (next 7 days from today)
    const upcoming = allEvents
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    // Build day cells
    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell cal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${monthStr}-${pad(d)}`;
      const dayEvts = eventMap[dateStr] || [];
      const isToday = dateStr === todayStr;
      const dots    = dayEvts.slice(0, 4).map(e =>
        `<span class="cal-dot" style="background:${e.color}"></span>`).join('');
      cells += `
        <div class="cal-cell${isToday ? ' cal-today' : ''}" onclick="CalendarController.selectDay('${dateStr}')">
          <span class="cal-day-num">${d}</span>
          <div class="cal-dots">${dots}</div>
        </div>`;
    }

    // Upcoming sidebar list
    const upcomingHtml = upcoming.length
      ? upcoming.map(e => {
          const dStr = new Date(e.date + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric' });
          return `<div class="cal-upcoming-item" onclick="CalendarController.selectDay('${e.date}')">
            <span class="cal-dot" style="background:${e.color};flex-shrink:0"></span>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--gray-800)">${escHtml(e.title)}</div>
              <div style="font-size:11px;color:var(--gray-400)">${dStr}</div>
            </div>
          </div>`;
        }).join('')
      : `<div class="cal-empty-day">No upcoming events.</div>`;

    const upcomingEl = document.getElementById('cal-upcoming-list');
    if (upcomingEl) upcomingEl.innerHTML = upcomingHtml;

    const selDate = this._selectedDate || todayStr;
    this._renderDayPanel(selDate, user, eventMap);

    document.getElementById('cal-month-label').textContent = `${monthName} ${year}`;
    document.getElementById('cal-grid-body').innerHTML = cells;
    this._highlightSelected(selDate);
  },

  /** Auto-generate virtual events from activity due dates */
  _buildActivityEvents(user) {
    const virtual = [];
    if (user.role === 'student') {
      activityModel.getAll().forEach(a => {
        if (!a.dueDate) return;
        const sub = subjectModel.getById(a.subjectId);
        virtual.push({
          id: 'auto_' + a.id, title: `Due: ${a.title}`,
          date: a.dueDate, type: 'activity-due', color: '#6d0019',
          visibility: 'student',
          description: `${sub ? sub.name + ' · ' : ''}${a.points} pts · ${a.type}`,
          _auto: true,
        });
      });
    }
    if (user.role === 'teacher') {
      activityModel.getByTeacher(user.id).forEach(a => {
        if (!a.dueDate) return;
        const sub = subjectModel.getById(a.subjectId);
        virtual.push({
          id: 'auto_' + a.id, title: `Deadline: ${a.title}`,
          date: a.dueDate, type: 'activity-due', color: '#c04a00',
          visibility: user.id,
          description: `${sub ? sub.name + ' · ' : ''}${a.points} pts — check submissions`,
          _auto: true,
        });
      });
    }
    return virtual;
  },

  _selectedDate: null,

  selectDay(dateStr) {
    this._selectedDate = dateStr;
    this._highlightSelected(dateStr);
    this._renderDayPanel(dateStr, DashboardController.currentUser);
  },

  _highlightSelected(dateStr) {
    document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
    const pad = n => String(n).padStart(2, '0');
    const d   = new Date(dateStr);
    // find by data attr — simpler: re-render would reset, so we use onclick text matching
    document.querySelectorAll('.cal-cell:not(.cal-empty)').forEach(cell => {
      const fn = cell.getAttribute('onclick') || '';
      if (fn.includes(`'${dateStr}'`)) cell.classList.add('cal-selected');
    });
  },

  _renderDayPanel(dateStr, user, eventMap) {
    // Use merged eventMap if provided, else rebuild
    let events;
    if (eventMap && eventMap[dateStr]) {
      events = eventMap[dateStr];
    } else {
      const stored = calendarModel.getByDate(dateStr, user.id, user.role);
      const auto   = this._buildActivityEvents(user).filter(e => e.date === dateStr);
      events = [...stored, ...auto];
    }

    const todos = todoModel.getForUserDate(user.id, dateStr);
    const todayStr = new Date().toISOString().split('T')[0];
    const fmt = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });

    const evtHtml = events.length
      ? events.map(e => {
          const canDelete = user.role === 'admin' && !e._auto;
          return `
            <div class="cal-event-item" style="border-left:4px solid ${e.color}">
              <div class="cal-event-label" style="color:${e.color}">${_calTypeLabel(e.type)}</div>
              <div class="cal-event-title">${escHtml(e.title)}</div>
              ${e.description ? `<div class="cal-event-desc">${escHtml(e.description)}</div>` : ''}
              ${canDelete ? `<button class="btn btn-xs btn-danger" style="margin-top:6px" onclick="CalendarController.deleteEvent('${e.id}')">🗑 Remove</button>` : ''}
            </div>`;
        }).join('')
      : `<div class="cal-empty-day">No events scheduled.</div>`;

    // Add event button — admin always, teacher/student can add their own
    const addEvtBtn = `
      <button class="btn btn-primary btn-sm" style="margin-bottom:12px;width:100%"
        onclick="CalendarController.openAddEvent('${dateStr}')">+ Add Event</button>`;

    const todoLabel = dateStr === todayStr ? "✅ Today's To-Do" : "✅ To-Do for this Day";

    const todoHtml = `
      <div class="cal-todo-add">
        <input id="todo-input" class="form-control" placeholder="Add a to-do…"
          onkeydown="if(event.key==='Enter')CalendarController.addTodo('${dateStr}')" />
        <button class="btn btn-primary btn-sm" onclick="CalendarController.addTodo('${dateStr}')">+ Add</button>
      </div>
      <div id="todo-list">
        ${todos.length
          ? todos.map(t => `
              <div class="todo-item${t.done ? ' todo-done' : ''}" id="todo-${t.id}">
                <input type="checkbox" ${t.done ? 'checked' : ''}
                  onchange="CalendarController.toggleTodo('${t.id}','${dateStr}')"/>
                <span class="todo-text">${escHtml(t.text)}</span>
                <button class="todo-del" onclick="CalendarController.deleteTodo('${t.id}','${dateStr}')">✕</button>
              </div>`).join('')
          : `<div class="cal-empty-day">No to-dos for this day. Add one above!</div>`}
      </div>`;

    const panel = document.getElementById('cal-day-panel');
    if (panel) panel.innerHTML = `
      <div class="cal-day-header">${fmt}</div>
      ${addEvtBtn}
      <div class="cal-section-title">📌 Events</div>
      <div class="cal-events-list">${evtHtml}</div>
      <div class="cal-section-title" style="margin-top:18px">${todoLabel}</div>
      ${todoHtml}`;
  },

  toggleTodo(id, dateStr) {
    todoModel.toggle(id);
    this._renderDayPanel(dateStr, DashboardController.currentUser);
  },

  deleteTodo(id, dateStr) {
    todoModel.delete(id);
    this._renderDayPanel(dateStr, DashboardController.currentUser);
  },

  addTodo(dateStr) {
    const input = document.getElementById('todo-input');
    const text  = input ? input.value.trim() : '';
    if (!text) return;
    todoModel.add(DashboardController.currentUser.id, text, dateStr);
    this._renderDayPanel(dateStr, DashboardController.currentUser);
  },

  deleteEvent(id) {
    calendarModel.delete(id);
    this._render();
  },

  openAddEvent(dateStr) {
    const user = DashboardController.currentUser;
    // Visibility options depend on role
    const visOpts = user.role === 'admin'
      ? `<option value="all">Everyone</option>
         <option value="teacher">Teachers only</option>
         <option value="student">Students only</option>`
      : user.role === 'teacher'
      ? `<option value="${user.id}">Only me</option>
         <option value="student">My students</option>`
      : `<option value="${user.id}">Only me</option>`;

    // Type options depend on role
    const typeOpts = user.role === 'admin'
      ? `<option value="announcement">📢 Announcement</option>
         <option value="holiday">🎉 Holiday / No Class</option>
         <option value="exam">📝 Exam</option>
         <option value="meeting">🤝 Meeting</option>
         <option value="class">🏫 Class</option>`
      : user.role === 'teacher'
      ? `<option value="class">🏫 Class Schedule</option>
         <option value="activity-due">⏰ Activity Deadline</option>
         <option value="meeting">🤝 Meeting / Consultation</option>`
      : `<option value="activity-due">⏰ Submission Reminder</option>
         <option value="todo">✅ Personal Reminder</option>`;

    Modal.show('Add Calendar Event', `
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-control" id="ce-title" placeholder="Event title" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input class="form-control" id="ce-date" type="date" value="${dateStr}" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="ce-type">${typeOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Visible To</label>
          <select class="form-control" id="ce-vis">${visOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <input class="form-control" id="ce-color" type="color" value="${user.role==='admin'?'#6d0019':user.role==='teacher'?'#1a4a8a':'#2e6b3e'}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="ce-desc" rows="2" placeholder="Optional details…"></textarea>
      </div>
    `, `<button class="btn btn-primary" onclick="CalendarController.saveEvent()">Save Event</button>
       <button class="btn btn-outline" onclick="Modal.close()">Cancel</button>`);
  },

  saveEvent() {
    const title = document.getElementById('ce-title')?.value.trim();
    const date  = document.getElementById('ce-date')?.value;
    if (!title || !date) { Toast.show('Title and date are required.', 'error'); return; }
    calendarModel.add({
      title,
      date,
      type:        document.getElementById('ce-type').value,
      visibility:  document.getElementById('ce-vis').value,
      color:       document.getElementById('ce-color').value,
      description: document.getElementById('ce-desc').value.trim(),
      createdBy:   DashboardController.currentUser.id,
    });
    Modal.close();
    Toast.show('Event added!', 'success');
    this._viewYear  = parseInt(date.split('-')[0]);
    this._viewMonth = parseInt(date.split('-')[1]) - 1;
    this._selectedDate = date;
    this._render();
  },
};

function _calTypeLabel(type) {
  const map = {
    announcement: '📢 Announcement',
    holiday:      '🎉 Holiday',
    exam:         '📝 Exam',
    meeting:      '🤝 Meeting',
    class:        '🏫 Class',
    'activity-due': '⏰ Due Date',
    todo:         '✅ To-Do',
  };
  return map[type] || type;
}
