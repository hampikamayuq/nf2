// Simula o dropdown estilizado/filtrável do portal (padrão select2-like):
// clicar no controle abre, digitar filtra, clicar na opção seleciona.
// É o comportamento mínimo de que `selecionarDropdownFiltravel` precisa —
// quando o HTML real dos passos for capturado (higienizado), estas fixtures
// são substituídas e o widget morre junto.
document.querySelectorAll('.dropdown-filtravel').forEach((container) => {
  const opcoes = (container.dataset.opcoes || '').split('|').filter(Boolean);

  const selecionado = document.createElement('span');
  selecionado.className = 'selecionado';
  selecionado.textContent = 'Selecione...';

  const filtro = document.createElement('input');
  filtro.className = 'filtro';
  filtro.hidden = true;

  const lista = document.createElement('ul');
  lista.hidden = true;

  opcoes.forEach((texto) => {
    const li = document.createElement('li');
    li.textContent = texto;
    li.addEventListener('click', (ev) => {
      ev.stopPropagation();
      container.dataset.valor = texto;
      selecionado.textContent = texto;
      filtro.hidden = true;
      lista.hidden = true;
    });
    lista.appendChild(li);
  });

  filtro.addEventListener('input', () => {
    const termo = filtro.value.toLowerCase();
    lista.querySelectorAll('li').forEach((li) => {
      li.style.display = li.textContent.toLowerCase().includes(termo) ? '' : 'none';
    });
  });

  container.append(selecionado, filtro, lista);
  container.addEventListener('click', () => {
    filtro.hidden = false;
    lista.hidden = false;
    filtro.value = '';
    lista.querySelectorAll('li').forEach((li) => {
      li.style.display = '';
    });
    filtro.focus();
  });
});
