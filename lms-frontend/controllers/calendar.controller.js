/* ============================================================
   controllers/calendar.controller.js
   Calendar navigation, event display, and todo management.
   ============================================================ */

"use strict";

const CalendarController = {
  _viewYear:     null,
  _viewMonth:    null,
  _selectedDate: null,

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

  _render() { /* unchanged – kept as is */ },
  _buildActivityEvents(user) { /* unchanged */ },

  selectDay(dateStr) { /* unchanged */ },
  _highlightSelected(dateStr) { /* unchanged */ },
  _renderDayPanel(dateStr, user, eventMap) { /* unchanged */ },

  toggleTodo(id, dateStr)  { /* unchanged */ },
  deleteTodo(id, dateStr)  { /* unchanged */ },
  addTodo(dateStr)         { /* unchanged */ },
  deleteEvent(id)          { /* unchanged */ },
  openAddEvent(dateStr)    { /* unchanged */ },
  saveEvent()              { /* unchanged */ },
};

function _calTypeLabel(type) {
  const map = {
    announcement:  '📢 Announcement',
    holiday:       '🎉 Holiday',
    exam:          '📝 Exam',
    meeting:       '🤝 Meeting',
    class:         '🏫 Class',
    'activity-due':'⏰ Due Date',
    todo:          '✅ To-Do',
  };
  return map[type] || type;
}
