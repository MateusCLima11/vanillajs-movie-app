// Recupera os favoritos salvos no navegador
function obterFavoritos() {
    try {
        return JSON.parse(localStorage.getItem('cineapp_favoritos')) || [];
    } catch (erro) {
        console.error("Erro ao ler LocalStorage, reiniciando favoritos...", erro);
        return [];
    }
}

// Verifica se um ID específico já está nos favoritos
function eFavorito(id) {
    const favoritos = obterFavoritos();
    return favoritos.some(f => String(f.id) === String(id));
}

// Adiciona se não existir, remove se já existir
function alternarFavorito(filme) {
    let favoritos = obterFavoritos();
    
    if (eFavorito(filme.id)) {
        // Remove dos favoritos
        favoritos = favoritos.filter(f => String(f.id) !== String(filme.id));
    } else {
        // Adiciona aos favoritos
        favoritos.push(filme);
    }
    
    // Salva de volta no navegador
    localStorage.setItem('cineapp_favoritos', JSON.stringify(favoritos));
}