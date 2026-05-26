const STORAGE_KEYS = {
  banks: ['banks', 'fo_banks'],
  transactions: ['transactions', 'fo_txns'],
  transfers: ['transfers', 'fo_transfers'],
  recurringPayments: ['recurringPayments'],
  sipInvestments: ['sipInvestments'],
  loanEMIs: ['loanEMIs'],
  budgets: ['budgets'],
  password: ['fo_password'],
  session: ['fo_session']
};

const DB = {
  get(keys, fallback) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value !== null) return value;
      } catch (_) {}
    }
    return fallback;
  },
  set(keys, value) {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach(key => localStorage.setItem(key, JSON.stringify(value)));
  },
  load() {
    this.banks = this.get(STORAGE_KEYS.banks, []);
    this.txns = this.get(STORAGE_KEYS.transactions, []);
    this.transfers = this.get(STORAGE_KEYS.transfers, []);
    this.recurringPayments = this.get(STORAGE_KEYS.recurringPayments, []);
    this.sipInvestments = this.get(STORAGE_KEYS.sipInvestments, []);
    this.loanEMIs = this.get(STORAGE_KEYS.loanEMIs, []);
    this.budgets = this.get(STORAGE_KEYS.budgets, { monthlyTotal: 0, categories: {}, banks: {} });
    this.password = this.get(STORAGE_KEYS.password, '');
    this.session = this.get(STORAGE_KEYS.session, false);
  },
  save() {
    this.set(STORAGE_KEYS.banks, this.banks);
    this.set(STORAGE_KEYS.transactions, this.txns);
    this.set(STORAGE_KEYS.transfers, this.transfers);
    this.set(STORAGE_KEYS.recurringPayments, this.recurringPayments);
    this.set(STORAGE_KEYS.sipInvestments, this.sipInvestments);
    this.set(STORAGE_KEYS.loanEMIs, this.loanEMIs);
    this.set(STORAGE_KEYS.budgets, this.budgets);
    this.set(STORAGE_KEYS.password, this.password);
    this.set(STORAGE_KEYS.session, this.session);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  DB.load();
  normalizeData();
  bindModalOverlayClose();
  setTopbarDate();
  initFilterMonth();
  populateBankSelects();
  if (DB.session) {
    showApp();
  } else {
    document.getElementById('login-page').classList.remove('hidden');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('login-page').classList.contains('hidden')) {
    doLogin();
  }
});

function normalizeData() {
  DB.budgets = DB.budgets || { monthlyTotal: 0, categories: {}, banks: {} };
  DB.budgets.categories = DB.budgets.categories || {};
  DB.budgets.banks = DB.budgets.banks || {};

  DB.recurringPayments = (DB.recurringPayments || []).map(item => ({
    paidHistory: [],
    status: 'Pending',
    remarks: '',
    reminderBefore: 3,
    ...item
  }));

  DB.sipInvestments = (DB.sipInvestments || []).map(item => ({
    paidHistory: [],
    totalInvestedAmount: 0,
    remarks: '',
    status: 'Active',
    ...item
  }));

  DB.loanEMIs = (DB.loanEMIs || []).map(item => ({
    paidHistory: [],
    remarks: '',
    status: 'Active',
    numberOfEMIsPaid: Number(item.numberOfEMIsPaid || 0),
    numberOfEMIsRemaining: Number(item.numberOfEMIsRemaining || 0),
    remainingLoanAmount: Number(item.remainingLoanAmount || 0),
    totalLoanAmount: Number(item.totalLoanAmount || 0),
    ...item
  }));

  normalizeBankReferences();
  syncRecurringStatuses();
  syncLoanStatuses();
  syncBankCurrents();
  DB.save();
}

function bindModalOverlayClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

function setTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}

function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  if (!user || !pass) {
    err.textContent = 'Enter username and password';
    err.classList.remove('hidden');
    return;
  }

  if (!DB.password) {
    DB.password = pass;
    DB.session = true;
    DB.save();
    err.classList.add('hidden');
    document.getElementById('login-page').classList.add('hidden');
    showApp();
    toast('Login setup completed', 'success');
    return;
  }

  if (pass === DB.password) {
    err.classList.add('hidden');
    DB.session = true;
    DB.save();
    document.getElementById('login-page').classList.add('hidden');
    showApp();
  } else {
    err.textContent = 'Invalid credentials';
    err.classList.remove('hidden');
  }
}

function doLogout() {
  DB.session = false;
  DB.save();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

function showApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  populateBankSelects();
  renderAll();
}

function showChangePassword() {
  document.getElementById('pwd-current').value = '';
  document.getElementById('pwd-new').value = '';
  document.getElementById('pwd-confirm').value = '';
  document.getElementById('pwd-error').classList.add('hidden');
  openModal('modal-pwd');
}

function changePassword() {
  const current = document.getElementById('pwd-current').value;
  const next = document.getElementById('pwd-new').value;
  const confirmPwd = document.getElementById('pwd-confirm').value;
  const err = document.getElementById('pwd-error');
  if (current !== DB.password) return showErr(err, 'Current password incorrect');
  if (next.length < 6) return showErr(err, 'New password must be 6+ characters');
  if (next !== confirmPwd) return showErr(err, 'Passwords do not match');
  DB.password = next;
  DB.save();
  closeModal('modal-pwd');
  toast('Password updated', 'success');
}

function showPage(name, el) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
    page.classList.remove('active');
  });
  const page = document.getElementById('page-' + name);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (el) el.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    banks: 'Banks',
    transactions: 'Transactions',
    transfer: 'Self Transfer',
    recurring: 'Recurring Payments',
    sip: 'SIP / Investments',
    loan: 'Loan EMI',
    budget: 'Budget'
  };
  document.getElementById('page-title').textContent = titles[name] || name;

  const renders = {
    dashboard: renderDashboard,
    banks: renderBanks,
    transactions: () => {
      populateBankFilter();
      renderTransactions();
    },
    transfer: renderTransfers,
    recurring: renderRecurringPayments,
    sip: renderSipInvestments,
    loan: renderLoanEmis,
    budget: renderBudgets
  };
  if (renders[name]) renders[name]();

  if (window.innerWidth <= 768) closeSidebar();
  return false;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

