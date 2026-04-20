const http = require('http');
const httpProxy = require('http-proxy');
const net = require('net'); // Вынесено наверх для оптимизации

const port = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  // Эндпоинт для keep-alive (чтобы сервер не засыпал)
  if (req.url === '/ping') {
    res.writeHead(200);
    res.end('pong');
    return;
  }

  // Простая базовая аутентификация
  const auth = req.headers['proxy-authorization'];
  if (!auth || auth !== 'Basic ' + Buffer.from('user:password').toString('base64')) {
    res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
    res.end('Auth required');
    return;
  }

  // Проксируем запрос
  proxy.web(req, res, { target: req.url, secure: false }, (err) => {
    res.writeHead(500);
    res.end('Proxy Error');
  });
});

// Поддержка HTTPS CONNECT
server.on('connect', (req, clientSocket, head) => {
  const auth = req.headers['proxy-authorization'];
  if (!auth || auth !== 'Basic ' + Buffer.from('user:password').toString('base64')) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required
Proxy-Authenticate: Basic realm="Proxy"

');
    clientSocket.end();
    return;
  }

  // Изменено имя переменной на targetPort, чтобы избежать конфликта с const port
  const { port: targetPort, hostname } = new URL(`http://${req.url}`);
  const serverSocket = net.connect(targetPort || 443, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established

');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  
  serverSocket.on('error', () => clientSocket.end());
  clientSocket.on('error', () => serverSocket.end());
});

server.listen(port, () => {
  console.log(`Proxy server is running on port ${port}`);
});
