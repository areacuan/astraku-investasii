/**
 * AstraKu Investasi - Webhook Receiver
 * Endpoint: POST /api/webhook.js
 * 
 * Setup URL ini di dashboard Pakasir:
 * https://astraku-investasi.vercel.app/api/webhook
 */

const axios = require('axios');

// Firebase config (untuk update saldo)
const FIREBASE_URL = 'https://database-cupz-default-rtdb.firebaseio.com';

async function updateUserBalance(userId, amount) {
    try {
        // Ambil saldo saat ini
        const getRes = await axios.get(`${FIREBASE_URL}/users/${userId}/saldo.json`);
        const currentSaldo = getRes.data || 0;
        
        // Update saldo
        const newSaldo = currentSaldo + amount;
        await axios.put(`${FIREBASE_URL}/users/${userId}/saldo.json`, JSON.stringify(newSaldo), {
            headers: { 'Content-Type': 'application/json' }
        });
        
        // Update total deposit
        const getDeposit = await axios.get(`${FIREBASE_URL}/users/${userId}/total_deposit.json`);
        const currentDeposit = getDeposit.data || 0;
        await axios.put(`${FIREBASE_URL}/users/${userId}/total_deposit.json`, JSON.stringify(currentDeposit + amount));
        
        return true;
    } catch (error) {
        console.error('Update balance error:', error);
        return false;
    }
}

async function updateOrderStatus(orderId, status, paidAt) {
    try {
        await axios.patch(`${FIREBASE_URL}/orders/${orderId}.json`, JSON.stringify({
            status: status,
            paid_at: paidAt
        }), { headers: { 'Content-Type': 'application/json' } });
        return true;
    } catch (error) {
        console.error('Update order error:', error);
        return false;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ received: false });
    }
    
    try {
        const payload = req.body;
        console.log('[WEBHOOK] Received:', JSON.stringify(payload));
        
        const { order_id, status, amount, project } = payload;
        
        // Validasi project
        if (project && project !== 'cupzyyy') {
            return res.status(200).json({ received: true, message: 'Project mismatch' });
        }
        
        if (!order_id) {
            return res.status(200).json({ received: true, message: 'No order_id' });
        }
        
        // Cek status pembayaran
        const isPaid = ['paid', 'success', 'settlement'].includes(String(status).toLowerCase());
        
        if (isPaid) {
            // Ambil data order dari Firebase
            const orderRes = await axios.get(`${FIREBASE_URL}/orders/${order_id}.json`);
            const order = orderRes.data;
            
            if (order && order.status !== 'paid') {
                // Update status order
                await updateOrderStatus(order_id, 'paid', new Date().toISOString());
                
                // Update saldo user
                if (order.user_id && order.nominal) {
                    await updateUserBalance(order.user_id, order.nominal);
                    console.log(`[WEBHOOK] Saldo updated for user: ${order.user_id} +${order.nominal}`);
                }
            }
        }
        
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('[WEBHOOK] Error:', error);
        return res.status(200).json({ received: true, error: error.message });
    }
};
