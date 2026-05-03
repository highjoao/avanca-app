/* ===== SHARED COMPONENTS ===== */
const UI = {
  modal: {
    show(html, opts = {}) {
      const o = document.getElementById('modal-overlay');
      const sheet = document.getElementById('modal-sheet');
      document.getElementById('modal-content').innerHTML = html;
      o.classList.remove('hidden');
      if (!opts.persistent) o.onclick = (e) => { if (e.target === o) this.hide(); };
      setTimeout(() => UI.Mask.initAll(), 20);
    },
    hide() {
      const o = document.getElementById('modal-overlay');
      o.classList.add('hidden');
      o.onclick = null;
    }
  },

  toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const icons = { success:'check_circle', error:'error', warning:'warning', info:'info' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="material-symbols-outlined">${icons[type]||'info'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(-10px)'; setTimeout(()=>t.remove(),300); }, 3000);
  },

  confirm(title, msg) {
    return new Promise(resolve => {
      this.modal.show(`
        <h3 class="modal-title">${title}</h3>
        <p class="fs-14 text-muted" style="line-height:1.5">${msg}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary flex-1" id="confirm-no">Cancelar</button>
          <button class="btn btn-primary flex-1" id="confirm-yes">Confirmar</button>
        </div>
      `, { persistent: true });
      document.getElementById('confirm-yes').onclick = () => { this.modal.hide(); resolve(true); };
      document.getElementById('confirm-no').onclick = () => { this.modal.hide(); resolve(false); };
    });
  },

  icon(name, cls='') { return `<span class="material-symbols-outlined ${cls}">${name}</span>`; },
  iconBox(icon, color='primary') { return `<div class="icon-box ${color}">${this.icon(icon)}</div>`; },

  progress(pct, color='blue', thick=false) {
    const p = Math.min(100, Math.max(0, pct));
    return `<div class="progress-track${thick?' thick':''}"><div class="progress-fill ${color}" style="width:${p}%"></div></div>`;
  },

  badge(text, type='info') { return `<span class="badge badge-${type}">${text}</span>`; },
  summaryCard(label, value, cls='') { return `<div class="summary-card"><div class="summary-label">${label}</div><div class="summary-value ${cls}">${value}</div></div>`; },

  listItem(icon, iconColor, title, sub, amount, amountCls, dateTxt, onclick='') {
    return `<div class="list-item" ${onclick?`onclick="${onclick}"`:''}>
      ${this.iconBox(icon, iconColor)}
      <div class="list-item-info"><div class="list-item-title">${title}</div><div class="list-item-sub">${sub}</div></div>
      <div class="list-item-value"><div class="list-item-amount ${amountCls}">${amount}</div><div class="list-item-date">${dateTxt}</div></div>
    </div>`;
  },

  emptyState(icon, title, desc) {
    return `<div class="empty-state"><div class="empty-icon">${this.icon(icon)}</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
  },

  alertItem(text, type='info', icon='info') {
    return `<div class="alert-item ${type}"><span class="material-symbols-outlined fs-18" style="margin-top:1px">${icon}</span><span class="alert-text">${text}</span></div>`;
  },

  personAvatar(name, color) {
    const initial = (name||'?')[0].toUpperCase();
    const bg = color || `hsl(${initial.charCodeAt(0)*37%360},50%,40%)`;
    return `<div class="person-avatar" style="background:${bg}">${initial}</div>`;
  },

  statusColor(s) { return {paid:'success',overdue:'danger',pending:'warning',active:'info',partial:'warning',future:'info',completed:'success'}[s]||'info'; },
  statusLabel(s) { return {paid:'Pago',overdue:'Atrasado',pending:'Pendente',active:'Ativo',partial:'Parcial',future:'Futuro',completed:'Concluído',open:'Aberta',closed:'Fechada'}[s]||s; },

  // ===== FORM FIELDS =====
  formField(label, id, type='text', opts={}) {
    const req = opts.required ? 'required' : '';
    const val = opts.value || '';
    const ph = opts.placeholder || '';
    if (type === 'select') {
      const options = (opts.options||[]).map(o => `<option value="${o.value||o}" ${(o.value||o)==val?'selected':''}>${o.label||o}</option>`).join('');
      return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><select id="${id}" ${req}>${options}</select></div>`;
    }
    if (type === 'textarea') {
      return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><textarea id="${id}" rows="3" placeholder="${ph}" ${req}>${val}</textarea></div>`;
    }
    if (type === 'currency') {
      const formatted = val ? this.Mask.formatCurrency(parseFloat(val)*100) : 'R$ 0,00';
      return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><input type="text" inputmode="numeric" id="${id}" value="${formatted}" placeholder="R$ 0,00" ${req} data-mask="currency"/></div>`;
    }
    if (type === 'date') {
      const maxDate = opts.max || '2099-12-31';
      const minDate = opts.min || '2000-01-01';
      return `<div class="form-group"><label class="form-label" for="${id}">${label}</label>
        <div class="date-input-wrap">
          <input type="date" id="${id}" value="${val}" ${req} min="${minDate}" max="${maxDate}"/>
          <span class="material-symbols-outlined date-icon" onclick="document.getElementById('${id}').showPicker&&document.getElementById('${id}').showPicker()">calendar_month</span>
        </div></div>`;
    }
    return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><input type="${type}" id="${id}" value="${val}" placeholder="${ph}" ${req} ${opts.step?`step="${opts.step}"`:''} ${opts.min?`min="${opts.min}"`:''} ${opts.max?`max="${opts.max}"`:''}/></div>`;
  },

  // ===== MASK UTILITIES =====
  Mask: {
    formatCurrency(centavos) {
      centavos = Math.round(centavos) || 0;
      const neg = centavos < 0; centavos = Math.abs(centavos);
      const reais = Math.floor(centavos/100);
      const cents = centavos % 100;
      return (neg?'- ':'') + 'R$ ' + reais.toLocaleString('pt-BR') + ',' + String(cents).padStart(2,'0');
    },
    parseCurrency(str) {
      if (!str) return 0;
      return parseInt(str.replace(/\D/g,'')||'0',10)/100;
    },
    applyCurrencyMask(input) {
      if (input._masked) return;
      input._masked = true;
      input.addEventListener('input', function() {
        let digits = this.value.replace(/\D/g,'');
        if (digits.length > 14) digits = digits.slice(0,14);
        this.value = UI.Mask.formatCurrency(parseInt(digits||'0',10));
        const len = this.value.length;
        this.setSelectionRange(len,len);
      });
      input.addEventListener('focus', function() {
        setTimeout(() => { const l=this.value.length; this.setSelectionRange(l,l); },10);
      });
      input.addEventListener('keydown', function(e) {
        if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)||e.ctrlKey||e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
    },
    initAll() {
      document.querySelectorAll('[data-mask="currency"]').forEach(i => this.applyCurrencyMask(i));
    }
  },

  getCurrencyValue(id) {
    const el = document.getElementById(id);
    return el ? this.Mask.parseCurrency(el.value) : 0;
  },

  getVal(id) { const e=document.getElementById(id); return e?e.value.trim():''; },
  getNum(id) { return parseFloat(document.getElementById(id)?.value)||0; },

  cardColors: ['#8a2be2','#ff6a00','#1a1a1a','#e74c3c','#2980b9','#16a085','#c0392b','#2c3e50','#f39c12','#8e44ad'],

  destroyCharts() { Object.values(Chart.instances||{}).forEach(c=>c.destroy()); },
  chartDefaults() {
    Chart.defaults.color='#a0aab8'; Chart.defaults.font.family='Inter'; Chart.defaults.font.size=11;
    Chart.defaults.plugins.legend.display=false;
  }
};
UI.chartDefaults();
