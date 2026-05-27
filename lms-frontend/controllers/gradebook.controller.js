/* ============================================================
   controllers/gradebook.controller.js
   Digital Gradebook — Teacher role only.
   ============================================================ */

"use strict";

const GradebookController = {

  // ── State ─────────────────────────────────────────────────────────────────
  _subjects:       [],
  _currentClassId: null,
  _currentName:    '',
  _lastExportData: null,

  // ── Entry: load sections list ─────────────────────────────────────────────
  async loadSections() {
    const wrap = document.getElementById('gradebook-sections-wrap');
    try {
      const subjects = await api.getMySubjects();
      this._subjects = subjects || [];

      const sectionCount = new Set((subjects || []).map(s => s.class_id)).size;
      const countEl = document.getElementById('grade-count');
      if (countEl) countEl.textContent = `${sectionCount} section(s) assigned`;

      if (wrap) {
        wrap.innerHTML = TeacherView.gradebookSectionsList(subjects);
        DashboardController._attachSearch();
      }

      // Async student counts per section
      const classIds = [...new Set((subjects || []).map(s => s.class_id))];
      classIds.forEach(classId => {
        api.getClassStudents(classId)
          .then(students => {
            const el = document.getElementById(`student-count-${classId}`);
            if (el) {
              el.textContent = `${students.length} student${students.length !== 1 ? 's' : ''}`;
              el.className = 'badge badge-green';
            }
          })
          .catch(() => {
            const el = document.getElementById(`student-count-${classId}`);
            if (el) { el.textContent = '—'; el.className = 'badge badge-gray'; }
          });
      });

    } catch (err) {
      console.error('[Gradebook] loadSections error:', err);
      if (wrap) wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Failed to load sections</div>
        <div class="empty-state-sub">${escHtml(err.message)}</div>
      </div>`;
      Toast.show('Failed to load gradebook: ' + err.message, 'error');
    }
  },

  // ── Open a section's gradebook ────────────────────────────────────────────
  async openSection(classId, sectionName) {
    this._currentClassId = classId;
    this._currentName    = sectionName;

    const area = document.getElementById('content-area');
    if (!area) { console.error('[Gradebook] #content-area not found'); return; }

    area.innerHTML = `
      <div class="section-header">
        <div class="section-header-left">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="DashboardController.loadSection('grades')" style="padding:4px 8px">← Back</button>
            <div><h2>${escHtml(sectionName)}</h2><p>Loading gradebook…</p></div>
          </div>
        </div>
      </div>
      <div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Building gradebook…</div></div>`;

    try {
      // Subjects that belong to this class — re-fetch if _subjects wasn't loaded yet
      let classSubjects = this._subjects.filter(s => s.class_id === classId);
      if (classSubjects.length === 0) {
        console.warn('[Gradebook] _subjects empty, re-fetching…');
        const allSubjects = await api.getMySubjects().catch(() => []);
        this._subjects = allSubjects;
        classSubjects = allSubjects.filter(s => s.class_id === classId);
      }
      console.log('[Gradebook] classSubjects:', classSubjects);

      // ── Parallel: students + module reads + attendance + activities/modules ──
      const [students, moduleReadsData, attendanceSummary, ...subjectData] = await Promise.all([
        api.getClassStudents(classId).catch(e => { console.warn('[Gradebook] getClassStudents:', e); return []; }),
        api.getClassModuleReads(classId).catch(e => { console.warn('[Gradebook] getClassModuleReads:', e); return { module_reads: {}, total_modules: 0 }; }),
        api.getAttendanceSectionStudents(classId).catch(() => ({ students: [], total_meetings: 0 })),
        ...classSubjects.map(sub =>
          Promise.all([
            api.getTeacherActivities({ subject_id: sub.subject_id }).catch(() => []),
            api.getMyModules(sub.subject_id).catch(() => []),
          ])
        ),
      ]);

      console.log('[Gradebook] students:', students.length, '| moduleReads:', moduleReadsData, '| subjectData chunks:', subjectData.length);

      // Flatten activities and modules, deduplicate by id
      const allActivities = [], allModules = [], seenAct = new Set(), seenMod = new Set();
      subjectData.forEach(([acts, mods]) => {
        acts.forEach(a => { if (!seenAct.has(a.id)) { seenAct.add(a.id); allActivities.push(a); } });
        mods.forEach(m => { if (!seenMod.has(m.id)) { seenMod.add(m.id); allModules.push(m); } });
      });

      // ── Fetch submissions per activity in parallel ────────────────────────
      const activitiesWithSubs = await Promise.all(
        allActivities.map(act =>
          api.getActivitySubmissions(act.id)
            .then(subs => ({ ...act, _submissions: Array.isArray(subs) ? subs : [] }))
            .catch(e => { console.warn('[Gradebook] submissions for act', act.id, e); return { ...act, _submissions: [] }; })
        )
      );

      // Annotate students with real module read + attendance counts
      const readMap = moduleReadsData.module_reads || {};
      const attMap  = {};
      const attTotal = attendanceSummary.total_meetings || 0;
      (attendanceSummary.students || []).forEach(s => { attMap[s.id] = s; });

      const studentsAnnotated = students.map(stu => ({
        ...stu,
        _modulesRead:     readMap[String(stu.id)] ?? readMap[stu.id] ?? 0,
        _attPresent:      attMap[stu.id]?.present  ?? 0,
        _attTotal:        attTotal,
      }));
      console.log('[Gradebook] readMap:', readMap, '| attTotal:', attTotal, '| sample student id:', students[0]?.id);

      this._lastExportData = {
        sectionName,
        students: studentsAnnotated,
        activities: activitiesWithSubs,
        modules: allModules,
        subjects: classSubjects,
      };

      if (area) {
        area.innerHTML = TeacherView.gradebookSection(
          sectionName,
          studentsAnnotated,
          activitiesWithSubs,
          allModules,
          classSubjects,
        );
        DashboardController._attachSearch();
      }

    } catch (err) {
      console.error('[Gradebook] openSection error:', err);
      Toast.show('Failed to load section gradebook: ' + err.message, 'error');
      if (area) area.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error loading gradebook</div>
        <div class="empty-state-sub">${escHtml(err.message)}</div>
        <button class="btn btn-primary mt-3" onclick="DashboardController.loadSection('grades')">← Back to Sections</button>
      </div>`;
    }
  },

  // ── Per-student breakdown modal ───────────────────────────────────────────
  viewStudentBreakdown(studentId, studentName) {
    if (!this._lastExportData) { Toast.show('No gradebook loaded', 'error'); return; }
    const { activities, modules } = this._lastExportData;

    const actRows = activities.map(act => {
      const sub      = act._submissions?.find(s => s.student_id === studentId);
      const score    = sub?.is_graded && sub?.score != null ? sub.score : null;
      const maxScore = act.max_score ?? 0;
      const pct      = score !== null && maxScore > 0 ? Math.round(score / maxScore * 100) : null;
      const statusBadge = !sub
        ? `<span class="badge badge-gray">Not submitted</span>`
        : !sub.is_graded
          ? `<span class="badge badge-gold">Pending grade</span>`
          : `<span class="badge badge-green">Graded</span>`;
      return `<tr>
        <td>${escHtml(act.title)}</td>
        <td><span class="badge badge-maroon" style="font-size:10px">${escHtml(act.activity_type || '')}</span></td>
        <td style="text-align:center">${score !== null ? `${score}/${maxScore}` : '—'}</td>
        <td style="text-align:center">${pct !== null ? `<span class="badge ${pct >= 75 ? 'badge-green' : 'badge-danger'}">${pct}%</span>` : '—'}</td>
        <td>${statusBadge}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-center text-muted">No activities</td></tr>';

    const modRows = modules.map(mod => `<tr>
      <td>${escHtml(mod.title)}</td>
      <td><span class="badge badge-gray" style="font-size:10px" title="Read tracking API pending">—</span></td>
    </tr>`).join('') || '<tr><td colspan="2" class="text-center text-muted">No modules</td></tr>';

    const thStyle = 'padding:8px 10px;text-align:left;color:var(--maroon);font-size:11px;border-bottom:2px solid var(--rose-mid);background:var(--gray-50)';
    const body = `
      <div style="font-weight:600;font-size:15px;margin-bottom:12px;color:var(--maroon)">📋 ${escHtml(studentName)}</div>
      <div style="margin-bottom:8px;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px">Activities</div>
      <div class="table-wrap" style="margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr>
            <th style="${thStyle}">Activity</th><th style="${thStyle}">Type</th>
            <th style="${thStyle};text-align:center">Score</th><th style="${thStyle};text-align:center">%</th>
            <th style="${thStyle}">Status</th>
          </tr></thead>
          <tbody>${actRows}</tbody>
        </table>
      </div>
      <div style="margin-bottom:8px;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px">Modules</div>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr>
            <th style="${thStyle}">Module</th><th style="${thStyle}">Read Status</th>
          </tr></thead>
          <tbody>${modRows}</tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--gray-400);margin-top:8px">ℹ️ Module read status requires a dedicated teacher-side API endpoint (planned).</p>`;

    Modal.show(`Student Breakdown`, body,
      `<button class="btn btn-ghost" onclick="Modal.close()">Close</button>`
    );
  },

  // ── Excel Export ──────────────────────────────────────────────────────────
  async exportSection(sectionName) {
    const data = this._lastExportData;
    if (!data) { Toast.show('No gradebook data to export.', 'error'); return; }

    try {
      await this._ensureSheetJS();
    } catch (e) {
      Toast.show('Could not load Excel library: ' + e.message, 'error');
      return;
    }

    const { students, activities, modules } = data;
    const WEIGHT_ACTIVITIES = 0.60;
    const WEIGHT_MODULES    = 0.40;

    const headerRow = [
      'Student Name', 'LRN / Student No.',
      `Activities Submitted (/${activities.length})`, 'Activity Score %',
      `Modules Read (/${modules.length})`, 'Attendance Present', 'Attendance Total', 'Attendance %',
      'Overall %', 'Final Grade (PH)',
    ];

    const dataRows = students.map(stu => {
      const studentId  = stu.id;
      const fullName   = `${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || `Student #${studentId}`;
      const studentNum = stu.student_number || stu.student_profile?.student_number || '';

      const stuSubs = activities.reduce((acc, act) => {
        const sub = act._submissions?.find(s => s.student_id === studentId);
        if (sub) acc.push({ act, sub });
        return acc;
      }, []);

      let totalEarned = 0, totalPossible = 0;
      stuSubs.forEach(({ act, sub }) => {
        if (sub.is_graded && sub.score != null && act.max_score) {
          totalEarned   += sub.score;
          totalPossible += act.max_score;
        }
      });

      const activityPct   = totalPossible > 0 ? Math.round(totalEarned / totalPossible * 100) : null;
      const readCount     = stu._modulesRead ?? 0;
      const modulePct     = modules.length > 0 ? Math.round((readCount / modules.length) * 100) : 0;
      const attPresent    = stu._attPresent ?? 0;
      const attTotal      = stu._attTotal   ?? 0;
      const attendancePct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

      let overallPct = null;
      if (activityPct !== null || attendancePct !== null) {
        overallPct = Math.round(
          (activityPct  ?? 0) * 0.60 +
           modulePct          * 0.30 +
          (attendancePct ?? 0) * 0.10
        );
      } else if (modules.length > 0) {
        overallPct = Math.round(modulePct * 0.30);
      }

      return [
        fullName, studentNum, stuSubs.length,
        activityPct   !== null ? activityPct   / 100 : '',
        readCount,
        attPresent, attTotal,
        attendancePct !== null ? attendancePct / 100 : '',
        overallPct    !== null ? overallPct    / 100 : '',
        overallPct    !== null ? TeacherView._toPhGrade(overallPct) : '',
      ];
    });

    const actHeaderRow = [
      'Student Name', 'LRN / Student No.',
      ...activities.map(a => `${a.title} (/${a.max_score ?? '?'})`),
      'Total Earned', 'Total Possible', 'Activity %',
    ];
    const actDataRows = students.map(stu => {
      const studentId  = stu.id;
      const fullName   = `${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim();
      const studentNum = stu.student_number || '';
      let totalEarned = 0, totalPossible = 0;
      const scores = activities.map(act => {
        const sub = act._submissions?.find(s => s.student_id === studentId);
        if (sub?.is_graded && sub?.score != null) {
          totalEarned += sub.score; totalPossible += act.max_score ?? 0;
          return sub.score;
        }
        return '';
      });
      return [fullName, studentNum, ...scores, totalEarned || '', totalPossible || '',
        totalPossible > 0 ? totalEarned / totalPossible : ''];
    });

    const XLSX = window.XLSX;
    const wb   = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    ws1['!cols'] = [{ wch:28 },{ wch:18 },{ wch:20 },{ wch:16 },{ wch:18 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:16 }];
    for (let r = 1; r <= dataRows.length; r++) {
      [3, 7, 8].forEach(c => {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (ws1[cell] && ws1[cell].v !== '') ws1[cell].z = '0.00%';
      });
    }
    XLSX.utils.book_append_sheet(wb, ws1, 'Grade Summary');

    const ws2 = XLSX.utils.aoa_to_sheet([actHeaderRow, ...actDataRows]);
    ws2['!cols'] = [{ wch:28 },{ wch:18 }, ...activities.map(() => ({ wch:16 })), { wch:14 },{ wch:14 },{ wch:14 }];
    const lastCol = actHeaderRow.length - 1;
    for (let r = 1; r <= actDataRows.length; r++) {
      const cell = XLSX.utils.encode_cell({ r, c: lastCol });
      if (ws2[cell] && ws2[cell].v !== '') ws2[cell].z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, ws2, 'Activity Breakdown');

    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Final Grade','Range','Description'],
      ['1.00','97–100%','Excellent'],['1.25','93–96%','Very Good'],['1.50','89–92%','Good'],
      ['1.75','85–88%','Above Average'],['2.00','81–84%','Average'],['2.25','77–80%','Below Average'],
      ['2.50','73–76%','Passing'],['2.75','69–72%','Conditional'],['3.00','65–68%','Barely Passing'],
      ['5.00','Below 65%','Failed'],[],
      ['Formula:','',''],
      ['Overall % = (Activity% × 60%) + (Module Read% × 30%) + (Attendance% × 10%)','',''],
    ]);
    ws3['!cols'] = [{ wch:14 },{ wch:16 },{ wch:20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Grade Scale');

    const fileName = `Gradebook_${sectionName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    Toast.show(`Exported: ${fileName}`, 'success');
  },

  _ensureSheetJS() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload  = resolve;
      s.onerror = () => reject(new Error('Failed to load SheetJS.'));
      document.head.appendChild(s);
    });
  },
};