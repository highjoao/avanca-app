/* ===== RECEIVABLES VIEW ===== */
const ReceivablesView = {
  filter: 'all',
  selectedPerson: null,
  render() {
    if (this.selectedPerson) return this.renderPersonDetail(this.selectedPerson);
    const data = DB.get();
    let items = data.receivables;
    let totalRecv=0, totalOverdue=0, total7=0, total30=0, peopleCount=0;
    items.forEach(r => {
      const t = Finance.getReceivableTotal(r);
      if (t.total > 0) { totalRecv += t.total; peopleCount++; }
      const d = r.dueDate ? Finance.daysUntil(r.dueDate) : 999;
      if (d < 0 && t.total > 0) totalOverdue += t.total;
      if (d >= 0 && d <= 7 && t.total > 0) total7 += t.total;
      if (d >= 0 && d <= 30 && t.total > 0) total30 += t.total;
    });

    if (this.filter !== 'all') {
      items = items.filter(r => {
        const t = Finance.getReceivableTotal(r);
        if (this.filter === 'overdue') return r.dueDate && Finance.daysUntil(r.dueDate) < 0 && t.total > 0;
        if (this.filter === 'pending') return r.dueDate && Finance.daysUntil(r.dueDate) >= 0 && t.total > 0;
        if (this.filter === 'paid') return t.total <= 0;
        if (this.filter === 'partial') return r.paid > 0 && t.total > 0;
        return true;
      });
    }

    return `
      <section>
        <h2 class="font-h fs-24 fw-700">A Receber</h2>
        <p class="fs-14 text-muted mt-4">Controle quem te deve e nunca perca um acordo</p>
      </section>
      <section class="summary-grid">
        ${UI.summaryCard('Total a receber', Finance.currency(totalRecv), 'text-primary')}
        ${UI.summaryCard('Vencido', Finance.currency(totalOverdue), totalOverdue > 0 ? 'text-danger' : '')}
        ${UI.summaryCard('Próximos 7 dias', Finance.currency(total7), 'text-secondary')}
        ${UI.summaryCard('Pessoas devendo', peopleCount.toString(), 'text-warning')}
      </section>
      <div class="chip-row">
        ${['all','overdue','pending','partial','paid'].map(f => `<button class="chip ${this.filter===f?'active':''}" onclick="ReceivablesView.setFilter('${f}')">${f==='all'?'Todos':f==='overdue'?'Vencidos':f==='pending'?'Em dia':f==='partial'?'Parciais':'Quitados'}</button>`).join('')}
      </div>
      <section>
        ${items.length === 0 ? UI.emptyState('groups','Nenhuma cobrança','Controle quem te deve e nunca mais perca um acordo.') :
          items.map(r => this.renderItem(r)).join('')}
      </section>
      <button class="btn btn-primary btn-block mt-12" onclick="ReceivablesView.showForm()">
        ${UI.icon('add')} Nova cobrança
      </button>
    `;
  },

  renderItem(r) {
    const t = Finance.getReceivableTotal(r);
    const days = r.dueDate ? Finance.daysUntil(r.dueDate) : 0;
    const isOverdue = days < 0 && t.total > 0;
    const statusTxt = t.total <= 0 ? 'Quitado' : isOverdue ? `Vencido há ${-days} dias` : days === 0 ? 'Vence hoje' : days <= 7 ? `Vence em ${days} dias` : Finance.dateStr(r.dueDate);
    const statusType = t.total <= 0 ? 'success' : isOverdue ? 'danger' : days <= 3 ? 'warning' : 'info';
    const typeLabel = r.type === 'loan' ? 'Empréstimo' : r.type === 'fiado' ? 'Fiado' : 'Parcelado';

    return `<div class="glass mb-8" style="cursor:pointer" onclick="ReceivablesView.selectPerson('${r.id}')">
      <div class="flex items-center gap-12">
        ${UI.personAvatar(r.person)}
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span class="fs-15 fw-600">${r.person}</span>
            <span class="font-h fs-16 fw-700 ${isOverdue ? 'text-danger' : 'text-primary'}">${Finance.currency(t.total)}</span>
          </div>
          <div class="flex justify-between items-center mt-4">
            <span class="fs-12 text-muted">${typeLabel}${r.product ? ' · '+r.product : ''}</span>
            ${UI.badge(statusTxt, statusType)}
          </div>
        </div>
      </div>
      ${t.interest > 0 ? `<div class="fs-11 text-warning mt-8">+ ${Finance.currency(t.interest)} de juros acumulados</div>` : ''}
      ${r.type === 'installment' && r.installments ? `<div class="mt-8">${UI.progress(Finance.percent(r.installments.filter(i=>i.status==='paid').length, r.installments.length), 'green')}<div class="fs-11 text-muted mt-4">${r.installments.filter(i=>i.status==='paid').length}/${r.installments.length} parcelas pagas</div></div>` : ''}
      <div class="flex gap-8 mt-12">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ReceivablesView.copyMessage('${r.id}')">
          ${UI.icon('content_copy')} Copiar cobrança
        </button>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();ReceivablesView.markPaid('${r.id}')">
          ${UI.icon('check')} Recebido
        </button>
      </div>
    </div>`;
  },

  renderPersonDetail(id) {
    const r = DB.getItem('receivables', id);
    if (!r) { this.selectedPerson = null; return this.render(); }
    const t = Finance.getReceivableTotal(r);
    const days = r.dueDate ? Finance.daysUntil(r.dueDate) : 0;
    const isOverdue = days < 0 && t.total > 0;

    let installmentsHtml = '';
    if (r.type === 'installment' && r.installments) {
      installmentsHtml = `<section><div class="section-header"><span class="section-title">Parcelas</span></div>
        ${r.installments.map((inst, i) => {
          const d = Finance.daysUntil(inst.due);
          const st = inst.status === 'paid' ? 'success' : d < 0 ? 'danger' : d <= 3 ? 'warning' : 'info';
          return `<div class="glass glass-sm mb-8">
            <div class="flex justify-between items-center">
              <div><span class="fs-14 fw-600">Parcela ${inst.n}</span><div class="fs-11 text-muted mt-4">Vence: ${Finance.dateStr(inst.due)}</div></div>
              <div style="text-align:right">
                <div class="font-h fs-16 fw-700">${Finance.currency(inst.amount)}</div>
                ${UI.badge(UI.statusLabel(inst.status === 'paid' ? 'paid' : d < 0 ? 'overdue' : 'pending'), st)}
              </div>
            </div>
            ${inst.status !== 'paid' ? `<button class="btn btn-primary btn-sm btn-block mt-8" onclick="ReceivablesView.payInstallment('${r.id}',${i})">Marcar como pago</button>` : ''}
          </div>`;
        }).join('')}
      </section>`;
    }

    return `
      <section>
        <div class="flex items-center gap-10">
          <button class="icon-box secondary" onclick="ReceivablesView.backToPerson()" style="width:36px;height:36px;border-radius:10px">${UI.icon('arrow_back')}</button>
          <div class="flex items-center gap-10">${UI.personAvatar(r.person)}<div><h2 class="font-h fs-20 fw-700">${r.person}</h2>${r.phone ? `<p class="fs-12 text-muted">${r.phone}</p>` : ''}</div></div>
        </div>
      </section>
      <section class="glass">
        <div class="summary-label">TOTAL ATUALIZADO</div>
        <div class="font-h fs-28 fw-700 mt-4 ${isOverdue ? 'text-danger' : 'text-primary'}">${Finance.currency(t.total)}</div>
        ${t.interest > 0 ? `<div class="fs-12 text-warning mt-4">Inclui ${Finance.currency(t.interest)} de juros</div>` : ''}
        <div class="divider"></div>
        <div class="grid-2">
          <div><div class="fs-11 text-muted">Valor original</div><div class="fs-16 fw-600 mt-4">${Finance.currency(r.amount)}</div></div>
          <div><div class="fs-11 text-muted">Já pago</div><div class="fs-16 fw-600 mt-4 text-success">${Finance.currency(r.paid)}</div></div>
        </div>
        ${r.interest && r.interest.type !== 'none' ? `<div class="mt-12 fs-12 text-muted" style="line-height:1.5;padding:10px;background:var(--surface-3);border-radius:8px">
          💡 Juros: ${r.interest.type === 'fixed' ? Finance.currency(r.interest.value)+' fixo' : r.interest.value+'%'} ${r.interest.freq === 'month' ? 'ao mês' : r.interest.freq === 'day' ? 'ao dia' : r.interest.freq === 'week' ? 'por semana' : 'por parcela atrasada'}
        </div>` : ''}
      </section>
      ${installmentsHtml}
      ${r.desc ? `<section class="glass glass-sm"><div class="fs-12 text-muted">${r.desc}</div></section>` : ''}
      ${r.obs ? `<section class="glass glass-sm"><div class="fs-11 text-muted">Obs: ${r.obs}</div></section>` : ''}
      <div class="flex gap-10">
        <button class="btn btn-secondary btn-sm" onclick="ReceivablesView.copyMessage('${r.id}')">${UI.icon('content_copy')} Copiar cobrança</button>
        <button class="btn btn-primary btn-sm flex-1" onclick="ReceivablesView.markPaid('${r.id}')">${UI.icon('check')} Registrar pagamento</button>
      </div>
      <button class="btn btn-danger btn-sm mt-8" onclick="ReceivablesView.deleteRecv('${r.id}')">Excluir cobrança</button>
    `;
  },

  setFilter(f) { this.filter = f; App.refresh(); },
  selectPerson(id) { this.selectedPerson = id; App.refresh(); },
  backToPerson() { this.selectedPerson = null; App.refresh(); },

  markPaid(id) {
    const r = DB.getItem('receivables', id);
    if (!r) return;
    const t = Finance.getReceivableTotal(r);
    UI.modal.show(`
      <h3 class="modal-title">Registrar pagamento</h3>
      <p class="fs-14 text-muted mb-8">${r.person} — Total: ${Finance.currency(t.total)}</p>
      ${UI.formField('Valor recebido','recv-pay-amount','currency',{value:t.total.toFixed(2)})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="ReceivablesView.savePay('${id}')">Confirmar</button>
      </div>
    `);
  },

  savePay(id) {
    const amount = UI.getCurrencyValue('recv-pay-amount');
    if (!amount || amount <= 0) { UI.toast('Informe um valor válido','error'); return; }
    const r = DB.getItem('receivables', id);
    r.paid = (r.paid || 0) + amount;
    r.payments = r.payments || [];
    r.payments.push({ date: Finance.today(), amount });
    const t = Finance.getReceivableTotal(r);
    if (t.total <= 0) r.status = 'paid';
    else if (r.paid > 0) r.status = 'partial';
    DB.updateItem('receivables', id, r);
    UI.modal.hide(); UI.toast('Pagamento registrado!'); App.refresh();
  },

  payInstallment(recvId, instIndex) {
    const r = DB.getItem('receivables', recvId);
    if (!r || !r.installments || !r.installments[instIndex]) return;
    r.installments[instIndex].status = 'paid';
    r.installments[instIndex].paidAmount = r.installments[instIndex].amount;
    r.installments[instIndex].paidDate = Finance.today();
    r.paid = (r.paid || 0) + r.installments[instIndex].amount;
    if (r.installments.every(i => i.status === 'paid')) r.status = 'paid';
    DB.updateItem('receivables', recvId, r);
    UI.toast('Parcela marcada como paga!'); App.refresh();
  },

  copyMessage(id) {
    const r = DB.getItem('receivables', id);
    if (!r) return;
    const t = Finance.getReceivableTotal(r);
    const days = r.dueDate ? Finance.daysUntil(r.dueDate) : 0;
    let msg;
    if (days < 0) {
      msg = `Oi, ${r.person.split(' ')[0]}. Consta aqui um valor de ${Finance.currency(t.total)} vencido desde ${Finance.dateStr(r.dueDate)}. Consegue me dar uma previsão?`;
    } else {
      msg = `Oi, ${r.person.split(' ')[0]}. Passando para lembrar que temos um valor de ${Finance.currency(t.total)} com vencimento em ${Finance.dateStr(r.dueDate)}. Qualquer coisa me avisa.`;
    }
    navigator.clipboard.writeText(msg).then(() => UI.toast('Mensagem copiada!')).catch(() => UI.toast('Não foi possível copiar','error'));
  },

  deleteRecv(id) {
    UI.confirm('Excluir cobrança?','Esta ação não pode ser desfeita.').then(ok => {
      if (ok) { DB.deleteItem('receivables', id); this.selectedPerson = null; UI.toast('Cobrança excluída'); App.refresh(); }
    });
  },

  showForm() {
    UI.modal.show(`
      <h3 class="modal-title">Nova Cobrança</h3>
      ${UI.formField('Tipo','recv-type','select',{options:[{value:'loan',label:'Empréstimo simples'},{value:'fiado',label:'Venda fiado / cobrança única'},{value:'installment',label:'Venda parcelada / acordo'}]})}
      ${UI.formField('Nome da pessoa','recv-person','text',{required:true, placeholder:'Ex: João Silva'})}
      ${UI.formField('Telefone','recv-phone','text',{placeholder:'Opcional'})}
      <div id="recv-product-wrap">${UI.formField('Produto / Serviço','recv-product','text',{placeholder:'Ex: Celular'})}</div>
      ${UI.formField('Valor total','recv-amount','currency',{required:true})}
      <div class="form-row">
        ${UI.formField('Data','recv-date','date',{value:Finance.today()})}
        ${UI.formField('Vencimento','recv-due','date',{required:true})}
      </div>
      <div id="recv-installment-wrap" class="hidden">
        ${UI.formField('Entrada','recv-down','currency')}
        <div class="form-row">
          ${UI.formField('Nº de parcelas','recv-inst-count','number',{min:'1', placeholder:'Ex: 4'})}
          ${UI.formField('Frequência','recv-freq','select',{options:[{value:'monthly',label:'Mensal'},{value:'biweekly',label:'Quinzenal'},{value:'weekly',label:'Semanal'}]})}
        </div>
      </div>
      ${UI.formField('Juros','recv-interest-type','select',{options:[{value:'none',label:'Sem juros'},{value:'fixed',label:'Valor fixo'},{value:'percent',label:'Percentual'}]})}
      <div id="recv-interest-wrap" class="hidden">
        <div class="form-row">
          ${UI.formField('Valor do juros','recv-interest-val','currency')}
          ${UI.formField('Frequência','recv-interest-freq','select',{options:[{value:'month',label:'Por mês'},{value:'day',label:'Por dia'},{value:'week',label:'Por semana'},{value:'installment',label:'Por parcela'}]})}
        </div>
      </div>
      ${UI.formField('Descrição','recv-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="ReceivablesView.saveNew()">Salvar</button>
      </div>
    `);
    document.getElementById('recv-type').onchange = function() {
      document.getElementById('recv-installment-wrap').classList.toggle('hidden', this.value !== 'installment');
    };
    document.getElementById('recv-interest-type').onchange = function() {
      document.getElementById('recv-interest-wrap').classList.toggle('hidden', this.value === 'none');
    };
  },

  saveNew() {
    const type = document.getElementById('recv-type').value;
    const person = document.getElementById('recv-person').value.trim();
    const amount = UI.getCurrencyValue('recv-amount');
    const date = document.getElementById('recv-date').value;
    const dueDate = document.getElementById('recv-due').value;
    if (!person || !amount || !dueDate) { UI.toast('Preencha os campos obrigatórios','error'); return; }

    const intType = document.getElementById('recv-interest-type').value;
    const interest = { type: intType };
    if (intType !== 'none') {
      interest.value = UI.getCurrencyValue('recv-interest-val');
      interest.freq = document.getElementById('recv-interest-freq').value;
    }

    const item = {
      person, phone: document.getElementById('recv-phone').value.trim(),
      type, product: document.getElementById('recv-product')?.value?.trim() || '',
      amount, date, dueDate, interest, paid: 0, payments: [], status: 'active',
      desc: document.getElementById('recv-desc').value.trim(), obs: ''
    };

    if (type === 'installment') {
      const down = UI.getCurrencyValue('recv-down');
      const count = parseInt(document.getElementById('recv-inst-count').value) || 1;
      const freq = document.getElementById('recv-freq').value;
      item.downPayment = down;
      item.installmentCount = count;
      item.frequency = freq;
      item.paid = down;
      const remaining = amount - down;
      const instAmount = Math.round((remaining / count) * 100) / 100;
      item.installments = [];
      const dueD = new Date(dueDate + 'T12:00:00');
      for (let i = 0; i < count; i++) {
        const d = new Date(dueD);
        if (freq === 'monthly') d.setMonth(d.getMonth() + i);
        else if (freq === 'biweekly') d.setDate(d.getDate() + i * 14);
        else d.setDate(d.getDate() + i * 7);
        item.installments.push({ n: i+1, amount: instAmount, due: d.toISOString().split('T')[0], status: 'future', paidAmount: 0, paidDate: null });
      }
    } else if (type === 'fiado') {
      item.downPayment = 0;
    }

    DB.addItem('receivables', item);
    UI.modal.hide(); UI.toast('Cobrança registrada!'); App.refresh();
  }
};
