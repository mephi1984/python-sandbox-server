import React from 'react';
// Импортируем новый компонент
import CodeEditor from '@uiw/react-textarea-code-editor'; 
// Импортируем стили Prism (для подсветки)

// Если нужен тёмный вид, можно использовать 'prismjs/themes/prism-okaidia.css' или настроить свои стили

// УДАЛИТЬ все импорты:
// import CodeMirror, { type Extension } from '@uiw/react-codemirror';
// import { pythonLanguage } from '@codemirror/lang-python';
// ... и все остальные импорты из @codemirror/*

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    readOnly: boolean;
}

// **УДАЛИТЬ** неактуальную конфигурацию CodeMirror
// const disableMobileFeatures: Extension = EditorView.contentAttributes.of({...});

const CustomCodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, readOnly }) => {
    return (
        <CodeEditor
            value={value}
            placeholder="Введите код Python..."
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
                minHeight: "300px",
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                backgroundColor: '#2d2d2d',
                color: '#fff',
            }}
        />
    );
};

export default CustomCodeEditor;