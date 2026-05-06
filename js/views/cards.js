/* ===== CARDS VIEW — FULL EXPENSE MANAGEMENT ===== */
const CardsView = {
  selectedCard: null,
  invoiceMonth: null, // null = current

  render() {
    if (this.selectedCard) return this.renderDetail(this.selectedCard);
    const data = DB.get();
    const cards = data.cards;
    let totalInvoice = 0, totalLimit = 0;
    cards.forEach(c => { totalInvoice += Finance.getCardInvoiceAmount(c); totalLimit += c.limit; });
    return `
      <section><h2 class="font-h fs-24 fw-700">Cartões</h2><p class="fs-14 text-muted mt-4">Gerencie seus cartões e faturas</p></section>
      <section class="summary-grid">
        ${UI.summaryCard('Total faturas', Finance.currency(totalInvoice), 'text-secondary')}
        ${UI.summaryCard('Limite total', Finance.currency(totalLimit))}
        ${UI.summaryCard('Limite usado', Finance.currency(totalInvoice), totalInvoice > totalLimit*.7 ? 'text-danger' : '')}
        ${UI.summaryCard('Disponível', Finance.currency(totalLimit - totalInvoice), 'text-success')}
      </section>
      <section>
        ${cards.length === 0 ? UI.emptyState('credit_card','Nenhum cartão cadastrado','Adicione seu primeiro cartão.') :
          cards.map(c => this.renderCardItem(c)).join('')}
      </section>
      <button class="btn btn-secondary btn-block mt-12" onclick="CardsView.showForm()">${UI.icon('add')} Adicionar cartão</button>
    `;
  },

  renderCardItem(c) {
    const inv = Finance.getCardInvoiceAmount(c);
    const usedPct = Finance.percent(inv, c.limit);
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), c.due);
    const days = Finance.daysUntil(dueDate.toISOString().split('T')[0]);
    const statusLabel = days < 0 ? 'Vencida' : days <= 3 ? 'Vence em breve' : 'Em dia';
    const statusType = days < 0 ? 'danger' : days <= 3 ? 'warning' : 'success';

    return `<div class="glass mb-8" style="cursor:pointer" onclick="CardsView.select('${c.id}')">
      <div class="card-visual" style="background:linear-gradient(135deg,${c.color},${c.color}99);min-height:100px;margin:-18px -18px 14px;padding:18px;border-radius:var(--radius) var(--radius) 0 0">
        <div class="flex justify-between items-center"><span class="card-brand">${c.bank}</span>${UI.badge(statusLabel, statusType)}</div>
        <div class="card-number mt-12">•••• •••• •••• ••••</div>
        <div class="card-bottom"><div><div class="card-label">CARTÃO</div><div class="card-val">${c.name}</div></div><div style="text-align:right"><div class="card-label">VENCIMENTO</div><div class="card-val">Dia ${c.due}</div></div></div>
      </div>
      <div class="grid-2">
        <div><div class="fs-11 text-muted">Fatura atual</div><div class="font-h fs-18 fw-700 mt-4">${Finance.currency(inv)}</div></div>
        <div style="text-align:right"><div class="fs-11 text-muted">Disponível</div><div class="font-h fs-18 fw-700 mt-4 text-success">${Finance.currency(c.limit-inv)}</div></div>
      </div>
      ${UI.progress(usedPct, usedPct>80?'danger':usedPct>50?'warning':'blue', true)}
      <div class="flex justify-between mt-8"><span class="fs-11 text-muted">Fecha dia ${c.closing}</span><span class="fs-11 text-muted">Vence dia ${c.due}</span></div>
    </div>`;
  },

  // ===== CARD DETAIL =====
  renderDetail(cardId) {
    const data = DB.get();
    const c = data.cards.find(x => x.id === cardId);
    if (!c) { this.selectedCard = null; return this.render(); }
    const expenses = data.expenses.filter(e => e.card === cardId).sort((a,b) => b.date.localeCompare(a.date));
    const inv = Finance.getCardInvoiceAmount(c);
    const hasLimit = c.limit && c.limit > 0;
    const usedPct = hasLimit ? Finance.percent(inv, c.limit) : 0;
    const installments = expenses.filter(e => e.installments);
    let futureCommitted = 0;
    installments.forEach(e => { if(e.installments) futureCommitted += e.installments.amount * (e.installments.total - e.installments.current); });

    return `
      <section>
        <div class="flex items-center gap-10">
          <button class="icon-box secondary" onclick="CardsView.back()" style="width:36px;height:36px;border-radius:10px">${UI.icon('arrow_back')}</button>
          <div class="flex-1"><h2 class="font-h fs-20 fw-700">${c.name}</h2><p class="fs-12 text-muted">${c.bank}</p></div>
          <button onclick="CardsView.editCard('${c.id}')" style="padding:4px">${UI.icon('edit','text-muted fs-20')}</button>
        </div>
      </section>

      <section class="card-visual" style="background:linear-gradient(135deg,${c.color},${c.color}99);border-radius:var(--radius);padding:20px">
        <div class="flex justify-between"><span class="card-brand">${c.bank}</span></div>
        <div class="card-number mt-16">•••• •••• •••• ••••</div>
        <div class="card-bottom"><div><div class="card-label">FECHAMENTO</div><div class="card-val">Dia ${c.closing}</div></div><div style="text-align:right"><div class="card-label">VENCIMENTO</div><div class="card-val">Dia ${c.due}</div></div></div>
      </section>

      <section class="summary-grid">
        ${UI.summaryCard('Fatura atual', Finance.currency(inv), 'text-secondary')}
        ${UI.summaryCard('Limite', hasLimit ? Finance.currency(c.limit) : 'N/I')}
        ${UI.summaryCard('Disponível', hasLimit ? Finance.currency(c.limit-inv) : 'N/I', hasLimit ? 'text-success' : '')}
        ${UI.summaryCard('Comprometido', Finance.currency(futureCommitted), 'text-warning')}
      </section>

      <section>
        <button class="btn btn-primary btn-block" onclick="CardsView.showExpenseForm('${c.id}')">${UI.icon('add')} Lançar gasto neste cartão</button>
      </section>

      <section>
        <div class="section-header mb-8"><span class="font-h fs-18 fw-700">Faturas</span></div>
        
        <div class="glass mb-8">
          <div class="fs-13 text-muted mb-4">Fatura atual</div>
          <div class="flex justify-between items-center">
            <div class="font-h fs-20 fw-700 ${inv > 0 ? 'text-danger' : ''}">${Finance.currency(inv)}</div>
            ${inv > 0 ? `<button class="btn btn-secondary btn-sm" onclick="CardsView.payInvoice('${c.id}')">Pagar</button>` : '<span class="fs-12 text-success">Fechada/Sem gastos</span>'}
          </div>
        </div>

        <div class="mb-12">
          <div class="fs-14 fw-600 mb-8">Próximas faturas</div>
          ${this.renderFutureInvoices(c)}
        </div>

        <div>
          <div class="fs-14 fw-600 mb-8">Histórico (Pagas)</div>
          ${this.renderInvoiceHistory(c, data)}
        </div>
      </section>

      <!-- Invoice Chart -->
      <section class="glass">
        <div class="fs-14 fw-600 mb-8">Evolução das faturas</div>
        <div class="chart-container" style="height:180px"><canvas id="invoice-chart"></canvas></div>
      </section>

      ${installments.length ? `<section>
        <div class="section-header"><span class="section-title">Parcelamentos ativos</span></div>
        ${installments.map(e => `<div class="glass glass-sm mb-8" style="cursor:pointer" onclick="CardsView.showExpenseDetail('${e.id}')">
          <div class="flex justify-between items-center">
            <div><div class="fs-14 fw-600">${e.name}</div><div class="fs-11 text-muted mt-4">${e.installments.current}/${e.installments.total}x de ${Finance.currency(e.installments.amount)}</div></div>
            <div style="text-align:right"><div class="fs-14 fw-700 text-warning">${Finance.currency(e.amount)}</div><div class="fs-11 text-muted">total</div></div>
          </div>
          ${UI.progress(Finance.percent(e.installments.current, e.installments.total), 'purple')}
        </div>`).join('')}
      </section>` : ''}

      <section>
        <div class="section-header"><span class="section-title">Lançamentos</span><span class="fs-12 text-muted">${expenses.length} itens</span></div>
        ${expenses.length === 0 ? '<div class="fs-13 text-muted" style="padding:12px 0">Nenhum lançamento neste cartão.</div>' :
          expenses.map(e => `<div class="list-item" onclick="CardsView.showExpenseDetail('${e.id}')">
            ${UI.iconBox('shopping_cart','accent')}
            <div class="list-item-info"><div class="list-item-title">${e.name}</div><div class="list-item-sub">${e.category}${e.installments?` · ${e.installments.current}/${e.installments.total}x`:''}</div></div>
            <div class="list-item-value"><div class="list-item-amount text-danger">- ${Finance.currency(e.installments?e.installments.amount:e.amount)}</div><div class="list-item-date">${Finance.dateStr(e.date)}</div></div>
          </div>`).join('')}
      </section>

      <div class="flex gap-10 mt-12">
        <button class="btn btn-danger btn-sm" onclick="CardsView.deleteCard('${c.id}')">${UI.icon('delete')} Excluir cartão</button>
      </div>
    `;
  },

  // ===== EXPENSE DETAIL (view/edit/delete) =====
  showExpenseDetail(expId) {
    const e = DB.getItem('expenses', expId);
    if (!e) return;
    const data = DB.get();
    const card = e.card ? data.cards.find(c=>c.id===e.card) : null;
    UI.modal.show(`
      <h3 class="modal-title">${e.name}</h3>
      <div class="flex flex-col gap-10">
        <div class="flex justify-between"><span class="text-muted fs-14">Valor total</span><span class="fw-600 text-danger">${Finance.currency(e.amount)}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Data</span><span class="fw-500">${Finance.dateFull(e.date)}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Pagamento</span><span class="fw-500">${e.payment}${card?' · '+card.name:''}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Categoria</span><span class="fw-500">${e.category}</span></div>
        ${e.installments?`<div class="flex justify-between"><span class="text-muted fs-14">Parcelas</span><span class="fw-500">${e.installments.total}x de ${Finance.currency(e.installments.amount)}</span></div>`:''}
        ${e.desc?`<div class="flex justify-between"><span class="text-muted fs-14">Obs</span><span class="fw-500">${e.desc}</span></div>`:''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger btn-sm" onclick="CardsView.deleteExpense('${e.id}')">${UI.icon('delete')}</button>
        <button class="btn btn-secondary btn-sm" onclick="UI.modal.hide()">Fechar</button>
        <button class="btn btn-primary btn-sm flex-1" onclick="CardsView.editExpense('${e.id}')">Editar</button>
      </div>
    `);
  },

  // ===== EDIT EXPENSE =====
  editExpense(expId) {
    const e = DB.getItem('expenses', expId);
    if (!e) return;
    const data = DB.get();
    UI.modal.show(`
      <h3 class="modal-title">Editar Gasto</h3>
      ${UI.formField('Nome','exped-name','text',{required:true, value:e.name})}
      <div class="form-row">
        ${UI.formField('Valor total','exped-amount','currency',{required:true, value:e.amount.toFixed(2)})}
        ${UI.formField('Data da compra','exped-date','date',{required:true, value:e.date})}
      </div>
      ${UI.formField('Categoria','exped-category','select',{options:data.categories, value:e.category})}
      ${e.installments ? `
        <div class="form-row">
          ${UI.formField('Total parcelas','exped-inst-total','number',{value:e.installments.total, min:'1'})}
        </div>
      ` : ''}
      ${UI.formField('Observação','exped-desc','text',{value:e.desc||'', placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="CardsView.saveEditExpense('${expId}')">Salvar</button>
      </div>
    `);
  },

  saveEditExpense(expId) {
    const e = DB.getItem('expenses', expId);
    if (!e) return;
    const name = UI.getVal('exped-name');
    const amount = UI.getCurrencyValue('exped-amount');
    const date = UI.getVal('exped-date');
    if (!name || !amount) { UI.toast('Preencha os campos','error'); return; }
    const updates = { name, amount, date, category: UI.getVal('exped-category'), desc: UI.getVal('exped-desc') };
    if (e.installments) {
      const total = UI.getNum('exped-inst-total') || e.installments.total;
      updates.installments = { total, amount: Math.round((amount/total)*100)/100 };
    }
    DB.updateItem('expenses', expId, updates);
    UI.modal.hide(); UI.toast('Gasto atualizado!'); App.refresh();
  },

  deleteExpense(expId) {
    UI.confirm('Excluir gasto?','').then(ok => {
      if (ok) { DB.deleteItem('expenses', expId); UI.modal.hide(); UI.toast('Gasto excluído'); App.refresh(); }
    });
  },

  // ===== ADD EXPENSE TO CARD (including retroactive) =====
  showExpenseForm(cardId) {
    const data = DB.get();
    UI.modal.show(`
      <h3 class="modal-title">Novo Gasto no Cartão</h3>
      ${UI.formField('Nome do gasto','cexp-name','text',{required:true, placeholder:'Ex: TV Samsung'})}
      <div class="form-row">
        ${UI.formField('Valor total','cexp-amount','currency',{required:true})}
        ${UI.formField('Data da compra','cexp-date','date',{required:true, value:Finance.today(), min:'2020-01-01'})}
      </div>
      ${UI.formField('Categoria','cexp-category','select',{options:data.categories})}

      <div class="form-group">
        <label class="form-label">Parcelamento</label>
        <div class="form-row">
          ${UI.formField('Total de parcelas','cexp-inst-total','number',{placeholder:'1 = à vista', min:'1'})}
        </div>
        <div class="form-hint">O sistema posicionará cada parcela automaticamente nos meses corretos baseando-se na data da compra.</div>
      </div>
      ${UI.formField('Observação','cexp-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="CardsView.saveCardExpense('${cardId}')">Salvar</button>
      </div>
    `);
  },

  saveCardExpense(cardId) {
    const name = UI.getVal('cexp-name');
    const amount = UI.getCurrencyValue('cexp-amount');
    const date = UI.getVal('cexp-date');
    if (!name || !amount || !date) { UI.toast('Preencha os campos obrigatórios','error'); return; }

    const category = UI.getVal('cexp-category');
    const totalInst = UI.getNum('cexp-inst-total') || 1;

    const item = {
      name, amount, date, payment: 'credit', card: cardId,
      category, desc: UI.getVal('cexp-desc'), installments: null
    };

    if (totalInst > 1) {
      item.installments = {
        total: totalInst,
        amount: Math.round((amount / totalInst) * 100) / 100
      };
    }

    DB.addItem('expenses', item);
    UI.modal.hide(); UI.toast('Gasto lançado!'); App.refresh();
  },

  // ===== CARD CRUD =====
  select(id) { this.selectedCard = id; App.refresh(); },
  back() { this.selectedCard = null; App.refresh(); },

  editCard(cardId) {
    const c = DB.getItem('cards', cardId);
    if (!c) return;
    const colors = UI.cardColors;
    UI.modal.show(`
      <h3 class="modal-title">Editar Cartão</h3>
      ${UI.formField('Nome','carded-name','text',{required:true, value:c.name})}
      ${UI.formField('Banco','carded-bank','text',{required:true, value:c.bank})}
      ${UI.formField('Limite','carded-limit','currency',{value:(c.limit||0).toFixed(2), placeholder:'Opcional'})}
      <div class="form-row">
        ${UI.formField('Dia fechamento','carded-closing','number',{required:true, min:'1', max:'31', value:c.closing})}
        ${UI.formField('Dia vencimento','carded-due','number',{required:true, min:'1', max:'31', value:c.due})}
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <div class="flex gap-8" style="flex-wrap:wrap">${colors.map(cl => `<button type="button" class="card-color-opt" data-color="${cl}" ${cl===c.color?'data-selected="true"':''} onclick="CardsView.selectColor(this)" style="width:32px;height:32px;border-radius:8px;background:${cl};border:none;cursor:pointer;${cl===c.color?'outline:2px solid white':''}"></button>`).join('')}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="CardsView.saveEditCard('${cardId}')">Salvar</button>
      </div>
    `);
  },

  saveEditCard(cardId) {
    const name = UI.getVal('carded-name');
    const bank = UI.getVal('carded-bank');
    const limit = UI.getCurrencyValue('carded-limit');
    const closing = UI.getNum('carded-closing');
    const due = UI.getNum('carded-due');
    if (!name || !bank) { UI.toast('Preencha os campos','error'); return; }
    const colorEl = document.querySelector('.card-color-opt[data-selected]') || document.querySelector('.card-color-opt');
    const color = colorEl ? colorEl.dataset.color : '#8a2be2';
    DB.updateItem('cards', cardId, { name, bank, limit, closing, due, color });
    UI.modal.hide(); UI.toast('Cartão atualizado!'); App.refresh();
  },

  deleteCard(id) {
    UI.confirm('Excluir cartão?','Os lançamentos vinculados serão mantidos.').then(ok => {
      if (ok) { DB.deleteItem('cards', id); this.selectedCard = null; UI.toast('Cartão excluído'); App.refresh(); }
    });
  },

  showForm() {
    const colors = UI.cardColors;
    UI.modal.show(`
      <h3 class="modal-title">Novo Cartão</h3>
      ${UI.formField('Nome do cartão','card-name','text',{required:true, placeholder:'Ex: Nubank'})}
      ${UI.formField('Banco','card-bank','text',{required:true, placeholder:'Ex: Nubank'})}
      ${UI.formField('Limite','card-limit','currency',{placeholder:'Opcional'})}
      <div class="form-row">
        ${UI.formField('Dia de fechamento','card-closing','number',{required:true, min:'1', max:'31', placeholder:'Ex: 6'})}
        ${UI.formField('Dia de vencimento','card-due','number',{required:true, min:'1', max:'31', placeholder:'Ex: 15'})}
      </div>
      <div class="form-group">
        <label class="form-label">Cor</label>
        <div class="flex gap-8" style="flex-wrap:wrap">${colors.map((cl,i) => `<button type="button" class="card-color-opt" data-color="${cl}" ${i===0?'data-selected="true"':''} onclick="CardsView.selectColor(this)" style="width:32px;height:32px;border-radius:8px;background:${cl};border:none;cursor:pointer;${i===0?'outline:2px solid white':''}"></button>`).join('')}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="CardsView.saveNew()">Salvar</button>
      </div>
    `);
  },

  saveNew() {
    const name = UI.getVal('card-name');
    const bank = UI.getVal('card-bank');
    const limit = UI.getCurrencyValue('card-limit');
    const closing = UI.getNum('card-closing');
    const due = UI.getNum('card-due');
    const colorEl = document.querySelector('.card-color-opt[data-selected]') || document.querySelector('.card-color-opt');
    const color = colorEl ? colorEl.dataset.color : '#8a2be2';
    if (!name || !bank || !closing || !due) { UI.toast('Preencha nome, banco, fechamento e vencimento','error'); return; }
    DB.addItem('cards', { name, bank, limit: limit || 0, closing, due, color, obs: '' });
    UI.modal.hide(); UI.toast('Cartão adicionado!'); App.refresh();
  },

  selectColor(btn) {
    document.querySelectorAll('.card-color-opt').forEach(b => { b.removeAttribute('data-selected'); b.style.outline = 'none'; });
    btn.setAttribute('data-selected', 'true');
    btn.style.outline = '2px solid white';
  },

  // ===== PAY INVOICE =====
  payInvoice(cardId) {
    const c = DB.getItem('cards', cardId);
    if (!c) return;
    const inv = Finance.getCardInvoiceAmount(c);
    UI.modal.show(`
      <h3 class="modal-title">Pagar fatura - ${c.name}</h3>
      <p class="fs-14 text-muted mb-8">Fatura atual: ${Finance.currency(inv)}</p>
      ${UI.formField('Valor pago','inv-pay-amount','currency',{value:inv.toFixed(2)})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="CardsView.saveInvoicePayment('${cardId}')">Confirmar</button>
      </div>
    `);
  },

  saveInvoicePayment(cardId) {
    const c = DB.getItem('cards', cardId);
    if (!c) return;
    const amount = UI.getCurrencyValue('inv-pay-amount');
    if (!amount || amount <= 0) { UI.toast('Informe o valor','error'); return; }
    DB.addItem('expenses', {
      name: 'Pagamento de fatura - ' + c.name, amount, date: Finance.today(),
      payment: 'fatura', card: cardId, category: 'Cartão de crédito',
      installments: null, desc: 'Fatura paga'
    });
    UI.modal.hide(); UI.toast('Fatura paga registrada!'); App.refresh();
  },

  // ===== FUTURE INVOICES =====
  renderFutureInvoices(card) {
    const now = new Date();
    let html = '';
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const total = Finance.getCardInvoiceAmount(card, m, y);
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      html += `<div class="glass glass-sm mb-8" style="cursor:pointer" onclick="CardsView.showInvoiceDetail('${card.id}',${m},${y})">
        <div class="flex justify-between items-center">
          <div><div class="fs-14 fw-500">${label}</div><div class="fs-11 text-muted mt-2">Vence dia ${card.due}</div></div>
          <div class="font-h fs-16 fw-700 ${total > 0 ? 'text-warning' : 'text-muted'}">${total > 0 ? Finance.currency(total) : 'Sem gastos'}</div>
        </div>
      </div>`;
    }
    return html;
  },

  renderInvoiceHistory(card, data) {
    const pastInvoices = data.expenses.filter(e => e.card === card.id && e.payment === 'fatura').sort((a,b) => b.date.localeCompare(a.date));
    if (pastInvoices.length === 0) return '<div class="fs-13 text-muted">Nenhum pagamento registrado.</div>';
    
    return pastInvoices.map(e => `
      <div class="glass glass-sm mb-8" style="cursor:pointer" onclick="CardsView.showExpenseDetail('${e.id}')">
        <div class="flex justify-between items-center">
          <div><div class="fs-14 fw-500">${Finance.dateFull(e.date)}</div><div class="fs-11 text-success mt-2">Paga</div></div>
          <div class="font-h fs-16 fw-700 text-danger">- ${Finance.currency(e.amount)}</div>
        </div>
      </div>
    `).join('');
  },

  showInvoiceDetail(cardId, month, year) {
    const c = DB.getItem('cards', cardId);
    if (!c) return;
    const inv = Finance.getCardInvoiceForMonth(c, month, year);
    const d = new Date(year, month, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    UI.modal.show(`
      <h3 class="modal-title">Fatura de ${label}</h3>
      <div class="flex justify-between mb-12"><span class="text-muted fs-14">Total</span><span class="fw-700 fs-18">${Finance.currency(inv.total)}</span></div>
      ${inv.items.length === 0 ? '<div class="fs-13 text-muted">Nenhuma compra nesta fatura.</div>' :
        inv.items.map(e => `<div class="flex justify-between items-center" style="padding:8px 0;border-bottom:1px solid var(--card-border)">
          <div><div class="fs-13 fw-500">${e.name}</div><div class="fs-11 text-muted">${e.category||''}${e.installmentN ? ' · Parcela '+e.installmentN+'/'+e.installments.total : ''}</div></div>
          <span class="fs-14 fw-600 text-danger">${Finance.currency(e.invoiceAmount)}</span>
        </div>`).join('')}
      <div class="modal-actions mt-12"><button class="btn btn-secondary btn-block" onclick="UI.modal.hide()">Fechar</button></div>
    `);
  },

  afterRender() {
    const canvas = document.getElementById('invoice-chart');
    if (!canvas || !this.selectedCard) return;
    const c = DB.getItem('cards', this.selectedCard);
    if (!c) return;
    const timeline = Finance.getCardInvoiceTimeline(c, 2, 4);
    const bgColors = timeline.map(t => t.isCurrent ? '#4da3ff' : 'rgba(77,163,255,0.3)');
    new Chart(canvas, {
      type: 'bar',
      data: { labels: timeline.map(t => t.label), datasets: [{ data: timeline.map(t => t.total), backgroundColor: bgColors, borderRadius: 6, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => Finance.shortCurrency(v) } } } }
    });
  }
};
