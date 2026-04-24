/**
 * lms-admin-api.js
 * Drop this into your IJED-HCJ frontend and import/reference in your HTML.
 *
 * Usage:
 *   <script src="lms-admin-api.js"></script>
 *   const api = new LMSAdminAPI("http://localhost:8000");
 *   await api.login("admin@lms.edu", "Admin@1234");
 *   const stats = await api.getDashboardStats();
 */

class LMSAdminAPI {
  /**
   * @param {string} baseURL - e.g. "http://localhost:8000"
   */
  constructor(baseURL = "http://localhost:8000") {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.token = localStorage.getItem("lms_token") || null;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _headers(extra = {}) {
    const h = { "Content-Type": "application/json", ...extra };
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  async _request(method, path, body = null) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseURL}${path}`, opts);

    if (res.status === 401) {
      this._clearToken();
      throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  _saveToken(token) {
    this.token = token;
    localStorage.setItem("lms_token", token);
    // Also store the token in the session object for reload
    const session = this.getCurrentUser();
    if (session) {
      session._token = token;
      localStorage.setItem("ijla_session", JSON.stringify(session));
    }
  }

  _clearToken() {
    this.token = null;
    localStorage.removeItem("lms_token");
    localStorage.removeItem("lms_user");
  }

  isLoggedIn() {
    return !!this.token;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(email, password) {
    const data = await this._request("POST", "/auth/login", { email, password });
    this._saveToken(data.access_token);

    const userPayload = {
      id:        data.user_id,
      role:      data.role,
      full_name: data.full_name,
      name:      data.full_name,
      _token:    data.access_token,
    };

    localStorage.setItem("lms_user", JSON.stringify(userPayload));
    localStorage.setItem("ijla_session", JSON.stringify(userPayload));

    return data;
  }

  logout() {
    this._clearToken();
  }

  getCurrentUser() {
    const raw = localStorage.getItem("lms_user");
    return raw ? JSON.parse(raw) : null;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboardStats() {
    return this._request("GET", "/admin/dashboard/stats");
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getUsers(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && q.append(k, v));
    return this._request("GET", `/admin/users?${q}`);
  }

  async getUser(id) {
    return this._request("GET", `/admin/users/${id}`);
  }

  async createUser({ email, password, first_name, last_name, role_id }) {
    return this._request("POST", "/admin/users", { email, password, first_name, last_name, role_id });
  }

  async updateUser(id, fields) {
    return this._request("PUT", `/admin/users/${id}`, fields);
  }

  async deleteUser(id) {
    return this._request("DELETE", `/admin/users/${id}`);
  }

  async getRecentUsers(limit = 10) {
    return this._request("GET", `/admin/users/recent?limit=${limit}`);
  }

  // ── Teachers ──────────────────────────────────────────────────────────────

  async getTeachers() {
    return this._request("GET", "/admin/teachers");
  }

  async getTeacher(id) {
    return this._request("GET", `/admin/teachers/${id}`);
  }

  async createTeacherProfile({ user_id, employee_id, specialization, contact_number }) {
    return this._request("POST", "/admin/teachers", {
      user_id, employee_id, specialization, contact_number,
    });
  }

  async assignTeacherToClass({ teacher_id, class_id, subject_id, schedule }) {
    return this._request("POST", "/admin/teachers/assign-class", {
      teacher_id, class_id, subject_id, schedule,
    });
  }

  async getTeacherByUserId(userId) {
    return this._request("GET", `/admin/teachers/by-user/${userId}`);
  }

  async updateTeacherProfile(teacherId, data) {
    return this._request("PUT", `/admin/teachers/${teacherId}`, data);
  }

  async updateTeacherAssignment(assignmentId, data) {
    return this._request("PUT", `/admin/teachers/assignments/${assignmentId}`, data);
  }

  async deleteTeacherAssignment(assignmentId) {
    return this._request("DELETE", `/admin/teachers/assignments/${assignmentId}`);
  }

  // ── Students ──────────────────────────────────────────────────────────────

  async getStudents() {
    return this._request("GET", "/admin/students");
  }

  async getStudent(id) {
    return this._request("GET", `/admin/students/${id}`);
  }

  async createStudentProfile({ user_id, student_number, contact_number, guardian_name, guardian_contact }) {
    return this._request("POST", "/admin/students", {
      user_id, student_number, contact_number, guardian_name, guardian_contact,
    });
  }

  async getStudentsBySection(sectionId) {
    return this._request("GET", `/admin/students/by-section/${sectionId}`);
  }

  async assignStudentToSection({ student_id, section_id }) {
    return this._request("POST", "/admin/students/assign-section", { student_id, section_id });
  }

  async getStudentSubjectEnrollments(studentId) {
    return this._request("GET", `/admin/students/${studentId}/subjects`);
  }

  async enrollStudentSubjects(studentId, subjectIds) {
    return this._request("POST", `/admin/students/${studentId}/subjects`, { subject_ids: subjectIds });
  }

  async unenrollStudentSubject(studentId, subjectId) {
    return this._request("DELETE", `/admin/students/${studentId}/subjects/${subjectId}`);
  }

  // ── Classes ───────────────────────────────────────────────────────────────

  async getClasses() {
    return this._request("GET", "/admin/classes");
  }

  async createClass({ name, grade_level, school_year }) {
    return this._request("POST", "/admin/classes", { name, grade_level, school_year });
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  async getSections() {
    return this._request("GET", "/admin/sections");
  }

  async getSection(id) {
    return this._request("GET", `/admin/sections/${id}`);
  }

  async createSection({ name, class_id }) {
    return this._request("POST", "/admin/sections", { name, class_id });
  }

  async updateSection(id, data) {
    return this._request("PUT", `/admin/sections/${id}`, data);
  }

  async deleteSection(id) {
    return this._request("DELETE", `/admin/sections/${id}`);
  }

  // ── Subjects ──────────────────────────────────────────────────────────────

  async getSubjects() {
    return this._request("GET", "/admin/subjects");
  }

  async createSubject({ name, description }) {
    return this._request("POST", "/admin/subjects", { name, description });
  }

  // ── Modules ───────────────────────────────────────────────────────────────

  async getModules({ class_id, subject_id } = {}) {
    const q = new URLSearchParams();
    if (class_id)   q.append("class_id", class_id);
    if (subject_id) q.append("subject_id", subject_id);
    return this._request("GET", `/admin/modules?${q}`);
  }

  async getModule(id) {
    return this._request("GET", `/admin/modules/${id}`);
  }

  async createModule({ title, description, class_id, subject_id, order, is_published }) {
    return this._request("POST", "/admin/modules", {
      title, description, class_id, subject_id, order, is_published,
    });
  }

  async updateModule(id, fields) {
    return this._request("PUT", `/admin/modules/${id}`, fields);
  }

  async deleteModule(id) {
    return this._request("DELETE", `/admin/modules/${id}`);
  }

  // ── Activities (admin) ────────────────────────────────────────────────────

  async getActivities(module_id) {
    return this._request("GET", `/admin/activities?module_id=${module_id}`);
  }

  async createActivity({ title, description, activity_type, module_id, max_score, due_date, is_published }) {
    return this._request("POST", "/admin/activities", {
      title, description, activity_type, module_id, max_score, due_date, is_published,
    });
  }

  async updateActivity(id, fields) {
    return this._request("PUT", `/admin/activities/${id}`, fields);
  }

  async deleteActivity(id) {
    return this._request("DELETE", `/admin/activities/${id}`);
  }

  // ── Teacher Portal ────────────────────────────────────────────────────────

  async getMySubjects() {
    return this._request("GET", "/teacher/me/subjects");
  }

  async getClassStudents(classId) {
    return this._request("GET", `/teacher/me/class/${classId}/students`);
  }

  async uploadSubjectMaterial(subjectId, formData) {
    const res = await fetch(`${this.baseURL}/teacher/me/subjects/${subjectId}/materials`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getMyModules(subject_id = null) {
    const q = subject_id ? `?subject_id=${subject_id}` : "";
    return this._request("GET", `/teacher/me/modules${q}`);
  }

  async deleteMyModule(id) {
    return this._request("DELETE", `/teacher/me/modules/${id}`);
  }

  async uploadModuleFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseURL}/teacher/me/modules/upload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async createMyModule({ title, subject_id, description, term, file_url, file_name, is_published = true }) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("subject_id", subject_id);
    if (description) formData.append("description", description);
    if (term) formData.append("term", term);
    if (file_url) formData.append("file_url", file_url);
    if (file_name) formData.append("file_name", file_name);
    formData.append("is_published", is_published);

    const res = await fetch(`${this.baseURL}/teacher/me/modules`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Teacher Activities ────────────────────────────────────────────────────

  /**
   * Create a full activity with questions and choices.
   * @param {Object} payload - matches ActivityCreateV2 schema
   * @param {string} payload.title
   * @param {number} payload.module_id
   * @param {number} payload.subject_id
   * @param {string} payload.activity_type  - quiz | long_quiz | task_performance | exam | lab_exercise | assignment | other
   * @param {string} payload.format_type    - multiple_choice | checkbox | enumeration | freeform | assignment | hybrid
   * @param {string} payload.grading_mode   - auto | manual
   * @param {string} [payload.instructions]
   * @param {string} [payload.start_date]   - ISO string
   * @param {string} [payload.due_date]     - ISO string
   * @param {Array}  payload.questions      - array of question objects
   */
  async createTeacherActivity(payload) {
    return this._request("POST", "/teacher/me/activities", payload);
  }

  /**
   * List activities created by the logged-in teacher.
   * @param {Object} [filters]
   * @param {number} [filters.module_id]
   * @param {number} [filters.subject_id]
   */
  async getTeacherActivities({ module_id, subject_id } = {}) {
    const q = new URLSearchParams();
    if (module_id)  q.append("module_id", module_id);
    if (subject_id) q.append("subject_id", subject_id);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return this._request("GET", `/teacher/me/activities${qs}`);
  }

  /**
   * Get one activity including all questions, choices, and correct answers (teacher only).
   * @param {number} id
   */
  async getTeacherActivity(id) {
    return this._request("GET", `/teacher/me/activities/${id}`);
  }

  /**
   * Update an activity. Pass a questions array to fully replace all questions.
   * @param {number} id
   * @param {Object} payload - partial ActivityUpdateV2
   */
  async updateTeacherActivity(id, payload) {
    return this._request("PUT", `/teacher/me/activities/${id}`, payload);
  }

  /**
   * Delete an activity and all its submissions.
   * @param {number} id
   */
  async deleteTeacherActivity(id) {
    return this._request("DELETE", `/teacher/me/activities/${id}`);
  }

  /**
   * Get all student submissions for one activity.
   * @param {number} activityId
   */
  async getActivitySubmissions(activityId) {
    return this._request("GET", `/teacher/me/activities/${activityId}/submissions`);
  }

  /**
   * Manually grade a submission (for freeform / hybrid / assignment activities).
   * @param {number} activityId
   * @param {number} submissionId
   * @param {{ score: number, grade?: string, remarks?: string }} gradeData
   */
  async manualGradeSubmission(activityId, submissionId, gradeData) {
    return this._request(
      "POST",
      `/teacher/me/activities/${activityId}/submissions/${submissionId}/grade`,
      gradeData
    );
  }

  // ── Student Portal ────────────────────────────────────────────────────────

  async getStudentSubjects() {
    return this._request("GET", "/student/me/subjects");
  }

  async getStudentModules(subject_id = null) {
    const q = subject_id ? `?subject_id=${subject_id}` : "";
    return this._request("GET", `/student/me/modules${q}`);
  }

  /**
   * Get published activities for the student's enrolled subjects.
   * Correct answers are never included in the response.
   * @param {number} [subject_id] - optional filter
   */
  async getStudentActivities(subject_id = null) {
    const q = subject_id ? `?subject_id=${subject_id}` : "";
    return this._request("GET", `/student/me/activities${q}`);
  }

  /**
   * Get one activity with questions for answering (no correct answers exposed).
   * @param {number} id
   */
  async getStudentActivity(id) {
    return this._request("GET", `/student/me/activities/${id}`);
  }

  /**
   * Submit answers for an activity.
   * Auto-graded formats return a score immediately.
   * Manual formats return is_graded: false until the teacher grades.
   * @param {number} activityId
   * @param {Array<{ question_id: number, answer_value: string }>} answers
   */
  async submitActivityAnswers(activityId, answers) {
    return this._request("POST", `/student/me/activities/${activityId}/submit`, { answers });
  }

  /**
   * Get the student's own submission result for an activity.
   * @param {number} activityId
   */
  async getMyActivityResult(activityId) {
    return this._request("GET", `/student/me/activities/${activityId}/result`);
  }

  // ── Legacy / utility ──────────────────────────────────────────────────────

  async request(method, path, body) {
    const url = this.baseURL + '/api/v1' + path;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: body ? JSON.stringify(body) : undefined
    };
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  }
}