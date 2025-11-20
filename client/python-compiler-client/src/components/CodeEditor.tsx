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
            // Основные пропсы
            value={value}
            //language="python" // Указываем язык для Prism.js
            placeholder="Введите код Python..."
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)} // onChange принимает объект события
            
            // Стили
            style={{
                minHeight: "300px",
                fontSize: '14px', 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                backgroundColor: '#2d2d2d', // Тёмный фон
                color: '#fff', // Светлый текст
                // Эти стили унаследованы от textarea, они могут помочь, 
                // но часто не требуются, т.к. клавиатура их не переопределяет:
                autocorrect: "off",
                autocapitalize: "off",
                spellcheck: "false",
                inputmode: "text"
            }}
        />
    );
};

export default CustomCodeEditor;