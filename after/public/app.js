// app.js — all of it. Every rule about what a todo is lives here, in the browser.

var ROWS = [];            // raw storage rows, straight from db.json
var REV = 0;
var TICK = null;

// The one place priority levels are defined. The composer dropdown, the badge
// colors, and the stale-bump ceiling are all derived from this array.
var PRIORITIES = [
  { num: 1, label: 'Low',    color: 'var(--faint)', border: 'var(--line)', bg: '' },
  { num: 2, label: 'Normal', color: 'var(--muted)', border: 'var(--line)', bg: '', preselect: true },
  { num: 3, label: 'High',   color: 'var(--warn)',  border: '#453a1f',     bg: '' },
  { num: 4, label: 'Urgent', color: '#fff',         border: 'var(--bad)',  bg: 'var(--bad)' }
];

function priority(num) {
  for (var i = 0; i < PRIORITIES.length; i++) {
    if (PRIORITIES[i].num === num) return PRIORITIES[i];
  }
  return null;   // out-of-range value from the schema-free server
}

function maxPriority() {
  var m = 0;
  for (var i = 0; i < PRIORITIES.length; i++) if (PRIORITIES[i].num > m) m = PRIORITIES[i].num;
  return m;
}

var DAY = 86400000;

// The one place lists are defined. The sidebar buttons, their counts, the
// composer dropdown, the page heading, and the urgency damping are all derived
// from this array.
// `pseudo` marks the catch-all view: it matches every row and is not a list
// you can file a todo into. `damp` divides the urgency score, so a list can be
// de-prioritised without a name check in urgency().
var LISTS = [
  { name: 'All',      pseudo: true, heading: 'Today' },
  { name: 'Inbox',    preselect: true },
  { name: 'Work' },
  { name: 'Personal' },
  { name: 'Someday',  damp: 3 },
  { name: 'Errands' }
];

function listDef(name) {
  for (var i = 0; i < LISTS.length; i++) {
    if (LISTS[i].name === name) return LISTS[i];
  }
  return null;   // list_name the server accepted that no longer exists here
}

// ---------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------

function loadFromServer() {
  var sort = document.getElementById('sort').value;
  fetch('/api/todos?order_by=' + sort)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      ROWS = data.rows;
      REV = data._rev;
      document.getElementById('rev').textContent = data._rev;
      document.getElementById('offset').textContent = data._file_offset;
      // Cached forever. Nothing ever checks _rev against this.
      localStorage.setItem('todos_cache_v1', JSON.stringify(data.rows));
      render();
    });
}

function save() {
  // Whole table, every time.
  fetch('/api/todos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: ROWS })
  }).then(function (r) { return r.json(); }).then(function (d) {
    REV = d._rev;
    document.getElementById('rev').textContent = d._rev;
  });
  render();
}

// ---------------------------------------------------------------------------
// business rules (in the frontend, as requested)
// ---------------------------------------------------------------------------

function daysUntil(due) {
  if (!due) return 9999;
  // Both sides sliced to YYYY-MM-DD and re-parsed. Timezones are somebody
  // else's problem.
  var a = new Date(due.slice(0, 10) + 'T00:00:00');
  var b = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((a - b) / DAY);
}

function isOverdue(t) {
  return t.is_done !== 1 && t.due_date && daysUntil(t.due_date) < 0;
}

// The urgency score. This is the app's one real algorithm and it lives
// three layers away from the data.
function urgency(t) {
  if (t.is_done === 1) return 0;
  var s = t.priority_num * 10;
  var d = daysUntil(t.due_date);
  if (d < 0) s += 40 + Math.min(-d, 14) * 2;   // overdue, capped at two weeks
  else if (d === 0) s += 30;
  else if (d <= 2) s += 18;
  else if (d <= 7) s += 8;
  var l = listDef(t.list_name);
  if (l && l.damp) s = Math.floor(s / l.damp);
  var age = Math.floor((Date.now() - t.created_at) / DAY);
  if (age > 14) s += 5;                         // stale nag
  return s;
}

function validate(title, due) {
  if (!title || title.trim().length < 2) return 'Title needs at least 2 characters.';
  if (title.length > 120) return 'Title is too long.';
  if (due && daysUntil(due) < -365) return "That's more than a year overdue. Probably a typo.";
  // Duplicate check by exact title, across every list.
  for (var i = 0; i < ROWS.length; i++) {
    if (ROWS[i].title.toLowerCase() === title.trim().toLowerCase() && ROWS[i].is_done !== 1) {
      return 'You already have an open todo called that.';
    }
  }
  return '';
}

