# TvFácil

Aplicação Windows de IPTV pensada para pessoas mais velhas: botões grandes, contraste alto e poucos passos até ao ecrã cheio.

**Idioma:** português de Portugal  
**Âmbito v1:** canais em direto (sem VOD / EPG)

## Requisitos

- Node.js 20+ (recomendado 22)
- npm 10+
- Windows 10/11 para a experiência alvo (desenvolvimento também funciona em macOS/Linux)

## Arranque em desenvolvimento

```bash
cd tvfacil
npm install
npm run electron:dev
```

Isto inicia o Vite e abre a janela Electron. No ecrã inicial pode:

1. **Entrar com conta Xtream** — servidor, utilizador e palavra-passe  
2. **Abrir lista M3U** — URL ou ficheiro `.m3u` / `.m3u8`  
3. **Ver demonstração** — canais de teste com streams públicas HLS

### Só o frontend no browser (sem Electron)

```bash
npm run dev
```

Neste modo a persistência usa `localStorage` (em Electron usa `safeStorage` do sistema). A escolha de ficheiro M3U local precisa do Electron.

## Build Windows

```bash
npm run electron:build
```

O instalador NSIS fica em `tvfacil/release/`.

## O que é real vs mock

| Funcionalidade | Estado |
| --- | --- |
| UI PT-PT (login, grelha, player, qualidade, banner de lag) | Real |
| Parse M3U (`#EXTINF`, `tvg-logo`, `group-title`) | Real |
| API Xtream Codes (auth + live streams + categorias + logos) | Real (precisa de painel acessível) |
| Leitura de ficheiro M3U local | Real (via diálogo Electron) |
| Persistência de login | Real (`safeStorage` no Electron; fallback base64 se não houver keyring) |
| Demonstração | Mock — streams HLS públicas de teste |
| Qualidade (4 níveis) | Real no player (ABR / nível HLS); se só houver 1 URL, ajusta buffer/ABR |
| Banner “Usar qualidade mais estável” | Real (detecção por buffering / erros fatais) |
| VOD / EPG | Fora de v1 |

## Estrutura

```
tvfacil/
  electron/     # processo principal + preload
  src/          # React (ecrãs, player, Xtream/M3U)
  README.md
```

## Notas de segurança

- Credenciais **não** são escritas em logs.
- Em Windows/macOS com keyring, o Electron encripta com `safeStorage`.
- A app reproduz apenas streams que o utilizador configurar; não inclui fontes de conteúdo.
