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
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
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
    localStorage.setItem("lms_user", JSON.stringify({
      id: data.user_id,
      role: data.role,
      full_name: data.full_name,
    }));
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

  /**
   * @param {Object} params - { role, is_active, search, page, page_size }
   */
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
    return this._request("POST", "/admin/teachers", { user_id, employee_id, specialization, contact_number });
  }

  async assignTeacherToClass({ teacher_id, class_id, subject_id, schedule }) {
    return this._request("POST", "/admin/teachers/assign-class", {
      teacher_id, class_id, subject_id, schedule,
    });
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

  async createSection({ name, class_id }) {
    return this._request("POST", "/admin/sections", { name, class_id });
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

  // ── Activities ────────────────────────────────────────────────────────────

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
}

// ── Example dashboard bootstrap (paste into your admin.js / dashboard.js) ───
/*
const api = new LMSAdminAPI("http://localhost:8000");

document.addEventListener("DOMContentLoaded", async () => {
  if (!api.isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const stats = await api.getDashboardStats();
    document.getElementById("total-users").textContent    = stats.total_users;
    document.getElementById("total-teachers").textContent = stats.total_teachers;
    document.getElementById("total-students").textContent = stats.total_students;
    document.getElementById("total-modules").textContent  = stats.total_modules;

    // Recent users table
    const tbody = document.getElementById("recent-users-body");
    stats.recent_users.forEach(u => {
      tbody.innerHTML += `
        <tr>
          <td>${u.first_name} ${u.last_name}</td>
          <td>${u.email}</td>
          <td><span class="badge badge-${u.role.name}">${u.role.name}</span></td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>`;
    });
  } catch (err) {
    console.error("Dashboard load error:", err.message);
  }
});
*/
