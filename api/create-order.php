export default async function handler(req, res) {
    // Set CORS
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
        
        // Validasi
        if (!nominal || nominal < 25000) {
            return res.status(400).json({ ok: false, error: 'Minimal deposit Rp25.000' });
        }
        
        // TODO: Panggil API Pakasir di sini
        
        // Sementara return dummy dulu buat testing
        return res.status(200).json({
            ok: true,
            order_id: 'TEST-' + Date.now(),
            total_payment: nominal,
            qris: '00020101021198650012COM.QRIS.WWW01154360000000000000000TEST',
            expired_at: new Date(Date.now() + 30 * 60000).toISOString()
        });
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}