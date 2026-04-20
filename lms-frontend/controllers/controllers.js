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

  showPage(page) {
    document.getElementById('page-landing').classList.toggle('hidden', page !== 'landing');
    document.getElementById('page-login').classList.toggle('hidden',   page !== 'login');
    document.getElementById('page-app').classList.toggle('hidden',     page !== 'app');
  },

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
   ══════════════════════════════════════════════════════════════ */
const AuthController = {
  selectedRole: 'admin',

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
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    App.showPage('landing');
    Toast.show('You have been signed out.', 'info');
  },
};

/* ══════════════════════════════════════════════════════════════
   DASHBOARD CONTROLLER
   ══════════════════════════════════════════════════════════════ */
const DashboardController = {
  currentUser:    null,
  currentSection: 'dashboard',

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
      if (id === 'manage-teachers') return AdminView.manageTeachers();
      if (id === 'manage-students') return AdminView.manageStudents();
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
      if (id === 'activities')  return StudentView.activities(user);
      if (id === 'my-grades')   return StudentView.myGrades(user);
    }
    return `<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-title">Section Coming Soon</div></div>`;
  },

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

    // MANAGE USERS
    if (sectionId === 'manage-users') {
      Promise.all([
        api.getUsers({ page: 1, page_size: 100 }),
        api.getTeachers(),
        api.getStudents(),
        api.getSections(),
      ]).then(([usersRes, teachersRes, studentsRes, sectionsRes]) => {
        const allUsers = usersRes.items || [];
        const teachers = teachersRes.items || [];
        const students = studentsRes.items || [];
        const sections = sectionsRes.items || [];

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

        // Activate all tab by default
        ['all','teachers','students','sections','audit'].forEach(t => {
          const pane = document.getElementById(`um-pane-${t}`);
          if (pane) pane.style.display = t === 'all' ? '' : 'none';
          const btn = document.querySelector(`.um-tab[data-tab="${t}"]`);
          if (btn) btn.classList.toggle('active', t === 'all');
        });
      }).catch(err => {
        console.error('Failed to load manage users data:', err);
        Toast.show('Could not load user data from server.', 'error');
      });
      return;
    }

    // MANAGE TEACHERS
    if (sectionId === 'manage-teachers') {
      Promise.all([
        api.getUsers({ page: 1, page_size: 100 }),
        api.getTeachers(),
        api.getStudents(),
        api.getSections(),
      ]).then(([usersRes, teachersRes, studentsRes, sectionsRes]) => {
        const allUsers = usersRes.items || [];
        const teachers = teachersRes.items || [];
        const students = studentsRes.items || [];
        const sections = sectionsRes.items || [];

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

        // Activate teachers tab
        ['all','teachers','students','sections','audit'].forEach(t => {
          const pane = document.getElementById(`um-pane-${t}`);
          if (pane) pane.style.display = t === 'teachers' ? '' : 'none';
          const btn = document.querySelector(`.um-tab[data-tab="${t}"]`);
          if (btn) btn.classList.toggle('active', t === 'teachers');
        });
      }).catch(err => {
        console.error('Failed to load manage teachers data:', err);
        Toast.show('Could not load teacher data from server.', 'error');
      });
      return;
    }

    // MANAGE STUDENTS
    if (sectionId === 'manage-students') {
      Promise.all([
        api.getUsers({ page: 1, page_size: 100 }),
        api.getTeachers(),
        api.getStudents(),
        api.getSections(),
      ]).then(([usersRes, teachersRes, studentsRes, sectionsRes]) => {
        const allUsers = usersRes.items || [];
        const teachers = teachersRes.items || [];
        const students = studentsRes.items || [];
        const sections = sectionsRes.items || [];

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

        // Activate students tab
        ['all','teachers','students','sections','audit'].forEach(t => {
          const pane = document.getElementById(`um-pane-${t}`);
          if (pane) pane.style.display = t === 'students' ? '' : 'none';
          const btn = document.querySelector(`.um-tab[data-tab="${t}"]`);
          if (btn) btn.classList.toggle('active', t === 'students');
        });
      }).catch(err => {
        console.error('Failed to load manage students data:', err);
        Toast.show('Could not load student data from server.', 'error');
      });
      return;
    }

    if (AdminController._pendingTab) {
      AdminController._switchTab(AdminController._pendingTab);
      AdminController._pendingTab = null;
    }

    this._attachSearch();
  },

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
   ══════════════════════════════════════════════════════════════ */
