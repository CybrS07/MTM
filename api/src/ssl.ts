import fs from "node:fs";
import path from "node:path";
import selfsigned from "selfsigned";

/** Returns TLS key and cert: your own files if set, else a self-signed pair for localhost. */
export function loadTls(): { key: string; cert: string } {
  const kp = process.env.SSL_KEY_PATH, cp = process.env.SSL_CERT_PATH;
  if (kp && cp && fs.existsSync(kp) && fs.existsSync(cp)) return { key: fs.readFileSync(kp, "utf-8"), cert: fs.readFileSync(cp, "utf-8") };
  const dir = path.join(process.cwd(), "certs");
  const k = path.join(dir, "key.pem"), c = path.join(dir, "cert.pem");
  if (!fs.existsSync(k) || !fs.existsSync(c)) {
    fs.mkdirSync(dir, { recursive: true });
    const pems = selfsigned.generate([{ name: "commonName", value: "localhost" }], {
      days: 365, keySize: 2048, algorithm: "sha256",
      extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] }],
    });
    fs.writeFileSync(k, pems.private); fs.writeFileSync(c, pems.cert);
    console.log("Generated a self-signed certificate in ./certs");
  }
  return { key: fs.readFileSync(k, "utf-8"), cert: fs.readFileSync(c, "utf-8") };
}
