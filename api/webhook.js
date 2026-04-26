const PROJECT_SLUG = process.env.PAKASIR_PROJECT || "cupzyyy";

module.exports = async (req, res) => {
    // Webhook harus response cepat
    if (req.method !== "POST") {
        return res.status(405).json({ received: false });
    }

    try {
        const payload = req.body;
        console.log('[WEBHOOK] Received:', JSON.stringify(payload));
        
        const { order_id, status, amount, project } = payload;
        
        // Validasi project
        if (project && project !== PROJECT_SLUG) {
            return res.status(200).json({ received: true, message: 'Project mismatch' });
        }
        
        if (!order_id) {
            return res.status(200).json({ received: true, message: 'No order_id' });
        }
        
        const fetch = require('node-fetch');
        
        // Cek apakah pembayaran sukses
        const isPaid = ['paid', 'success', 'settlement', 'completed', 'done'].includes(String(status).toLowerCase());
        
        if (isPaid) {
            // Ambil order dari Firebase
            const orderRes = await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`);
            const order = await orderRes.json();
            
            if (order && order.status !== 'paid') {
                // Update status order
                await fetch(`https://database-cupz-default-rtdb.firebaseio.com/orders/${order_id}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    })
                });
                
                // Update saldo user
                if (order.user_id && order.nominal) {
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
                    
                    console.log(`[WEBHOOK] Saldo updated: ${order.user_id} +${order.nominal}`);
                }
            }
        }
        
        // Webhook harus selalu return 200 OK
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('[WEBHOOK] Error:', error.message);
        return res.status(200).json({ received: true, error: error.message });
    }
};
