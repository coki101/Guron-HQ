
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');



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

// Archivos públicos autorizados.
const publicFiles = new Set([
    'index.html',
    'style.css',
    'app.js',
    ...['cases', 'lab', 'vault'].flatMap(
        name => [name + '.css', name + '.js']
    ),
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
    console.log(`GURON: ${origin}/#staking`);
    console.log('====================================');
});

server.on('error', error => {
    console.error('[SERVER ERROR]', error.message);
    process.exit(1);
});




