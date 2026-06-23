/* ==========================================================
   1. SELEÇÃO DE ELEMENTOS DO DOM E VARIÁVEIS
========================================================== */
const formBusca = document.getElementById('form-busca');
const inputBusca = document.getElementById('input-busca');
const tipoBusca = document.getElementById('tipo-busca'); 
const filtroGenero = document.getElementById('filtro-genero'); 
const gridFilmes = document.getElementById('grid-filmes');
const tituloSecao = document.getElementById('titulo-secao');
const btnFavoritos = document.getElementById('nav-favoritos');
const btnHome = document.getElementById('nav-home');

const modal = document.getElementById('modal-detalhes');
const modalCorpo = document.getElementById('modal-corpo');
const btnFecharModal = document.getElementById('fechar-modal');

let paginaAtual = 1;
let carregando = false;
let temMaisResultados = true;
let termoAtual = '';
let generoAtual = ''; 
let tipoAtual = 'movie'; 
let modoAtual = 'home';

window.filmesCache = {};
window.generosCache = {}; // 🌟 NOVO: Cache em memória para os gêneros

// Função para preencher dinamicamente a caixa de géneros (COM CACHE)
async function carregarGeneros() {
    const tipo = tipoBusca.value;
    
    // Se o tipo selecionado ainda não estiver no cache, consome a API e guarda o resultado
    if (!window.generosCache[tipo]) {
        console.log(`Gêneros de '${tipo}' não encontrados no cache. Buscando na API...`);
        window.generosCache[tipo] = await buscarGeneros(tipo);
    } else {
        console.log(`Gêneros de '${tipo}' carregados diretamente do cache! Poupando a API.`);
    }

    const generos = window.generosCache[tipo] || [];
    
    filtroGenero.innerHTML = '<option value="">Todos os Géneros</option>';
    generos.forEach(g => {
        filtroGenero.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
}

/* ==========================================================
   2. SISTEMA DE PESQUISA (COMPLETO: SPAM PROTECT + OFFLINE + SPINNER)
========================================================== */
formBusca.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const novoTermo = inputBusca.value.trim().toLowerCase();
    const novoGenero = filtroGenero.value;
    const tipo = tipoBusca.value;

    // 🌟 1. DESVIO DE ROTA: BUSCA OFFLINE NOS FAVORITOS
    if (modoAtual === 'favoritos') {
        console.log("Modo Favoritos: Fazendo busca offline sem gastar API!");
        
        // CORREÇÃO: Usar a função oficial que já sabe como ler os seus favoritos corretamente
        let favoritosFiltrados = [];
        if (typeof obterFavoritos === 'function') {
            favoritosFiltrados = obterFavoritos();
        } else {
            // Prevenção extra
            const guardados = JSON.parse(localStorage.getItem('favoritos')) || [];
            favoritosFiltrados = guardados.length > 0 && typeof guardados[0] === 'object' 
                ? guardados 
                : guardados.map(id => window.filmesCache[id]).filter(f => f);
        }

        // Filtra pelo texto (Nome do filme/série)
        if (novoTermo) {
            favoritosFiltrados = favoritosFiltrados.filter(filme => {
                const titulo = (filme.title || filme.name || "").toLowerCase();
                return titulo.includes(novoTermo);
            });
        }

        // Filtra pelo género (se selecionado)
        if (novoGenero) {
            favoritosFiltrados = favoritosFiltrados.filter(filme => 
                filme.genre_ids && filme.genre_ids.includes(parseInt(novoGenero))
            );
        }

        tituloSecao.textContent = `Favoritos encontrados: ${favoritosFiltrados.length}`;
        renderizarGrid(favoritosFiltrados, false, 'movie'); 
        return; // Encerra aqui, não chama a API!
    }

    // 🛡️ 2. PROTEÇÃO DE API: IMPEDE BUSCAS REPETIDAS (Agora checa o TIPO também!)
    if (novoTermo === termoAtual.toLowerCase() && novoGenero === generoAtual && tipo === tipoAtual && modoAtual === 'busca') {
        console.log("Busca repetida evitada. Poupando a API!"); 
        return; 
    }

    // 3. ATUALIZA AS VARIÁVEIS OFICIAIS
    termoAtual = novoTermo;
    generoAtual = novoGenero;
    tipoAtual = tipo; // 🌟 NOVO: Salva o tipo para a próxima comparação
    // 3. ATUALIZA AS VARIÁVEIS OFICIAIS
    termoAtual = novoTermo;
    generoAtual = novoGenero;

    // Se o utilizador limpou tudo e clicou em buscar, volta para a Home
    if (!termoAtual && !generoAtual) {
        carregarHome();
        return;
    }

    // ⏳ 4. PREPARA A INTERFACE (SPINNER E DISABLED)
    const btnSubmit = formBusca.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Aguarde...';
    
    carregando = true; // Trava o menu de navegação
    modoAtual = 'busca';
    paginaAtual = 1;
    temMaisResultados = true;
    
    if (termoAtual) {
        tituloSecao.textContent = `Resultados para: "${termoAtual}"`;
    } else {
        const nomeGenero = filtroGenero.options[filtroGenero.selectedIndex]?.text || 'Gênero';
        tituloSecao.textContent = `A Explorar: ${nomeGenero} (${tipo === 'movie' ? 'Filmes' : 'Séries'})`;
    }
    
    gridFilmes.style.display = 'block'; 
    gridFilmes.className = '';
    gridFilmes.innerHTML = '<div class="spinner"></div><p style="text-align:center; color:#888;">Buscando no banco de dados...</p>';
    
    // 🌐 5. CHAMADA À API
    let resultados = [];
    try {
        if (termoAtual) {
            resultados = await buscarPorNome(termoAtual, tipo, paginaAtual);
            // Filtro local pelo género caso o utilizador tenha pesquisado nome + género
            if (generoAtual) {
                resultados = resultados.filter(f => f.genre_ids && f.genre_ids.includes(parseInt(generoAtual)));
            }
        } else {
            resultados = await buscarPorGenero(generoAtual, tipo, paginaAtual);
        }
    } catch (erro) {
        console.error("Erro ao buscar dados:", erro);
        gridFilmes.innerHTML = '<p style="text-align:center; color:red;">Ocorreu um erro na busca.</p>';
    }
    
    // 🎨 6. RENDERIZAÇÃO
    gridFilmes.style.display = 'grid'; 
    gridFilmes.className = 'movie-grid';

    if (resultados && resultados.length > 0) {
        // Ordena por popularidade ou nota antes de mostrar
        resultados.sort((a, b) => (b.popularity - a.popularity) || (b.vote_average - a.vote_average));
        
        // Guarda na memória cache para a aba de favoritos poder usar depois
        resultados.forEach(f => window.filmesCache[f.id] = f);
        
        renderizarGrid(resultados, false, tipo);
    } else {
        temMaisResultados = false;
        renderizarGrid([], false, tipo);
    }

    // 🔓 7. LIBERTAÇÃO DOS BOTÕES
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Pesquisar';
    carregando = false; // Liberta o menu de navegação
});


