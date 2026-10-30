# Roxy

Player de música para Windows. A fonte é o Soulseek: o app busca e baixa as músicas e toca o arquivo baixado.

## Como usar

1. Abra o app (instalado ou pelo `abrir-roxy.bat`).
2. Na tela de login, entre com seu usuário e senha do Soulseek (se a conta não existir, ela é criada).
3. Na primeira vez o Roxy baixa e configura sozinho o motor de música (slskd). Se o Windows perguntar sobre o Firewall, clique em **Permitir acesso**.
4. Marcando "Manter conectado", nas próximas vezes ele entra direto. O botão **Sair** (no topo) volta para o login.

## Gerar o instalador (.exe)

Dê dois cliques em `gerar-instalador.bat`. O instalador `Roxy Setup x.x.x.exe` sai na pasta `dist/`. Ele instala o app normalmente e cria atalho na área de trabalho.

## Personalizar

- Foto da tela de login: troque `renderer/login-photo.jpg`.
- Imagem de fundo do app: `renderer/background.jpg` (ou o botão "Trocar fundo").
- Ícone do app: `build/icon.ico` e `build/icon.png` (o do cabeçalho é `renderer/icon.png`).
- Roxy dançando (aparece no lugar do ícone da música enquanto ela baixa): `renderer/dance.webp`.
- Atalho: barra de espaço toca/pausa.
