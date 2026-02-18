# Setup & Run (Ubuntu)

## Nginx + HTTPS

### API: api.code.fishrungames.com
- **Nginx** proxies `https://api.code.fishrungames.com` to the backend at `http://127.0.0.1:5000` (HTTP + WebSocket for Socket.IO).
- Config: `/etc/nginx/sites-enabled/api.code.fishrungames.com.conf` (template: `nginx-api.code.fishrungames.com.conf`).

### Frontend: code.fishrungames.com
- **Nginx** serves the built frontend (static files) at `https://code.fishrungames.com`.
- Document root: `/var/www/code.fishrungames.com` (copied from `client/python-compiler-client/dist`).
- Config: `/etc/nginx/sites-enabled/code.fishrungames.com.conf` (template: `nginx-code.fishrungames.com.conf`).

**Certbot** manages Let’s Encrypt for both domains; renewal is automatic via `certbot.timer`.

**To update the frontend after a new build:** ensure `client/python-compiler-client/.env` has `VITE_HMAC_SECRET_KEY` set to the same value as the backend `.env` key `HMAC_SECRET_KEY` (required for Socket.IO registration and run_script). Then:
```bash
cd client/python-compiler-client
npm run build
sudo cp -r dist/* /var/www/code.fishrungames.com/
sudo chown -R www-data:www-data /var/www/code.fishrungames.com
```

**To change Nginx config:** edit the template in the repo, then:
```bash
sudo cp nginx-<site>.conf /etc/nginx/sites-available/<site>.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## Installed

- **Python 3.12** – system
- **Node.js** (v20) – for React frontend (Vite 7)
- **Docker** – for running user Python code in containers
- **Python venv** at `.venv` with: `eventlet`, `flask`, `flask-socketio`, `python-dotenv`
- **Docker image** `telegram-sandbox-runner` (built from project `Dockerfile`)

## Run Python backend

```bash
cd /home/mephi1984/python-sandbox-server
.venv/bin/python launcher2.py
```

Server listens on **http://0.0.0.0:5000** (Socket.IO + Flask).

## Docker permissions (for code execution)

If the backend cannot run containers (permission denied on Docker socket), either:

1. **Add your user to the `docker` group** (then log out and back in):
   ```bash
   sudo usermod -aG docker $USER
   ```

2. **Or start Docker and run the backend with sudo** (not recommended long-term):
   ```bash
   sudo systemctl start docker
   sudo .venv/bin/python launcher2.py
   ```

## Run React frontend (optional)

```bash
cd client/python-compiler-client
npm install
npm run dev
```

Configure the client to point at your backend URL (see `src/config.ts`).
