// A fictional demo client, part way through onboarding.
window.makeDemoChecklist = (core, today) => {
  const checklist = core.newChecklist(core.defaultTemplate(), {
    client: "Demo: Juniper Street Bakery",
    project: "New website with online ordering",
    startDate: today
  });
  const doneTexts = [
    "Send a welcome email with the next steps",
    "Sign the contract",
    "Pay the deposit invoice",
    "Send the project questionnaire",
    "Set up a shared folder",
    "Schedule the kickoff call"
  ];
  checklist.tasks = checklist.tasks.map((t) => ({ ...t, done: doneTexts.includes(t.text) }));
  checklist.tasks = core.addTask(checklist.tasks, { section: "Access and files", text: "Send the current menu as a PDF", owner: "client" });
  return checklist;
};
