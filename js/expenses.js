// ═══════════════════════════════════════════════════
// LIFE OS — expenses.js
// Expense log, category budgets, monthly breakdown
// ═══════════════════════════════════════════════════

const EXPENSE_CATEGORIES = ['food', 'transport', 'health', 'entertainment', 'subscriptions', 'misc'];
const EXPENSE_ICONS = { food: '🍽', transport: '🚗', health: '💊', entertainment: '🎮', subscriptions: '📱', misc: '📦' };

function renderExpenses(container) {
  const month = thisMonth();
  _renderExpensesView(container, month);
}

function _renderExpensesView(container, month) {
  const expenses = LS.getJSON(`lifeOS:expense:${month}`) || [];
  const goals = getGoals();
  const budgets = goals.budgets || {};

  const totals = {};
  EXPENSE_CATEGORIES.forEach(c => totals[c] = 0);
  expenses.forEach(e => {
    const cat = (e.category || '').toLowerCase();
    totals[cat] = (totals[cat] || 0) + e.amount;
  });
  const totalSpent = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);

  // 6-month trend data
  const trendData = [];
  const trendLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0, 7);
    const monthExpenses = LS.getJSON(`lifeOS:expense:${m}`) || [];
    trendData.push(monthExpenses.reduce((s, e) => s + e.amount, 0));
    trendLabels.push(m.slice(5));
  }

  container.innerHTML = `
    <div class="module">
      <div class="module-header">
        <div class="module-title">Expenses <span>& Budget</span></div>
        <div class="module-date">${month}</div>
      </div>

      <div class="expenses-summary">
        <div class="expenses-total">
          <div class="expenses-total-val">₹${totalSpent.toLocaleString()}</div>
          <div class="expenses-total-label">spent this month</div>
        </div>
        <div class="expenses-budget">
          <div class="expenses-budget-val">₹${totalBudget.toLocaleString()}</div>
          <div class="expenses-budget-label">monthly budget</div>
        </div>
        <div class="expenses-remaining ${totalSpent > totalBudget ? 'over' : ''}">
          <div class="expenses-remaining-val">₹${Math.abs(totalBudget - totalSpent).toLocaleString()}</div>
          <div class="expenses-remaining-label">${totalSpent > totalBudget ? 'over budget' : 'remaining'}</div>
        </div>
      </div>

      <div class="expense-categories">
        ${EXPENSE_CATEGORIES.map(cat => {
          const spent = totals[cat] || 0;
          const budget = budgets[cat] || 0;
          const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const over = budget > 0 && spent > budget;
          const catDisplay = cat.charAt(0).toUpperCase() + cat.slice(1);
          return `
            <div class="expense-cat-row ${over ? 'over-budget' : ''}">
              <div class="expense-cat-icon">${EXPENSE_ICONS[cat]}</div>
              <div class="expense-cat-info">
                <div class="expense-cat-name">${catDisplay}</div>
                <div class="progress-bar-wrap small">
                  <div class="progress-bar ${over ? 'danger' : ''}" style="width:${pct}%"></div>
                </div>
              </div>
              <div class="expense-cat-amounts">
                <span class="expense-spent">₹${spent.toLocaleString()}</span>
                ${budget > 0 ? `<span class="expense-budget-amt">/ ₹${budget.toLocaleString()}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="expense-add-section">
        <button class="btn primary small" id="expense-add-btn">+ Add Expense</button>
      </div>

      <div id="expense-form" style="display:none;" class="expense-form">
        <div class="form-row">
          <div class="form-group">
            <label>Amount (₹)</label>
            <input type="number" id="expense-amount" placeholder="0" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="expense-category">
              ${EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="expense-date" value="${today()}">
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="expense-desc" placeholder="What did you spend on?">
        </div>
        <div class="flex gap-8">
          <button class="btn primary small" id="expense-save-btn">Add</button>
          <button class="btn small" id="expense-cancel-btn">Cancel</button>
        </div>
      </div>

      <div class="expense-list">
        <div class="section-subtitle">Recent Transactions</div>
        ${expenses.length === 0
          ? '<div class="empty-state">No expenses logged this month.</div>'
          : expenses.slice().reverse().slice(0, 20).map(e => {
            const cat = (e.category || '').toLowerCase();
            const catDisplay = cat.charAt(0).toUpperCase() + cat.slice(1);
            return `
            <div class="expense-item">
              <span class="expense-item-icon">${EXPENSE_ICONS[cat] || '📦'}</span>
              <div class="expense-item-info">
                <div class="expense-item-desc">${e.description || e.note || catDisplay}</div>
                <div class="expense-item-meta">${catDisplay} · ${e.date}</div>
              </div>
              <span class="expense-item-amount">₹${e.amount.toLocaleString()}</span>
              <button class="btn danger small expense-delete-btn" data-id="${e.id}">×</button>
            </div>`;
          }).join('')}
      </div>

      <div class="chart-section">
        <div class="chart-title">6-Month Spending</div>
        ${makeSVGBar(trendData, totalBudget, 520, 100, trendLabels)}
      </div>
    </div>
  `;

  container.querySelector('#expense-add-btn').addEventListener('click', () => {
    const form = container.querySelector('#expense-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
  });

  container.querySelector('#expense-cancel-btn').addEventListener('click', () => {
    container.querySelector('#expense-form').style.display = 'none';
  });

  container.querySelector('#expense-save-btn').addEventListener('click', () => {
    const amount = parseFloat(container.querySelector('#expense-amount').value);
    if (!amount || amount <= 0) return;
    const expense = {
      id: Date.now(),
      amount,
      category: container.querySelector('#expense-category').value.toLowerCase(),
      description: container.querySelector('#expense-desc').value.trim() || null,
      date: container.querySelector('#expense-date').value || today()
    };
    const expenseMonth = expense.date.slice(0, 7);
    const expenses = LS.getJSON(`lifeOS:expense:${expenseMonth}`) || [];
    expenses.push(expense);
    LS.setJSON(`lifeOS:expense:${expenseMonth}`, expenses);
    updateSidebarBadges();
    _renderExpensesView(container, month);
  });

  container.querySelectorAll('.expense-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const expenses = LS.getJSON(`lifeOS:expense:${month}`) || [];
      LS.setJSON(`lifeOS:expense:${month}`, expenses.filter(e => e.id !== id));
      updateSidebarBadges();
      _renderExpensesView(container, month);
    });
  });
}
