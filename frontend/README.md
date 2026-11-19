# EngajaDev: frontend

Tela de entrar e criar conta do EngajaDev. React + Vite.

## Como rodar

O backend precisa estar rodando (veja `../backend/README.md`).

```bash
cd frontend
npm install
npm run dev        # tela em http://localhost:5400
```

O Vite repassa as chamadas de `/api` para o backend em `http://localhost:4400`. Assim a tela e a API ficam no mesmo endereço e o cookie de sessão funciona sem configurar CORS.

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `ENGAJADEV_API` | `http://localhost:4400` | Endereço do backend |
| `WEB_PORT` | `5400` | Porta da tela |

## Build

```bash
npm run build      # gera frontend/dist
npm run preview    # serve o build em http://localhost:5400
```