function nextId() {
  // max + 1. Two tabs open and you get a collision.
  var m = 0;
  for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id > m) m = ROWS[i].id;
  return m + 1;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

function addTodo() {
  var title = document.getElementById('new-title').value;
  var due = document.getElementById('new-due').value;
  var msg = validate(title, due);
  document.getElementById('err').textContent = msg;
  if (msg) return false;

  var row = {
    id: nextId(),
    title: title.trim(),
    list_name: document.getElementById('new-list').value,
    priority_num: parseInt(document.getElementById('new-pri').value, 10),
    due_date: due ? due + 'T00:00:00' : '',
    is_done: 0,
    created_at: Date.now(),
    done_at: 0
  };

  ROWS.push(row);
  fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row)
  }).then(loadFromServer);

  document.getElementById('new-title').value = '';
  document.getElementById('new-due').value = '';
  return false;
}

// `i` is the index in the *rendered* list, not in ROWS. We recover the real
// row by reading the id back out of the DOM node.
function toggle(i) {
  var node = document.querySelectorAll('#rows .row')[i];
  var id = parseInt(node.getAttribute('data-id'), 10);
  for (var j = 0; j < ROWS.length; j++) {
    if (ROWS[j].id === id) {
      ROWS[j].is_done = ROWS[j].is_done === 1 ? 0 : 1;
      ROWS[j].done_at = ROWS[j].is_done === 1 ? Date.now() : 0;
    }
  }
  save();
}

function removeAt(i) {
  var node = document.querySelectorAll('#rows .row')[i];
  var id = parseInt(node.getAttribute('data-id'), 10);
  var pos = -1;
  for (var j = 0; j < ROWS.length; j++) if (ROWS[j].id === id) pos = j;
  ROWS.splice(pos, 1);
  // Deleting by position in the server's array — which is only the same array
  // because the sort order happens to match. Usually.
  fetch('/api/todos?i=' + pos, { method: 'DELETE' }).then(loadFromServer);
}

function clearDone() {
  var keep = [];
  for (var i = 0; i < ROWS.length; i++) if (ROWS[i].is_done !== 1) keep.push(ROWS[i]);
  ROWS = keep;
  save();
}

// Anything open and older than two weeks gets promoted a priority level.
function bumpStale() {
  for (var i = 0; i < ROWS.length; i++) {
    var t = ROWS[i];
    if (t.is_done !== 1 && Math.floor((Date.now() - t.created_at) / DAY) > 14 && t.priority_num < maxPriority()) {
      t.priority_num = t.priority_num + 1;
    }
  }
  save();
}