/* ==========================================================
   EVENTOS DE NAVEGAÇÃO BLINDADOS
========================================================== */

btnHome.addEventListener('click', () => {
    // Proteção de redundância
    if (modoAtual === 'home') {
        console.log("Já estamos na Home. Evitando requisições duplas!");
        return; 
    }

    // Proteção de travamento (Se estiver no meio de uma busca)
    if (carregando) {
        console.log("Aguarde a operação atual terminar.");
        return;
    }

    filtroGenero.value = ''; 
    inputBusca.value = '';   
    carregarHome();
});

btnFavoritos.addEventListener('click', () => {
    // Proteção de redundância
    if (modoAtual === 'favoritos') {
        console.log("Já estamos nos Favoritos. Evitando re-renderização!");
        return;
    }

    // Proteção de travamento (Se estiver no meio de uma busca)
    if (carregando) {
        console.log("Aguarde a operação atual terminar.");
        return;
    }

    mostrarFavoritos();
});

/* ==========================================================
   3. SENSOR DE SCROLL INFINITO (COM SUPORTE A GÉNEROS)
========================================================== */
window.addEventListener('scroll', () => {
    if (modoAtual !== 'busca' || carregando || !temMaisResultados) return;

    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 150) {
        carregarMaisResultados();
    }
});