let toastTimer;
function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function fmt(num) {
  return 'Rs ' + Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtCompact(num) {
  return Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  return todayStr().slice(0, 7);
}

function txnMonthKey(txn) {
  return (txn.date || '').slice(0, 7);
}

function normalizeTxnTypeValue(type) {
  const value = String(type || '').trim().toLowerCase();
  const aliases = {
    income: 'Income',
    expense: 'Expense',
    'self transfer': 'Self Transfer',
    transfer: 'Self Transfer',
    'sip / investment': 'SIP / Investment',
    sip: 'SIP / Investment',
    investment: 'SIP / Investment',
    'loan emi': 'Loan EMI',
    emi: 'Loan EMI'
  };
  return aliases[value] || String(type || '').trim();
}

function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function dateKey(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  while (d.getDate() < day) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function diffDays(from, to) {
  const ms = parseDate(dateKey(to)) - parseDate(dateKey(from));
  return Math.round(ms / 86400000);
}

function getBankName(id) {
  const bank = DB.banks.find(item => item.id === id);
  return bank ? bank.name : '-';
}

function getBank(id) {
  return DB.banks.find(item => item.id === id);
}

function normalizeBankNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findBankByReference(bankId, bankName) {
  return getBank(bankId) || DB.banks.find(item => normalizeBankNameKey(item.name) === normalizeBankNameKey(bankName));
}

function normalizeBankReferences() {
  DB.txns = (DB.txns || []).map(txn => {
    const fromBank = findBankByReference(txn.bankId, txn.bank);
    const toBank = findBankByReference(txn.toBankId, txn.toBank || txn.toBankName);
    return {
      ...txn,
      bankId: fromBank?.id || txn.bankId || '',
      bank: fromBank?.name || txn.bank || '',
      toBankId: toBank?.id || txn.toBankId || '',
      toBank: toBank?.name || txn.toBank || txn.toBankName || ''
    };
  });

  DB.transfers = (DB.transfers || []).map(tr => {
    const fromBank = findBankByReference(tr.fromId, tr.from);
    const toBank = findBankByReference(tr.toId, tr.to);
    return {
      ...tr,
      fromId: fromBank?.id || tr.fromId || '',
      from: fromBank?.name || tr.from || '',
      toId: toBank?.id || tr.toId || '',
      to: toBank?.name || tr.to || ''
    };
  });

  DB.recurringPayments = (DB.recurringPayments || []).map(item => {
    const bank = findBankByReference(item.bankId, item.bankName);
    return { ...item, bankId: bank?.id || item.bankId || '', bankName: bank?.name || item.bankName || '' };
  });

  DB.sipInvestments = (DB.sipInvestments || []).map(item => {
    const bank = findBankByReference(item.bankId, item.bankName);
    return { ...item, bankId: bank?.id || item.bankId || '', bankName: bank?.name || item.bankName || '' };
  });

  DB.loanEMIs = (DB.loanEMIs || []).map(item => {
    const bank = findBankByReference(item.bankId, item.bankName);
    return { ...item, bankId: bank?.id || item.bankId || '', bankName: bank?.name || item.bankName || '' };
  });
}

function sameBankRef(bank, txnBankId, txnBankName) {
  if (!bank) return false;
  return txnBankId === bank.id || (!!normalizeBankNameKey(bank.name) && normalizeBankNameKey(bank.name) === normalizeBankNameKey(txnBankName));
}

function frequencyToMonths(freq) {
  return {
    'Monthly': 1,
    'Quarterly': 3,
    'Half-Yearly': 6,
    'Yearly': 12
  }[freq] || 1;
}

function getScheduleDates(startDate, monthsStep, count = 48) {
  const out = [];
  if (!startDate) return out;
  let current = parseDate(startDate);
  for (let i = 0; i < count; i++) {
    out.push(dateKey(current));
    current = addMonths(current, monthsStep);
  }
  return out;
}

function getNextUnpaidDate(schedule, paidHistory, startFrom = todayStr()) {
  const paid = new Set(paidHistory || []);
  return schedule.find(date => date >= startFrom && !paid.has(date)) || null;
}

function getLatestDueStatus(schedule, paidHistory) {
  const paid = new Set(paidHistory || []);
  const today = todayStr();
  const latestDue = schedule.filter(date => date <= today).pop();
  if (!latestDue) return 'Pending';
  if (paid.has(latestDue)) return 'Paid';
  return latestDue < today ? 'Overdue' : 'Pending';
}

function monthExpenseSummary() {
  const key = currentMonthKey();
  const monthTxns = DB.txns
    .filter(txn => txnMonthKey(txn) === key)
    .map(txn => ({ ...txn, type: normalizeTxnTypeValue(txn.type) }));
  return {
    income: sumBy(monthTxns.filter(txn => txn.type === 'Income'), 'amount'),
    expense: sumBy(monthTxns.filter(txn => txn.type === 'Expense'), 'amount'),
    sip: sumBy(monthTxns.filter(txn => txn.type === 'SIP / Investment'), 'amount'),
    emi: sumBy(monthTxns.filter(txn => txn.type === 'Loan EMI'), 'amount')
  };
}

function sumBy(list, field) {
  return list.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function getBankCurrentFromHistory(bankId) {
  const bank = getBank(bankId);
  if (!bank) return 0;

  let current = DB.txns.reduce((currentValue, txn) => {
    const type = normalizeTxnTypeValue(txn.type);
    const amount = Number(txn.amount || 0);
    const fromMatches = sameBankRef(bank, txn.bankId, txn.bank);
    const toBankName = txn.toBank || txn.toBankName || '';
    const toMatches = sameBankRef(bank, txn.toBankId, toBankName);

    if (type === 'Income' && fromMatches) return currentValue + amount;
    if (['Expense', 'SIP / Investment', 'Loan EMI'].includes(type) && fromMatches) return currentValue - amount;
    return currentValue;
  }, Number(bank.opening || 0));

  current = (DB.transfers || []).reduce((currentValue, tr) => {
    const amount = Number(tr.amount || 0);
    const fromMatches = sameBankRef(bank, tr.fromId, tr.from);
    const toMatches = sameBankRef(bank, tr.toId, tr.to);
    if (fromMatches) currentValue -= amount;
    if (toMatches) currentValue += amount;
    return currentValue;
  }, current);

  return current;
}

function syncBankCurrents() {
  DB.banks.forEach(bank => {
    bank.current = getBankCurrentFromHistory(bank.id);
  });
}

function syncRecurringStatuses() {
  DB.recurringPayments.forEach(item => {
    const schedule = getScheduleDates(item.dueDate, frequencyToMonths(item.frequency), 60);
    item.status = getLatestDueStatus(schedule, item.paidHistory);
  });
}

function syncLoanStatuses() {
  DB.loanEMIs.forEach(item => {
    if (Number(item.remainingLoanAmount || 0) <= 0 || Number(item.numberOfEMIsRemaining || 0) <= 0) {
      item.remainingLoanAmount = Math.max(0, Number(item.remainingLoanAmount || 0));
      item.numberOfEMIsRemaining = Math.max(0, Number(item.numberOfEMIsRemaining || 0));
      item.status = 'Closed';
    }
  });
}

function renderAll() {
  syncRecurringStatuses();
  syncLoanStatuses();
  syncBankCurrents();
  DB.save();
  populateBankSelects();
  renderDashboard();
  renderBanks();
  renderTransactions();
  renderTransfers();
  renderRecurringPayments();
  renderSipInvestments();
  renderLoanEmis();
  renderBudgets();
}

function renderDashboard() {
  syncRecurringStatuses();
  const summary = monthExpenseSummary();
  const budgetStats = getBudgetStats();
  const totalBalance = DB.banks.reduce((sum, bank) => sum + Number(bank.current || 0), 0);
  const recurringUpcoming = getRecurringUpcoming(30);
  const overdueRecurring = DB.recurringPayments.filter(item => item.status === 'Overdue');
  const upcomingSip = getUpcomingSipList();
  const upcomingEmi = getUpcomingEmiList();

  const cards = [
    { label: 'Total Bank Balance', value: fmt(totalBalance), icon: 'B', color: '#6c63ff' },
    { label: 'Total Income This Month', value: fmt(summary.income), icon: '+', color: '#22d3a0' },
    { label: 'Total Expenses This Month', value: fmt(summary.expense), icon: '-', color: '#ff5b7a' },
    { label: 'Total SIP / Investment This Month', value: fmt(summary.sip), icon: 'SI', color: '#8b85ff' },
    { label: 'Total EMI This Month', value: fmt(summary.emi), icon: 'LE', color: '#fbbf24' },
    { label: 'Upcoming Payments', value: String(recurringUpcoming.length), icon: 'RP', color: '#38bdf8' },
    { label: 'Overdue Payments', value: String(overdueRecurring.length), icon: '!', color: '#fb923c' },
    { label: 'Monthly Budget Used', value: fmt(budgetStats.monthlyUsed), icon: 'BG', color: '#38bdf8' },
    { label: 'Monthly Budget Remaining', value: fmt(Math.max(0, budgetStats.monthlyRemaining)), icon: '=', color: budgetStats.monthlyRemaining >= 0 ? '#22d3a0' : '#ff5b7a' }
  ];

  document.getElementById('summary-grid').innerHTML = cards.map(card => `
    <div class="sum-card" style="--card-accent:${card.color}">
      <div class="card-icon">${card.icon}</div>
      <div class="card-label">${card.label}</div>
      <div class="card-value">${card.value}</div>
    </div>
  `).join('');

  const recent = [...DB.txns].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  document.getElementById('recent-txns').innerHTML = recent.length
    ? recent.map(txnRowMini).join('')
    : emptyState('TX', 'No transactions yet');

  document.getElementById('bank-summary-list').innerHTML = DB.banks.length
    ? DB.banks.map(bank => `
      <div class="bank-item">
        <span class="bank-name">${bank.name}</span>
        <span class="bank-bal">${fmt(bank.current)}</span>
      </div>
    `).join('')
    : emptyState('B', 'No banks added');

  document.getElementById('dashboard-upcoming-7').innerHTML = renderSimpleList(getRecurringUpcoming(7), 'No recurring payments due in next 7 days');
  document.getElementById('dashboard-overdue-recurring').innerHTML = renderSimpleList(overdueRecurring.map(item => ({
    title: item.name,
    meta: `${item.type} | ${fmtDate(getRecurringCurrentDue(item))}`,
    amount: fmt(item.amount),
    tone: 'negative'
  })), 'No overdue recurring payments');
  document.getElementById('dashboard-upcoming-sip').innerHTML = renderSimpleList(upcomingSip, 'No upcoming SIP deductions');
  document.getElementById('dashboard-upcoming-emi').innerHTML = renderSimpleList(upcomingEmi, 'No upcoming EMI payments');
}

function txnRowMini(txn) {
  const typeMap = {
    'Income': ['income', '+'],
    'Expense': ['expense', '-'],
    'Self Transfer': ['transfer', 'TR'],
    'SIP / Investment': ['sip', 'SI'],
    'Loan EMI': ['emi', 'LE']
  };
  const [cls, icon] = typeMap[txn.type] || ['expense', '?'];
  const isIncome = txn.type === 'Income';
  const isTransfer = txn.type === 'Self Transfer';
  const amountClass = isTransfer ? 'neutral' : isIncome ? 'pos' : 'neg';
  const prefix = isTransfer ? '' : isIncome ? '+' : '-';
  return `
    <div class="txn-row">
      <div class="txn-left">
        <div class="txn-dot ${cls}">${icon}</div>
        <div class="txn-info">
          <div class="txn-cat">${txn.category || txn.type}</div>
          <div class="txn-meta">${fmtDate(txn.date)} | ${txn.bank || '-'}</div>
        </div>
      </div>
      <div class="txn-amount ${amountClass}">${prefix}${fmt(txn.amount)}</div>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div>${text}</div>`;
}

function openBankModal(id) {
  document.getElementById('bank-modal-title').textContent = id ? 'Edit Bank' : 'Add Bank';
  document.getElementById('bank-edit-id').value = id || '';
  if (id) {
    const bank = DB.banks.find(item => item.id === id);
    document.getElementById('bank-name').value = bank.name;
    document.getElementById('bank-opening').value = bank.opening;
    document.getElementById('bank-current-preview').value = fmt(bank.current);
  } else {
    document.getElementById('bank-name').value = '';
    document.getElementById('bank-opening').value = '';
    document.getElementById('bank-current-preview').value = 'Will be calculated automatically';
  }
  openModal('modal-bank');
}

function saveBank() {
  const name = document.getElementById('bank-name').value.trim();
  const opening = Number(document.getElementById('bank-opening').value || 0);
  const id = document.getElementById('bank-edit-id').value;
  if (!name) return toast('Bank name required', 'error');

  if (id) {
    const bank = DB.banks.find(item => item.id === id);
    bank.name = name;
    bank.opening = opening;
    DB.txns.forEach(txn => {
      if (txn.bankId === id) txn.bank = name;
      if (txn.toBankId === id && txn.type === 'Self Transfer') txn.desc = txn.desc;
    });
    DB.recurringPayments.forEach(item => {
      if (item.bankId === id) item.bankName = name;
    });
    DB.sipInvestments.forEach(item => {
      if (item.bankId === id) item.bankName = name;
    });
    DB.loanEMIs.forEach(item => {
      if (item.bankId === id) item.bankName = name;
    });
    toast('Bank updated');
  } else {
    DB.banks.push({ id: uid(), name, opening, current: opening });
    toast('Bank added');
  }
  syncBankCurrents();
  DB.save();
  populateBankSelects();
  closeModal('modal-bank');
  renderAll();
}

function deleteBank(id) {
  if (!confirm('Delete this bank? Linked history will remain.')) return;
  DB.banks = DB.banks.filter(bank => bank.id !== id);
  DB.save();
  populateBankSelects();
  renderAll();
  toast('Bank deleted');
}

function renderBanks() {
  const tbody = document.getElementById('banks-tbody');
  tbody.innerHTML = DB.banks.length ? DB.banks.map(bank => `
    <tr>
      <td><strong>${bank.name}</strong></td>
      <td>${fmt(bank.opening)}</td>
      <td style="color:var(--green);font-weight:700">${fmt(bank.current)}</td>
      <td>
        <button class="btn-edit" onclick="openBankModal('${bank.id}')">Edit</button>
        <button class="btn-del" onclick="deleteBank('${bank.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="empty-state">No banks yet. Add one.</td></tr>`;
  document.getElementById('banks-total').textContent = `Total Balance: ${fmt(sumBy(DB.banks, 'current'))}`;
}

function onTxnTypeChange() {
  const type = document.getElementById('txn-type').value;
  const toGroup = document.getElementById('txn-tobank-group');
  const bankLabel = document.querySelector('#txn-bank-group label');
  if (type === 'Self Transfer') {
    toGroup.classList.remove('hidden');
    bankLabel.textContent = 'From Bank';
  } else {
    toGroup.classList.add('hidden');
    bankLabel.textContent = 'Bank Account';
  }
}

function populateBankSelects() {
  const ids = ['txn-bank', 'txn-tobank', 'tr-from', 'tr-to', 'filter-bank', 'rp-bank', 'sip-bank', 'loan-bank', 'budget-bank-name'];
  ids.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const isFilter = id === 'filter-bank';
    const previous = select.value;
    select.innerHTML = isFilter ? '<option value="">All Banks</option>' : '';
    DB.banks.forEach(bank => {
      const option = document.createElement('option');
      option.value = bank.id;
      option.textContent = bank.name;
      select.appendChild(option);
    });
    if (previous && [...select.options].some(opt => opt.value === previous)) {
      select.value = previous;
    }
  });
}

function populateBankFilter() {
  populateBankSelects();
}

function openTxnModal(id) {
  populateBankSelects();
  document.getElementById('txn-modal-title').textContent = id ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('txn-edit-id').value = id || '';
  if (id) {
    const txn = DB.txns.find(item => item.id === id);
    document.getElementById('txn-date').value = txn.date;
    document.getElementById('txn-type').value = txn.type;
    document.getElementById('txn-bank').value = txn.bankId || '';
    document.getElementById('txn-tobank').value = txn.toBankId || '';
    document.getElementById('txn-amount').value = txn.amount;
    document.getElementById('txn-category').value = txn.category;
    document.getElementById('txn-mode').value = txn.mode;
    document.getElementById('txn-desc').value = txn.desc || '';
  } else {
    document.getElementById('txn-date').value = todayStr();
    document.getElementById('txn-type').value = 'Expense';
    document.getElementById('txn-amount').value = '';
    document.getElementById('txn-desc').value = '';
  }
  onTxnTypeChange();
  openModal('modal-txn');
}

function saveTransaction() {
  const id = document.getElementById('txn-edit-id').value;
  const date = document.getElementById('txn-date').value;
  const type = normalizeTxnTypeValue(document.getElementById('txn-type').value);
  const bankId = document.getElementById('txn-bank').value;
  const toBankId = document.getElementById('txn-tobank').value;
  const amount = Number(document.getElementById('txn-amount').value);
  const category = document.getElementById('txn-category').value;
  const mode = document.getElementById('txn-mode').value;
  const desc = document.getElementById('txn-desc').value.trim();

  if (!date) return toast('Date required', 'error');
  if (!amount || amount <= 0) return toast('Enter valid amount', 'error');
  if (!bankId && DB.banks.length) return toast('Select a bank', 'error');
  if (type === 'Self Transfer' && bankId === toBankId) return toast('From and To bank must differ', 'error');

  const bank = getBank(bankId);
  if (!bank && DB.banks.length) return toast('Invalid bank', 'error');

  if (id) {
    const old = DB.txns.find(item => item.id === id);
    revertTxnBalance(old);
    Object.assign(old, {
      date, type, bankId, toBankId, amount, category, mode, desc, bank: getBankName(bankId)
    });
    applyTxnBalance(old);
    toast('Transaction updated');
  } else {
    const txn = { id: uid(), date, type, bankId, toBankId, amount, category, mode, desc, bank: getBankName(bankId) };
    applyTxnBalance(txn);
    DB.txns.push(txn);
    toast('Transaction saved');
  }
  DB.save();
  DB.load();
  normalizeData();
  closeModal('modal-txn');
  renderAll();
}

function applyTxnBalance(txn) {
  txn.type = normalizeTxnTypeValue(txn.type);
  const bank = getBank(txn.bankId);
  const toBank = getBank(txn.toBankId);
  if (!bank) return;
  if (txn.type === 'Income') {
    bank.current = Number(bank.current) + Number(txn.amount);
  } else if (['Expense', 'SIP / Investment', 'Loan EMI'].includes(txn.type)) {
    bank.current = Number(bank.current) - Number(txn.amount);
  } else if (txn.type === 'Self Transfer' && toBank) {
    bank.current = Number(bank.current) - Number(txn.amount);
    toBank.current = Number(toBank.current) + Number(txn.amount);
  }
}

function revertTxnBalance(txn) {
  txn.type = normalizeTxnTypeValue(txn.type);
  const bank = getBank(txn.bankId);
  const toBank = getBank(txn.toBankId);
  if (!bank) return;
  if (txn.type === 'Income') {
    bank.current = Number(bank.current) - Number(txn.amount);
  } else if (['Expense', 'SIP / Investment', 'Loan EMI'].includes(txn.type)) {
    bank.current = Number(bank.current) + Number(txn.amount);
  } else if (txn.type === 'Self Transfer' && toBank) {
    bank.current = Number(bank.current) + Number(txn.amount);
    toBank.current = Number(toBank.current) - Number(txn.amount);
  }
}

function deleteTransaction(id) {
  if (!confirm('Delete this transaction? Bank balance will be adjusted.')) return;
  const txn = DB.txns.find(item => item.id === id);
  if (txn) revertTxnBalance(txn);
  DB.txns = DB.txns.filter(item => item.id !== id);
  DB.save();
  renderAll();
  toast('Transaction deleted');
}

function initFilterMonth() {
  const select = document.getElementById('filter-month');
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    months.push({ key, label });
  }
  select.innerHTML = '<option value="">All Months</option>' + months.map(month =>
    `<option value="${month.key}"${month.key === currentMonthKey() ? ' selected' : ''}>${month.label}</option>`
  ).join('');
}

function renderTransactions() {
  populateBankSelects();
  const month = document.getElementById('filter-month')?.value || '';
  const type = document.getElementById('filter-type')?.value || '';
  const bankId = document.getElementById('filter-bank')?.value || '';
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase();

  let list = [...DB.txns].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (month) list = list.filter(txn => txnMonthKey(txn) === month);
  if (type) list = list.filter(txn => txn.type === type);
  if (bankId) list = list.filter(txn => txn.bankId === bankId || txn.toBankId === bankId);
  if (search) {
    list = list.filter(txn =>
      (txn.desc || '').toLowerCase().includes(search) ||
      (txn.category || '').toLowerCase().includes(search) ||
      (txn.bank || '').toLowerCase().includes(search)
    );
  }

  const classMap = {
    'Income': 'income',
    'Expense': 'expense',
    'Self Transfer': 'transfer',
    'SIP / Investment': 'sip',
    'Loan EMI': 'emi'
  };

  document.getElementById('txns-tbody').innerHTML = list.length ? list.map(txn => {
    const isIncome = txn.type === 'Income';
    const isTransfer = txn.type === 'Self Transfer';
    const prefix = isTransfer ? '' : isIncome ? '+' : '-';
    const color = isTransfer ? 'var(--blue)' : isIncome ? 'var(--green)' : 'var(--red)';
    const toBank = txn.type === 'Self Transfer' ? ` -> ${getBankName(txn.toBankId)}` : '';
    return `
      <tr>
        <td>${fmtDate(txn.date)}</td>
        <td><span class="badge ${classMap[txn.type] || 'expense'}">${txn.type}</span></td>
        <td>${txn.bank || '-'}${toBank}</td>
        <td>${txn.category || '-'}</td>
        <td>${txn.mode || '-'}</td>
        <td style="font-family:var(--font-head);font-weight:700;color:${color}">${prefix}${fmt(txn.amount)}</td>
        <td style="color:var(--text3)">${txn.desc || '-'}</td>
        <td>
          <button class="btn-edit" onclick="openTxnModal('${txn.id}')">Edit</button>
          <button class="btn-del" onclick="deleteTransaction('${txn.id}')">Del</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8" class="empty-state">No transactions found</td></tr>`;
}

function openTransferModal(id) {
  populateBankSelects();
  document.getElementById('transfer-modal-title').textContent = id ? 'Edit Transfer' : 'Self Transfer';
  document.getElementById('tr-edit-id').value = id || '';
  if (id) {
    const tr = DB.transfers.find(item => item.id === id);
    document.getElementById('tr-date').value = tr.date;
    document.getElementById('tr-from').value = tr.fromId;
    document.getElementById('tr-to').value = tr.toId;
    document.getElementById('tr-amount').value = tr.amount;
    document.getElementById('tr-remarks').value = tr.remarks || '';
  } else {
    document.getElementById('tr-date').value = todayStr();
    document.getElementById('tr-amount').value = '';
    document.getElementById('tr-remarks').value = '';
  }
  openModal('modal-transfer');
}

function saveTransfer() {
  const id = document.getElementById('tr-edit-id').value;
  const date = document.getElementById('tr-date').value;
  const fromId = document.getElementById('tr-from').value;
  const toId = document.getElementById('tr-to').value;
  const amount = Number(document.getElementById('tr-amount').value);
  const remarks = document.getElementById('tr-remarks').value.trim();
  if (!date || !fromId || !toId || !amount || amount <= 0) return toast('Fill all fields', 'error');
  if (fromId === toId) return toast('Select different banks', 'error');
  const from = getBank(fromId);
  const to = getBank(toId);
  if (!from || !to) return toast('Invalid banks', 'error');

  if (id) {
    const old = DB.transfers.find(item => item.id === id);
    const oldFrom = getBank(old.fromId);
    const oldTo = getBank(old.toId);
    if (oldFrom) oldFrom.current = Number(oldFrom.current) + Number(old.amount);
    if (oldTo) oldTo.current = Number(oldTo.current) - Number(old.amount);
    DB.txns = DB.txns.filter(txn => txn.transferId !== id);
    Object.assign(old, { date, fromId, toId, amount, remarks, from: from.name, to: to.name });
    applyTransfer(old, from, to);
    addTransferTxn(old);
    toast('Transfer updated');
  } else {
    const tr = { id: uid(), date, fromId, toId, amount, remarks, from: from.name, to: to.name };
    applyTransfer(tr, from, to);
    addTransferTxn(tr);
    DB.transfers.push(tr);
    toast('Transfer saved');
  }
  DB.save();
  closeModal('modal-transfer');
  renderAll();
}

function applyTransfer(tr, from, to) {
  from.current = Number(from.current) - Number(tr.amount);
  to.current = Number(to.current) + Number(tr.amount);
}

function addTransferTxn(tr) {
  DB.txns.push({
    id: uid(),
    transferId: tr.id,
    date: tr.date,
    type: 'Self Transfer',
    bankId: tr.fromId,
    toBankId: tr.toId,
    bank: tr.from,
    amount: tr.amount,
    category: 'Transfer',
    mode: 'Net Banking',
    desc: tr.remarks || `${tr.from} -> ${tr.to}`
  });
}

function deleteTransfer(id) {
  if (!confirm('Delete this transfer? Balances will be reverted.')) return;
  const tr = DB.transfers.find(item => item.id === id);
  if (tr) {
    const from = getBank(tr.fromId);
    const to = getBank(tr.toId);
    if (from) from.current = Number(from.current) + Number(tr.amount);
    if (to) to.current = Number(to.current) - Number(tr.amount);
    DB.txns = DB.txns.filter(txn => txn.transferId !== id);
  }
  DB.transfers = DB.transfers.filter(item => item.id !== id);
  DB.save();
  renderAll();
  toast('Transfer deleted');
}

function renderTransfers() {
  const list = [...DB.transfers].sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('transfers-tbody').innerHTML = list.length ? list.map(tr => `
    <tr>
      <td>${fmtDate(tr.date)}</td>
      <td>${tr.from}</td>
      <td>${tr.to}</td>
      <td style="font-family:var(--font-head);font-weight:700;color:var(--blue)">${fmt(tr.amount)}</td>
      <td style="color:var(--text3)">${tr.remarks || '-'}</td>
      <td>
        <button class="btn-edit" onclick="openTransferModal('${tr.id}')">Edit</button>
        <button class="btn-del" onclick="deleteTransfer('${tr.id}')">Del</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="6" class="empty-state">No transfers yet</td></tr>`;
}

function resetRecurringForm() {
  document.getElementById('rp-edit-id').value = '';
  document.getElementById('rp-name').value = '';
  document.getElementById('rp-type').value = 'Mobile Recharge';
  document.getElementById('rp-amount').value = '';
  document.getElementById('rp-bank').value = DB.banks[0]?.id || '';
  document.getElementById('rp-due-date').value = todayStr();
  document.getElementById('rp-frequency').value = 'Monthly';
  document.getElementById('rp-reminder').value = '3';
  document.getElementById('rp-status').value = 'Pending';
  document.getElementById('rp-remarks').value = '';
}

function saveRecurringPayment() {
  const id = document.getElementById('rp-edit-id').value;
  const name = document.getElementById('rp-name').value.trim();
  const type = document.getElementById('rp-type').value;
  const amount = Number(document.getElementById('rp-amount').value);
  const bankId = document.getElementById('rp-bank').value;
  const dueDate = document.getElementById('rp-due-date').value;
  const frequency = document.getElementById('rp-frequency').value;
  const reminderBefore = Number(document.getElementById('rp-reminder').value || 3);
  const status = document.getElementById('rp-status').value;
  const remarks = document.getElementById('rp-remarks').value.trim();

  if (!name || !amount || amount <= 0 || !bankId || !dueDate) return toast('Fill all recurring payment fields', 'error');

  if (id) {
    const item = DB.recurringPayments.find(entry => entry.id === id);
    Object.assign(item, { name, type, amount, bankId, bankName: getBankName(bankId), dueDate, frequency, reminderBefore, status, remarks });
    toast('Recurring payment updated');
  } else {
    DB.recurringPayments.push({
      id: uid(),
      name,
      type,
      amount,
      bankId,
      bankName: getBankName(bankId),
      dueDate,
      frequency,
      reminderBefore,
      status,
      remarks,
      paidHistory: []
    });
    toast('Recurring payment saved');
  }
  syncRecurringStatuses();
  DB.save();
  resetRecurringForm();
  renderAll();
}

function editRecurringPayment(id) {
  const item = DB.recurringPayments.find(entry => entry.id === id);
  document.getElementById('rp-edit-id').value = item.id;
  document.getElementById('rp-name').value = item.name;
  document.getElementById('rp-type').value = item.type;
  document.getElementById('rp-amount').value = item.amount;
  document.getElementById('rp-bank').value = item.bankId;
  document.getElementById('rp-due-date').value = item.dueDate;
  document.getElementById('rp-frequency').value = item.frequency;
  document.getElementById('rp-reminder').value = String(item.reminderBefore || 3);
  document.getElementById('rp-status').value = item.status;
  document.getElementById('rp-remarks').value = item.remarks || '';
}

function deleteRecurringPayment(id) {
  if (!confirm('Delete this recurring payment?')) return;
  DB.recurringPayments = DB.recurringPayments.filter(item => item.id !== id);
  DB.save();
  renderAll();
  toast('Recurring payment deleted');
}

function getRecurringCurrentDue(item) {
  const schedule = getScheduleDates(item.dueDate, frequencyToMonths(item.frequency), 60);
  const unpaidPastOrToday = schedule.filter(date => date <= todayStr() && !(item.paidHistory || []).includes(date)).pop();
  return unpaidPastOrToday || getNextUnpaidDate(schedule, item.paidHistory || []);
}

function markRecurringPaid(id) {
  const item = DB.recurringPayments.find(entry => entry.id === id);
  const schedule = getScheduleDates(item.dueDate, frequencyToMonths(item.frequency), 60);
  const dueDate = getRecurringCurrentDue(item);
  if (!dueDate) return toast('No due cycle found', 'error');
  if ((item.paidHistory || []).includes(dueDate)) return toast('This recurring payment is already marked paid for this cycle', 'error');
  const bank = getBank(item.bankId);
  if (!bank) return toast('Linked bank not found', 'error');

  bank.current = Number(bank.current) - Number(item.amount);
  item.paidHistory = [...(item.paidHistory || []), dueDate];
  item.status = getLatestDueStatus(schedule, item.paidHistory);

  DB.txns.push({
    id: uid(),
    date: dueDate,
    type: 'Expense',
    bankId: item.bankId,
    bank: bank.name,
    amount: item.amount,
    category: item.type,
    mode: 'Auto Debit',
    desc: `${item.name}${item.remarks ? ' - ' + item.remarks : ''}`,
    sourceModule: 'Recurring Payment',
    sourceId: item.id,
    cycleDate: dueDate
  });

  DB.save();
  renderAll();
  toast('Recurring payment marked as paid');
}

function getRecurringUpcoming(days) {
  return DB.recurringPayments.map(item => {
    const nextDue = getNextUnpaidDate(getScheduleDates(item.dueDate, frequencyToMonths(item.frequency), 60), item.paidHistory || []);
    if (!nextDue) return null;
    const diff = diffDays(todayStr(), nextDue);
    if (diff < 0 || diff > days) return null;
    return {
      title: item.name,
      meta: `${item.type} | ${fmtDate(nextDue)} | ${getBankName(item.bankId)}`,
      amount: fmt(item.amount),
      tone: 'neutral'
    };
  }).filter(Boolean).sort((a, b) => a.meta.localeCompare(b.meta));
}

function renderRecurringPayments() {
  syncRecurringStatuses();
  if (!document.getElementById('rp-due-date').value) resetRecurringForm();
  const upcoming7 = getRecurringUpcoming(7);
  const upcoming30 = getRecurringUpcoming(30);
  const overdue = DB.recurringPayments.filter(item => item.status === 'Overdue');

  document.getElementById('recurring-next-7-count').textContent = String(upcoming7.length);
  document.getElementById('recurring-next-30-count').textContent = String(upcoming30.length);
  document.getElementById('recurring-overdue-count').textContent = String(overdue.length);
  document.getElementById('recurring-upcoming-7').innerHTML = renderSimpleList(upcoming7, 'No upcoming payments in next 7 days');
  document.getElementById('recurring-upcoming-30').innerHTML = renderSimpleList(upcoming30, 'No upcoming payments in next 30 days');

  document.getElementById('recurring-tbody').innerHTML = DB.recurringPayments.length ? DB.recurringPayments.map(item => {
    const nextDue = getNextUnpaidDate(getScheduleDates(item.dueDate, frequencyToMonths(item.frequency), 60), item.paidHistory || []);
    const statusClass = item.status.toLowerCase().replace(/\s+/g, '-');
    return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.type}</td>
        <td>${getBankName(item.bankId)}</td>
        <td>${fmt(item.amount)}</td>
        <td>${fmtDate(nextDue || item.dueDate)}</td>
        <td>${item.frequency}</td>
        <td><span class="badge ${statusClass}">${item.status}</span></td>
        <td>${item.remarks || '-'}</td>
        <td>
          <button class="btn-pay" onclick="markRecurringPaid('${item.id}')">Mark Paid</button>
          <button class="btn-edit" onclick="editRecurringPayment('${item.id}')">Edit</button>
          <button class="btn-del" onclick="deleteRecurringPayment('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="9" class="empty-state">No recurring payments added yet</td></tr>`;
}

function resetSipForm() {
  document.getElementById('sip-edit-id').value = '';
  document.getElementById('sip-name').value = '';
  document.getElementById('sip-type').value = 'Mutual Fund';
  document.getElementById('sip-amount').value = '';
  document.getElementById('sip-bank').value = DB.banks[0]?.id || '';
  document.getElementById('sip-deduction-date').value = todayStr();
  document.getElementById('sip-start-date').value = todayStr();
  document.getElementById('sip-end-date').value = '';
  document.getElementById('sip-status').value = 'Active';
  document.getElementById('sip-total-invested').value = '0';
  document.getElementById('sip-remarks').value = '';
}

function saveSipInvestment() {
  const id = document.getElementById('sip-edit-id').value;
  const name = document.getElementById('sip-name').value.trim();
  const type = document.getElementById('sip-type').value;
  const monthlyAmount = Number(document.getElementById('sip-amount').value);
  const bankId = document.getElementById('sip-bank').value;
  const deductionDate = document.getElementById('sip-deduction-date').value;
  const startDate = document.getElementById('sip-start-date').value;
  const endDate = document.getElementById('sip-end-date').value;
  const status = document.getElementById('sip-status').value;
  const totalInvestedAmount = Number(document.getElementById('sip-total-invested').value || 0);
  const remarks = document.getElementById('sip-remarks').value.trim();

  if (!name || !monthlyAmount || monthlyAmount <= 0 || !bankId || !deductionDate || !startDate) {
    return toast('Fill all SIP fields', 'error');
  }

  if (id) {
    const item = DB.sipInvestments.find(entry => entry.id === id);
    Object.assign(item, { name, type, monthlyAmount, bankId, bankName: getBankName(bankId), deductionDate, startDate, endDate, status, totalInvestedAmount, remarks });
    toast('SIP updated');
  } else {
    DB.sipInvestments.push({
      id: uid(),
      name,
      type,
      monthlyAmount,
      bankId,
      bankName: getBankName(bankId),
      deductionDate,
      startDate,
      endDate,
      status,
      totalInvestedAmount,
      remarks,
      paidHistory: []
    });
    toast('SIP saved');
  }
  DB.save();
  resetSipForm();
  renderAll();
}

function editSipInvestment(id) {
  const item = DB.sipInvestments.find(entry => entry.id === id);
  document.getElementById('sip-edit-id').value = item.id;
  document.getElementById('sip-name').value = item.name;
  document.getElementById('sip-type').value = item.type;
  document.getElementById('sip-amount').value = item.monthlyAmount;
  document.getElementById('sip-bank').value = item.bankId;
  document.getElementById('sip-deduction-date').value = item.deductionDate;
  document.getElementById('sip-start-date').value = item.startDate;
  document.getElementById('sip-end-date').value = item.endDate || '';
  document.getElementById('sip-status').value = item.status;
  document.getElementById('sip-total-invested').value = item.totalInvestedAmount || 0;
  document.getElementById('sip-remarks').value = item.remarks || '';
}

function deleteSipInvestment(id) {
  if (!confirm('Delete this SIP / investment?')) return;
  DB.sipInvestments = DB.sipInvestments.filter(item => item.id !== id);
  DB.save();
  renderAll();
  toast('SIP deleted');
}

function getSipSchedule(item) {
  const base = item.deductionDate || item.startDate;
  const fullSchedule = getScheduleDates(base, 1, 60).filter(date => date >= item.startDate);
  return item.endDate ? fullSchedule.filter(date => date <= item.endDate) : fullSchedule;
}

function getUpcomingSipList() {
  return DB.sipInvestments.filter(item => item.status === 'Active').map(item => {
    const nextDue = getNextUnpaidDate(getSipSchedule(item), item.paidHistory || []);
    if (!nextDue) return null;
    const days = diffDays(todayStr(), nextDue);
    if (days < 0 || days > 30) return null;
    return {
      title: item.name,
      meta: `${item.type} | ${fmtDate(nextDue)} | ${getBankName(item.bankId)}`,
      amount: fmt(item.monthlyAmount),
      tone: 'neutral'
    };
  }).filter(Boolean).sort((a, b) => a.meta.localeCompare(b.meta));
}

function markSipPaid(id) {
  const item = DB.sipInvestments.find(entry => entry.id === id);
  if (item.status !== 'Active') return toast('Only active SIPs can be marked paid', 'error');
  const dueDate = getNextUnpaidDate(getSipSchedule(item), item.paidHistory || [], item.startDate);
  if (!dueDate) return toast('No due SIP cycle found', 'error');
  if ((item.paidHistory || []).includes(dueDate)) return toast('This SIP is already paid for that cycle', 'error');
  const bank = getBank(item.bankId);
  if (!bank) return toast('Linked bank not found', 'error');

  bank.current = Number(bank.current) - Number(item.monthlyAmount);
  item.totalInvestedAmount = Number(item.totalInvestedAmount || 0) + Number(item.monthlyAmount);
  item.paidHistory = [...(item.paidHistory || []), dueDate];

  DB.txns.push({
    id: uid(),
    date: dueDate,
    type: 'SIP / Investment',
    bankId: item.bankId,
    bank: bank.name,
    amount: item.monthlyAmount,
    category: item.type,
    mode: 'Auto Debit',
    desc: `${item.name}${item.remarks ? ' - ' + item.remarks : ''}`,
    sourceModule: 'SIP / Investment',
    sourceId: item.id,
    cycleDate: dueDate
  });

  DB.save();
  renderAll();
  toast('SIP marked as paid');
}

function renderSipInvestments() {
  if (!document.getElementById('sip-start-date').value) resetSipForm();
  const upcoming = getUpcomingSipList();
  const summary = monthExpenseSummary();
  document.getElementById('sip-summary-month').textContent = fmt(summary.sip);
  document.getElementById('sip-summary-total').textContent = fmt(sumBy(DB.sipInvestments, 'totalInvestedAmount'));
  document.getElementById('sip-summary-active').textContent = String(DB.sipInvestments.filter(item => item.status === 'Active').length);
  document.getElementById('sip-upcoming-list').innerHTML = renderSimpleList(upcoming, 'No upcoming SIP deductions');

  document.getElementById('sip-tbody').innerHTML = DB.sipInvestments.length ? DB.sipInvestments.map(item => {
    const nextDue = getNextUnpaidDate(getSipSchedule(item), item.paidHistory || [], item.startDate);
    return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.type}</td>
        <td>${getBankName(item.bankId)}</td>
        <td>${fmt(item.monthlyAmount)}</td>
        <td>${fmtDate(nextDue || item.deductionDate)}</td>
        <td><span class="badge ${item.status.toLowerCase()}">${item.status}</span></td>
        <td>${fmt(item.totalInvestedAmount)}</td>
        <td>${item.remarks || '-'}</td>
        <td>
          <button class="btn-pay" onclick="markSipPaid('${item.id}')">Mark Paid</button>
          <button class="btn-edit" onclick="editSipInvestment('${item.id}')">Edit</button>
          <button class="btn-del" onclick="deleteSipInvestment('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="9" class="empty-state">No SIP / investments added yet</td></tr>`;
}

function resetLoanForm() {
  document.getElementById('loan-edit-id').value = '';
  document.getElementById('loan-name').value = '';
  document.getElementById('loan-type').value = 'Two Wheeler Loan';
  document.getElementById('loan-provider').value = '';
  document.getElementById('loan-emi-amount').value = '';
  document.getElementById('loan-bank').value = DB.banks[0]?.id || '';
  document.getElementById('loan-emi-date').value = todayStr();
  document.getElementById('loan-start-date').value = todayStr();
  document.getElementById('loan-end-date').value = '';
  document.getElementById('loan-total-amount').value = '';
  document.getElementById('loan-remaining-amount').value = '';
  document.getElementById('loan-emis-paid').value = '0';
  document.getElementById('loan-emis-remaining').value = '0';
  document.getElementById('loan-status').value = 'Active';
  document.getElementById('loan-remarks').value = '';
}

function saveLoanEmi() {
  const id = document.getElementById('loan-edit-id').value;
  const loanName = document.getElementById('loan-name').value.trim();
  const loanType = document.getElementById('loan-type').value;
  const provider = document.getElementById('loan-provider').value.trim();
  const emiAmount = Number(document.getElementById('loan-emi-amount').value);
  const bankId = document.getElementById('loan-bank').value;
  const emiDate = document.getElementById('loan-emi-date').value;
  const loanStartDate = document.getElementById('loan-start-date').value;
  const loanEndDate = document.getElementById('loan-end-date').value;
  const totalLoanAmount = Number(document.getElementById('loan-total-amount').value || 0);
  const remainingLoanAmount = Number(document.getElementById('loan-remaining-amount').value || 0);
  const numberOfEMIsPaid = Number(document.getElementById('loan-emis-paid').value || 0);
  const numberOfEMIsRemaining = Number(document.getElementById('loan-emis-remaining').value || 0);
  const status = document.getElementById('loan-status').value;
  const remarks = document.getElementById('loan-remarks').value.trim();

  if (!loanName || !provider || !emiAmount || emiAmount <= 0 || !bankId || !emiDate || !loanStartDate) {
    return toast('Fill all loan EMI fields', 'error');
  }

  const payload = {
    loanName,
    loanType,
    provider,
    emiAmount,
    bankId,
    bankName: getBankName(bankId),
    emiDate,
    loanStartDate,
    loanEndDate,
    totalLoanAmount,
    remainingLoanAmount,
    numberOfEMIsPaid,
    numberOfEMIsRemaining,
    status,
    remarks
  };

  if (id) {
    Object.assign(DB.loanEMIs.find(item => item.id === id), payload);
    toast('Loan EMI updated');
  } else {
    DB.loanEMIs.push({ id: uid(), paidHistory: [], ...payload });
    toast('Loan EMI saved');
  }
  syncLoanStatuses();
  DB.save();
  resetLoanForm();
  renderAll();
}

function editLoanEmi(id) {
  const item = DB.loanEMIs.find(entry => entry.id === id);
  document.getElementById('loan-edit-id').value = item.id;
  document.getElementById('loan-name').value = item.loanName;
  document.getElementById('loan-type').value = item.loanType;
  document.getElementById('loan-provider').value = item.provider;
  document.getElementById('loan-emi-amount').value = item.emiAmount;
  document.getElementById('loan-bank').value = item.bankId;
  document.getElementById('loan-emi-date').value = item.emiDate;
  document.getElementById('loan-start-date').value = item.loanStartDate;
  document.getElementById('loan-end-date').value = item.loanEndDate || '';
  document.getElementById('loan-total-amount').value = item.totalLoanAmount || 0;
  document.getElementById('loan-remaining-amount').value = item.remainingLoanAmount || 0;
  document.getElementById('loan-emis-paid').value = item.numberOfEMIsPaid || 0;
  document.getElementById('loan-emis-remaining').value = item.numberOfEMIsRemaining || 0;
  document.getElementById('loan-status').value = item.status;
  document.getElementById('loan-remarks').value = item.remarks || '';
}

function deleteLoanEmi(id) {
  if (!confirm('Delete this loan EMI?')) return;
  DB.loanEMIs = DB.loanEMIs.filter(item => item.id !== id);
  DB.save();
  renderAll();
  toast('Loan EMI deleted');
}

function getLoanSchedule(item) {
  const base = item.emiDate || item.loanStartDate;
  const fullSchedule = getScheduleDates(base, 1, 120).filter(date => date >= item.loanStartDate);
  return item.loanEndDate ? fullSchedule.filter(date => date <= item.loanEndDate) : fullSchedule;
}

function getUpcomingEmiList() {
  return DB.loanEMIs.filter(item => item.status === 'Active').map(item => {
    const nextDue = getNextUnpaidDate(getLoanSchedule(item), item.paidHistory || [], item.loanStartDate);
    if (!nextDue) return null;
    const days = diffDays(todayStr(), nextDue);
    if (days < 0 || days > 30) return null;
    return {
      title: item.loanName,
      meta: `${item.loanType} | ${fmtDate(nextDue)} | ${getBankName(item.bankId)}`,
      amount: fmt(item.emiAmount),
      tone: 'neutral'
    };
  }).filter(Boolean).sort((a, b) => a.meta.localeCompare(b.meta));
}

function markLoanEmiPaid(id) {
  const item = DB.loanEMIs.find(entry => entry.id === id);
  if (item.status !== 'Active') return toast('Only active loans can be marked paid', 'error');
  const dueDate = getNextUnpaidDate(getLoanSchedule(item), item.paidHistory || [], item.loanStartDate);
  if (!dueDate) return toast('No due EMI cycle found', 'error');
  if ((item.paidHistory || []).includes(dueDate)) return toast('This EMI is already paid for that cycle', 'error');

  const bank = getBank(item.bankId);
  if (!bank) return toast('Linked bank not found', 'error');

  bank.current = Number(bank.current) - Number(item.emiAmount);
  item.remainingLoanAmount = Math.max(0, Number(item.remainingLoanAmount || 0) - Number(item.emiAmount));
  item.numberOfEMIsPaid = Number(item.numberOfEMIsPaid || 0) + 1;
  item.numberOfEMIsRemaining = Math.max(0, Number(item.numberOfEMIsRemaining || 0) - 1);
  item.paidHistory = [...(item.paidHistory || []), dueDate];
  if (item.remainingLoanAmount === 0 || item.numberOfEMIsRemaining === 0) item.status = 'Closed';

  DB.txns.push({
    id: uid(),
    date: dueDate,
    type: 'Loan EMI',
    bankId: item.bankId,
    bank: bank.name,
    amount: item.emiAmount,
    category: item.loanType,
    mode: 'Auto Debit',
    desc: `${item.loanName}${item.remarks ? ' - ' + item.remarks : ''}`,
    sourceModule: 'Loan EMI',
    sourceId: item.id,
    cycleDate: dueDate
  });

  DB.save();
  renderAll();
  toast('Loan EMI marked as paid');
}

function renderLoanEmis() {
  if (!document.getElementById('loan-start-date').value) resetLoanForm();
  syncLoanStatuses();
  const summary = monthExpenseSummary();
  const activeLoans = DB.loanEMIs.filter(item => item.status === 'Active');
  document.getElementById('loan-summary-month').textContent = fmt(summary.emi);
  document.getElementById('loan-summary-paid').textContent = fmtCompact(sumBy(DB.loanEMIs, 'numberOfEMIsPaid'));
  document.getElementById('loan-summary-pending').textContent = fmtCompact(sumBy(activeLoans, 'numberOfEMIsRemaining'));
  document.getElementById('loan-summary-remaining').textContent = fmt(sumBy(DB.loanEMIs, 'remainingLoanAmount'));
  document.getElementById('loan-upcoming-list').innerHTML = renderSimpleList(getUpcomingEmiList(), 'No upcoming EMI payments');

  document.getElementById('loan-tbody').innerHTML = DB.loanEMIs.length ? DB.loanEMIs.map(item => {
    const nextDue = getNextUnpaidDate(getLoanSchedule(item), item.paidHistory || [], item.loanStartDate);
    return `
      <tr>
        <td><strong>${item.loanName}</strong></td>
        <td>${item.loanType}</td>
        <td>${item.provider}</td>
        <td>${getBankName(item.bankId)}</td>
        <td>${fmt(item.emiAmount)}</td>
        <td>${fmtDate(nextDue || item.emiDate)}</td>
        <td><span class="badge ${item.status.toLowerCase()}">${item.status}</span></td>
        <td>${fmt(item.remainingLoanAmount)}</td>
        <td>${item.numberOfEMIsPaid} / ${item.numberOfEMIsPaid + item.numberOfEMIsRemaining}</td>
        <td>
          <button class="btn-pay" onclick="markLoanEmiPaid('${item.id}')">Mark Paid</button>
          <button class="btn-edit" onclick="editLoanEmi('${item.id}')">Edit</button>
          <button class="btn-del" onclick="deleteLoanEmi('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="10" class="empty-state">No loan EMI records added yet</td></tr>`;
}

function saveMonthlyBudget() {
  DB.budgets.monthlyTotal = Number(document.getElementById('budget-total-amount').value || 0);
  DB.save();
  renderBudgets();
  toast('Monthly budget saved');
}

function saveCategoryBudget() {
  const category = document.getElementById('budget-category-name').value;
  const amount = Number(document.getElementById('budget-category-amount').value || 0);
  if (!category || amount < 0) return toast('Enter valid category budget', 'error');
  DB.budgets.categories[category] = amount;
  DB.save();
  renderBudgets();
  toast('Category budget saved');
}

function saveBankBudget() {
  const bankId = document.getElementById('budget-bank-name').value;
  const amount = Number(document.getElementById('budget-bank-amount').value || 0);
  if (!bankId || amount < 0) return toast('Enter valid bank limit', 'error');
  DB.budgets.banks[bankId] = amount;
  DB.save();
  renderBudgets();
  toast('Bank limit saved');
}

function removeCategoryBudget(category) {
  delete DB.budgets.categories[category];
  DB.save();
  renderBudgets();
}

function removeBankBudget(bankId) {
  delete DB.budgets.banks[bankId];
  DB.save();
  renderBudgets();
}

function getBudgetStats() {
  const key = currentMonthKey();
  const monthTxns = DB.txns.filter(txn => txnMonthKey(txn) === key);
  const expenseTxns = monthTxns.filter(txn => txn.type === 'Expense');
  const totalOutflow = monthTxns.filter(txn => ['Expense', 'SIP / Investment', 'Loan EMI'].includes(txn.type));
  const categorySpend = {};
  const bankSpend = {};

  expenseTxns.forEach(txn => {
    categorySpend[txn.category || 'Other'] = Number(categorySpend[txn.category || 'Other'] || 0) + Number(txn.amount || 0);
  });

  totalOutflow.forEach(txn => {
    bankSpend[txn.bankId] = Number(bankSpend[txn.bankId] || 0) + Number(txn.amount || 0);
  });

  const monthlyBudget = Number(DB.budgets.monthlyTotal || 0);
  const monthlyUsed = sumBy(totalOutflow, 'amount');
  const monthlyRemaining = monthlyBudget - monthlyUsed;

  const categoryWarnings = Object.entries(DB.budgets.categories).filter(([category, amount]) => Number(categorySpend[category] || 0) > Number(amount || 0));
  const bankWarnings = Object.entries(DB.budgets.banks).filter(([bankId, amount]) => Number(bankSpend[bankId] || 0) > Number(amount || 0));
  const monthlyExceeded = monthlyBudget > 0 && monthlyUsed > monthlyBudget;

  return {
    monthlyBudget,
    monthlyUsed,
    monthlyRemaining,
    categorySpend,
    bankSpend,
    categoryWarnings,
    bankWarnings,
    monthlyExceeded
  };
}

function renderBudgets() {
  document.getElementById('budget-total-amount').value = DB.budgets.monthlyTotal || '';
  const stats = getBudgetStats();

  document.getElementById('budget-summary-cards').innerHTML = [
    { label: 'Total Budget', value: fmt(stats.monthlyBudget), color: '#6c63ff' },
    { label: 'Budget Used', value: fmt(stats.monthlyUsed), color: '#38bdf8' },
    { label: 'Budget Remaining', value: fmt(stats.monthlyRemaining), color: stats.monthlyRemaining >= 0 ? '#22d3a0' : '#ff5b7a' },
    { label: 'Monthly Outflow', value: fmt(stats.monthlyUsed), color: '#fb923c' }
  ].map(card => `
    <div class="sum-card" style="--card-accent:${card.color}">
      <div class="card-label">${card.label}</div>
      <div class="card-value">${card.value}</div>
    </div>
  `).join('');

  const warnings = [];
  if (stats.monthlyExceeded) warnings.push(`Monthly budget exceeded by ${fmt(Math.abs(stats.monthlyRemaining))}`);
  stats.categoryWarnings.forEach(([category]) => warnings.push(`${category} category budget exceeded`));
  stats.bankWarnings.forEach(([bankId]) => warnings.push(`${getBankName(bankId)} bank spending limit exceeded`));

  document.getElementById('budget-warning-box').innerHTML = warnings.length ? `
    <div class="warning-box">
      <strong>Budget Warning</strong>
      ${warnings.map(item => `<div class="warning-text">${item}</div>`).join('')}
    </div>
  ` : '';

  document.getElementById('budget-category-list').innerHTML = Object.keys(DB.budgets.categories).length ? Object.entries(DB.budgets.categories).map(([category, amount]) => `
    <div class="settings-item">
      <div>
        <div class="settings-name">${category}</div>
        <div class="settings-meta">Limit</div>
      </div>
      <div>
        <span class="settings-value">${fmt(amount)}</span>
        <button class="btn-del" onclick="removeCategoryBudget('${escapeSingleQuotes(category)}')">Delete</button>
      </div>
    </div>
  `).join('') : emptyState('BG', 'No category budgets set');

  document.getElementById('budget-bank-list').innerHTML = Object.keys(DB.budgets.banks).length ? Object.entries(DB.budgets.banks).map(([bankId, amount]) => `
    <div class="settings-item">
      <div>
        <div class="settings-name">${getBankName(bankId)}</div>
        <div class="settings-meta">Spending limit</div>
      </div>
      <div>
        <span class="settings-value">${fmt(amount)}</span>
        <button class="btn-del" onclick="removeBankBudget('${bankId}')">Delete</button>
      </div>
    </div>
  `).join('') : emptyState('B', 'No bank-wise limits set');

  document.getElementById('budget-category-breakdown').innerHTML = renderBreakdownList(
    Object.entries(DB.budgets.categories).map(([category, budget]) => {
      const spent = Number(stats.categorySpend[category] || 0);
      return {
        title: category,
        meta: `Spent ${fmt(spent)} | Remaining ${fmt(Number(budget) - spent)}`,
        amount: `${spent > budget ? 'Exceeded' : 'Budget'} ${fmt(budget)}`,
        progress: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0,
        warn: budget > 0 && spent > budget
      };
    }),
    'No category budget data'
  );

  document.getElementById('budget-bank-breakdown').innerHTML = renderBreakdownList(
    Object.entries(DB.budgets.banks).map(([bankId, limit]) => {
      const spent = Number(stats.bankSpend[bankId] || 0);
      return {
        title: getBankName(bankId),
        meta: `Spent ${fmt(spent)} | Remaining ${fmt(Number(limit) - spent)}`,
        amount: `${spent > limit ? 'Exceeded' : 'Limit'} ${fmt(limit)}`,
        progress: limit > 0 ? Math.min(100, (spent / limit) * 100) : 0,
        warn: limit > 0 && spent > limit
      };
    }),
    'No bank-wise budget data'
  );
}

function renderSimpleList(items, emptyText) {
  if (!items.length) return emptyState('-', emptyText);
  return items.map(item => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${item.title}</div>
        <div class="list-item-meta">${item.meta}</div>
      </div>
      <div class="list-item-amount ${item.tone || 'neutral'}">${item.amount}</div>
    </div>
  `).join('');
}

function renderBreakdownList(items, emptyText) {
  if (!items.length) return emptyState('-', emptyText);
  return items.map(item => `
    <div class="breakdown-item">
      <div class="breakdown-main">
        <div class="breakdown-title">${item.title}</div>
        <div class="breakdown-meta">${item.meta}</div>
        <div class="breakdown-progress"><span class="${item.warn ? 'warn' : ''}" style="width:${item.progress}%"></span></div>
      </div>
      <div class="breakdown-amount">${item.amount}</div>
    </div>
  `).join('');
}

function escapeSingleQuotes(text) {
  return String(text).replace(/'/g, "\\'");
}
