import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 🌟 Добавляем секцию server для настройки
  server: {
    // Привязка ко всем интерфейсам (эквивалент --host или 0.0.0.0)
    host: true, 
    // Запретить Vite использовать другой порт, если 5173 занят (опционально)
    strictPort: true, 
    // ❗ Разрешаем запрос с вашего домена
    hmr: {
        clientPort: 443 // Указываем порт 443 для HMR, если Vite запускается через HTTPS/Nginx
    },
    allowedHosts: [
      'code.fishrungames.com',
      // 'localhost', // опционально
      // '127.0.0.1', // опционально
    ]
  }
})