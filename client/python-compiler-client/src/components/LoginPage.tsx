import React, { useState } from 'react';

export interface LoginCredentials {
    username: string;
    password: string;
}

interface LoginPageProps {
    onLogin: (credentials: LoginCredentials) => Promise<{ success: boolean; message?: string }>;
    isSocketConnected: boolean;
    error: string | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isSocketConnected, error }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        if (!username.trim() || !password) {
            setSubmitError('Введите логин и пароль.');
            return;
        }
        if (!isSocketConnected) {
            setSubmitError('Нет соединения с сервером. Подождите...');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await onLogin({ username: username.trim(), password });
            if (result.success) {
                return;
            }
            setSubmitError(result.message || 'Неверный логин или пароль.');
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Ошибка входа.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8 border border-gray-700">
                <h1 className="text-2xl font-bold text-white mb-2 text-center">Python Sandbox</h1>
                <p className="text-gray-400 text-sm text-center mb-6">Войдите, чтобы продолжить</p>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
                        {error}
                    </div>
                )}
                {!isSocketConnected && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-900/50 border border-amber-700 text-amber-300 text-sm">
                        Установка соединения...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="login-username" className="block text-sm font-medium text-gray-300 mb-1">
                            Логин
                        </label>
                        <input
                            id="login-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Логин"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-1">
                            Пароль
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Пароль"
                            disabled={isSubmitting}
                        />
                    </div>
                    {submitError && (
                        <p className="text-red-400 text-sm">{submitError}</p>
                    )}
                    <button
                        type="submit"
                        disabled={!isSocketConnected || isSubmitting}
                        className={`
                            w-full py-3 px-4 rounded-lg font-semibold transition
                            ${isSocketConnected && !isSubmitting
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {isSubmitting ? 'Вход...' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
