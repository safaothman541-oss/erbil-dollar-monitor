const fs = require('fs');
const path = require('path');
const config = require('../config');

class SecondBrain {
  constructor() {
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(config.STATE.DIR)) {
      fs.mkdirSync(config.STATE.DIR, { recursive: true });
    }
  }

  loadFile(filePath, defaultVal = []) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.warn(`[SecondBrain] Load error on ${filePath}:`, e.message);
    }
    return defaultVal;
  }

  saveFile(filePath, data) {
    this.ensureDirs();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- Expenses ---
  addExpense(item) {
    const expenses = this.loadFile(config.STATE.EXPENSES, []);
    const entry = {
      id: expenses.length + 1,
      amount: item.amount,
      currency: item.currency || 'IQD',
      category: item.category || 'کەسی و جۆراوجۆر',
      note: item.note || '',
      date: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('en-CA', { timeZone: config.LOCATION.TIMEZONE })
    };
    expenses.unshift(entry);
    this.saveFile(config.STATE.EXPENSES, expenses);
    return entry;
  }

  getExpensesSummary() {
    const expenses = this.loadFile(config.STATE.EXPENSES, []);
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const thisMonth = expenses.filter(e => (e.date || '').startsWith(currentMonth));
    let totalIQD = 0;
    let totalUSD = 0;
    const byCategory = {};

    for (const e of thisMonth) {
      if (e.currency === 'USD') totalUSD += e.amount;
      else totalIQD += e.amount;

      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    return {
      count: thisMonth.length,
      totalIQD,
      totalUSD,
      byCategory,
      recent: expenses.slice(0, 5)
    };
  }

  // --- Tasks ---
  addTask(taskItem) {
    const tasks = this.loadFile(config.STATE.TASKS, []);
    const entry = {
      id: tasks.length + 1,
      task: taskItem.task,
      dueDate: taskItem.dueDate || null,
      priority: taskItem.priority || 'ئاسایی',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    tasks.unshift(entry);
    this.saveFile(config.STATE.TASKS, tasks);
    return entry;
  }

  completeTask(id) {
    const tasks = this.loadFile(config.STATE.TASKS, []);
    const task = tasks.find(t => t.id === Number(id));
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.saveFile(config.STATE.TASKS, tasks);
      return task;
    }
    return null;
  }

  getPendingTasks() {
    const tasks = this.loadFile(config.STATE.TASKS, []);
    return tasks.filter(t => t.status === 'pending');
  }

  // --- Ideas / Architecture Insights ---
  addIdea(ideaItem) {
    const ideas = this.loadFile(config.STATE.SECOND_BRAIN, []);
    const entry = {
      id: ideas.length + 1,
      title: ideaItem.title,
      analysis: ideaItem.analysis || '',
      tags: ideaItem.tags || [],
      createdAt: new Date().toISOString()
    };
    ideas.unshift(entry);
    this.saveFile(config.STATE.SECOND_BRAIN, ideas);
    return entry;
  }

  getRecentIdeas(limit = 5) {
    const ideas = this.loadFile(config.STATE.SECOND_BRAIN, []);
    return ideas.slice(0, limit);
  }
}

module.exports = new SecondBrain();
