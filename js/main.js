// Data Paket Investasi
const PAKET_INVESTASI = {
    v1: { nama: 'Pot Astraku v1', min: 100000, max: 500000, return: 2, hari: 10, icon: '🌱' },
    v2: { nama: 'Pot Astraku v2', min: 500000, max: 2000000, return: 3, hari: 15, icon: '🌿' },
    v3: { nama: 'Pot Astraku v3', min: 2000000, max: 10000000, return: 5, hari: 20, icon: '🌳' },
    v4: { nama: 'Pot Astraku v4', min: 10000000, max: Infinity, return: 7, hari: 30, icon: '🏆' }
};

// Load total dana dan user
async function loadStats() {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        
        let totalSaldo = 0;
        let activeUsers = 0;
        
        for (let uid in users) {
            if (!users[uid].banned) {
                activeUsers++;
                totalSaldo += users[uid].saldo || 0;
            }
        }
        
        document.getElementById('total-dana')?.innerHTML = formatRupiah(totalSaldo);
        document.getElementById('total-user')?.innerHTML = activeUsers;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load paket investasi
function loadPaket() {
    const container = document.getElementById('paket-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let [key, paket] of Object.entries(PAKET_INVESTASI)) {
        container.innerHTML += `
            <div class="bg-white rounded-xl shadow-lg p-6 card-hover border border-gray-100">
                <div class="text-4xl mb-3">${paket.icon}</div>
                <h3 class="text-xl font-bold text-blue-900">${paket.nama}</h3>
                <p class="text-gray-600 text-sm mt-2">💰 ${formatRupiah(paket.min)} - ${paket.max === Infinity ? 'Tak Terbatas' : formatRupiah(paket.max)}</p>
                <p class="text-green-600 font-bold mt-2">📈 Return ${paket.return}% / hari</p>
                <p class="text-gray-500 text-sm">⏱️ ${paket.hari} hari</p>
                <button onclick="pilihPaket('${key}')" class="mt-4 w-full gradient-bg text-white py-2 rounded-lg hover:opacity-90 transition">Pilih</button>
            </div>
        `;
    }
}

// Pilih paket
function pilihPaket(paketKey) {
    const user = checkSession();
    if (!user) {
        document.getElementById('login-warning')?.classList.remove('hidden');
        document.getElementById('investasi-form')?.classList.add('hidden');
        return;
    }
    
    document.getElementById('login-warning')?.classList.add('hidden');
    document.getElementById('investasi-form')?.classList.remove('hidden');
    
    const paket = PAKET_INVESTASI[paketKey];
    const select = document.getElementById('paket-select');
    const rangeInfo = document.getElementById('range-info');
    
    if (select) {
        select.value = paketKey;
        rangeInfo.innerHTML = `Minimal ${formatRupiah(paket.min)} - Maksimal ${paket.max === Infinity ? 'Tak Terbatas' : formatRupiah(paket.max)}`;
    }
}

// Inisialisasi form investasi
function initInvestasiForm() {
    const form = document.getElementById('investasi-form');
    if (!form) return;
    
    // Isi dropdown paket
    const select = document.getElementById('paket-select');
    for (let [key, paket] of Object.entries(PAKET_INVESTASI)) {
        select.innerHTML += `<option value="${key}">${paket.nama} (${paket.return}% / hari, ${paket.hari} hari)</option>`;
    }
    
    select.addEventListener('change', function() {
        const paket = PAKET_INVESTASI[this.value];
        if (paket) {
            document.getElementById('range-info').innerHTML = `Minimal ${formatRupiah(paket.min)} - Maksimal ${paket.max === Infinity ? 'Tak Terbatas' : formatRupiah(paket.max)}`;
        }
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = checkSession();
        if (!user) {
            alert('Silakan login terlebih dahulu');
            return;
        }
        
        const paketKey = select.value;
        const nominal = parseInt(document.getElementById('nominal-investasi').value);
        
        if (!paketKey) {
            alert('Pilih paket terlebih dahulu');
            return;
        }
        
        const paket = PAKET_INVESTASI[paketKey];
        if (nominal < paket.min) {
            alert(`Minimal investasi ${formatRupiah(paket.min)}`);
            return;
        }
        if (paket.max !== Infinity && nominal > paket.max) {
            alert(`Maksimal investasi ${formatRupiah(paket.max)}`);
            return;
        }
        if (nominal > user.saldo) {
            alert('Saldo tidak mencukupi');
            return;
        }
        
        // Kurangi saldo
        const newSaldo = user.saldo - nominal;
        await db.ref('users/' + user.uid).update({ saldo: newSaldo });
        
        // Buat investasi
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + paket.hari);
        
        const investasiData = {
            user_id: user.uid,
            username: user.username,
            paket: paketKey,
            paket_nama: paket.nama,
            nominal: nominal,
            return_persen: paket.return,
            return_harian: (nominal * paket.return / 100),
            hari_total: paket.hari,
            hari_tersisa: paket.hari,
            status: 'aktif',
            created_at: new Date().toISOString(),
            end_date: endDate.toISOString(),
            total_return_diterima: 0
        };
        
        await db.ref('investasi/' + Date.now()).set(investasiData);
        
        // Update user di localStorage
        user.saldo = newSaldo;
        localStorage.setItem('astraku_user', JSON.stringify(user));
        currentUser = user;
        
        alert('Investasi berhasil!');
        document.getElementById('nominal-investasi').value = '';
        loadRiwayatInvestasi();
    });
}

