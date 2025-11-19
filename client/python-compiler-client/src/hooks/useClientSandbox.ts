import { useState, useEffect, useCallback, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, HMAC_SECRET_KEY, LOCAL_STORAGE_CLIENT_ID_KEY } from '../config';

// Типы для сообщений Socket.IO
interface Payload {
    client_id: number;
    script_content?: string;
}

interface SignedMessage {
    payload: Payload;
    signature: string;
}

const signPayload = (payload: any): string => {
    const payloadJsonStr = JSON.stringify(payload); 
    
    // Проверяем, что клиентский модуль HMAC корректно принимает строку и кодирует ее в UTF-8
    const hmac = CryptoJS.HmacSHA256(payloadJsonStr, HMAC_SECRET_KEY);

    return hmac.toString(CryptoJS.enc.Hex);
};

export const useClientSandbox = (handleOutput: (data: string) => void) => {
    const [clientId, setClientId] = useState<number | null>(null);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Референс для хранения объекта Socket.IO
    const socketRef = useRef<Socket | null>(null);
    
    // --- 1. Управление Соединением и Регистрацией ---
    useEffect(() => {
        // Устанавливаем соединение Socket.IO
        const socket = io(API_BASE_URL, {
             // Убедитесь, что URL соответствует вашему API Nginx HTTPS
             secure: true, 
             reconnection: true,
             transports: ['websocket']
        });

        socketRef.current = socket;

        // Обработчики событий Socket.IO
        socket.on('connect', () => {
            setIsSocketConnected(true);
            console.log('Socket.IO подключен.');
            loadOrRegisterClient(socket);
        });

        socket.on('disconnect', () => {
            setIsSocketConnected(false);
            console.log('Socket.IO отключен.');
        });
        
        // Обработчик результата регистрации от сервера
        socket.on('registration_result', (data: { status: string, message?: string, client_id?: number }) => {
            if (data.status === 'success' && data.client_id) {
                const newId = data.client_id;
                setClientId(newId);
                localStorage.setItem(LOCAL_STORAGE_CLIENT_ID_KEY, String(newId));
                console.log(`[Client] ID получен/восстановлен: ${newId}`);
            } else {
                setError(`Ошибка регистрации: ${data.message}`);
            }
            setIsLoading(false);
        });

        socket.on('output', (data: { data: string }) => {
             handleOutput(data.data); // Вызываем функцию, переданную из App.tsx
        });


        // Очистка при размонтировании
        return () => {
            socket.off('output');
            socket.disconnect();
        };
    }, [handleOutput]);

    // --- Логика загрузки ID и отправки запроса на регистрацию ---
    const loadOrRegisterClient = (socket: Socket) => {
        const storedId = localStorage.getItem(LOCAL_STORAGE_CLIENT_ID_KEY);
        let currentId = 0;

        if (storedId) {
            const idNumber = parseInt(storedId, 10);
            if (!isNaN(idNumber) && idNumber > 0) {
                currentId = idNumber;
            }
        }
        
        // Создаем payload для регистрации
        const registrationPayload: Payload = { client_id: currentId };
        const signature = signPayload(registrationPayload);
        
        // Отправляем запрос на регистрацию/восстановление сессии
        const message: SignedMessage = { payload: registrationPayload, signature };
        const handleRegistrationResult = (data: { status: string, message?: string, client_id?: number }) => {
        
            socket.off('registration_result', handleRegistrationResult); // Удаляем себя

            if (data.status === 'success' && data.client_id) {
                const newId = data.client_id;
                setClientId(newId);
                localStorage.setItem(LOCAL_STORAGE_CLIENT_ID_KEY, String(newId));
                console.log(`[Client] ID получен/восстановлен: ${newId}`);
            } else if (data.status === 'error' && data.message === 'Invalid client ID requested.') {
                
                // ❗ 2. ОБРАБОТКА НЕВАЛИДНОГО СТАРОГО ID ❗
                console.warn(`[Client] Получен невалидный ID (${currentId}). Сервер, вероятно, был перезапущен.`);
                localStorage.removeItem(LOCAL_STORAGE_CLIENT_ID_KEY);
                setClientId(null);
                
                // 3. Инициируем ПОВТОРНУЮ регистрацию с ID=0
                console.log('[Client] Повторная регистрация с новым ID...');
                // Отправляем новое событие с client_id: 0 (чтобы получить новый ID)
                const retryPayload: Payload = { client_id: 0 };
                const retrySignature = signPayload(retryPayload);
                const retryMessage: SignedMessage = { payload: retryPayload, signature: retrySignature };

                // Переназначаем слушатель для приема результата повторной регистрации
                socket.on('registration_result', (data: any) => {
                    socket.off('registration_result', this); // Удаляем этот слушатель
                    if (data.status === 'success' && data.client_id) {
                        setClientId(data.client_id);
                        localStorage.setItem(LOCAL_STORAGE_CLIENT_ID_KEY, String(data.client_id));
                        console.log(`[Client] Успешно зарегистрирован новый ID: ${data.client_id}`);
                    } else {
                        setError(`Ошибка повторной регистрации: ${data.message}`);
                    }
                    setIsLoading(false);
                });
                
                socket.emit('register_client', retryMessage);
                
            } else {
                setError(`Ошибка регистрации: ${data.message}`);
                setIsLoading(false);
            }
        };
        
        // Назначаем обработчик для первого запроса
        socket.on('registration_result', handleRegistrationResult);
        
        // Отправляем первый запрос на регистрацию/восстановление
        socket.emit('register_client', message);
    };


    // --- 2. Функция для запуска скрипта ---
    const runScript = useCallback(async (scriptContent: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const socket = socketRef.current;
            if (!socket || clientId === null || !isSocketConnected) {
                return reject('Соединение неактивно или клиент не зарегистрирован.');
            }

            const onResult = (data: { status: string, message?: string, code?: number }) => {
                // Удаляем временный обработчик
                socket.off('execution_result', onResult); 
                
                if (data.status.startsWith('success')) {
                    resolve(data.message || "Успешно.");
                } else if (data.status === 'runtime_error' || data.status === 'docker_error') {
                     reject(data.message || `Ошибка выполнения с кодом: ${data.code}`);
                } else {
                    reject(`Неизвестный статус: ${data.status}`);
                }
            };
            
            socket.on('execution_result', onResult);
            
            // Создаем payload для запуска скрипта
            const runPayload: Payload = { 
                client_id: clientId, 
                script_content: scriptContent 
            };
            const signature = signPayload(runPayload);

            //const payloadJsonStr = JSON.stringify(runPayload); 
            //console.log("Client Payload String:", payloadJsonStr); // Строка
            //console.log("Client Signature:", signature); // Подпись
    

            
            const message: SignedMessage = { payload: runPayload, signature };
            
            // Отправляем команду на запуск
            socket.emit('run_script', message);
        });
    }, [clientId, isSocketConnected]);

    return { clientId, isLoading, error, runScript, isSocketConnected };
};