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
  getInvoiceMonth(cardClosing, purchaseDate) {
    const d = new Date(purchaseDate + 'T12:00:00');
    const day = d.getDate();
    let m = d.getMonth(), y = d.getFullYear();
    if (day >= cardClosing) { m++; if (m > 11) { m = 0; y++; } }
    return { month: m, year: y };
  },

  getInvoiceDueDate(cardClosing, cardDue, purchaseDate) {
    const inv = this.getInvoiceMonth(cardClosing, purchaseDate);
    let dueM = inv.month, dueY = inv.year;
    if (cardDue <= cardClosing) { dueM++; if (dueM > 11) { dueM = 0; dueY++; } }
    return new Date(dueY, dueM, cardDue).toISOString().split('T')[0];
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

  getCardInvoiceAmount(card) {
    const expenses = this.getCardExpenses(card.id);
    let total = 0;
    const now = new Date();
    expenses.forEach(e => {
      if (e.installments) {
        total += e.installments.amount;
      } else {
        const inv = this.getInvoiceMonth(card.closing, e.date);
        if (inv.month === now.getMonth() && inv.year === now.getFullYear()) {
          total += e.amount;
        }
      }
    });
    return total;
  }
};
