# Tunel dev (frp) → dev.torweb.pl / api.torweb.pl

`npm run dev` w głównym folderze odpala jednocześnie:

| proces   | port lokalny | publiczny URL            |
|----------|--------------|--------------------------|
| backend  | `0.0.0.0:3000` | https://api.torweb.pl   |
| frontend | `127.0.0.1:5173` | https://dev.torweb.pl |
| tunnel   | frpc → frps    | (łączy powyższe)       |

## Jak to działa

- **frpc.exe** (ten folder) łączy się z **frps** na serwerze `matury` (`3.68.187.152:7000`).
- frps ma `vhostHTTPPort = 8080`; nginx na serwerze terminuje SSL i proxuje
  `dev.torweb.pl` oraz `api.torweb.pl` → `127.0.0.1:8080` (Host zachowany).
- frps trasuje po nagłówku `Host`:
  - `dev.torweb.pl` → lokalny Vite `127.0.0.1:5173`
  - `api.torweb.pl` → lokalny backend `127.0.0.1:3000`
- Frontend woła backend przez relatywne `/api`, które Vite proxuje na `localhost:3000`
  (patrz `frontend/vite.config.ts`). Dlatego strona pod `dev.torweb.pl` działa w pełni
  sama — `api.torweb.pl` to dodatkowy, bezpośredni dostęp do API.

## Ważne / pułapki

- **Vite musi słuchać na IPv4** (`host: "127.0.0.1"` w `vite.config.ts`). Domyślnie Vite
  bindował tylko IPv6 `::1`, przez co frpc (dialuje `127.0.0.1`) dostawał „connection refused".
- `frpc.exe` bywa fałszywie flagowany przez Windows Defender (PUP, typowe dla frp).
  Dodano wyjątek na ten folder. Re-instalacja: uruchom `setup.ps1` jako administrator.
- `frpc.toml` zawiera token frps i **nie jest commitowany** (jest w `.gitignore`).
  Wzorzec bez tokenu: `frpc.toml.example`.

## Skrypty npm (root)

- `npm run dev`        – backend + frontend + tunel (to, czego zwykle chcesz)
- `npm run dev:local`  – tylko backend + frontend, bez tunelu
- `npm run dev:tunnel` – sam frpc
