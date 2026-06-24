/* ==========================================================
   1. SELEÇÃO DE ELEMENTOS DO DOM E VARIÁVEIS GERAIS
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

// Variáveis de controle de estado
let paginaAtual = 1;
let carregando = false;
let temMaisResultados = true;
let termoAtual = '';
let generoAtual = ''; 
let tipoAtual = 'movie'; 
let modoAtual = 'home';

// Cache em memória
window.filmesCache = {};
window.generosCache = {}; 

// Preenche a caixa de seleção de géneros utilizando cache para poupar a API
async function carregarGeneros() {
    const tipo = tipoBusca.value;
    
    if (!window.generosCache[tipo]) {
        window.generosCache[tipo] = await buscarGeneros(tipo);
    }

    const generos = window.generosCache[tipo] || [];
    filtroGenero.innerHTML = '<option value="">Todos os Géneros</option>';
    
    generos.forEach(g => {
        filtroGenero.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
}

// Função para reiniciar a animação de entrada do CSS (Fade-in)
function animarMudancaPagina() {
    gridFilmes.classList.remove('fade-in');
    void gridFilmes.offsetWidth; // Força o navegador a reiniciar a animação
    gridFilmes.classList.add('fade-in');
}

/* ==========================================================
   2. SISTEMA DE PESQUISA PRINCIPAL
========================================================== */
formBusca.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const novoTermo = inputBusca.value.trim().toLowerCase();
    const novoGenero = filtroGenero.value;
    const tipo = tipoBusca.value;

    // Busca offline quando o utilizador está na aba de favoritos
    if (modoAtual === 'favoritos') {
        let favoritosFiltrados = typeof obterFavoritos === 'function' ? obterFavoritos() : [];

        if (novoTermo) {
            favoritosFiltrados = favoritosFiltrados.filter(filme => {
                const titulo = (filme.title || filme.name || "").toLowerCase();
                return titulo.includes(novoTermo);
            });
        }

        if (novoGenero) {
            favoritosFiltrados = favoritosFiltrados.filter(filme => 
                filme.genre_ids && filme.genre_ids.includes(parseInt(novoGenero))
            );
        }

        tituloSecao.textContent = `Favoritos encontrados: ${favoritosFiltrados.length}`;
        renderizarGrid(favoritosFiltrados, false, 'movie'); 
        return; 
    }

    // Impede chamadas repetidas à API com os mesmos parâmetros
    if (novoTermo === termoAtual.toLowerCase() && novoGenero === generoAtual && tipo === tipoAtual && modoAtual === 'busca') {
        return; 
    }

    // Atualiza o estado da pesquisa
    termoAtual = novoTermo;
    generoAtual = novoGenero;
    tipoAtual = tipo; 

    // Retorna à Home se a busca for limpa
    if (!termoAtual && !generoAtual) {
        carregarHome();
        return;
    }

    // Prepara a interface (Loading state)
    const btnSubmit = formBusca.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Aguarde...';
    
    carregando = true;
    modoAtual = 'busca';
    paginaAtual = 1;
    temMaisResultados = true;
    
    if (termoAtual) {
        tituloSecao.textContent = `Resultados para: "${termoAtual}"`;
    } else {
        const nomeGenero = filtroGenero.options[filtroGenero.selectedIndex]?.text || 'Género';
        tituloSecao.textContent = `A Explorar: ${nomeGenero} (${tipo === 'movie' ? 'Filmes' : 'Séries'})`;
    }
    
    gridFilmes.style.display = 'block'; 
    gridFilmes.className = '';
    gridFilmes.innerHTML = '<div class="spinner"></div><p style="text-align:center; color:#888;">A buscar no banco de dados...</p>';
    
    // Requisição à API
    let resultados = [];
    try {
        if (termoAtual) {
            resultados = await buscarPorNome(termoAtual, tipo, paginaAtual);
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
    
    // Renderização dos resultados
    gridFilmes.style.display = 'grid'; 
    gridFilmes.className = 'movie-grid';

    if (resultados && resultados.length > 0) {
        resultados.sort((a, b) => (b.popularity - a.popularity) || (b.vote_average - a.vote_average));
        resultados.forEach(f => window.filmesCache[f.id] = f);
        renderizarGrid(resultados, false, tipo);
    } else {
        temMaisResultados = false;
        renderizarGrid([], false, tipo);
    }

    // Restaura os botões
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Pesquisar';
    carregando = false; 
});

