/* ===== DASHBOARD VIEW ===== */
const DashboardView = {
  dateFilter: 'current-month',

  render() {
    const data = DB.get();
    const fk = this.dateFilter;

    // Filter by date
    const expenses = Finance.filterByDate(data.expenses, fk);
    const incomes = Finance.filterByDate(data.incomes, fk);
    const recv = data.receivables, cards = data.cards, goals = data.goals, tasks = data.tasks;

    // Separate credit from real cash expenses
    const cashExpenses = expenses.filter(e => e.payment !== 'credit');
    const creditExpenses = expenses.filter(e => e.payment === 'credit');
    const totalIncome = incomes.reduce((s,i) => s + i.amount, 0);
    const totalCashExpense = cashExpenses.reduce((s,e) => s + e.amount, 0);
    const totalCreditExpense = creditExpenses.reduce((s,e) => e.installments ? s + e.installments.amount : s + e.amount, 0);
    const balance = totalIncome - totalCashExpense;
    const healthPct = totalIncome > 0 ? Finance.percent(totalCashExpense, totalIncome) : 0;

    // Cards summary
    let totalInvoice = 0, totalLimit = 0;
    cards.forEach(c => {
      if (c.limit) totalLimit += c.limit;
      totalInvoice += Finance.getCardInvoiceAmount(c);
    });

    // Receivables summary
    let totalRecv = 0, totalOverdue = 0, overdueCount = 0;
    recv.forEach(r => {
      const t = Finance.getReceivableTotal(r);
      totalRecv += t.total;
      if (r.status === 'overdue' || (r.dueDate && Finance.daysUntil(r.dueDate) < 0 && t.total > 0)) {
        totalOverdue += t.total; overdueCount++;
      }
    });

    // Goals
    const activeGoals = goals.filter(g => g.current < g.target);
    const topGoal = activeGoals.sort((a,b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))[0];

    // Today tasks
    const todayStr = Finance.today();
    const todayTasks = tasks.filter(t => t.date === todayStr);

    // Alerts
    const alerts = this.generateAlerts(data);

    // Update notification badge
    const badgeEl = document.getElementById('notif-badge');
    if (badgeEl) {
      badgeEl.textContent = alerts.length;
      badgeEl.style.display = alerts.length > 0 ? '' : 'none';
    }

    // Health message
    let healthMsg, healthCls;
    if (balance > 0) { healthMsg = `Seu saldo este período está positivo em ${Finance.currency(balance)}`; healthCls = 'text-success'; }
    else if (balance === 0) { healthMsg = 'Seus gastos estão iguais aos ganhos.'; healthCls = 'text-warning'; }
    else { healthMsg = `Atenção: você gastou ${Finance.currency(Math.abs(balance))} a mais do que ganhou.`; healthCls = 'text-danger'; }

    const invoicePct = totalIncome > 0 ? Finance.percent(totalInvoice, totalIncome) : 0;
    if (invoicePct > 30) {
      healthMsg += ` Suas faturas comprometem ${invoicePct}% da sua renda.`;
    }

    // Date filter options
    const now = new Date();
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const curMonth = now.getMonth();
    const filterOptions = [
      { key: 'current-month', label: monthNames[curMonth] + ' (atual)' },
      { key: `month-${(curMonth - 1 + 12) % 12}`, label: monthNames[(curMonth - 1 + 12) % 12] },
      { key: `month-${(curMonth + 1) % 12}`, label: monthNames[(curMonth + 1) % 12] },
      { key: 'last-7', label: 'Últimos 7 dias' },
      { key: 'last-15', label: 'Últimos 15 dias' },
      { key: 'last-30', label: 'Últimos 30 dias' },
      { key: 'last-3months', label: 'Últimos 3 meses' },
    ];

    return `
      <section>
        <h2 class="font-h fs-24 fw-700">Olá, ${data.user.name}</h2>
        <p class="fs-14 text-muted mt-4">Sua visão geral de hoje</p>
      </section>

      <!-- Date Filter -->
      <div class="date-filter-bar">
        <button class="date-filter-btn" onclick="DashboardView.toggleFilterMenu()">
          ${UI.icon('calendar_month','fs-16')}
          <span>${Finance.getFilterLabel(fk)}</span>
          ${UI.icon('expand_more','fs-16')}
        </button>
        <div class="date-filter-menu hidden" id="dash-filter-menu">
          ${filterOptions.map(o => `<button class="date-filter-opt ${o.key === fk ? 'active' : ''}" onclick="DashboardView.setDateFilter('${o.key}')">${o.label}</button>`).join('')}
          <button class="date-filter-opt" onclick="DashboardView.showCustomRange()">Período personalizado</button>
        </div>
      </div>

      <!-- Health Card -->
      <section class="glass" style="position:relative;overflow:hidden">
        <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:${balance >= 0 ? 'var(--primary-glow)' : 'rgba(224,90,90,.15)'};filter:blur(30px)"></div>
        <div class="flex justify-between items-center" style="position:relative;z-index:1">
          <div>
            <div class="summary-label">SALDO DO PERÍODO</div>
            <div class="font-h fs-28 fw-700 mt-4 ${healthCls}">${Finance.currency(balance)}</div>
          </div>
          <div class="icon-box ${balance >= 0 ? 'success' : 'danger'}">${UI.icon(balance >= 0 ? 'trending_up' : 'trending_down')}</div>
        </div>
        <div class="divider"></div>
        <div class="grid-2" style="position:relative;z-index:1">
          <div>
            <div class="flex items-center gap-4"><div style="width:8px;height:8px;border-radius:50%;background:var(--primary)"></div><span class="fs-11 text-muted">Ganhos</span></div>
            <div class="font-h fs-18 fw-600 mt-4">${Finance.currency(totalIncome)}</div>
          </div>
          <div>
            <div class="flex items-center gap-4"><div style="width:8px;height:8px;border-radius:50%;background:var(--danger)"></div><span class="fs-11 text-muted">Gastos</span></div>
            <div class="font-h fs-18 fw-600 mt-4">${Finance.currency(totalCashExpense)}</div>
          </div>
        </div>
        ${UI.progress(healthPct, healthPct > 80 ? 'danger' : healthPct > 60 ? 'warning' : 'green', true)}
        <p class="fs-12 text-muted mt-8" style="line-height:1.4;position:relative;z-index:1">${healthMsg}</p>
      </section>

      <!-- Credit Card Spending (separate) -->
      ${totalCreditExpense > 0 ? `<section class="glass glass-sm" style="border-left:3px solid var(--secondary)">
        <div class="flex justify-between items-center">
          <div>
            <div class="fs-11 text-muted">GASTOS EM CARTÕES DE CRÉDITO</div>
            <div class="font-h fs-20 fw-700 mt-4 text-secondary">${Finance.currency(totalCreditExpense)}</div>
          </div>
          <div class="icon-box accent">${UI.icon('credit_card')}</div>
        </div>
        <div class="fs-11 text-muted mt-4">Não afeta o saldo — entra na fatura do cartão</div>
      </section>` : ''}

      <!-- Cards Summary -->
      <section>
        <div class="section-header"><span class="section-title">Cartões</span><span class="section-link" onclick="App.navigate('cards')">Ver todos</span></div>
        <div class="scroll-x flex gap-12" style="padding:4px 0">
          ${cards.map(c => this.renderCardMini(c)).join('')}
          ${cards.length === 0 ? `<div class="glass glass-sm w-full">${UI.emptyState('credit_card','Nenhum cartão','Adicione seu primeiro cartão')}</div>` : ''}
        </div>
      </section>

      <!-- Attention Section -->
      <section>
        <div class="section-header"><span class="section-title">Atenção</span></div>
        <div class="grid-2">
          ${UI.summaryCard('Faturas', Finance.currency(totalInvoice), 'text-secondary')}
          ${UI.summaryCard('A Receber', Finance.currency(totalRecv), 'text-primary')}
          ${UI.summaryCard('Atrasados', Finance.currency(totalOverdue), totalOverdue > 0 ? 'text-danger' : '')}
          ${UI.summaryCard('Pessoas devendo', overdueCount.toString(), overdueCount > 0 ? 'text-warning' : '')}
        </div>
      </section>

      <!-- Alerts -->
      ${alerts.length ? `<section>
        <div class="section-header"><span class="section-title">Alertas inteligentes</span></div>
        ${alerts.slice(0, 5).join('')}
      </section>` : ''}

      <!-- Goal -->
      ${topGoal ? `<section>
        <div class="section-header"><span class="section-title">Meta prioritária</span><span class="section-link" onclick="App.navigate('goals')">Ver metas</span></div>
        <div class="glass">
          <div class="flex items-center gap-12">
            <div class="icon-box" style="background:${topGoal.color}22;color:${topGoal.color}">${UI.icon(topGoal.icon || 'flag')}</div>
            <div class="flex-1">
              <div class="fs-15 fw-600">${topGoal.name}</div>
              <div class="fs-12 text-muted mt-4">${topGoal.current} / ${topGoal.target} ${topGoal.unit}</div>
            </div>
            <div class="font-h fs-16 fw-700" style="color:${topGoal.color}">${Finance.percent(topGoal.current, topGoal.target)}%</div>
          </div>
          ${UI.progress(Finance.percent(topGoal.current, topGoal.target), 'green', true)}
          ${this.goalPace(topGoal)}
        </div>
      </section>` : ''}

      <!-- Today -->
      <section>
        <div class="section-header"><span class="section-title">Hoje</span><span class="section-link" onclick="App.navigate('planning')">Planejamento</span></div>
        <div class="glass">
          ${todayTasks.length === 0 ? '<div class="fs-13 text-muted">Nenhuma tarefa para hoje.</div>' :
            todayTasks.map(t => `<div class="flex items-center gap-10" style="padding:8px 0;border-bottom:1px solid var(--card-border)">
              <button class="icon-box ${t.status === 'completed' ? 'success' : 'secondary'}" onclick="DashboardView.toggleTask('${t.id}')" style="width:32px;height:32px;border-radius:8px">
                ${UI.icon(t.status === 'completed' ? 'check_circle' : 'radio_button_unchecked')}
              </button>
              <div class="flex-1"><div class="fs-14 fw-500 ${t.status === 'completed' ? 'text-dim' : ''}" style="${t.status === 'completed' ? 'text-decoration:line-through' : ''}">${t.name}</div>
              ${t.time ? `<div class="fs-11 text-muted">${t.time}</div>` : ''}</div>
              ${t.priority === 'high' ? UI.badge('!', 'danger') : ''}
            </div>`).join('')}
          <div class="flex justify-between items-center mt-12">
            <span class="fs-12 text-muted">${todayTasks.filter(t=>t.status==='completed').length}/${todayTasks.length} concluídas</span>
            ${UI.progress(Finance.percent(todayTasks.filter(t=>t.status==='completed').length, todayTasks.length), 'blue')}
          </div>
        </div>
      </section>

      <!-- Insight -->
      <section class="glass insight-card" style="border-radius:var(--radius)">
        <div class="flex gap-12 items-center">
          <div class="icon-box accent">${UI.icon('auto_awesome')}</div>
          <div>
            <div class="fs-14 fw-600" style="color:var(--accent)">Insight do dia</div>
            <p class="fs-12 text-muted mt-4" style="line-height:1.5">${this.getInsight(data, totalIncome, totalCashExpense)}</p>
          </div>
        </div>
      </section>
    `;
  },

  // ===== Date Filter =====
  toggleFilterMenu() {
    const menu = document.getElementById('dash-filter-menu');
    menu.classList.toggle('hidden');
    // Close on outside click
    if (!menu.classList.contains('hidden')) {
      setTimeout(() => {
        const close = (e) => { if (!menu.contains(e.target)) { menu.classList.add('hidden'); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
      }, 10);
    }
  },

  setDateFilter(key) {
    this.dateFilter = key;
    document.getElementById('dash-filter-menu')?.classList.add('hidden');
    App.refresh();
  },

  showCustomRange() {
    document.getElementById('dash-filter-menu')?.classList.add('hidden');
    UI.modal.show(`
      <h3 class="modal-title">Período personalizado</h3>
      <div class="form-row">
        ${UI.formField('De','custom-start','date',{required:true, value:Finance.today()})}
        ${UI.formField('Até','custom-end','date',{required:true, value:Finance.today()})}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="DashboardView.applyCustomRange()">Aplicar</button>
      </div>
    `);
  },

  applyCustomRange() {
    const start = UI.getVal('custom-start');
    const end = UI.getVal('custom-end');
    if (!start || !end) { UI.toast('Selecione as datas','error'); return; }
    this.dateFilter = `custom-${start}_${end}`;
    UI.modal.hide();
    App.refresh();
  },

  renderCardMini(c) {
    const inv = Finance.getCardInvoiceAmount(c);
    const hasLimit = c.limit && c.limit > 0;
    const usedPct = hasLimit ? Finance.percent(inv, c.limit) : 0;
    return `<div class="glass glass-sm shrink-0" style="min-width:240px;cursor:pointer" onclick="App.navigate('cards')">
      <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:${c.color}22"></div>
      <div class="flex justify-between items-center" style="position:relative;z-index:1">
        <span class="fs-14 fw-600">${c.name}</span>
        ${UI.icon('credit_card', 'fs-18')}
      </div>
      <div class="font-h fs-20 fw-700 mt-8" style="position:relative;z-index:1">${Finance.currency(inv)}</div>
      <div class="fs-11 text-muted mt-4">${hasLimit ? 'Limite: ' + Finance.currency(c.limit) : 'Limite não informado'}</div>
      ${hasLimit ? UI.progress(usedPct, usedPct > 80 ? 'danger' : usedPct > 50 ? 'warning' : 'blue') : ''}
    </div>`;
  },

  goalPace(g) {
    const days = Finance.daysUntil(g.endDate);
    const remaining = g.target - g.current;
    if (remaining <= 0) return `<div class="fs-12 text-success mt-8 fw-600">✓ Meta concluída!</div>`;
    if (days <= 0) return `<div class="fs-12 text-danger mt-8">Prazo encerrado</div>`;
    const pace = (remaining / days).toFixed(1);
    return `<div class="fs-12 text-muted mt-8">Ritmo necessário: <strong>${pace} ${g.unit}/dia</strong> · ${days} dias restantes</div>`;
  },

  generateAlerts(data) {
    const alerts = [];
    data.cards.forEach(c => {
      const inv = Finance.getCardInvoiceAmount(c);
      if (inv > 0) {
        const now = new Date();
        const dueDate = new Date(now.getFullYear(), now.getMonth(), c.due);
        const days = Finance.daysUntil(dueDate.toISOString().split('T')[0]);
        if (days >= 0 && days <= 5) alerts.push(UI.alertItem(`Sua fatura ${c.name} vence em ${days} dias. Valor: ${Finance.currency(inv)}`, 'warn', 'credit_card'));
        if (days < 0) alerts.push(UI.alertItem(`Fatura ${c.name} está vencida! Valor: ${Finance.currency(inv)}`, 'danger', 'credit_card'));
      }
      if (c.limit && inv > c.limit * 0.8) alerts.push(UI.alertItem(`Cartão ${c.name} está com ${Finance.percent(inv, c.limit)}% do limite utilizado.`, 'warn', 'credit_card'));
    });
    data.receivables.forEach(r => {
      const t = Finance.getReceivableTotal(r);
      if (t.total > 0 && r.dueDate && Finance.daysUntil(r.dueDate) < 0) {
        alerts.push(UI.alertItem(`${r.person} está com pagamento atrasado há ${Finance.daysSince(r.dueDate)} dias. Total: ${Finance.currency(t.total)}`, 'danger', 'person'));
      }
    });
    data.goals.forEach(g => {
      if (g.endDate && Finance.daysUntil(g.endDate) >= 0 && Finance.daysUntil(g.endDate) <= 7 && g.current < g.target) {
        alerts.push(UI.alertItem(`Meta "${g.name}" vence em ${Finance.daysUntil(g.endDate)} dias.`, 'warn', 'flag'));
      }
    });
    data.tasks.forEach(t => {
      if (t.date && t.status === 'pending' && Finance.daysUntil(t.date) < 0) {
        alerts.push(UI.alertItem(`Tarefa "${t.name}" está atrasada.`, 'warn', 'task_alt'));
      }
    });
    const totalRecv7 = data.receivables.filter(r => { const d = Finance.daysUntil(r.dueDate); return d >= 0 && d <= 7 && Finance.getReceivableTotal(r).total > 0; }).reduce((s,r) => s + Finance.getReceivableTotal(r).total, 0);
    if (totalRecv7 > 0) alerts.push(UI.alertItem(`Você tem ${Finance.currency(totalRecv7)} para receber nos próximos 7 dias.`, 'info', 'payments'));
    return alerts;
  },

  topCategory(expenses) {
    const cats = {};
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return sorted.length ? { name: sorted[0][0], total: sorted[0][1] } : null;
  },

  getInsight(data, totalIncome, totalExpense) {
    const insights = [
      `Você registrou ${data.expenses.length} gastos e ${data.incomes.length} ganhos neste período.`,
      `Mantenha o controle diário para ter clareza total sobre seu dinheiro.`,
      `Revisar suas cobranças semanalmente ajuda a não perder prazos.`,
    ];
    if (totalIncome > totalExpense) insights.unshift(`Parabéns! Seu saldo está positivo. Continue assim para alcançar suas metas mais rápido.`);
    else insights.unshift(`Seus gastos superaram os ganhos. Revise suas categorias e identifique onde pode economizar.`);
    return insights[0];
  },

  toggleTask(id) {
    const t = DB.getItem('tasks', id);
    if (t) {
      DB.updateItem('tasks', id, { status: t.status === 'completed' ? 'pending' : 'completed' });
      App.refresh();
    }
  }
};
