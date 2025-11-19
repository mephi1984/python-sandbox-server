import React, { useState, useCallback } from 'react';
// Предполагается, что вы установили Tailwind CSS
import CodeEditor from './components/CodeEditor'; // Импортируем новый редактор
import { useClientSandbox } from './hooks/useClientSandbox';

const App: React.FC = () => {
    // Начальный код
    const [code, setCode] = useState('import time\nprint("Hello from sandboxed Python!")\ntime.sleep(5)\nprint("Бот завершил работу.")');
    const [output, setOutput] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    // Функция для потокового обновления вывода
    const handleOutput = useCallback((data: string) => {
        setOutput(prev => prev + data + '\n');
    }, []);
    
    // Передаем handleOutput в хук
    const { clientId, isLoading, error, runScript, isSocketConnected } = useClientSandbox(handleOutput);

    const handleSubmit = async () => {
        if (clientId === null || !isSocketConnected) {
            alert('Ошибка: Соединение не готово. Попробуйте обновить страницу.');
            return;
        }

        setIsRunning(true);
        setOutput(''); // Очищаем вывод перед новым запуском
        setStatusMessage(null);

        try {
            const resultMessage = await runScript(code);
            setStatusMessage(`✅ ${resultMessage}`);

        } catch (err) {
            setStatusMessage(`❌ Ошибка: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsRunning(false);
        }
    };

    const isReady = !isLoading && isSocketConnected && clientId !== null;

    return (
        // 🌟 Адаптивный контейнер Tailwind
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-4 sm:p-6">
                
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">Python Sandbox (Socket.IO)</h1>
                
                {/* Блок состояния клиента */}
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-indigo-50/50">
                    {isLoading ? (
                        <p className="text-indigo-600 font-medium">⚡️ Установка соединения и регистрация...</p>
                    ) : error ? (
                        <p className="text-red-600 font-medium flex items-center">
                            Ошибка: {error}
                        </p>
                    ) : (
                        <p className="text-green-600 font-medium flex items-center">
                            Соединение активно. Client ID: <strong>{clientId}</strong>
                        </p>
                    )}
                </div>
                
                {/* Поле для ввода кода */}
                <div className="mb-4">
                    <label htmlFor="code-input" className="block text-lg font-semibold text-gray-700 mb-2">
                        Python-код:
                    </label>
                    {/* 🌟 Интеграция CodeEditor */}
                    <CodeEditor 
                        value={code}
                        onChange={setCode}
                        readOnly={!isReady || isRunning}
                    />
                </div>

                {/* Кнопка запуска */}
                <button
                    onClick={handleSubmit}
                    disabled={!isReady || isRunning}
                    className={`
                        w-full sm:w-auto px-6 py-3 text-lg font-semibold rounded-lg transition duration-150 shadow-md
                        ${isReady && !isRunning 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                            : 'bg-gray-400 text-gray-700 cursor-not-allowed'}
                    `}
                >
                    {isRunning ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Запуск...
                        </span>
                    ) : (
                        '▶️ Запустить'
                    )}
                </button>

                {/* Блок вывода статуса */}
                {statusMessage && (
                    <div className="mt-6 p-4 rounded-lg border-l-4 border-green-500 bg-green-50">
                        <p className="font-semibold text-green-700">{statusMessage}</p>
                    </div>
                )}

                {/* Блок потокового вывода */}
                <div className="mt-8">
                    <p className="text-lg font-semibold text-gray-700 mb-2">Вывод контейнера:</p>
                    <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto text-sm" style={{ minHeight: '150px' }}>
                        {output || (isRunning ? "Ожидание вывода..." : "Нажмите 'Запустить'")}
                    </pre>
                </div>

            </div>
        </div>
    );
};

export default App;