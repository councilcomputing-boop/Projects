// ── State ──────────────────────────────────────────────────────────────────
let lists  = [];
let todos  = [];
let activeList   = 'all';
let activeFilter = 'all';
let searchQuery  = '';
let newPriority  = '';
let dragSrcId    = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const listsRow   = document.getElementById('lists-row');
const addListBtn = document.getElementById('add-list-btn');
const searchEl   = document.getElementById('search');
const newTodoEl  = document.getElementById('new-todo');
const addBtn     = document.getElementById('add-btn');
const dueEl      = document.getElementById('due-input');
const todoListEl = document.getElementById('todo-list');
const taskCount  = document.getElementById('task-count');
const clearDone  = document.getElementById('clear-done');

// ── Persistence ────────────────────────────────────────────────────────────
function load() {
  try {
    lists  = JSON.parse(localStorage.getItem('td_lists')) ?? [
      { id: 1, name: 'Personal' },
      { id: 2, name: 'Work' },
    ];
    todos  = JSON.parse(localStorage.getItem('td_todos')) ?? [];
    activeList   = localStorage.getItem('td_list')   ?? 'all';
    activeFilter = localStorage.getItem('td_filter') ?? 'all';
  } catch {
    lists = [{ id: 1, name: 'Personal' }, { id: 2, name: 'Work' }];
    todos = [];
  }
}

function save() {
  localStorage.setItem('td_lists',  JSON.stringify(lists));
  localStorage.setItem('td_todos',  JSON.stringify(todos));
  localStorage.setItem('td_list',   String(activeList));
  localStorage.setItem('td_filter', activeFilter);
}

// ── Todos ──────────────────────────────────────────────────────────────────
function addTodo() {
  const text = newTodoEl.value.trim();
  if (!text) return;
  const listId = (activeList === 'all') ? (lists[0]?.id ?? 1) : Number(activeList);
  todos.push({ id: Date.now(), listId, text, done: false,
               priority: newPriority || null, dueDate: dueEl.value || null });
  newTodoEl.value = '';
  dueEl.value = '';
  setPriority('');
  save(); render();
}

function toggleTodo(id, x, y) {
  const t = todos.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) confetti(x, y);
  save(); render();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  save(); render();
}

function editTodo(id, text) {
  const t = todos.find(t => t.id === id);
  if (t && text.trim()) { t.text = text.trim(); save(); render(); }
}

function clearDoneTodos() {
  todos = todos.filter(t => !t.done);
  save(); render();
}

// ── Lists ──────────────────────────────────────────────────────────────────
function addList(name) {
  if (!name.trim()) return;
  const id = Date.now();
  lists.push({ id, name: name.trim() });
  save(); renderLists(); setActiveList(id);
}

function deleteList(id) {
  lists = lists.filter(l => l.id !== id);
  todos = todos.filter(t => t.listId !== id);
  if (Number(activeList) === id) activeList = 'all';
  save(); render();
}

function setActiveList(id) {
  activeList = id;
  save(); render();
}

// ── Priority ───────────────────────────────────────────────────────────────
function setPriority(p) {
  newPriority = p;
  document.querySelectorAll('.prio-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.prio === p));
}

// ── Filter ─────────────────────────────────────────────────────────────────
function setFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === f));
  save(); renderTodos();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0) return { label: 'Overdue', cls: 'overdue' };
  if (diff === 0) return { label: 'Today', cls: 'today' };
  if (diff === 1) return { label: 'Tomorrow', cls: '' };
  return { label: due.toLocaleDateString('en-US', { month:'short', day:'numeric' }), cls: '' };
}

