import React, { useState, useCallback } from 'react';
import CodeEditor from './components/CodeEditor';
import LoginPage from './components/LoginPage';
import { useClientSandbox } from './hooks/useClientSandbox';

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [code, setCode] = useState('print("Hello from Python!")');
    const [output, setOutput] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleOutput = useCallback((data: string) => {
        setOutput(prev => prev + data + '\n');
    }, []);

    const { clientId, isLoading, error, runScript, isSocketConnected, login } = useClientSandbox(
        handleOutput,
        { isAuthenticated: isLoggedIn }
    );

    const handleLogin = useCallback(
        async (credentials: { username: string; password: string }) => {
            const result = await login(credentials.username, credentials.password);
            if (result.success) setIsLoggedIn(true);
            return result;
        },
        [login]
    );

    if (!isLoggedIn) {
        return (
            <LoginPage
                onLogin={handleLogin}
                isSocketConnected={isSocketConnected}
                error={error}
            />
        );
    }

    const handleSubmit = async () => {
        if (clientId === null || !isSocketConnected) {
            // NOTE: В React-приложениях лучше использовать кастомный модал вместо alert()
            console.error('Ошибка: Соединение не готово или клиент не зарегистрирован.');
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
        // 1. ТЕМНАЯ ТЕМА: Фон bg-gray-900, основной текст text-gray-100
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <div className="max-w-4xl mx-auto bg-gray-800 shadow-xl rounded-xl">
                
                <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 p-4 sm:p-6 lg:p-8">Python Sandbox</h1>
                
                <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-700/50">
                    {isLoading ? (
                        <p className="text-indigo-400 font-medium flex items-center">
                            Установка соединения и регистрация...
                        </p>
                    ) : error ? (
                        <p className="text-red-400 font-medium flex items-center">
                            Ошибка: {error}
                        </p>
                    ) : (
                        <p className="text-green-400 font-medium flex items-center">
                            Соединение активно. Client ID: <strong>{clientId}</strong>
                        </p>
                    )}
                </div>
                
                {/* Поле для ввода кода */}
                <div className="mb-4">
                    <label htmlFor="code-input" className="block text-lg font-semibold text-gray-300 mb-2">
                        Python-код:
                    </label>
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
                    // 3. СИНЯЯ КНОПКА (bg-blue-600)
                    className={`
                        w-full sm:w-auto px-6 py-3 text-lg font-semibold rounded-lg transition duration-150 shadow-md
                        ${isReady && !isRunning 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
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
                    <div className="mt-6 p-4 rounded-lg border-l-4 border-green-500 bg-green-900/50">
                        <p className="font-semibold text-green-400">{statusMessage}</p>
                    </div>
                )}

                {/* Блок потокового вывода */}
                <div className="mt-8">
                    <p className="text-lg font-semibold text-gray-300 mb-2">Вывод контейнера:</p>
                    <pre className="bg-gray-900 text-gray-200 p-4 rounded-lg overflow-x-auto text-sm" 
                         style={{ minHeight: '150px' }}>
                        {/* ❗ ИСПРАВЛЕНИЕ: Добавлен класс break-all для принудительного переноса длинных слов */}
                        <span className="whitespace-pre-wrap break-all">
                            {output || (isRunning ? "Ожидание вывода..." : "Нажмите 'Запустить'")}
                        </span>
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default App;