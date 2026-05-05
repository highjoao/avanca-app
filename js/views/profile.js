/* ===== PROFILE VIEW ===== */
const ProfileView = {
  render() {
    const data = DB.get();
    const totalIncome = data.incomes.reduce((s,i) => s+i.amount, 0);
    const totalExpense = data.expenses.reduce((s,e) => s+e.amount, 0);
    const completedGoals = data.goals.filter(g => g.current >= g.target).length;
    const totalTasks = data.tasks.length;
    const doneTasks = data.tasks.filter(t => t.status === 'completed').length;
    const email = Auth.currentUser?.email || '';

    return `
      <section style="text-align:center">
        <div class="header-avatar" style="width:72px;height:72px;font-size:28px;margin:0 auto">${(data.user.name||'U')[0]}</div>
        <h2 class="font-h fs-24 fw-700 mt-12">${data.user.name || 'Usuário'}</h2>
        <p class="fs-13 text-muted mt-4">${email}</p>
      </section>

      <section class="glass insight-card" style="border-radius:var(--radius)">
        <div class="flex items-center gap-12">
          <div class="icon-box accent">${UI.icon('auto_awesome')}</div>
          <div>
            <div class="fs-14 fw-600" style="color:var(--accent)">Você está evoluindo!</div>
            <div class="fs-12 text-muted mt-4" style="line-height:1.5">${completedGoals > 0 ? `Você já concluiu ${completedGoals} meta${completedGoals>1?'s':''}!` : 'Continue registrando para ver sua evolução.'}</div>
          </div>
        </div>
      </section>

      <section class="summary-grid">
        ${UI.summaryCard('Ganhos totais', Finance.currency(totalIncome), 'text-success')}
        ${UI.summaryCard('Gastos totais', Finance.currency(totalExpense), 'text-danger')}
        ${UI.summaryCard('Metas concluídas', completedGoals.toString(), 'text-primary')}
        ${UI.summaryCard('Tarefas feitas', `${doneTasks}/${totalTasks}`)}
      </section>

      <section>
        <div class="section-header"><span class="section-title">Configurações</span></div>
        <div class="glass">
          ${this.settingItem('person','Dados pessoais','Altere seu nome','ProfileView.editName()')}
          ${this.settingItem('download','Exportar dados','Baixar seus dados em JSON','ProfileView.exportData()')}
          ${this.settingItem('delete','Limpar todos os dados','Resetar seus dados','ProfileView.resetData()')}
        </div>
      </section>

      <section>
        <button class="btn btn-danger btn-block" onclick="ProfileView.logout()">
          ${UI.icon('logout')} Sair da conta
        </button>
      </section>

      <section style="text-align:center;padding:20px 0">
        <div class="font-h fs-16 fw-700 text-gradient">Avança</div>
        <div class="fs-11 text-dim mt-4">Controle seu dinheiro. Organize sua rotina. Avance na vida.</div>
        <div class="fs-11 text-dim mt-4">v2.1.1 — Online</div>
      </section>
    `;
  },

  settingItem(icon, title, sub, onclick) {
    return `<div class="list-item" ${onclick ? `onclick="${onclick}" style="cursor:pointer"` : ''}>
      <div class="icon-box secondary">${UI.icon(icon)}</div>
      <div class="list-item-info"><div class="list-item-title">${title}</div><div class="list-item-sub">${sub}</div></div>
      ${UI.icon('chevron_right','text-dim')}
    </div>`;
  },

  editName() {
    const data = DB.get();
    UI.modal.show(`
      <h3 class="modal-title">Alterar nome</h3>
      ${UI.formField('Seu nome','profile-name','text',{value:data.user.name, required:true})}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.modal.hide()">Cancelar</button>
        <button class="btn btn-primary flex-1" onclick="ProfileView.saveName()">Salvar</button>
      </div>
    `);
  },

  saveName() {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return;
    const data = DB.get(); data.user.name = name; DB.save(data);
    document.getElementById('header-avatar').textContent = name[0].toUpperCase();
    UI.modal.hide(); UI.toast('Nome atualizado!'); App.refresh();
  },

  exportData() {
    const data = JSON.stringify(DB.get(), null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'avanca_backup.json';
    a.click();
    UI.toast('Dados exportados!');
  },

  resetData() {
    UI.confirm('Limpar todos os dados?','Esta ação não pode ser desfeita. Todos os seus dados serão removidos.').then(async ok => {
      if (ok) {
        const userId = DB._userId;
        DB._cache = JSON.parse(JSON.stringify(DB._default));
        DB._cache.user.onboarded = true;
        DB._cache.user.name = Auth.currentUser?.email?.split('@')[0] || 'Usuário';
        DB.save(DB._cache);
        UI.toast('Dados resetados!');
        App.refresh();
      }
    });
  },

  async logout() {
    UI.confirm('Sair da conta?','Seus dados estão salvos na nuvem.').then(async ok => {
      if (ok) await App.logout();
    });
  }
};
