import subprocess
import shlex
import hmac
import hashlib
import json
import os
from flask import Flask, request, jsonify

# --- КОНФИГУРАЦИЯ БЕЗОПАСНОСТИ И DOCKER ---
SECRET_KEY = ""
IMAGE_NAME = "telegram-sandbox-runner"
CONTAINER_PREFIX = "sand_cli_" # Префикс для имени контейнера, например, sand_cli_1, sand_cli_2
QUICK_CHECK_TIMEOUT = 3

app = Flask(__name__)

# --- ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ID ---
# В ПРОД-среде это должно быть заменено на базу данных (Redis/PostgreSQL) 
# для обеспечения персистентности и потокобезопасности.
client_data = {
    "next_client_id": 1,
    "registered_clients": {} # Здесь можно хранить доп. информацию о клиентах, если нужно
}

def run_sandboxed_script(client_id: int, guest_script_content: str):
    """
    Удаляет старый контейнер, запускает новый скрипт в два этапа.
    """
    
    container_name = f"{CONTAINER_PREFIX}{client_id}"
    quoted_name = shlex.quote(container_name)
    quoted_script = shlex.quote(guest_script_content)
    
    # --- 1. Удаление существующего контейнера (для очистки старого бота) ---
    try:
        subprocess.run(
            f"docker rm -f -s {quoted_name}", 
            shell=True, 
            check=False,
            capture_output=True
        )
        print(f"[{container_name}] Старый контейнер (если существовал) удален.")
    except Exception as e:
        print(f"[{container_name}] Ошибка при удалении старого контейнера: {e}")

    # --- 2. Синхронная проверка на ошибки запуска ---
    
    # Команда БЕЗ --detach. Обратите внимание: флаг --rm здесь есть.
    sync_docker_command = f"""
    docker run --rm \
      --name={quoted_name} \
      --network=bridge \
      --read-only \
      --security-opt=no-new-privileges \
      {IMAGE_NAME} \
      python -c {quoted_script}
    """
    
    try:
        print(f"[{container_name}] Запуск синхронной проверки (Таймаут: {QUICK_CHECK_TIMEOUT}s)...")
        sync_result = subprocess.run(
            sync_docker_command,
            shell=True,
            check=False,
            capture_output=True,
            text=True,
            timeout=QUICK_CHECK_TIMEOUT
        )
        
        # ... (логика успеха/ошибки < 3s остается прежней)
        if sync_result.returncode == 0:
            return {
                "status": "success_quick", 
                "message": "Скрипт выполнен менее чем за 3 секунды.",
                "return_code": 0,
                "stdout": sync_result.stdout.strip(),
                "stderr": sync_result.stderr.strip()
            }
        
        if sync_result.returncode != 0:
            return {
                "status": "runtime_error", 
                "message": "Ошибка во время быстрого запуска скрипта. Проверьте stderr.",
                "return_code": sync_result.returncode,
                "stdout": sync_result.stdout.strip(),
                "stderr": sync_result.stderr.strip()
            }
            
    except subprocess.TimeoutExpired:
        # ❗ ИСПРАВЛЕНИЕ КОНФЛИКТА ИМЕН: 
        # Если произошел таймаут, контейнер остался висеть, несмотря на --rm.
        # Мы должны принудительно его удалить, чтобы освободить имя для Этапа 3.
        print(f"[{container_name}] Таймаут проверки. Принудительное удаление временного контейнера.")
        try:
             # Остановить и удалить контейнер, запущенный в sync_docker_command
            subprocess.run(
                f"docker rm -f {quoted_name}", 
                shell=True, 
                check=True,
                capture_output=True
            )
        except Exception as remove_err:
            print(f"[{container_name}] Ошибка при удалении временного контейнера после таймаута: {remove_err}")
            # Мы можем проигнорировать эту ошибку, так как она не критична для логики.
        
        pass # Игнорируем TimeoutExpired и переходим к асинхронному запуску.
        
    except Exception as e:
        # ... (обработка других ошибок Docker)
        return {
            "status": "docker_error",
            "message": f"Критическая ошибка Docker во время синхронной проверки: {e}",
            "return_code": 1,
            "stdout": "",
            "stderr": str(e)
        }

    # --- 3. Асинхронный запуск --- (Переходит сюда только после таймаута)
    
    # Команда С --detach (d) и БЕЗ --rm (чтобы контейнер остался работать)
    # ... (код асинхронного запуска остается прежним)
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
        print(f"[{container_name}] Запуск асинхронного контейнера (Bot) в фоне...")
        async_result = subprocess.run(
            async_docker_command,
            shell=True,
            check=True, 
            capture_output=True,
            text=True
        )
        container_id = async_result.stdout.strip()
        
        # Возвращаем успешный результат, не дожидаясь завершения
        return {
            "status": "success_async",
            "message": f"Скрипт (бот) запущен в фоновом режиме.",
            "container_id": container_id,
            "return_code": 0,
            "stdout": f"Container ID: {container_id}",
            "stderr": ""
        }

    except subprocess.CalledProcessError as e:
        # ... (обработка ошибок создания контейнера остается прежней)
        return {
            "status": "docker_error",
            "message": f"Ошибка создания фонового контейнера: {e.stderr.strip()}",
            "return_code": e.returncode,
            "stdout": "",
            "stderr": e.stderr.strip()
        }

