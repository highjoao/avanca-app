/* ===== AUTH MODULE ===== */
const Auth = {
  currentUser: null,

  // Check if user is logged in
  async getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    this.currentUser = session?.user || null;
    return session;
  },

  // Listen for auth changes (email confirmation redirect, etc.)
  onAuthChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      if (event === 'SIGNED_IN') callback(session);
      if (event === 'SIGNED_OUT') callback(null);
    });
  },

  // Sign up with email + password
  async signUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  // Sign in with email + password
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
  },

  // ===== AUTH UI =====
  showLogin() {
    const container = document.getElementById('auth-container');
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <div class="header-avatar" style="width:56px;height:56px;font-size:24px;margin:0 auto">A</div>
          </div>
          <h1 class="auth-title">Avança</h1>
          <p class="auth-subtitle">Controle seu dinheiro. Organize sua rotina.</p>
        </div>

        <div id="auth-message" class="auth-message hidden"></div>

        <div class="auth-form">
          <div class="form-group">
            <label class="form-label" for="auth-email">E-mail</label>
            <input type="email" id="auth-email" placeholder="seu@email.com" autocomplete="email"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="auth-password">Senha</label>
            <input type="password" id="auth-password" placeholder="Sua senha" autocomplete="current-password"/>
          </div>
          <button class="btn btn-primary btn-block auth-btn" id="auth-submit" onclick="Auth.handleLogin()">
            Entrar
          </button>
        </div>

        <div class="auth-footer">
          <span class="text-muted fs-14">Não tem conta?</span>
          <button class="auth-link" onclick="Auth.showCodeGate()">Criar conta</button>
        </div>
      </div>
      <div style="position: fixed; bottom: 8px; right: 8px; font-size: 9px; color: var(--text-3); opacity: 0.5; z-index: 1000;">v.2.1.1</div>
    `;
    // Submit on Enter
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') Auth.handleLogin(); });
    });
  },

  // ===== CODE GATE (access code required before signup) =====
  _accessCode: 'pastor11',

  showCodeGate() {
    const container = document.getElementById('auth-container');
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="auth-card" style="text-align:center">
        <img src="img/images.jpg" alt="Avança" class="gate-logo" />

        <div id="auth-message" class="auth-message hidden"></div>

        <p class="gate-label">Coloque o código de liberação</p>
        <div class="form-group">
          <input type="text" id="gate-code" placeholder="Void" autocomplete="off" style="text-align:center;font-size:12px;letter-spacing:0px"/>
        </div>

        <button class="btn btn-primary btn-block auth-btn" id="auth-submit" onclick="Auth.validateGateCode()">
          Liberar acesso
        </button>

        <div class="auth-footer" style="margin-top:24px">
          <button class="auth-link" onclick="Auth.showLogin()">← Voltar para login</button>
        </div>
      </div>
    `;
    document.getElementById('gate-code').addEventListener('keydown', e => {
      if (e.key === 'Enter') Auth.validateGateCode();
    });
    document.getElementById('gate-code').focus();
  },

  _gateAttempts: 0,
  _gateMsgs: [
    'kkkkkk tá de brincadeira né?',
    'de novo?',
    'Tenta pedir pro pastor te ajudar 👀',
    'Esse código aí não existe amigão 😂',
    'Desiste não, mas tá longe viu...',
    'Última dica: pede a benção primeiro 🙏'
  ],

  validateGateCode() {
    const code = document.getElementById('gate-code')?.value?.trim().toLowerCase();
    if (!code) { this.showMessage('Informe o código de liberação.'); return; }
    if (code !== this._accessCode) {
      const msg = this._gateMsgs[this._gateAttempts % this._gateMsgs.length];
      this._gateAttempts++;
      this.showMessage(msg);
      document.getElementById('gate-code').value = '';
      return;
    }
    this._gateAttempts = 0;
    this.showSignup();
  },

  showSignup() {
    const container = document.getElementById('auth-container');
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <div class="header-avatar" style="width:56px;height:56px;font-size:24px;margin:0 auto">A</div>
          </div>
          <h1 class="auth-title">Criar conta</h1>
          <p class="auth-subtitle">Comece a organizar sua vida financeira</p>
        </div>

        <div id="auth-message" class="auth-message hidden"></div>

        <div class="auth-form">
          <div class="form-group">
            <label class="form-label" for="auth-email">E-mail</label>
            <input type="email" id="auth-email" placeholder="seu@email.com" autocomplete="email"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="auth-password">Senha</label>
            <input type="password" id="auth-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="auth-password2">Confirmar senha</label>
            <input type="password" id="auth-password2" placeholder="Repita a senha" autocomplete="new-password"/>
          </div>
          <button class="btn btn-primary btn-block auth-btn" id="auth-submit" onclick="Auth.handleSignup()">
            Criar conta
          </button>
        </div>

        <div class="auth-footer">
          <span class="text-muted fs-14">Já tem conta?</span>
          <button class="auth-link" onclick="Auth.showLogin()">Entrar</button>
        </div>
      </div>
    `;
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') Auth.handleSignup(); });
    });
  },

  showConfirmation(email) {
    const container = document.getElementById('auth-container');
    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div style="font-size:48px;margin-bottom:12px">📧</div>
          <h1 class="auth-title">Verifique seu e-mail</h1>
          <p class="auth-subtitle">Enviamos um link de confirmação para:</p>
          <p class="fs-16 fw-600 text-secondary mt-8">${email}</p>
        </div>

        <div class="auth-confirm-info">
          <div class="flex items-center gap-10 mb-8">
            <span class="material-symbols-outlined text-primary">check_circle</span>
            <span class="fs-14">Abra seu e-mail</span>
          </div>
          <div class="flex items-center gap-10 mb-8">
            <span class="material-symbols-outlined text-primary">check_circle</span>
            <span class="fs-14">Clique no link de confirmação</span>
          </div>
          <div class="flex items-center gap-10">
            <span class="material-symbols-outlined text-primary">check_circle</span>
            <span class="fs-14">Volte aqui e faça login</span>
          </div>
        </div>

        <button class="btn btn-secondary btn-block mt-16" onclick="Auth.showLogin()">
          Voltar para login
        </button>

        <div class="auth-footer">
          <span class="text-muted fs-13">Não recebeu? Verifique a pasta de spam.</span>
        </div>
      </div>
    `;
  },

  showMessage(text, type = 'error') {
    const el = document.getElementById('auth-message');
    if (!el) return;
    el.className = `auth-message auth-message-${type}`;
    el.textContent = text;
    el.classList.remove('hidden');
    if (type === 'success') setTimeout(() => el.classList.add('hidden'), 5000);
  },

  setLoading(loading) {
    const btn = document.getElementById('auth-submit');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="auth-spinner"></span> Aguarde...';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Entrar';
    }
  },

  async handleLogin() {
    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;

    if (!email) { this.showMessage('Informe seu e-mail.'); return; }
    if (!password) { this.showMessage('Informe sua senha.'); return; }
    if (!email.includes('@')) { this.showMessage('E-mail inválido.'); return; }

    this.setLoading(true);
    try {
      await this.signIn(email, password);
      document.getElementById('auth-container').classList.add('hidden');
      await App.onAuthSuccess();
    } catch (err) {
      const msg = err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : err.message === 'Email not confirmed'
          ? 'Confirme seu e-mail antes de entrar.'
          : err.message || 'Erro ao fazer login.';
      this.showMessage(msg);
      this.setLoading(false);
    }
  },

  async handleSignup() {
    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;
    const password2 = document.getElementById('auth-password2')?.value;

    if (!email) { this.showMessage('Informe seu e-mail.'); return; }
    if (!email.includes('@')) { this.showMessage('E-mail inválido.'); return; }
    if (!password) { this.showMessage('Informe sua senha.'); return; }
    if (password.length < 6) { this.showMessage('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (password !== password2) { this.showMessage('As senhas não coincidem.'); return; }

    this.setLoading(true);
    try {
      await this.signUp(email, password);
      this.showConfirmation(email);
    } catch (err) {
      const msg = err.message === 'User already registered'
        ? 'Este e-mail já está cadastrado.'
        : err.message || 'Erro ao criar conta.';
      this.showMessage(msg);
      this.setLoading(false);
    }
  },

  hide() {
    document.getElementById('auth-container').classList.add('hidden');
  }
};
