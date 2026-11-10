import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// Vitest 2 does not yet include the newer once-with convenience matcher.
expect.extend({
  toHaveBeenCalledExactlyOnceWith(received, ...args) {
    const calls = received.mock.calls;
    return {
      pass: this.equals(calls, [args]),
      message: () => `Expected one call with ${JSON.stringify(args)}, got ${JSON.stringify(calls)}`,
    };
  },
});
declare module "vitest" {
  interface Assertion<T = any> {
    toHaveBeenCalledExactlyOnceWith(...args: any[]): T;
  }
}

// The project has no DOM test environment dependency. This small hook harness
// exercises the real editor event handlers/effects with fake DOM focus and timers.
const hooks = vi.hoisted(() => ({ current: null as any }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (...args: any[]) => hooks.current.useState(...args),
    useRef: (...args: any[]) => hooks.current.useRef(...args),
    useEffect: (...args: any[]) => hooks.current.useEffect(...args),
    useCallback: (...args: any[]) => hooks.current.useCallback(...args),
  };
});

import {
  SpecCustomTitleInput,
  SpecCustomValueCell,
  type SpecCustomTitleInputProps,
  type SpecCustomValueCellProps,
} from "../client/src/components/dashboard/SpecCustomEditors";

type Element = ReactElement<any>;
type Slot = { value?: any; deps?: any[]; cleanup?: () => void };

class Editor<P> {
  slots: Slot[] = [];
  cursor = 0;
  effects: Array<() => void> = [];
  tree!: Element;
  constructor(public component: (props: P) => Element, public props: P) { this.render(); }
  useState(initial: any) {
    const index = this.cursor++;
    if (!this.slots[index]) this.slots[index] = { value: typeof initial === "function" ? initial() : initial };
    return [this.slots[index].value, (value: any) => {
      this.slots[index].value = typeof value === "function" ? value(this.slots[index].value) : value;
    }];
  }
  useRef(value: any) {
    const index = this.cursor++;
    if (!this.slots[index]) this.slots[index] = { value: { current: value } };
    return this.slots[index].value;
  }
  changed(index: number, deps?: any[]) {
    const previous = this.slots[index];
    return !previous || !deps || !previous.deps || deps.some((dep, i) => !Object.is(dep, previous.deps![i]));
  }
  useEffect(effect: () => void | (() => void), deps?: any[]) {
    const index = this.cursor++;
    if (this.changed(index, deps)) {
      const previous = this.slots[index];
      this.effects.push(() => {
        previous?.cleanup?.();
        this.slots[index] = { deps, cleanup: effect() || undefined };
      });
    }
  }
  useCallback(callback: any, deps: any[]) {
    const index = this.cursor++;
    if (this.changed(index, deps)) this.slots[index] = { deps, value: callback };
    return this.slots[index].value;
  }
  render(patch?: Partial<P>) {
    if (patch) this.props = { ...this.props, ...patch };
    this.cursor = 0;
    this.effects = [];
    hooks.current = this;
    this.tree = this.component(this.props);
    this.effects.forEach((effect) => effect());
    // Effects may update local state; expose the settled render's handlers.
    this.cursor = 0;
    this.effects = [];
    this.tree = this.component(this.props);
    return this;
  }
  all(predicate: (element: Element) => boolean): Element[] {
    const result: Element[] = [];
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (predicate(node)) result.push(node);
      visit(node.props?.children);
    };
    visit(this.tree);
    return result;
  }
  field() { return this.all((element) => element.type === "textarea" || element.type === "input")[0]; }
  change(value: string) { this.field().props.onChange({ target: { value } }); this.render(); }
  unmount() { this.slots.forEach((slot) => slot.cleanup?.()); }
}

let activeElement: any;
let cells: any[];
const editors: Editor<any>[] = [];

function valueEditor(patch: Partial<SpecCustomValueCellProps> = {}) {
  const editor = new Editor(SpecCustomValueCell, {
    value: "Original", options: ["Original", "Other"], optionIds: { Original: 1, Other: 2 },
    onSave: vi.fn(), onAddOption: vi.fn(), onDeleteOption: vi.fn(), onEditOption: vi.fn(),
    ...patch,
  });
  const node = {
    style: {}, scrollHeight: 32,
    blur: () => { activeElement = null; editor.tree.props.onBlurCapture(); },
    focus: () => { activeElement = node; editor.tree.props.onFocusCapture(); editor.field().props.onFocus(); },
    getAttribute: () => editor.props.cellId,
  };
  editor.field().props.ref.current = node;
  editor.tree.props.ref.current = { contains: (element: any) => element === node };
  node.focus();
  editor.render();
  editors.push(editor);
  return { editor, node };
}

