/** @type {import('tailwindcss').Config} */
export default {
    content: [
    // ...
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- Это корректный путь для сканирования
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

