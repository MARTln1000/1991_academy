function createEditor() {
  let text = "";
  const history = [], redoStack = [];
  return {
    type(str) { history.push(text); text += str; redoStack.length = 0; },
    undo() { if (history.length) { redoStack.push(text); text = history.pop(); } },
    redo() { if (redoStack.length) { history.push(text); text = redoStack.pop(); } },
    getText() { return text; },
  };
}
