// Page behavior: checklists, tasks, the template, and the printed client copy.
// The rules live in core.js.
(() => {
  "use strict";

  const STORAGE_KEY = "client-onboarding-checklist.v1";
  const K = ChecklistCore;
  const $ = (id) => document.getElementById(id);

  let state = null;
  let undo = null;
  let editingId = null;
  let storageOk = true;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const longDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  const current = () => state.checklists.find((c) => c.id === state.currentId);

  function freshState() {
    const template = K.defaultTemplate();
    const first = K.newChecklist(template, { startDate: todayISO() });
    return { template, checklists: [first], currentId: first.id };
  }

  // ---------- Storage ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state = raw === null ? freshState() : K.parseStored(raw);
      if (!state.checklists.length) state = { ...state, ...(() => { const c = K.newChecklist(state.template, { startDate: todayISO() }); return { checklists: [c], currentId: c.id }; })() };
    } catch {
      storageOk = false;
      state = freshState();
      $("storage-alert").textContent = "Your saved checklists could not be read, or this browser blocks saving. Nothing was changed. Changes you make now won't be kept.";
      $("storage-alert").hidden = false;
    }
  }

  function save() {
    if (!storageOk) return;
    try { localStorage.setItem(STORAGE_KEY, K.serialize(state)); } catch {
      $("storage-alert").textContent = "Not saved: this browser's storage is full or turned off.";
      $("storage-alert").hidden = false;
    }
  }

  function commit(next, message, undoState) {
    state = next;
    save();
    undo = undoState || null;
    $("message").hidden = !message;
    $("message-text").textContent = message || "";
    $("undo-button").hidden = !undoState;
    render();
  }

  const withTasks = (tasks) => ({ ...state, checklists: state.checklists.map((c) => (c.id === state.currentId ? { ...c, tasks } : c)) });
  const label = (c) => c.client || c.project ? [c.client, c.project].filter(Boolean).join(" · ") : "Untitled checklist";

  // ---------- Rendering ----------

  function render() {
    const list = current();
    $("checklist-select").innerHTML = state.checklists.map((c) => `<option value="${esc(c.id)}">${esc(label(c))}</option>`).join("");
    $("checklist-select").value = list.id;

    const form = $("details-form");
    for (const name of ["client", "project", "startDate"]) {
      if (document.activeElement !== form.elements[name]) form.elements[name].value = list[name];
    }

    const p = K.progress(list.tasks);
    $("progress-text").textContent = `${p.done} of ${p.total} done · ${p.percent}%`;
    $("progress-bar").style.width = `${p.percent}%`;

    const groups = K.sections(list.tasks);
    $("sections").innerHTML = groups.length ? groups.map((g) => {
      const sp = K.progress(g.tasks);
      return `
      <section class="section" aria-label="${esc(g.name)}">
        <h3>${esc(g.name)} <span class="hint">${sp.done}/${sp.total}</span></h3>
        <ul class="tasks">
          ${g.tasks.map((t, i) => `
            <li class="${t.done ? "is-done" : ""}">
              <label class="task"><input type="checkbox" data-toggle="${esc(t.id)}" ${t.done ? "checked" : ""}> <span>${esc(t.text)}</span></label>
              <span class="badge ${t.owner === "client" ? "badge--warn" : ""}">${K.OWNER_LABELS[t.owner]}</span>
              <span class="task-actions">
                <button type="button" class="icon-button" data-move="-1" data-id="${esc(t.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up: ${esc(t.text)}">↑</button>
                <button type="button" class="icon-button" data-move="1" data-id="${esc(t.id)}" ${i === g.tasks.length - 1 ? "disabled" : ""} aria-label="Move down: ${esc(t.text)}">↓</button>
                <button type="button" class="button button--small" data-edit="${esc(t.id)}">Edit<span class="visually-hidden">: ${esc(t.text)}</span></button>
                <button type="button" class="button button--small button--danger" data-remove="${esc(t.id)}">Remove<span class="visually-hidden">: ${esc(t.text)}</span></button>
              </span>
            </li>`).join("")}
        </ul>
      </section>`;
    }).join("") : '<p class="empty">This checklist has no tasks. Add one below.</p>';

    $("section-list").innerHTML = groups.map((g) => `<option value="${esc(g.name)}"></option>`).join("");
    if (!$("add-form").section.value && groups.length) $("add-form").section.value = groups[groups.length - 1].name;
    $("template-count").textContent = String(state.template.length);
    $("delete-checklist").textContent = state.checklists.length > 1 ? "Delete" : "Clear";
  }

  // The printable copy: built from the current checklist just before printing.
  function buildPrintView() {
    const list = current();
    const clientOnly = document.querySelector('input[name="print-scope"]:checked').value === "client";
    const tasks = clientOnly ? list.tasks.filter((t) => t.owner === "client") : list.tasks;
    const p = K.progress(tasks);
    $("print-view").innerHTML = `
      <header class="print-head">
        <p class="print-kicker">Onboarding checklist</p>
        <h1>${esc(list.project || "Your project")}</h1>
        <dl>
          ${list.client ? `<div><dt>Client</dt><dd>${esc(list.client)}</dd></div>` : ""}
          ${list.startDate ? `<div><dt>Start date</dt><dd>${esc(longDate(list.startDate))}</dd></div>` : ""}
          <div><dt>Progress</dt><dd>${p.done} of ${p.total} done</dd></div>
        </dl>
        ${clientOnly ? "<p>These are the things we need from you to get started.</p>" : ""}
      </header>
      ${K.sections(tasks).map((g) => `
        <section>
          <h2>${esc(g.name)}</h2>
          <ul>${g.tasks.map((t) => `<li class="${t.done ? "done" : ""}"><span class="box">${t.done ? "✓" : ""}</span><span class="text">${esc(t.text)}</span>${clientOnly ? "" : `<span class="who">${K.OWNER_LABELS[t.owner]}</span>`}</li>`).join("")}</ul>
        </section>`).join("")}
      <p class="print-foot">Updated ${esc(longDate(todayISO()))}</p>`;
  }

  // ---------- Events ----------

  $("sections").addEventListener("change", (event) => {
    const box = event.target.closest("[data-toggle]");
    if (!box) return;
    commit(withTasks(K.updateTask(current().tasks, box.dataset.toggle, { done: box.checked })));
    const again = document.querySelector(`[data-toggle="${CSS.escape(box.dataset.toggle)}"]`);
    if (again) again.focus();
  });

  $("sections").addEventListener("click", (event) => {
    const move = event.target.closest("[data-move]");
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-remove]");
    if (move) {
      commit(withTasks(K.moveTask(current().tasks, move.dataset.id, Number(move.dataset.move))));
      const again = document.querySelector(`[data-move="${move.dataset.move}"][data-id="${CSS.escape(move.dataset.id)}"]`);
      if (again && !again.disabled) again.focus();
    }
    if (edit) openEdit(edit.dataset.edit);
    if (remove) {
      const task = current().tasks.find((t) => t.id === remove.dataset.remove);
      const before = state;
      commit(withTasks(K.removeTask(current().tasks, task.id)), `Removed “${task.text}”.`, before);
    }
  });

  function showErrors(form, errors) {
    for (const el of form.querySelectorAll("[data-error]")) {
      el.textContent = errors[el.dataset.error] || "";
      const input = form.elements[el.dataset.error];
      if (input) input.setAttribute("aria-invalid", String(Boolean(errors[el.dataset.error])));
    }
    const first = Object.keys(errors)[0];
    if (first && form.elements[first]) form.elements[first].focus();
  }

  $("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const { errors, task } = K.validateTask({ text: form.text.value, section: form.section.value, owner: form.owner.value });
    if (Object.keys(errors).length) return showErrors(form, errors);
    showErrors(form, {});
    form.text.value = "";
    commit(withTasks(K.addTask(current().tasks, task)), `Added “${task.text}” to ${task.section}.`);
    form.text.focus();
  });

  function openEdit(id) {
    const task = current().tasks.find((t) => t.id === id);
    editingId = id;
    const form = $("edit-form");
    form.text.value = task.text;
    form.section.value = task.section;
    form.owner.value = task.owner;
    showErrors(form, {});
    $("edit-dialog").showModal();
  }

  $("edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const { errors, task } = K.validateTask({ text: form.text.value, section: form.section.value, owner: form.owner.value });
    if (Object.keys(errors).length) return showErrors(form, errors);
    $("edit-dialog").close();
    const old = current().tasks.find((t) => t.id === editingId);
    let tasks = current().tasks;
    // A task moved to another section goes to the end of that section.
    if (old.section !== task.section) tasks = K.addTask(K.removeTask(tasks, editingId), { ...task, done: old.done });
    else tasks = K.updateTask(tasks, editingId, task);
    commit(withTasks(tasks), "Task saved.");
  });

  $("details-form").addEventListener("input", (event) => {
    const { name, value } = event.target;
    state = { ...state, checklists: state.checklists.map((c) => (c.id === state.currentId ? { ...c, [name]: name === "startDate" ? value : value.slice(0, 120) } : c)) };
    save();
    const option = $("checklist-select").querySelector(`option[value="${CSS.escape(state.currentId)}"]`);
    if (option) option.textContent = label(current());
  });

  $("checklist-select").addEventListener("change", (event) => {
    commit({ ...state, currentId: event.target.value });
  });

  $("new-button").addEventListener("click", () => {
    const list = K.newChecklist(state.template, { startDate: todayISO() });
    commit({ ...state, checklists: [...state.checklists, list], currentId: list.id }, "New checklist started from your template. Add the client's name above.");
    $("details-form").client.focus();
  });

  $("delete-checklist").addEventListener("click", () => {
    const before = state;
    const list = current();
    let checklists = state.checklists.filter((c) => c.id !== list.id);
    if (!checklists.length) checklists = [K.newChecklist(state.template, { startDate: todayISO() })];
    commit({ ...state, checklists, currentId: checklists[0].id }, `${before.checklists.length > 1 ? "Deleted" : "Cleared"} “${label(list)}”.`, before);
  });

  $("save-template").addEventListener("click", () => {
    const before = state;
    commit({ ...state, template: K.templateFrom(current()) }, `Saved ${current().tasks.length} tasks as your template. New checklists will start with them.`, before);
  });

  $("reset-template").addEventListener("click", () => {
    const before = state;
    commit({ ...state, template: K.defaultTemplate() }, "Your template is back to the default tasks.", before);
  });

  $("demo-button").addEventListener("click", () => {
    const before = state;
    const demo = window.makeDemoChecklist(K, todayISO());
    commit({ ...state, checklists: [...state.checklists, demo], currentId: demo.id }, "Added a demo checklist for a fictional client. Click Undo to remove it.", before);
  });

  $("print-button").addEventListener("click", () => {
    buildPrintView();
    window.print();
  });
  window.addEventListener("beforeprint", buildPrintView);

  $("undo-button").addEventListener("click", () => { if (undo) commit(undo, "Undone."); });
  for (const button of document.querySelectorAll("[data-close]")) button.addEventListener("click", () => button.closest("dialog").close());
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) { load(); render(); } });

  load();
  render();
})();
