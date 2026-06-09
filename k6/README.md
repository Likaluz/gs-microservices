# Smoke test k6

Com o ambiente rodando via Docker Compose:

```bash
docker compose run --rm k6
```

Configuracao exigida pelo case: `10 VUs / 10s`.

Resultado esperado: requisicoes `GET /api/alerts` retornando HTTP 200 pelo API Gateway.

Para salvar o resultado exigido na pasta `/k6`:

```bash
docker compose run --rm k6 > k6/result.txt
```

Opcionalmente, com k6 instalado localmente:

```bash
k6 run -e BASE_URL=http://localhost:8080 k6/smoke.js
```
