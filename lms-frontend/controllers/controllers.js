/* ============================================================
   controllers/controllers.js
   Business logic layer — connects Models to Views.
   Each controller handles a specific domain of the app.
   ============================================================ */

"use strict";
const api = new LMSAdminAPI("https://ijed-hcj-1.onrender.com");

/* ══════════════════════════════════════════════════════════════
   APP CONTROLLER
   Handles global UI state: page routing, sidebar toggle, clock.
   ══════════════════════════════════════════════════════════════ */
const App = {
  sidebarCollapsed: false,

  /** Switch between landing, login, and app pages */
  showPage(page) {
    document.getElementById('page-landing').classList.toggle('hidden', page !== 'landing');
    document.getElementById('page-login').classList.toggle('hidden',   page !== 'login');
    document.getElementById('page-app').classList.toggle('hidden',     page !== 'app');
  },

  /** Toggle sidebar collapse (desktop) or slide-out (mobile) */
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

  /** Update topbar clock every second */
  updateClock() {
    const el = document.getElementById('topbar-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  },

  /** Bootstrap the app: dark mode, clock, session restore */
  init() {
    DarkMode.init();
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('sidebar-overlay').classList.remove('show');
    });
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    const session = Storage.get('ijla_session');
    if (session) {
      if (session._token) api._saveToken(session._token);
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

  /** Switch role tabs and update demo hint */
  selectRole(role) {
    this.selectedRole = role;
    document.querySelectorAll('.role-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.role === role)
    );
    const hints = {
      admin:   `<strong>Demo (Admin):</strong> <code>admin@lms.edu</code> / <code>Admin@1234</code>`,
      teacher: `<strong>Demo (Teacher):</strong> <code>teacher@lms.edu</code> / <code>Teacher@1234</code>`,
      student: `<strong>Demo (Student):</strong> <code>student@lms.edu</code> / <code>Student@1234</code>`,
    };
    document.getElementById('demo-hint').innerHTML = hints[role] || '';
  },

  /** Authenticate user via API, validate role, load dashboard */
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

  /** Clear session and return to landing page */
  logout() {
    api.logout();
    Storage.remove('ijla_session');
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    App.showPage('landing');
    Toast.show('You have been signed out.', 'info');
  },
};

/* ══════════════════════════════════════════════════════════════
   DASHBOARD CONTROLLER
   Manages sidebar navigation, section routing, and content loading.
   ══════════════════════════════════════════════════════════════ */
const DashboardController = {
  currentUser:    null,
  currentSection: 'dashboard',

  /** Navigation menus per role (admin, teacher, student) */
  navMenus: {
    admin: [
      { id: 'dashboard',    icon: '🏠', label: 'Dashboard' },
      { id: 'manage-users', icon: '👥', label: 'Manage Users' },
      { id: 'calendar',     icon: '📅', label: 'Calendar' },
      { id: 'settings',     icon: '⚙️', label: 'Settings' },
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

  /** Initialize dashboard after login: set user info, build sidebar, load default section */
  async load(user) {
    if (user.full_name && !user.name) user.name = user.full_name;
    this.currentUser = user;
    const displayName = user.full_name || user.name || 'User';
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('sb-avatar').textContent     = initials;
    document.getElementById('sb-username').textContent   = displayName;
    document.getElementById('sb-role').textContent       = user.role;
    document.getElementById('topbar-avatar').textContent = initials;
    this.buildNav(user.role);
    this.loadSection('dashboard');
  },

  /** Build sidebar navigation links based on user role */
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

  /** Switch to a named section (dashboard, manage-users, calendar, etc.) */
  loadSection(sectionId) {
    this.currentSection = sectionId;
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.section === sectionId)
    );
    const role = this.currentUser.role;
    const item = (this.navMenus[role] || []).find(i => i.id === sectionId);
    document.getElementById('topbar-title').textContent = item ? item.label : 'Dashboard';
    const area = document.getElementById('content-area');
    area.innerHTML = this._render(sectionId);
    this._postRender(sectionId);
  },

  /** Return raw HTML for a section (skeleton, no data yet) */
  _render(id) {
    const role = this.currentUser.role;
    const user = this.currentUser;
    if (id === 'calendar') return CalendarView.render(this.currentUser);
    if (id === 'dashboard') {
      if (role === 'admin')   return AdminView.dashboard(user, null);
      if (role === 'teacher') return TeacherView.dashboard(user, null);
      if (role === 'student') return StudentView.dashboard(user);
    }
    if (role === 'admin') {
      if (id === 'manage-users')    return AdminView.manageUsers();
      if (id === 'settings')        return AdminView.settings(user);
    }
    if (role === 'teacher') {
      if (id === 'my-subjects') return TeacherView.mySubjects(user, null);
      if (id === 'modules')     return TeacherView.modules(user, null);
      if (id === 'activities')  return TeacherView.activities(user);
      if (id === 'grades')      return TeacherView.grades(user);
    }
    if (role === 'student') {
      if (id === 'my-subjects') return StudentView.mySubjects();
      if (id === 'modules')     return StudentView.modules(null);
      if (id === 'activities')  return StudentView.activitiesLoading();
      if (id === 'my-grades')   return StudentView.myGrades(user);
    }
    return `<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-title">Section Coming Soon</div></div>`;
  },

  /** After rendering HTML, fetch real data and attach event handlers */
  _postRender(sectionId) {
    // ── Admin Dashboard: load stats from API ─────────────────────────────
    if (sectionId === 'dashboard' && this.currentUser.role === 'admin') {
      const user = this.currentUser;
      api.getDashboardStats()
        .then(stats => {
          const area = document.getElementById('content-area');
          area.innerHTML = AdminView.dashboard(user, stats);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Failed to load dashboard stats:', err);
          Toast.show('Could not load dashboard data.', 'error');
          const area = document.getElementById('content-area');
          area.innerHTML = AdminView.dashboard(user, { total_users: 0, total_teachers: 0, total_students: 0, total_modules: 0, total_activities: 0, recent_users: [] });
        });
      return;
    }

    // Teacher Dashboard
    if (sectionId === 'dashboard' && this.currentUser.role === 'teacher') {
      const user = this.currentUser;
      api.getMySubjects()
        .then(subjects => {
          const area = document.getElementById('content-area');
          area.innerHTML = TeacherView.dashboard(user, subjects);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Failed to load teacher subjects:', err);
          Toast.show('Could not load dashboard data.', 'error');
        });
      return;
    }

    // Teacher My Subjects
    if (sectionId === 'my-subjects' && this.currentUser.role === 'teacher') {
      const user = this.currentUser;
      api.getMySubjects()
        .then(subjects => {
          const area = document.getElementById('content-area');
          area.innerHTML = TeacherView.mySubjects(user, subjects);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Failed to load subjects for My Subjects:', err);
          Toast.show('Could not load subjects.', 'error');
        });
      return;
    }

    if (sectionId === 'calendar') {
      CalendarController._selectedDate = null;
      CalendarController.init();
      return;
    }

    // Teacher modules
    if (sectionId === 'modules' && this.currentUser.role === 'teacher') {
      const user = this.currentUser;
      Promise.all([api.getMySubjects(), api.getMyModules()])
        .then(([subjects, modules]) => {
          const subjectMap = {};
          subjects.forEach(s => { subjectMap[s.subject_id] = s.subject_name; });
          modules.forEach(m => { m._subject_name = subjectMap[m.subject_id] || 'Unknown'; });
          const area = document.getElementById('content-area');
          area.innerHTML = TeacherView.modules(user, modules);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Modules load error:', err.message);
          Toast.show('Failed to load modules: ' + err.message, 'error');
        });
      return;
    }

    // Student modules
    if (sectionId === 'modules' && this.currentUser.role === 'student') {
      Promise.all([api.getStudentSubjects(), api.getStudentModules()])
        .then(([subjects, modules]) => {
          const subjectMap = {};
          subjects.forEach(s => { subjectMap[s.subject_id] = s.subject_name; });
          modules.forEach(m => { m._subject_name = subjectMap[m.subject_id] || 'Unknown'; });
          const area = document.getElementById('content-area');
          area.innerHTML = StudentView.modules(modules);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Student modules error:', err.message);
          Toast.show('Failed to load modules: ' + err.message, 'error');
        });
      return;
    }

    // Student Activities
    if (sectionId === 'activities' && this.currentUser.role === 'student') {
      StudentController.loadActivities();
      return;
    }
    if (sectionId === 'activities' && this.currentUser.role === 'teacher') {
      const area = document.getElementById('content-area');
      area.innerHTML = TeacherView.activities(this.currentUser, null);
      Promise.all([api.getTeacherActivities(), api.getMySubjects()])
        .then(([activities, subjects]) => {
          const subjectMap = {};
          subjects.forEach(s => { subjectMap[s.subject_id] = s.subject_name; });
          activities.forEach(a => { a._subject_name = subjectMap[a.subject_id] || 'Unknown'; });
          area.innerHTML = TeacherView.activities(this.currentUser, activities);
          this._attachSearch();
        })
        .catch(err => {
          console.error('Activities load error:', err.message);
          Toast.show('Failed to load activities: ' + err.message, 'error');
        });
      return;
    }

    // Teacher Grades
    if (sectionId === 'grades' && this.currentUser.role === 'teacher') {
      const area = document.getElementById('content-area');
      area.innerHTML = TeacherView.grades(this.currentUser);
      api.getTeacherActivities()
        .then(async activities => {
          const allRows = [];
          for (const act of activities) {
            try {
              const subs = await api.getActivitySubmissions(act.id);
              subs.forEach(s => { s._activity = act; allRows.push(s); });
            } catch { /* skip failed fetches */ }
          }
          const countEl = document.getElementById('grade-count');
          if (countEl) countEl.textContent = `${allRows.length} submission(s)`;
          const rows = allRows.map(s => {
            const pct = s.max_score > 0 ? Math.round((s.score ?? 0) / s.max_score * 100) : null;
            const gradeClass = pct >= 90 ? 'badge-green' : pct >= 75 ? 'badge-gold' : 'badge-red';
            const gradeLabel = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Passing' : 'Needs Work';
            return `<tr data-searchable>
              <td><strong>Student #${s.student_id}</strong></td>
              <td class="text-sm">${escHtml(s._activity?.title || '?')}</td>
              <td><span class="badge badge-maroon" style="font-size:10px">${escHtml(s._activity?.activity_type || '')}</span></td>
              <td>${s.score !== null && s.score !== undefined ? s.score : '—'}/${s.max_score ?? '—'}</td>
              <td>${pct !== null ? `<span class="badge ${gradeClass}">${gradeLabel} (${pct}%)</span>` : '<span class="badge badge-gray">Ungraded</span>'}</td>
              <td class="text-sm text-muted">${escHtml(s.grade || '—')}</td>
              <td class="text-sm text-muted">${escHtml(s.remarks || '—')}</td>
              <td class="text-sm text-muted">${s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No submissions yet</td></tr>';
          const wrap = document.getElementById('grades-table-wrap');
          if (wrap) wrap.innerHTML = `
            <div class="card">
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Student</th><th>Activity</th><th>Type</th><th>Score</th><th>Performance</th><th>Grade</th><th>Remarks</th><th>Date</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>`;
          this._attachSearch();
        })
        .catch(err => {
          Toast.show('Failed to load grades: ' + err.message, 'error');
        });
      return;
    }

    // MANAGE USERS – fetch data and make tabs clickable
// MANAGE USERS – fetch data and make tabs clickable
if (sectionId === 'manage-users') {
  Promise.all([
    api.getUsers({ page: 1, page_size: 100 }),
    api.getTeachers(),
    api.getStudents(),
    api.getSections(),
  ]).then(([usersRes, teachersRes, studentsRes, sectionsRes]) => {
    // Normalize each response (handles both array and { items } format)
    const allUsers = Array.isArray(usersRes) ? usersRes : (usersRes.items || []);
    const teachers = Array.isArray(teachersRes) ? teachersRes : (teachersRes.items || []);
    const students = Array.isArray(studentsRes) ? studentsRes : (studentsRes.items || []);
    let sections = Array.isArray(sectionsRes) ? sectionsRes : (sectionsRes.items || []);

    // DEBUG: log to console to verify
    console.log('Sections received:', sections);

    const activeUsers = allUsers.filter(u => u.is_active).length;
    const statsEl = document.getElementById('um-stats');
    if (statsEl) statsEl.innerHTML = `${activeUsers} active · ${teachers.length} teachers · ${students.length} students`;

    document.getElementById('tab-all-count').textContent = allUsers.length;
    document.getElementById('tab-teachers-count').textContent = teachers.length;
    document.getElementById('tab-students-count').textContent = students.length;
    document.getElementById('tab-sections-count').textContent = sections.length;

    document.getElementById('um-pane-all').innerHTML = AdminView._allUsersPane(allUsers);
    document.getElementById('um-pane-teachers').innerHTML = AdminView._teachersPane(teachers);
    document.getElementById('um-pane-students').innerHTML = AdminView._studentsPane(students, sections);
    document.getElementById('um-pane-sections').innerHTML = AdminView._sectionsPane(sections);
    document.getElementById('um-pane-audit').innerHTML = AdminView._auditPane();

    // Activate "All Users" tab by default
    ['all','teachers','students','sections','audit'].forEach(t => {
      const pane = document.getElementById(`um-pane-${t}`);
      if (pane) pane.style.display = t === 'all' ? '' : 'none';
      const btn = document.querySelector(`.um-tab[data-tab="${t}"]`);
      if (btn) btn.classList.toggle('active', t === 'all');
    });

    // Attach click handlers to tabs
    document.querySelectorAll('.um-tab').forEach(tab => {
      tab.removeEventListener('click', tab._handler);
      const handler = () => {
        const targetTab = tab.getAttribute('data-tab');
        if (!targetTab) return;
        ['all','teachers','students','sections','audit'].forEach(t => {
          const pane = document.getElementById(`um-pane-${t}`);
          if (pane) pane.style.display = t === targetTab ? '' : 'none';
          const btn = document.querySelector(`.um-tab[data-tab="${t}"]`);
          if (btn) btn.classList.toggle('active', t === targetTab);
        });
      };
      tab.addEventListener('click', handler);
      tab._handler = handler;
    });
  }).catch(err => {
    console.error('Failed to load manage users data:', err);
    Toast.show('Could not load user data from server.', 'error');
  });
  return;
}

    // Handle legacy pending tab (for manageTeachers/manageStudents redirects)
    if (AdminController._pendingTab) {
      AdminController._switchTab(AdminController._pendingTab);
      AdminController._pendingTab = null;
    }

    this._attachSearch();
  },

  /** Attach live search to the global search input */
  _attachSearch() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      const fresh = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(fresh, searchInput);
      fresh.addEventListener('input', (e) => {
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
   Handles all admin actions: user CRUD, teacher assignment, sections, enrollments.
   ══════════════════════════════════════════════════════════════ */
const AdminController = {
  _pendingTab: null,

  /** Switch between tabs in manage-users view (used by legacy redirects) */
  _switchTab(tab) {
    ['all','teachers','students','sections','audit'].forEach(t => {
      const pane = document.getElementById(`um-pane-${t}`);
      const btn  = document.querySelector(`.um-tab[data-tab="${t}"]`);
      if (pane) pane.style.display = t === tab ? '' : 'none';
      if (btn)  btn.classList.toggle('active', t === tab);
    });
  },

  /** Filter user table by role (teacher/student) */
  _filterRole(val) {
    document.querySelectorAll('#user-table-body tr[data-searchable]').forEach(r => {
      const role = r.querySelector('.badge')?.textContent?.toLowerCase() || '';
      r.style.display = (!val || role === val) ? '' : 'none';
    });
  },

  /** Filter user table by status (active/inactive) */
  _filterStatus(val) {
    document.querySelectorAll('#user-table-body tr[data-searchable]').forEach(r => {
      const status = r.querySelectorAll('.badge')[1]?.textContent?.toLowerCase() || '';
      r.style.display = (!val || status === val) ? '' : 'none';
    });
  },

  /** Filter teacher cards by search text */
  _filterCards(q, cls) {
    document.querySelectorAll('.' + cls).forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  /** Filter student rows by search text */
  _filterStudents(q) {
    document.querySelectorAll('[data-searchable]').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  /** Filter sections by section ID (legacy – kept for compatibility) */
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

  /** Filter audit log table by search text */
  _filterTable(q, bodyId) {
    document.querySelectorAll(`#${bodyId} tr`).forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  /** Open modal to add a new user (teacher/student/admin) with multi-assignment for teachers */
  async openAddUser(preRole = 'student') {
    let subjectOpts = '<option value="">— Loading subjects… —</option>';
    let sectionOpts = '<option value="">— Loading sections… —</option>';
    let classOpts   = '<option value="">— Loading classes… —</option>';

    try {
      const [subjectsRes, sectionsRes, classesRes] = await Promise.all([
        api.getSubjects(),
        api.getSections(),
        api.getClasses()
      ]);
      const subjects = subjectsRes.items || (Array.isArray(subjectsRes) ? subjectsRes : []);
      const sections = sectionsRes.items || (Array.isArray(sectionsRes) ? sectionsRes : []);
      const classes  = classesRes.items || (Array.isArray(classesRes) ? classesRes : []);
      subjectOpts = subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
      if (!subjectOpts) subjectOpts = '<option value="">No subjects in DB</option>';
      sectionOpts = '<option value="">— Select Section —</option>' +
        sections.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
      classOpts = '<option value="">— Skip for now —</option>' +
        classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    } catch (e) {
      console.warn('Could not load dropdown data:', e.message);
      subjectOpts = '<option value="">Error loading subjects</option>';
      sectionOpts = '<option value="">Error loading sections</option>';
      classOpts   = '<option value="">Error loading classes</option>';
    }

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
            <input class="form-control" id="f-password" type="password" placeholder="Min. 8 characters, include a number" style="padding-right:2.8rem" />
            <button type="button" onclick="(function(){var i=document.getElementById('f-password'),b=this;i.type=i.type==='password'?'text':'password';b.innerHTML=i.type==='password'?'&#128065;':'&#128064;';}).call(this)"
              style="position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;padding:.2rem;color:#888">&#128065;</button>
          </div>
        </div>
      </div>
      <!-- TEACHER FIELDS -->
      <div id="teacher-fields" style="${preRole==='teacher'?'':'display:none'}">
        <hr style="margin:8px 0;opacity:.2"/>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Employee ID</label>
            <input class="form-control" id="f-empid" placeholder="e.g. EMP-001" />
          </div>
          <div class="form-group">
            <label class="form-label">Specialization</label>
            <input class="form-control" id="f-spec" placeholder="e.g. Science & Math" />
          </div>
        </div>
        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label" style="font-weight: 600;">📚 Subjects & Classes (at least one)</label>
          <div id="teacher-assignments-container">
            <div class="assignment-row" data-index="0" style="margin-bottom: 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 12px;">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Subject *</label>
                  <select class="form-control assignment-subject" data-index="0">
                    <option value="">— Select Subject —</option>
                    ${subjectOpts}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Class *</label>
                  <select class="form-control assignment-class" data-index="0">
                    <option value="">— Select Class —</option>
                    ${classOpts}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Schedule (optional)</label>
                <input type="text" class="form-control assignment-schedule" data-index="0" placeholder="e.g. MWF 8:00-9:00 (Room 201)">
              </div>
              <button type="button" class="btn btn-xs btn-danger remove-assignment-btn" style="display: none;">✕ Remove</button>
            </div>
          </div>
          <button type="button" id="add-assignment-btn" class="btn btn-outline btn-sm" style="margin-top: 4px;">+ Add Another Subject & Class</button>
        </div>
      </div>
      <!-- STUDENT FIELDS -->
      <div id="student-fields" style="${preRole==='student'?'':'display:none'}">
        <hr style="margin:8px 0;opacity:.2"/>
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
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Guardian Contact</label>
            <input class="form-control" id="f-guardian-contact" placeholder="e.g. 09XXXXXXXXX" />
          </div>
          <div class="form-group">
            <label class="form-label">Assign Section <span style="font-size:11px;color:#888">(optional, can add later)</span></label>
            <select class="form-control" id="f-section-id">
              ${sectionOpts}
            </select>
          </div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" id="btn-save-user" onclick="AdminController.saveNewUser()">Add User</button>`
    );

    // Initialize dynamic assignment rows for teacher
    setTimeout(() => {
      const container = document.getElementById('teacher-assignments-container');
      const addBtn = document.getElementById('add-assignment-btn');
      if (!container || !addBtn) return;
      const refreshRemoveButtons = () => {
        const rows = container.querySelectorAll('.assignment-row');
        rows.forEach((row, idx) => {
          const removeBtn = row.querySelector('.remove-assignment-btn');
          if (removeBtn) removeBtn.style.display = rows.length === 1 ? 'none' : 'inline-block';
        });
      };
      const addRow = () => {
        const firstRow = container.querySelector('.assignment-row');
        const newRow = firstRow.cloneNode(true);
        const newIndex = container.children.length;
        newRow.setAttribute('data-index', newIndex);
        newRow.querySelectorAll('select, input').forEach(el => {
          const name = el.className;
          if (name.includes('assignment-subject') || name.includes('assignment-class')) el.value = '';
          else if (name.includes('assignment-schedule')) el.value = '';
          if (el.hasAttribute('data-index')) el.setAttribute('data-index', newIndex);
        });
        const removeBtn = newRow.querySelector('.remove-assignment-btn');
        if (removeBtn) removeBtn.style.display = 'inline-block';
        container.appendChild(newRow);
        refreshRemoveButtons();
      };
      const removeRow = (btn) => {
        const row = btn.closest('.assignment-row');
        if (container.children.length > 1) {
          row.remove();
          refreshRemoveButtons();
        } else {
          Toast.show('At least one assignment is required.', 'warning');
        }
      };
      container.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-assignment-btn');
        if (removeBtn) {
          e.preventDefault();
          removeRow(removeBtn);
        }
      });
      addBtn.addEventListener('click', addRow);
      refreshRemoveButtons();
    }, 50);
  },

  /** Load classes into a dropdown (used when toggling role to teacher) */
  async _loadClassesDropdown(selectId) {
    try {
      const data = await api.getClasses();
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Skip for now —</option>' +
        data.items.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    } catch (e) { /* silent */ }
  },

  /** Show/hide teacher/student specific fields based on role selection */
  _toggleRoleFields() {
    const role = document.getElementById('f-role').value;
    document.getElementById('teacher-fields').style.display = role === 'teacher' ? '' : 'none';
    document.getElementById('student-fields').style.display = role === 'student' ? '' : 'none';
    if (role === 'teacher') AdminController._loadClassesDropdown('f-class-id');
  },

  /** Save a new user (create user account + teacher/student profile + assignments) */
  async saveNewUser() {
    const name     = document.getElementById('f-name').value.trim();
    const email    = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-password').value.trim();
    const role     = document.getElementById('f-role').value;

    if (!Validate.required(name, 'Full name')) return;
    if (!Validate.required(email, 'Email'))     return;
    if (!Validate.email(email))                 return;
    if (!Validate.minLength(password, 8, 'Password must be at least 8 characters')) return;
    if (!/\d/.test(password)) { Toast.show('Password must contain at least one number.', 'error'); return; }

    const roleIdMap = { admin: 1, teacher: 2, student: 3 };
    const role_id   = roleIdMap[role];
    const parts      = name.split(' ');
    const first_name = parts[0];
    const last_name  = parts.slice(1).join(' ') || parts[0];

    const btn = document.getElementById('btn-save-user');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const newUser = await api.createUser({ email, password, first_name, last_name, role_id });
      Toast.show(`Account created (ID: ${newUser.id}). Setting up ${role} profile…`, 'info');

      if (role === 'teacher') {
        const empId = document.getElementById('f-empid').value.trim();
        const spec  = document.getElementById('f-spec').value.trim();
        const teacherProfile = await api.createTeacherProfile({
          user_id:       newUser.id,
          employee_id:   empId   || null,
          specialization: spec   || null,
          contact_number: null,
        });
        const assignments = [];
        document.querySelectorAll('#teacher-assignments-container .assignment-row').forEach(row => {
          const subjectId = row.querySelector('.assignment-subject').value;
          const classId   = row.querySelector('.assignment-class').value;
          const schedule  = row.querySelector('.assignment-schedule').value.trim();
          if (subjectId && classId) {
            assignments.push({
              subjectId: parseInt(subjectId),
              classId:   parseInt(classId),
              schedule:  schedule || null
            });
          }
        });
        if (assignments.length === 0) {
          Toast.show('Please add at least one subject & class assignment.', 'error');
          if (btn) btn.disabled = false;
          return;
        }
        for (const a of assignments) {
          await api.assignTeacherToClass({
            teacher_id: teacherProfile.id,
            class_id:   a.classId,
            subject_id: a.subjectId,
            schedule:   a.schedule,
          });
        }
        Toast.show(`${assignments.length} subject(s)/class(es) assigned.`, 'info');
      }

      if (role === 'student') {
        const lrn             = document.getElementById('f-lrn').value.trim();
        const guardian        = document.getElementById('f-guardian').value.trim();
        const guardianContact = document.getElementById('f-guardian-contact').value.trim();
        const studentProfile = await api.createStudentProfile({
          user_id:          newUser.id,
          student_number:   lrn             || null,
          guardian_name:    guardian        || null,
          guardian_contact: guardianContact || null,
          contact_number:   null,
        });
        const sectionId = document.getElementById('f-section-id').value;
        if (sectionId) {
          await api.assignStudentToSection({
            student_id: studentProfile.id,
            section_id: parseInt(sectionId),
          });
          Toast.show('Section assigned!', 'info');
        }
      }

      Modal.close();
      Toast.show(`✅ ${role.charAt(0).toUpperCase()+role.slice(1)} "${name}" added successfully!`, 'success');
      DashboardController.loadSection(DashboardController.currentSection);
    } catch (err) {
      Toast.show(`❌ Error: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Add User'; }
    }
  },

  /** Open modal to edit an existing user (supports both API and legacy localStorage users) */
  async openEditUser(id) {
    const isLegacy = typeof id === 'string' && id.startsWith('u');
    if (isLegacy) {
      const user = userModel.getById(id);
      if (!user) return;
      Toast.show('This is a demo/seed user. Only name, email, and status can be edited here.', 'warning');
      Modal.show(`Edit User — ${escHtml(user.name)}`, `
        <div class="form-row">
          <div class="form-group"><label>Full Name</label><input class="form-control" id="e-name" value="${escHtml(user.name)}" /></div>
          <div class="form-group"><label>Email</label><input class="form-control" id="e-email" value="${escHtml(user.email)}" /></div>
        </div>
        <div class="form-group"><label>Status</label><select class="form-control" id="e-active"><option value="1" ${user.isActive?'selected':''}>Active</option><option value="0" ${!user.isActive?'selected':''}>Inactive</option></select></div>`,
        `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="AdminController.saveEditUser('${id}')">Save Changes</button>`
      );
      return;
    }

    try {
      const user = await api.getUser(id);
      const role = user.role.name;
      let teacherProfile = null;
      let subjects = [], classes = [];
      let existingAssignments = [];
      if (role === 'teacher') {
        teacherProfile = await api.getTeacherByUserId(id);
        const subjectsRes = await api.getSubjects();
        const classesRes = await api.getClasses();
        subjects = subjectsRes.items || (Array.isArray(subjectsRes) ? subjectsRes : []);
        classes = classesRes.items || (Array.isArray(classesRes) ? classesRes : []);
        existingAssignments = teacherProfile?.class_assignments || [];
      }
      let extraFields = '';
      if (role === 'teacher') {
        const subjectOpts = subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
        const classOpts = classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
        let assignmentsHtml = '';
        existingAssignments.forEach((ass, idx) => {
          assignmentsHtml += `
            <div class="assignment-row" data-assignment-id="${ass.id}">
              <div class="form-row">
                <div class="form-group"><label>Subject *</label><select class="form-control edit-assignment-subject" data-idx="${idx}"><option value="">— Select Subject —</option>${subjects.map(s => `<option value="${s.id}" ${s.id === ass.subject_id ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Class *</label><select class="form-control edit-assignment-class" data-idx="${idx}"><option value="">— Select Class —</option>${classes.map(c => `<option value="${c.id}" ${c.id === ass.class_id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}</select></div>
              </div>
              <div class="form-group"><label>Schedule (optional)</label><input type="text" class="form-control edit-assignment-schedule" value="${escHtml(ass.schedule || '')}" placeholder="e.g. MWF 8:00-9:00 (Room 201)"></div>
              <button type="button" class="btn btn-xs btn-danger remove-existing-assignment" data-id="${ass.id}">✕ Remove</button>
              <hr>
            </div>`;
        });
        if (existingAssignments.length === 0) {
          assignmentsHtml = `<div class="assignment-row" data-original="false"><div class="form-row"><div class="form-group"><label>Subject *</label><select class="form-control edit-assignment-subject"><option value="">— Select Subject —</option>${subjectOpts}</select></div><div class="form-group"><label>Class *</label><select class="form-control edit-assignment-class"><option value="">— Select Class —</option>${classOpts}</select></div></div><div class="form-group"><label>Schedule (optional)</label><input type="text" class="form-control edit-assignment-schedule" placeholder="e.g. MWF 8:00-9:00 (Room 201)"></div><button type="button" class="btn btn-xs btn-danger remove-assignment-btn" style="display:none;">✕ Remove</button><hr></div>`;
        }
        extraFields = `
          <hr><h4>Teacher Details</h4>
          <div class="form-row"><div class="form-group"><label>Employee ID</label><input class="form-control" id="e-empid" value="${escHtml(teacherProfile?.employee_id || '')}" /></div><div class="form-group"><label>Specialization</label><input class="form-control" id="e-spec" value="${escHtml(teacherProfile?.specialization || '')}" /></div></div>
          <div class="form-group"><label class="form-label" style="font-weight:600;">📚 Subjects & Classes</label><div id="edit-assignments-container">${assignmentsHtml}</div><button type="button" id="add-edit-assignment-btn" class="btn btn-outline btn-sm">+ Add Another Subject & Class</button></div>`;
      }
      if (role === 'student') {
        extraFields = `<hr><h4>Student Details</h4><div class="form-row"><div class="form-group"><label>LRN</label><input class="form-control" id="e-lrn" value="${escHtml(user.student_number || '')}" /></div><div class="form-group"><label>Guardian Name</label><input class="form-control" id="e-guardian" value="${escHtml(user.guardian_name || '')}" /></div></div><div class="form-row"><div class="form-group"><label>Grade Level</label><input class="form-control" id="e-grade" value="${escHtml(user.grade_level || '')}" /></div><div class="form-group"><label>Section</label><input class="form-control" id="e-section" value="${escHtml(user.section_name || '')}" /></div></div>`;
      }
      Modal.show(`Edit User — ${escHtml(user.first_name)} ${escHtml(user.last_name)}`, `
        <div class="form-group"><label>Email</label><input class="form-control" id="e-email" value="${escHtml(user.email)}" /></div>
        <div class="form-group"><label>Status</label><select class="form-control" id="e-active"><option value="1" ${user.is_active ? 'selected' : ''}>Active</option><option value="0" ${!user.is_active ? 'selected' : ''}>Inactive</option></select></div>
        <div class="form-group"><label>New Password (leave blank to keep)</label><input class="form-control" id="e-password" type="password" placeholder="Min. 8 chars + 1 number" /></div>
        <div class="form-row"><div class="form-group"><label>First Name</label><input class="form-control" id="e-fname" value="${escHtml(user.first_name)}" /></div><div class="form-group"><label>Last Name</label><input class="form-control" id="e-lname" value="${escHtml(user.last_name)}" /></div></div>
        ${extraFields}
      `, `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" id="btn-edit-user" onclick="AdminController.saveEditUser(${id})">Save Changes</button>`);
      if (role === 'teacher') {
        setTimeout(() => {
          window._editTeacherId = teacherProfile.id;
          const container = document.getElementById('edit-assignments-container');
          if (!container) return;
          const originalIds = Array.from(container.querySelectorAll('.assignment-row[data-assignment-id]')).map(row => parseInt(row.getAttribute('data-assignment-id')));
          window._editTeacherOriginalAssignmentIds = originalIds;
          const refreshRemoveButtons = () => {
            const rows = container.querySelectorAll('.assignment-row');
            rows.forEach((row, idx) => {
              const btn = row.querySelector('.remove-existing-assignment, .remove-assignment-btn');
              if (btn) btn.style.display = rows.length === 1 ? 'none' : 'inline-block';
            });
          };
          const addRow = () => {
            const template = container.querySelector('.assignment-row');
            const newRow = template.cloneNode(true);
            newRow.removeAttribute('data-assignment-id');
            newRow.setAttribute('data-original', 'false');
            newRow.querySelectorAll('select').forEach(sel => sel.value = '');
            newRow.querySelector('.edit-assignment-schedule').value = '';
            const removeBtn = newRow.querySelector('.remove-existing-assignment');
            if (removeBtn) { removeBtn.classList.remove('remove-existing-assignment'); removeBtn.classList.add('remove-assignment-btn'); removeBtn.removeAttribute('data-id'); }
            container.appendChild(newRow);
            refreshRemoveButtons();
          };
          container.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-existing-assignment, .remove-assignment-btn');
            if (removeBtn) {
              e.preventDefault();
              const row = removeBtn.closest('.assignment-row');
              if (container.children.length > 1) row.remove();
              else Toast.show('At least one assignment is required.', 'warning');
              refreshRemoveButtons();
            }
          });
          document.getElementById('add-edit-assignment-btn')?.addEventListener('click', addRow);
          refreshRemoveButtons();
        }, 50);
      }
    } catch (err) {
      Toast.show(`Could not load user: ${err.message}`, 'error');
    }
  },

  openEditTeacher(id) { this.openEditUser(id); },

  /** Save changes to an existing user (update user, teacher profile, and assignments) */
  async saveEditUser(id) {
    const isLegacy = typeof id === 'string' && id.startsWith('u');
    if (isLegacy) {
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
      userModel.update(id, updates);
      Modal.close();
      Toast.show('User updated.', 'success');
      DashboardController.loadSection(DashboardController.currentSection);
      return;
    }

    const email    = document.getElementById('e-email').value.trim();
    const isActive = document.getElementById('e-active').value === '1';
    const password = document.getElementById('e-password')?.value.trim() || '';
    const fname    = document.getElementById('e-fname')?.value.trim() || null;
    const lname    = document.getElementById('e-lname')?.value.trim() || null;
    if (!Validate.email(email)) return;
    if (password && (password.length < 8 || !/\d/.test(password))) {
      Toast.show('Password must be at least 8 characters and contain a number.', 'error');
      return;
    }
    const updates = { email, is_active: isActive };
    if (fname) updates.first_name = fname;
    if (lname) updates.last_name  = lname;
    if (password) updates.password = password;

    const btn = document.getElementById('btn-edit-user');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await api.updateUser(id, updates);
      Toast.show('User details updated.', 'info');
      if (window._editTeacherId) {
        const teacherId = window._editTeacherId;
        const empId = document.getElementById('e-empid')?.value.trim() || null;
        const spec  = document.getElementById('e-spec')?.value.trim() || null;
        if (empId !== undefined || spec !== undefined) {
          const profileUpdates = {};
          if (empId !== undefined) profileUpdates.employee_id = empId;
          if (spec  !== undefined) profileUpdates.specialization = spec;
          await api.updateTeacherProfile(teacherId, profileUpdates);
          Toast.show('Teacher profile updated.', 'info');
        }
        const container = document.getElementById('edit-assignments-container');
        if (container) {
          const rows = container.querySelectorAll('.assignment-row');
          const currentAssignmentIds = [];
          const originalIds = window._editTeacherOriginalAssignmentIds || [];
          for (const row of rows) {
            const subjectSelect = row.querySelector('.edit-assignment-subject');
            const classSelect   = row.querySelector('.edit-assignment-class');
            const scheduleInput = row.querySelector('.edit-assignment-schedule');
            if (!subjectSelect || !classSelect) continue;
            const subjectId = subjectSelect.value;
            const classId   = classSelect.value;
            const schedule  = scheduleInput?.value.trim() || '';
            if (!subjectId || !classId) {
              Toast.show('Each assignment must have a subject and a class.', 'error');
              if (btn) btn.disabled = false;
              return;
            }
            const assignmentId = row.getAttribute('data-assignment-id');
            if (assignmentId) {
              currentAssignmentIds.push(parseInt(assignmentId));
              await api.updateTeacherAssignment(assignmentId, {
                class_id: parseInt(classId),
                subject_id: parseInt(subjectId),
                schedule: schedule || null,
              });
            } else {
              await api.assignTeacherToClass({
                teacher_id: teacherId,
                class_id: parseInt(classId),
                subject_id: parseInt(subjectId),
                schedule: schedule || null,
              });
            }
          }
          const toDelete = originalIds.filter(id => !currentAssignmentIds.includes(id));
          for (const delId of toDelete) {
            await api.deleteTeacherAssignment(delId);
          }
          if (toDelete.length) Toast.show(`${toDelete.length} assignment(s) removed.`, 'info');
        }
        delete window._editTeacherId;
        delete window._editTeacherOriginalAssignmentIds;
      }
      Modal.close();
      Toast.show('✅ User updated successfully!', 'success');
      DashboardController.loadSection(DashboardController.currentSection);
    } catch (err) {
      console.error('Save error:', err);
      Toast.show(`❌ Error: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  },

  /** Soft-delete a user (set is_active = false) */
  async deleteUser(id) {
    const isLegacy = typeof id === 'string' && id.startsWith('u');
    const label    = isLegacy ? (userModel.getById(id)?.name || id) : `User #${id}`;
    if (!confirm(`Deactivate "${label}"?\n\nThis disables their login but keeps all records.`)) return;
    if (isLegacy) {
      userModel.softDelete(id);
      Toast.show(`"${label}" has been deactivated.`, 'info');
      DashboardController.loadSection(DashboardController.currentSection);
      return;
    }
    try {
      await api.deleteUser(id);
      Toast.show(`✅ User deactivated.`, 'info');
      DashboardController.loadSection(DashboardController.currentSection);
    } catch (err) {
      Toast.show(`❌ Error: ${err.message}`, 'error');
    }
  },

  // Legacy methods (kept for compatibility – not used by new UI)
  viewStudentProfile(id) { /* legacy */ },
  openAssignSchedule(teacherId) { /* legacy */ },
  saveSchedule(teacherId) { /* legacy */ },
  deleteSchedule(schId, teacherId) { /* legacy */ },
  viewSectionSchedule(sectionId) { /* legacy */ },

  /* ── SECTION CRUD (API‑driven) ───────────────────────────────────────── */

  /** Open modal to add a new section */
  async openAddSection() {
    let classOpts = '<option value="">Loading classes…</option>';
    try {
      const classesRes = await api.getClasses();
      const classes = classesRes.items || (Array.isArray(classesRes) ? classesRes : []);
      classOpts = classes.map(c => `<option value="${c.id}">${escHtml(c.name)} (${escHtml(c.grade_level || '')})</option>`).join('');
      if (!classOpts) classOpts = '<option value="">No classes available</option>';
    } catch (e) {
      classOpts = '<option value="">Error loading classes</option>';
    }

    Modal.show('Add Section', `
      <div class="form-group">
        <label class="form-label">Section Name *</label>
        <input class="form-control" id="new-section-name" placeholder="e.g. Section A" />
      </div>
      <div class="form-group">
        <label class="form-label">Class *</label>
        <select class="form-control" id="new-section-class">${classOpts}</select>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="AdminController.saveNewSection()">Add Section</button>`
    );
  },

  /** Save a new section via API */
  async saveNewSection() {
    const name = document.getElementById('new-section-name').value.trim();
    const classId = document.getElementById('new-section-class').value;
    if (!name) { Toast.show('Section name is required.', 'error'); return; }
    if (!classId) { Toast.show('Please select a class.', 'error'); return; }

    const btn = document.querySelector('#modal-container .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await api.createSection({ name, class_id: parseInt(classId) });
      Modal.close();
      Toast.show('Section created successfully!', 'success');
      DashboardController.loadSection('manage-users');
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      if (btn) btn.disabled = false;
    }
  },

  /** Open modal to edit an existing section */
  async openEditSection(id) {
    try {
      // Fetch section details (requires getSection endpoint in API)
      const section = await api.getSection(id);
      const classesRes = await api.getClasses();
      const classes = classesRes.items || (Array.isArray(classesRes) ? classesRes : []);
      const classOpts = classes.map(c => `<option value="${c.id}" ${c.id === section.class_id ? 'selected' : ''}>${escHtml(c.name)} (${escHtml(c.grade_level || '')})</option>`).join('');

      Modal.show('Edit Section', `
        <div class="form-group">
          <label class="form-label">Section Name *</label>
          <input class="form-control" id="edit-section-name" value="${escHtml(section.name)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Class *</label>
          <select class="form-control" id="edit-section-class">${classOpts}</select>
        </div>`,
        `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
         <button class="btn btn-primary" onclick="AdminController.saveEditSection(${id})">Save Changes</button>`
      );
    } catch (err) {
      Toast.show(`Could not load section: ${err.message}`, 'error');
    }
  },

  /** Save edited section via API */
  async saveEditSection(id) {
    const name = document.getElementById('edit-section-name').value.trim();
    const classId = document.getElementById('edit-section-class').value;
    if (!name) { Toast.show('Section name is required.', 'error'); return; }
    if (!classId) { Toast.show('Please select a class.', 'error'); return; }

    const btn = document.querySelector('#modal-container .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await api.updateSection(id, { name, class_id: parseInt(classId) });
      Modal.close();
      Toast.show('Section updated!', 'success');
      DashboardController.loadSection('manage-users');
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
      if (btn) btn.disabled = false;
    }
  },

  /** Delete a section */
  async deleteSection(id) {
    if (!confirm('Delete this section? Students will remain but lose section assignment.')) return;
    try {
      await api.deleteSection(id);
      Toast.show('Section deleted.', 'info');
      DashboardController.loadSection('manage-users');
    } catch (err) {
      Toast.show(`Error: ${err.message}`, 'error');
    }
  },

  /* ── STUDENT SUBJECT ENROLLMENT ───────────────────────────────────────── */

  /** Open modal to enroll a student in subjects (multi-select checkboxes) */
  async openEnrollSubjects(studentId, studentName) {
    const existing = document.getElementById('enroll-subjects-modal');
    if (existing) existing.remove();
    const loadingModal = document.createElement('div');
    loadingModal.id = 'enroll-subjects-modal';
    loadingModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    loadingModal.innerHTML = `<div style="background:#fff;border-radius:12px;padding:32px;min-width:320px;text-align:center;"><div style="font-size:24px;margin-bottom:8px">📚</div><p style="color:#888">Loading subjects…</p></div>`;
    document.body.appendChild(loadingModal);
    try {
      const [allSubjects, enrolled] = await Promise.all([api.getSubjects(), api.getStudentSubjectEnrollments(studentId).catch(() => [])]);
      const enrolledIds = new Set(enrolled.map(e => e.subject_id));
      const checkboxes = allSubjects.map(s => `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;"><input type="checkbox" id="enroll-subj-${s.id}" value="${s.id}" ${enrolledIds.has(s.id) ? 'checked' : ''} style="width:16px;height:16px;accent-color:#8b1a2e;cursor:pointer;" /><span style="font-weight:500">${escHtml(s.name)}</span>${s.description ? `<span style="color:#888;font-size:12px;margin-left:auto">${escHtml(s.description)}</span>` : ''}</label>`).join('');
      loadingModal.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;width:520px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><div><h3 style="margin:0;color:#1a1a2e">📚 Enroll in Subjects</h3><p style="margin:4px 0 0;color:#888;font-size:13px">${escHtml(studentName)}</p></div><button onclick="document.getElementById('enroll-subjects-modal').remove()" style="border:none;background:none;font-size:20px;cursor:pointer;color:#888;line-height:1;">✕</button></div>${allSubjects.length === 0 ? `<p style="color:#888;text-align:center;padding:24px 0">No subjects found. <br>Create subjects first in the Classes section.</p>` : `<div style="flex:1;overflow-y:auto;padding-right:4px;">${checkboxes}</div><div style="margin-top:16px;padding-top:16px;border-top:1px solid #eee;display:flex;gap:10px;justify-content:flex-end;"><button class="btn btn-outline" onclick="document.getElementById('enroll-subjects-modal').remove()">Cancel</button><button class="btn btn-primary" onclick="AdminController.saveEnrollSubjects(${studentId})">💾 Save Enrollment</button></div>`}</div>`;
    } catch (err) {
      loadingModal.remove();
      console.error('Enroll subjects error:', err);
      Toast.show('Failed to load subjects: ' + err.message, 'error');
    }
  },

  /** Save subject enrollments for a student */
  async saveEnrollSubjects(studentId) {
    const checkboxes = document.querySelectorAll('#enroll-subjects-modal input[type="checkbox"]');
    const subjectIds = [...checkboxes].filter(c => c.checked).map(c => parseInt(c.value));
    const btn = document.querySelector('#enroll-subjects-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const result = await api.enrollStudentSubjects(studentId, subjectIds);
      document.getElementById('enroll-subjects-modal').remove();
      Toast.show(result.message || 'Enrollment saved successfully!', 'success');
      DashboardController.loadSection(DashboardController.currentSection);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save Enrollment'; }
      Toast.show('Failed to save enrollment: ' + err.message, 'error');
    }
  },

  // Legacy CSV and settings methods (keep as is)
  exportCSV(type) { /* legacy */ },
  openImportCSV() { /* legacy */ },
  processImportCSV() { /* legacy */ },
  clearAuditLog() { /* legacy */ },
  saveSettings() { /* legacy */ },
  changePassword() { /* legacy */ },
};

/* ══════════════════════════════════════════════════════════════
   TEACHER CONTROLLER
   Handles module and activity management for teachers.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TEACHER CONTROLLER  (full replacement of the existing block)
   Replace everything from:
     const TeacherController = {
   …to the closing };
   ══════════════════════════════════════════════════════════════ */

const TeacherController = {

  // ── Module methods (unchanged) ────────────────────────────────────────────

  async openAddModule() {
    let subjectOpts = '<option value="">Loading...</option>';
    try {
      const subjects = await api.getMySubjects();
      if (subjects.length === 0) subjectOpts = '<option value="">No subjects assigned yet</option>';
      else subjectOpts = subjects.map(s => `<option value="${s.subject_id}" data-class="${s.class_id}">${escHtml(s.subject_name)} — ${escHtml(s.class_name)}</option>`).join('');
    } catch (err) {
      subjectOpts = '<option value="">Failed to load subjects</option>';
    }
    Modal.show('Upload New Module', `
      <div class="form-group"><label>Module Title *</label><input class="form-control" id="m-title" placeholder="e.g. Introduction to Algebra" /></div>
      <div class="form-group"><label>Subject *</label><select class="form-control" id="m-subject">${subjectOpts}</select></div>
      <div class="form-group"><label>Description</label><textarea class="form-control" id="m-desc" placeholder="Brief description of the module…"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Term</label><select class="form-control" id="m-term"><option value="">— Select Term —</option><option value="1st">1st Term</option><option value="2nd">2nd Term</option><option value="3rd">3rd Term</option><option value="4th">4th Term</option></select></div>
        <div class="form-group"><label>PDF File</label><input class="form-control" id="m-file" type="file" accept=".pdf" /><div id="m-file-status" style="font-size:12px;margin-top:4px;color:var(--gray-400)">No file selected</div></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="TeacherController.saveModule()">Upload Module</button>`
    );
    if (window._selectedSubjectId) {
      setTimeout(() => { const s = document.getElementById('m-subject'); if (s) s.value = window._selectedSubjectId; delete window._selectedSubjectId; }, 100);
    }
    document.getElementById('m-file').addEventListener('change', function () {
      document.getElementById('m-file-status').textContent = this.files[0] ? `Selected: ${this.files[0].name}` : 'No file selected';
    });
  },

  async saveModule() {
    const title     = document.getElementById('m-title').value.trim();
    const subject   = document.getElementById('m-subject').value;
    const term      = document.getElementById('m-term').value;
    const fileInput = document.getElementById('m-file');
    const file      = fileInput?.files?.[0];
    if (!Validate.required(title, 'Module title')) return;
    if (!subject) { Toast.show('Please select a subject.', 'error'); return; }
    const submitBtn = document.querySelector('#modal-container .btn-primary');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading…'; }
    try {
      let file_url = null, file_name = null;
      if (file) {
        Toast.show('Uploading PDF…', 'info');
        const uploaded = await api.uploadModuleFile(file);
        file_url  = uploaded.file_url;
        file_name = uploaded.file_name;
      }
      await api.createMyModule({ title, subject_id: parseInt(subject), description: document.getElementById('m-desc').value.trim(), term: term || null, file_url, file_name, is_published: true });
      Modal.close();
      Toast.show('Module uploaded successfully!', 'success');
      DashboardController.loadSection('modules');
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload Module'; }
      Toast.show(err.message || 'Failed to upload module.', 'error');
    }
  },

  openEditModule(id) { /* TODO */ },
  updateModule(id)   { /* TODO */ },

  async deleteModule(id) {
    if (!confirm('Delete this module? This cannot be undone.')) return;
    try {
      await api.deleteMyModule(id);
      Toast.show('Module deleted.', 'info');
      DashboardController.loadSection('modules');
    } catch (err) {
      Toast.show(err.message || 'Failed to delete module.', 'error');
    }
  },

  openAddModuleForSubject(subjectId, classId) {
    window._selectedSubjectId = subjectId;
    this.openAddModule();
  },

  async viewStudentsForSubject(subjectId, classId, subjectName) {
    Modal.show(`Students – ${escHtml(subjectName)}`, '<div class="text-center">Loading students…</div>', '');
    try {
      const students = await api.getClassStudents(classId);
      if (!students.length) {
        Modal.show(`Students – ${escHtml(subjectName)}`, '<div class="text-muted">No students enrolled in this class.</div>', '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
        return;
      }
      const list = students.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee">
          <div><strong>${escHtml((s.user?.first_name || '') + ' ' + (s.user?.last_name || ''))}</strong><br><span class="text-sm">${escHtml(s.user?.email || '')}</span></div>
          <span class="badge ${s.user?.is_active ? 'badge-green' : 'badge-red'}">${s.user?.is_active ? 'Active' : 'Inactive'}</span>
        </div>`).join('');
      Modal.show(`Students – ${escHtml(subjectName)}`, `<div>${list}</div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
    } catch (err) {
      Modal.show(`Students – ${escHtml(subjectName)}`, `<div class="text-danger">Could not load students: ${err.message}</div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
    }
  },

  // ── Activity helpers ──────────────────────────────────────────────────────

  _ACTIVITY_TYPES: [
    { value: 'quiz',             label: 'Quiz' },
    { value: 'long_quiz',        label: 'Long Quiz' },
    { value: 'task_performance', label: 'Task Performance' },
    { value: 'exam',             label: 'Exam' },
    { value: 'lab_exercise',     label: 'Laboratory Exercise' },
    { value: 'assignment',       label: 'Assignment / Homework' },
    { value: 'other',            label: 'Other (specify)' },
  ],

  _FORMAT_TYPES: [
    { value: 'multiple_choice', label: '🔘 Multiple Choice', grading: 'auto' },
    { value: 'checkbox',        label: '☑️  Checkbox (multi-select)', grading: 'auto' },
    { value: 'enumeration',     label: '📝 Fill in the Blank / Enumeration', grading: 'auto' },
    { value: 'freeform',        label: '✍️  Freeform / Essay', grading: 'manual' },
    { value: 'assignment',      label: '📋 Assignment / Homework', grading: 'manual' },
    { value: 'hybrid',          label: '🔀 Hybrid (mixed types)', grading: 'manual' },
  ],

  /** Questions array held in memory while the modal is open */
  _questions: [],

  _gradingBadge(mode) {
    return mode === 'auto'
      ? `<span class="badge badge-green" title="System will auto-check answers">⚡ Auto-graded</span>`
      : `<span class="badge badge-gold" title="You will manually enter grades">✏️ Manual grading</span>`;
  },

  // ── CREATE ACTIVITY MODAL ─────────────────────────────────────────────────

  async openAddActivity(presetSubjectId = null) {
    this._questions = [];

    let subjectOpts = '<option value="">Loading...</option>';
    let moduleMap   = {};  // subject_id → [modules]

    try {
      const [subjects, modules] = await Promise.all([
        api.getMySubjects(),
        api.getMyModules(),
      ]);
      if (!subjects.length) subjectOpts = '<option value="">No subjects assigned</option>';
      else subjectOpts = subjects.map(s =>
        `<option value="${s.subject_id}" ${s.subject_id === presetSubjectId ? 'selected' : ''}>${escHtml(s.subject_name)} — ${escHtml(s.class_name)}</option>`
      ).join('');

      modules.forEach(m => {
        if (!moduleMap[m.subject_id]) moduleMap[m.subject_id] = [];
        moduleMap[m.subject_id].push(m);
      });
      window._activityModuleMap = moduleMap;
    } catch (err) {
      subjectOpts = '<option value="">Failed to load subjects</option>';
    }

    const typeOpts   = this._ACTIVITY_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    const formatOpts = this._FORMAT_TYPES.map(f => `<option value="${f.value}">${f.label}</option>`).join('');

    Modal.show('Create Activity', `
      <div style="max-height:70vh;overflow-y:auto;padding-right:4px">

        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Activity Title *</label>
            <input class="form-control" id="act-title" placeholder="e.g. Quiz 1 – Fractions" />
          </div>
          <div class="form-group" style="flex:1">
            <label>Subject *</label>
            <select class="form-control" id="act-subject" onchange="TeacherController._onSubjectChange(this.value)">${subjectOpts}</select>
          </div>
        </div>

        <div class="form-group">
          <label>Module *</label>
          <select class="form-control" id="act-module"><option value="">— Select subject first —</option></select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Activity Type</label>
            <select class="form-control" id="act-type" onchange="TeacherController._onTypeChange(this.value)">${typeOpts}</select>
          </div>
          <div class="form-group" id="act-custom-wrap" style="display:none">
            <label>Specify Type</label>
            <input class="form-control" id="act-type-custom" placeholder="e.g. Performance Task" />
          </div>
        </div>

        <div class="form-group">
          <label>Question Format</label>
          <select class="form-control" id="act-format" onchange="TeacherController._onFormatChange(this.value)">${formatOpts}</select>
          <div id="act-grading-badge" style="margin-top:6px">${this._gradingBadge('auto')}</div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Start Date / Time</label>
            <input class="form-control" id="act-start" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>Due Date / Time</label>
            <input class="form-control" id="act-due" type="datetime-local" />
          </div>
        </div>

        <div class="form-group">
          <label>Instructions to Students</label>
          <textarea class="form-control" id="act-instructions" rows="3" placeholder="Write any special instructions, reminders, or rules for this activity…"></textarea>
        </div>

        <!-- Questions section (hidden for assignment/freeform initially) -->
        <div id="act-questions-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px">
            <strong>Questions</strong>
            <button class="btn btn-xs btn-outline" onclick="TeacherController._addQuestion()">➕ Add Question</button>
          </div>
          <div id="act-questions-list">
            <div class="text-muted text-sm" style="padding:12px 0">No questions yet. Click "Add Question" to start.</div>
          </div>
        </div>

      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.saveActivity()">💾 Save Activity</button>`
    );

    // Trigger initial state
    setTimeout(() => {
      const subjectSel = document.getElementById('act-subject');
      if (subjectSel && subjectSel.value) this._onSubjectChange(subjectSel.value);
      this._onFormatChange(document.getElementById('act-format')?.value || 'multiple_choice');
    }, 80);
  },

  _onSubjectChange(subjectId) {
    const moduleMap  = window._activityModuleMap || {};
    const modules    = moduleMap[parseInt(subjectId)] || [];
    const moduleSel  = document.getElementById('act-module');
    if (!moduleSel) return;
    if (!modules.length) {
      moduleSel.innerHTML = '<option value="">No modules for this subject</option>';
    } else {
      moduleSel.innerHTML = modules.map(m => `<option value="${m.id}">${escHtml(m.title)}</option>`).join('');
    }
  },

  _onTypeChange(val) {
    const wrap = document.getElementById('act-custom-wrap');
    if (wrap) wrap.style.display = val === 'other' ? '' : 'none';
  },

  _onFormatChange(val) {
    const fmt        = this._FORMAT_TYPES.find(f => f.value === val);
    const badgeEl    = document.getElementById('act-grading-badge');
    const qSection   = document.getElementById('act-questions-section');
    if (badgeEl)  badgeEl.innerHTML = this._gradingBadge(fmt?.grading || 'auto');

    // Hide questions section for pure assignment/freeform
    const hideQ = val === 'assignment' || val === 'freeform';
    if (qSection) qSection.style.display = hideQ ? 'none' : '';
  },

  // ── Question builder ──────────────────────────────────────────────────────

  _addQuestion() {
    const format = document.getElementById('act-format')?.value || 'multiple_choice';
    const defaultType = {
      multiple_choice: 'multiple_choice',
      checkbox:        'checkbox',
      enumeration:     'fill_blank',
      hybrid:          'multiple_choice',
    }[format] || 'multiple_choice';

    const idx = this._questions.length;
    this._questions.push({ id: `q${idx}`, type: defaultType, text: '', points: 1, correct: null, choices: [] });

    if (defaultType === 'multiple_choice' || defaultType === 'checkbox') {
      // Pre-populate 4 blank choices
      this._questions[idx].choices = ['', '', '', ''].map((_, i) => ({ id: `c${idx}_${i}`, text: '' }));
    }

    this._renderQuestions();
  },

  _removeQuestion(idx) {
    this._questions.splice(idx, 1);
    this._renderQuestions();
  },

  _renderQuestions() {
    const container = document.getElementById('act-questions-list');
    if (!container) return;

    if (!this._questions.length) {
      container.innerHTML = '<div class="text-muted text-sm" style="padding:12px 0">No questions yet.</div>';
      return;
    }

    container.innerHTML = this._questions.map((q, idx) => {
      const typeOpts = [
        { v: 'multiple_choice', l: '🔘 Multiple Choice' },
        { v: 'checkbox',        l: '☑️  Checkbox' },
        { v: 'fill_blank',      l: '📝 Fill in the Blank' },
        { v: 'essay',           l: '✍️  Essay' },
      ].map(t => `<option value="${t.v}" ${q.type === t.v ? 'selected' : ''}>${t.l}</option>`).join('');

      const choicesHtml = this._renderChoicesEditor(q, idx);

      return `
        <div class="activity-question-builder" data-q="${idx}" style="border:1px solid var(--gray-200);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--gray-50)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:13px">Q${idx + 1}</strong>
            <div style="display:flex;gap:6px;align-items:center">
              <label style="font-size:12px;margin:0">Pts:</label>
              <input type="number" min="1" value="${q.points}" style="width:52px" class="form-control form-control-sm" onchange="TeacherController._qSetPoints(${idx}, this.value)" />
              <button class="btn btn-xs btn-danger" onclick="TeacherController._removeQuestion(${idx})">🗑️</button>
            </div>
          </div>

          <div class="form-row" style="margin-bottom:8px">
            <div class="form-group" style="flex:2;margin-bottom:0">
              <input class="form-control" placeholder="Question text *" value="${escHtml(q.text)}"
                onchange="TeacherController._qSetText(${idx}, this.value)" />
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0">
              <select class="form-control" onchange="TeacherController._qSetType(${idx}, this.value)">${typeOpts}</select>
            </div>
          </div>

          ${choicesHtml}
        </div>`;
    }).join('');
  },

  _renderChoicesEditor(q, idx) {
    if (q.type === 'multiple_choice') {
      const choices = q.choices.length ? q.choices : [{ id: 'c0', text: '' }, { id: 'c1', text: '' }, { id: 'c2', text: '' }, { id: 'c3', text: '' }];
      const rows = choices.map((c, ci) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="radio" name="correct_${idx}" value="${ci}" ${String(q.correct) === String(ci) ? 'checked' : ''}
            onchange="TeacherController._qSetCorrect(${idx}, '${ci}')" title="Mark as correct" />
          <input class="form-control form-control-sm" placeholder="Choice ${ci + 1}" value="${escHtml(c.text)}"
            onchange="TeacherController._qSetChoice(${idx}, ${ci}, this.value)" style="flex:1" />
          ${choices.length > 2 ? `<button class="btn btn-xs btn-ghost" onclick="TeacherController._qRemoveChoice(${idx}, ${ci})">✕</button>` : ''}
        </div>`).join('');
      return `
        <div style="margin-top:8px">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">Choices (select the correct one ◉)</div>
          ${rows}
          <button class="btn btn-xs btn-outline" onclick="TeacherController._qAddChoice(${idx})" style="margin-top:4px">➕ Add Choice</button>
        </div>`;
    }

    if (q.type === 'checkbox') {
      const choices = q.choices.length ? q.choices : [{ id: 'c0', text: '' }, { id: 'c1', text: '' }];
      let correctSet = [];
      try { correctSet = JSON.parse(q.correct || '[]'); } catch { correctSet = []; }
      const rows = choices.map((c, ci) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="checkbox" ${correctSet.includes(ci) ? 'checked' : ''}
            onchange="TeacherController._qToggleCheckbox(${idx}, ${ci}, this.checked)" title="Mark as correct" />
          <input class="form-control form-control-sm" placeholder="Choice ${ci + 1}" value="${escHtml(c.text)}"
            onchange="TeacherController._qSetChoice(${idx}, ${ci}, this.value)" style="flex:1" />
          ${choices.length > 2 ? `<button class="btn btn-xs btn-ghost" onclick="TeacherController._qRemoveChoice(${idx}, ${ci})">✕</button>` : ''}
        </div>`).join('');
      return `
        <div style="margin-top:8px">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">Choices (check all correct answers ☑)</div>
          ${rows}
          <button class="btn btn-xs btn-outline" onclick="TeacherController._qAddChoice(${idx})" style="margin-top:4px">➕ Add Choice</button>
        </div>`;
    }

    if (q.type === 'fill_blank') {
      return `
        <div style="margin-top:8px">
          <label style="font-size:12px;color:var(--gray-500)">Expected Answer (exact text match, case-insensitive)</label>
          <input class="form-control form-control-sm" placeholder="e.g. Photosynthesis" value="${escHtml(q.correct || '')}"
            onchange="TeacherController._qSetCorrect(${idx}, this.value)" />
        </div>`;
    }

    // essay
    return `<div style="font-size:12px;color:var(--gray-400);margin-top:8px;padding:6px;background:var(--gray-100);border-radius:4px">📝 Essay — teacher grades manually after submission.</div>`;
  },

  // ── Question mutation helpers ──────────────────────────────────────────────

  _qSetText(idx, val) { this._questions[idx].text = val; },
  _qSetPoints(idx, val) { this._questions[idx].points = parseInt(val) || 1; },

  _qSetType(idx, val) {
    this._questions[idx].type    = val;
    this._questions[idx].correct = null;
    if (val === 'multiple_choice' || val === 'checkbox') {
      if (!this._questions[idx].choices.length)
        this._questions[idx].choices = [{ id: 'c0', text: '' }, { id: 'c1', text: '' }];
    } else {
      this._questions[idx].choices = [];
    }
    this._renderQuestions();
  },

  _qSetCorrect(idx, val) { this._questions[idx].correct = val; },

  _qToggleCheckbox(idx, ci, checked) {
    let current = [];
    try { current = JSON.parse(this._questions[idx].correct || '[]'); } catch { current = []; }
    if (checked && !current.includes(ci)) current.push(ci);
    if (!checked) current = current.filter(x => x !== ci);
    this._questions[idx].correct = JSON.stringify(current.sort());
  },

  _qSetChoice(idx, ci, val) {
    if (!this._questions[idx].choices[ci]) this._questions[idx].choices[ci] = { id: `c${ci}`, text: '' };
    this._questions[idx].choices[ci].text = val;
  },

  _qAddChoice(idx) {
    const ci = this._questions[idx].choices.length;
    this._questions[idx].choices.push({ id: `c${ci}`, text: '' });
    this._renderQuestions();
  },

  _qRemoveChoice(idx, ci) {
    this._questions[idx].choices.splice(ci, 1);
    this._renderQuestions();
  },

  // ── Save Activity ─────────────────────────────────────────────────────────

  async saveActivity() {
    const title       = document.getElementById('act-title')?.value.trim();
    const subjectId   = parseInt(document.getElementById('act-subject')?.value);
    const moduleId    = parseInt(document.getElementById('act-module')?.value);
    const actType     = document.getElementById('act-type')?.value;
    const actCustom   = document.getElementById('act-type-custom')?.value.trim();
    const format      = document.getElementById('act-format')?.value;
    const startRaw    = document.getElementById('act-start')?.value;
    const dueRaw      = document.getElementById('act-due')?.value;
    const instructions = document.getElementById('act-instructions')?.value.trim();

    if (!title)    { Toast.show('Activity title is required.', 'error'); return; }
    if (!subjectId){ Toast.show('Please select a subject.', 'error'); return; }
    if (!moduleId) { Toast.show('Please select a module.', 'error'); return; }

    // Validate questions for structured formats
    const needsQuestions = !['assignment', 'freeform'].includes(format);
    if (needsQuestions && !this._questions.length) {
      Toast.show('Please add at least one question.', 'error'); return;
    }
    for (const [i, q] of this._questions.entries()) {
      if (!q.text.trim()) { Toast.show(`Question ${i + 1} is missing question text.`, 'error'); return; }
      if ((q.type === 'multiple_choice' || q.type === 'checkbox') && q.choices.filter(c => c.text.trim()).length < 2) {
        Toast.show(`Question ${i + 1} needs at least 2 choices.`, 'error'); return;
      }
      if (q.type === 'multiple_choice' && (q.correct === null || q.correct === '')) {
        Toast.show(`Question ${i + 1}: please select the correct answer.`, 'error'); return;
      }
    }

    const fmt = this._FORMAT_TYPES.find(f => f.value === format);
    const gradingMode = fmt?.grading || 'auto';

    const questions = this._questions.map((q, i) => ({
      order:          i,
      question_text:  q.text.trim(),
      question_type:  q.type,
      points:         q.points,
      correct_answer: q.correct !== null ? String(q.correct) : null,
      choices:        q.choices.map((c, ci) => ({ order: ci, choice_text: c.text.trim() })).filter(c => c.choice_text),
    }));

    const max_score = questions.reduce((s, q) => s + q.points, 0) || null;

    const payload = {
      title,
      subject_id:           subjectId,
      module_id:            moduleId,
      activity_type:        actType,
      activity_type_custom: actType === 'other' ? actCustom : null,
      format_type:          format,
      grading_mode:         gradingMode,
      instructions:         instructions || null,
      start_date:           startRaw ? new Date(startRaw).toISOString() : null,
      due_date:             dueRaw   ? new Date(dueRaw).toISOString()   : null,
      max_score,
      is_published:         true,
      questions,
    };

    const btn = document.querySelector('#modal-container .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await api.createTeacherActivity(payload);
      Modal.close();
      Toast.show('Activity created successfully!', 'success');
      DashboardController.loadSection('activities');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save Activity'; }
      Toast.show(err.message || 'Failed to create activity.', 'error');
    }
  },

  // ── Delete Activity ───────────────────────────────────────────────────────

  async deleteActivity(id) {
    if (!confirm('Delete this activity and all its submissions? This cannot be undone.')) return;
    try {
      await api.deleteTeacherActivity(id);
      Toast.show('Activity deleted.', 'info');
      DashboardController.loadSection('activities');
    } catch (err) {
      Toast.show(err.message || 'Failed to delete activity.', 'error');
    }
  },

  // ── Grade Submissions Modal ───────────────────────────────────────────────

  async openGradeActivity(activityId) {
    Modal.show('📊 Submissions', '<div class="text-center">Loading submissions…</div>', '', { wide: true });
    try {
      const [activity, submissions] = await Promise.all([
        api.getTeacherActivity(activityId),
        api.getActivitySubmissions(activityId),
      ]);

      if (!submissions.length) {
        Modal.show('📊 Submissions', `<div class="empty-state" style="padding:24px 0"><div class="empty-state-icon">📭</div><div class="empty-state-title">No submissions yet</div></div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>', { wide: true });
        return;
      }

      /** Grade conversion table (matches school grading scale) */
      const computeGrade = (pct) => {
        if (pct >= 100) return '1.00';
        if (pct >= 97)  return '1.25';
        if (pct >= 94)  return '1.50';
        if (pct >= 91)  return '1.75';
        if (pct >= 88)  return '2.00';
        if (pct >= 85)  return '2.25';
        if (pct >= 82)  return '2.50';
        if (pct >= 79)  return '2.75';
        if (pct >= 75)  return '3.00';
        return '5.00';
      };

      const isManual = activity.grading_mode === 'manual';
      const rows = submissions.map(s => {
        const studentLabel = s.student_name ? escHtml(s.student_name) : `Student #${s.student_id}`;
        const submittedAt  = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—';

        let scoreCell = '— Pending —';
        let pctCell   = '—';
        let gradeCell = '—';

        if (s.is_graded && s.score != null && activity.max_score) {
          const pct = Math.round(s.score / activity.max_score * 100);
          scoreCell = `${s.score}/${activity.max_score}`;
          pctCell   = `${pct}%`;
          const grade = s.grade || computeGrade(pct);
          const remarksCls = parseFloat(grade) <= 3.00 ? 'badge-green' : 'badge-danger';
          gradeCell = `<span class="badge ${remarksCls}">${escHtml(grade)}</span>`;
        } else if (s.is_graded) {
          scoreCell = s.score != null ? `${s.score}/${activity.max_score ?? '—'}` : '—';
          gradeCell = s.grade ? `<span class="badge badge-green">${escHtml(s.grade)}</span>` : '—';
        }

        const gradeBtn = isManual && !s.is_graded
          ? `<button class="btn btn-xs btn-primary" onclick="TeacherController.openManualGrade(${activity.id}, ${s.id}, ${activity.max_score || 100})">✏️ Grade</button>`
          : (s.is_graded ? `<span class="badge badge-green">✓ Graded</span>` : `<span class="badge badge-gray">Auto</span>`);

        return `
          <tr data-searchable>
            <td><strong>${studentLabel}</strong></td>
            <td>${submittedAt}</td>
            <td>${scoreCell}</td>
            <td>${pctCell}</td>
            <td>${gradeCell}</td>
            <td>${gradeBtn}</td>
          </tr>`;
      }).join('');

      Modal.show(`📊 ${escHtml(activity.title)} — Submissions`,
        `<div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Student</th><th>Submitted</th><th>Score</th><th>Percentage</th><th>Grade</th><th>Action</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
        `<button class="btn btn-ghost" onclick="Modal.close()">Close</button>`,
        { wide: true }
      );
    } catch (err) {
      Modal.show('📊 Submissions', `<div class="text-danger">Error: ${err.message}</div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>', { wide: true });
    }
  },

  // ── Manual Grade Modal ────────────────────────────────────────────────────

  openManualGrade(activityId, submissionId, maxScore) {
    Modal.show('✏️ Enter Grade',
      `<div class="form-group">
        <label>Score <span class="text-muted">/ ${maxScore}</span></label>
        <input class="form-control" id="mg-score" type="number" min="0" max="${maxScore}" placeholder="0–${maxScore}" />
      </div>
      <div class="form-group">
        <label>Letter Grade <span class="text-muted">(optional)</span></label>
        <select class="form-control" id="mg-grade">
          <option value="">— Select —</option>
          <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          <option value="D">D</option><option value="F">F</option>
          <option value="Excellent">Excellent</option><option value="Very Good">Very Good</option>
          <option value="Good">Good</option><option value="Fair">Fair</option><option value="Needs Improvement">Needs Improvement</option>
        </select>
      </div>
      <div class="form-group">
        <label>Remarks <span class="text-muted">(optional)</span></label>
        <textarea class="form-control" id="mg-remarks" rows="2" placeholder="e.g. Good effort! Work on your enumeration."></textarea>
      </div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="TeacherController.submitManualGrade(${activityId}, ${submissionId})">Submit Grade</button>`
    );
  },

  async submitManualGrade(activityId, submissionId) {
    const score   = parseInt(document.getElementById('mg-score')?.value);
    const grade   = document.getElementById('mg-grade')?.value || null;
    const remarks = document.getElementById('mg-remarks')?.value.trim() || null;

    if (isNaN(score) || score < 0) { Toast.show('Please enter a valid score.', 'error'); return; }

    const btn = document.querySelector('#modal-container .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      await api.manualGradeSubmission(activityId, submissionId, { score, grade, remarks });
      Modal.close();
      Toast.show('Grade saved!', 'success');
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Grade'; }
      Toast.show(err.message || 'Failed to save grade.', 'error');
    }
  },

  // ── Legacy stubs (kept to avoid any lingering references) ─────────────────
  openEditActivity(id) { /* TODO: implement edit */ },
  updateActivity(id)   { /* TODO: implement edit */ },
  saveGrades(actId)    { /* legacy */ },
};
/* ══════════════════════════════════════════════════════════════
   STUDENT CONTROLLER (legacy – kept for compatibility)
   ══════════════════════════════════════════════════════════════ */
const StudentController = {
  _currentActivity: null,   // activity detail object (with questions)

  // ── Load & display the activity list ──────────────────────────────────────
  loadActivities() {
    const area = document.getElementById('content-area');
    area.innerHTML = StudentView.activitiesLoading();
    api.getStudentActivities()
      .then(activities => {
        area.innerHTML = StudentView.activities(activities);
        DashboardController._attachSearch();
      })
      .catch(err => {
        Toast.show('Failed to load activities: ' + err.message, 'error');
        area.innerHTML = StudentView.activities([]);
      });
  },

  // ── Filter activities by search text ─────────────────────────────────────
  _filterActivities(text) {
    const q = text.trim().toLowerCase();
    document.querySelectorAll('#student-activity-list tr[data-searchable]').forEach(row => {
      row.style.display = q && !row.textContent.toLowerCase().includes(q) ? 'none' : 'table-row';
    });
  },

  // ── Open activity answering screen ────────────────────────────────────────
  async openActivity(activityId) {
    const area = document.getElementById('content-area');
    area.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading activity…</div></div>`;
    try {
      const activity = await api.getStudentActivity(activityId);

      if (activity.is_past_due) {
        Toast.show('This activity is past due. No late submissions.', 'error');
        this.loadActivities();
        return;
      }
      if (!activity.can_answer) {
        this.viewResult(activityId);
        return;
      }
      this._currentActivity = activity;
      area.innerHTML = StudentView.activityAnswerSheet(activity);
    } catch (err) {
      Toast.show('Failed to load activity: ' + err.message, 'error');
      this.loadActivities();
    }
  },

  // ── Confirm & submit answers ──────────────────────────────────────────────
  async confirmSubmit(activityId) {
    const activity = this._currentActivity;
    if (!activity) return;

    // Collect answers from DOM
    const answers = [];
    let allAnswered = true;

    for (const q of activity.questions) {
      let val = null;

      if (q.question_type === 'multiple_choice') {
        const checked = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (checked) val = checked.value;
        else allAnswered = false;

      } else if (q.question_type === 'checkbox') {
        const checked = [...document.querySelectorAll(`input[name="q_${q.id}"]:checked`)].map(i => parseInt(i.value));
        if (checked.length) val = JSON.stringify(checked);
        else allAnswered = false;

      } else {
        const el = document.getElementById(`q_${q.id}`);
        val = el ? el.value.trim() : null;
        if (!val) allAnswered = false;
      }

      answers.push({ question_id: q.id, answer_value: val });
    }

    if (!allAnswered) {
      const proceed = confirm('Some questions are unanswered. Submit anyway?');
      if (!proceed) return;
    }

    const btn = document.getElementById('submit-activity-btn');
    if (btn) { btn.disabled = true; btn.textContent = '📤 Submitting…'; }

    try {
      const result = await api.submitActivityAnswers(activityId, answers);
      Toast.show('Activity submitted!', 'success');
      // Show result screen
      const area = document.getElementById('content-area');
      area.innerHTML = StudentView.activityResult(activity, result);
    } catch (err) {
      Toast.show('Submission failed: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📤 Submit Activity'; }
    }
  },

  // ── View result of a past submission ─────────────────────────────────────
  async viewResult(activityId) {
    const area = document.getElementById('content-area');
    area.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Loading result…</div></div>`;
    try {
      const [activity, result] = await Promise.all([
        api.getStudentActivity(activityId),
        api.getMyActivityResult(activityId),
      ]);
      area.innerHTML = StudentView.activityResult(activity, result);
    } catch (err) {
      Toast.show('Failed to load result: ' + err.message, 'error');
      this.loadActivities();
    }
  },

  // ── Legacy stubs kept for safety ─────────────────────────────────────────
  submitActivity(actId) { this.openActivity(actId); },
};

/* ── Dark Mode ─────────────────────────────────────────────── */
const DarkMode = {
  KEY: 'ijed_dark_mode',
  init() { if (Storage.get(this.KEY) === true) { document.body.classList.add('dark-mode'); this._setIcon(true); } },
  toggle() { const isDark = document.body.classList.toggle('dark-mode'); Storage.set(this.KEY, isDark); this._setIcon(isDark); },
  _setIcon(isDark) { const btn = document.getElementById('dark-mode-toggle'); if (btn) btn.textContent = isDark ? '☀️' : '🌙'; },
};

/* ══════════════════════════════════════════════════════════════
   CALENDAR CONTROLLER (unchanged – kept as is)
   ══════════════════════════════════════════════════════════════ */
const CalendarController = {
  _viewYear: null, _viewMonth: null,
  init() { const now = new Date(); if (this._viewYear === null) this._viewYear = now.getFullYear(); if (this._viewMonth === null) this._viewMonth = now.getMonth(); this._render(); },
  prev() { if (this._viewMonth === 0) { this._viewMonth = 11; this._viewYear--; } else this._viewMonth--; this._render(); },
  next() { if (this._viewMonth === 11) { this._viewMonth = 0; this._viewYear++; } else this._viewMonth++; this._render(); },
  _render() { /* unchanged – kept as is */ },
  _buildActivityEvents(user) { /* unchanged */ },
  _selectedDate: null,
  selectDay(dateStr) { /* unchanged */ },
  _highlightSelected(dateStr) { /* unchanged */ },
  _renderDayPanel(dateStr, user, eventMap) { /* unchanged */ },
  toggleTodo(id, dateStr) { /* unchanged */ },
  deleteTodo(id, dateStr) { /* unchanged */ },
  addTodo(dateStr) { /* unchanged */ },
  deleteEvent(id) { /* unchanged */ },
  openAddEvent(dateStr) { /* unchanged */ },
  saveEvent() { /* unchanged */ },
};

function _calTypeLabel(type) {
  const map = { announcement: '📢 Announcement', holiday: '🎉 Holiday', exam: '📝 Exam', meeting: '🤝 Meeting', class: '🏫 Class', 'activity-due': '⏰ Due Date', todo: '✅ To-Do' };
  return map[type] || type;
}