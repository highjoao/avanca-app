/* ===== AVANÇA DATA LAYER — SUPABASE + CACHE ===== */
const DB = {
  _cache: null,
  _userId: null,
  _saveTimer: null,
  _default: {
    user: { name: '', onboarded: false },
    expenses: [],
    incomes: [],
    cards: [],
    receivables: [],
    goals: [],
    tasks: [],
    projects: [],
    categories: ['Alimentação','Transporte','Moradia','Saúde','Educação','Lazer','Compras','Serviços','Assinaturas','Outros']
  },

  // Initialize: load data from Supabase into cache
  async init(userId) {
    this._userId = userId;
    try {
      const { data, error } = await supabaseClient
        .from('user_data')
        .select('data')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('DB init error:', error);
        // If row doesn't exist yet (race condition with trigger), create it
        if (error.code === 'PGRST116') {
          this._cache = JSON.parse(JSON.stringify(this._default));
          await supabaseClient.from('user_data').insert({
            id: userId,
            data: this._cache
          });
        } else {
          this._cache = JSON.parse(JSON.stringify(this._default));
        }
      } else {
        this._cache = data.data || JSON.parse(JSON.stringify(this._default));
      }
    } catch (err) {
      console.error('DB init failed:', err);
      this._cache = JSON.parse(JSON.stringify(this._default));
    }
    return this._cache;
  },

  // Synchronous read from cache — ALL views use this, no changes needed
  get() {
    if (!this._cache) {
      // Fallback: should not happen in normal flow
      this._cache = JSON.parse(JSON.stringify(this._default));
    }
    return this._cache;
  },

  // Write to cache + debounced async sync to Supabase
  save(data) {
    this._cache = data;
    this._syncToSupabase();
  },

  _syncToSupabase() {
    if (!this._userId) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      try {
        const { error } = await supabaseClient
          .from('user_data')
          .update({
            data: this._cache,
            updated_at: new Date().toISOString()
          })
          .eq('id', this._userId);
        if (error) console.error('Sync error:', error);
      } catch (err) {
        console.error('Sync failed:', err);
      }
    }, 600); // Debounce 600ms to batch rapid changes
  },

  set(key, val) {
    const d = this.get();
    d[key] = val;
    this.save(d);
  },

  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  // CRUD helpers — same API as before, views don't change
  addItem(collection, item) {
    const d = this.get();
    if (!d[collection]) d[collection] = [];
    item.id = this.uid();
    d[collection].push(item);
    this.save(d);
    return item;
  },

  updateItem(collection, id, updates) {
    const d = this.get();
    if (!d[collection]) return;
    const i = d[collection].findIndex(x => x.id === id);
    if (i >= 0) { Object.assign(d[collection][i], updates); this.save(d); }
  },

  deleteItem(collection, id) {
    const d = this.get();
    if (!d[collection]) return;
    d[collection] = d[collection].filter(x => x.id !== id);
    this.save(d);
  },

  getItem(collection, id) {
    const d = this.get();
    if (!d[collection]) return null;
    return d[collection].find(x => x.id === id) || null;
  },

  // Force immediate sync (used before logout)
  async flushSync() {
    if (!this._userId || !this._cache) return;
    clearTimeout(this._saveTimer);
    try {
      await supabaseClient
        .from('user_data')
        .update({ data: this._cache, updated_at: new Date().toISOString() })
        .eq('id', this._userId);
    } catch (err) {
      console.error('Flush sync failed:', err);
    }
  },

  // Clear cache on logout
  clear() {
    this._cache = null;
    this._userId = null;
    clearTimeout(this._saveTimer);
  }
};

