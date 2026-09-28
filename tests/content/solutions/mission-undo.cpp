class Editor {
    string text;
    stack<string> history, redoStack;
public:
    void type(const string& more) { history.push(text); text += more; redoStack = {}; }
    void undo() { if (!history.empty()) { redoStack.push(text); text = history.top(); history.pop(); } }
    void redo() { if (!redoStack.empty()) { history.push(text); text = redoStack.top(); redoStack.pop(); } }
    string getText() { return text; }
};
