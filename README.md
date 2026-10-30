# Roxy

**Roxy** é um aplicativo desktop de música para Windows, desenvolvido com Electron e integrado à rede Soulseek. Ele permite entrar com uma conta Soulseek, pesquisar arquivos de áudio compartilhados por outros usuários, baixar uma faixa e reproduzi-la no próprio player.

> O Roxy não mantém um catálogo próprio nem hospeda músicas. As buscas e transferências usam a rede Soulseek por meio do serviço slskd, que o aplicativo prepara automaticamente na primeira execução.

## O que esta versão faz

- Login com usuário e senha do Soulseek pela tela inicial.
- Opção **Manter conectado** para facilitar os próximos acessos.
- Preparação e inicialização automática do serviço slskd na primeira execução.
- Pesquisa de arquivos de áudio disponíveis na rede Soulseek.
- Exibição dos resultados e início de downloads pelo próprio player.
- Reprodução do arquivo depois que ele fica disponível no computador.
- Interface visual personalizada, com transparência, imagem de fundo e identidade própria do Roxy.
- Atalhos e controles de reprodução integrados à interface.

A disponibilidade dos resultados e a velocidade dos downloads dependem dos usuários e das conexões da rede Soulseek.

## Requisitos

- Windows 10 ou Windows 11 (64 bits).
- Node.js instalado (inclui npm) para executar a partir do código-fonte ou gerar o instalador.
- Conexão com a internet.
- Uma conta Soulseek.

Não é necessário instalar ou configurar o slskd manualmente: o Roxy foi preparado para baixar/configurar e iniciar o serviço durante a primeira execução.

## Executar o Roxy pelo código-fonte

1. Baixe o repositório pelo botão **Code → Download ZIP** e extraia o arquivo.
2. Abra a pasta do projeto, onde está o arquivo `package.json`.
3. Instale o Node.js caso ainda não esteja instalado: https://nodejs.org/
4. Dê dois cliques em `abrir-roxy.bat`.

O arquivo BAT verifica o Node.js, instala as dependências quando necessário e inicia o aplicativo.

Também é possível executar pelo terminal, aberto na pasta do projeto:

```powershell
npm install
npm start
```

Na primeira inicialização, aguarde o Roxy preparar o serviço necessário para a conexão com a rede. Se o Firewall do Windows solicitar permissão, permita o acesso para que a conexão funcione corretamente.

## Primeiro acesso

1. Abra o Roxy.
2. Na tela de login, informe seu usuário e sua senha do Soulseek.
3. Selecione **Manter conectado** se quiser facilitar os próximos acessos neste computador.
4. Aguarde a inicialização do serviço e a conexão.
5. Use a área de busca para procurar uma música.
6. Escolha um resultado para iniciar o download. Quando o arquivo estiver disponível localmente, o player poderá reproduzi-lo.

O botão **Sair** encerra a sessão salva e retorna à tela de login.

## Gerar o instalador do Windows

1. Instale o Node.js.
2. Abra a pasta do projeto.
3. Dê dois cliques em `gerar-instalador.bat`.

Ou execute no terminal:

```powershell
npm install
npm run dist
```

O Electron Builder gera o instalador na pasta `dist/`, com o nome no formato `Roxy Setup x.x.x.exe`. A configuração atual cria atalhos no Menu Iniciar e na Área de Trabalho.

## Como o aplicativo é organizado

```text
roxy/
├── main.js
├── preload.js
├── package.json
├── abrir-roxy.bat
├── gerar-instalador.bat
├── build/
│   ├── icon.ico
│   └── icon.png
└── renderer/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── login.html
    ├── login.css
    ├── login.js
    ├── background.jpg
    ├── login-photo.jpg
    ├── dance.webp
    ├── icon.png
    └── providers/
        └── soulseek.js
```

### Arquivos importantes

- `main.js`: processo principal do Electron; gerencia a janela, integração com o sistema e comunicação com o serviço Soulseek/slskd.
- `preload.js`: disponibiliza ao player apenas as funções necessárias do processo principal.
- `renderer/index.html`, `app.js` e `styles.css`: estrutura, comportamento e aparência da tela principal.
- `renderer/login.html`, `login.js` e `login.css`: tela de entrada e sua lógica visual.
- `renderer/providers/soulseek.js`: integração usada pelo player para pesquisar, acompanhar transferências e reproduzir arquivos da rede Soulseek.
- `renderer/background.jpg`: imagem de fundo da interface principal.
- `renderer/login-photo.jpg`: imagem da tela de login.
- `renderer/dance.webp`: animação exibida durante o carregamento/transferência.
- `renderer/icon.png`, `build/icon.png` e `build/icon.ico`: ícones da interface e do aplicativo/instalador.
- `abrir-roxy.bat`: instalação das dependências (quando necessário) e inicialização rápida.
- `gerar-instalador.bat`: preparação do ambiente e geração do instalador.

## Personalizar

Você pode substituir as imagens mantendo os mesmos nomes e formatos:

- Fundo do player: `renderer/background.jpg`.
- Foto da tela de login: `renderer/login-photo.jpg`.
- Animação: `renderer/dance.webp`.
- Ícone mostrado na interface: `renderer/icon.png`.
- Ícone do executável/instalador: `build/icon.ico` e `build/icon.png`.

Para alterar cores, transparência, espaçamentos e outros detalhes visuais, edite `renderer/styles.css`. Para alterar o comportamento do player, consulte `renderer/app.js` e o provedor em `renderer/providers/soulseek.js`.

## Origem dos serviços e tecnologias

- **Soulseek**: rede P2P utilizada para localizar e transferir arquivos compartilhados por seus usuários.
- **slskd**: serviço/cliente que faz a conexão com a rede Soulseek e oferece uma API local utilizada pelo Roxy. O aplicativo automatiza sua preparação para que o usuário não precise configurar tudo manualmente.
- **Electron**: tecnologia que permite construir o aplicativo desktop usando JavaScript, HTML e CSS.
- **electron-builder**: ferramenta usada para empacotar o Roxy em um instalador para Windows.

Projetos oficiais:
- Soulseek: https://www.slsknet.org/
- slskd: https://github.com/slskd/slskd
- Electron: https://www.electronjs.org/
- electron-builder: https://www.electron.build/

## Solução de problemas

- **O comando npm não é reconhecido:** instale o Node.js e abra um novo terminal.
- **O aplicativo não inicia:** execute `npm install` na pasta que contém `package.json` e tente `npm start` novamente.
- **O login ou a conexão falha:** confira usuário e senha Soulseek e verifique se o Firewall do Windows não está bloqueando o Roxy ou o serviço auxiliar.
- **A busca não retorna resultados:** tente outro termo de busca e confira sua conexão com a internet e o estado da conexão Soulseek.
- **O download não começa ou fica parado:** a transferência depende de o outro usuário estar online, permitir o envio e ter o arquivo disponível.

## Uso responsável

O Soulseek é uma rede de compartilhamento entre usuários. O Roxy é apenas uma interface cliente e não verifica os direitos autorais dos arquivos encontrados. Baixe, compartilhe e reproduza somente conteúdo que você tenha autorização para utilizar, respeitando as leis locais e os termos dos serviços envolvidos.

O Roxy é um projeto independente e não é afiliado oficialmente ao Soulseek ou ao slskd.
