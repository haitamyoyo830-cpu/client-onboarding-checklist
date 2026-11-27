// Client Onboarding Checklist rules: the default template, checklists, task
// changes, progress, and the saved format. No page code, so Node can test it.
const ChecklistCore = (() => {
  "use strict";

  const OWNERS = ["you", "client"];
  const OWNER_LABELS = { you: "You", client: "Client" };

  const DEFAULT_TEMPLATE = [
    ["Before kickoff", "Send a welcome email with the next steps", "you"],
    ["Before kickoff", "Sign the contract", "client"],
    ["Before kickoff", "Pay the deposit invoice", "client"],
    ["Before kickoff", "Send the project questionnaire", "you"],
    ["Before kickoff", "Return the completed questionnaire", "client"],
    ["Access and files", "Send logo and brand files", "client"],
    ["Access and files", "Share logins or account access", "client"],
    ["Access and files", "Send text and photos for the project", "client"],
    ["Access and files", "Set up a shared folder", "you"],
    ["Kickoff", "Schedule the kickoff call", "you"],
    ["Kickoff", "Agree on one main contact and how to reach them", "you"],
    ["Kickoff", "Confirm the timeline and milestones in writing", "you"],
    ["Kickoff", "Add review and launch dates to the calendar", "you"]
  ];

  const newId = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
  const clean = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

  const defaultTemplate = () => DEFAULT_TEMPLATE.map(([section, text, owner]) => ({ section, text, owner }));

  function newChecklist(template, details = {}) {
    return {
      id: newId(),
      client: clean(details.client, 120),
      project: clean(details.project, 120),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(details.startDate || "") ? details.startDate : "",
      tasks: template.map((t) => ({ id: newId(), section: t.section, text: t.text, owner: t.owner, done: false }))
    };
  }

  // A template is the task list without ticks or ids.
  const templateFrom = (checklist) => checklist.tasks.map(({ section, text, owner }) => ({ section, text, owner }));

  function progress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  // Sections in the order they first appear, with their tasks.
  function sections(tasks) {
    const map = new Map();
    for (const task of tasks) {
      if (!map.has(task.section)) map.set(task.section, []);
      map.get(task.section).push(task);
    }
    return [...map.entries()].map(([name, list]) => ({ name, tasks: list }));
  }

  function validateTask(input) {
    const errors = {};
    const text = clean(input.text, 200);
    const section = clean(input.section, 60) || "Other";
    const owner = OWNERS.includes(input.owner) ? input.owner : "you";
    if (!text) errors.text = "Enter the task.";
    return { errors, task: { section, text, owner } };
  }

  // New tasks go at the end of their section, or start a new section at the end.
  function addTask(tasks, task) {
    const item = { id: newId(), done: false, ...task };
    let last = -1;
    tasks.forEach((t, i) => { if (t.section === task.section) last = i; });
    if (last === -1) return [...tasks, item];
    return [...tasks.slice(0, last + 1), item, ...tasks.slice(last + 1)];
  }

  const updateTask = (tasks, id, changes) => tasks.map((t) => (t.id === id ? { ...t, ...changes } : t));
  const removeTask = (tasks, id) => tasks.filter((t) => t.id !== id);

  // Swaps a task with its neighbour in the same section. direction: -1 up, 1 down.
  function moveTask(tasks, id, direction) {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return tasks;
    let other = index + direction;
    while (other >= 0 && other < tasks.length && tasks[other].section !== tasks[index].section) other += direction;
    if (other < 0 || other >= tasks.length) return tasks;
    const next = [...tasks];
    [next[index], next[other]] = [next[other], next[index]];
    return next;
  }

  // ---------- Saved format ----------

  const serialize = (state) => JSON.stringify({ version: 1, template: state.template, checklists: state.checklists, currentId: state.currentId });

  function validTask(t, withState) {
    return t && typeof t.section === "string" && typeof t.text === "string" && OWNERS.includes(t.owner)
      && (!withState || (typeof t.id === "string" && typeof t.done === "boolean"));
  }

  function parseStored(text) {
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || !Array.isArray(data.template) || !Array.isArray(data.checklists)) throw new Error("Unrecognized data");
    if (!data.template.every((t) => validTask(t, false))) throw new Error("Unrecognized template");
    const checklists = data.checklists.map((c) => {
      if (!c || typeof c.id !== "string" || !Array.isArray(c.tasks) || !c.tasks.every((t) => validTask(t, true))) throw new Error("Unrecognized checklist");
      return { id: c.id, client: String(c.client || ""), project: String(c.project || ""), startDate: String(c.startDate || ""),
        tasks: c.tasks.map(({ id, section, text, owner, done }) => ({ id, section, text, owner, done })) };
    });
    const template = data.template.map(({ section, text, owner }) => ({ section, text, owner }));
    const currentId = checklists.some((c) => c.id === data.currentId) ? data.currentId : (checklists[0] || {}).id || null;
    return { template, checklists, currentId };
  }

  return { OWNERS, OWNER_LABELS, defaultTemplate, newChecklist, templateFrom, progress, sections, validateTask, addTask, updateTask, removeTask, moveTask, serialize, parseStored };
})();

if (typeof module !== "undefined") module.exports = ChecklistCore;
