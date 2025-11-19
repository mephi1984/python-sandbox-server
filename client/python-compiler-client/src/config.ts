// ВНИМАНИЕ: В ПРОД-среде этот ключ должен быть скрыт и использоваться 
// ТОЛЬКО на защищенном бэкенде. Здесь он используется для демонстрации HMAC.

export const HMAC_SECRET_KEY = import.meta.env.VITE_HMAC_SECRET_KEY || 'default_client_key';

// Чтение API URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const LOCAL_STORAGE_CLIENT_ID_KEY = 'sandbox_client_id';