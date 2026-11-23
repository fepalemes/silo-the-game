// Zero-dependency static file server for local development. ES modules must
// be served as text/javascript (browsers reject module scripts served with
// the wrong MIME type), which is the main reason `index.html` can't just be
// opened directly from disk.
//
// `HTTPS=1` (npm run dev:https) serves the same files over TLS with a
// self-signed certificate. That exists for one reason: a headset on the same
// network can only start a WebXR session from a secure origin, and
// http://192.168.x.x is not one. The browser will warn about the certificate
// once; accept it and the page behaves like any HTTPS site.
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECURE = process.env.HTTPS === "1";
const PORT = process.env.PORT || (SECURE ? 8443 : 8080);

const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter((net) => net && net.family === "IPv4" && !net.internal).map((net) => net.address);

// Generated once into certs/ (git-ignored) with the system's openssl.
function devCertificate() {
  const dir = path.join(__dirname, "certs"), key = path.join(dir, "dev.key"), cert = path.join(dir, "dev.crt");
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    fs.mkdirSync(dir, { recursive: true });
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365", "-subj", "/CN=silo-dev", "-keyout", key, "-out", cert], { stdio: "ignore" });
    } catch {
      console.error("Não foi possível gerar o certificado: o comando `openssl` não está disponível.");
      process.exit(1);
    }
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const handler = (req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split("?")[0]); }
  catch { res.writeHead(400); res.end("Endereço inválido"); return; }
  if (urlPath === "/") urlPath = "/index.html";
  // The development certificate's private key lives under the served folder.
  if (urlPath.startsWith("/certs/")) { res.writeHead(404); res.end(); return; }

  const filePath = path.normalize(path.join(__dirname, urlPath));
  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Proibido");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Não encontrado: ${urlPath}`);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
};

const server = SECURE ? https.createServer(devCertificate(), handler) : http.createServer(handler);

server.listen(PORT, () => {
  const scheme = SECURE ? "https" : "http", port = server.address().port;
  console.log(`Silo rodando em ${scheme}://localhost:${port}`);
  if (SECURE) for (const address of lanAddresses()) console.log(`No óculos, na mesma rede: https://${address}:${port}  (aceite o aviso de certificado)`);
});