const AdminController = {
  _pendingTab: null,

  _switchTab(tab) {
    ['all','teachers','students','sections','audit'].forEach(t => {
      const pane = document.getElementById(`um-pane-${t}`);
      const btn  = document.querySelector(`.um-tab[data-tab="${t}"]`);
      if (pane) pane.style.display = t === tab ? '' : 'none';
      if (btn)  btn.classList.toggle('active', t === tab);
    });
  },

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

  async _loadClassesDropdown(selectId) {
    try {
      const data = await api.getClasses();
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Skip for now —</option>' +
        data.items.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    } catch (e) { /* silent */ }
  },

  _toggleRoleFields() {
    const role = document.getElementById('f-role').value;
    document.getElementById('teacher-fields').style.display = role === 'teacher' ? '' : 'none';
    document.getElementById('student-fields').style.display = role === 'student' ? '' : 'none';
    if (role === 'teacher') AdminController._loadClassesDropdown('f-class-id');
  },

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

  viewStudentProfile(id) { /* legacy – kept as is */ },

  openAssignSchedule(teacherId) { /* legacy – kept as is */ },
  saveSchedule(teacherId) { /* legacy */ },
  deleteSchedule(schId, teacherId) { /* legacy */ },
  viewSectionSchedule(sectionId) { /* legacy */ },
  openAddSection() { /* legacy */ },
  saveNewSection() { /* legacy */ },
  openEditSection(id) { /* legacy */ },
  saveEditSection(id) { /* legacy */ },
  deleteSection(id) { /* legacy */ },

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

  exportCSV(type) { /* legacy */ },
  openImportCSV() { /* legacy */ },
  processImportCSV() { /* legacy */ },
  clearAuditLog() { /* legacy */ },
  saveSettings() { /* legacy */ },
  changePassword() { /* legacy */ },
};

/* ══════════════════════════════════════════════════════════════
   TEACHER CONTROLLER
   ══════════════════════════════════════════════════════════════ */
const TeacherController = {
  _getSubjectOptions(selected = '') {
    return subjectModel.getByTeacher(DashboardController.currentUser.id)
      .map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${escHtml(s.name)}</option>`)
      .join('');
  },

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
      <div class="form-row"><div class="form-group"><label>Term</label><select class="form-control" id="m-term"><option value="">— Select Term —</option><option value="1st">1st Term</option><option value="2nd">2nd Term</option><option value="3rd">3rd Term</option><option value="4th">4th Term</option></select></div><div class="form-group"><label>PDF File</label><input class="form-control" id="m-file" type="file" accept=".pdf" /><div id="m-file-status" style="font-size:12px;margin-top:4px;color:var(--gray-400)">No file selected</div></div></div>`,
      `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="TeacherController.saveModule()">Upload Module</button>`
    );
    if (window._selectedSubjectId) {
      setTimeout(() => { const select = document.getElementById('m-subject'); if (select) select.value = window._selectedSubjectId; delete window._selectedSubjectId; }, 100);
    }
    document.getElementById('m-file').addEventListener('change', function() {
      const status = document.getElementById('m-file-status');
      status.textContent = this.files[0] ? `Selected: ${this.files[0].name}` : 'No file selected';
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
        file_url = uploaded.file_url;
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

  openEditModule(id) { /* legacy */ },
  updateModule(id) { /* legacy */ },
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
  openAddActivity() { /* legacy */ },
  saveActivity() { /* legacy */ },
  openEditActivity(id) { /* legacy */ },
  updateActivity(id) { /* legacy */ },
  deleteActivity(id) { /* legacy */ },
  openGradeActivity(actId) { /* legacy */ },
  saveGrades(actId) { /* legacy */ },

  async viewStudentsForSubject(subjectId, classId, subjectName) {
    Modal.show(`Students – ${escHtml(subjectName)}`, '<div class="text-center">Loading students…</div>', '');
    try {
      const students = await api.getClassStudents(classId);
      if (!students.length) {
        Modal.show(`Students – ${escHtml(subjectName)}`, '<div class="text-muted">No students enrolled in this class.</div>', '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
        return;
      }
      const studentList = students.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee"><div><strong>${escHtml(s.user?.first_name + ' ' + s.user?.last_name || s.name)}</strong><br><span class="text-sm">${escHtml(s.user?.email || s.email)}</span></div><div><span class="badge ${s.user?.is_active ? 'badge-green' : 'badge-red'}">${s.user?.is_active ? 'Active' : 'Inactive'}</span></div></div>`).join('');
      Modal.show(`Students – ${escHtml(subjectName)}`, `<div class="student-list">${studentList}</div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
    } catch (err) {
      Modal.show(`Students – ${escHtml(subjectName)}`, `<div class="text-danger">Could not load students: ${err.message}</div>`, '<button class="btn btn-ghost" onclick="Modal.close()">Close</button>');
    }
  },

  openAddModuleForSubject(subjectId, classId) {
    window._selectedSubjectId = subjectId;
    this.openAddModule();
  },
};

/* ══════════════════════════════════════════════════════════════
   STUDENT CONTROLLER (unchanged)
   ══════════════════════════════════════════════════════════════ */
const StudentController = {
  submitActivity(actId) { /* legacy */ },
  confirmSubmit(actId) { /* legacy */ },
};

/* ── Dark Mode ─────────────────────────────────────────────── */
const DarkMode = {
  KEY: 'ijed_dark_mode',
  init() { if (Storage.get(this.KEY) === true) { document.body.classList.add('dark-mode'); this._setIcon(true); } },
  toggle() { const isDark = document.body.classList.toggle('dark-mode'); Storage.set(this.KEY, isDark); this._setIcon(isDark); },
  _setIcon(isDark) { const btn = document.getElementById('dark-mode-toggle'); if (btn) btn.textContent = isDark ? '☀️' : '🌙'; },
};

/* ══════════════════════════════════════════════════════════════
   CALENDAR CONTROLLER (unchanged)
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