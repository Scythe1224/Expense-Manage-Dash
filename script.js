/* ============================================================
   FinanceOS - Phase 1: Login, Banks, Transactions, Transfer
   ============================================================ */

const DB = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  load() {
    this.banks = this.get('fo_banks') || [];
    this.txns = this.get('fo_txns') || [];
    this.transfers = this.get('fo_transfers') || [];
    this.password = this.get('fo_password') || '';
    this.session = this.get('fo_session') || false;
  },
  save() {
    this.set('fo_banks', this.banks);
    this.set('fo_txns', this.txns);
    this.set('fo_transfers', this.transfers);
    this.set('fo_password', this.password);
    this.set('fo_session', this.session);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  DB.load();
  if (DB.session) {
    showApp();
  } else {
    document.getElementById('login-page').classList.remove('hidden');
  }
  setTopbarDate();
  initFilterMonth();
  populateBankSelects();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal(overlay.id);
    });
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !document.getElementById('login-page').classList.contains('hidden')) {
    doLogin();
  }
});

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
    showApp();
    toast('Login setup completed', 'success');
    return;
  }

  if (pass === DB.password) {
    err.classList.add('hidden');
    DB.session = true;
    DB.save();
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
  renderDashboard();
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

  if (current !== DB.password) {
    showErr(err, 'Current password incorrect');
    return;
  }
  if (next.length < 6) {
    showErr(err, 'New password must be 6+ characters');
    return;
  }
  if (next !== confirmPwd) {
    showErr(err, 'Passwords do not match');
    return;
  }

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

  const activePage = document.getElementById('page-' + name);
  if (activePage) {
    activePage.classList.remove('hidden');
    activePage.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (el) el.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    banks: 'Banks',
    transactions: 'Transactions',
    transfer: 'Self Transfer'
  };
  document.getElementById('page-title').textContent = titles[name] || name;

  if (name === 'dashboard') renderDashboard();
  if (name === 'banks') renderBanks();
  if (name === 'transactions') {
    populateBankFilter();
    renderTransactions();
  }
  if (name === 'transfer') renderTransfers();

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
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
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

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function txnMonthKey(txn) {
  if (!txn.date) return '';
  return txn.date.slice(0, 7);
}

function renderDashboard() {
  const now = currentMonthKey();
  const monthTxns = DB.txns.filter(txn => txnMonthKey(txn) === now);

  const totalBalance = DB.banks.reduce((sum, bank) => sum + Number(bank.current || 0), 0);
  const income = monthTxns.filter(txn => txn.type === 'Income').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const expense = monthTxns.filter(txn => txn.type === 'Expense').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const sip = monthTxns.filter(txn => txn.type === 'SIP / Investment').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const emi = monthTxns.filter(txn => txn.type === 'Loan EMI').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);

  const cards = [
    { label: 'Total Balance', value: fmt(totalBalance), icon: 'B', color: '#6c63ff' },
    { label: 'Income This Month', value: fmt(income), icon: '+', color: '#22d3a0' },
    { label: 'Expense This Month', value: fmt(expense), icon: '-', color: '#ff5b7a' },
    { label: 'SIP / Investment', value: fmt(sip), icon: 'SI', color: '#8b85ff' },
    { label: 'Loan EMI', value: fmt(emi), icon: 'LE', color: '#fbbf24' },
    { label: 'Net This Month', value: fmt(income - expense - sip - emi), icon: 'N', color: income - expense - sip - emi >= 0 ? '#22d3a0' : '#ff5b7a' }
  ];

  document.getElementById('summary-grid').innerHTML = cards.map(card => `
    <div class="sum-card" style="--card-accent:${card.color}">
      <div class="card-icon">${card.icon}</div>
      <div class="card-label">${card.label}</div>
      <div class="card-value">${card.value}</div>
    </div>
  `).join('');

  const recent = [...DB.txns].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  const recentEl = document.getElementById('recent-txns');
  if (!recent.length) {
    recentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">TX</div>No transactions yet</div>';
  } else {
    recentEl.innerHTML = recent.map(txnRowMini).join('');
  }

  const bankSummaryEl = document.getElementById('bank-summary-list');
  if (!DB.banks.length) {
    bankSummaryEl.innerHTML = '<div class="empty-state"><div class="empty-icon">B</div>No banks added</div>';
  } else {
    bankSummaryEl.innerHTML = DB.banks.map(bank => `
      <div class="bank-item">
        <span class="bank-name">${bank.name}</span>
        <span class="bank-bal">${fmt(bank.current)}</span>
      </div>
    `).join('');
  }
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

  return `<div class="txn-row">
    <div class="txn-left">
      <div class="txn-dot ${cls}">${icon}</div>
      <div class="txn-info">
        <div class="txn-cat">${txn.category || txn.type}</div>
        <div class="txn-meta">${fmtDate(txn.date)} | ${txn.bank || ''}</div>
      </div>
    </div>
    <div class="txn-amount ${amountClass}">${prefix}${fmt(txn.amount)}</div>
  </div>`;
}

