/* ============================================================
   controllers/student.controller.js
   All student actions: activity list, answer sheet, submission,
   result view, and subject accordion.
   ============================================================ */

"use strict";

const StudentController = {
  _currentActivity: null,

  // ── Subject accordion ─────────────────────────────────────

  _attachSubjectAccordion() {
    const _closeCard = (c) => {
      const body = c.querySelector('.subject-accordion-body');
      body.style.maxHeight  = body.scrollHeight + 'px';
      requestAnimationFrame(() => {
        body.style.transition = 'max-height 0.3s ease';
        body.style.maxHeight  = '0';
      });
      c.classList.remove('accordion-open');
      const chevron = c.querySelector('.accordion-chevron');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    };

    const _openCard = (c) => {
      const body = c.querySelector('.subject-accordion-body');
      body.style.transition = 'max-height 0.35s ease';
      body.style.maxHeight  = body.scrollHeight + 'px';
      body.addEventListener('transitionend', () => {
        if (c.classList.contains('accordion-open')) body.style.maxHeight = 'none';
      }, { once: true });
      c.classList.add('accordion-open');
      const chevron = c.querySelector('.accordion-chevron');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    };

    document.querySelectorAll('.student-subject-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        const isOpen = card.classList.contains('accordion-open');
        document.querySelectorAll('.student-subject-card.accordion-open').forEach(c => _closeCard(c));
        if (!isOpen) _openCard(card);
      });
    });
  },

  // ── Activities list ───────────────────────────────────────

  loadActivities() {
    const area = document.getElementById('content-area');
    area.innerHTML = StudentView.activitiesLoading();

    api.getStudentActivities()
      .then(async activities => {
        // For activities that are submitted but have no score data in the list
        // response (backend returns submission: null), fetch result in parallel
        // to get the real score/grade for display in the table.
        const submittedWithNoScore = activities.filter(a => {
          const isSubmitted =
            a.already_submitted === true ||
            a.status === 'submitted'     ||
            a.status === 'graded'        ||
            a.can_answer === false;
          const hasScoreAlready =
            (a.submission && a.submission.score != null) ||
            (a.my_submission && a.my_submission.score != null);
          return isSubmitted && !hasScoreAlready;
        });

        if (submittedWithNoScore.length) {
          const results = await Promise.allSettled(
            submittedWithNoScore.map(a =>
              api.getMyActivityResult(a.id)
                .then(r => ({ id: a.id, result: r }))
                .catch(() => ({ id: a.id, result: null }))
            )
          );

          // Merge result data back onto the activity objects
          const resultMap = {};
          results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.result) {
              resultMap[r.value.id] = r.value.result;
            }
          });

          activities = activities.map(a => {
            const res = resultMap[a.id];
            if (!res) return a;
            // Attach result as submission so the view can render score/grade
            return {
              ...a,
              submission: {
                submitted_at: res.submitted_at || null,
                is_graded:    res.is_graded    || res.score != null,
                score:        res.score        ?? null,
                max_score:    res.max_score    ?? a.max_score ?? null,
                grade:        res.grade        ?? null,
                remarks:      res.remarks      ?? null,
              },
            };
          });
        }

        area.innerHTML = StudentView.activities(activities);
        DashboardController._attachSearch();
      })
      .catch(err => {
        Toast.show('Failed to load activities: ' + err.message, 'error');
        area.innerHTML = StudentView.activities([]);
      });
  },

  _filterActivities(text) {
    const q = text.trim().toLowerCase();
    document.querySelectorAll('#student-activity-list tr[data-searchable]').forEach(row => {
      row.style.display = q && !row.textContent.toLowerCase().includes(q) ? 'none' : 'table-row';
    });
  },

  // ── Open activity answer sheet ────────────────────────────

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

  // ── Confirm & submit answers ──────────────────────────────

  async confirmSubmit(activityId) {
    const activity = this._currentActivity;
    if (!activity) return;

    const answers     = [];
    let allAnswered   = true;

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
      const area = document.getElementById('content-area');
      area.innerHTML = StudentView.activityResult(activity, result);
    } catch (err) {
      Toast.show('Submission failed: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📤 Submit Activity'; }
    }
  },

  // ── View result of a past submission ─────────────────────

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

  // ── Legacy stub ───────────────────────────────────────────
  submitActivity(actId) { this.openActivity(actId); },

  /**
   * Fire-and-forget: mark a module as read to update the dashboard progress counter.
   * Called via onclick on every "Open 📖" module button.
   * @param {number} moduleId
   */
  trackModuleRead(moduleId) {
    api.markModuleRead(moduleId).catch(() => {
      // Silently ignore failures — this is non-critical tracking
    });
  },

  // ── Attendance view ───────────────────────────────────────

  loadAttendance() {
    const area = document.getElementById('content-area');
    area.innerHTML = StudentView.attendanceLoading();

    api.getMyAttendance()
      .then(data => {
        area.innerHTML = StudentView.attendance(data);
      })
      .catch(err => {
        Toast.show('Failed to load attendance: ' + err.message, 'error');
        area.innerHTML = StudentView.attendance([]);
      });
  },
};