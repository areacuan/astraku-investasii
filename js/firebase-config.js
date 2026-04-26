// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCf230zCliSZ9EYLByMnmflqw8sOz328Uc",
    authDomain: "database-cupz.firebaseapp.com",
    projectId: "database-cupz",
    storageBucket: "database-cupz.firebasestorage.app",
    messagingSenderId: "343357519412",
    appId: "1:343357519412:web:dce862636c7c459e6a3c61"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Helper Functions
function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(angka);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getRemainingDays(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

// Tambahkan ke window global
window.formatRupiah = formatRupiah;
window.formatDate = formatDate;
window.getRemainingDays = getRemainingDays;
window.db = db;
