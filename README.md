# 🎬 Catálogo de Filmes e Séries

Uma aplicação web responsiva para buscar filmes e séries, ver detalhes, trailers e salvar favoritos. Projeto desenvolvido com HTML, CSS e JavaScript puro (Vanilla JS).

## 🚀 Funcionalidades Atendidas
- Busca de filmes e séries consumindo a API externa do TMDB em tempo real.
- Grid totalmente responsivo com abordagem Mobile-First.
- Modal detalhado contendo sinopse, nota, elenco principal, trailer oficial e onde assistir (streaming).
- Sistema de favoritos com persistência de dados via LocalStorage.
- Filtros por gênero e busca interna offline dentro da aba de favoritos (poupando requisições).
- Otimização de performance com cache em memória para gêneros e paginação com scroll infinito.

## 🛠️ Como Rodar o Projeto

1. Faça o clone deste repositório ou baixe o arquivo ZIP.
2. Configure a sua chave de acesso criando o arquivo `config.js` (siga o passo a passo na seção **🔒 Segurança** abaixo).
3. Abra o arquivo `index.html` diretamente no seu navegador. Não é necessário NodeJS ou configuração de servidor local.

## 🔒 Segurança (Configuração da API Key)

Por boas práticas de segurança da informação e para evitar o vazamento de credenciais, o arquivo que carrega as chaves de acesso foi adicionado ao **`.gitignore`** e não foi enviado para o repositório público. 

Para testar o projeto localmente, você precisa criar essa ponte manual:

1. Na raiz do projeto (mesma pasta onde está o **`index.html`**), crie um arquivo chamado **`config.js`**.
2. Abra esse novo arquivo e adicione a sua chave oficial do TMDB seguindo esta estrutura:
   ```javascript
   const API_KEY = 'SUA_CHAVE_AQUI';
