const test = require("node:test");
const assert = require("node:assert");
const K = require("../core.js");

test("new checklists copy the template with nothing ticked", () => {
  const list = K.newChecklist(K.defaultTemplate(), { client: " Demo:  Bakery ", startDate: "2026-03-02" });
  assert.strictEqual(list.client, "Demo: Bakery");
  assert.strictEqual(list.tasks.length, 13);
  assert.ok(list.tasks.every((t) => t.done === false && t.id));
});

test("progress counts ticked tasks", () => {
  const tasks = [{ done: true }, { done: false }, { done: true }];
  assert.deepStrictEqual(K.progress(tasks), { done: 2, total: 3, percent: 67 });
  assert.deepStrictEqual(K.progress([]), { done: 0, total: 0, percent: 0 });
});

test("adds a task at the end of its section", () => {
  const tasks = [{ id: "1", section: "A", text: "a1" }, { id: "2", section: "B", text: "b1" }];
  const next = K.addTask(tasks, { section: "A", text: "a2", owner: "client" });
  assert.deepStrictEqual(next.map((t) => t.text), ["a1", "a2", "b1"]);
  assert.deepStrictEqual(K.addTask(tasks, { section: "C", text: "c1", owner: "you" }).map((t) => t.section), ["A", "B", "C"]);
});

test("moves a task only within its section", () => {
  const tasks = [{ id: "1", section: "A" }, { id: "2", section: "B" }, { id: "3", section: "A" }];
  assert.deepStrictEqual(K.moveTask(tasks, "3", -1).map((t) => t.id), ["3", "2", "1"]);
  assert.deepStrictEqual(K.moveTask(tasks, "1", -1).map((t) => t.id), ["1", "2", "3"]);
});

test("templates keep tasks but not ticks", () => {
  const list = K.newChecklist([{ section: "A", text: "x", owner: "client" }]);
  list.tasks[0].done = true;
  assert.deepStrictEqual(K.templateFrom(list), [{ section: "A", text: "x", owner: "client" }]);
});

test("validates tasks", () => {
  assert.ok(K.validateTask({ text: "  " }).errors.text);
  assert.deepStrictEqual(K.validateTask({ text: "Send logo", section: "", owner: "bogus" }).task, { section: "Other", text: "Send logo", owner: "you" });
});

test("round-trips saved data", () => {
  const template = K.defaultTemplate();
  const list = K.newChecklist(template);
  const state = { template, checklists: [list], currentId: list.id };
  assert.deepStrictEqual(K.parseStored(K.serialize(state)), state);
  assert.throws(() => K.parseStored('{"version":1,"template":[{"text":1}],"checklists":[]}'));
});
