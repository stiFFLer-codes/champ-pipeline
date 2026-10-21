"""WP3 benchmark wrapper (invocation only) for krishnarajt/Whatsapp-Chat-File-Merger.

Source.py is a Tk GUI: a text box for the output name, a file dialog to pick
the exports, and one button. This wrapper puts an inert `tkinter` stub on
sys.modules, so that the file dialog returns the given fragment paths in the
given order, the output-name box is left empty (the tool's default name), and
the button is pressed once by mainloop(). Source.py itself then runs
unmodified via runpy, in the current directory, where it writes its output.

Usage: python run_krishnarajt.py <Source.py> <first.txt> <second.txt>
"""
import runpy
import sys
import types

source, *picked = sys.argv[1:]
pressed = []


class Widget:
    def __init__(self, *args, command=None, **kwargs):
        if command is not None:
            pressed.append(command)

    def pack(self, *args, **kwargs):
        return None

    def get(self):
        return ''


class Tk(Widget):
    def title(self, *args):
        pass

    def mainloop(self):
        for command in pressed:
            command()


tk = types.ModuleType('tkinter')
tk.Tk, tk.Label, tk.Entry, tk.Button = Tk, Widget, Widget, Widget
tk.__all__ = ['Tk', 'Label', 'Entry', 'Button']
dialog = types.ModuleType('tkinter.filedialog')
dialog.askopenfilenames = lambda **kwargs: tuple(picked)
tk.filedialog = dialog
sys.modules['tkinter'] = tk
sys.modules['tkinter.filedialog'] = dialog

runpy.run_path(source, run_name='__main__')