function titleEditor(patch: Partial<SpecCustomTitleInputProps> = {}) {
  const editor = new Editor(SpecCustomTitleInput, {
    id: 7, initialTitle: "BUCKLE", allTitles: ["Buckle type", "Buckle width"],
    onRename: vi.fn(), onDelete: vi.fn(), ...patch,
  });
  editor.field().props.onFocus();
  editor.render();
  editors.push(editor);
  return editor;
}

function key(editor: Editor<any>, key: string, patch: Record<string, any> = {}) {
  const event = { key, shiftKey: false, ctrlKey: false, preventDefault: vi.fn(), ...patch };
  editor.field().props.onKeyDown(event);
  editor.render();
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  activeElement = null;
  cells = [];
  vi.stubGlobal("document", { get activeElement() { return activeElement; }, querySelectorAll: () => cells });
});
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SpecCustomValueCell", () => {
  it("does not save untouched focus/blur, Enter, or unmount", () => {
    const { editor, node } = valueEditor();
    node.blur();
    vi.advanceTimersByTime(150);
    key(editor, "Enter");
    editor.unmount();
    expect(editor.props.onSave).not.toHaveBeenCalled();
  });

  it("keeps a focused dirty draft through an external refetch and saves once on blur", () => {
    const { editor, node } = valueEditor();
    editor.change("New draft");
    editor.render({ value: "Old response" });
    expect(editor.field().props.value).toBe("New draft");
    node.blur();
    vi.advanceTimersByTime(150);
    editor.unmount();
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("New draft");
  });

  it("delayed blur reads the latest draft, not the draft captured at blur", () => {
    const { editor, node } = valueEditor();
    editor.change("First");
    node.blur();
    editor.change("Latest");
    vi.advanceTimersByTime(150);
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("Latest");
  });

  it("commits Enter once, trimming user edits", () => {
    const { editor } = valueEditor();
    editor.change("  New text  ");
    key(editor, "Enter");
    vi.advanceTimersByTime(150);
    editor.unmount();
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("New text");
  });

  it("does not save text changed back to the baseline or whitespace-only edits", () => {
    const { editor, node } = valueEditor();
    editor.change("Other");
    editor.change("Original");
    node.blur();
    vi.advanceTimersByTime(150);
    editor.change(" Original ");
    key(editor, "Enter");
    expect(editor.props.onSave).not.toHaveBeenCalled();
  });

  it("Escape cancels pending blur/unmount saves and restores the latest external value", () => {
    const { editor, node } = valueEditor();
    editor.change("Unsaved");
    node.blur();
    editor.render({ value: "External" });
    key(editor, "Escape");
    vi.advanceTimersByTime(150);
    editor.unmount();
    expect(editor.field().props.value).toBe("External");
    expect(editor.props.onSave).not.toHaveBeenCalled();
  });

  it("flushes the latest dirty draft with the latest onSave callback on unmount", () => {
    const { editor } = valueEditor();
    const original = editor.props.onSave;
    editor.change("Unsaved");
    const latest = vi.fn();
    editor.render({ onSave: latest });
    editor.unmount();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith("Unsaved");
  });

  it("selects changed options once, and never saves an unchanged selection", () => {
    const { editor } = valueEditor();
    const select = (text: string) => editor.all((element) => element.props?.className?.includes("group/opt") && element.props.children[0].props.children === text)[0];
    select("Original").props.onMouseDown({ preventDefault: vi.fn() });
    vi.advanceTimersByTime(150);
    expect(editor.props.onSave).not.toHaveBeenCalled();
    editor.field().props.ref.current.focus();
    editor.render();
    select("Other").props.onMouseDown({ preventDefault: vi.fn() });
    vi.advanceTimersByTime(150);
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("Other");
  });

  it("preserves Ctrl+Enter add-suggestion and avoids subsequent duplicate save", () => {
    const { editor } = valueEditor();
    editor.change("New suggestion");
    key(editor, "Enter", { ctrlKey: true });
    vi.advanceTimersByTime(150);
    expect(editor.props.onAddOption).toHaveBeenCalledExactlyOnceWith("New suggestion");
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("New suggestion");
  });

  it("preserves edit/delete suggestion controls and add-suggestion mouse action", () => {
    const { editor } = valueEditor();
    const event = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    editor.all((element) => element.props?.title === "Remove suggestion")[0].props.onMouseDown(event());
    expect(editor.props.onDeleteOption).toHaveBeenCalledExactlyOnceWith("Original");
    editor.all((element) => element.props?.title === "Edit suggestion")[0].props.onMouseDown(event());
    editor.render();
    const inline = editor.all((element) => element.type === "input")[0];
    inline.props.onChange({ target: { value: "Renamed suggestion" } });
    editor.render();
    editor.all((element) => element.props?.title === "Save")[0].props.onMouseDown(event());
    expect(editor.props.onEditOption).toHaveBeenCalledExactlyOnceWith(1, "Renamed suggestion");
    editor.change("Mouse-added");
    editor.all((element) => element.props?.className?.includes("text-blue-600"))[0].props.onMouseDown(event());
    editor.field().props.ref.current.blur();
    vi.advanceTimersByTime(150);
    expect(editor.props.onAddOption).toHaveBeenCalledExactlyOnceWith("Mouse-added");
    expect(editor.props.onSave).toHaveBeenCalledExactlyOnceWith("Mouse-added");
  });

  it("Tab moves down the same column and commits only the edit", () => {
    const first = valueEditor({ cellId: "first:0" });
    const otherColumn = valueEditor({ cellId: "second:1" });
    const next = valueEditor({ cellId: "second:0" });
    cells = [first.node, otherColumn.node, next.node];
    first.node.focus();
    first.editor.change("Tab edit");
    const event = key(first.editor, "Tab");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(activeElement).toBe(next.node);
    expect(first.editor.props.onSave).toHaveBeenCalledExactlyOnceWith("Tab edit");
  });

  it("accepts external changes when untouched, and keeps Shift+Enter multiline", () => {
    const { editor } = valueEditor();
    editor.render({ value: "Imported value" });
    expect(editor.field().props.value).toBe("Imported value");
    editor.change("Multiline\ntext");
    const event = key(editor, "Enter", { shiftKey: true });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editor.props.onSave).not.toHaveBeenCalled();
  });
});

