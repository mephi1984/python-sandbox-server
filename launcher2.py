import eventlet
eventlet.monkey_patch() # ❗ ЭТО ДОЛЖНО БЫТЬ САМОЕ ПЕРВОЕ
import subprocess
import shlex
import hmac
import hashlib
import json
import os
import threading
from flask import Flask, request # <--- Убедитесь, что 'request' здесь
from flask_socketio import SocketIO, emit, join_room, leave_room
from time import sleep
from dotenv import load_dotenv

load_dotenv()
# --- КОНФИГУРАЦИЯ БЕЗОПАСНОСТИ И DOCKER ---
IMAGE_NAME = "telegram-sandbox-runner"
CONTAINER_PREFIX = "sand_cli_" 

SECRET_KEY = os.getenv("HMAC_SECRET_KEY", "fallback_default_key0000000xxx@").encode('utf-8') 
if SECRET_KEY == b'fallback_default_key0000000xxx@':
    print("WARNING: Using default SECRET_KEY. Check your .env file!")

app = Flask(__name__)
# ВАЖНО: Указываем разрешенные домены для CORS, чтобы SocketIO работал
# Замените на домен вашего клиента
socketio = SocketIO(app, cors_allowed_origins="https://code.fishrungames.com") 

# --- ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ID (Для регистрации и сессии) ---
client_data = {
    "next_client_id": 1,
    "session_to_client_id": {}, # Сопоставление sid (SocketID) с client_id
    "registered_clients": {}     # ❗ ДОБАВИТЬ ЭТУ СТРОКУ
}

# --- HMAC ВАЛИДАЦИЯ (Без изменений) ---

def validate_hmac(data: dict, signature: str) -> bool:
    """Проверяет подпись сообщения, используя HMAC-SHA256."""
    # Для Socket.IO payload - это словарь, сериализуем его в компактную строку
    payload_json_str = json.dumps(
        data, 
        separators=(',', ':'),
        ensure_ascii=False 
    )
    data_bytes = payload_json_str.encode('utf-8')

    #print(f"Received data (Bytes): {data_bytes}")
    #print(f"Received signature: {signature}")


    expected_hmac = hmac.new(
        SECRET_KEY, 
        data_bytes, 
        hashlib.sha256
    ).hexdigest()

    #print(f"Expected signature: {expected_hmac}")

    
    return hmac.compare_digest(expected_hmac, signature)

# --- DOCKER СЕРВИС: ЗАПУСК И СТРИМИНГ ---

def execute_and_stream(sid, client_id, guest_script_content):
    """
    Упрощенная логика: удаляет старый контейнер, запускает новый асинхронно 
    и сразу начинает стриминг вывода (logs).
    """
    
    container_name = f"{CONTAINER_PREFIX}{client_id}"
    quoted_name = shlex.quote(container_name)
    quoted_script = shlex.quote(guest_script_content)

    code_filename = f"code_{client_id}.txt"
    try:
        with open(code_filename, 'w', encoding='utf-8') as f:
            f.write(guest_script_content)
        socketio.emit('output', {'data': f"[{container_name}] Код сохранен в {code_filename}"}, room=sid)
    except Exception as e:
        # Это не должно мешать основному процессу
        socketio.emit('output', {'data': f"[{container_name}] ❌ Ошибка сохранения кода: {e}"}, room=sid)

    # 1. Удаление существующего контейнера
    try:
        # Убедитесь, что -s удален (f - force)
        subprocess.run(f"docker rm -f {quoted_name}", shell=True, check=False)
        socketio.emit('output', {'data': f"[{container_name}] Старый контейнер удален (если существовал)."}, room=sid)
    except Exception:
        pass 

    # --- 2. Асинхронный запуск контейнера ---

    # Команда с -d (detach) и БЕЗ --rm (чтобы контейнер остался работать)
    async_docker_command = f"""
    docker run -d \
      --name={quoted_name} \
      --network=bridge \
      --read-only \
      --security-opt=no-new-privileges \
      {IMAGE_NAME} \
      python -c {quoted_script}
    """
    
    try:
        socketio.emit('output', {'data': f"[{container_name}] Запуск контейнера..."}, room=sid)
        
        # Запуск контейнера в фоне
        async_result = subprocess.run(
            async_docker_command,
            shell=True,
            check=True, # Ожидаем, что команда запуска вернет 0 (успешный старт)
            capture_output=True,
            text=True
        )
        container_id = async_result.stdout.strip()
        
        # 3. Немедленно запускаем стриминг логов в отдельном потоке
        # Вывод первого сообщения об успехе
        socketio.emit('output', {'data': f"✅ Контейнер запущен. ID: {container_id}"}, room=sid)
        socketio.emit('execution_result', {'status': 'success_async', 'code': 0, 'message': 'Скрипт запущен, вывод идет через "output".'}, room=sid)

        # Запуск стриминга
        socketio.start_background_task(target=stream_logs, sid=sid, container_name=container_name)
        
    except subprocess.CalledProcessError as e:
        # Критическая ошибка Docker: не смог запустить контейнер (недостаточно ресурсов, ошибка команды)
        socketio.emit('output', {'data': f"\n❌ Критическая ошибка Docker при запуске: {e.stderr.strip()}"}, room=sid)
        socketio.emit('execution_result', {'status': 'docker_error', 'code': e.returncode, 'message': 'Критическая ошибка Docker.'}, room=sid)


