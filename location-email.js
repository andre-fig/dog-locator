(function (root) {
    'use strict';

    function coordinates(latitude, longitude) {
        if ([latitude, longitude].some(value =>
            !['number', 'string'].includes(typeof value) || String(value).trim() === '')) {
            throw new Error('A localização recebida está vazia.');
        }
        const lat = Number(latitude), lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw new Error('O serviço retornou uma localização inválida.');
        }
        return `${lat},${lng}`;
    }

    function withTimeout(operation, milliseconds, message) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(message)), milliseconds);
            Promise.resolve().then(operation).then(resolve, reject).finally(() => clearTimeout(timer));
        });
    }

    function createLocationNotifier(options) {
        const { geolocation, fetch: fetchLocation, send, onStatus = () => {} } = options;
        const gpsTimeout = options.gpsTimeout ?? 10000;
        const networkTimeout = options.networkTimeout ?? 10000;
        let pending = null;
        let lastSendStarted = -Infinity;
        const sent = new Set();
        const locations = {};
        // EmailJS accepts at most one request per second.
        const minimumSendInterval = options.minimumSendInterval ?? 1100;

        function gpsLocation() {
            return withTimeout(() => new Promise((resolve, reject) => {
                if (!geolocation) return reject(new Error('GPS indisponível.'));
                geolocation.getCurrentPosition(
                    position => {
                        try {
                            resolve(coordinates(position.coords.latitude, position.coords.longitude));
                        } catch (error) { reject(error); }
                    },
                    reject,
                    { enableHighAccuracy: true, timeout: gpsTimeout, maximumAge: 0 }
                );
            }), gpsTimeout + 1000, 'O GPS não respondeu a tempo.');
        }

        async function approximateLocation() {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), networkTimeout);
            try {
                return await withTimeout(async () => {
                    const response = await fetchLocation('https://ipinfo.io/json?token=6114f95e85046c', {
                        signal: controller.signal,
                    });
                    if (!response.ok) throw new Error(`Localização aproximada indisponível (HTTP ${response.status}).`);
                    const data = await response.json();
                    if (typeof data.loc !== 'string' || data.loc.split(',').length !== 2) {
                        throw new Error('O serviço de localização não retornou coordenadas.');
                    }
                    return coordinates(...data.loc.split(','));
                }, networkTimeout, 'O serviço de localização não respondeu a tempo.');
            } finally {
                clearTimeout(timer);
                controller.abort();
            }
        }

        async function sendLocation(ownerEmail, ownerName, dogName, location, type) {
            if (sent.has(type)) return;
            const wait = minimumSendInterval - (Date.now() - lastSendStarted);
            if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
            onStatus('sending', `Enviando a localização ${type} para o tutor…`);
            lastSendStarted = Date.now();
            const result = await withTimeout(() => send('service_dogemail', 'template_dogemail', {
                to_name: ownerName,
                email_to: ownerEmail,
                location,
                location_type: type,
                dog_name: dogName,
            }), networkTimeout, 'O envio não foi confirmado a tempo. O e-mail pode ter sido enviado; confira antes de tentar novamente.');
            if (!result || result.status !== 200) {
                throw new Error(`O serviço de e-mail não confirmou o envio (${result?.status ?? 'sem resposta'}).`);
            }
            sent.add(type);
        }

        async function notify(ownerEmail, ownerName, dogName) {
            try {
                if (typeof send !== 'function') {
                    throw new Error('O serviço de e-mail não carregou. Verifique sua conexão e tente novamente.');
                }
                onStatus('locating', 'Buscando a localização aproximada por IP…');
                // Start both lookups independently: the IP email never waits for GPS permission.
                const approximate = locations.aproximada
                    ? Promise.resolve({ location: locations.aproximada })
                    : approximateLocation().then(location => ({ location }), error => ({ error }));
                const precise = locations.exata
                    ? Promise.resolve({ location: locations.exata })
                    : gpsLocation().then(location => ({ location }), () => ({}));
                const errors = [];
                const ip = await approximate;
                if (!sent.has('aproximada')) {
                    try {
                        if (ip.error) throw ip.error;
                        locations.aproximada = ip.location;
                        await sendLocation(ownerEmail, ownerName, dogName, ip.location, 'aproximada');
                        onStatus('waiting-gps', 'Localização aproximada enviada. Aguardando a localização precisa, se autorizada…');
                    } catch (error) {
                        errors.push(`Localização aproximada: ${error?.text || error?.message || 'falha no envio'}`);
                    }
                }
                const gps = await precise;
                if (gps.location && !sent.has('exata')) {
                    try {
                        locations.exata = gps.location;
                        await sendLocation(ownerEmail, ownerName, dogName, gps.location, 'exata');
                    } catch (error) {
                        errors.push(`Localização precisa: ${error?.text || error?.message || 'falha no envio'}`);
                    }
                }
                if (errors.length) {
                    const confirmed = sent.has('exata') ? 'A localização precisa foi enviada. '
                        : sent.has('aproximada') ? 'A localização aproximada foi enviada. ' : '';
                    throw new Error(confirmed + errors.join(' '));
                }
                onStatus('sent', sent.has('exata')
                    ? 'Localização aproximada enviada; uma segunda notificação com a localização precisa também foi enviada.'
                    : 'Localização aproximada enviada. GPS não autorizado ou indisponível; nenhum segundo e-mail foi enviado.');
                return { approximateSent: sent.has('aproximada'), preciseSent: sent.has('exata') };
            } catch (error) {
                const message = error?.text || error?.message || 'Não foi possível enviar a localização.';
                onStatus('error', message);
                throw error;
            }
        }

        return {
            notify(...args) {
                // One in-flight GPS/IP/email operation, including repeated clicks.
                if (!pending) pending = notify(...args).finally(() => { pending = null; });
                return pending;
            },
        };
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { createLocationNotifier };
    else root.createLocationNotifier = createLocationNotifier;
})(typeof window !== 'undefined' ? window : globalThis);