function pickList(name) {
  var items = document.querySelectorAll('.nav-item');
  for (var i = 0; i < items.length; i++) {
    items[i].className = items[i].getAttribute('data-list') === name ? 'nav-item active' : 'nav-item';
  }
  var l = listDef(name);
  document.querySelector('h1').textContent = (l && l.heading) || name;
  render();
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

function currentList() {
  // Filter state is stored in the DOM.
  return document.querySelector('.nav-item.active').getAttribute('data-list');
}

function render() {
  var list = currentList();
  var def = listDef(list);
  var q = document.getElementById('q').value.toLowerCase();
  var hideDone = document.getElementById('hide-done').checked;

  // Sorting mutates the global array in place.
  ROWS.sort(function (a, b) { return urgency(b) - urgency(a); });

  var html = '';
  var shown = 0;
  for (var i = 0; i < ROWS.length; i++) {
    var t = ROWS[i];
    if (!(def && def.pseudo) && t.list_name !== list) continue;
    if (q && t.title.toLowerCase().indexOf(q) === -1) continue;
    if (hideDone && t.is_done === 1) continue;

    var d = daysUntil(t.due_date);
    var dueTxt = '';
    var dueCls = '';
    var p = priority(t.priority_num);
    var priStyle = p
      ? 'color:' + p.color + ';border-color:' + p.border + (p.bg ? ';background:' + p.bg : '')
      : '';
    if (t.due_date) {
      if (d < 0) { dueTxt = -d + 'd late'; dueCls = ' over'; }
      else if (d === 0) { dueTxt = 'today'; dueCls = ' soon'; }
      else if (d === 1) { dueTxt = 'tomorrow'; dueCls = ' soon'; }
      else if (d < 9000) { dueTxt = t.due_date.slice(5, 10); }
    }

    // String-concatenated HTML with the rendered index baked into onclick.
    html += '<li class="row' + (t.is_done === 1 ? ' done' : '') + '" data-id="' + t.id + '">'
      + '<input type="checkbox" onclick="toggle(' + shown + ')"' + (t.is_done === 1 ? ' checked' : '') + '>'
      + '<span class="title">' + t.title + '</span>'
      + '<span class="pill" style="' + priStyle + '">' + (p ? p.label : '?') + '</span>'
      + '<span class="pill">' + t.list_name + '</span>'
      + '<span class="due' + dueCls + '">' + dueTxt + '</span>'
      + '<span class="score">' + urgency(t) + '</span>'
      + '<button class="x" onclick="removeAt(' + shown + ')">×</button>'
      + '</li>';
    shown++;
  }

  document.getElementById('rows').innerHTML = html;
  document.getElementById('empty').style.display = shown ? 'none' : 'block';

  paintCounts();
  paintStats();
  paintSoon();
}

function paintCounts() {
  var items = document.querySelectorAll('.nav-item');
  for (var i = 0; i < items.length; i++) {
    var name = items[i].getAttribute('data-list');
    var def = listDef(name);
    var n = 0;
    for (var j = 0; j < ROWS.length; j++) {
      if (ROWS[j].is_done === 1) continue;
      if ((def && def.pseudo) || ROWS[j].list_name === name) n++;
    }
    items[i].querySelector('.count').textContent = n;
  }
}

// Stats are recomputed by scraping the DOM we just wrote, not the data.
function paintStats() {
  var rows = document.querySelectorAll('#rows .row');
  var open = 0, done = 0, over = 0, urg = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].className.indexOf('done') > -1) done++;
    else open++;
    if (rows[i].querySelector('.due').className.indexOf('over') > -1) over++;
    urg += parseInt(rows[i].querySelector('.score').textContent, 10);
  }
  document.getElementById('s-open').textContent = open;
  document.getElementById('s-done').textContent = done;
  document.getElementById('s-over').textContent = over;
  document.getElementById('s-urg').textContent = urg;
  var pct = open + done ? Math.round((done / (open + done)) * 100) : 0;
  document.getElementById('s-bar').style.width = pct + '%';
}

function paintSoon() {
  var out = '';
  var n = 0;
  for (var i = 0; i < ROWS.length && n < 5; i++) {
    var t = ROWS[i];
    if (t.is_done === 1 || !t.due_date) continue;
    var d = daysUntil(t.due_date);
    if (d > 7) continue;
    out += '<li><span>' + t.title + '</span><em>' + (d < 0 ? -d + 'd late' : d === 0 ? 'today' : d + 'd') + '</em></li>';
    n++;
  }
  document.getElementById('soon').innerHTML = out || '<li><span>Nothing due.</span></li>';
}

// The sidebar and both dropdowns are built once at startup, not from render()
// — render() runs on a 5s timer and rebuilding them there would stomp on the
// active list and on whatever the user had selected.
function paintLists() {
  var html = '';
  var heading = '';
  for (var i = 0; i < LISTS.length; i++) {
    var l = LISTS[i];
    html += '<button class="nav-item' + (l.pseudo ? ' active' : '') + '" data-list="' + l.name + '"'
          + ' onclick="pickList(\'' + l.name + '\')">' + l.name
          + '<span class="count">0</span></button>';
    if (l.pseudo) heading = l.heading || l.name;
  }
  document.getElementById('lists').innerHTML = html;
  // The first paint's heading comes from the same array as the buttons —
  // pickList() writes it on click, but nothing had written it before then.
  document.querySelector('h1').textContent = heading;
}

function paintListOptions() {
  var html = '';
  for (var i = 0; i < LISTS.length; i++) {
    var l = LISTS[i];
    if (l.pseudo) continue;                      // can't file a todo into "All"
    html += '<option' + (l.preselect ? ' selected' : '') + '>' + l.name + '</option>';
  }
  document.getElementById('new-list').innerHTML = html;
}

function paintPriorityOptions() {
  var html = '';
  for (var i = 0; i < PRIORITIES.length; i++) {
    var p = PRIORITIES[i];
    html += '<option value="' + p.num + '"' + (p.preselect ? ' selected' : '') + '>'
          + p.label + '</option>';
  }
  document.getElementById('new-pri').innerHTML = html;
}

// ---------------------------------------------------------------------------

paintLists();
paintListOptions();
paintPriorityOptions();
loadFromServer();
// Re-render on a timer so relative dates stay fresh. Also stomps on anything
// you were in the middle of.
TICK = setInterval(render, 5000);
