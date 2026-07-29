// ─── Window registry ───
const WIN_META = {
  terminal: { label: '🖥️ Terminal' },
  about:    { label: '👤 About Me' },
  projects: { label: '💼 Projects' },
  contact:  { label: '📧 Contact'  },
};

let zTop = 100;
let drag = null;
const savedBounds = {};
const tbBtns = {};

function gw(id) { return document.getElementById('win-' + id); }

// ─── Open / Close / Min / Max ───
function openWin(id) {
  const el = gw(id);
  el.classList.remove('hidden', 'minimized');
  bringFront(id);
  addTbBtn(id);
  if (id === 'terminal' && !termStarted) bootTerminal();
}

function closeWin(id) {
  gw(id).classList.add('hidden');
  removeTbBtn(id);
}

function minWin(id) {
  gw(id).classList.add('minimized');
  if (tbBtns[id]) tbBtns[id].classList.remove('pressed');
}

function maxWin(id) {
  const el = gw(id);
  if (savedBounds[id]) {
    const b = savedBounds[id];
    el.style.left = b.left; el.style.top  = b.top;
    el.style.width = b.width; el.style.height = b.height;
    delete savedBounds[id];
  } else {
    savedBounds[id] = {
      left: el.style.left, top: el.style.top,
      width: el.style.width, height: el.style.height,
    };
    el.style.left = '0'; el.style.top = '18px';
    el.style.width = '100vw'; el.style.height = 'calc(100vh - 48px)';
  }
}

function bringFront(id) {
  const el = gw(id);
  el.style.zIndex = ++zTop;
  document.querySelectorAll('.win').forEach(w => w.classList.remove('active'));
  Object.values(tbBtns).forEach(btn => btn.classList.remove('pressed'));
  el.classList.add('active');
  if (tbBtns[id]) tbBtns[id].classList.add('pressed');
}

// ─── Taskbar buttons ───
function addTbBtn(id) {
  if (tbBtns[id]) return;
  const btn = document.createElement('button');
  btn.className = 'tbwin-btn';
  btn.textContent = WIN_META[id].label;
  btn.onclick = () => {
    const el = gw(id);
    if (el.classList.contains('minimized') || el.classList.contains('hidden')) {
      el.classList.remove('minimized', 'hidden');
      bringFront(id);
    } else if (el.classList.contains('active')) {
      minWin(id);
    } else {
      bringFront(id);
    }
  };
  document.getElementById('tb-wins').appendChild(btn);
  tbBtns[id] = btn;
}

function removeTbBtn(id) {
  if (tbBtns[id]) { tbBtns[id].remove(); delete tbBtns[id]; }
}

// ─── Drag ───
function dragStart(e, id) {
  if (e.target.closest('.wb')) return;
  bringFront(id);
  const el = gw(id);
  const r = el.getBoundingClientRect();
  drag = { el, ox: e.clientX - r.left, oy: e.clientY - r.top };
  e.preventDefault();
}

document.addEventListener('mousemove', e => {
  if (!drag) return;
  drag.el.style.left = (e.clientX - drag.ox) + 'px';
  drag.el.style.top  = (e.clientY - drag.oy) + 'px';
});

document.addEventListener('mouseup', () => { drag = null; });

// Click any window to bring it to front
document.addEventListener('mousedown', e => {
  const win = e.target.closest('.win');
  if (win) {
    const id = win.id.replace('win-', '');
    if (WIN_META[id]) bringFront(id);
  }
  if (!e.target.closest('.smenu') && !e.target.closest('.start-btn')) {
    closeStart();
  }
});

// ─── Clock ───
function tick() {
  document.getElementById('tb-clock').textContent =
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
tick();
setInterval(tick, 1000);

// ─── Start Menu ───
function toggleStart() {
  document.getElementById('smenu').classList.toggle('hidden');
}
function closeStart() {
  document.getElementById('smenu').classList.add('hidden');
}

// ─── Terminal ───
let termStarted = false;

const BOOT_LINES = [
  'Microsoft(R) Windows 98',
  '(C)Copyright Microsoft Corp 1981-1998.',
  '',
  'C:\\> welcome.exe',
  '',
  'Welcome to my portfolio.',
  "Type 'help' for a list of commands.",
  '',
];

const CMDS = {
  help: () => [
    'Available commands:',
    '  help      — show this list',
    '  about     — open About window',
    '  projects  — open Projects window',
    '  contact   — open Contact window',
    '  whoami    — identify current user',
    '  ls        — list projects directory',
    '  date      — print current date/time',
    '  clear     — clear terminal',
    '  shutdown  — shut down the computer',
  ],
  about:    () => { openWin('about');    return ['Opening About Me...']; },
  projects: () => { openWin('projects'); return ['Opening Projects...']; },
  contact:  () => { openWin('contact');  return ['Opening Contact...'];  },
  whoami:   () => ['Hayes McNeill'],
  ls: () => [
    'Directory of C:\\projects',
    '',
    '  golf-bet-app\\',
    '  bond-app\\',
    '  our-website\\',
    '',
    '3 dir(s) found.',
  ],
  date: () => [new Date().toString()],
  clear: () => { document.getElementById('term-out').innerHTML = ''; return null; },
  shutdown: () => { shutdown(); return null; },
};

function bootTerminal() {
  termStarted = true;
  let i = 0;
  const interval = setInterval(() => {
    if (i >= BOOT_LINES.length) { clearInterval(interval); focusTerm(); return; }
    addLine(BOOT_LINES[i++]);
  }, 70);
}

function addLine(text) {
  const out = document.getElementById('term-out');
  const div = document.createElement('div');
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function focusTerm() {
  document.getElementById('term-in').focus();
}

document.getElementById('term-in').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const inp = document.getElementById('term-in');
  const raw = inp.value.trim();
  inp.value = '';

  addLine('C:\\> ' + raw);
  if (!raw) return;

  const cmd = raw.toLowerCase();
  if (CMDS[cmd]) {
    const out = CMDS[cmd]();
    if (out) out.forEach(l => addLine(l));
  } else {
    addLine(`'${raw}' is not recognized as an internal or external command.`);
    addLine("Type 'help' for a list of commands.");
  }
  addLine('');
});

// Click terminal area to focus input
document.getElementById('term-body').addEventListener('click', focusTerm);

// ─── Shutdown ───
function shutdown() {
  document.body.style.background = '#000';
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100vh;color:#fff;font-family:monospace;text-align:center;gap:24px;">
      <p style="font-size:18px;">It is now safe to turn off your computer.</p>
      <button onclick="location.reload()"
        style="padding:8px 22px;background:#c0c0c0;color:#000;cursor:pointer;font-size:13px;
               border-top:2px solid #fff;border-left:2px solid #fff;
               border-right:2px solid #404040;border-bottom:2px solid #404040;">
        Restart
      </button>
    </div>`;
}

// ─── Boot: open terminal on load ───
openWin('terminal');