/* ==========================================================
   3. PAGINAÇÃO (SCROLL INFINITO)
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
   4. HOME PAGE E CARROSSEL
========================================================== */
async function carregarHome() {
    modoAtual = 'home';
    tituloSecao.textContent = "Destaques do Momento";
    inputBusca.value = '';
    
    gridFilmes.style.display = 'block'; 
    gridFilmes.className = '';
    
    gridFilmes.innerHTML = `
        <div class="secao-carrossel">
            <h3>🎬 Filmes Populares</h3>
            <div class="carrossel-wrapper">
                <button class="btn-carrossel btn-prev hidden" aria-label="Voltar filmes">◀</button>
                <div class="carrossel" id="carrossel-filmes"><p style="padding:20px;">A carregar filmes...</p></div>
                <button class="btn-carrossel btn-next hidden" aria-label="Avançar filmes">▶</button>
            </div>
        </div>
        <div class="secao-carrossel">
            <h3>📺 Séries Populares</h3>
            <div class="carrossel-wrapper">
                <button class="btn-carrossel btn-prev hidden" aria-label="Voltar séries">◀</button>
                <div class="carrossel" id="carrossel-series"><p style="padding:20px;">A carregar séries...</p></div>
                <button class="btn-carrossel btn-next hidden" aria-label="Avançar séries">▶</button>
            </div>
        </div>
    `;

    // Aplica a animação de entrada na página inicial
    animarMudancaPagina();

    const [filmes, series] = await Promise.all([
        buscarPopulares('movie'),
        buscarPopulares('tv')
    ]);

    // Renderiza Filmes
    try {
        const containerFilmes = document.getElementById('carrossel-filmes');
        if (filmes && filmes.length > 0) {
            filmes.forEach(f => window.filmesCache[f.id] = f);
            containerFilmes.innerHTML = '';
            filmes.forEach(f => containerFilmes.innerHTML += criarCardHTML(f, 'movie'));
            configurarBotoesCarrossel(containerFilmes); 
        } else {
            containerFilmes.innerHTML = '<p style="padding:10px; color:#888;">Nenhum filme encontrado.</p>';
        }
    } catch (erro) {
        console.error("Erro ao renderizar filmes:", erro);
    }

    // Renderiza Séries
    try {
        const containerSeries = document.getElementById('carrossel-series');
        if (series && series.length > 0) {
            series.forEach(s => window.filmesCache[s.id] = s);
            containerSeries.innerHTML = '';
            series.forEach(s => containerSeries.innerHTML += criarCardHTML(s, 'tv'));
            configurarBotoesCarrossel(containerSeries); 
        } else {
            containerSeries.innerHTML = '<p style="padding:10px; color:#888;">Nenhuma série encontrada.</p>';
        }
    } catch (erro) {
        console.error("Erro ao renderizar séries:", erro);
    }
}

