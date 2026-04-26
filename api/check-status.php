const crypto = require("crypto");

const PROJECT_SLUG = process.env.PAKASIR_PROJECT || "cupzyyy";
const API_KEY = process.env.PAKASIR_API_KEY || "x5ex44h3cexOAvi37EOEKMlFvRPsGa3f";
const BASE_URL = "https://app.pakasir.com/api";

module.exports = async (req, res) => {
    // SET CORS HEADERS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    try {
        const { order_id, amount } = req.body;
        
        console.log('[CHECK-STATUS] Checking:', order_id);
        
        if (!order_id) {
            return res.json({ ok: false, error: "Order ID diperlukan" });
        }
        
        const fetch = require('node-fetch');
        
        // Ambil dari Firebase dulu
        const orderRes = await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`);
        const order = await orderRes.json();
        
        // Kalo udah paid, langsung return
        if (order && order.status === 'paid') {
            return res.json({ ok: true, status: 'paid', order_id });
        }
        
        // Kalo udah expired
        if (order && order.expired_at && new Date(order.expired_at) < new Date()) {
            await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'expired' })
            });
            return res.json({ ok: true, status: 'expired', order_id });
        }
        
        // Cek ke Pakasir
        try {
            const apiRes = await fetch(`${BASE_URL}/transactiondetail?project=${PROJECT_SLUG}&amount=${amount || order?.nominal || 0}&order_id=${order_id}&api_key=${API_KEY}`);
            const json = await apiRes.json();
            const transaction = json.transaction;
            
            if (transaction) {
                const rawStatus = String(transaction.status).toLowerCase();
                let status = 'pending';
                
                if (['paid', 'success', 'settlement', 'completed', 'done'].includes(rawStatus)) {
                    status = 'paid';
                    
                    // Update order di Firebase
                    await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'paid',
                            paid_at: transaction.completed_at || new Date().toISOString()
                        })
                    });
                    
                    // Update saldo user
                    if (order && order.user_id && order.nominal) {
                        const userRes = await fetch(`https://database-cupz-default-rtdb.firebaseio.com/users/${order.user_id}.json`);
                        const user = await userRes.json();
                        const newSaldo = (user.saldo || 0) + order.nominal;
                        
                        await fetch(`https://database-cupz-default-rtdb.firebaseio.com/users/${order.user_id}/saldo.json`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newSaldo)
                        });
                        
                        await fetch(`https://database-cupz-default-rtdb.firebaseio.com/users/${order.user_id}/total_deposit.json`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify((user.total_deposit || 0) + order.nominal)
                        });
                    }
                } else if (['expired', 'expire', 'timeout', 'cancelled'].includes(rawStatus)) {
                    status = 'expired';
                    await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'expired' })
                    });
                }
                
                return res.json({ ok: true, status, order_id });
            }
        } catch (pakasirError) {
            console.error('[CHECK-STATUS] Pakasir error:', pakasirError.message);
        }
        
        // Default return pending
        return res.json({ ok: true, status: order?.status || 'pending', order_id });
        
    } catch (error) {
        console.error("[CHECK-STATUS] ERROR:", error.message);
        return res.json({ ok: false, error: error.message });
    }
};