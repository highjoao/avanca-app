/* ===== PLANNING VIEW — PROJECTS + SUBTASKS + TASKS ===== */
const PlanningView = {
  tab: 'today',
  selectedProject: null,

  render() {
    if (this.selectedProject) return this.renderProjectDetail(this.selectedProject);
    const data = DB.get();
    const todayStr = Finance.today();
    const todayTasks = data.tasks.filter(t => t.date === todayStr);
    const completedToday = todayTasks.filter(t => t.status === 'completed').length;
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      weekDays.push({ date: ds, label: d.toLocaleDateString('pt-BR',{weekday:'short'}), day: d.getDate(), tasks: data.tasks.filter(t => t.date === ds), isToday: ds === todayStr });
    }
    return `
      <section><h2 class="font-h fs-24 fw-700">Planejamento</h2><p class="fs-14 text-muted mt-4">Organize sua semana e transforme ideias em ação</p></section>
      <div class="tabs">
        ${['today','week','projects','tasks'].map(t => `<button class="tab ${this.tab===t?'active':''}" onclick="PlanningView.setTab('${t}')">${t==='today'?'Hoje':t==='week'?'Semana':t==='projects'?'Projetos':'Tarefas'}</button>`).join('')}
      </div>
      ${this.tab === 'today' ? this.renderToday(todayTasks, completedToday) :
        this.tab === 'week' ? this.renderWeek(weekDays) :
        this.tab === 'projects' ? this.renderProjects(data.projects||[]) :
        this.renderAllTasks(data.tasks)}
    `;
  },

  // ===== TODAY =====
  renderToday(tasks, done) {
    return `
      <section class="glass">
        <div class="flex justify-between items-center">
          <div><div class="summary-label">PROGRESSO HOJE</div><div class="font-h fs-24 fw-700 mt-4">${done}/${tasks.length}</div></div>
          <div style="width:50px;height:50px;border-radius:50%;background:conic-gradient(var(--primary) ${Finance.percent(done,tasks.length)*3.6}deg, var(--surface-4) 0);display:flex;align-items:center;justify-content:center">
            <div style="width:38px;height:38px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center" class="font-h fs-14 fw-700">${Finance.percent(done,tasks.length)}%</div>
          </div>
        </div>
      </section>
      <section>
        ${tasks.length === 0 ? UI.emptyState('today','Nada para hoje','Adicione tarefas para organizar seu dia.') :
          tasks.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')).map(t => this.taskRow(t)).join('')}
      </section>
      <button class="btn btn-primary btn-block" onclick="PlanningView.showTaskForm()">${UI.icon('add')} Nova tarefa</button>
    `;
  },

  taskRow(t) {
    return `<div class="glass glass-sm mb-8">
      <div class="flex items-center gap-10">
        <button class="subtask-check ${t.status==='completed'?'done':''}" onclick="PlanningView.toggleTask('${t.id}')">
          ${UI.icon('check')}
        </button>
        <div class="flex-1" style="min-width:0">
          <div class="fs-14 fw-500 ${t.status==='completed'?'subtask-text done':''}">${t.name}</div>
          <div class="fs-11 text-muted">${t.time||'Sem horário'}${t.desc?' · '+t.desc:''}</div>
        </div>
        ${t.priority==='high'?UI.badge('Alta','danger'):''}
        <button class="text-dim" onclick="PlanningView.deleteTask('${t.id}')" style="padding:4px">${UI.icon('close','fs-18')}</button>
      </div>
    </div>`;
  },

  // ===== WEEK =====
  renderWeek(days) {
    const total = days.reduce((s,d) => s+d.tasks.length, 0);
    const done = days.reduce((s,d) => s+d.tasks.filter(t=>t.status==='completed').length, 0);
    return `
      <section class="glass">
        <div class="summary-label">PROGRESSO SEMANAL</div>
        <div class="flex items-center gap-12 mt-8">
          <div class="font-h fs-24 fw-700">${done}/${total}</div>
          <div class="flex-1">${UI.progress(Finance.percent(done,total),'blue',true)}</div>
        </div>
      </section>
      <section class="flex gap-6 scroll-x">
        ${days.map(d => `<div class="glass glass-sm shrink-0" style="min-width:86px;text-align:center;${d.isToday?'border-color:var(--secondary)':''}">
          <div class="fs-11 text-muted">${d.label}</div>
          <div class="font-h fs-20 fw-700 mt-4 ${d.isToday?'text-secondary':''}">${d.day}</div>
          <div class="fs-11 mt-4 ${d.tasks.length?'text-primary':'text-dim'}">${d.tasks.length} tarefa${d.tasks.length!==1?'s':''}</div>
        </div>`).join('')}
      </section>
      ${days.filter(d=>d.tasks.length>0).map(d => `<section>
        <div class="fs-13 fw-600 text-muted mb-8">${d.label.toUpperCase()} ${d.day}</div>
        ${d.tasks.map(t => this.taskRow(t)).join('')}
      </section>`).join('')}
    `;
  },

  // ===== PROJECTS =====
  renderProjects(projects) {
    if (!projects.length) return `<section>${UI.emptyState('rocket_launch','Nenhum projeto','Crie um projeto com etapas e acompanhe seu progresso real.')}</section>
      <button class="btn btn-primary btn-block" onclick="PlanningView.showProjectForm()">${UI.icon('add')} Novo projeto</button>`;
    return projects.map(p => {
      const pct = this.calcProjectProgress(p);
      const total = (p.steps||[]).length;
      const done = (p.steps||[]).filter(s=>s.done).length;
      const days = Finance.daysUntil(p.deadline);
      return `<section class="glass" style="cursor:pointer" onclick="PlanningView.openProject('${p.id}')">
        <div class="flex items-center gap-12">
          <div class="icon-box accent">${UI.icon('rocket_launch')}</div>
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <span class="fs-16 fw-600">${p.name}</span>
              ${UI.badge(p.status==='completed'?'Concluído':'Ativo', p.status==='completed'?'success':'info')}
            </div>
            <div class="fs-12 text-muted mt-4">${p.objective||p.desc||''}</div>
          </div>
        </div>
        <div class="flex justify-between items-center mt-12">
          <span class="font-h fs-20 fw-700 text-secondary">${pct}%</span>
          <span class="fs-12 text-muted">${done}/${total} etapas · ${days>0?days+' dias':days===0?'Hoje':'Encerrado'}</span>
        </div>
        ${UI.progress(pct, 'purple', true)}
      </section>`;
    }).join('') + `<button class="btn btn-primary btn-block mt-12" onclick="PlanningView.showProjectForm()">${UI.icon('add')} Novo projeto</button>`;
  },

  calcProjectProgress(p) {
    const steps = p.steps || [];
    if (!steps.length) return 0;
    return Math.round((steps.filter(s=>s.done).length / steps.length) * 100);
  },

  // ===== PROJECT DETAIL =====
  renderProjectDetail(pid) {
    const p = DB.getItem('projects', pid);
    if (!p) { this.selectedProject = null; return this.render(); }
    const pct = this.calcProjectProgress(p);
    const steps = p.steps || [];
    const done = steps.filter(s=>s.done).length;
    const days = Finance.daysUntil(p.deadline);

    return `
      <section>
        <div class="flex items-center gap-10">
          <button class="icon-box secondary" onclick="PlanningView.closeProject()" style="width:36px;height:36px;border-radius:10px">${UI.icon('arrow_back')}</button>
          <div class="flex-1"><h2 class="font-h fs-20 fw-700">${p.name}</h2><p class="fs-12 text-muted">${p.objective||''}</p></div>
          <button onclick="PlanningView.editProject('${p.id}')" style="padding:4px">${UI.icon('edit','text-muted fs-20')}</button>
        </div>
      </section>

      <section class="glass">
        <div class="flex justify-between items-center">
          <div><div class="summary-label">PROGRESSO</div><div class="font-h fs-28 fw-700 mt-4 text-secondary">${pct}%</div></div>
          <div style="width:56px;height:56px;border-radius:50%;background:conic-gradient(var(--accent) ${pct*3.6}deg, var(--surface-4) 0);display:flex;align-items:center;justify-content:center">
            <div style="width:42px;height:42px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center" class="font-h fs-14 fw-700">${done}/${steps.length}</div>
          </div>
        </div>
        ${UI.progress(pct, 'purple', true)}
        <div class="flex justify-between mt-8">
          <span class="fs-12 text-muted">Prazo: ${Finance.dateStr(p.deadline)}</span>
          <span class="fs-12 text-muted">${days>0?days+' dias restantes':days===0?'Vence hoje':'Prazo encerrado'}</span>
        </div>
      </section>

      ${p.desc ? `<section class="glass glass-sm"><div class="fs-13 text-muted" style="line-height:1.5">${p.desc}</div></section>` : ''}

      <section>
        <div class="section-header"><span class="section-title">Etapas</span><span class="fs-12 text-muted">${done}/${steps.length} concluídas</span></div>

        ${steps.map((s, i) => `
          <div class="subtask-item" data-idx="${i}">
            <button class="subtask-check ${s.done?'done':''}" onclick="event.stopPropagation();PlanningView.toggleStep('${p.id}',${i})">
              ${UI.icon('check')}
            </button>
            <div class="subtask-text ${s.done?'done':''}" onclick="PlanningView.showStepDetail('${p.id}',${i})" style="cursor:pointer">
              ${s.name}
              ${s.responsible ? `<div class="fs-11 text-muted mt-4">👤 ${s.responsible}</div>` : ''}
            </div>
            ${s.deadline ? `<span class="subtask-date">${Finance.dateStr(s.deadline)}</span>` : ''}
            <div class="subtask-actions">
              <button onclick="event.stopPropagation();PlanningView.editStep('${p.id}',${i})">${UI.icon('edit')}</button>
              <button onclick="event.stopPropagation();PlanningView.deleteStep('${p.id}',${i})">${UI.icon('close')}</button>
            </div>
          </div>
        `).join('')}

        <div class="subtask-add" onclick="PlanningView.addStepInline('${p.id}')">
          ${UI.icon('add','fs-18')} Adicionar etapa
        </div>
      </section>

      <div class="flex gap-10 mt-12">
        <button class="btn btn-danger btn-sm" onclick="PlanningView.deleteProject('${p.id}')">${UI.icon('delete')} Excluir</button>
        ${p.status!=='completed'&&pct===100 ? `<button class="btn btn-primary btn-sm flex-1" onclick="PlanningView.completeProject('${p.id}')">🎉 Concluir projeto</button>` : ''}
      </div>
    `;
  },

  // ===== PROJECT ACTIONS =====
  openProject(id) { this.selectedProject = id; App.refresh(); },
  closeProject() { this.selectedProject = null; App.refresh(); },

  toggleStep(pid, idx) {
    const p = DB.getItem('projects', pid);
    if (!p || !p.steps[idx]) return;
    p.steps[idx].done = !p.steps[idx].done;
    p.progress = this.calcProjectProgress(p);
    if (p.steps.every(s=>s.done)) p.status = 'completed';
    else p.status = 'active';
    DB.updateItem('projects', pid, p);
    App.refresh();
    if (p.steps[idx].done) UI.toast('Etapa concluída! ✓');
  },

  addStepInline(pid) {
    UI.modal.show(`
      <h3 class="modal-title">Nova Etapa</h3>
      ${UI.formField('Nome da etapa','step-name','text',{required:true, placeholder:'Ex: Revisar documentos'})}
      ${UI.formField('Prazo','step-deadline','date')}
      ${UI.formField('Responsável','step-responsible','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="PlanningView.saveStep('${pid}')">Adicionar</button>
      </div>
    `);
  },

  saveStep(pid) {
    const name = UI.getVal('step-name');
    if (!name) { UI.toast('Informe o nome','error'); return; }
    const p = DB.getItem('projects', pid);
    if (!p) return;
    p.steps = p.steps || [];
    p.steps.push({
      name,
      done: false,
      deadline: UI.getVal('step-deadline') || null,
      responsible: UI.getVal('step-responsible') || null,
      desc: '',
      createdAt: Finance.today()
    });
    p.progress = this.calcProjectProgress(p);
    p.status = 'active';
    DB.updateItem('projects', pid, p);
    UI.modal.hide(); UI.toast('Etapa adicionada!'); App.refresh();
  },

  editStep(pid, idx) {
    const p = DB.getItem('projects', pid);
    if (!p || !p.steps[idx]) return;
    const s = p.steps[idx];
    UI.modal.show(`
      <h3 class="modal-title">Editar Etapa</h3>
      ${UI.formField('Nome','stepe-name','text',{required:true, value:s.name})}
      ${UI.formField('Prazo','stepe-deadline','date',{value:s.deadline||''})}
      ${UI.formField('Responsável','stepe-responsible','text',{value:s.responsible||''})}
      ${UI.formField('Descrição','stepe-desc','text',{value:s.desc||'', placeholder:'Detalhes opcionais'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="PlanningView.saveEditStep('${pid}',${idx})">Salvar</button>
      </div>
    `);
  },

  saveEditStep(pid, idx) {
    const p = DB.getItem('projects', pid);
    if (!p || !p.steps[idx]) return;
    p.steps[idx].name = UI.getVal('stepe-name') || p.steps[idx].name;
    p.steps[idx].deadline = UI.getVal('stepe-deadline') || null;
    p.steps[idx].responsible = UI.getVal('stepe-responsible') || null;
    p.steps[idx].desc = UI.getVal('stepe-desc') || '';
    DB.updateItem('projects', pid, p);
    UI.modal.hide(); UI.toast('Etapa atualizada!'); App.refresh();
  },

  deleteStep(pid, idx) {
    UI.confirm('Excluir etapa?','').then(ok => {
      if (!ok) return;
      const p = DB.getItem('projects', pid);
      if (!p) return;
      p.steps.splice(idx, 1);
      p.progress = this.calcProjectProgress(p);
      DB.updateItem('projects', pid, p);
      UI.toast('Etapa excluída'); App.refresh();
    });
  },

  showStepDetail(pid, idx) {
    const p = DB.getItem('projects', pid);
    if (!p || !p.steps[idx]) return;
    const s = p.steps[idx];
    UI.modal.show(`
      <h3 class="modal-title">${s.name}</h3>
      <div class="flex flex-col gap-10">
        <div class="flex justify-between"><span class="text-muted fs-14">Status</span>${UI.badge(s.done?'Concluída':'Pendente', s.done?'success':'warning')}</div>
        ${s.deadline ? `<div class="flex justify-between"><span class="text-muted fs-14">Prazo</span><span class="fw-500">${Finance.dateFull(s.deadline)}</span></div>` : ''}
        ${s.responsible ? `<div class="flex justify-between"><span class="text-muted fs-14">Responsável</span><span class="fw-500">${s.responsible}</span></div>` : ''}
        ${s.desc ? `<div class="flex justify-between"><span class="text-muted fs-14">Descrição</span><span class="fw-500">${s.desc}</span></div>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary flex-1" onclick="UI.modal.hide()">Fechar</button>
        <button class="btn btn-primary flex-1" onclick="UI.modal.hide();PlanningView.editStep('${pid}',${idx})">Editar</button>
      </div>
    `);
  },

  completeProject(pid) {
    DB.updateItem('projects', pid, { status: 'completed', progress: 100 });
    UI.toast('🎉 Projeto concluído! Parabéns!'); App.refresh();
  },

  editProject(pid) {
    const p = DB.getItem('projects', pid);
    if (!p) return;
    UI.modal.show(`
      <h3 class="modal-title">Editar Projeto</h3>
      ${UI.formField('Nome','projed-name','text',{required:true, value:p.name})}
      ${UI.formField('Objetivo','projed-obj','text',{value:p.objective||''})}
      ${UI.formField('Prazo','projed-deadline','date',{required:true, value:p.deadline})}
      ${UI.formField('Descrição','projed-desc','textarea',{value:p.desc||''})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="PlanningView.saveEditProject('${pid}')">Salvar</button>
      </div>
    `);
  },

  saveEditProject(pid) {
    const name = UI.getVal('projed-name');
    if (!name) { UI.toast('Informe o nome','error'); return; }
    DB.updateItem('projects', pid, {
      name, objective: UI.getVal('projed-obj'),
      deadline: UI.getVal('projed-deadline'),
      desc: document.getElementById('projed-desc')?.value?.trim() || ''
    });
    UI.modal.hide(); UI.toast('Projeto atualizado!'); App.refresh();
  },

  deleteProject(pid) {
    UI.confirm('Excluir projeto?','Todas as etapas serão removidas.').then(ok => {
      if (ok) { DB.deleteItem('projects', pid); this.selectedProject = null; UI.toast('Projeto excluído'); App.refresh(); }
    });
  },

  // ===== PROJECT FORM (with subtasks) =====
  _tempSteps: [],

  showProjectForm() {
    this._tempSteps = [];
    UI.modal.show(`
      <h3 class="modal-title">Novo Projeto</h3>
      ${UI.formField('Nome do projeto','proj-name','text',{required:true, placeholder:'Ex: Organizar Empresa'})}
      ${UI.formField('Objetivo','proj-obj','text',{required:true, placeholder:'Ex: Estruturar finanças até junho'})}
      ${UI.formField('Prazo','proj-deadline','date',{required:true})}
      ${UI.formField('Descrição','proj-desc','textarea',{placeholder:'Descreva o projeto (opcional)'})}

      <div class="form-group">
        <label class="form-label">Etapas / Submetas</label>
        <div id="proj-steps-list"></div>
        <div class="flex gap-8 mt-8">
          <input type="text" id="proj-step-input" class="inline-input" placeholder="Nome da etapa..." style="flex:1"/>
          <button class="btn btn-secondary btn-sm" onclick="PlanningView.addTempStep()">Adicionar</button>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="PlanningView.saveProject()">Criar projeto</button>
      </div>
    `);
    document.getElementById('proj-step-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.addTempStep(); }
    });
  },

  addTempStep() {
    const input = document.getElementById('proj-step-input');
    const name = input.value.trim();
    if (!name) return;
    this._tempSteps.push({ name, done: false, deadline: null, responsible: null, desc: '', createdAt: Finance.today() });
    input.value = '';
    this.renderTempSteps();
    input.focus();
  },

  removeTempStep(idx) {
    this._tempSteps.splice(idx, 1);
    this.renderTempSteps();
  },

  renderTempSteps() {
    const list = document.getElementById('proj-steps-list');
    if (!list) return;
    list.innerHTML = this._tempSteps.map((s, i) => `
      <div class="subtask-item">
        <div class="subtask-check"><span class="material-symbols-outlined" style="font-size:14px;opacity:.3">drag_indicator</span></div>
        <span class="subtask-text">${s.name}</span>
        <button class="text-dim" onclick="PlanningView.removeTempStep(${i})" style="padding:4px">${UI.icon('close','fs-16')}</button>
      </div>
    `).join('');
  },

  saveProject() {
    const name = UI.getVal('proj-name');
    const deadline = UI.getVal('proj-deadline');
    if (!name || !deadline) { UI.toast('Preencha nome e prazo','error'); return; }
    DB.addItem('projects', {
      name,
      objective: UI.getVal('proj-obj'),
      desc: document.getElementById('proj-desc')?.value?.trim() || '',
      deadline,
      steps: [...this._tempSteps],
      progress: 0,
      status: 'active'
    });
    this._tempSteps = [];
    UI.modal.hide(); UI.toast('Projeto criado!'); App.refresh();
  },

  // ===== ALL TASKS =====
  renderAllTasks(tasks) {
    const sorted = [...tasks].sort((a,b) => a.date.localeCompare(b.date));
    return `
      ${sorted.length === 0 ? `<section>${UI.emptyState('task_alt','Nenhuma tarefa','')}</section>` :
        sorted.map(t => this.taskRow(t)).join('')}
      <button class="btn btn-primary btn-block mt-12" onclick="PlanningView.showTaskForm()">${UI.icon('add')} Nova tarefa</button>
    `;
  },

  // ===== TASK ACTIONS =====
  setTab(t) { this.tab = t; App.refresh(); },

  toggleTask(id) {
    const t = DB.getItem('tasks', id);
    if (t) { DB.updateItem('tasks', id, { status: t.status==='completed'?'pending':'completed' }); App.refresh(); }
  },

  deleteTask(id) {
    DB.deleteItem('tasks', id); UI.toast('Tarefa excluída'); App.refresh();
  },

  showTaskForm() {
    UI.modal.show(`
      <h3 class="modal-title">Nova Tarefa</h3>
      ${UI.formField('Nome','task-name','text',{required:true, placeholder:'Ex: Revisar planilha'})}
      <div class="form-row">
        ${UI.formField('Data','task-date','date',{value:Finance.today()})}
        ${UI.formField('Horário','task-time','time')}
      </div>
      ${UI.formField('Prioridade','task-priority','select',{options:[{value:'medium',label:'Média'},{value:'high',label:'Alta'},{value:'low',label:'Baixa'}]})}
      ${UI.formField('Descrição','task-desc','text',{placeholder:'Opcional'})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="PlanningView.saveTask()">Salvar</button>
      </div>
    `);
  },

  saveTask() {
    const name = UI.getVal('task-name');
    if (!name) { UI.toast('Informe o nome','error'); return; }
    DB.addItem('tasks', {
      name, date: UI.getVal('task-date') || Finance.today(),
      time: UI.getVal('task-time') || null,
      priority: UI.getVal('task-priority') || 'medium',
      status: 'pending',
      desc: UI.getVal('task-desc'),
      project: null, goal: null
    });
    UI.modal.hide(); UI.toast('Tarefa criada!'); App.refresh();
  },

  showProjectForm2() { this.showProjectForm(); }
};
