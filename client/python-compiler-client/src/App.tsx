import React, { useState, useCallback } from 'react';
import { useClientSandbox } from './hooks/useClientSandbox';

const App: React.FC = () => {
    const [code, setCode] = useState('import time\nprint("Hello from sandboxed Python!")\ntime.sleep(5)\nprint("Бот завершил работу.")');
    const [output, setOutput] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    // Функция для потокового обновления вывода (НЕ ИЗМЕНЯЕТСЯ)
    const handleOutput = useCallback((data: string) => {
        setOutput(prev => prev + data + '\n');
    }, []);
    
    // ❗ ИСПРАВЛЕНИЕ: Передаем handleOutput в хук
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
            
            // Сообщение при успешном запуске (success_quick или success_async)
            setStatusMessage(`✅ ${resultMessage}`);

        } catch (err) {
            // Ошибка выполнения/HMAC/сети
            setStatusMessage(`❌ Ошибка: ${err instanceof Error ? err.message : String(err)}`);
            // Вывод уже содержит подробности (runtime_error) через стрим 'output'
        } finally {
            setIsRunning(false);
        }
    };

    const isReady = !isLoading && isSocketConnected && clientId !== null;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <h1>Python Sandbox (Socket.IO)</h1>
            
            <hr />

            {/* Блок состояния клиента */}
            <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
                {isLoading ? (
                    <p>⚡️ Установка соединения и регистрация...</p>
                ) : error ? (
                    <p style={{ color: 'red' }}>🛑 Ошибка соединения/регистрации: {error}</p>
                ) : (
                    <p>✅ Соединение активно. Client ID: <strong>{clientId}</strong></p>
                )}
            </div>
            
            {/* Поле для ввода кода */}
            <label htmlFor="code-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Python-код:
            </label>
            <textarea
                id="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={10}
                cols={80}
                style={{ width: '100%', padding: '10px', fontSize: '14px', fontFamily: 'monospace' }}
                disabled={!isReady || isRunning}
            />

            {/* Кнопка запуска */}
            <button
                onClick={handleSubmit}
                disabled={!isReady || isRunning}
                style={{ 
                    padding: '10px 20px', 
                    fontSize: '16px', 
                    backgroundColor: '#4CAF50', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer', 
                    marginTop: '10px' 
                }}
            >
                {isRunning ? 'Запуск...' : '▶️ Запустить'}
            </button>

            {/* Блок вывода статуса */}
            {statusMessage && (
                <div style={{ marginTop: '10px', padding: '10px', borderLeft: '3px solid #4CAF50', backgroundColor: '#e8ffe8' }}>
                    <p style={{ margin: 0 }}>{statusMessage}</p>
                </div>
            )}

            {/* Блок потокового вывода */}
            <div style={{ marginTop: '20px' }}>
                <p style={{ fontWeight: 'bold' }}>Вывод контейнера:</p>
                <pre style={{ 
                    backgroundColor: '#333', 
                    color: '#f0f0f0', 
                    padding: '15px', 
                    borderRadius: '4px', 
                    overflowX: 'auto',
                    minHeight: '100px'
                }}>
                    {output || (isRunning ? "Ожидание вывода..." : "Нажмите 'Запустить'")}
                </pre>
            </div>
        </div>
    );
};

export default App;