// Lógica de navegação horizontal do carrossel
function configurarBotoesCarrossel(carrossel) {
    const wrapper = carrossel.parentElement;
    const btnPrev = wrapper.querySelector('.btn-prev');
    const btnNext = wrapper.querySelector('.btn-next');

    if (!btnPrev || !btnNext) return;

    const atualizarBotoes = () => {
        const scrollLeft = carrossel.scrollLeft;
        const maxScroll = carrossel.scrollWidth - carrossel.clientWidth;
        
        btnPrev.classList.toggle('hidden', scrollLeft <= 5);
        btnNext.classList.toggle('hidden', scrollLeft >= maxScroll - 5);
    };

    carrossel.addEventListener('scroll', atualizarBotoes);
    window.addEventListener('resize', atualizarBotoes);
    setTimeout(atualizarBotoes, 100); 

    btnPrev.addEventListener('click', () => {
        const scrollAmount = carrossel.clientWidth * 0.8; 
        carrossel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    btnNext.addEventListener('click', () => {
        const scrollAmount = carrossel.clientWidth * 0.8; 
        carrossel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
}

/* ==========================================================
   5. COMPONENTES E RENDERIZAÇÃO
========================================================== */
function criarCardHTML(filme, tipo) {
    const titulo = filme.title || filme.name || "Sem título"; 
    
    // Tratamento da imagem (Fallback para o SVG local)
    const poster = filme.poster_path 
        ? `https://image.tmdb.org/t/p/w500${filme.poster_path}` 
        : './images/sem-capa.svg';
    
    let favoritado = false;
    if (typeof eFavorito === 'function') {
        favoritado = eFavorito(filme.id);
    }
    
    const textoBotao = favoritado ? 'Remover' : '⭐ Favoritar';
    const nota = filme.vote_average ? filme.vote_average.toFixed(1) : 'N/A';
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
   6. MODAL DE DETALHES
========================================================== */
window.abrirModal = async function(id, tipo) {
    modalCorpo.innerHTML = '<p style="text-align:center; padding:50px; color:#b5b5b5;">A carregar dados...</p>';
    modal.classList.add('show');

    const filmeBase = window.filmesCache[id] || {};
    let dados = null;

    try {
        dados = await buscarDetalhes(id, tipo);
    } catch (erro) {
        console.warn("Falha ao obter dados detalhados da API.", erro);
    }

    // Tratamento de dados base
    const titulo = dados?.title || dados?.name || filmeBase.title || filmeBase.name || "Sem título";
    const sinopse = dados?.overview || filmeBase.overview || "Nenhuma sinopse disponível.";
    const notaNum = dados?.vote_average ?? filmeBase.vote_average;
    const nota = (notaNum && typeof notaNum === 'number') ? notaNum.toFixed(1) : 'N/A';
    const dataRaw = dados?.release_date || dados?.first_air_date || filmeBase.release_date || filmeBase.first_air_date || '----';
    const ano = dataRaw.split('-')[0];
    
    const posterPath = dados?.poster_path || filmeBase.poster_path;
    const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : './images/sem-capa.svg'; // Fallback Modal

    // Tratamento de duração e temporadas (Filmes vs Séries)
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

    const generos = dados?.genres?.length > 0 ? dados.genres.map(g => g.name).join(', ') : 'Géneros n/d';

    // Plataformas de Streaming
    let htmlStreaming = '<p style="font-size:13px; color:#888;">Não disponível por assinatura no momento.</p>';
    if (dados && dados['watch/providers'] && dados['watch/providers'].results) {
        const provedoresRegiao = dados['watch/providers'].results.BR || dados['watch/providers'].results.PT;
        
        if (provedoresRegiao && provedoresRegiao.flatrate && provedoresRegiao.flatrate.length > 0) {
            const linkPlataforma = provedoresRegiao.link; 
            
            htmlStreaming = '<div class="streaming-container">';
            provedoresRegiao.flatrate.forEach(p => {
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

    // Elenco
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

    // Trailer
    let htmlTrailer = '';
    const videos = dados?.videos?.results || [];
    const trailerOficial = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
    if (trailerOficial) {
        htmlTrailer = `<h3 class="modal-section-title">Trailer Oficial</h3><div class="video-container"><iframe src="https://www.youtube.com/embed/${trailerOficial.key}" allowfullscreen></iframe></div>`;
    }

    // Recomendações
    let htmlRecs = '';
    const recomendados = dados?.recommendations?.results?.slice(0, 4) || [];
    if (recomendados.length > 0) {
        htmlRecs += '<h3 class="modal-section-title">Títulos Semelhantes</h3><div class="recs-container">';
        recomendados.forEach(rec => {
            const capaRec = rec.poster_path ? `https://image.tmdb.org/t/p/w342${rec.poster_path}` : './images/sem-capa.svg'; // Fallback Recomendações
            const tituloRec = rec.title || rec.name;
            htmlRecs += `<div class="rec-card"><img src="${capaRec}" alt="${tituloRec}"><p title="${tituloRec}">${tituloRec}</p></div>`;
        });
        htmlRecs += '</div>';
    }

    // Estrutura final do Modal
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
                <p style="font-size:13px; color:#b5b5b5; margin-bottom:15px;"><strong>Géneros:</strong> ${generos}</p>
                <p class="sinopse">${sinopse}</p>
            </div>
        </div>
        ${htmlElenco}
        ${htmlTrailer}
        ${htmlRecs}
    `;
};

// Fechamento do Modal
function fecharModal() {
    const iframe = modalCorpo.querySelector('iframe');
    if (iframe) iframe.src = ''; 
    modal.classList.remove('show');
}

btnFecharModal.addEventListener('click', fecharModal);
window.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

/* ==========================================================
   7. GESTÃO DE FAVORITOS
========================================================== */
window.lidarComFavoritoNoId = function(id, tipo, botao) {
    const filme = window.filmesCache[id];
    if (!filme) return;

    // Se estiver na aba de favoritos, faz a remoção OTIMIZADA
    if (modoAtual === 'favoritos') {
        const cardElement = botao.closest('.card'); 
        
        if (cardElement) {
            cardElement.classList.add('card-removendo');
            
            setTimeout(() => {
                alternarFavorito(filme); // Remove do LocalStorage
                cardElement.remove();    // Remove SÓ este card do HTML (Performance instantânea)
                
                // Se o utilizador removeu o ÚLTIMO favorito da lista, recarrega a tela para mostrar a mensagem de vazio
                const favoritosRestantes = typeof obterFavoritos === 'function' ? obterFavoritos() : [];
                if (favoritosRestantes.length === 0) {
                    mostrarFavoritos();
                }
            }, 350);
            return;
        }
    }

    // Código original para a Home ou Busca Geral
    alternarFavorito(filme); 
    
    if (botao) {
        const favoritado = eFavorito(id);
        botao.textContent = favoritado ? 'Remover' : '⭐ Favoritar';
        
        botao.classList.remove('animar-favorito'); 
        void botao.offsetWidth; 
        botao.classList.add('animar-favorito');

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
    
    // Aplica a animação de entrada na aba Favoritos
    animarMudancaPagina();
    
    if (typeof obterFavoritos === 'function') {
        const favoritos = obterFavoritos(); 
        favoritos.forEach(f => window.filmesCache[f.id] = f); 
        renderizarGrid(favoritos, false);
    } else {
        gridFilmes.innerHTML = '<p style="padding:20px;">Sistema de favoritos temporariamente indisponível.</p>';
    }
}

/* ==========================================================
   8. EVENTOS GERAIS E NAVEGAÇÃO
========================================================== */
window.addEventListener('DOMContentLoaded', () => {
    carregarGeneros(); 
    carregarHome();
});

btnHome.addEventListener('click', () => {
    if (modoAtual === 'home' || carregando) return; 

    filtroGenero.value = ''; 
    inputBusca.value = '';   
    termoAtual = '';         
    generoAtual = '';        
    carregarHome();
});

btnFavoritos.addEventListener('click', () => {
    if (modoAtual === 'favoritos' || carregando) return;
    mostrarFavoritos();
});

tipoBusca.addEventListener('change', async () => {
    await carregarGeneros(); 
    
    if (modoAtual === 'home' && inputBusca.value === '' && filtroGenero.value === '') {
        return;
    }

    if (modoAtual === 'favoritos') {
        if (inputBusca.value !== '' || filtroGenero.value !== '') {
            formBusca.dispatchEvent(new Event('submit')); 
        }
        return;
    }

    if (modoAtual === 'busca' || inputBusca.value !== '') {
        formBusca.dispatchEvent(new Event('submit'));
    }
});

filtroGenero.addEventListener('change', () => {
    if (inputBusca.value === '') {
        formBusca.dispatchEvent(new Event('submit'));
    }
});