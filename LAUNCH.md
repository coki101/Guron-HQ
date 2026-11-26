# Launch Token en GURON

Requiere Node 22.13 o posterior, Phantom en el navegador y un JWT de Pinata con permiso de subida. En la carpeta descomprimida ejecuta:

    npm install
    copy .env.example .env

Edita .env y asigna PINATA_JWT. SOLANA_RPC_URL admite un RPC mainnet privado. Ejecuta:

    npm start

Abre http://localhost:3000/#launch-token en el navegador con Phantom. El servidor escucha en tu equipo. La interfaz estática sigue disponible al abrir index.html para preparar borradores.

Selecciona Pump.fun, revisa la ficha y pulsa Connect & simulate launch. GURON publica la imagen y el JSON en IPFS antes de solicitar la firma. Tras la simulación, revisa la comisión de red y la dirección del mint. Pulsa Sign launch in Phantom para firmar o Cancel launch para volver. La comisión indicada excluye el alquiler de las cuentas. Si cancelas la firma esos archivos siguen publicados. La operación crea el token sin compra inicial. Phantom muestra la operación que pagarás en SOL. Conserva el mint y la firma que aparecen en GURON. Check confirmation permite recuperar el estado tras un corte de red.

Este servidor local no está configurado para exposición pública multiusuario.

