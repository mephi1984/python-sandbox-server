# Использование легковесного официального образа Python.
# Рекомендуется использовать slim-версии для меньшего размера.
FROM python:3.11-slim

# Установка python-telegram-bot и его зависимостей
RUN pip install --no-cache-dir python-telegram-bot requests

# Установка рабочей директории
WORKDIR /app

# Эта настройка позволяет запускать любой Python-скрипт, 
# который мы передадим при помощи 'docker run'
CMD ["python3"]

