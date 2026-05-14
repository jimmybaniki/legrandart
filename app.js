// Gestion des données en stockage local
// Les profils, boutiques et œuvres sont sauvegardés dans le navigateur

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypuG5CjVBMTTo1uWHX8a8vPKjkaOiVEGIauGlFykncCMJMxxDoDG6IbgAyVTctTmeX/exec";

// FONCTIONS DE SYNCHRONISATION BDD
async function readData(sheetName) {
    try {
        const response = await fetch(`${SCRIPT_URL}?sheetName=${sheetName}`);
        return await response.json();
    } catch (e) {
        console.error("Erreur lecture BDD:", e);
        return [];
    }
}

async function addEntry(sheetName, rowValues) {
    const payload = {
        action: "write",
        sheetName: sheetName,
        values: rowValues
    };

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        console.error("Erreur écriture BDD:", e);
        return false;
    }
}

async function deleteEntry(sheetName, rowIndex) {
    const payload = {
        action: "delete",
        sheetName: sheetName,
        rowIndex: rowIndex // L'index de la ligne à supprimer (base 1, incluant l'en-tête)
    };

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        console.error("Erreur suppression BDD:", e);
        return false;
    }
}

function getLocalShops() {
    return JSON.parse(localStorage.getItem('lg_shops') || '[]');
}

function getLocalProfile() {
    return JSON.parse(localStorage.getItem('lg_pro_user') || 'null');
}

function getLocalWorks() {
    return JSON.parse(localStorage.getItem('lg_artworks') || '[]');
}

let currentMode = '';

function switchMode(mode) {
    // Vérification de la passerelle : l'utilisateur doit être authentifié
    const sessionUser = localStorage.getItem('lg_user_name');
    if (!sessionUser) {
        alert("Veuillez vous authentifier via la passerelle avant de créer un compte.");
        window.location.href = 'index.html?openLogin=true';
        return;
    }

    currentMode = mode;
    document.getElementById('selection-view')?.classList.add('hidden');
    document.getElementById('creation-form')?.classList.remove('hidden');
    document.getElementById('form-title').innerText = mode === 'artiste' ? 'Nouveau compte artiste' : 'Créer ma boutique professionnelle';
    document.getElementById('form-subtitle').innerText = mode === 'artiste'
        ? 'Publiez vos œuvres, gérez vos données et bénéficiez d’un espace artistique personnalisé.'
        : 'Créez votre boutique pour apparaître parmi les boutiques partenaires.';
    document.getElementById('shop-fields').classList.toggle('hidden', mode !== 'gerant');
    document.getElementById('artist-note').classList.toggle('hidden', mode !== 'artiste');
}

function saveProfileWithMode(profile) {
    registerProfile(profile);
}

async function saveToDataStore(payload) {
    // Enregistrement silencieux vers Google Sheets
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Erreur de sauvegarde distante:", e);
    }
}

function loginAsManager(shopName) {
    // Simule une connexion en tant que gérant d'une boutique spécifique
    localStorage.setItem('lg_active_managed_shop', shopName);
    // Redirection vers le template de boutique (ex: aza-kai.html si c'est Aza & Kai)
    window.location.href = shopName.toLowerCase().includes('aza') ? 'aza-kai-admin.html' : 'dashboard.html';
}

function registerProfile(profile) {
    localStorage.setItem('lg_pro_user', JSON.stringify(profile));
    if (profile.role === 'gerant') {
        addShop({
            id: Date.now(),
            owner: profile.name,
            email: profile.email,
            description: profile.description,
            shopName: profile.shopName || profile.name,
            country: profile.country || '',
            city: profile.city || '',
            tags: profile.tags || 'Boutique partenaire',
            image: profile.image || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800'
        });
    }
    if (profile.role === 'artiste') {
        const newArtwork = {
            id: Date.now(),
            artist: profile.name,
            title: 'Première œuvre',
            image: profile.image || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=800',
            description: profile.description,
            date: new Date().toLocaleDateString()
        };
        addArtwork(newArtwork);
    }
    saveToDataStore({ action: 'signup', profile });
}

