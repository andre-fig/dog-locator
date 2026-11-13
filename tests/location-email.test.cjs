const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLocationNotifier } = require('../location-email.js');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const denied = { getCurrentPosition: (_, reject) => reject({ code: 1 }) };
function setup(overrides = {}) {
    const calls = [];
    const notifier = createLocationNotifier({
        geolocation: { getCurrentPosition: success => success({ coords: { latitude: -22.9, longitude: -43.1 } }) },
        fetch: async () => ({ ok: true, json: async () => ({ loc: '-22.8,-43.0' }) }),
        send: async (...args) => { calls.push(args); return { status: 200, text: 'OK' }; },
        minimumSendInterval: 0,
        ...overrides,
    });
    return { notifier, calls };
}
const notify = s => s.notifier.notify('owner@example.com', 'Tutor', 'Apolo');
const payloads = s => s.calls.map(call => call[2]);
const waitFor = async condition => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(2); } assert.fail('condition not reached'); };

test('opening the page sends IP first, then a second GPS email with the existing template fields', async () => {
    const s = setup(); assert.deepEqual(await notify(s), { approximateSent: true, preciseSent: true });
    assert.deepEqual(payloads(s), [
        { to_name: 'Tutor', email_to: 'owner@example.com', location: '-22.8,-43', location_type: 'aproximada', dog_name: 'Apolo' },
        { to_name: 'Tutor', email_to: 'owner@example.com', location: '-22.9,-43.1', location_type: 'exata', dog_name: 'Apolo' },
    ]);
    for (const call of s.calls) assert.deepEqual(call.slice(0, 2), ['service_dogemail', 'template_dogemail']);
});
test('the IP email does not wait for the GPS permission response', async () => {
    let accept;
    const s = setup({ geolocation: { getCurrentPosition: success => { accept = success; } } });
    const pending = notify(s);
    await waitFor(() => s.calls.length === 1);
    assert.equal(payloads(s)[0].location_type, 'aproximada');
    accept({ coords: { latitude: 1, longitude: 2 } });
    await pending;
    assert.deepEqual(payloads(s).map(p => p.location_type), ['aproximada', 'exata']);
});
test('a faster GPS still cannot send before the IP attempt', async () => {
    let respond;
    const s = setup({ fetch: () => new Promise(resolve => { respond = resolve; }) });
    const pending = notify(s);
    await waitFor(() => respond); assert.equal(s.calls.length, 0);
    respond({ ok: true, json: async () => ({ loc: '3,4' }) });
    await pending;
    assert.deepEqual(payloads(s).map(p => p.location_type), ['aproximada', 'exata']);
});
test('denying GPS sends only the IP email', async () => {
    const s = setup({ geolocation: denied });
    assert.deepEqual(await notify(s), { approximateSent: true, preciseSent: false });
    assert.equal(s.calls.length, 1); assert.equal(payloads(s)[0].location_type, 'aproximada');
});
test('no GPS sends only the IP email', async () => {
    const s = setup({ geolocation: undefined }); await notify(s); assert.equal(s.calls.length, 1);
});
test('permission granted after the old watchdog deadline still sends the GPS email', async () => {
    let callback;
    const s = setup({ gpsTimeout: 10, geolocation: { getCurrentPosition: (cb, _, options) => {
        callback = cb;
        assert.equal(options.timeout, 10); // Native acquisition timeout remains in place.
    } } });
    let finished = false;
    const pending = notify(s).then(result => { finished = true; return result; });
    await waitFor(() => s.calls.length === 1);
    await pause(1100); // Exceeds the previous gpsTimeout + 1000 watchdog.
    assert.equal(finished, false);
    assert.equal(s.calls.length, 1);
    callback({ coords: { latitude: 1, longitude: 2 } });
    await pending;
    assert.deepEqual(payloads(s).map(p => p.location_type), ['aproximada', 'exata']);
    assert.equal(payloads(s)[1].location, '1,2');
});
test('a native GPS timeout keeps the already sent IP email', async () => {
    const s = setup({ geolocation: { getCurrentPosition: (_, error) => error({ code: 3 }) } });
    assert.deepEqual(await notify(s), { approximateSent: true, preciseSent: false });
    assert.equal(s.calls.length, 1);
});
test('failed IP lookup does not suppress valid GPS mail and reports the partial failure', async () => {
    const s = setup({ fetch: async () => ({ ok: false, status: 429 }) });
    await assert.rejects(notify(s), /precisa foi enviada.*HTTP 429/);
    assert.equal(s.calls.length, 1); assert.equal(payloads(s)[0].location_type, 'exata');
});
test('invalid IP coordinates never generate mail', async () => {
    for (const loc of [undefined, '', '1', ',2', ' ,2', '91,10', '1,181', 'NaN,2', '1,2,3']) {
        const s = setup({ geolocation: denied, fetch: async () => ({ ok: true, json: async () => ({ loc }) }) });
        await assert.rejects(notify(s)); assert.equal(s.calls.length, 0);
    }
});
test('invalid GPS coordinates cannot generate a second email', async () => {
    const s = setup({ geolocation: { getCurrentPosition: success => success({ coords: { latitude: 100, longitude: 0 } }) } });
    await notify(s); assert.equal(s.calls.length, 1);
});
test('a missing SDK fails visibly before requesting either location', async () => {
    let requested = false;
    const s = setup({ send: undefined, fetch: () => { requested = true; }, geolocation: { getCurrentPosition: () => { requested = true; } } });
    await assert.rejects(notify(s), /não carregou/); assert.equal(requested, false);
});
test('failed GPS email can be explicitly retried without repeating the confirmed IP email', async () => {
    const attempts = []; let fail = true;
    const s = setup({ send: async (_, __, params) => {
        attempts.push(params.location_type);
        if (params.location_type === 'exata' && fail) { fail = false; throw { text: 'Gmail_API: invalid_grant' }; }
        return { status: 200 };
    } });
    await assert.rejects(notify(s), /aproximada foi enviada.*invalid_grant/);
    await notify(s); assert.deepEqual(attempts, ['aproximada', 'exata', 'exata']);
});
test('failed IP email does not prevent GPS; retry does not repeat confirmed GPS', async () => {
    const attempts = []; let fail = true;
    const s = setup({ send: async (_, __, params) => {
        attempts.push(params.location_type);
        if (params.location_type === 'aproximada' && fail) { fail = false; throw new Error('network'); }
        return { status: 200 };
    } });
    await assert.rejects(notify(s), /precisa foi enviada/);
    await notify(s); assert.deepEqual(attempts, ['aproximada', 'exata', 'aproximada']);
});
test('simultaneous requests share the same two emails, and confirmed emails are not repeated', async () => {
    const s = setup(); await Promise.all([notify(s), notify(s), notify(s)]); await notify(s);
    assert.equal(s.calls.length, 2);
});
test('an unconfirmed response is not reported as success', async () => {
    const s = setup({ geolocation: denied, send: async () => ({ status: 500 }) });
    await assert.rejects(notify(s), /500/);
});
test('hung IP lookup cannot block valid GPS indefinitely', async () => {
    const s = setup({ networkTimeout: 10, fetch: () => new Promise(() => {}) });
    await assert.rejects(notify(s), /precisa foi enviada.*respondeu a tempo/);
    assert.equal(payloads(s)[0].location_type, 'exata');
});
test('hung email calls have deadlines and no automatic resend', async () => {
    let sends = 0;
    const s = setup({ geolocation: denied, networkTimeout: 10, send: () => { sends++; return new Promise(() => {}); } });
    await assert.rejects(notify(s), /pode ter sido enviado/); assert.equal(sends, 1);
});
test('default interval prevents two EmailJS requests within one second', async () => {
    const times = [];
    const s = setup({ minimumSendInterval: undefined, send: async () => { times.push(Date.now()); return { status: 200 }; } });
    await notify(s); assert.ok(times[1] - times[0] >= 1000);
});

test('the page has no delivery notifications or retry controls', () => {
    const { readFileSync } = require('node:fs');
    const html = readFileSync(require('node:path').join(__dirname, '../dog.html'), 'utf8');
    const app = readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
    assert.doesNotMatch(html, /location-status|retry-location|location-notification/);
    assert.doesNotMatch(app, /location-status|retry-location|onStatus/);
});