/* ===== FINANCE HELPERS (unchanged) ===== */
const Finance = {
  currency(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  shortCurrency(v) {
    if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1).replace('.', ',') + 'k';
    return this.currency(v);
  },
  percent(v, t) { return t > 0 ? Math.round((v / t) * 100) : 0; },
  dateStr(d) {
    if (!d) return '';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  },
  dateFull(d) {
    if (!d) return '';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year:'numeric' });
  },
  daysUntil(d) {
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(d + 'T12:00:00'); target.setHours(0,0,0,0);
    return Math.ceil((target - now) / 86400000);
  },
  daysSince(d) { return -this.daysUntil(d); },
  today() { return new Date().toISOString().split('T')[0]; },
  monthLabel(d) {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  },

  // Credit card invoice logic
  getInvoiceMonth(cardClosing, cardDue, purchaseDate) {
    const d = new Date(purchaseDate + 'T12:00:00');
    let day = d.getDate();
    let m = d.getMonth();
    let y = d.getFullYear();

    // Closing month logic:
    if (day >= cardClosing) {
      m++;
      if (m > 11) { m = 0; y++; }
    }

    // Due month logic:
    if (cardDue <= cardClosing) {
      m++;
      if (m > 11) { m = 0; y++; }
    }

    return { month: m, year: y };
  },

  getInvoiceDueDate(cardClosing, cardDue, purchaseDate) {
    const inv = this.getInvoiceMonth(cardClosing, cardDue, purchaseDate);
    return new Date(inv.year, inv.month, cardDue).toISOString().split('T')[0];
  },

  calcInterest(principal, interest, daysOverdue) {
    if (!interest || interest.type === 'none') return 0;
    if (interest.type === 'fixed') {
      const periods = interest.freq === 'day' ? daysOverdue :
                      interest.freq === 'week' ? Math.floor(daysOverdue / 7) :
                      interest.freq === 'month' ? Math.floor(daysOverdue / 30) :
                      interest.freq === 'installment' ? 1 : 1;
      return interest.value * Math.max(periods, 0);
    }
    if (interest.type === 'percent') {
      const periods = interest.freq === 'day' ? daysOverdue :
                      interest.freq === 'week' ? Math.floor(daysOverdue / 7) :
                      interest.freq === 'month' ? Math.floor(daysOverdue / 30) : 1;
      return principal * (interest.value / 100) * Math.max(periods, 0);
    }
    return 0;
  },

  getReceivableTotal(r) {
    const remaining = r.amount - (r.downPayment || 0) - r.paid;
    if (remaining <= 0) return { original: r.amount, interest: 0, total: 0, remaining: 0 };
    const days = r.dueDate ? this.daysSince(r.dueDate) : 0;
    const interestAmt = days > 0 ? this.calcInterest(remaining, r.interest, days) : 0;
    return { original: r.amount, interest: interestAmt, total: remaining + interestAmt, remaining };
  },

  getCardExpenses(cardId) {
    return DB.get().expenses.filter(e => e.card === cardId);
  },

  getCardInvoiceAmount(card, targetMonth, targetYear) {
    const expenses = this.getCardExpenses(card.id);
    const now = new Date();
    const m = targetMonth !== undefined ? targetMonth : now.getMonth();
    const y = targetYear !== undefined ? targetYear : now.getFullYear();
    let total = 0;
    expenses.forEach(e => {
      if (e.installments) {
        const baseInv = this.getInvoiceMonth(card.closing, card.due, e.date);
        const diffMonths = (y - baseInv.year) * 12 + (m - baseInv.month);
        if (diffMonths >= 0 && diffMonths < e.installments.total) {
          total += e.installments.amount;
        }
      } else {
        const inv = this.getInvoiceMonth(card.closing, card.due, e.date);
        if (inv.month === m && inv.year === y) total += e.amount;
      }
    });
    return total;
  },

  getCardInvoiceForMonth(card, month, year) {
    const expenses = this.getCardExpenses(card.id);
    const items = [];
    let total = 0;
    expenses.forEach(e => {
      if (e.installments) {
        const baseInv = this.getInvoiceMonth(card.closing, card.due, e.date);
        const diffMonths = (year - baseInv.year) * 12 + (month - baseInv.month);
        if (diffMonths >= 0 && diffMonths < e.installments.total) {
          items.push({ ...e, invoiceAmount: e.installments.amount, installmentN: diffMonths + 1 });
          total += e.installments.amount;
        }
      } else {
        const inv = this.getInvoiceMonth(card.closing, card.due, e.date);
        if (inv.month === month && inv.year === year) {
          items.push({ ...e, invoiceAmount: e.amount });
          total += e.amount;
        }
      }
    });
    // Sort items so newest purchase date appears first
    items.sort((a, b) => b.date.localeCompare(a.date));
    return { total, items };
  },

  getCardInvoiceTimeline(card, monthsBefore = 2, monthsAfter = 4) {
    const now = new Date();
    const timeline = [];
    for (let i = -monthsBefore; i <= monthsAfter; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const total = this.getCardInvoiceAmount(card, m, y);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const isCurrent = i === 0;
      timeline.push({ month: m, year: y, total, label, isCurrent });
    }
    return timeline;
  },

  // ===== DATE FILTER =====
  filterByDate(items, filterKey, dateField) {
    dateField = dateField || 'date';
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    let start, end;

    switch (filterKey) {
      case 'current-month':
        start = new Date(thisYear, thisMonth, 1);
        end = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
        break;
      case 'last-7':
        start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
        end = new Date(now); end.setHours(23,59,59);
        break;
      case 'last-15':
        start = new Date(now); start.setDate(start.getDate() - 15); start.setHours(0,0,0,0);
        end = new Date(now); end.setHours(23,59,59);
        break;
      case 'last-30':
        start = new Date(now); start.setDate(start.getDate() - 30); start.setHours(0,0,0,0);
        end = new Date(now); end.setHours(23,59,59);
        break;
      case 'last-3months':
        start = new Date(thisYear, thisMonth - 2, 1);
        end = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
        break;
      default:
        // Month number (0-11): e.g. "month-0" = January
        if (filterKey && filterKey.startsWith('month-')) {
          const m = parseInt(filterKey.split('-')[1]);
          start = new Date(thisYear, m, 1);
          end = new Date(thisYear, m + 1, 0, 23, 59, 59);
          break;
        }
        // Custom range: "custom-YYYY-MM-DD_YYYY-MM-DD"
        if (filterKey && filterKey.startsWith('custom-')) {
          const parts = filterKey.replace('custom-', '').split('_');
          start = new Date(parts[0] + 'T00:00:00');
          end = new Date(parts[1] + 'T23:59:59');
          break;
        }
        // Default: current month
        start = new Date(thisYear, thisMonth, 1);
        end = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
    }

    return items.filter(item => {
      if (!item[dateField]) return false;
      const d = new Date(item[dateField] + 'T12:00:00');
      return d >= start && d <= end;
    });
  },

  getFilterLabel(filterKey) {
    const now = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    switch (filterKey) {
      case 'current-month': return months[now.getMonth()];
      case 'last-7': return 'Últimos 7 dias';
      case 'last-15': return 'Últimos 15 dias';
      case 'last-30': return 'Últimos 30 dias';
      case 'last-3months': return 'Últimos 3 meses';
      default:
        if (filterKey && filterKey.startsWith('month-')) {
          return months[parseInt(filterKey.split('-')[1])];
        }
        if (filterKey && filterKey.startsWith('custom-')) return 'Personalizado';
        return months[now.getMonth()];
    }
  },

  paymentLabel(p) {
    return { credit:'Crédito', debit:'Débito', pix:'PIX', dinheiro:'Dinheiro', fatura:'Pagto. Fatura' }[p] || p;
  }
};
