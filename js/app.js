/* ===== AVANÇA MAIN APP ===== */
const App = {
  currentView: 'dashboard',
  views: {
    dashboard: DashboardView,
    expenses: ExpensesView,
    cards: CardsView,
    receivables: ReceivablesView,
    income: IncomeView,
    goals: GoalsView,
    planning: PlanningView,
    profile: ProfileView
  },

  // ===== BOOT =====
  async init() {
    // Show loading
    this.showLoading();

    // Check existing session
    const session = await Auth.getSession();

    if (session) {
      // User is logged in — load data and render
      await this.onAuthSuccess();
    } else {
      // Not logged in — show login screen
      this.hideApp();
      this.hideLoading();
      Auth.showLogin();
    }

    // Listen for auth state changes (e.g. email confirmation redirect)
    Auth.onAuthChange(async (session) => {
      if (session) {
        Auth.hide();
        await this.onAuthSuccess();
      } else {
        this.hideApp();
        Auth.showLogin();
      }
    });
  },

  // Called after successful auth
  async onAuthSuccess() {
    this.showLoading();
    try {
      // Load user data from Supabase
      await DB.init(Auth.currentUser.id);

      // Set user avatar
      const data = DB.get();
      document.getElementById('header-avatar').textContent = (data.user.name || Auth.currentUser.email?.[0] || 'U').charAt(0).toUpperCase();

      // Show app
      this.showApp();
      this.hideLoading();

      // Setup navigation (only once)
      if (!this._navInitialized) {
        this.setupNav();
        this._navInitialized = true;
      }

      // Check onboarding
      if (!data.user.onboarded) {
        this.showOnboarding();
      }

      // Render
      this.renderView();
    } catch (err) {
      console.error('Load error:', err);
      this.hideLoading();
      Auth.showLogin();
    }
  },

  showApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    document.getElementById('fab-main').classList.remove('hidden');
  },

  hideApp() {
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('fab-main').classList.add('hidden');
  },

  showLoading() {
    document.getElementById('app-loading').classList.remove('hidden');
  },

  hideLoading() {
    document.getElementById('app-loading').classList.add('hidden');
  },

  // ===== NAVIGATION =====
  setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'more') { this.toggleMore(); return; }
        this.navigate(view);
      });
    });

    document.querySelectorAll('.more-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.view);
        this.hideMore();
      });
    });

    // FAB
    const fab = document.getElementById('fab-main');
    const fabOverlay = document.getElementById('fab-overlay');
    fab.addEventListener('click', () => {
      fab.classList.toggle('open');
      fabOverlay.classList.toggle('hidden');
    });
    fabOverlay.addEventListener('click', (e) => {
      if (e.target === fabOverlay) { fab.classList.remove('open'); fabOverlay.classList.add('hidden'); }
    });

    document.querySelectorAll('.fab-option').forEach(btn => {
      btn.addEventListener('click', () => {
        fab.classList.remove('open');
        fabOverlay.classList.add('hidden');
        const action = btn.dataset.action;
        switch(action) {
          case 'new-expense': ExpensesView.showForm(); break;
          case 'new-income': IncomeView.showForm(); break;
          case 'new-card': CardsView.showForm(); break;
          case 'new-receivable': ReceivablesView.showForm(); break;
          case 'new-goal': GoalsView.showForm(); break;
          case 'new-task': PlanningView.showTaskForm(); break;
          case 'new-project': PlanningView.showProjectForm(); break;
        }
      });
    });

    document.getElementById('more-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('more-overlay')) this.hideMore();
    });
  },

  navigate(view) {
    if (!this.views[view]) return;
    if (view === 'cards') CardsView.selectedCard = null;
    if (view === 'receivables') ReceivablesView.selectedPerson = null;
    if (view === 'planning') PlanningView.selectedProject = null;
    this.currentView = view;
    this.updateNav();
    this.renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refresh() { this.renderView(); },

  renderView() {
    UI.destroyCharts();
    const view = this.views[this.currentView];
    const container = document.getElementById('view-container');
    container.innerHTML = view.render();
    container.style.animation = 'none';
    container.offsetHeight; // reflow
    container.style.animation = 'fadeUp .3s ease';
    if (view.afterRender) setTimeout(() => view.afterRender(), 50);
  },

  updateNav() {
    const mainViews = ['dashboard','expenses','cards','receivables'];
    document.querySelectorAll('.nav-item').forEach(btn => {
      const v = btn.dataset.view;
      btn.classList.toggle('active', v === this.currentView || (v === 'more' && !mainViews.includes(this.currentView)));
      const icon = btn.querySelector('.material-symbols-outlined');
      if (v === this.currentView) {
        icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        icon.style.fontVariationSettings = "'FILL' 0";
      }
    });
  },

  toggleMore() { document.getElementById('more-overlay').classList.toggle('hidden'); },
  hideMore() { document.getElementById('more-overlay').classList.add('hidden'); },

  // ===== LOGOUT =====
  async logout() {
    await DB.flushSync(); // Save any pending changes
    DB.clear();
    await Auth.signOut();
    this.hideApp();
    this._navInitialized = false;
    Auth.showLogin();
  },

  // ===== ONBOARDING =====
  showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const container = document.getElementById('onboarding-container');
    overlay.classList.remove('hidden');

    const steps = [
      { icon:'rocket_launch', title:'Bem-vindo ao Avança!', desc:'Vamos organizar seu dinheiro, suas metas e sua rotina em um só lugar.', type:'intro' },
      { icon:'target', title:'Qual seu principal objetivo?', desc:'Escolha o que é mais importante para você agora.', type:'select',
        options:['Controlar gastos','Organizar cartões','Saber quem me deve','Criar metas','Planejar minha semana','Melhorar minha vida financeira'] },
      { icon:'person', title:'Como podemos te chamar?', desc:'Digite seu nome para personalizar sua experiência.', type:'input' }
    ];

    let current = 0;

    const renderStep = () => {
      const step = steps[current];
      container.innerHTML = `<div class="onboarding-step">
        <span class="material-symbols-outlined onboarding-icon">${step.icon}</span>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-desc">${step.desc}</p>
        ${step.type === 'select' ? `<div class="onboarding-options">${step.options.map(o => `<button class="onboarding-opt" onclick="this.classList.toggle('selected')">${o}</button>`).join('')}</div>` : ''}
        ${step.type === 'input' ? `<input type="text" id="onb-name" placeholder="Seu nome" style="text-align:center;font-size:18px;padding:14px;margin-bottom:16px" />` : ''}
        <button class="btn btn-primary btn-block" id="onb-next">${current === steps.length - 1 ? 'Começar!' : 'Continuar'}</button>
        <div class="onboarding-dots">${steps.map((_,i) => `<div class="onboarding-dot ${i===current?'active':''}"></div>`).join('')}</div>
      </div>`;

      document.getElementById('onb-next').addEventListener('click', () => {
        if (step.type === 'input') {
          const name = document.getElementById('onb-name').value.trim();
          const data = DB.get();
          data.user.name = name || (Auth.currentUser?.email?.split('@')[0] || 'Usuário');
          data.user.onboarded = true;
          DB.save(data);
          document.getElementById('header-avatar').textContent = data.user.name[0].toUpperCase();
        }
        current++;
        if (current >= steps.length) {
          overlay.classList.add('hidden');
          this.renderView();
        } else {
          renderStep();
        }
      });
    };

    renderStep();
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
