/**
 * AstraKu Investasi - Check Payment Status API
 * Endpoint: POST /api/check-status.js
 * 
 * Body: { "order_id": "AST-xxx", "amount": 25000 }
 */

const axios = require('axios');

const PAKASIR_CONFIG = {
    project_slug: process.env.PAKASIR_PROJECT || 'cupzyyy',
    api_key: process.env.PAKASIR_API_KEY || 'x5ex44h3cexOAvi37EOEKMlFvRPsGa3f',
    base_url: 'https://app.pakasir.com/api'
};

function normalizeStatus(rawStatus) {
    const status = String(rawStatus).toLowerCase().trim();
    const paid = ['paid', 'success', 'settlement', 'completed', 'done'];
    const expired = ['expired', 'expire', 'timeout', 'cancelled'];
    
    if (paid.includes(status)) return 'paid';
    if (expired.includes(status)) return 'expired';
    return 'pending';
}

module.exports = async (req, res) => {
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
        const { order_id, amount } = req.body;
        
        if (!order_id) {
            return res.status(400).json({ ok: false, error: 'Order ID diperlukan' });
        }
        
        // Panggil API Pakasir
        const response = await axios.get(
            `${PAKASIR_CONFIG.base_url}/transactiondetail`,
            {
                params: {
                    project: PAKASIR_CONFIG.project_slug,
                    amount: amount,
                    order_id: order_id,
                    api_key: PAKASIR_CONFIG.api_key
                },
                timeout: 30000
            }
        );
        
        const data = response.data;
        const transaction = data.transaction;
        
        if (!transaction) {
            return res.status(200).json({ ok: true, status: 'pending' });
        }
        
        const status = normalizeStatus(transaction.status);
        
        return res.status(200).json({
            ok: true,
            status: status,
            order_id: order_id,
            paid_at: transaction.completed_at || null
        });
        
    } catch (error) {
        console.error('Check status error:', error);
        return res.status(500).json({ 
            ok: false, 
            error: error.message || 'Internal server error' 
        });
    }
};