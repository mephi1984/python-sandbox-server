import React from 'react';
import CodeMirror,  { type Extension } from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands'; // Добавим для базовых команд
import { indentOnInput } from '@codemirror/language'; // Добавим для автоотступов
import { lineNumbers } from '@codemirror/view'; // Добавим для номеров строк

import {
  highlightSpecialChars,
  highlightActiveLine, highlightActiveLineGutter
} from "@codemirror/view"
import {
  bracketMatching, foldGutter, foldKeymap
} from "@codemirror/language"
import {
  searchKeymap, highlightSelectionMatches
} from "@codemirror/search"
import {
  autocompletion, completionKeymap, closeBrackets,
  closeBracketsKeymap
} from "@codemirror/autocomplete"
import {lintKeymap} from "@codemirror/lint"

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    readOnly: boolean;
}

// Конфигурация для отключения мобильных функций и грамматики
const disableMobileFeatures: Extension = EditorView.contentAttributes.of({
    autocorrect: "off",
    autocapitalize: "off",
    spellcheck: "false",
    inputmode: "text"
});



const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, readOnly }) => {
    return (
        <CodeMirror
            value={value}
            height="300px" 
            minHeight="200px" 
            theme="dark" 
            extensions= {[
                python(),
    // A line number gutter
    lineNumbers(),
    // A gutter with code folding markers
    foldGutter(),
    // Replace non-printable characters with placeholders
    highlightSpecialChars(),
    // The undo history
    //history(),
    // Re-indent lines when typing specific input
   indentOnInput(),
    // Highlight syntax with a default style
    //syntaxHighlighting(defaultHighlightStyle),
    // Highlight matching brackets near cursor
    bracketMatching(),
    // Automatically close brackets
    closeBrackets(),
    // Load the autocompletion system
    autocompletion(),
    // Style the current line specially
    highlightActiveLine(),
    // Style the gutter for current line specially
    highlightActiveLineGutter(),
    // Highlight text that matches the selected text
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    disableMobileFeatures,
    keymap.of([
      ...closeBracketsKeymap,
      // A large set of basic bindings
      ...defaultKeymap,
      // Search-related keys
      ...searchKeymap,
      // Redo/undo keys
      //...historyKeymap,
      // Code folding bindings
      ...foldKeymap,
      // Autocompletion keys
      ...completionKeymap,
      // Keys related to the linter system
      ...lintKeymap
    ])
  ]}
            onChange={onChange}
            readOnly={readOnly}
            style={{ fontSize: '14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
        />
    );
};

export default CodeEditor;