# --- HMAC ВАЛИДАЦИЯ (Без изменений) ---

def validate_hmac(data: bytes, signature: str) -> bool:
    """Проверяет подпись сообщения, используя HMAC-SHA256."""

    print(f"Received data (Bytes): {data}")
    print(f"Received signature: {signature}")

    expected_hmac = hmac.new(
        SECRET_KEY, 
        data, 
        hashlib.sha256
    ).hexdigest()

    print(f"Expected signature: {expected_hmac}")

    return hmac.compare_digest(expected_hmac, signature)


# --- API ENDPOINTS ---

@app.route('/register', methods=['POST'])
def register_client():
    """
    Выдает новый, инкрементальный Client ID.
    """
    # Так как этот endpoint не требует данных для регистрации, 
    # мы можем обойтись без проверки HMAC, но для повышения безопасности 
    # рекомендуется ее добавить, проверяя, например, пустой JSON-объект.
    
    global client_data
    
    # ❗ Внимание: в многопоточной среде требуется блокировка (lock)
    # для безопасного инкремента. В Flask, работающем с Gunicorn/WSGI,
    # это может стать проблемой, но для тестового примера оставим так.
    
    new_id = client_data["next_client_id"]
    client_data["next_client_id"] += 1
    
    # Регистрация клиента (если требуется хранить доп. данные)
    client_data["registered_clients"][new_id] = {"last_seen": None}
    
    return jsonify({
        "status": "success",
        "message": "Client registered successfully.",
        "client_id": new_id
    }), 200


@app.route('/run_script', methods=['POST'])
def run_script_endpoint():
    """
    Основной Endpoint для запуска скриптов в песочнице с использованием Client ID.
    """
    data = request.get_data()
    signature = request.headers.get('X-Script-Signature')

    # 1. Валидация HMAC подписи
    if not signature or not validate_hmac(data, signature):
        return jsonify({"status": "error", "message": "Invalid or missing HMAC signature"}), 403

    # 2. Десериализация данных
    try:
        payload = json.loads(data)
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": "Invalid JSON payload"}), 400

    # 3. Получение и проверка Client ID
    client_id = payload.get('client_id')
    script_content = payload.get('script_content')

    if not isinstance(client_id, int) or client_id <= 0:
        return jsonify({"status": "error", "message": "Missing or invalid 'client_id'. Please register first."}), 400
    
    if client_id not in client_data["registered_clients"]:
        return jsonify({"status": "error", "message": f"Client ID {client_id} is not registered."}), 403

    if not script_content:
        return jsonify({"status": "error", "message": "Missing 'script_content'"}), 400

    result = run_sandboxed_script(client_id, script_content)
    
    # 5. Возвращаем результат
    return jsonify(result), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)