/* ===== GOALS VIEW — FIXED ===== */
const GoalsView = {
  render() {
    const data = DB.get();
    const goals = data.goals;
    const active = goals.filter(g => g.current < g.target);
    const completed = goals.filter(g => g.current >= g.target);

    return `
      <section><h2 class="font-h fs-24 fw-700">Metas</h2><p class="fs-14 text-muted mt-4">Acompanhe seu progresso e conquistas</p></section>
      ${active.length === 0 && completed.length === 0 ? `<section>${UI.emptyState('flag','Nenhuma meta criada','Crie sua primeira meta e acompanhe seu progresso.')}</section>` : ''}
      ${active.map(g => this.renderGoal(g)).join('')}
      ${completed.length ? `<section>
        <div class="section-header"><span class="section-title">Conquistas</span></div>
        ${completed.map(g => `<div class="glass glass-sm mb-8">
          <div class="flex items-center gap-12">
            <div class="icon-box success">${UI.icon('emoji_events')}</div>
            <div class="flex-1"><div class="fs-14 fw-600">${g.name}</div><div class="fs-11 text-muted">${g.category}</div></div>
            ${UI.badge('Concluída','success')}
          </div>
        </div>`).join('')}
      </section>` : ''}
      <button class="btn btn-primary btn-block mt-12" onclick="GoalsView.showForm()">${UI.icon('add')} Nova meta</button>
    `;
  },

  renderGoal(g) {
    const pct = Finance.percent(g.current, g.target);
    const days = Finance.daysUntil(g.endDate);
    const remaining = g.target - g.current;
    const pace = days > 0 ? (remaining / days).toFixed(1) : 0;
    const status = pct >= 100 ? 'Concluída' : days <= 0 ? 'Prazo encerrado' : pct >= 70 ? 'Quase lá!' : pct >= 40 ? 'Em progresso' : 'Iniciando';
    const statusType = pct >= 100 ? 'success' : days <= 0 ? 'danger' : pct >= 70 ? 'success' : pct >= 40 ? 'info' : 'warning';

    return `<section class="glass">
      <div class="flex items-center gap-12">
        <div class="icon-box" style="background:${g.color}22;color:${g.color}">${UI.icon(g.icon||'flag')}</div>
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span class="fs-16 fw-600">${g.name}</span>
            ${UI.badge(status, statusType)}
          </div>
          <div class="fs-12 text-muted mt-4">${g.category} · ${g.desc||''}</div>
        </div>
      </div>
      <div class="flex justify-between items-center mt-12">
        <span class="font-h fs-24 fw-700" style="color:${g.color}">${pct}%</span>
        <span class="fs-13 text-muted">${g.current} / ${g.target} ${g.unit}</span>
      </div>
      ${UI.progress(pct, 'green', true)}
      <div class="flex justify-between mt-8">
        <span class="fs-12 text-muted">${days > 0 ? `${days} dias restantes` : 'Prazo encerrado'}</span>
        ${days > 0 && remaining > 0 ? `<span class="fs-12 text-muted">Ritmo: <strong>${pace} ${g.unit}/dia</strong></span>` : ''}
      </div>
      <div class="flex gap-8 mt-12">
        <button class="btn btn-primary btn-sm flex-1" onclick="GoalsView.addProgress('${g.id}')">Atualizar progresso</button>
        <button class="btn btn-secondary btn-sm" onclick="GoalsView.editGoal('${g.id}')">${UI.icon('edit')}</button>
        <button class="btn btn-danger btn-sm" onclick="GoalsView.deleteGoal('${g.id}')">${UI.icon('delete')}</button>
      </div>
    </section>`;
  },

  addProgress(id) {
    const g = DB.getItem('goals', id);
    if (!g) return;
    UI.modal.show(`
      <h3 class="modal-title">Atualizar: ${g.name}</h3>
      <p class="fs-14 text-muted mb-8">Atual: ${g.current} ${g.unit} de ${g.target} ${g.unit}</p>
      ${UI.formField(`Novo valor (${g.unit})`,'goal-value','number',{value:g.current, step:'0.01', min:'0'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="GoalsView.saveProgress('${id}')">Salvar</button>
      </div>
    `);
  },

  saveProgress(id) {
    const val = parseFloat(document.getElementById('goal-value')?.value);
    if (isNaN(val)) { UI.toast('Informe um valor','error'); return; }
    DB.updateItem('goals', id, { current: val });
    UI.modal.hide();
    const g = DB.getItem('goals', id);
    if (g && g.current >= g.target) UI.toast('🎉 Meta concluída! Parabéns!','success');
    else UI.toast('Progresso atualizado!');
    App.refresh();
  },

  editGoal(id) {
    const g = DB.getItem('goals', id);
    if (!g) return;
    UI.modal.show(`
      <h3 class="modal-title">Editar Meta</h3>
      ${UI.formField('Nome','goale-name','text',{required:true, value:g.name})}
      ${UI.formField('Categoria','goale-cat','select',{options:['financeira','corrida','treino','saúde','estudo','trabalho','produtividade','hábito','projeto','pessoal'], value:g.category})}
      <div class="form-row">
        ${UI.formField('Valor alvo','goale-target','number',{required:true, min:'1', value:g.target})}
        ${UI.formField('Unidade','goale-unit','text',{required:true, value:g.unit})}
      </div>
      <div class="form-row">
        ${UI.formField('Data início','goale-start','date',{value:g.startDate||''})}
        ${UI.formField('Data fim','goale-end','date',{required:true, value:g.endDate})}
      </div>
      ${UI.formField('Descrição','goale-desc','text',{value:g.desc||''})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="GoalsView.saveEdit('${id}')">Salvar</button>
      </div>
    `);
  },

  saveEdit(id) {
    const name = UI.getVal('goale-name');
    const target = UI.getNum('goale-target');
    if (!name || !target) { UI.toast('Preencha os campos','error'); return; }
    const icons = {corrida:'directions_run',treino:'fitness_center',saúde:'favorite',estudo:'school',financeira:'savings',trabalho:'work',produtividade:'speed',hábito:'repeat',projeto:'rocket_launch',pessoal:'person'};
    const cat = UI.getVal('goale-cat');
    DB.updateItem('goals', id, {
      name, category: cat, target, unit: UI.getVal('goale-unit'),
      startDate: UI.getVal('goale-start'), endDate: UI.getVal('goale-end'),
      desc: UI.getVal('goale-desc'), icon: icons[cat]||'flag'
    });
    UI.modal.hide(); UI.toast('Meta atualizada!'); App.refresh();
  },

  deleteGoal(id) {
    UI.confirm('Excluir meta?','').then(ok => { if (ok) { DB.deleteItem('goals',id); UI.toast('Meta excluída'); App.refresh(); }});
  },

  showForm() {
    UI.modal.show(`
      <h3 class="modal-title">Nova Meta</h3>
      ${UI.formField('Nome','goal-name','text',{required:true, placeholder:'Ex: Correr 80km'})}
      ${UI.formField('Categoria','goal-cat','select',{options:['financeira','corrida','treino','saúde','estudo','trabalho','produtividade','hábito','projeto','pessoal']})}
      <div class="form-row">
        ${UI.formField('Valor alvo','goal-target','number',{required:true, min:'1'})}
        ${UI.formField('Unidade','goal-unit','text',{required:true, placeholder:'km, R$, horas...'})}
      </div>
      <div class="form-row">
        ${UI.formField('Data início','goal-start','date',{value:Finance.today()})}
        ${UI.formField('Data fim','goal-end','date',{required:true})}
      </div>
      ${UI.formField('Descrição','goal-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="GoalsView.saveNew()">Criar meta</button>
      </div>
    `);
  },

  saveNew() {
    const name = UI.getVal('goal-name');
    const target = UI.getNum('goal-target');
    const unit = UI.getVal('goal-unit');
    const endDate = UI.getVal('goal-end');
    if (!name || !target || !unit || !endDate) { UI.toast('Preencha os campos obrigatórios','error'); return; }
    const icons = {corrida:'directions_run',treino:'fitness_center',saúde:'favorite',estudo:'school',financeira:'savings',trabalho:'work',produtividade:'speed',hábito:'repeat',projeto:'rocket_launch',pessoal:'person'};
    const cat = UI.getVal('goal-cat');
    DB.addItem('goals', {
      name, desc: UI.getVal('goal-desc'), category: cat,
      type:'accumulative', unit, target, current:0,
      startDate: UI.getVal('goal-start'), endDate,
      priority:'medium', color:'#2ecc71', icon: icons[cat]||'flag'
    });
    UI.modal.hide(); UI.toast('Meta criada!'); App.refresh();
  }
};