describe("SpecCustomTitleInput", () => {
  it("proper-cases initial display, then debounces raw edits locally for 500ms", () => {
    const editor = titleEditor();
    expect(editor.field().props.value).toBe("Buckle");
    editor.change("B");
    vi.advanceTimersByTime(300);
    editor.change("Buckle size");
    vi.advanceTimersByTime(499);
    expect(editor.props.onRename).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(editor.props.onRename).toHaveBeenCalledExactlyOnceWith(7, "Buckle size");
  });

  it("does not allow stale props to overwrite a focused dirty title, even after sending", () => {
    const editor = titleEditor();
    editor.change("Buckle size");
    editor.render({ initialTitle: "BUCKLE TYPE" });
    expect(editor.field().props.value).toBe("Buckle size");
    vi.advanceTimersByTime(500);
    editor.render({ initialTitle: "Buckle old response" });
    expect(editor.field().props.value).toBe("Buckle size");
    expect(editor.props.onRename).toHaveBeenCalledExactlyOnceWith(7, "Buckle size");
  });

  it("flushes synchronously on blur without a second timer/unmount send", () => {
    const editor = titleEditor();
    editor.change("Latest title");
    editor.field().props.onBlur();
    expect(editor.props.onRename).toHaveBeenCalledExactlyOnceWith(7, "Latest title");
    vi.advanceTimersByTime(500);
    editor.unmount();
    expect(editor.props.onRename).toHaveBeenCalledTimes(1);
  });

  it("unmount flush uses the latest title and latest callback", () => {
    const editor = titleEditor();
    const original = editor.props.onRename;
    editor.change("New title");
    const latest = vi.fn();
    editor.render({ onRename: latest });
    editor.unmount();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith(7, "New title");
  });

  it("suggestion selection flushes immediately, retaining title-only callback arguments", () => {
    const editor = titleEditor();
    const suggestion = editor.all((element) => element.type === "button" && element.props.children === "Buckle type")[0];
    suggestion.props.onMouseDown({ preventDefault: vi.fn() });
    vi.advanceTimersByTime(500);
    expect(editor.props.onRename).toHaveBeenCalledExactlyOnceWith(7, "Buckle type");
  });

  it("does not rename on untouched blur/unmount or an edit reverted before debounce", () => {
    const editor = titleEditor();
    editor.change("Other");
    editor.change("Buckle");
    editor.field().props.onBlur();
    vi.advanceTimersByTime(500);
    editor.unmount();
    expect(editor.props.onRename).not.toHaveBeenCalled();
  });

  it("retains delete and accepts external title changes when untouched", () => {
    const editor = titleEditor();
    editor.render({ initialTitle: "HEEL HEIGHT" });
    expect(editor.field().props.value).toBe("Heel Height");
    editor.all((element) => element.props?.title === "Delete this row")[0].props.onClick();
    expect(editor.props.onDelete).toHaveBeenCalledExactlyOnceWith(7);
  });
});