function addShop(shop) {
    const shops = getLocalShops();
    shops.unshift(shop);
    localStorage.setItem('lg_shops', JSON.stringify(shops));
    // Envoi vers Google Sheets pour persistance éternelle
    addEntry("shops", [
        shop.shopName, 
        shop.owner, 
        shop.email, 
        shop.country, 
        shop.city, 
        shop.tags
    ]);
}

function addArtwork(artwork) {
    const artworks = getLocalWorks();
    artworks.unshift(artwork);
    localStorage.setItem('lg_artworks', JSON.stringify(artworks));
    saveToDataStore({ action: 'add_artwork', data: artwork });
}

async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;

    try {
        const res = await fetch(`${SCRIPT_URL}?action=get_events`);
        const events = await res.json();
        
        // Filtre uniquement les événements approuvés
        const approvedEvents = events.filter(e => e.status === 'approved');

        if (approvedEvents.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-20 uppercase text-xs font-black tracking-widest">Aucun événement approuvé pour le moment.</p>';
            return;
        }

        container.innerHTML = approvedEvents.map(event => `
            <div class="glass-card p-8 rounded-[2.5rem] border border-white/5 hover:border-yellow-500/30 transition-all group">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="text-yellow-500 text-[10px] font-black uppercase tracking-widest block mb-2">${event.date}</span>
                        <h3 class="text-2xl font-black text-white uppercase">${event.title}</h3>
                    </div>
                    <div class="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Confirmé</div>
                </div>
                <p class="text-gray-400 text-sm leading-relaxed mb-6">${event.description}</p>
                <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <span class="flex items-center gap-2"><i class="fas fa-map-marker-alt text-yellow-500"></i> ${event.location}</span>
                    <span class="flex items-center gap-2"><i class="fas fa-user text-emerald-500"></i> Par ${event.organizer}</span>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error("Erreur lors du chargement des événements:", e);
        container.innerHTML = '<p class="text-red-500 text-center py-20 uppercase text-[10px] font-black">Erreur de chargement des événements</p>';
    }
}

async function loadShops() {
    const container = document.getElementById('dynamic-shops');
    if (!container) return;

    let shops = getLocalShops();
    const defaultShops = [
        {
            owner: 'Studio Lumière',
            shopName: 'Studio Lumière',
            description: 'Création visuelle et marketing artistique.',
            tags: 'Visuel • Branding',
            image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=800',
            href: 'New folder/studio-lumiere.html'
        },
        {
            owner: 'Aza & Kai',
            shopName: 'Aza & Kai',
            description: 'Boutique de mode africaine contemporaine et accessoires de luxe.',
            tags: 'Mode • Luxe',
            image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=800',
            href: 'aza-kai.html'
        },
        {
            owner: 'AfriKrea',
            shopName: 'Boutique AfriKrea',
            description: 'Artisanat contemporain et bijoux faits main.',
            tags: 'Artisanat • Bijoux',
            image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800',
            href: 'New folder/afrikrea.html'
        }
    ];

    // Tentative de récupération depuis Google Sheets pour mise à jour
    const remoteShops = await readData("shops");
    if (remoteShops && remoteShops.length > 0) {
        shops = remoteShops;
    }

    container.innerHTML = '';
    const allShops = [...shops, ...defaultShops];
    if (!allShops.length) {
        container.innerHTML = '<p class="text-gray-400">Aucune boutique disponible pour le moment.</p>';
        return;
    }

    allShops.forEach((shop) => {
        const href = shop.href || '#';
        const card = document.createElement('a');
        card.className = 'shop-card glass-card p-6 rounded-[2rem] border border-white/10 block';
        card.href = href;
        card.innerHTML = `
            <div class="relative h-48 mb-6 overflow-hidden rounded-2xl">
                <img src="${shop.image}" alt="${shop.shopName}" class="w-full h-full object-cover">
                <div class="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">${shop.tags}</div>
            </div>
            <h2 class="text-2xl font-black text-white mb-2">${shop.shopName}</h2>
            <p class="text-gray-400 text-sm leading-relaxed mb-6">${shop.description}</p>
            <div class="flex items-center text-yellow-400 text-[10px] font-black uppercase tracking-widest">
                ${shop.owner ? `Géré par ${shop.owner}` : 'Découvrir'} <i class="fas fa-arrow-right ml-2"></i>
            </div>
        `;
        container.appendChild(card);
    });
}

function populateDashboard() {
    const profile = getLocalProfile();
    if (!profile) {
        window.location.href = 'espace-pro.html';
        return;
    }

    const profileCard = document.getElementById('profile-card');
    const workspaceTitle = document.getElementById('workspace-title');
    const profileDetail = document.getElementById('profile-detail');
    const actionTitle = document.getElementById('action-title');
    const actionButton = document.getElementById('action-button');

    profileCard.innerHTML = `
        <div class="space-y-3">
            <div class="uppercase tracking-[0.35em] text-yellow-400 text-xs font-black">Bienvenue</div>
            <h1 class="text-4xl md:text-5xl font-black">${profile.name}</h1>
            <p class="text-gray-300 text-sm">${profile.role === 'artiste' ? 'Espace artistique personnel' : 'Gestionnaire de boutique'}</p>
        </div>
        <div class="space-y-2 text-sm text-gray-300">
            <div><strong>Email :</strong> ${profile.email}</div>
            <div>${profile.city ? `<strong>Ville :</strong> ${profile.city}` : ''}</div>
            <div>${profile.country ? `<strong>Pays :</strong> ${profile.country}` : ''}</div>
        </div>
    `;
    profileDetail.innerText = profile.description;

    if (profile.role === 'gerant') {
        workspaceTitle.innerText = 'Ma Boutique';
        actionTitle.innerText = 'Ajouter une nouvelle boutique';
        actionButton.innerText = 'Créer la boutique';
        actionButton.onclick = () => {
            document.getElementById('shop-form').classList.toggle('hidden');
        };
        showMyShops();
    } else {
        workspaceTitle.innerText = 'Mon Espace Artiste';
        actionTitle.innerText = 'Publier une œuvre ou collection';
        actionButton.innerText = 'Publier mon œuvre';
        actionButton.onclick = () => {
            document.getElementById('artwork-form').classList.toggle('hidden');
        };
        showMyArtworks();
    }
}

function showMyShops() {
    const shops = getLocalShops().filter((shop) => shop.owner === getLocalProfile().name);
    const section = document.getElementById('content-list');
    section.innerHTML = shops.length ? shops.map((shop) => `
        <div class="glass p-6 rounded-3xl border border-white/10">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-black text-white">${shop.shopName}</h3>
                <div class="flex gap-2">
                    <button onclick="editShop(${shop.id})" class="text-yellow-400 hover:text-yellow-300 text-xs font-black uppercase tracking-widest">
                        <i class="fas fa-edit"></i> Éditer
                    </button>
                    <button onclick="deleteShop(${shop.id})" class="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </div>
            </div>
            <p class="text-gray-400 mb-3">${shop.description}</p>
            <div class="text-xs uppercase tracking-[0.35em] text-yellow-400 font-black">${shop.country} • ${shop.city}</div>
        </div>
    `).join('') : '<p class="text-gray-400">Vous n’avez pas encore de boutique enregistrée. Créez-en une avec le formulaire ci-dessus.</p>';
}

function showMyArtworks() {
    const artworks = getLocalWorks().filter((art) => art.artist === getLocalProfile().name);
    const section = document.getElementById('content-list');
    section.innerHTML = artworks.length ? artworks.map((art) => `
        <div class="glass p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row gap-6">
            <img src="${art.image}" alt="${art.title}" class="w-full md:w-40 h-40 object-cover rounded-3xl">
            <div class="flex-1">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-black text-white">${art.title}</h3>
                    <div class="flex gap-2">
                        <button onclick="editArtwork(${art.id})" class="text-emerald-400 hover:text-emerald-300 text-xs font-black uppercase tracking-widest">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteArtwork(${art.id})" class="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="text-gray-400 mb-3">${art.description}</p>
                <div class="text-xs uppercase tracking-[0.35em] text-yellow-400 font-black">Publié le ${art.date}</div>
            </div>
        </div>
    `).join('') : '<p class="text-gray-400">Aucune œuvre publiée pour l’instant. Utilisez le formulaire pour ajouter votre première création.</p>';
}

function submitShopForm(event) {
    event.preventDefault();
    const profile = getLocalProfile();
    const shop = {
        id: Date.now(),
        owner: profile.name,
        shopName: document.getElementById('shop-name').value,
        email: profile.email,
        description: document.getElementById('shop-desc').value,
        country: document.getElementById('shop-country').value,
        city: document.getElementById('shop-city').value,
        tags: document.getElementById('shop-tags').value || 'Boutique partenaire',
        image: document.getElementById('shop-image').value || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800'
    };
    addShop(shop);
    showMyShops();
    document.getElementById('shop-form').classList.add('hidden');
    document.getElementById('shop-form').reset();
}

function submitArtworkForm(event) {
    event.preventDefault();
    const profile = getLocalProfile();
    const artwork = {
        id: Date.now(),
        artist: profile.name,
        title: document.getElementById('art-title').value,
        image: document.getElementById('art-image').value || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=800',
        description: document.getElementById('art-desc').value,
        date: new Date().toLocaleDateString()
    };
    addArtwork(artwork);
    showMyArtworks();
    document.getElementById('artwork-form').classList.add('hidden');
    document.getElementById('artwork-form').reset();
}

function editProfile() {
    const profile = getLocalProfile();
    const newName = prompt('Nouveau nom:', profile.name);
    const newDesc = prompt('Nouvelle description:', profile.description);
    const newCity = prompt('Nouvelle ville:', profile.city);
    const newCountry = prompt('Nouveau pays:', profile.country);
    
    if (newName && newDesc) {
        profile.name = newName;
        profile.description = newDesc;
        profile.city = newCity;
        profile.country = newCountry;
        registerProfile(profile);
        populateDashboard();
    }
}

function editShop(shopId) {
    const shops = getLocalShops();
    const shop = shops.find(s => s.id == shopId);
    if (!shop) return;
    
    const newName = prompt('Nouveau nom de boutique:', shop.shopName);
    const newDesc = prompt('Nouvelle description:', shop.description);
    const newTags = prompt('Nouvelles catégories:', shop.tags);
    
    if (newName && newDesc) {
        shop.shopName = newName;
        shop.description = newDesc;
        shop.tags = newTags;
        localStorage.setItem('lg_shops', JSON.stringify(shops));
        saveToDataStore({ action: 'shop_updated', shop });
        showMyShops();
    }
}

function editArtwork(artId) {
    const artworks = getLocalWorks();
    const artwork = artworks.find(a => a.id == artId);
    if (!artwork) return;
    
    const newTitle = prompt('Nouveau titre:', artwork.title);
    const newDesc = prompt('Nouvelle description:', artwork.description);
    const newImage = prompt('Nouvelle URL image:', artwork.image);
    
    if (newTitle && newDesc) {
        artwork.title = newTitle;
        artwork.description = newDesc;
        artwork.image = newImage;
        localStorage.setItem('lg_artworks', JSON.stringify(artworks));
        saveToDataStore({ action: 'artwork_updated', artwork });
        showMyArtworks();
    }
}

function deleteShop(shopId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette boutique ?')) return;
    let shops = getLocalShops();
    shops = shops.filter(s => s.id != shopId);
    localStorage.setItem('lg_shops', JSON.stringify(shops));
    saveToDataStore({ action: 'shop_deleted', shopId });
    showMyShops();
}

function deleteArtwork(artId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette œuvre ?')) return;
    let artworks = getLocalWorks();
    artworks = artworks.filter(a => a.id != artId);
    localStorage.setItem('lg_artworks', JSON.stringify(artworks));
    saveToDataStore({ action: 'artwork_deleted', artId });
    showMyArtworks();
}

function logout() {
    localStorage.removeItem('lg_pro_user');
    window.location.href = 'index.html';
        }

function initSelectionMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (!mode) return;
    if (mode === 'artiste') {
        switchMode('artiste');
    } else if (mode === 'gerant') {
        switchMode('gerant');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dynamic-shops')) {
        loadShops();
    }
    if (document.getElementById('events-container')) {
        loadEvents();
    }
    if (document.getElementById('selection-view')) {
        initSelectionMode();
    }
    if (document.getElementById('dashboard-page')) {
        populateDashboard();
        document.getElementById('shop-form').addEventListener('submit', submitShopForm);
        document.getElementById('artwork-form').addEventListener('submit', submitArtworkForm);
    }
});
