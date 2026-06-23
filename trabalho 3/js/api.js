// Busca por pesquisa de texto (Com suporte a paginação)
async function buscarPorNome(termo, tipo, pagina = 1) {
    try {
        const url = `${BASE_URL}/search/${tipo}?api_key=${API_KEY}&query=${encodeURIComponent(termo)}&language=${LANGUAGE}&page=${pagina}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.results || [];
    } catch (erro) {
        console.error("Erro na busca:", erro);
        return [];
    }
}

// Busca os Destaques da Página Inicial
async function buscarPopulares(tipo) {
    try {
        const url = `${BASE_URL}/${tipo}/popular?api_key=${API_KEY}&language=${LANGUAGE}&page=1`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.results || [];
    } catch (erro) {
        console.error("Erro ao buscar populares:", erro);
        return [];
    }
}

// Busca os Detalhes Completos (Modal)
async function buscarDetalhes(id, tipo) {
    try {
        const url = `${BASE_URL}/${tipo}/${id}?api_key=${API_KEY}&language=${LANGUAGE}&append_to_response=videos,credits,recommendations,watch/providers`;
        const resposta = await fetch(url);
        return await resposta.json();
    } catch (erro) {
        console.error("Erro ao buscar detalhes:", erro);
        return null;
    }
}

// Busca a lista oficial de géneros (Filmes ou Séries)
async function buscarGeneros(tipo) {
    try {
        const url = `${BASE_URL}/genre/${tipo}/list?api_key=${API_KEY}&language=${LANGUAGE}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.genres || [];
    } catch (erro) {
        console.error("Erro ao buscar géneros:", erro);
        return [];
    }
}

// Descobre filmes/séries filtrando por ID de Género
async function buscarPorGenero(generoId, tipo, pagina = 1) {
    try {
        const url = `${BASE_URL}/discover/${tipo}?api_key=${API_KEY}&with_genres=${generoId}&language=${LANGUAGE}&page=${pagina}&sort_by=popularity.desc`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.results || [];
    } catch (erro) {
        console.error("Erro ao buscar por género:", erro);
        return [];
    }
}