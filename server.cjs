
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
    PublicKey,
    Transaction,
    Connection,
    VersionedTransaction
} = require('@solana/web3.js');

const { PUMP_SDK } = require('@pump-fun/pump-sdk');

// ==========================================
// CONFIGURACIÓN DEL SERVIDOR
// ==========================================

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const origin = new URL(
    process.env.APP_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${PORT}`
).origin;

const allowedHost = new URL(origin).host;

const rpc = process.env.SOLANA_RPC_URL ||
    'https://api.mainnet-beta.solana.com';

const connection = new Connection(rpc, 'confirmed');

// Archivos públicos autorizados.
const publicFiles = new Set([
    'index.html',
    'style.css',
    'app.js',
    ...['cases', 'lab', 'launch', 'vault'].flatMap(
        name => [name + '.css', name + '.js']
    ),
    'pump.js',
    'staking.js',
    'staking-config.json'
]);

const types = {
    '.json': 'application/json',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.jpg': 'image/jpeg'
};

// ==========================================
// PROCESAMIENTO DE PETICIONES
// ==========================================

async function body(req) {
    let size = 0;
    const chunks = [];

    for await (const chunk of req) {
        size += chunk.length;

        if (size > 2900000) {
            throw Error('Image exceeds upload limit.');
        }

        chunks.push(chunk);
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// ==========================================
// PINATA / IPFS
// ==========================================

async function pin(blob, name) {
    const data = new FormData();

    data.append('network', 'public');
    data.append('file', blob, name);

    const response = await fetch(
        'https://uploads.pinata.cloud/v3/files',
        {
            method: 'POST',
            body: data,
            headers: {
                Authorization: 'Bearer ' + process.env.PINATA_JWT
            },
            signal: AbortSignal.timeout(45000)
        }
    );

    if (!response.ok) {
        throw Error(
            'IPFS upload failed. Check the Pinata credentials and quota.'
        );
    }

    const cid = (await response.json()).data?.cid;

    if (!cid || !/^[a-zA-Z0-9]+$/.test(cid)) {
        throw Error('Invalid IPFS response.');
    }

    return 'https://ipfs.io/ipfs/' + cid;
}

// ==========================================
// PUMP.FUN - PREPARACIÓN DEL TOKEN
// ==========================================

async function prepare({
    name,
    symbol,
    description,
    website,
    logo,
    wallet,
    mint
}) {
    if (!process.env.PINATA_JWT) {
        throw Error('Set PINATA_JWT in the server environment.');
    }

    if (
        typeof name !== 'string' ||
        !name.trim() ||
        Buffer.byteLength(name) > 32 ||
        !/^[A-Z0-9]{1,10}$/.test(symbol) ||
        typeof description !== 'string' ||
        description.length > 200
    ) {
        throw Error(
            'Check the token name (32 UTF-8 bytes), ticker and description.'
        );
    }

    const user = new PublicKey(wallet);
    const mintKey = new PublicKey(mint);

    let image;

    if (logo === 'assets/brand.jpg') {
        image = new Blob(
            [await fs.readFile(path.join(__dirname, logo))],
            { type: 'image/jpeg' }
        );
    } else {
        const match =
            /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
                .exec(logo);

        if (!match) {
            throw Error('Invalid logo format.');
        }

        image = new Blob(
            [Buffer.from(match[2], 'base64')],
            { type: match[1] }
        );

        if (image.size > 2097152) {
            throw Error('Logo exceeds 2 MB.');
        }
    }

    // Verificación de Solana mainnet.
    const genesisHash = await connection.getGenesisHash();

    if (genesisHash !== '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d') {
        throw Error('Configure a Solana mainnet RPC.');
    }

    // Subida de imagen y metadatos a IPFS.
    const imageUri = await pin(
        image,
        'logo.' + image.type.split('/')[1]
    );

    const uri = await pin(
        new Blob(
            [JSON.stringify({
                name,
                symbol,
                description,
                website,
                image: imageUri,
                showName: true
            })],
            { type: 'application/json' }
        ),
        'metadata.json'
    );

    // Creación de la instrucción Pump.fun.
    const ix = await PUMP_SDK.createV2Instruction({
        mint: mintKey,
        user,
        creator: user,
        name,
        symbol,
        uri,
        mayhemMode: false
    });

    const block = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({
        feePayer: user,
        blockhash: block.blockhash,
        lastValidBlockHeight: block.lastValidBlockHeight
    }).add(ix);

    // Simulación previa a la firma de la wallet.
    const unsigned = new VersionedTransaction(tx.compileMessage());

    const simulation = await connection.simulateTransaction(
        unsigned,
        {
            sigVerify: false,
            commitment: 'confirmed'
        }
    );

    if (simulation.value.err) {
        throw Error(
            'Simulation rejected the launch: ' +
            JSON.stringify(simulation.value.err)
        );
    }

    const fee = await connection.getFeeForMessage(
        unsigned.message,
        'confirmed'
    );

    if (fee.value === null) {
        throw Error('Blockhash expired. Prepare the launch again.');
    }

    return {
        wire: Buffer.from(unsigned.serialize()).toString('base64'),
        uri,
        feeLamports: fee.value,
        ...block
    };
}

// ==========================================
// MÉTODOS RPC AUTORIZADOS
// ==========================================

const allowedRpc = new Set([
    'sendTransaction',
    'getSignatureStatuses',
    'getBlockHeight'
]);

// ==========================================
// SERVIDOR HTTP
// ==========================================

const server = http.createServer(async (req, res) => {

    const json = (code, value) => {
        res.writeHead(code, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        });

        res.end(JSON.stringify(value));
    };

    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
        const pathname = new URL(req.url, origin).pathname;

        // Endpoint de salud para Render.
        if (req.method === 'GET' && pathname === '/health') {
            return json(200, {
                status: 'ok',
                service: 'GURON',
                uptime: process.uptime()
            });
        }

        // Validación del dominio autorizado.
        if (req.headers.host !== allowedHost) {
            return json(403, {
                error: 'Unauthorized host.'
            });
        }

        // ==================================
        // ENDPOINTS API
        // ==================================

        if (req.method === 'POST') {

            // Impedir peticiones de otros orígenes.
            if (
                req.headers.origin !== origin ||
                !req.headers['content-type']?.startsWith('application/json')
            ) {
                return json(403, {
                    error: 'Unauthorized request origin.'
                });
            }

            const data = await body(req);

            // Preparar lanzamiento Pump.fun.
            if (pathname === '/api/pump/prepare') {
                return json(200, await prepare(data));
            }

            // Proxy RPC de Solana.
            if (
                pathname === '/api/rpc' &&
                allowedRpc.has(data.method)
            ) {
                const response = await fetch(rpc, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data),
                    signal: AbortSignal.timeout(20000)
                });

                return json(
                    response.status,
                    await response.json()
                );
            }

            return json(404, {
                error: 'Unknown endpoint.'
            });
        }

        // Limitar métodos HTTP.
        if (!['GET', 'HEAD'].includes(req.method)) {
            return json(405, {
                error: 'Method not allowed.'
            });
        }

        // ==================================
        // ARCHIVOS ESTÁTICOS
        // ==================================

        const name = pathname.slice(1) || 'index.html';

        let file;

        if (name === 'vendor/web3.js') {

            file = require.resolve('@solana/web3.js')
                .replace(/[^/\\]+$/, 'index.iife.min.js');

        } else if (
            publicFiles.has(name) ||
            /^assets\/[a-z0-9-]+\.jpg$/.test(name)
        ) {

            file = path.join(__dirname, name);

        } else {
            return json(404, {
                error: 'Not found.'
            });
        }

        const buffer = await fs.readFile(file);

        res.writeHead(200, {
            'Content-Type':
                types[path.extname(file)] ||
                'application/octet-stream'
        });

        res.end(req.method === 'HEAD' ? undefined : buffer);

    } catch (error) {

        console.error('[GURON ERROR]', error.message);

        if (!res.headersSent) {
            json(error.code === 'ENOENT' ? 404 : 400, {
                error: error.code === 'ENOENT'
                    ? 'Not found.'
                    : error.message
            });
        } else {
            res.end();
        }
    }
});

// ==========================================
// INICIO DEL SERVIDOR - RENDER / LOCAL
// ==========================================

server.listen(PORT, HOST, () => {
    console.log('====================================');
    console.log(' GURON HQ - SERVER ONLINE');
    console.log('====================================');
    console.log(`Host: ${HOST}`);
    console.log(`Port: ${PORT}`);
    console.log(`Origin: ${origin}`);
    console.log(`GURON: ${origin}/#launch-token`);
    console.log('====================================');
});

server.on('error', error => {
    console.error('[SERVER ERROR]', error.message);
    process.exit(1);
});