function openBankModal(id) {
  document.getElementById('bank-modal-title').textContent = id ? 'Edit Bank' : 'Add Bank';
  document.getElementById('bank-edit-id').value = id || '';

  if (id) {
    const bank = DB.banks.find(item => item.id === id);
    document.getElementById('bank-name').value = bank.name;
    document.getElementById('bank-opening').value = bank.opening;
    document.getElementById('bank-current').value = bank.current;
  } else {
    document.getElementById('bank-name').value = '';
    document.getElementById('bank-opening').value = '';
    document.getElementById('bank-current').value = '';
  }
  openModal('modal-bank');
}

function saveBank() {
  const name = document.getElementById('bank-name').value.trim();
  const opening = parseFloat(document.getElementById('bank-opening').value) || 0;
  const current = parseFloat(document.getElementById('bank-current').value) || 0;
  const editId = document.getElementById('bank-edit-id').value;

  if (!name) {
    toast('Bank name required', 'error');
    return;
  }

  if (editId) {
    const bank = DB.banks.find(item => item.id === editId);
    bank.name = name;
    bank.opening = opening;
    bank.current = current;
    DB.txns.forEach(txn => {
      if (txn.bankId === editId) txn.bank = name;
    });
    DB.transfers.forEach(tr => {
      if (tr.fromId === editId) tr.from = name;
      if (tr.toId === editId) tr.to = name;
    });
    toast('Bank updated', 'success');
  } else {
    DB.banks.push({ id: uid(), name, opening, current });
    toast('Bank added', 'success');
  }

  DB.save();
  populateBankSelects();
  closeModal('modal-bank');
  renderBanks();
  renderDashboard();
}

function deleteBank(id) {
  if (!confirm('Delete this bank? This will not delete transactions.')) return;
  DB.banks = DB.banks.filter(bank => bank.id !== id);
  DB.save();
  populateBankSelects();
  renderBanks();
  renderDashboard();
  toast('Bank deleted');
}

