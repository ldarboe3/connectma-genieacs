const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 10000);
const TARGET = process.env.NBI_TARGET;
const USERNAME = process.env.GENIEACS_NBI_USERNAME;
const PASSWORD = process.env.GENIEACS_NBI_PASSWORD;

if (!TARGET || !USERNAME || !PASSWORD) {
  console.error("Missing NBI_TARGET or NBI gateway credentials.");
  process.exit(1);
}

const targetText = TARGET.startsWith("http://") ? TARGET : `http://${TARGET}`;
const target = new URL(targetText);

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorized(header) {
  if (!header || !header.startsWith("Basic ")) return false;

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);

  return safeEqual(suppliedUser, USERNAME) &&
    safeEqual(suppliedPassword, PASSWORD);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (!req.url || !req.url.startsWith("/") || /[\r\n]/.test(req.url)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, {
      "www-authenticate": 'Basic realm="ConnectMa GenieACS NBI"',
      "content-type": "text/plain",
      "cache-control": "no-store"
    });
    res.end("Authentication required");
    return;
  }

  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers.connection;
  headers.host = target.host;
  headers["x-forwarded-proto"] = "https";

  const upstream = http.request({
    hostname: target.hostname,
    port: target.port || 80,
    method: req.method,
    path: req.url,
    headers
  }, (upstreamRes) => {
    const responseHeaders = { ...upstreamRes.headers };
    delete responseHeaders.connection;
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });

  upstream.on("error", (error) => {
    console.error("NBI upstream error:", error.message);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("GenieACS NBI upstream unavailable");
  });

  req.pipe(upstream);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ConnectMa NBI gateway listening on ${PORT}`);
});
