# Roxy Soulseek

Player de música para Windows com interface glassmorphism + Y2K, controles inspirados nos players dos anos 2000 e integração com a rede Soulseek por meio do **slskd**.

> O aplicativo não hospeda nem fornece um catálogo próprio. Ele pesquisa na rede Soulseek por meio do serviço local slskd, gerencia downloads e reproduz os arquivos disponíveis no computador.

## Recursos

- Pesquisa de músicas na rede Soulseek.
- Downloads gerenciados pelo slskd.
- Reprodução local após o download.
- Playlists locais.
- Interface transparente com visual glass/Y2K.
- Capa padrão para todas as faixas e fundo visual personalizado.
- Ícone próprio para o aplicativo.

## Requisitos

- Windows 10 ou 11 (64 bits).
- Node.js LTS e npm.
- Conexão com a internet.
- Conta Soulseek.
- slskd instalado e em execução para pesquisar e baixar músicas.

## Instalação rápida (Windows)

1. Clique em **Code → Download ZIP** e extraia o repositório.
2. Abra `app/1-configurar-slskd.bat` e siga as instruções para configurar sua conta Soulseek. O assistente prepara o slskd e cria uma chave de API local.
3. Mantenha o slskd em execução.
4. Abra `app/2-abrir-player.bat`.
5. No player, entre em **Conexão**, informe o endereço local do slskd e cole a chave de API criada pelo assistente. Clique em **Salvar e testar**.
6. Abra **Buscar**, procure uma faixa e selecione um resultado para iniciar o download.
7. A reprodução começa quando o arquivo estiver disponível localmente.

## Executar pelo código-fonte

Abra o terminal na pasta `app` e execute:

```powershell
npm install
npm start
```

Para gerar o instalador Windows e a versão portable:

```powershell
npm install
npm run dist
```

Os arquivos de distribuição são gerados em `app/dist/`.

## Origem das músicas e funcionamento

O **Soulseek** é uma rede P2P na qual usuários compartilham arquivos. O **slskd** é um cliente/serviço independente que se conecta a essa rede e disponibiliza uma API HTTP local. Por padrão, o player conversa com essa API em `http://localhost:5030`.

A integração do player fica em `app/renderer/providers/soulseek.js`. Ela envia pesquisas, consulta resultados, solicita downloads, acompanha transferências e reproduz os arquivos locais. A comunicação com o serviço é intermediada pelo processo principal e pelo preload do Electron.

Projetos externos:
- slskd: https://github.com/slskd/slskd
- Releases oficiais do slskd: https://github.com/slskd/slskd/releases
- Electron: https://www.electronjs.org/
- electron-builder: https://www.electron.build/

**Aviso:** Soulseek e slskd não são hospedados por este projeto. A disponibilidade, legitimidade, qualidade e velocidade dos arquivos dependem dos usuários da rede. Acesse e compartilhe apenas conteúdo que você tenha direito de usar e respeite as leis e os termos aplicáveis.

## Estrutura do projeto

```text
roxy-soulseek/
├── README.md
├── .gitignore
├── assets/
│   ├── app-icon.png
│   └── default-track-cover.jpg
├── docs/
│   ├── PROJECT-STRUCTURE.md
│   ├── SETUP-WINDOWS.md
│   ├── SOULSEEK-E-SLSKD.md
│   └── TROUBLESHOOTING.md
└── app/
    ├── main.js
    ├── preload.js
    ├── package.json
    ├── 1-configurar-slskd.bat
    ├── 2-abrir-player.bat
    ├── configurar-slskd.ps1
    ├── build/
    │   ├── icon.ico
    │   └── icon.png
    └── renderer/
        ├── index.html
        ├── styles.css
        ├── app.js
        ├── background.jpg
        ├── cover.jpg
        └── providers/
            └── soulseek.js
```

## Segurança

- Nunca publique sua senha Soulseek nem a chave de API do slskd.
- A chave criada pelo assistente é destinada ao uso local.
- Não exponha a API local do slskd diretamente à internet.
- Remova nomes de usuário, caminhos pessoais e tokens antes de compartilhar logs.

## Tecnologias

Electron · Node.js · npm · HTML · CSS · JavaScript · slskd HTTP API · Soulseek P2P · electron-builder

Este projeto não declara afiliação oficial com Soulseek ou slskd.
