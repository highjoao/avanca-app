/* ===== DASHBOARD VIEW ===== */
const DashboardView = {
  render() {
    const data = DB.get();
    const expenses = data.expenses, incomes = data.incomes, cards = data.cards, recv = data.receivables, goals = data.goals, tasks = data.tasks;
    const totalIncome = incomes.reduce((s,i) => s + i.amount, 0);
    const totalExpense = expenses.reduce((s,e) => s + e.amount, 0);
    const balance = totalIncome - totalExpense;
    const healthPct = totalIncome > 0 ? Finance.percent(totalExpense, totalIncome) : 0;

    // Cards summary
    let totalInvoice = 0, totalLimit = 0, totalUsed = 0;
    cards.forEach(c => {
      totalLimit += c.limit;
      const inv = Finance.getCardInvoiceAmount(c);
      totalInvoice += inv;
      totalUsed += inv;
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
    const pendingTasks = todayTasks.filter(t => t.status === 'pending');

    // Alerts
    const alerts = this.generateAlerts(data);

    // Health message
    let healthMsg, healthCls;
    if (balance > 0) { healthMsg = `Seu saldo este mês está positivo em ${Finance.currency(balance)}`; healthCls = 'text-success'; }
    else if (balance === 0) { healthMsg = 'Seus gastos estão iguais aos ganhos.'; healthCls = 'text-warning'; }
    else { healthMsg = `Atenção: você gastou ${Finance.currency(Math.abs(balance))} a mais do que ganhou.`; healthCls = 'text-danger'; }

    const invoicePct = totalIncome > 0 ? Finance.percent(totalInvoice, totalIncome) : 0;
    if (invoicePct > 30) {
      healthMsg += ` Suas faturas comprometem ${invoicePct}% da sua renda.`;
    }

    return `
      <section>
        <h2 class="font-h fs-24 fw-700">Olá, ${data.user.name}</h2>
        <p class="fs-14 text-muted mt-4">Sua visão geral de hoje</p>
      </section>

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
            <div class="font-h fs-18 fw-600 mt-4">${Finance.currency(totalExpense)}</div>
          </div>
        </div>
        ${UI.progress(healthPct, healthPct > 80 ? 'danger' : healthPct > 60 ? 'warning' : 'green', true)}
        <p class="fs-12 text-muted mt-8" style="line-height:1.4;position:relative;z-index:1">${healthMsg}</p>
      </section>

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
            <p class="fs-12 text-muted mt-4" style="line-height:1.5">${this.getInsight(data)}</p>
          </div>
        </div>
      </section>
    `;
  },

  renderCardMini(c) {
    const inv = Finance.getCardInvoiceAmount(c);
    const usedPct = Finance.percent(inv, c.limit);
    return `<div class="glass glass-sm shrink-0" style="min-width:240px;cursor:pointer" onclick="App.navigate('cards')">
      <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:${c.color}22"></div>
      <div class="flex justify-between items-center" style="position:relative;z-index:1">
        <span class="fs-14 fw-600">${c.name}</span>
        ${UI.icon('credit_card', 'fs-18')}
      </div>
      <div class="font-h fs-20 fw-700 mt-8" style="position:relative;z-index:1">${Finance.currency(inv)}</div>
      <div class="fs-11 text-muted mt-4">Limite: ${Finance.currency(c.limit)}</div>
      ${UI.progress(usedPct, usedPct > 80 ? 'danger' : usedPct > 50 ? 'warning' : 'blue')}
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
      }
    });
    data.receivables.forEach(r => {
      const t = Finance.getReceivableTotal(r);
      if (t.total > 0 && r.dueDate && Finance.daysUntil(r.dueDate) < 0) {
        alerts.push(UI.alertItem(`${r.person} está com pagamento atrasado há ${Finance.daysSince(r.dueDate)} dias. Total: ${Finance.currency(t.total)}`, 'danger', 'person'));
      }
    });
    const totalRecv7 = data.receivables.filter(r => { const d = Finance.daysUntil(r.dueDate); return d >= 0 && d <= 7 && Finance.getReceivableTotal(r).total > 0; }).reduce((s,r) => s + Finance.getReceivableTotal(r).total, 0);
    if (totalRecv7 > 0) alerts.push(UI.alertItem(`Você tem ${Finance.currency(totalRecv7)} para receber nos próximos 7 dias.`, 'info', 'payments'));
    const topCat = this.topCategory(data.expenses);
    if (topCat) alerts.push(UI.alertItem(`Sua maior categoria de gasto é ${topCat.name} (${Finance.currency(topCat.total)}).`, 'info', 'category'));
    return alerts;
  },

  topCategory(expenses) {
    const cats = {};
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return sorted.length ? { name: sorted[0][0], total: sorted[0][1] } : null;
  },

  getInsight(data) {
    const insights = [
      `Você registrou ${data.expenses.length} gastos e ${data.incomes.length} ganhos este período.`,
      `Mantenha o controle diário para ter clareza total sobre seu dinheiro.`,
      `Revisar suas cobranças semanalmente ajuda a não perder prazos.`,
    ];
    const totalIncome = data.incomes.reduce((s,i) => s + i.amount, 0);
    const totalExpense = data.expenses.reduce((s,e) => s + e.amount, 0);
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
