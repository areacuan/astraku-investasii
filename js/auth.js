// Auth Management
let currentUser = null;

// Cek session dari localStorage
function checkSession() {
    const userData = localStorage.getItem('astraku_user');
    if (userData) {
        currentUser = JSON.parse(userData);
        return currentUser;
    }
    return null;
}

// Login function
async function login(username, password) {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        
        let foundUser = null;
        for (let uid in users) {
            if ((users[uid].username === username || users[uid].email === username) && users[uid].password === password) {
                foundUser = { uid, ...users[uid] };
                break;
            }
        }
        
        if (foundUser) {
            if (foundUser.banned) {
                return { success: false, error: 'Akun Anda telah diblokir' };
            }
            delete foundUser.password;
            localStorage.setItem('astraku_user', JSON.stringify(foundUser));
            currentUser = foundUser;
            return { success: true, user: foundUser };
        }
        return { success: false, error: 'Username/Email atau password salah' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Register function
async function register(userData) {
    try {
        // Cek username/email unik
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        
        for (let uid in users) {
            if (users[uid].username === userData.username) {
                return { success: false, error: 'Username sudah digunakan' };
            }
            if (users[uid].email === userData.email) {
                return { success: false, error: 'Email sudah digunakan' };
            }
        }
        
        // Generate kode referral unik
        const referralCode = userData.username.toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // Simpan user baru
        const newUserRef = usersRef.push();
        const newUser = {
            ...userData,
            referral_code: referralCode,
            saldo: 0,
            total_deposit: 0,
            total_withdraw: 0,
            total_return: 0,
            referral_bonus: 0,
            total_referral: 0,
            created_at: new Date().toISOString(),
            banned: false
        };
        
        delete newUser.konfirmasi_password;
        await newUserRef.set(newUser);
        
        // Proses referral jika ada kode
        if (userData.ref_code) {
            let uplineFound = false;
            for (let uid in users) {
                if (users[uid].referral_code === userData.ref_code) {
                    const uplineRef = db.ref('users/' + uid);
                    const uplineSnapshot = await uplineRef.once('value');
                    const upline = uplineSnapshot.val();
                    await uplineRef.update({
                        total_referral: (upline.total_referral || 0) + 1
                    });
                    uplineFound = true;
                    break;
                }
            }
        }
        
        return { success: true, uid: newUserRef.key };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Logout
function logout() {
    localStorage.removeItem('astraku_user');
    currentUser = null;
    window.location.href = 'index.html';
}

// Update navbar berdasarkan session
function updateNavbar() {
    const navButtons = document.getElementById('nav-buttons');
    if (!navButtons) return;
    
    const user = checkSession();
    if (user) {
        navButtons.innerHTML = `
            <span class="text-gray-600 mr-2">Halo, ${user.username}</span>
            <a href="dashboard.html" class="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">Dashboard</a>
            <a href="profile.html" class="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">Profile</a>
            <button onclick="logout()" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Logout</button>
        `;
    } else {
        navButtons.innerHTML = `
            <a href="login.html" class="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">Login</a>
            <a href="register.html" class="px-4 py-2 gradient-bg text-white rounded-lg hover:opacity-90 transition">Daftar</a>
        `;
    }
}

// Cek akses halaman (harus login)
function requireAuth() {
    const user = checkSession();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

// Cek akses admin
function requireAdmin() {
    const user = checkSession();
    if (!user || user.role !== 'admin') {
        window.location.href = '../index.html';
        return null;
    }
    return user;
}