// Gestion des données via Supabase (cloud-first)
// Les profils, boutiques et œuvres sont enregistrés dans la même instance Supabase.
// localStorage n'est conservé que comme cache d'interface ou fallback non principal.

const SUPABASE_URL = 'https://sdqizkumqudwbnrdcoma.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fYpLwujskWmD2rQRsxD5TQ_qgAG6Bm_';

let sb = null;

function initSupabase() {
    if (window.supabase && !sb) {
        sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

function getLocalProfile() {
    return JSON.parse(localStorage.getItem('lg_pro_user') || 'null');
}

// Fonction pour vérifier la session de manière persistante
async function checkAuthPersistence() {
    initSupabase();
    if (!sb) return;

    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        const user = session.user;
        const role = user.user_metadata?.role;

        // Si c'est un profil pro (artiste ou gérant)
        if (role === 'artiste' || role === 'gerant') {
            const profile = {
                id: user.id,
                name: user.user_metadata?.name || user.email.split('@')[0],
                email: user.email,
                role: role,
                description: user.user_metadata?.description || '',
                city: user.user_metadata?.city || '',
                country: user.user_metadata?.country || ''
            };
            
            // On met à jour le cache local pour la cohérence de l'UI
            localStorage.setItem('lg_pro_user', JSON.stringify(profile));
            localStorage.setItem('lg_user_name', profile.name);
            
            // Si on est sur une page pro et que l'affichage est masqué, on le montre
            if (document.getElementById('selection-view')) {
                document.getElementById('selection-view').classList.add('hidden');
                document.getElementById('dashboard-page')?.classList.remove('hidden');
            }
        }
    }
}

let currentMode = '';

function switchMode(mode) {
    // Vérification de la passerelle : l'utilisateur doit être authentifié
    const proProfile = getLocalProfile();
    if (!proProfile) {
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

function loginAsManager(shopName) {
    // Simule une connexion en tant que gérant d'une boutique spécifique
    localStorage.setItem('lg_active_managed_shop', shopName);
    // Redirection vers le tableau de bord générique pour toutes les boutiques gérées
    window.location.href = 'dashboard.html';
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
}

function addShop(shop) {
    initSupabase();
    if (sb) {
        const payload = {
            shop_id: shop.id?.toString() || `shop_${Date.now()}`,
            owner_id: shop.email || shop.owner || null,
            name: shop.shopName || shop.owner,
            slogan: shop.description,
            default_category: shop.tags || 'Boutique partenaire',
            logo_url: shop.image,
            contact_info: {
                phone: '',
                address: `${shop.city || ''}${shop.city && shop.country ? ', ' : ''}${shop.country || ''}`
            },
            social_links: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        sb.from('boutique_config').upsert(payload, { onConflict: 'shop_id' }).then(({ error }) => {
            if (error) console.error('Erreur Supabase addShop:', error);
        });
    }
}

function addArtwork(artwork) {
    initSupabase();
    if (sb) {
        const payload = {
            id: artwork.id,
            shop_id: artwork.shopId || `artist_${(artwork.artist || 'unknown').replace(/\s+/g, '_').toLowerCase()}`,
            owner_id: artwork.artist || null,
            name: artwork.title,
            category: 'Art',
            price: 0,
            old_price: null,
            stock: 1,
            description: artwork.description,
            img_key: artwork.imgKey || null,
            img_url: artwork.image,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        sb.from('boutique_products').upsert(payload).then(({ error }) => {
            if (error) console.error('Erreur Supabase addArtwork:', error);
        });
    }
}

async function loadInvestableEvents() {
    const container = document.getElementById('invest-events-container');
    if (!container) return;

    initSupabase();
    if (!sb) return;

    try {
        const { data: events, error } = await sb
            .from('events')
            .select('*')
            .eq('investment_open', true);

        if (error) throw error;

        container.innerHTML = events.map(event => `
            <div class="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 group">
                <div>
                    <div class="flex justify-between mb-6">
                        <span class="bg-brand-yellow/10 text-brand-yellowHover px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">${event.category || 'Culture'}</span>
                        <span class="text-emerald-600 text-[10px] font-black uppercase tracking-widest">ROI : +${event.profit_per_ticket || '2'}$ / Billet</span>
                    </div>
                    <h3 class="text-2xl font-heading font-black text-brand-dark uppercase mb-4">${event.title}</h3>
                    <p class="text-slate-500 text-sm mb-8 leading-relaxed line-clamp-2">${event.description}</p>
                </div>
                
                <div class="space-y-5">
                    <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span class="text-slate-400">Objectif à atteindre</span>
                        <span class="text-brand-dark">${event.target_budget || '10,000'}$</span>
                    </div>
                    <div class="w-full bg-slate-50 border border-slate-100 h-3 rounded-full overflow-hidden">
                        <div class="bg-brand-yellow h-full transition-all duration-1000" style="width: ${event.funding_progress || '45'}%"></div>
                    </div>
                    <div class="flex justify-between items-center">
                         <span class="text-[9px] font-black uppercase text-brand-yellowHover">Reste ${100 - (event.funding_progress || 45)}%</span>
                         <span class="text-[9px] font-black uppercase text-slate-400 italic">Remboursement J-15 Garanti</span>
                    </div>
                </div>

                <button onclick="openInvestModal('${event.id}', '${event.title}')" class="mt-8 w-full bg-brand-dark text-white font-bold py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-brand-yellow hover:text-brand-dark transition-all shadow-lg">
                    Investir maintenant
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Erreur invest:", e);
    }
}

async function populateInvestorDashboard() {
    const profile = getLocalProfile();
    if (!profile) return;

    initSupabase();
    if (!sb) return;

    try {
        const { data: investments, error } = await sb
            .from('event_investments')
            .select('*, events(title, status)')
            .eq('investor_id', profile.id);

        if (error) throw error;

        const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
        const totalProfit = investments.reduce((sum, inv) => sum + (inv.current_profit || 0), 0);

        if(document.getElementById('inv-total-invested')) document.getElementById('inv-total-invested').innerText = totalInvested + '$';
        if(document.getElementById('inv-total-profit')) document.getElementById('inv-total-profit').innerText = totalProfit + '$';
        
        const listContainer = document.getElementById('my-investments-list');
        if (listContainer) {
            listContainer.innerHTML = investments.map(inv => {
                // Calcul délai remboursement (15 jours)
                const daysRemaining = (new Date(inv.events.date) - new Date()) / (1000 * 60 * 60 * 24);
                const canRefund = daysRemaining > 15;

                return `
                <div class="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
                    <div class="space-y-1">
                        <h4 class="text-brand-dark font-black uppercase text-sm">${inv.events.title}</h4>
                        <p class="text-[9px] text-slate-400 uppercase font-bold">Placé le ${new Date(inv.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="flex items-center gap-8">
                        <div class="text-right">
                            <div class="text-brand-dark font-black">$${inv.amount}</div>
                            <div class="text-emerald-500 text-[10px] font-black uppercase">+${inv.current_profit || 0}$ Reçus</div>
                        </div>
                        ${canRefund ? `<button onclick="refundInvestment('${inv.id}')" class="text-rose-400 text-[9px] font-black uppercase border border-rose-100 px-3 py-2 rounded-lg hover:bg-rose-50 transition">Annuler & Rembourser</button>` : `<span class="text-slate-300 text-[9px] font-black uppercase cursor-not-allowed">Remboursement clos</span>`}
                    </div>
                </div>
            `}).join('');
        }
    } catch (e) {
        console.error("Erreur Dashboard Investisseur:", e);
    }
}

function openInvestModal(id, title) {
    const amount = prompt(`Combien souhaitez-vous investir dans "${title}" ? (en USD)`);
    if (amount && !isNaN(amount)) {
        processInvestment(id, parseFloat(amount));
    }
}

async function processInvestment(eventId, amount) {
    const profile = getLocalProfile();
    initSupabase();
    const { error } = await sb.from('event_investments').insert({
        event_id: eventId,
        investor_id: profile.id,
        amount: amount,
        status: 'completed'
    });
    if (!error) {
        alert("Investissement validé ! Merci de soutenir LeGrandArt.");
        populateInvestorDashboard();
    }
}

async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;

    try {
        initSupabase();
        if (sb) {
            const { data: events = [], error } = await sb
                .from('events')
                .select('*')
                .eq('status', 'approved')
                .order('date', { ascending: true });

            if (!error && events.length > 0) {
                container.innerHTML = events.map(event => `
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
                return;
            }
        }

        container.innerHTML = '<p class="text-gray-400 text-center py-20 uppercase text-xs font-black tracking-widest">Aucun événement approuvé pour le moment.</p>';
    } catch (e) {
        console.error("Erreur lors du chargement des événements:", e);
        container.innerHTML = '<p class="text-red-500 text-center py-20 uppercase text-[10px] font-black">Erreur de chargement des événements</p>';
    }
}

async function loadShops() {
    const container = document.getElementById('dynamic-shops');
    if (!container) return;

    let shops = []; // Initialize as empty, will be populated from Supabase or defaults
    
    // 1. Tentative de chargement depuis Supabase (Boutiques réelles du Dashboard)
    initSupabase();
    if (sb) {
        try {
            const { data: cloudShops, error } = await sb
                .from('boutique_config')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!error && cloudShops && cloudShops.length > 0) {
                const formattedShops = cloudShops.map(s => ({
                    owner: s.name,
                    shopName: s.name,
                    description: s.slogan,
                    tags: s.default_category || 'Boutique Cloud',
                    image: s.logo_url || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800',
                    // On redirige vers le dashboard ou une vue boutique (à créer)
                    href: `dashboard.html?preview=${s.shop_id}` 
                }));
                shops = formattedShops;
            }
        } catch (e) {
            console.error("Erreur chargement Supabase:", e);
        }
    }

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

async function showMyShops() {
    const section = document.getElementById('content-list');
    section.innerHTML = '<div class="text-gray-600 text-xs uppercase tracking-widest text-center py-20 italic">Chargement de vos boutiques...</div>';

    const profile = getLocalProfile();
    if (!profile || !profile.email) {
        section.innerHTML = '<p class="text-gray-400">Veuillez vous connecter pour voir vos boutiques.</p>';
        return;
    }

    initSupabase();
    if (!sb) {
        section.innerHTML = '<p class="text-red-500">Erreur: Supabase non initialisé.</p>';
        return;
    }

    try {
        const { data: supabaseShops, error } = await sb
            .from('boutique_config')
            .select('*')
            .eq('owner_id', profile.email) // Filter by the owner's email
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (supabaseShops && supabaseShops.length > 0) {
            // Map Supabase data to the expected format for rendering
            const shopsToRender = supabaseShops.map(shop => ({
                id: shop.shop_id, // Use Supabase shop_id
                shopName: shop.name,
                description: shop.slogan,
                country: shop.contact_info?.address?.split(', ').pop() || '', // Extract country from address if available
                city: shop.contact_info?.address?.split(', ')[0] || '', // Extract city from address if available
                tags: shop.default_category,
                image: shop.logo_url,
                owner: profile.name // Keep owner name for display if needed
            }));

            // Mise à jour des compteurs statistiques dans l'interface
            if (document.getElementById('stat-total-items')) document.getElementById('stat-total-items').innerText = shopsToRender.length;
            if (document.getElementById('stat-label')) document.getElementById('stat-label').innerText = 'Boutiques';

            section.innerHTML = shopsToRender.map((shop) => `
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
    `).join('');
        } else {
            section.innerHTML = '<p class="text-gray-400">Vous n’avez pas encore de boutique enregistrée. Créez-en une avec le formulaire ci-dessus.</p>';
        }
    } catch (e) {
        console.error("Erreur lors du chargement des boutiques depuis Supabase:", e);
        section.innerHTML = '<p class="text-red-500">Erreur lors du chargement de vos boutiques.</p>';
    }
}

async function showMyArtworks() {
    const section = document.getElementById('content-list');
    section.innerHTML = '<div class="text-gray-600 text-xs uppercase tracking-widest text-center py-20 italic">Chargement de vos œuvres...</div>';

    const profile = getLocalProfile();
    if (!profile || !profile.name) {
        section.innerHTML = '<p class="text-gray-400">Veuillez vous connecter pour voir vos œuvres.</p>';
        return;
    }

    initSupabase();
    if (!sb) {
        section.innerHTML = '<p class="text-red-500">Erreur: Supabase non initialisé.</p>';
        return;
    }

    try {
        const { data: supabaseArtworks, error } = await sb
            .from('boutique_products')
            .select('*')
            .eq('owner_id', profile.name) // Filter by the artist's name
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (supabaseArtworks && supabaseArtworks.length > 0) {
            // Map Supabase data to the expected format for rendering
            const artworksToRender = supabaseArtworks.map(art => ({
                id: art.id,
                artist: profile.name, // Assuming current user is the artist
                title: art.name,
                image: art.img_url,
                description: art.description,
                date: new Date(art.created_at).toLocaleDateString() // Format date
            }));

            // Mise à jour des compteurs statistiques dans l'interface
            if (document.getElementById('stat-total-items')) document.getElementById('stat-total-items').innerText = artworksToRender.length;
            if (document.getElementById('stat-label')) document.getElementById('stat-label').innerText = 'Œuvres';

            section.innerHTML = artworksToRender.map((art) => `
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
    `).join('');
        } else {
            section.innerHTML = '<p class="text-gray-400">Aucune œuvre publiée pour l’instant. Utilisez le formulaire pour ajouter votre première création.</p>';
        }
    } catch (e) {
        console.error("Erreur lors du chargement des œuvres depuis Supabase:", e);
        section.innerHTML = '<p class="text-red-500">Erreur lors du chargement de vos œuvres.</p>';
    }
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
        image: document.getElementById('shop-image').value || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800' // Default image
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
        image: document.getElementById('art-image').value || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=800', // Default image
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

async function editShop(shopId) {
    initSupabase();
    if (!sb) {
        alert("Erreur: Supabase non initialisé.");
        return;
    }

    try {
        const { data: shop, error: fetchError } = await sb
            .from('boutique_config')
            .select('*')
            .eq('shop_id', shopId)
            .single();

        if (fetchError) throw fetchError;
        if (!shop) {
            alert('Boutique non trouvée.');
            return;
        }

        const newName = prompt('Nouveau nom de boutique:', shop.name);
        const newSlogan = prompt('Nouvelle description:', shop.slogan);
        const newTags = prompt('Nouvelles catégories:', shop.default_category);
        const newAddress = prompt('Nouvelle adresse:', shop.contact_info?.address || '');

        if (newName !== null && newSlogan !== null) { // Check for null to see if user cancelled
            const updatedContactInfo = { ...shop.contact_info, address: newAddress };
            const { error: updateError } = await sb
                .from('boutique_config')
                .update({
                    name: newName,
                    slogan: newSlogan,
                    default_category: newTags,
                    contact_info: updatedContactInfo,
                    updated_at: new Date().toISOString()
                })
                .eq('shop_id', shopId);

            if (updateError) throw updateError;
            showMyShops(); // Refresh the list
            alert('Boutique mise à jour avec succès !');
        }
    } catch (e) {
        console.error("Erreur lors de l'édition de la boutique:", e);
        alert("Erreur lors de l'édition de la boutique.");
    }
}

async function deleteShop(shopId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette boutique ? Cette action est irréversible.')) return;

    initSupabase();
    if (!sb) {
        alert("Erreur: Supabase non initialisé.");
        return;
    }

    try {
        const { error } = await sb
            .from('boutique_config')
            .delete()
            .eq('shop_id', shopId);

        if (error) throw error;
        showMyShops(); // Refresh the list
        alert('Boutique supprimée avec succès !');
    } catch (e) {
        console.error("Erreur lors de la suppression de la boutique:", e);
        alert("Erreur lors de la suppression de la boutique.");
    }
}

async function editArtwork(artId) {
    initSupabase();
    if (!sb) {
        alert("Erreur: Supabase non initialisé.");
        return;
    }

    try {
        const { data: artwork, error: fetchError } = await sb
            .from('boutique_products')
            .select('*')
            .eq('id', artId)
            .single();

        if (fetchError) throw fetchError;
        if (!artwork) {
            alert('Œuvre non trouvée.');
            return;
        }

        const newTitle = prompt('Nouveau titre:', artwork.name);
        const newDesc = prompt('Nouvelle description:', artwork.description);
        const newImage = prompt('Nouvelle URL image:', artwork.img_url);

        if (newTitle !== null && newDesc !== null) { // Check for null to see if user cancelled
            const { error: updateError } = await sb
                .from('boutique_products')
                .update({
                    name: newTitle,
                    description: newDesc,
                    img_url: newImage,
                    updated_at: new Date().toISOString()
                })
                .eq('id', artId);

            if (updateError) throw updateError;
            showMyArtworks(); // Refresh the list
            alert('Œuvre mise à jour avec succès !');
        }
    } catch (e) {
        console.error("Erreur lors de l'édition de l'œuvre:", e);
        alert("Erreur lors de l'édition de l'œuvre.");
    }
}

async function deleteArtwork(artId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette œuvre ? Cette action est irréversible.')) return;

    initSupabase();
    if (!sb) {
        alert("Erreur: Supabase non initialisé.");
        return;
    }

    try {
        const { error } = await sb
            .from('boutique_products')
            .delete()
            .eq('id', artId);

        if (error) throw error;
        showMyArtworks(); // Refresh the list
        alert('Œuvre supprimée avec succès !');
    } catch (e) {
        console.error("Erreur lors de la suppression de l'œuvre:", e);
        alert("Erreur lors de la suppression de l'œuvre.");
    }
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
    // On initialise et on vérifie la session immédiatement
    checkAuthPersistence().then(() => {
        if (document.getElementById('dashboard-page') && !getLocalProfile()) {
            window.location.href = 'index.html?openLogin=true';
            return;
        }
    });

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