// Load riwayat investasi
async function loadRiwayatInvestasi() {
    const container = document.getElementById('riwayat-container');
    if (!container) return;
    
    const user = checkSession();
    if (!user) {
        container.innerHTML = '<p class="text-gray-500 text-center">Silakan login untuk melihat riwayat investasi</p>';
        return;
    }
    
    try {
        const snapshot = await db.ref('investasi').once('value');
        const investasi = snapshot.val() || {};
        
        let html = '';
        let hasInvestasi = false;
        
        for (let id in investasi) {
            const inv = investasi[id];
            if (inv.user_id === user.uid) {
                hasInvestasi = true;
                const sisaHari = getRemainingDays(inv.end_date);
                const statusBadge = inv.status === 'aktif' 
                    ? `<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Aktif (sisa ${sisaHari} hari)</span>`
                    : `<span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Selesai</span>`;
                
                html += `
                    <div class="bg-white rounded-lg p-4 shadow-sm">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-semibold">${inv.paket_nama}</p>
                                <p class="text-sm text-gray-600">${formatRupiah(inv.nominal)}</p>
                                <p class="text-xs text-gray-500">Mulai: ${formatDate(inv.created_at)}</p>
                            </div>
                            <div class="text-right">
                                ${statusBadge}
                                <p class="text-sm text-green-600 mt-1">Return: ${inv.return_persen}% / hari</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = hasInvestasi ? html : '<p class="text-gray-500 text-center">Belum ada investasi</p>';
    } catch (error) {
        console.error('Error loading riwayat:', error);
    }
}

// Sistem auto return (dijalankan saat load)
async function checkAndProcessReturns() {
    const lastRun = localStorage.getItem('last_return_run');
    const today = new Date().toDateString();
    
    if (lastRun === today) return;
    
    try {
        const snapshot = await db.ref('investasi').once('value');
        const investasi = snapshot.val() || {};
        const usersUpdate = {};
        
        for (let id in investasi) {
            const inv = investasi[id];
            if (inv.status === 'aktif') {
                const sisaHari = getRemainingDays(inv.end_date);
                const newSisaHari = sisaHari - 1;
                
                if (newSisaHari <= 0) {
                    // Investasi selesai
                    usersUpdate[inv.user_id] = (usersUpdate[inv.user_id] || 0) + inv.return_harian;
                    await db.ref('investasi/' + id).update({ 
                        status: 'selesai', 
                        hari_tersisa: 0,
                        selesai_pada: new Date().toISOString()
                    });
                } else {
                    // Tambah return
                    usersUpdate[inv.user_id] = (usersUpdate[inv.user_id] || 0) + inv.return_harian;
                    await db.ref('investasi/' + id).update({ 
                        hari_tersisa: newSisaHari,
                        total_return_diterima: (inv.total_return_diterima || 0) + inv.return_harian
                    });
                }
            }
        }
        
        // Update saldo user
        for (let uid in usersUpdate) {
            const userSnapshot = await db.ref('users/' + uid).once('value');
            const userData = userSnapshot.val();
            const newSaldo = (userData.saldo || 0) + usersUpdate[uid];
            await db.ref('users/' + uid).update({ 
                saldo: newSaldo,
                total_return: (userData.total_return || 0) + usersUpdate[uid]
            });
        }
        
        localStorage.setItem('last_return_run', today);
    } catch (error) {
        console.error('Error processing returns:', error);
    }
}

// Inisialisasi halaman
document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
    loadStats();
    loadPaket();
    initInvestasiForm();
    loadRiwayatInvestasi();
    checkAndProcessReturns();
    
    // Refresh setiap 5 menit
    setInterval(() => {
        loadStats();
        loadRiwayatInvestasi();
    }, 300000);
});