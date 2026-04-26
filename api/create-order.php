/**
 * AstraKu Investasi - Create Order API (Pakasir Real)
 * Endpoint: POST /api/create-order.js
 * 
 * Body: { "nominal": 25000, "user_id": "xxx", "email": "user@email.com" }
 */

const axios = require('axios');

// Konfigurasi Pakasir
const PAKASIR_CONFIG = {
    project_slug: process.env.PAKASIR_PROJECT || 'cupzyyy',
    api_key: process.env.PAKASIR_API_KEY || 'x5ex44h3cexOAvi37EOEKMlFvRPsGa3f',
    base_url: 'https://app.pakasir.com/api'
};

const FEE_RATE = 0.007; // 0.7% fee QRIS

function generateOrderId() {
    return 'AST-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateGrossAmount(netAmount) {
    return Math.ceil(netAmount / (1 - FEE_RATE));
}

function extractQrisString(rawString) {
    if (!rawString) return null;
    if (rawString.startsWith('00020101')) return rawString;
    
    const pattern = /00020101[0-9A-Za-z]+/;
    const match = rawString.match(pattern);
    return match ? match[0] : null;
}

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    
    try {
        const { nominal, user_id, email } = req.body;
        
        if (!nominal || nominal < 25000) {
            return res.status(400).json({ ok: false, error: 'Minimal deposit Rp25.000' });
        }
        
        if (nominal > 25000000) {
            return res.status(400).json({ ok: false, error: 'Maksimal deposit Rp25.000.000' });
        }
        
        if (!user_id) {
            return res.status(400).json({ ok: false, error: 'User ID diperlukan' });
        }
        
        const grossAmount = calculateGrossAmount(nominal);
        const fee = grossAmount - nominal;
        const orderId = generateOrderId();
        
        // Panggil API Pakasir
        const response = await axios.post(
            `${PAKASIR_CONFIG.base_url}/transactioncreate/qris`,
            {
                project: PAKASIR_CONFIG.project_slug,
                order_id: orderId,
                amount: grossAmount,
                api_key: PAKASIR_CONFIG.api_key
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        const pakasirData = response.data;
        
        if (!pakasirData.payment) {
            throw new Error(pakasirData.message || 'Gagal membuat transaksi');
        }
        
        const payment = pakasirData.payment;
        const qrisString = extractQrisString(payment.payment_number);
        
        if (!qrisString) {
            throw new Error('Gagal mendapatkan QRIS string');
        }
        
        // Simpan order (opsional, bisa simpan ke Firebase nanti)
        const orderData = {
            order_id: orderId,
            type: 'deposit',
            nominal: nominal,
            fee: fee,
            total_amount: grossAmount,
            user_id: user_id,
            user_email: email,
            qris: qrisString,
            status: 'pending',
            created_at: new Date().toISOString(),
            expired_at: payment.expired_at || new Date(Date.now() + 30 * 60000).toISOString()
        };
        
        // Kirim response ke frontend
        return res.status(200).json({
            ok: true,
            order_id: orderId,
            nominal: nominal,
            total_payment: grossAmount,
            qris: qrisString,
            expired_at: orderData.expired_at
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        return res.status(500).json({ 
            ok: false, 
            error: error.message || 'Internal server error' 
        });
    }
};