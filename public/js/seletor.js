// Seletor no estilo do site. A lista nativa do <select> ignora o tema (fica branca no modo escuro),
// então cada select.form-select ganha um botão + lista próprios. O <select> original continua no
// formulário, escondido: guarda o valor, participa da validação e dispara 'change' normalmente.

let aberto = null;
let seq = 0;

export function iniciarSeletores() {
  const varrer = (raiz) => raiz.querySelectorAll('select.form-select:not([multiple]):not([data-nativo])').forEach(melhorar);
  varrer(document);
  new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('select.form-select:not([multiple]):not([data-nativo])')) melhorar(n);
        else varrer(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('pointerdown', (ev) => {
    if (aberto && !aberto.contem(ev.target)) aberto.fechar();
  });
  // Rolar a página (fora da lista) ou redimensionar fecha a lista: ela fica posicionada na tela.
  window.addEventListener('scroll', (ev) => {
    if (aberto && !aberto.contem(ev.target)) aberto.fechar();
  }, true);
  window.addEventListener('resize', () => aberto && aberto.fechar());
  // Volta para a lista ao trocar de tela.
  window.addEventListener('hashchange', () => aberto && aberto.fechar());
}

function melhorar(sel) {
  if (sel.dataset.seletor) return;
  sel.dataset.seletor = '1';
  const id = `sel${++seq}`;

  const caixa = document.createElement('div');
  caixa.className = 'seletor';
  if (sel.classList.contains('form-select-sm')) caixa.classList.add('seletor-sm');
  sel.before(caixa);
  caixa.append(sel);
  sel.classList.add('seletor-nativo');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'seletor-botao';
  botao.setAttribute('role', 'combobox');
  botao.setAttribute('aria-haspopup', 'listbox');
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', `${id}l`);
  botao.innerHTML = '<span class="seletor-texto"></span><i class="bi bi-chevron-down seletor-seta" aria-hidden="true"></i>';
  caixa.append(botao);

  const lista = document.createElement('ul');
  lista.className = 'seletor-lista';
  lista.id = `${id}l`;
  lista.setAttribute('role', 'listbox');
  lista.tabIndex = -1;

  // O rótulo passa a apontar para o botão.
  const rotulo = sel.id ? document.querySelector(`label[for="${CSS.escape(sel.id)}"]`) : null;
  if (rotulo) {
    if (!rotulo.id) rotulo.id = `${id}r`;
    botao.setAttribute('aria-labelledby', rotulo.id);
    lista.setAttribute('aria-labelledby', rotulo.id);
    rotulo.addEventListener('click', (ev) => { ev.preventDefault(); botao.focus(); });
  } else if (sel.getAttribute('aria-label')) {
    botao.setAttribute('aria-label', sel.getAttribute('aria-label'));
  }
  if (sel.required) botao.setAttribute('aria-required', 'true');

  let ativo = -1;
  const opcoes = () => [...sel.options];

  function atualizar() {
    const o = sel.options[sel.selectedIndex];
    botao.querySelector('.seletor-texto').textContent = o ? o.textContent : '';
    botao.classList.toggle('vazio', !o || o.value === '');
    botao.disabled = sel.disabled;
    caixa.classList.toggle('desabilitado', sel.disabled);
  }

  function desenhar() {
    lista.replaceChildren(...opcoes().map((o, i) => {
      const li = document.createElement('li');
      li.id = `${id}o${i}`;
      li.className = 'seletor-opcao';
      li.setAttribute('role', 'option');
      li.dataset.i = i;
      li.setAttribute('aria-selected', String(i === sel.selectedIndex));
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      if (o.value === '') li.classList.add('neutra');
      const texto = document.createElement('span');
      texto.textContent = o.textContent;
      li.append(texto);
      li.insertAdjacentHTML('beforeend', '<i class="bi bi-check2" aria-hidden="true"></i>');
      return li;
    }));
  }

  function marcar(i) {
    const itens = lista.children;
    if (!itens.length) return;
    ativo = Math.max(0, Math.min(i, itens.length - 1));
    [...itens].forEach((li, j) => li.classList.toggle('ativa', j === ativo));
    botao.setAttribute('aria-activedescendant', itens[ativo].id);
    itens[ativo].scrollIntoView({ block: 'nearest' });
  }

  function posicionar() {
    const r = botao.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    const altura = Math.min(lista.scrollHeight, 300);
    const paraCima = abaixo < Math.min(altura, 200) && acima > abaixo;
    lista.style.left = `${r.left}px`;
    lista.style.width = `${Math.max(r.width, 180)}px`;
    lista.style.maxHeight = `${Math.max(140, Math.min(300, paraCima ? acima : abaixo))}px`;
    lista.style.top = paraCima ? '' : `${r.bottom + 6}px`;
    lista.style.bottom = paraCima ? `${window.innerHeight - r.top + 6}px` : '';
    lista.classList.toggle('para-cima', paraCima);
  }

  const controle = {
    contem: (alvo) => caixa.contains(alvo) || lista.contains(alvo),
    fechar() {
      if (aberto !== controle) return;
      aberto = null;
      lista.classList.remove('aberta');
      botao.setAttribute('aria-expanded', 'false');
      botao.removeAttribute('aria-activedescendant');
      caixa.classList.remove('aberto');
      setTimeout(() => { if (aberto !== controle) lista.remove(); }, 160);
    },
  };

  function abrir() {
    if (sel.disabled) return;
    if (aberto && aberto !== controle) aberto.fechar();
    desenhar();
    // Dentro de um modal a lista fica no próprio modal, para não brigar com o foco preso do Bootstrap.
    (botao.closest('.modal') || document.body).append(lista);
    aberto = controle;
    posicionar();
    caixa.classList.add('aberto');
    botao.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => lista.classList.add('aberta'));
    marcar(Math.max(0, sel.selectedIndex));
  }

  function escolher(i) {
    const o = sel.options[i];
    if (!o || o.disabled) return;
    const mudou = sel.selectedIndex !== i;
    sel.selectedIndex = i;
    atualizar();
    controle.fechar();
    botao.focus();
    if (mudou) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  botao.addEventListener('click', () => (aberto === controle ? controle.fechar() : abrir()));
  lista.addEventListener('pointerdown', (ev) => ev.preventDefault()); // mantém o foco no botão
  lista.addEventListener('click', (ev) => {
    const li = ev.target.closest('.seletor-opcao');
    if (li) escolher(Number(li.dataset.i));
  });
  lista.addEventListener('pointermove', (ev) => {
    const li = ev.target.closest('.seletor-opcao');
    if (li && Number(li.dataset.i) !== ativo) marcar(Number(li.dataset.i));
  });

  let busca = '';
  let buscaTempo;
  botao.addEventListener('keydown', (ev) => {
    const estaAberto = aberto === controle;
    const n = sel.options.length;
    switch (ev.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        ev.preventDefault();
        if (!estaAberto) { abrir(); return; }
        marcar(ativo + (ev.key === 'ArrowDown' ? 1 : -1));
        return;
      }
      case 'Home': case 'End':
        if (estaAberto) { ev.preventDefault(); marcar(ev.key === 'Home' ? 0 : n - 1); }
        return;
      case 'Enter': case ' ':
        ev.preventDefault();
        if (estaAberto) escolher(ativo); else abrir();
        return;
      case 'Escape':
        if (estaAberto) { ev.preventDefault(); ev.stopPropagation(); controle.fechar(); }
        return;
      case 'Tab':
        if (estaAberto) controle.fechar();
        return;
      default:
        if (ev.key.length !== 1 || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        busca += ev.key.toLocaleLowerCase('pt-BR');
        clearTimeout(buscaTempo);
        buscaTempo = setTimeout(() => { busca = ''; }, 700);
        {
          const sem = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
          const i = opcoes().findIndex((o) => sem(o.textContent).startsWith(sem(busca)));
          if (i < 0) return;
          if (estaAberto) marcar(i); else escolher(i);
        }
    }
  });

  // Mudanças feitas por código: troca de opções, de valor, reset do formulário, desabilitar.
  sel.addEventListener('change', atualizar);
  new MutationObserver(atualizar).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  if (sel.form) sel.form.addEventListener('reset', () => setTimeout(atualizar));
  sel.addEventListener('focus', () => botao.focus());
  atualizar();
}
