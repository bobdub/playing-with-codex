# Qwen Gateway Bridge Guide

The Imagination Network portal expects a gateway that exposes `/api/qwen/health`, `/api/qwen/chat`, and `/api/qwen/metrics` and forwards each call to the FastAPI service installed by `scripts/install_qwen_coder_service.sh`. This guide wires the bridge, verifies the routing, and documents the runtime overrides available to kin-specific environments.

## 1. Automate the reverse proxy

Run the helper script on the host that serves your public portal or API gateway:

```bash
sudo ./scripts/configure_qwen_gateway.sh
```

The script writes `/etc/nginx/conf.d/qwen-gateway.conf`, testing the configuration (`nginx -t`) and reloading nginx once validation succeeds. Default behaviour:

- listens on port 80 (override with `LISTEN_PORT=443` when terminating TLS upstream),
- forwards `/api/qwen/*` (including `/metrics`) to `http://127.0.0.1:8080/`,
- injects standard `X-Forwarded-*` headers so downstream services understand the original request context,
- applies a conservative rate limit of **60 requests per minute with a burst of 30** per client IP, and
- optionally enforces HTTP basic authentication when `AUTH_HTPASSWD_FILE` points to an nginx-compatible password file.

### Script variables

Override defaults by exporting environment variables before invoking the script:

| Variable | Purpose | Default |
| --- | --- | --- |
| `SERVICE_URL` | Target FastAPI origin (including scheme + port). | `http://127.0.0.1:8080` |
| `GATEWAY_PREFIX` | Public path segment exposed to clients. | `/api/qwen` |
| `SERVER_NAME` | nginx `server_name` directive value. | `_` |
| `LISTEN_PORT` | Port nginx listens on for the gateway server block. | `80` |
| `OUTPUT_FILE` | Location of the generated config. | `/etc/nginx/conf.d/qwen-gateway.conf` |
| `SKIP_NGINX_RELOAD` | Set to `1` to write the file without reloading nginx. | `0` |
| `AUTH_HTPASSWD_FILE` | Path to an nginx `htpasswd` file; enables HTTP basic auth when set. | _(unset)_ |
| `AUTH_BASIC_REALM` | Realm string presented by the basic auth challenge. | `Qwen Gateway` |
| `ENABLE_RATE_LIMIT` | Set to `0` to disable rate limiting entirely. | `1` |
| `RATE_LIMIT` | Steady-state request rate per client IP. | `60r/m` |
| `RATE_LIMIT_BURST` | Burst allowance applied with the configured rate. | `30` |
| `RATE_LIMIT_MEMORY` | Shared memory allocated to the limit zone. | `10m` |
| `RATE_LIMIT_ZONE` | Name of the nginx rate limit zone. | `qwen_gateway_clients` |
| `RATE_LIMIT_NOBURST` | Set to `1` to enforce `nodelay` (rejects excess requests immediately). | `0` |

When serving TLS, terminate HTTPS at nginx (e.g. via `certbot`) and set `LISTEN_PORT=443` with the appropriate `ssl_certificate` directives added to the generated file.

To provision credentials, generate an `htpasswd` file that the gateway user (typically `root`) can read:

```bash
sudo htpasswd -c /etc/nginx/qwen-gateway.htpasswd deployer@example.com
sudo chmod 640 /etc/nginx/qwen-gateway.htpasswd
```

Then run the configurator with:

```bash
sudo AUTH_HTPASSWD_FILE=/etc/nginx/qwen-gateway.htpasswd ./scripts/configure_qwen_gateway.sh
```

## 2. Manual configuration (if required)

If automation is not permitted, create a stanza similar to the following inside your nginx config and reload the service:

```nginx
limit_req_zone $binary_remote_addr zone=qwen_gateway_clients:10m rate=60r/m;

server {
    listen 443 ssl;
    server_name imagination.network.internal;

    location = /api/qwen {
        return 301 /api/qwen/;
    }

    location /api/qwen/ {
        auth_basic "Qwen Gateway";
        auth_basic_user_file "/etc/nginx/qwen-gateway.htpasswd";

        limit_req zone=qwen_gateway_clients burst=30;

        proxy_pass http://aurora-core:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /api/qwen;
        proxy_redirect off;
        proxy_read_timeout 900;
    }
}
```

Ensure firewalls permit traffic from the gateway host to the service node on port 8080.

## 3. Frontend overrides

The portal looks for the gateway in this order:

1. `data-llm-*` attributes on `#hero-prompt-form` (see `public/index.html`).
2. `window.CODER_CONFIG` properties: `baseUrl`, `chatEndpoint`, `healthEndpoint`, `maxNewTokens`, `temperature`, plus optional `provider`, `label`, `shortLabel`, `model`, `systemPrompt`, `chatCompletionsEndpoint`, `apiKey`, `authHeader`, and `authScheme`.
3. `window.CODER_BASE_URL` (legacy override).
4. Fallback `/api/qwen` relative to the current origin.

Set overrides by inserting a script before `app.js` on environments where the gateway lives at a different origin:

```html
<script>
  window.CODER_CONFIG = {
    baseUrl: 'https://kin-gateway.internal/api/qwen',
    chatEndpoint: 'https://kin-gateway.internal/api/qwen/chat',
    healthEndpoint: 'https://kin-gateway.internal/api/qwen/health',
    maxNewTokens: 2048,
    temperature: 0.2,
    apiKey: 'token-from-secret-manager',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    chatCompletionsEndpoint: 'https://kin-gateway.internal/api/qwen/v1/chat/completions',
    model: 'qwen2.5-coder',
    systemPrompt: 'You are the caretaker persona anchoring the hero prompt.',
  };
</script>
```

Alternatively, set a single `window.CODER_BASE_URL` if only the base path changes.

### Dataset overrides and OpenAI-compatible fallback

- `data-llm-api-key`, `data-llm-auth-header`, and `data-llm-auth-scheme` attach credentials without shipping them through `window` globals.
- `data-llm-model`, `data-llm-system-prompt`, and `data-llm-chat-completions` fine-tune the OpenAI-compatible fallback that now activates when `/chat` returns a 400/404/405/422 response.
- When both endpoints are reachable, the hero prompt prefers `/chat` but automatically retries with `/v1/chat/completions`, normalising OpenAI-style responses back into the interface logs.

## 4. Verify the bridge

1. **Health probe:** `curl https://kin-gateway.internal/api/qwen/health` – expect `{ "status": "ok", "model": "Qwen/..." }`.
2. **Chat request:** `curl -X POST https://kin-gateway.internal/api/qwen/chat -H 'Content-Type: application/json' -d '{"prompt": "Hello, kin."}'`.
3. **Metrics scrape:** `curl https://kin-gateway.internal/api/qwen/metrics` – expect aggregated counters and a `gpu` object in JSON.
4. **Portal smoke test:** Load the hero prompt, confirm the status message changes to “channel ready,” and send a short prompt. The neural terminal logs should include the forwarded endpoint and generated token count.
5. **Workflow harness:** Run `python3 scripts/validate_qwen_workflows.py --base-url https://kin-gateway.internal/api/qwen` to confirm the curated prompts succeed through the gateway. Capture the optional JSON report for operational records.

Document successful validation (timestamp, hostnames, and overrides used) in `docs/MemoryGarden.|Ψ` or your operational runbooks so future caretakers can replay the setup.