// ── Render: lists ──────────────────────────────────────────────────────────
function renderLists() {
  listsRow.querySelectorAll('.list-chip').forEach(el => el.remove());

  const makeChip = (id, name, deletable) => {
    const btn = document.createElement('button');
    btn.className = 'list-chip' + (String(activeList) === String(id) ? ' active' : '');
    btn.dataset.id = id;
    btn.innerHTML = esc(name) + (deletable
      ? ` <button class="list-chip-del" title="Delete list">✕</button>` : '');
    btn.addEventListener('click', e => {
      if (!e.target.classList.contains('list-chip-del')) setActiveList(id);
    });
    if (deletable) {
      btn.querySelector('.list-chip-del').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Delete list "${name}"?\nAll tasks in it will be removed.`)) deleteList(id);
      });
    }
    listsRow.insertBefore(btn, addListBtn);
  };

  makeChip('all', 'All', false);
  lists.forEach(l => makeChip(l.id, l.name, true));
}

// ── Render: todos ──────────────────────────────────────────────────────────
function renderTodos() {
  const q = searchQuery.toLowerCase();
  const visible = todos.filter(t => {
    if (activeList !== 'all' && t.listId !== Number(activeList)) return false;
    if (activeFilter === 'active' && t.done) return false;
    if (activeFilter === 'done'   && !t.done) return false;
    if (q && !t.text.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!visible.length) {
    todoListEl.innerHTML = `
      <li class="empty-state">
        <div class="empty-icon">✓</div>
        <p>${q ? 'No matching tasks' : activeFilter === 'done' ? 'Nothing done yet' : 'Nothing here — add a task!'}</p>
      </li>`;
    return;
  }

  todoListEl.innerHTML = '';

  for (const todo of visible) {
    const li = document.createElement('li');
    li.className = [
      'todo-item',
      todo.done ? 'done' : '',
      todo.priority ? `prio-${todo.priority}` : '',
    ].filter(Boolean).join(' ');
    li.dataset.id = todo.id;
    li.draggable = true;

    const due      = formatDue(todo.dueDate);
    const listName = activeList === 'all' ? lists.find(l => l.id === todo.listId)?.name : null;

    const chips = [
      due ? `<span class="chip ${due.cls}">📅 ${due.label}</span>` : '',
      todo.priority ? `<span class="chip prio-${todo.priority}">${{high:'↑↑ High',medium:'↑ Medium',low:'↓ Low'}[todo.priority]}</span>` : '',
      listName ? `<span class="chip list">${esc(listName)}</span>` : '',
    ].filter(Boolean).join('');

    li.innerHTML = `
      <input type="checkbox" class="todo-check" ${todo.done ? 'checked' : ''}>
      <div class="todo-body">
        <span class="todo-text">${esc(todo.text)}</span>
        ${chips ? `<div class="todo-meta">${chips}</div>` : ''}
      </div>
      <button class="todo-delete" title="Delete">✕</button>`;

    // Checkbox toggle + confetti
    li.querySelector('.todo-check').addEventListener('change', e => {
      const r = e.target.getBoundingClientRect();
      toggleTodo(todo.id, r.left + r.width / 2, r.top + r.height / 2);
    });

    // Delete
    li.querySelector('.todo-delete').addEventListener('click', () => deleteTodo(todo.id));

    // Double-click to edit
    li.querySelector('.todo-text').addEventListener('dblclick', () => {
      const span = li.querySelector('.todo-text');
      const inp  = document.createElement('input');
      inp.className = 'todo-edit-input';
      inp.value = todo.text;
      span.replaceWith(inp);
      inp.focus(); inp.select();
      inp.addEventListener('blur', () => editTodo(todo.id, inp.value));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') render();
      });
    });

    // Drag & drop reorder
    li.addEventListener('dragstart', e => {
      dragSrcId = todo.id;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      todoListEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      todoListEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrcId !== todo.id) li.classList.add('drag-over');
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      if (dragSrcId === todo.id) return;
      const from = todos.findIndex(t => t.id === dragSrcId);
      const to   = todos.findIndex(t => t.id === todo.id);
      if (from !== -1 && to !== -1) {
        const [item] = todos.splice(from, 1);
        todos.splice(to, 0, item);
        save(); render();
      }
    });

    todoListEl.appendChild(li);
  }
}

// ── Update title + count ───────────────────────────────────────────────────
function updateMeta() {
  const n = todos.filter(t => !t.done).length;
  document.title = n > 0 ? `(${n}) Todo` : 'Todo';
  taskCount.textContent = `${n} task${n !== 1 ? 's' : ''} left`;
}

// ── Full render ────────────────────────────────────────────────────────────
function render() { renderLists(); renderTodos(); updateMeta(); }

// ── Confetti ───────────────────────────────────────────────────────────────
function confetti(x, y) {
  const colors = ['#a78bfa','#c4b5fd','#34d399','#f9a8d4','#fcd34d','#60a5fa','#fb923c'];
  for (let i = 0; i < 28; i++) {
    const p   = document.createElement('div');
    const sz  = 4 + Math.random() * 7;
    const dx  = (Math.random() - .5) * 260;
    const dy  = -70 - Math.random() * 170;
    const dr  = `${(Math.random() - .5) * 720}deg`;
    const rad = Math.random() > .4 ? '50%' : '2px';
    p.className = 'cp';
    p.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;
      background:${colors[i % colors.length]};border-radius:${rad};
      --dx:${dx}px;--dy:${dy}px;--dr:${dr};`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

// ── Event wiring ───────────────────────────────────────────────────────────
addBtn.addEventListener('click', addTodo);
newTodoEl.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
clearDone.addEventListener('click', clearDoneTodos);
searchEl.addEventListener('input', () => { searchQuery = searchEl.value; renderTodos(); });

document.querySelectorAll('.filter').forEach(b =>
  b.addEventListener('click', () => setFilter(b.dataset.filter)));

document.querySelectorAll('.prio-btn').forEach(b =>
  b.addEventListener('click', () => setPriority(b.dataset.prio)));

addListBtn.addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.className = 'list-name-input';
  inp.placeholder = 'List name';
  inp.maxLength = 24;
  listsRow.insertBefore(inp, addListBtn);
  inp.focus();
  inp.addEventListener('blur',    () => { addList(inp.value); inp.remove(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') inp.remove();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
load();
render();