function renderBanks() {
  const tbody = document.getElementById('banks-tbody');
  if (!DB.banks.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No banks yet. Add one!</td></tr>';
  } else {
    tbody.innerHTML = DB.banks.map(bank => `
      <tr>
        <td><strong>${bank.name}</strong></td>
        <td>${fmt(bank.opening)}</td>
        <td style="color:var(--green);font-weight:700">${fmt(bank.current)}</td>
        <td>
          <button class="btn-edit" onclick="openBankModal('${bank.id}')">Edit</button>
          <button class="btn-del" onclick="deleteBank('${bank.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  const total = DB.banks.reduce((sum, bank) => sum + Number(bank.current || 0), 0);
  document.getElementById('banks-total').textContent = `Total Balance: ${fmt(total)}`;
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
  const ids = ['txn-bank', 'txn-tobank', 'tr-from', 'tr-to', 'filter-bank'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === 'filter-bank';
    const previous = el.value;
    el.innerHTML = isFilter ? '<option value="">All Banks</option>' : '';
    DB.banks.forEach(bank => {
      const option = document.createElement('option');
      option.value = bank.id;
      option.textContent = bank.name;
      el.appendChild(option);
    });
    if (previous && [...el.options].some(option => option.value === previous)) {
      el.value = previous;
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
  const type = document.getElementById('txn-type').value;
  const bankId = document.getElementById('txn-bank').value;
  const toBankId = document.getElementById('txn-tobank').value;
  const amount = parseFloat(document.getElementById('txn-amount').value);
  const category = document.getElementById('txn-category').value;
  const mode = document.getElementById('txn-mode').value;
  const desc = document.getElementById('txn-desc').value.trim();

  if (!date) {
    toast('Date required', 'error');
    return;
  }
  if (!bankId && DB.banks.length > 0) {
    toast('Select a bank', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    toast('Enter valid amount', 'error');
    return;
  }
  if (type === 'Self Transfer' && bankId === toBankId) {
    toast('From and To bank must differ', 'error');
    return;
  }

  const bank = DB.banks.find(item => item.id === bankId);
  if (!bank && DB.banks.length > 0) {
    toast('Invalid bank', 'error');
    return;
  }

  if (id) {
    const old = DB.txns.find(item => item.id === id);
    revertTxnBalance(old);
    Object.assign(old, { date, type, bankId, toBankId, amount, category, mode, desc, bank: bank ? bank.name : '' });
    applyTxnBalance(old);
    toast('Transaction updated', 'success');
  } else {
    const txn = { id: uid(), date, type, bankId, toBankId, amount, category, mode, desc, bank: bank ? bank.name : '' };
    applyTxnBalance(txn);
    DB.txns.push(txn);
    toast('Transaction saved', 'success');
  }

  DB.save();
  closeModal('modal-txn');
  renderTransactions();
  renderBanks();
  renderDashboard();
}

function applyTxnBalance(txn) {
  const bank = DB.banks.find(item => item.id === txn.bankId);
  const toBank = DB.banks.find(item => item.id === txn.toBankId);
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
  const bank = DB.banks.find(item => item.id === txn.bankId);
  const toBank = DB.banks.find(item => item.id === txn.toBankId);
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
  renderTransactions();
  renderBanks();
  renderDashboard();
  toast('Transaction deleted');
}

function initFilterMonth() {
  const select = document.getElementById('filter-month');
  if (!select) return;
  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
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

  const typeMap = {
    'Income': 'income',
    'Expense': 'expense',
    'Self Transfer': 'transfer',
    'SIP / Investment': 'sip',
    'Loan EMI': 'emi'
  };

  const tbody = document.getElementById('txns-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No transactions found</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(txn => {
    const cls = typeMap[txn.type] || 'expense';
    const isIncome = txn.type === 'Income';
    const isTransfer = txn.type === 'Self Transfer';
    const color = isTransfer ? 'var(--blue)' : isIncome ? 'var(--green)' : 'var(--red)';
    const prefix = isTransfer ? '' : isIncome ? '+' : '-';
    const toBank = txn.type === 'Self Transfer'
      ? ` -> ${DB.banks.find(bank => bank.id === txn.toBankId)?.name || ''}`
      : '';

    return `<tr>
      <td>${fmtDate(txn.date)}</td>
      <td><span class="badge ${cls}">${txn.type}</span></td>
      <td>${txn.bank || '-'}${toBank}</td>
      <td>${txn.category}</td>
      <td>${txn.mode}</td>
      <td style="font-family:var(--font-head);font-weight:700;color:${color}">${prefix}${fmt(txn.amount)}</td>
      <td style="color:var(--text3)">${txn.desc || '-'}</td>
      <td>
        <button class="btn-edit" onclick="openTxnModal('${txn.id}')">Edit</button>
        <button class="btn-del" onclick="deleteTransaction('${txn.id}')">Del</button>
      </td>
    </tr>`;
  }).join('');
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
  const amount = parseFloat(document.getElementById('tr-amount').value);
  const remarks = document.getElementById('tr-remarks').value.trim();

  if (!date || !fromId || !toId || !amount || amount <= 0) {
    toast('Fill all fields', 'error');
    return;
  }
  if (fromId === toId) {
    toast('Select different banks', 'error');
    return;
  }

  const from = DB.banks.find(bank => bank.id === fromId);
  const to = DB.banks.find(bank => bank.id === toId);
  if (!from || !to) {
    toast('Invalid banks', 'error');
    return;
  }

  if (id) {
    const old = DB.transfers.find(item => item.id === id);
    const oldFrom = DB.banks.find(bank => bank.id === old.fromId);
    const oldTo = DB.banks.find(bank => bank.id === old.toId);
    if (oldFrom) oldFrom.current = Number(oldFrom.current) + Number(old.amount);
    if (oldTo) oldTo.current = Number(oldTo.current) - Number(old.amount);
    DB.txns = DB.txns.filter(txn => txn.transferId !== id);
    Object.assign(old, { date, fromId, toId, amount, remarks, from: from.name, to: to.name });
    applyTransfer(old, from, to);
    addTransferTxn(old);
    toast('Transfer updated', 'success');
  } else {
    const tr = { id: uid(), date, fromId, toId, amount, remarks, from: from.name, to: to.name };
    applyTransfer(tr, from, to);
    addTransferTxn(tr);
    DB.transfers.push(tr);
    toast('Transfer saved', 'success');
  }

  DB.save();
  closeModal('modal-transfer');
  renderTransfers();
  renderTransactions();
  renderBanks();
  renderDashboard();
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
    const from = DB.banks.find(bank => bank.id === tr.fromId);
    const to = DB.banks.find(bank => bank.id === tr.toId);
    if (from) from.current = Number(from.current) + Number(tr.amount);
    if (to) to.current = Number(to.current) - Number(tr.amount);
    DB.txns = DB.txns.filter(txn => txn.transferId !== id);
  }

  DB.transfers = DB.transfers.filter(item => item.id !== id);
  DB.save();
  renderTransfers();
  renderTransactions();
  renderBanks();
  renderDashboard();
  toast('Transfer deleted');
}

function renderTransfers() {
  const tbody = document.getElementById('transfers-tbody');
  const list = [...DB.transfers].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No transfers yet</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(tr => `
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
  `).join('');
}
