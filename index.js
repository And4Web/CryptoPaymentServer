const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

// 1. Import Official Bitcoin Cryptography Engines
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const ECPair = ECPairFactory(ecc); // Initializes the elliptic curve module

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fallback fixed wallet keys for non-BTC currencies
const WALLETS = {
    eth: '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',
    ltc: 'tltc1qypv0e33wuxa6wlhqntpftglv8dclpsas43r8sn',
    xmr: '44AFFq5kSiGbBzUqcwvV9C... (Your Monero View Address)'
};

// Create Payment Request Endpoint
app.post('/api/create-charge', async (req, res) => {
    const { currency, amount } = req.body;
    let depositAddress = '';

    try {
        if (currency.toLowerCase() === 'btc') {
            // 2. Safely Generate a Random Native SegWit (Bech32) Bitcoin Testnet Address
            const testnet = bitcoin.networks.testnet; // Toggle to bitcoin.networks.bitcoin for production
            const keyPair = ECPair.makeRandom({ network: testnet });
            
            const p2wpkh = bitcoin.payments.p2wpkh({ 
                pubkey: keyPair.publicKey, 
                network: testnet 
            });
            
            depositAddress = p2wpkh.address;

            // DEVELOPER WARNING: Log the private key format securely so you can claim funds later
            console.log(`[DEV ONLY] Generated New BTC Wallet - Address: ${depositAddress} WIF-Key: ${keyPair.toWIF()}`);
        } else if (WALLETS[currency]) {
            depositAddress = WALLETS[currency];
        } else {
            return res.status(400).json({ error: 'Unsupported currency selected.' });
        }

        // 3. Render URI and QR codes cleanly
        const cryptoUri = `${currency}:${depositAddress}?amount=${amount}`;
        const qrCodeDataUrl = await QRCode.toDataURL(cryptoUri);
        const invoiceId = 'inv_' + Math.random().toString(36).substring(2, 9);

        // Run the background simulation
        monitorBlockchain(invoiceId, currency, depositAddress, amount);

        res.json({
            invoiceId,
            address: depositAddress,
            qrCode: qrCodeDataUrl,
            amount,
            currency: currency.toUpperCase()
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate modern crypto address.' });
    }
});

function monitorBlockchain(invoiceId, currency, address, amount) {
    console.log(`[Scanning] Watching ${currency} network for payments to ${address}`);
    setTimeout(() => {
        console.log(`[Success] Payment confirmed for invoice: ${invoiceId}`);
        io.emit(`payment_confirmed_${invoiceId}`, { status: 'confirmed' });
    }, 8000);
}

const PORT = 3000;
server.listen(PORT, () => console.log(`Crypto Server active on http://localhost:${PORT}`));