def stream_logs(sid: str, container_name: str):
    """Стриминг логов из контейнера в реальном времени."""
    try:
        # Используем 'docker logs -f' для стриминга. --since 0s для захвата всего с начала.
        log_process = subprocess.Popen(
            f"docker logs -f --since 0s {container_name}", 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,
            text=True
        )
        
        # Читаем вывод построчно и отправляем клиенту
        for line in log_process.stdout:
            # Проверяем наличие сессии, чтобы остановить стриминг после отключения клиента
            # (sid в client_data["session_to_client_id"] проверяется вне этой функции)
            if sid not in client_data["session_to_client_id"]:
                log_process.terminate()
                break
            
            # Отправляем строку вывода клиенту
            socketio.emit('output', {'data': line.strip()}, room=sid)
            
    except Exception as e:
        # Отправляем ошибку стриминга (если Docker logs упал)
        socketio.emit('output', {'data': f"❌ Ошибка стриминга логов: {e}"}, room=sid)

# --- ОБРАБОТЧИКИ SOCKET.IO ---

@socketio.on('connect')
def handle_connect():
    """Обработка нового соединения. Инициализация сессии."""
    # Клиент должен сам прислать событие 'register' с client_id, если он уже есть.
    print(f"Клиент подключился. SID: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """Обработка разрыва соединения."""
    if request.sid in client_data["session_to_client_id"]:
        client_id = client_data["session_to_client_id"][request.sid]
        print(f"Клиент {client_id} отключился.")
        # Удаляем привязку SID, чтобы остановить стриминг
        del client_data["session_to_client_id"][request.sid]

@socketio.on('register_client')
def handle_register(data):
    """
    Обработка регистрации клиента (новый или существующий ID).
    """
    global client_data
    
    # Сначала проверяем, есть ли HMAC подпись в данных
    signature = data.get('signature')
    payload = data.get('payload')
    
    if not signature or not payload or not validate_hmac(payload, signature):
        emit('registration_result', {'status': 'error', 'message': 'Invalid or missing HMAC signature'}, room=request.sid)
        return

    requested_id = payload.get('client_id')
    
    # 1. Если ID не передан или равен 0 (первое посещение)
    if not requested_id or requested_id == 0:
        new_id = client_data["next_client_id"]
        client_data["next_client_id"] += 1
        
        # Привязываем SID к новому client_id
        client_data["session_to_client_id"][request.sid] = new_id
        join_room(request.sid) # Присоединяем к комнате с его SID
        
        emit('registration_result', {'status': 'success', 'client_id': new_id}, room=request.sid)
        print(f"Новый клиент зарегистрирован: ID {new_id} ({request.sid})")
        
    # 2. Если ID передан (повторное посещение)
    elif requested_id in client_data["registered_clients"] or requested_id < client_data["next_client_id"]:
        client_data["session_to_client_id"][request.sid] = requested_id
        join_room(request.sid)
        client_data["registered_clients"][requested_id] = True # Обновляем статус
        
        emit('registration_result', {'status': 'success', 'client_id': requested_id}, room=request.sid)
        print(f"Существующий клиент восстановил сессию: ID {requested_id} ({request.sid})")

    else:
        emit('registration_result', {'status': 'error', 'message': 'Invalid client ID requested.'}, room=request.sid)


@socketio.on('run_script')
def handle_run_script(data):
    """
    Обработка команды на запуск скрипта.
    """
    # 1. Проверка сессии
    sid = request.sid
    if sid not in client_data["session_to_client_id"]:
        emit('execution_result', {'status': 'error', 'message': 'Client not registered or session expired.'}, room=sid)
        return
        
    client_id = client_data["session_to_client_id"][sid]
    
    # 2. Валидация HMAC
    signature = data.get('signature')
    payload = data.get('payload')
    
    if not signature or not payload or not validate_hmac(payload, signature):
        emit('execution_result', {'status': 'error', 'message': 'Invalid or missing HMAC signature'}, room=sid)
        return
        
    script_content = payload.get('script_content')
    if not script_content:
        emit('execution_result', {'status': 'error', 'message': 'Missing script_content.'}, room=sid)
        return

    emit('output', {'data': "--- Новый запуск скрипта ---\n"}, room=sid)
    
    # eventlet.spawn_after или просто запуск в отдельном потоке, 
    # который eventlet будет управлять (более чистый подход):
    socketio.start_background_task(
        target=execute_and_stream, 
        sid=sid, 
        client_id=client_id, 
        guest_script_content=script_content
    )

if __name__ == '__main__':
    # Flask-SocketIO по умолчанию запускает сервер разработки Werkzeug
    # В ПРОД-среде используйте Gunicorn или другой WSGI-сервер с gevent/eventlet
    print("Socket.IO сервер запущен...")
    socketio.run(app, host='0.0.0.0', port=5000)