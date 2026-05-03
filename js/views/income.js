/* ===== INCOME VIEW — WITH EDIT ===== */
const IncomeView = {
  render() {
    const data = DB.get();
    const incomes = [...data.incomes].sort((a,b) => b.date.localeCompare(a.date));
    const total = incomes.reduce((s,i) => s + i.amount, 0);
    const sources = {};
    incomes.forEach(i => { sources[i.source] = (sources[i.source]||0) + i.amount; });
    const sortedSources = Object.entries(sources).sort((a,b) => b[1]-a[1]);
    const topSource = sortedSources[0];
    const dependencyPct = topSource ? Finance.percent(topSource[1], total) : 0;

    return `
      <section><h2 class="font-h fs-24 fw-700">Ganhos</h2><p class="fs-14 text-muted mt-4">Suas fontes de renda</p></section>
      <section class="glass">
        <div class="summary-label">TOTAL DE GANHOS</div>
        <div class="font-h fs-28 fw-700 text-success mt-4">${Finance.currency(total)}</div>
        ${topSource ? `<div class="fs-12 text-muted mt-8">Principal fonte: <strong>${topSource[0]}</strong> (${Finance.percent(topSource[1], total)}%)</div>` : ''}
        ${dependencyPct > 60 ? `<div class="fs-12 text-warning mt-4">⚠ Você depende ${dependencyPct}% de uma única fonte.</div>` : ''}
      </section>
      ${sortedSources.length ? `<section class="glass"><div class="fs-14 fw-600 mb-8">Por fonte</div><div class="chart-container" style="height:160px"><canvas id="income-chart"></canvas></div>
        <div class="mt-12">${sortedSources.map((s,i) => `<div class="flex justify-between items-center" style="padding:6px 0">
          <div class="flex items-center gap-8"><div style="width:10px;height:10px;border-radius:50%;background:${['#2ecc71','#4da3ff','#7c6cff','#f0b429','#e05a5a'][i%5]}"></div><span class="fs-13">${s[0]}</span></div>
          <span class="fs-13 fw-600">${Finance.currency(s[1])} <span class="text-muted">(${Finance.percent(s[1],total)}%)</span></span>
        </div>`).join('')}</div></section>` : ''}
      <section>
        <div class="section-header"><span class="section-title">Lançamentos</span></div>
        ${incomes.length === 0 ? UI.emptyState('trending_up','Nenhum ganho registrado','Cadastre sua primeira fonte de renda.') :
          incomes.map(i => UI.listItem('trending_up','success', i.source, `${i.desc||''} · ${Finance.dateStr(i.date)}`, '+ '+Finance.currency(i.amount), 'text-success', Finance.dateStr(i.date), `IncomeView.showDetail('${i.id}')`)).join('')}
      </section>
    `;
  },

  afterRender() {
    const canvas = document.getElementById('income-chart');
    if (!canvas) return;
    const data = DB.get();
    const sources = {};
    data.incomes.forEach(i => { sources[i.source] = (sources[i.source]||0) + i.amount; });
    const sorted = Object.entries(sources).sort((a,b)=>b[1]-a[1]);
    const colors = ['#2ecc71','#4da3ff','#7c6cff','#f0b429','#e05a5a'];
    new Chart(canvas, { type:'doughnut', data:{ labels:sorted.map(s=>s[0]), datasets:[{data:sorted.map(s=>s[1]), backgroundColor:colors.slice(0,sorted.length), borderWidth:0}]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}}}
    });
  },

  showDetail(id) {
    const i = DB.getItem('incomes', id);
    if (!i) return;
    UI.modal.show(`
      <h3 class="modal-title">${i.source}</h3>
      <div class="flex flex-col gap-10">
        <div class="flex justify-between"><span class="text-muted fs-14">Valor</span><span class="fw-600 text-success">${Finance.currency(i.amount)}</span></div>
        <div class="flex justify-between"><span class="text-muted fs-14">Data</span><span class="fw-500">${Finance.dateFull(i.date)}</span></div>
        ${i.desc?`<div class="flex justify-between"><span class="text-muted fs-14">Descrição</span><span class="fw-500">${i.desc}</span></div>`:''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger btn-sm" onclick="IncomeView.deleteIncome('${i.id}')">${UI.icon('delete')}</button>
        <button class="btn btn-secondary btn-sm" onclick="UI.modal.hide()">Fechar</button>
        <button class="btn btn-primary btn-sm flex-1" onclick="IncomeView.editIncome('${i.id}')">Editar</button>
      </div>
    `);
  },

  editIncome(id) {
    const i = DB.getItem('incomes', id);
    if (!i) return;
    UI.modal.show(`
      <h3 class="modal-title">Editar Ganho</h3>
      ${UI.formField('Fonte','ince-source','text',{required:true, value:i.source})}
      ${UI.formField('Valor','ince-amount','currency',{required:true, value:i.amount.toFixed(2)})}
      ${UI.formField('Data','ince-date','date',{required:true, value:i.date})}
      ${UI.formField('Descrição','ince-desc','text',{value:i.desc||''})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="IncomeView.saveEdit('${id}')">Salvar</button>
      </div>
    `);
  },

  saveEdit(id) {
    const source = UI.getVal('ince-source');
    const amount = UI.getCurrencyValue('ince-amount');
    if (!source || !amount) { UI.toast('Preencha os campos','error'); return; }
    DB.updateItem('incomes', id, { source, amount, date: UI.getVal('ince-date'), desc: UI.getVal('ince-desc') });
    UI.modal.hide(); UI.toast('Ganho atualizado!'); App.refresh();
  },

  deleteIncome(id) {
    UI.confirm('Excluir ganho?','').then(ok => {
      if (ok) { DB.deleteItem('incomes', id); UI.modal.hide(); UI.toast('Ganho excluído'); App.refresh(); }
    });
  },

  showForm() {
    UI.modal.show(`
      <h3 class="modal-title">Novo Ganho</h3>
      ${UI.formField('Fonte','inc-source','text',{required:true, placeholder:'Ex: Salário, Adega, Freela'})}
      ${UI.formField('Valor','inc-amount','currency',{required:true})}
      ${UI.formField('Data','inc-date','date',{required:true, value:Finance.today()})}
      ${UI.formField('Descrição','inc-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="IncomeView.saveNew()">Salvar</button>
      </div>
    `);
  },

  saveNew() {
    const source = UI.getVal('inc-source');
    const amount = UI.getCurrencyValue('inc-amount');
    const date = UI.getVal('inc-date');
    if (!source || !amount || !date) { UI.toast('Preencha os campos obrigatórios','error'); return; }
    DB.addItem('incomes', { source, amount, date, desc: UI.getVal('inc-desc'), category:'', recurring:false });
    UI.modal.hide(); UI.toast('Ganho registrado!'); App.refresh();
  }
};
