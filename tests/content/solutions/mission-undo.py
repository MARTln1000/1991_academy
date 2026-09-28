class Editor:
    def __init__(self):
        self.text = ""
        self.history = []
        self.redo_stack = []

    def type(self, text):
        self.history.append(self.text)
        self.text += text
        self.redo_stack.clear()

    def undo(self):
        if self.history:
            self.redo_stack.append(self.text)
            self.text = self.history.pop()

    def redo(self):
        if self.redo_stack:
            self.history.append(self.text)
            self.text = self.redo_stack.pop()

    def get_text(self):
        return self.text


def create_editor():
    return Editor()