async function carregarMaisResultados() {
    carregando = true;
    paginaAtual++;
    const tipo = tipoBusca.value;
    
    const indicador = document.createElement('p');
    indicador.id = 'loading-infinito';
    indicador.textContent = 'A carregar mais resultados...';
    gridFilmes.appendChild(indicador);

    let novosResultados = [];
    
    if (termoAtual) {
        novosResultados = await buscarPorNome(termoAtual, tipo, paginaAtual);
        if (generoAtual) {
            novosResultados = novosResultados.filter(f => f.genre_ids && f.genre_ids.includes(parseInt(generoAtual)));
        }
    } else {
        novosResultados = await buscarPorGenero(generoAtual, tipo, paginaAtual);
    }
    
    const indElement = document.getElementById('loading-infinito');
    if (indElement) indElement.remove();

    if (!novosResultados || novosResultados.length === 0) {
        temMaisResultados = false;
        carregando = false;
        return;
    }

    novosResultados.sort((a, b) => (b.popularity - a.popularity) || (b.vote_average - a.vote_average));
    novosResultados.forEach(f => window.filmesCache[f.id] = f);
    
    renderizarGrid(novosResultados, true, tipo); 
    carregando = false;
}

/* ==========================================================
   4. CARREGAR HOME PAGE (CARROSÉIS PROTEGIDOS E MODERNOS)
========================================================== */
async function carregarHome() {
    modoAtual = 'home';
    tituloSecao.textContent = "Destaques do Momento";
    inputBusca.value = '';
    
    gridFilmes.style.display = 'block'; 
    gridFilmes.className = '';
    
    // Injeção do novo HTML do carrossel (Wrapper + Botões)
    gridFilmes.innerHTML = `
        <div class="secao-carrossel">
            <h3>🎬 Filmes Populares</h3>
            <div class="carrossel-wrapper">
                <button class="btn-carrossel btn-prev hidden" aria-label="Voltar filmes">◀</button>
                <div class="carrossel" id="carrossel-filmes"><p style="padding:20px;">Carregando filmes...</p></div>
                <button class="btn-carrossel btn-next hidden" aria-label="Avançar filmes">▶</button>
            </div>
        </div>
        <div class="secao-carrossel">
            <h3>📺 Séries Populares</h3>
            <div class="carrossel-wrapper">
                <button class="btn-carrossel btn-prev hidden" aria-label="Voltar séries">◀</button>
                <div class="carrossel" id="carrossel-series"><p style="padding:20px;">Carregando séries...</p></div>
                <button class="btn-carrossel btn-next hidden" aria-label="Avançar séries">▶</button>
            </div>
        </div>
    `;

    const [filmes, series] = await Promise.all([
        buscarPopulares('movie'),
        buscarPopulares('tv')
    ]);

    // Renderização de Filmes
    try {
        const containerFilmes = document.getElementById('carrossel-filmes');
        if (filmes && filmes.length > 0) {
            filmes.forEach(f => window.filmesCache[f.id] = f);
            containerFilmes.innerHTML = '';
            filmes.forEach(f => containerFilmes.innerHTML += criarCardHTML(f, 'movie'));
            configurarBotoesCarrossel(containerFilmes); // Ativa o motor do carrossel
        } else {
            containerFilmes.innerHTML = '<p style="padding:10px; color:#888;">Nenhum filme encontrado.</p>';
        }
    } catch (erro) {
        console.error("Erro ao renderizar filmes:", erro);
    }

    // Renderização de Séries
    try {
        const containerSeries = document.getElementById('carrossel-series');
        if (series && series.length > 0) {
            series.forEach(s => window.filmesCache[s.id] = s);
            containerSeries.innerHTML = '';
            series.forEach(s => containerSeries.innerHTML += criarCardHTML(s, 'tv'));
            configurarBotoesCarrossel(containerSeries); // Ativa o motor do carrossel
        } else {
            containerSeries.innerHTML = '<p style="padding:10px; color:#888;">Nenhuma série encontrada.</p>';
        }
    } catch (erro) {
        console.error("Erro ao renderizar séries:", erro);
    }
}

