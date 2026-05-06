/* ===== EXPENSES VIEW — WITH EDIT/DELETE ===== */
const ExpensesView = {
  filter: 'all',
  dateFilter: 'current-month',

  render() {
    const data = DB.get();
    
    // 1. Sort by date desc
    let expenses = [...data.expenses].sort((a,b) => b.date.localeCompare(a.date));
    
    // 2. Filter by date
    expenses = Finance.filterByDate(expenses, this.dateFilter);
    
    // 3. Calc totals
    const total = expenses.reduce((s,e) => s+e.amount, 0);
    const avg = expenses.length > 0 ? total / Math.max(1, new Set(expenses.map(e=>e.date)).size) : 0;
    const cats = {}; expenses.forEach(e => { cats[e.category] = (cats[e.category]||0) + e.amount; });
    const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
    
    // 4. Filter by payment method
    if (this.filter !== 'all') expenses = expenses.filter(e => e.payment === this.filter);

    return `
      <section>
        <div class="flex justify-between items-center mb-16">
          <div><h2 class="font-h fs-24 fw-700">Gastos</h2><p class="fs-14 text-muted mt-4">Controle suas saídas</p></div>
          <select class="form-input" style="width:140px;height:36px;font-size:13px" onchange="ExpensesView.setDateFilter(this.value)">
            ${UI.dateFilterOptions(this.dateFilter)}
          </select>
        </div>
      </section>
      <section class="glass">
        <div class="summary-label">TOTAL GASTO</div>
        <div class="font-h fs-28 fw-700 text-danger mt-4">${Finance.currency(total)}</div>
        <div class="fs-12 text-muted mt-4">Média diária: ${Finance.currency(avg)}</div>
      </section>
      <div class="chip-row">
        ${['all','credit','debit','pix','dinheiro'].map(f => `<button class="chip ${this.filter===f?'active':''}" onclick="ExpensesView.setFilter('${f}')">${f==='all'?'Todos':f==='credit'?'Crédito':f==='debit'?'Débito':f==='pix'?'PIX':'Dinheiro'}</button>`).join('')}
      </div>
      ${topCat.length ? `<section class="glass"><div class="fs-14 fw-600 mb-8">Por categoria</div><div class="chart-container" style="height:160px"><canvas id="cat-chart"></canvas></div></section>` : ''}
      <section>
        ${expenses.length === 0 ? UI.emptyState('shopping_cart','Nenhum gasto','Registre seu primeiro gasto para começar.') :
          expenses.map(e => {
            const icon = e.payment==='credit'?'credit_card':e.payment==='pix'?'pix':e.payment==='debit'?'account_balance':'payments';
            const card = e.card ? data.cards.find(c=>c.id===e.card) : null;
            const sub = `${e.category} · ${e.payment==='credit'&&card?card.name:Finance.paymentLabel(e.payment)}${e.installments?` · ${e.installments.current}/${e.installments.total}x`:''}`;
            return UI.listItem(icon, e.payment==='credit'?'accent':'secondary', e.name, sub, '- '+Finance.currency(e.installments?e.installments.amount:e.amount), 'text-danger', Finance.dateStr(e.date), `ExpensesView.showDetail('${e.id}')`);
          }).join('')}
      </section>
    `;
  },

  afterRender() {
    const canvas = document.getElementById('cat-chart');
    if (!canvas) return;
    const data = DB.get();
    const cats = {}; data.expenses.forEach(e => { cats[e.category] = (cats[e.category]||0) + e.amount; });
    const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
    const colors = ['#2ecc71','#4da3ff','#7c6cff','#f0b429','#e05a5a','#16a085','#e67e22','#9b59b6','#3498db','#e74c3c'];
    new Chart(canvas, { type:'doughnut', data:{ labels:sorted.map(s=>s[0]), datasets:[{data:sorted.map(s=>s[1]), backgroundColor:colors.slice(0,sorted.length), borderWidth:0}]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,padding:8,font:{size:11}}}}}
    });
  },

  setDateFilter(val) { this.dateFilter = val; App.refresh(); },
  setFilter(f) { this.filter = f; App.refresh(); },

  showDetail(id) {
    const e = DB.getItem('expenses', id);
    if (!e) return;
    const data = DB.get();
    const card = e.card ? data.cards.find(c=>c.id===e.card) : null;
    UI.modal.show(`
      <h3 class="modal-title">${e.name}</h3>
      <div class="flex flex-col gap-10">
        <div class="flex justify-between"><span class="text-muted fs-14">Valor</span><span class="fw-600 text-danger">${Finance.currency(e.amount)}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Data</span><span class="fw-500">${Finance.dateFull(e.date)}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Pagamento</span><span class="fw-500">${Finance.paymentLabel(e.payment)}${card?' · '+card.name:''}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Categoria</span><span class="fw-500">${e.category}</span></div>
        ${e.installments?`<div class="flex justify-between"><span class="text-muted fs-14">Parcelas</span><span class="fw-500">${e.installments.current}/${e.installments.total}x de ${Finance.currency(e.installments.amount)}</span></div>`:''}
        ${e.desc?`<div class="flex justify-between"><span class="text-muted fs-14">Obs</span><span class="fw-500">${e.desc}</span></div>`:''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger btn-sm" onclick="ExpensesView.delete('${e.id}')">${UI.icon('delete')}</button>
        <button class="btn btn-secondary btn-sm" onclick="UI.modal.hide()">Fechar</button>
        <button class="btn btn-primary btn-sm flex-1" onclick="ExpensesView.editExpense('${e.id}')">Editar</button>
      </div>
    `);
  },

  editExpense(id) {
    const e = DB.getItem('expenses', id);
    if (!e) return;
    const data = DB.get();
    UI.modal.show(`
      <h3 class="modal-title">Editar Gasto</h3>
      ${UI.formField('Nome','expe-name','text',{required:true, value:e.name})}
      <div class="form-row">
        ${UI.formField('Valor','expe-amount','currency',{required:true, value:e.amount.toFixed(2)})}
        ${UI.formField('Data','expe-date','date',{required:true, value:e.date})}
      </div>
      ${UI.formField('Forma de pagamento','expe-payment','select',{options:[{value:'dinheiro',label:'Dinheiro'},{value:'pix',label:'PIX'},{value:'debit',label:'Débito'},{value:'credit',label:'Crédito'}], value:e.payment})}
      <div id="expe-card-wrap" class="${e.payment!=='credit'?'hidden':''}">
        ${UI.formField('Cartão','expe-card','select',{options:data.cards.map(c=>({value:c.id,label:c.name})), value:e.card||''})}
        <div class="form-row">
          ${UI.formField('Total parcelas','expe-inst-total','number',{value:e.installments?e.installments.total:'', min:'1'})}
          ${UI.formField('Parcela atual','expe-inst-current','number',{value:e.installments?e.installments.current:'', min:'1'})}
        </div>
      </div>
      ${UI.formField('Categoria','expe-category','select',{options:data.categories, value:e.category})}
      ${UI.formField('Observação','expe-desc','text',{value:e.desc||''})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="ExpensesView.saveEdit('${id}')">Salvar</button>
      </div>
    `);
    document.getElementById('expe-payment').onchange = function() {
      document.getElementById('expe-card-wrap').classList.toggle('hidden', this.value !== 'credit');
    };
  },

  saveEdit(id) {
    const name = UI.getVal('expe-name');
    const amount = UI.getCurrencyValue('expe-amount');
    const date = UI.getVal('expe-date');
    const payment = UI.getVal('expe-payment');
    if (!name || !amount) { UI.toast('Preencha os campos','error'); return; }
    const updates = { name, amount, date, payment, category: UI.getVal('expe-category'), desc: UI.getVal('expe-desc') };
    if (payment === 'credit') {
      updates.card = UI.getVal('expe-card');
      const total = UI.getNum('expe-inst-total');
      const current = UI.getNum('expe-inst-current');
      if (total > 1) {
        updates.installments = { total, current: Math.min(current||1, total), amount: Math.round((amount/total)*100)/100 };
      } else {
        updates.installments = null;
      }
    } else {
      updates.card = null; updates.installments = null;
    }
    DB.updateItem('expenses', id, updates);
    UI.modal.hide(); UI.toast('Gasto atualizado!'); App.refresh();
  },

  delete(id) {
    UI.confirm('Excluir gasto?','').then(ok => {
      if (ok) { DB.deleteItem('expenses', id); UI.modal.hide(); UI.toast('Gasto excluído'); App.refresh(); }
    });
  },

  showForm(defaults = {}) {
    const data = DB.get();
    UI.modal.show(`
      <h3 class="modal-title">Novo Gasto</h3>
      ${UI.formField('Nome do gasto','exp-name','text',{required:true, placeholder:'Ex: Supermercado'})}
      <div class="form-row">
        ${UI.formField('Valor','exp-amount','currency',{required:true})}
        ${UI.formField('Data','exp-date','date',{required:true, value:Finance.today()})}
      </div>
      ${UI.formField('Forma de pagamento','exp-payment','select',{options:[{value:'dinheiro',label:'Dinheiro'},{value:'pix',label:'PIX'},{value:'debit',label:'Débito'},{value:'credit',label:'Crédito'}]})}
      <div id="exp-card-wrap" class="hidden">
        ${UI.formField('Cartão','exp-card','select',{options:data.cards.map(c=>({value:c.id,label:c.name}))})}
        <div class="form-row">
          ${UI.formField('Total parcelas','exp-installments','number',{placeholder:'1 = à vista', min:'1'})}
          ${UI.formField('Parcela atual','exp-inst-current','number',{placeholder:'Atual (para compras antigas)', min:'1'})}
        </div>
      </div>
      ${UI.formField('Categoria','exp-category','select',{options:[...data.categories, '+ Nova categoria']})}
      ${UI.formField('Observação','exp-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="ExpensesView.saveNew()">Salvar</button>
      </div>
    `);
    document.getElementById('exp-payment').onchange = function() {
      document.getElementById('exp-card-wrap').classList.toggle('hidden', this.value !== 'credit');
    };
    document.getElementById('exp-category').onchange = function() {
      if (this.value === '+ Nova categoria') {
        const name = prompt('Nome da nova categoria:');
        if (name && name.trim()) {
          const d = DB.get();
          if (!d.categories.includes(name.trim())) { d.categories.push(name.trim()); DB.save(d); }
          const opt = document.createElement('option'); opt.value = name.trim(); opt.textContent = name.trim(); opt.selected = true;
          this.insertBefore(opt, this.lastElementChild);
        } else { this.selectedIndex = 0; }
      }
    };
  },

  saveNew() {
    const name = UI.getVal('exp-name');
    const amount = UI.getCurrencyValue('exp-amount');
    const date = UI.getVal('exp-date');
    const payment = UI.getVal('exp-payment');
    const category = UI.getVal('exp-category');
    const desc = UI.getVal('exp-desc');
    if (!name || !amount || !date) { UI.toast('Preencha os campos obrigatórios','error'); return; }
    const item = { name, amount, date, payment, category, desc, card: null, installments: null };
    if (payment === 'credit') {
      item.card = UI.getVal('exp-card');
      const inst = UI.getNum('exp-installments') || 1;
      const current = UI.getNum('exp-inst-current') || 1;
      if (inst > 1) item.installments = { total: inst, current: Math.min(current, inst), amount: Math.round((amount/inst)*100)/100 };
    }
    DB.addItem('expenses', item);
    UI.modal.hide(); UI.toast('Gasto registrado!'); App.refresh();
  }
};
