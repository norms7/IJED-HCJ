/* ============================================================
   models/models.js
   Data layer — localStorage as mock database
   Each model handles its own CRUD and seed data.
   ============================================================ */

"use strict";

/* ── UserModel ──────────────────────────────────────────────
   Handles all user-related data operations.
   Roles: admin | teacher | student
   Soft-delete via isActive flag (never physically removed).
   ────────────────────────────────────────────────────────── */
class UserModel {
  constructor() {
    this.KEY = 'ijla_users';
    this._seed();
  }

  /** Seed default users on first load */
  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const users = [
      { id: 'u1', name: 'Maria Santos',   email: 'admin@ijla.edu',    password: 'admin123',   role: 'admin',   isActive: true, createdAt: '2024-01-10' },
      { id: 'u2', name: 'Juan dela Cruz', email: 'teacher1@ijla.edu', password: 'teacher123', role: 'teacher', subject: 'Mathematics', isActive: true, createdAt: '2024-01-11' },
      { id: 'u3', name: 'Ana Reyes',      email: 'teacher2@ijla.edu', password: 'teacher123', role: 'teacher', subject: 'Science',     isActive: true, createdAt: '2024-01-12' },
      { id: 'u4', name: 'Pedro Bautista', email: 'teacher3@ijla.edu', password: 'teacher123', role: 'teacher', subject: 'English',     isActive: true, createdAt: '2024-02-01' },
      { id: 'u5', name: 'Sofia Garcia',   email: 'student1@ijla.edu', password: 'student123', role: 'student', grade: 'Grade 7', section: 'Sampaguita', isActive: true, createdAt: '2024-01-15' },
      { id: 'u6', name: 'Miguel Torres',  email: 'student2@ijla.edu', password: 'student123', role: 'student', grade: 'Grade 7', section: 'Sampaguita', isActive: true, createdAt: '2024-01-15' },
      { id: 'u7', name: 'Isabella Lim',   email: 'student3@ijla.edu', password: 'student123', role: 'student', grade: 'Grade 8', section: 'Rosal',      isActive: true, createdAt: '2024-01-16' },
      { id: 'u8', name: 'Carlos Mendoza', email: 'student4@ijla.edu', password: 'student123', role: 'student', grade: 'Grade 8', section: 'Rosal',      isActive: true, createdAt: '2024-01-17' },
    ];
    this._save(users);
  }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }

  /** Returns only active users */
  getAll()         { return this._all().filter(u => u.isActive); }
  /** Returns all users including soft-deleted (for admin views) */
  getAllIncluding() { return this._all(); }
  getById(id)      { return this._all().find(u => u.id === id) || null; }
  getByRole(role)  { return this._all().filter(u => u.role === role && u.isActive); }

  findByCredentials(email, password) {
    return this._all().find(u => u.email === email && u.password === password && u.isActive) || null;
  }

  add(userData) {
    const all = this._all();
    const user = {
      ...userData,
      id: 'u' + Date.now(),
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    all.push(user);
    this._save(all);
    return user;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(u => u.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  /** Soft delete — sets isActive:false */
  softDelete(id) { return this.update(id, { isActive: false }); }
}

/* ── SubjectModel ──────────────────────────────────────────
   Manages academic subjects assigned to teachers.
   ────────────────────────────────────────────────────────── */
class SubjectModel {
  constructor() {
    this.KEY = 'ijla_subjects';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const subjects = [
      { id: 's1', name: 'Mathematics', teacherId: 'u2', color: '#8b0020', icon: '➕', description: 'Algebra, Geometry and Number Theory', isActive: true },
      { id: 's2', name: 'Science',     teacherId: 'u3', color: '#2e6b3e', icon: '🔬', description: 'Biology, Chemistry and Physics',    isActive: true },
      { id: 's3', name: 'English',     teacherId: 'u4', color: '#1a4a8a', icon: '📖', description: 'Grammar, Literature and Communication', isActive: true },
      { id: 's4', name: 'Filipino',    teacherId: 'u2', color: '#c04a00', icon: '🇵🇭', description: 'Wika at Panitikan',               isActive: true },
      { id: 's5', name: 'MAPEH',       teacherId: 'u3', color: '#6a0dad', icon: '🎨', description: 'Music, Arts, PE and Health',        isActive: true },
    ];
    this._save(subjects);
  }

  _all()    { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d)  { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll()  { return this._all().filter(s => s.isActive); }
  getById(id)           { return this._all().find(s => s.id === id) || null; }
  getByTeacher(tid)     { return this._all().filter(s => s.teacherId === tid && s.isActive); }

  add(data) {
    const all = this._all();
    const subject = { ...data, id: 's' + Date.now(), isActive: true };
    all.push(subject);
    this._save(all);
    return subject;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }
}

/* ── ModuleModel ───────────────────────────────────────────
   Learning modules uploaded by teachers.
   Supports soft delete via isActive flag.
   ────────────────────────────────────────────────────────── */
class ModuleModel {
  constructor() {
    this.KEY = 'ijla_modules';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const modules = [
      { id: 'm1', title: 'Introduction to Algebra',  subjectId: 's1', teacherId: 'u2', description: 'Basic concepts of algebraic expressions and equations. Students will learn to solve linear equations and apply them to real-world problems.', fileLabel: 'algebra_intro.pdf',       week: 1, isActive: true, createdAt: '2024-01-20' },
      { id: 'm2', title: 'Quadratic Equations',       subjectId: 's1', teacherId: 'u2', description: 'Solving quadratic equations using factoring, completing the square, and the quadratic formula.',                                             fileLabel: 'quadratic.pdf',           week: 2, isActive: true, createdAt: '2024-01-27' },
      { id: 'm3', title: 'Cell Biology Basics',       subjectId: 's2', teacherId: 'u3', description: 'An introduction to cell structure and function. Covers prokaryotic and eukaryotic cells.',                                                   fileLabel: 'cell_bio.pdf',            week: 1, isActive: true, createdAt: '2024-01-20' },
      { id: 'm4', title: 'Photosynthesis',             subjectId: 's2', teacherId: 'u3', description: 'The process by which plants convert light energy into chemical energy stored in glucose.',                                                   fileLabel: 'photosynthesis.pdf',      week: 2, isActive: true, createdAt: '2024-01-28' },
      { id: 'm5', title: 'Parts of Speech',            subjectId: 's3', teacherId: 'u4', description: 'Nouns, Verbs, Adjectives, Adverbs, Pronouns, Prepositions, Conjunctions and Interjections.',                                               fileLabel: 'parts_speech.pdf',        week: 1, isActive: true, createdAt: '2024-01-21' },
      { id: 'm6', title: 'Sentence Structure',         subjectId: 's3', teacherId: 'u4', description: 'Simple, compound and complex sentences. Clause types and sentence analysis.',                                                               fileLabel: 'sentence_structure.pdf',  week: 3, isActive: true, createdAt: '2024-02-05' },
    ];
    this._save(modules);
  }

  _all()    { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d)  { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll()  { return this._all().filter(m => m.isActive); }
  getById(id)           { return this._all().find(m => m.id === id) || null; }
  getBySubject(sid)     { return this._all().filter(m => m.subjectId === sid && m.isActive); }
  getByTeacher(tid)     { return this._all().filter(m => m.teacherId === tid && m.isActive); }

  add(data) {
    const all = this._all();
    const module = {
      ...data,
      id: 'm' + Date.now(),
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    all.push(module);
    this._save(all);
    return module;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(m => m.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  softDelete(id) { return this.update(id, { isActive: false }); }
}

/* ── ActivityModel ─────────────────────────────────────────
   Activities and quizzes created by teachers.
   Types: quiz | assignment | essay
   ────────────────────────────────────────────────────────── */
class ActivityModel {
  constructor() {
    this.KEY = 'ijla_activities';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const activities = [
      { id: 'a1', title: 'Algebra Quiz #1',            subjectId: 's1', teacherId: 'u2', type: 'quiz',       description: '10-item multiple choice on basic algebra.',                                        dueDate: '2024-02-10', points: 10, isActive: true, createdAt: '2024-01-25' },
      { id: 'a2', title: 'Linear Equations Worksheet', subjectId: 's1', teacherId: 'u2', type: 'assignment', description: 'Solve the given 15 linear equations and show complete solutions.',                 dueDate: '2024-02-15', points: 20, isActive: true, createdAt: '2024-01-30' },
      { id: 'a3', title: 'Cell Diagram Labeling',       subjectId: 's2', teacherId: 'u3', type: 'assignment', description: 'Label all parts of the animal and plant cells on the provided diagram.',          dueDate: '2024-02-12', points: 15, isActive: true, createdAt: '2024-01-26' },
      { id: 'a4', title: 'Science Quiz: Cell Biology',  subjectId: 's2', teacherId: 'u3', type: 'quiz',       description: '20-item quiz covering cell structure and function.',                              dueDate: '2024-02-20', points: 20, isActive: true, createdAt: '2024-02-01' },
      { id: 'a5', title: 'Essay: My Favorite Book',     subjectId: 's3', teacherId: 'u4', type: 'essay',      description: 'Write a 300-word essay about your favorite book and why you recommend it.',       dueDate: '2024-02-18', points: 25, isActive: true, createdAt: '2024-02-02' },
    ];
    this._save(activities);
  }

  _all()    { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d)  { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll()  { return this._all().filter(a => a.isActive); }
  getById(id)       { return this._all().find(a => a.id === id) || null; }
  getBySubject(sid) { return this._all().filter(a => a.subjectId === sid && a.isActive); }
  getByTeacher(tid) { return this._all().filter(a => a.teacherId === tid && a.isActive); }

  add(data) {
    const all = this._all();
    const activity = {
      ...data,
      id: 'a' + Date.now(),
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    all.push(activity);
    this._save(all);
    return activity;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  softDelete(id) { return this.update(id, { isActive: false }); }
}

/* ── GradeModel ────────────────────────────────────────────
   Grade records linking students → activities.
   score / maxScore used to compute percentage and letter grade.
   ────────────────────────────────────────────────────────── */
class GradeModel {
  constructor() {
    this.KEY = 'ijla_grades';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const grades = [
      { id: 'g1', studentId: 'u5', activityId: 'a1', subjectId: 's1', score: 9,  maxScore: 10, remarks: 'Excellent',           gradedAt: '2024-02-11' },
      { id: 'g2', studentId: 'u5', activityId: 'a2', subjectId: 's1', score: 18, maxScore: 20, remarks: 'Good job',             gradedAt: '2024-02-16' },
      { id: 'g3', studentId: 'u5', activityId: 'a3', subjectId: 's2', score: 13, maxScore: 15, remarks: 'Well done',            gradedAt: '2024-02-13' },
      { id: 'g4', studentId: 'u5', activityId: 'a5', subjectId: 's3', score: 22, maxScore: 25, remarks: 'Great essay',          gradedAt: '2024-02-19' },
      { id: 'g5', studentId: 'u6', activityId: 'a1', subjectId: 's1', score: 7,  maxScore: 10, remarks: 'Keep it up',           gradedAt: '2024-02-11' },
      { id: 'g6', studentId: 'u6', activityId: 'a3', subjectId: 's2', score: 10, maxScore: 15, remarks: 'Needs improvement',    gradedAt: '2024-02-13' },
      { id: 'g7', studentId: 'u7', activityId: 'a4', subjectId: 's2', score: 18, maxScore: 20, remarks: 'Excellent',           gradedAt: '2024-02-21' },
      { id: 'g8', studentId: 'u8', activityId: 'a2', subjectId: 's1', score: 12, maxScore: 20, remarks: 'Study harder',         gradedAt: '2024-02-16' },
    ];
    this._save(grades);
  }

  _all()    { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d)  { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll()  { return this._all(); }
  getByStudent(sid)  { return this._all().filter(g => g.studentId === sid); }
  getByActivity(aid) { return this._all().filter(g => g.activityId === aid); }
  getBySubject(sid)  { return this._all().filter(g => g.subjectId === sid); }

  add(data) {
    const all = this._all();
    const grade = {
      ...data,
      id: 'g' + Date.now(),
      gradedAt: new Date().toISOString().split('T')[0],
    };
    all.push(grade);
    this._save(all);
    return grade;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(g => g.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }
}

/* ── CalendarEventModel ────────────────────────────────────
   Stores calendar events per role.
   Types: announcement | class | activity-due | exam | holiday | meeting | todo
   visibility: 'all' | 'teacher' | 'student' | userId
   ────────────────────────────────────────────────────────── */
class CalendarEventModel {
  constructor() {
    this.KEY = 'ijed_calendar_events';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const events = [
      // Admin announcements
      { id: 'ce1', title: 'School Foundation Day',      date: `${y}-${m}-15`, type: 'holiday',      color: '#d4a017', visibility: 'all',     createdBy: 'u1', description: 'No classes. Celebration activities in the gymnasium.' },
      { id: 'ce2', title: 'Faculty Meeting',             date: `${y}-${m}-10`, type: 'meeting',      color: '#1a4a8a', visibility: 'teacher', createdBy: 'u1', description: 'Monthly faculty meeting. Attendance required for all teachers.' },
      { id: 'ce3', title: 'Quarterly Exam Week Starts',  date: `${y}-${m}-22`, type: 'exam',         color: '#8b0020', visibility: 'all',     createdBy: 'u1', description: 'First day of quarterly examinations. Review your schedules.' },
      { id: 'ce4', title: 'Card Giving Day',             date: `${y}-${m}-28`, type: 'announcement', color: '#2e6b3e', visibility: 'all',     createdBy: 'u1', description: 'Report cards will be distributed to parents/guardians.' },
      { id: 'ce5', title: 'Enrollment Period Ends',      date: `${y}-${m}-05`, type: 'announcement', color: '#c04a00', visibility: 'all',     createdBy: 'u1', description: 'Last day of late enrollment for the current semester.' },
      // Teacher class schedules
      { id: 'ce6', title: 'Mathematics – Grade 7',       date: `${y}-${m}-08`, type: 'class',        color: '#8b0020', visibility: 'u2',      createdBy: 'u2', description: 'Room 201 | 7:00–8:00 AM | Bring graphing materials.' },
      { id: 'ce7', title: 'Filipino – Grade 8',          date: `${y}-${m}-09`, type: 'class',        color: '#c04a00', visibility: 'u2',      createdBy: 'u2', description: 'Room 203 | 9:00–10:00 AM' },
      { id: 'ce8', title: 'Science – Grade 7',           date: `${y}-${m}-08`, type: 'class',        color: '#2e6b3e', visibility: 'u3',      createdBy: 'u3', description: 'Lab Room | 10:00–11:00 AM | Lab coats required.' },
      { id: 'ce9', title: 'English – Grade 8',           date: `${y}-${m}-10`, type: 'class',        color: '#1a4a8a', visibility: 'u4',      createdBy: 'u4', description: 'Room 205 | 1:00–2:00 PM' },
      // Student activity deadlines (auto-generated from activities; these are extras)
      { id: 'ce10', title: 'Submit Math Project',         date: `${y}-${m}-18`, type: 'activity-due', color: '#6d0019', visibility: 'student', createdBy: 'u1', description: 'Group project on geometry shapes. Submit to Google Classroom.' },
      { id: 'ce11', title: 'Science Lab Report Due',      date: `${y}-${m}-20`, type: 'activity-due', color: '#2e6b3e', visibility: 'student', createdBy: 'u3', description: 'Written lab report on the photosynthesis experiment.' },
      { id: 'ce12', title: 'Remedial Class – Math',       date: `${y}-${m}-12`, type: 'class',        color: '#8b0020', visibility: 'student', createdBy: 'u2', description: 'Room 201 | 3:00–4:00 PM | For students who need extra help.' },
    ];
    this._save(events);
  }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll() { return this._all(); }
  getById(id) { return this._all().find(e => e.id === id) || null; }

  /** Get events visible to a user based on role and userId */
  getForUser(userId, role) {
    return this._all().filter(e =>
      e.visibility === 'all' ||
      e.visibility === role ||
      e.visibility === userId
    );
  }

  getByDate(date, userId, role) {
    return this.getForUser(userId, role).filter(e => e.date === date);
  }

  add(data) {
    const all = this._all();
    const event = { ...data, id: 'ce' + Date.now() };
    all.push(event);
    this._save(all);
    return event;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  delete(id) {
    const all = this._all().filter(e => e.id !== id);
    this._save(all);
  }
}

/* ── TodoModel ─────────────────────────────────────────────
   Daily to-do items per user.
   ────────────────────────────────────────────────────────── */
class TodoModel {
  constructor() {
    this.KEY = 'ijed_todos';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todos = [
      { id: 't1', userId: 'u1', text: 'Review new student enrollment applications',  date: today, done: false },
      { id: 't2', userId: 'u1', text: 'Prepare agenda for faculty meeting',           date: today, done: false },
      { id: 't3', userId: 'u1', text: 'Send announcement about Foundation Day',       date: today, done: true  },
      { id: 't4', userId: 'u2', text: 'Prepare Math quiz for Grade 7',                date: today, done: false },
      { id: 't5', userId: 'u2', text: 'Check and grade submitted worksheets',         date: today, done: false },
      { id: 't6', userId: 'u2', text: 'Update module for Quadratic Equations',        date: today, done: true  },
      { id: 't7', userId: 'u3', text: 'Set up lab materials for Science class',       date: today, done: false },
      { id: 't8', userId: 'u3', text: 'Return graded cell diagram activities',        date: today, done: false },
      { id: 't9', userId: 'u4', text: 'Review essay submissions',                     date: today, done: false },
      { id: 't10', userId: 'u5', text: 'Study for Math quiz',                         date: today, done: false },
      { id: 't11', userId: 'u5', text: 'Complete Science worksheet',                  date: today, done: false },
      { id: 't12', userId: 'u5', text: 'Read Module: Parts of Speech',                date: today, done: true  },
      { id: 't13', userId: 'u6', text: 'Submit linear equations assignment',          date: today, done: false },
      { id: 't14', userId: 'u7', text: 'Prepare for Science quiz tomorrow',           date: today, done: false },
      { id: 't15', userId: 'u8', text: 'Resubmit Math worksheet with corrections',   date: today, done: false },
    ];
    this._save(todos);
  }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }

  getForUserDate(userId, date) {
    return this._all().filter(t => t.userId === userId && t.date === date);
  }

  add(userId, text, date) {
    const all = this._all();
    const todo = { id: 't' + Date.now(), userId, text, date, done: false };
    all.push(todo);
    this._save(all);
    return todo;
  }

  toggle(id) {
    const all = this._all();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return;
    all[idx].done = !all[idx].done;
    this._save(all);
  }

  delete(id) {
    this._save(this._all().filter(t => t.id !== id));
  }
}

/* ── Singleton Instances ───────────────────────────────────
   Instantiated once and shared across all controllers/views.
   ────────────────────────────────────────────────────────── */
const userModel     = new UserModel();
const subjectModel  = new SubjectModel();
const moduleModel   = new ModuleModel();
const activityModel = new ActivityModel();
const gradeModel    = new GradeModel();
const calendarModel = new CalendarEventModel();
const todoModel     = new TodoModel();

/* ── SectionModel ──────────────────────────────────────────
   Represents a class section (e.g. Grade 7 – Sampaguita).
   Sections have an adviser (teacher) and enrolled students.
   ────────────────────────────────────────────────────────── */
class SectionModel {
  constructor() {
    this.KEY = 'ijed_sections';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const sections = [
      { id: 'sec1', name: 'Sampaguita', gradeLevel: 'Grade 7', adviserId: 'u2', room: 'Room 101', schoolYear: '2024-2025', isActive: true },
      { id: 'sec2', name: 'Rosal',      gradeLevel: 'Grade 8', adviserId: 'u3', room: 'Room 202', schoolYear: '2024-2025', isActive: true },
      { id: 'sec3', name: 'Gumamela',   gradeLevel: 'Grade 9', adviserId: 'u4', room: 'Room 305', schoolYear: '2024-2025', isActive: true },
    ];
    this._save(sections);
  }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll() { return this._all().filter(s => s.isActive); }
  getById(id) { return this._all().find(s => s.id === id) || null; }
  getByAdviser(tid) { return this._all().filter(s => s.adviserId === tid && s.isActive); }

  add(data) {
    const all = this._all();
    const sec = { ...data, id: 'sec' + Date.now(), isActive: true };
    all.push(sec);
    this._save(all);
    return sec;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  softDelete(id) { return this.update(id, { isActive: false }); }
}

/* ── ScheduleModel ─────────────────────────────────────────
   Weekly schedule entries linking teacher → subject → section.
   day: 'Monday' | 'Tuesday' … | 'Friday'
   ────────────────────────────────────────────────────────── */
class ScheduleModel {
  constructor() {
    this.KEY = 'ijed_schedules';
    this._seed();
  }

  _seed() {
    if (localStorage.getItem(this.KEY)) return;
    const schedules = [
      { id: 'sch1', teacherId: 'u2', subjectId: 's1', sectionId: 'sec1', day: 'Monday',    timeStart: '07:00', timeEnd: '08:00', room: 'Room 201', isActive: true },
      { id: 'sch2', teacherId: 'u2', subjectId: 's1', sectionId: 'sec2', day: 'Monday',    timeStart: '09:00', timeEnd: '10:00', room: 'Room 201', isActive: true },
      { id: 'sch3', teacherId: 'u2', subjectId: 's4', sectionId: 'sec1', day: 'Wednesday', timeStart: '07:00', timeEnd: '08:00', room: 'Room 201', isActive: true },
      { id: 'sch4', teacherId: 'u3', subjectId: 's2', sectionId: 'sec1', day: 'Tuesday',   timeStart: '10:00', timeEnd: '11:00', room: 'Lab Room', isActive: true },
      { id: 'sch5', teacherId: 'u3', subjectId: 's2', sectionId: 'sec2', day: 'Thursday',  timeStart: '10:00', timeEnd: '11:00', room: 'Lab Room', isActive: true },
      { id: 'sch6', teacherId: 'u3', subjectId: 's5', sectionId: 'sec3', day: 'Friday',    timeStart: '08:00', timeEnd: '09:00', room: 'Room 103', isActive: true },
      { id: 'sch7', teacherId: 'u4', subjectId: 's3', sectionId: 'sec1', day: 'Wednesday', timeStart: '13:00', timeEnd: '14:00', room: 'Room 205', isActive: true },
      { id: 'sch8', teacherId: 'u4', subjectId: 's3', sectionId: 'sec2', day: 'Friday',    timeStart: '13:00', timeEnd: '14:00', room: 'Room 205', isActive: true },
    ];
    this._save(schedules);
  }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }
  getAll() { return this._all().filter(s => s.isActive); }
  getById(id) { return this._all().find(s => s.id === id) || null; }
  getByTeacher(tid) { return this._all().filter(s => s.teacherId === tid && s.isActive); }
  getBySection(sid) { return this._all().filter(s => s.sectionId === sid && s.isActive); }
  getBySubject(subId) { return this._all().filter(s => s.subjectId === subId && s.isActive); }

  /** Conflict check: same teacher/room/day/overlapping time */
  hasConflict(data, excludeId = null) {
    return this._all().filter(s => s.isActive && s.id !== excludeId).some(s => {
      if (s.day !== data.day) return false;
      const sameTeacher = s.teacherId === data.teacherId;
      const sameRoom    = s.room === data.room && data.room;
      if (!sameTeacher && !sameRoom) return false;
      // Overlap check
      return data.timeStart < s.timeEnd && data.timeEnd > s.timeStart;
    });
  }

  add(data) {
    const all = this._all();
    const sch = { ...data, id: 'sch' + Date.now(), isActive: true };
    all.push(sch);
    this._save(all);
    return sch;
  }

  update(id, updates) {
    const all = this._all();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this._save(all);
    return all[idx];
  }

  softDelete(id) { return this.update(id, { isActive: false }); }
}

/* ── AuditLogModel ─────────────────────────────────────────
   Immutable audit trail for all admin actions.
   ────────────────────────────────────────────────────────── */
class AuditLogModel {
  constructor() { this.KEY = 'ijed_audit_logs'; }

  _all()   { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
  _save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); }

  log(action, entity, details, adminId) {
    const all = this._all();
    all.unshift({
      id:        'log' + Date.now(),
      action,    // 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'IMPORT'
      entity,    // 'user' | 'section' | 'schedule'
      details,   // human-readable string
      adminId,
      timestamp: new Date().toISOString(),
    });
    // Keep only last 200 logs
    this._save(all.slice(0, 200));
  }

  getAll()           { return this._all(); }
  getRecent(n = 50)  { return this._all().slice(0, n); }
  getByAdmin(id)     { return this._all().filter(l => l.adminId === id); }
}

/* ── Extend singleton instances with new models ─────────── */
const sectionModel  = new SectionModel();
const scheduleModel = new ScheduleModel();
const auditModel    = new AuditLogModel();