/* ==========================================================
   LÓGICA INTELIGENTE DOS BOTÕES DO CARROSSEL
========================================================== */
function configurarBotoesCarrossel(carrossel) {
    const wrapper = carrossel.parentElement;
    const btnPrev = wrapper.querySelector('.btn-prev');
    const btnNext = wrapper.querySelector('.btn-next');

    if (!btnPrev || !btnNext) return;

    // Calcula e atualiza a visibilidade dos botões
    const atualizarBotoes = () => {
        const scrollLeft = carrossel.scrollLeft;
        const maxScroll = carrossel.scrollWidth - carrossel.clientWidth;
        
        // Botão Esquerdo
        if (scrollLeft <= 5) {
            btnPrev.classList.add('hidden');
        } else {
            btnPrev.classList.remove('hidden');
        }

        // Botão Direito
        if (scrollLeft >= maxScroll - 5) { // margem de 5px para prevenir bugs
            btnNext.classList.add('hidden');
        } else {
            btnNext.classList.remove('hidden');
        }
    };

    // Escutadores de eventos para o botão atualizar sozinho
    carrossel.addEventListener('scroll', atualizarBotoes);
    window.addEventListener('resize', atualizarBotoes);
    
    // Roda uma vez no início para checar o estado atual
    setTimeout(atualizarBotoes, 100); 

    // Ação do Botão VOLTAR
    btnPrev.addEventListener('click', () => {
        // Rola 80% da tela visível para dar a sensação de avançar "uma página", deixando 1 card de contexto
        const scrollAmount = carrossel.clientWidth * 0.8; 
        carrossel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    // Ação do Botão AVANÇAR
    btnNext.addEventListener('click', () => {
        const scrollAmount = carrossel.clientWidth * 0.8; 
        carrossel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
}

/* ==========================================================
   5. AUXILIARES DE RENDERIZAÇÃO
========================================================== */
function criarCardHTML(filme, tipo) {
    const titulo = filme.title || filme.name || "Sem título"; 
    const poster = filme.poster_path 
        ? `https://image.tmdb.org/t/p/w500${filme.poster_path}` 
        : 'https://via.placeholder.com/500x750?text=Sem+Imagem';
    
    let favoritado = false;
    if (typeof eFavorito === 'function') {
        favoritado = eFavorito(filme.id);
    }
    
    const textoBotao = favoritado ? 'Remover' : '⭐ Favoritar';
    const nota = filme.vote_average ? filme.vote_average.toFixed(1) : 'N/A';
    
    // NOVIDADE: Já carrega o botão com a cor certa se estiver nos favoritos
    const classeExtra = favoritado ? 'btn-remover' : '';

    return `
        <div class="card" onclick="window.abrirModal('${filme.id}', '${tipo}')">
            <img src="${poster}" alt="${titulo}" loading="lazy">
            <h3>${titulo}</h3>
            <p>⭐ ${nota}/10</p>
            <button class="${classeExtra}" onclick="event.stopPropagation(); window.lidarComFavoritoNoId('${filme.id}', '${tipo}', this)">
                ${textoBotao}
            </button>
        </div>
    `;
}

function renderizarGrid(filmes, append = false, tipoPadrao = 'movie') {
    if (!append) gridFilmes.innerHTML = '';
    
    if (!filmes || (filmes.length === 0 && !append)) {
        gridFilmes.innerHTML = `
            <div style="text-align: center; grid-column: 1 / -1; padding: 20px;">
                <p>😕 Nenhum resultado encontrado.</p>
            </div>
        `;
        return;
    }

    filmes.forEach(filme => {
        const tipoDinamico = filme.title ? 'movie' : 'tv';
        gridFilmes.innerHTML += criarCardHTML(filme, tipoDinamico);
    });
}

/* ==========================================================
   6. MODAL INTELIGENTE
========================================================== */
window.abrirModal = async function(id, tipo) {
    modalCorpo.innerHTML = '<p style="text-align:center; padding:50px; color:#b5b5b5;">Carregando dados...</p>';
    modal.classList.add('show');

    const filmeBase = window.filmesCache[id] || {};
    let dados = null;

    try {
        dados = await buscarDetalhes(id, tipo);
    } catch (erro) {
        console.warn("Falha ao obter dados detalhados da API.", erro);
    }

    const titulo = dados?.title || dados?.name || filmeBase.title || filmeBase.name || "Sem título";
    const sinopse = dados?.overview || filmeBase.overview || "Nenhuma sinopse disponível.";
    const notaNum = dados?.vote_average ?? filmeBase.vote_average;
    const nota = (notaNum && typeof notaNum === 'number') ? notaNum.toFixed(1) : 'N/A';
    const dataRaw = dados?.release_date || dados?.first_air_date || filmeBase.release_date || filmeBase.first_air_date || '----';
    const ano = dataRaw.split('-')[0];
    
    const posterPath = dados?.poster_path || filmeBase.poster_path;
    const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/500x750?text=Sem+Imagem';

    let duracao = 'N/D';
    let infoTv = ''; 
    if (tipo === 'movie') {
        if (dados?.runtime) duracao = `${dados.runtime} min`;
    } else if (tipo === 'tv') {
        if (dados?.episode_run_time?.length > 0) duracao = `${dados.episode_run_time[0]} min por ep`;
        if (dados?.number_of_seasons || dados?.number_of_episodes) {
            infoTv = `<span>📺 ${dados.number_of_seasons || '?'} Temp. (${dados.number_of_episodes || '?'} Eps)</span>`;
        }
    }

    const generos = dados?.genres?.length > 0 ? dados.genres.map(g => g.name).join(', ') : 'Gêneros n/d';

    // Onde Assistir (Streaming) com links clicáveis
    let htmlStreaming = '<p style="font-size:13px; color:#888;">Não disponível por assinatura no momento.</p>';
    
    if (dados && dados['watch/providers'] && dados['watch/providers'].results) {
        // Tenta pegar os provedores do Brasil (BR), se não tiver tenta Portugal (PT)
        const provedoresRegiao = dados['watch/providers'].results.BR || dados['watch/providers'].results.PT;
        
        if (provedoresRegiao && provedoresRegiao.flatrate && provedoresRegiao.flatrate.length > 0) {
            // O TMDB devolve um link oficial e seguro que leva direto para a plataforma certa
            const linkPlataforma = provedoresRegiao.link; 
            
            htmlStreaming = '<div class="streaming-container">';
            provedoresRegiao.flatrate.forEach(p => {
                // Trocamos a <div> por uma tag <a> (link)
                htmlStreaming += `
                    <a href="${linkPlataforma}" target="_blank" rel="noopener noreferrer" class="streaming-provider" title="Assistir no ${p.provider_name}">
                        <img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}">
                    </a>
                `;
            });
            htmlStreaming += '</div>';
            htmlStreaming += '<p style="font-size:11px; color:#888; margin-top:8px;">👆 Clique no ícone para assistir</p>';
        }
    }

    let htmlElenco = '';
    const elenco = dados?.credits?.cast?.slice(0, 5) || [];
    if (elenco.length > 0) {
        htmlElenco += '<h3 class="modal-section-title">Elenco Principal</h3><div class="cast-container">';
        elenco.forEach(ator => {
            const fotoAtor = ator.profile_path ? `https://image.tmdb.org/t/p/w185${ator.profile_path}` : 'https://via.placeholder.com/185x278?text=Sem+Foto';
            htmlElenco += `<div class="cast-card"><img src="${fotoAtor}" alt="${ator.name}"><p>${ator.name}</p><span>${ator.character}</span></div>`;
        });
        htmlElenco += '</div>';
    }

    let htmlTrailer = '';
    const videos = dados?.videos?.results || [];
    const trailerOficial = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
    if (trailerOficial) {
        htmlTrailer = `<h3 class="modal-section-title">Trailer Oficial</h3><div class="video-container"><iframe src="https://www.youtube.com/embed/${trailerOficial.key}" allowfullscreen></iframe></div>`;
    }

    let htmlRecs = '';
    const recomendados = dados?.recommendations?.results?.slice(0, 4) || [];
    if (recomendados.length > 0) {
        htmlRecs += '<h3 class="modal-section-title">Títulos Semelhantes</h3><div class="recs-container">';
        recomendados.forEach(rec => {
            const capaRec = rec.poster_path ? `https://image.tmdb.org/t/p/w342${rec.poster_path}` : 'https://via.placeholder.com/342x513?text=Sem+Capa';
            const tituloRec = rec.title || rec.name;
            htmlRecs += `<div class="rec-card"><img src="${capaRec}" alt="${tituloRec}"><p title="${tituloRec}">${tituloRec}</p></div>`;
        });
        htmlRecs += '</div>';
    }

    modalCorpo.innerHTML = `
        <div class="modal-layout">
            <div class="modal-esquerda">
                <div class="modal-imagem"><img src="${poster}" alt="Capa"></div>
                <h4 style="font-size:14px; margin-top:15px; margin-bottom:8px; color:#fff;">Onde Assistir:</h4>
                ${htmlStreaming}
            </div>
            <div class="modal-info">
                <h2>${titulo}</h2>
                <div class="meta-dados">
                    <span class="nota-destaque">⭐ ${nota}/10</span>
                    <span>📅 ${ano}</span>
                    <span>⏱️ ${duracao}</span>
                    ${infoTv}
                </div>
                <p style="font-size:13px; color:#b5b5b5; margin-bottom:15px;"><strong>Gêneros:</strong> ${generos}</p>
                <p class="sinopse">${sinopse}</p>
            </div>
        </div>
        ${htmlElenco}
        ${htmlTrailer}
        ${htmlRecs}
    `;
};

function fecharModal() {
    const iframe = modalCorpo.querySelector('iframe');
    if (iframe) iframe.src = ''; 
    modal.classList.remove('show');
}
btnFecharModal.addEventListener('click', fecharModal);
window.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

/* ==========================================================
   7. GESTÃO DE FAVORITOS (MELHORADA COM UPDATE EM TEMPO REAL)
========================================================== */
window.lidarComFavoritoNoId = function(id, tipo, botao) {
    const filme = window.filmesCache[id];
    if (!filme) return;

    alternarFavorito(filme); 
    
    if (modoAtual === 'favoritos') {
        mostrarFavoritos();
    } else if (botao) {
        const favoritado = eFavorito(id);
        botao.textContent = favoritado ? 'Remover' : '⭐ Favoritar';
        
        // NOVIDADE: Motor da Animação
        botao.classList.remove('animar-favorito'); 
        void botao.offsetWidth; // "Truque mágico" do CSS/JS que força o navegador a reiniciar a animação
        botao.classList.add('animar-favorito');

        // Alterna entre o botão Amarelo e o botão "Remover"
        if (favoritado) {
            botao.classList.add('btn-remover');
        } else {
            botao.classList.remove('btn-remover');
        }
    }
};

function mostrarFavoritos() {
    modoAtual = 'favoritos';
    tituloSecao.textContent = "Meus Favoritos";
    gridFilmes.style.display = 'grid'; 
    gridFilmes.className = 'movie-grid';
    
    if (typeof obterFavoritos === 'function') {
        const favoritos = obterFavoritos(); 
        favoritos.forEach(f => window.filmesCache[f.id] = f); 
        renderizarGrid(favoritos, false);
    } else {
        gridFilmes.innerHTML = '<p style="padding:20px;">Sistema de favoritos temporariamente indisponível.</p>';
    }
}

/* ==========================================================
   8. EVENTOS INICIAIS E DE NAVEGAÇÃO
========================================================== */
window.addEventListener('DOMContentLoaded', () => {
    carregarGeneros(); // Carrega os géneros ao abrir o site
    carregarHome();
});

// NAVEGAÇÃO BLINDADA: HOME
btnHome.addEventListener('click', () => {
    if (modoAtual === 'home') return; 
    if (carregando) return; // Proteção de travamento

    filtroGenero.value = ''; // Limpa o filtro
    inputBusca.value = '';   // Limpa a busca
    termoAtual = '';         // Reseta a variável de controle
    generoAtual = '';        // Reseta a variável de controle
    // tipoAtual = 'movie';  // (Opcional) Pode descomentar se quiser forçar a voltar para filmes ao clicar na Home
    carregarHome();
});

// NAVEGAÇÃO BLINDADA: FAVORITOS
btnFavoritos.addEventListener('click', () => {
    if (modoAtual === 'favoritos') return;
    if (carregando) return; // Proteção de travamento

    mostrarFavoritos();
});

// INTELIGÊNCIA DO TIPO DE BUSCA (Filmes/Séries)
tipoBusca.addEventListener('change', async () => {
    await carregarGeneros(); // Atualiza a lista no select (1 requisição inevitável e necessária)
    
    // 1. Se já estamos na Home e a barra de busca/filtro está vazia: NÃO FAZ NADA!
    // Fica silencioso, poupa a API e não recarrega os carrosséis à toa.
    if (modoAtual === 'home' && inputBusca.value === '' && filtroGenero.value === '') {
        console.log("Select alterado na Home. Apenas atualizamos os gêneros sem gastar API extra!");
        return;
    }

    // 2. Se estamos na aba Favoritos (que é offline), só filtra se tiver algo digitado/selecionado
    if (modoAtual === 'favoritos') {
        if (inputBusca.value !== '' || filtroGenero.value !== '') {
            formBusca.dispatchEvent(new Event('submit')); // Dispara o submit que cairá no modo offline
        }
        return;
    }

    // 3. Se estava na tela de Busca, ou tem algo digitado, refaz a busca com a API para o novo tipo
    if (modoAtual === 'busca' || inputBusca.value !== '') {
        formBusca.dispatchEvent(new Event('submit'));
    }
});

// INTELIGÊNCIA DO FILTRO DE GÉNERO
filtroGenero.addEventListener('change', () => {
    // Se a caixa de texto estiver vazia, submete a pesquisa automaticamente ao trocar o género
    if (inputBusca.value === '') {
        formBusca.dispatchEvent(new Event('submit'));
    }
});