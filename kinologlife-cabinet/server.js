const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const catalog = require("./lessons");

const PORT = Number(process.env.PORT || 3021);
const HOST = "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const HMAC = process.env.CABINET_HMAC || "";
const CRM_PAYTEST = "https://crm-paytest.kinologlife.online";
const CRM_CONFIGURED = (process.env.CRM_BASE_URL || "").replace(/\/$/, "");
const CRM_BASE = allowedCrm(CRM_CONFIGURED) ? CRM_CONFIGURED : "";
const COOKIE = "kl_cab";
const WEEK = 14 * 24 * 60 * 60 * 1000;
const PLAYBACK_TTL = 300;
const ID_OK = /^[A-Za-z0-9_-]{8,64}$/;
const SCHOOL_ID = /^[A-Za-z0-9_-]{1,80}$/;
const BEARER_OK = /^[A-Za-z0-9\-._~+/=]{20,1800}$/;
const ACCESS_OK = new Set(["none", "gifted", "paid"]);
const WATCH = new Set(["gifted", "paid"]);

function allowedCrm(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.protocol === "https:" && url.origin === CRM_PAYTEST) return true;
  if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return true;
  return false;
}

if (HMAC.length < 32) {
  console.error("cabinet secrets missing");
  process.exit(1);
}
if (!CRM_BASE) {
  console.error(CRM_CONFIGURED ? "cabinet crm origin refused" : "cabinet crm origin missing");
}

const sections = catalog.sections;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function cookies(req) {
  const out = {};
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", HMAC).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readSession(req) {
  const raw = cookies(req)[COOKIE];
  if (!raw || !raw.includes(".")) return null;
  const dot = raw.lastIndexOf(".");
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", HMAC).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data || typeof data.client_id !== "string" || data.exp < Date.now()) return null;
    if (typeof data.csrf !== "string" || typeof data.crm_session !== "string") return null;
    if (typeof data.deal_id !== "string" || !SCHOOL_ID.test(data.deal_id)) return null;
    if (!SCHOOL_ID.test(data.client_id) || !BEARER_OK.test(data.crm_session)) return null;
    return data;
  } catch {
    return null;
  }
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(payload) {
  const data = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(payload)}`;
  const sig = crypto.createHmac("sha256", HMAC).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expect = crypto.createHmac("sha256", HMAC).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload || payload.iss !== "kinologlife-cabinet" || payload.aud !== "kinescope") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!WATCH.has(payload.access) || typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

function crmCall(method, pathname, { bearer } = {}) {
  if (!CRM_BASE || !BEARER_OK.test(bearer || "")) return Promise.resolve({ status: 0, json: null });
  let url;
  try {
    url = new URL(pathname, `${CRM_BASE}/`);
  } catch {
    return Promise.resolve({ status: 0, json: null });
  }
  if (url.username || url.password || url.origin !== new URL(CRM_BASE).origin) {
    return Promise.resolve({ status: 0, json: null });
  }
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${bearer}`,
          "Content-Length": 0
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json });
        });
      }
    );
    req.setTimeout(8000, () => req.destroy(new Error("crm timeout")));
    req.on("error", reject);
    req.end();
  });
}

function schoolId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && SCHOOL_ID.test(value)) return value;
  return "";
}

function bearerFrom(req, url) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(\S+)$/);
  const token = (match && match[1]) || url.searchParams.get("t") || "";
  return BEARER_OK.test(token) ? token : "";
}

function manualWpId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseAccessBody(json) {
  if (!json || typeof json !== "object") return null;
  const access = String(json.access || "");
  const clientId = schoolId(json.client_id);
  const dealId = schoolId(json.deal_id);
  if (!ACCESS_OK.has(access) || !clientId || !dealId) return null;
  const name = typeof json.name === "string" ? json.name.slice(0, 80) : "";
  return {
    client_id: clientId,
    deal_id: dealId,
    access,
    name,
    manual_wp_user_id: manualWpId(json.wp_user_id)
  };
}

const accessCache = new Map();

async function accessFor(session) {
  const hit = accessCache.get(session.client_id);
  if (hit && Date.now() - hit.at < 45000) return hit.data;
  const result = await crmCall("GET", "/api/v1/me/online-school/access", { bearer: session.crm_session });
  const parsed = result.status === 200 ? parseAccessBody(result.json) : null;
  if (!parsed || parsed.client_id !== session.client_id) return null;
  const data = {
    client_id: parsed.client_id,
    deal_id: parsed.deal_id,
    name: parsed.name || session.name || "",
    access: parsed.access,
    manual_wp_user_id: parsed.manual_wp_user_id,
    has_access: WATCH.has(parsed.access)
  };
  accessCache.set(session.client_id, { at: Date.now(), data });
  return data;
}

function findLesson(sectionId, slug) {
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return null;
  const lesson = section.lessons.find((item) => item.slug === slug);
  if (!lesson) return null;
  return { section, lesson };
}

const progressFile = path.join(DATA_DIR, "progress.json");
let progressChain = Promise.resolve();

function withProgress(fn) {
  const run = progressChain.then(fn, fn);
  progressChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

function readProgress() {
  try {
    const data = JSON.parse(fs.readFileSync(progressFile, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeProgress(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${progressFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, progressFile);
}

function isDone(clientId, key) {
  const all = readProgress();
  return Boolean(all[String(clientId)] && all[String(clientId)][key]);
}

function layout(title, body, who) {
  const account = who
    ? `<div class="account">
         <p class="account__who"><strong>${esc(who.name || "Кабинет")}</strong></p>
         <form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(who.csrf)}"><button class="account__out" type="submit">Выйти</button></form>
       </div>`
    : `<a class="account__out" href="https://kinologlife.online/">На сайт</a>`;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${esc(title)} — Кинолог LIFE</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/cabinet.css?v=3">
  <link rel="icon" href="/assets/logo.png" type="image/png">
</head>
<body>
<a class="skip-link" href="#main">К содержанию</a>
<header class="bar">
  <div class="bar__inner">
    <a class="logo" href="${who ? "/" : "https://kinologlife.online/"}" aria-label="Кинолог LIFE">
      <img src="/assets/logo.png" alt="Кинолог LIFE">
    </a>
    ${account}
  </div>
</header>
<main id="main">${body}</main>
<footer><p>Кинолог LIFE · уроки дома · <a href="https://kinologlife.online/">на сайт школы</a></p></footer>
</body>
</html>`;
}

function mast(title, text) {
  return `<section class="hero">
    <img class="dog dog-gold" src="/assets/dog-gold.webp?v=2" alt="" width="640" height="640">
    <img class="dog dog-shiba" src="/assets/dog-shiba.webp?v=2" alt="" width="640" height="640">
    <img class="butterfly" src="/assets/butterfly.webp?v=2" alt="" width="400" height="400">
    <div class="hero__copy">
      <p class="eyebrow">Кабинет</p>
      <h1>${esc(title)}</h1>
      ${text ? `<p>${esc(text)}</p>` : ""}
    </div>
    <div class="hero__wave" aria-hidden="true"></div>
  </section>`;
}

function closedCopy(access) {
  if (access === "none") return "Подписка ещё не открыта. Регистрация сама уроки не включает. Собака для кабинета не нужна.";
  return "Доступ к урокам закрыт. Оплаченная и подаренная подписка открывают один и тот же каталог.";
}

function pageSections(user, access) {
  if (!access.has_access) {
    const body = `${mast("Уроки", closedCopy(access.access))}
      <div class="sheet-wrap"><article class="sheet">
        <h1>Доступ закрыт</h1>
        <p class="fine">Оплаченная и подаренная подписка открывают один и тот же каталог.</p>
      </article></div>`;
    return layout("Доступ", body, { csrf: user.csrf, name: access.name });
  }
  const doneCount = (section) =>
    section.lessons.filter((lesson) => isDone(user.clientId, `${section.id}/${lesson.slug}`)).length;
  const blocks = sections
    .map((section) => {
      const cards = section.lessons
        .map((lesson, index) => {
          const done = isDone(user.clientId, `${section.id}/${lesson.slug}`);
          return `<li><a class="card${done ? " is-done" : ""}" href="/lesson/${section.id}/${lesson.slug}">
            <b class="n">${String(index + 1).padStart(2, "0")}</b>
            <span class="copy"><strong>${esc(lesson.title)}</strong><span>${esc(lesson.note)}</span></span>
            <em class="pill">${done ? "Пройден" : "Смотреть"}</em>
          </a></li>`;
        })
        .join("");
      const eyebrow = section.id === "zapisi" ? "Около 40 минут" : "Короткие темы";
      const done = doneCount(section);
      return `<section class="panel" id="${esc(section.id)}">
        <header class="panel__head">
          <div>
            <p class="eyebrow">${eyebrow}</p>
            <h2>${esc(section.title)}</h2>
            <p class="lead">${esc(section.lead)}</p>
          </div>
          <p class="count"><b>${done}</b><span>из ${section.lessons.length}</span></p>
        </header>
        <ul class="cards">${cards}</ul>
      </section>`;
    })
    .join("");
  const body = `${mast("Уроки", "Короткие темы и полные записи занятий. Собака не обязательна.")}
    <div class="board" id="sections">${blocks}</div>`;
  return layout("Уроки", body, { csrf: user.csrf, name: access.name });
}

function playbackToken(clientId, access, section, lesson) {
  return signJwt({
    iss: "kinologlife-cabinet",
    aud: "kinescope",
    sub: clientId,
    access,
    lesson: `${section.id}/${lesson.slug}`,
    vid: lesson.kinescopeId,
    exp: Math.floor(Date.now() / 1000) + PLAYBACK_TTL
  });
}

function embedUrl(lesson, token) {
  return `https://kinescope.io/embed/${encodeURIComponent(lesson.kinescopeId)}?drmauthtoken=${encodeURIComponent(token)}`;
}

function pageLesson(user, access, section, lesson) {
  const key = `${section.id}/${lesson.slug}`;
  const done = isDone(user.clientId, key);
  const token = lesson.kinescopeId && ID_OK.test(lesson.kinescopeId)
    ? playbackToken(user.clientId, access.access, section, lesson)
    : "";
  const player = token
    ? `<div class="player"><iframe src="${esc(embedUrl(lesson, token))}" title="${esc(lesson.title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock" allowfullscreen loading="lazy"></iframe></div>`
    : `<div class="player"><div class="player-empty">Видео на Kinescope появится в этом окне.</div></div>`;
  const body = `${mast(section.title, lesson.title)}
    <div class="sheet-wrap"><article class="sheet">
      <a class="back" href="/#${esc(section.id)}">К списку</a>
      <h1>${esc(lesson.title)}</h1>
      ${player}
      <p class="note">${esc(lesson.note)}</p>
      <form method="post" action="/lesson/${esc(section.id)}/${esc(lesson.slug)}/done">
        <input type="hidden" name="csrf" value="${esc(user.csrf)}">
        <button class="btn${done ? " done" : ""}" type="submit">${done ? "Пройден · снять отметку" : "Отметить пройденным"}</button>
      </form>
    </article></div>`;
  return layout(lesson.title, body, { csrf: user.csrf, name: access.name });
}

function sessionCookie(session) {
  const token = sign({
    client_id: session.client_id,
    deal_id: session.deal_id,
    crm_session: session.crm_session,
    name: session.name || "",
    exp: Date.now() + WEEK,
    csrf: crypto.randomBytes(16).toString("hex")
  });
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${14 * 24 * 60 * 60}`;
}

function pageLogin(error) {
  const message = error === "link"
    ? "Ссылка из общего аккаунта устарела. Откройте онлайн-школу из приложения ещё раз."
    : error === "crm"
      ? "Кабинет не смог прочитать сессию CRM."
      : "";
  const body = `${mast("Вход", "Сессия приходит из общего аккаунта. Отдельного пароля школы нет.")}
    <div class="login-grid">
      <article class="sheet">
        <h1>Открыть уроки</h1>
        <p class="fine">Войдите в приложении Кинолог LIFE и откройте онлайн-школу оттуда. Кабинет пароль не спрашивает и собаку не требует.</p>
        ${message ? `<p class="warn">${esc(message)}</p>` : ""}
      </article>
      <aside class="aside">
        <p class="eyebrow">Два раздела</p>
        <h2>Что внутри</h2>
        <ul>
          <li><strong>Обучение</strong><span>Короткие темы: маркер, выдержка и то, что добавим дальше.</span></li>
          <li><strong>Записи занятий</strong><span>Полные коррекции с занятий, около 40 минут. Ролики на Kinescope.</span></li>
        </ul>
      </aside>
    </div>`;
  return layout("Вход", body, null);
}

function catalogPayload(clientId) {
  return {
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      lead: section.lead,
      lessons: section.lessons.map((lesson) => ({
        slug: lesson.slug,
        title: lesson.title,
        note: lesson.note,
        done: isDone(clientId, `${section.id}/${lesson.slug}`)
      }))
    }))
  };
}

function send(res, status, html) {
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "frame-src https://kinescope.io https://*.kinescope.io",
    "form-action 'self'",
    "base-uri 'none'"
  ].join("; ");
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": csp,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(html);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function redirect(res, location, cookie) {
  const headers = { Location: location, "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  res.writeHead(303, headers);
  res.end();
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveAsset(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  if (!types[ext]) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(filePath, (error, buf) => {
    if (error) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[ext],
      "Cache-Control": "public, max-age=86400"
    });
    res.end(buf);
  });
}

async function setDone(clientId, key, done) {
  await withProgress(async () => {
    const all = readProgress();
    const row = all[clientId] && typeof all[clientId] === "object" ? all[clientId] : {};
    if (done) row[key] = Date.now();
    else delete row[key];
    all[clientId] = row;
    writeProgress(all);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://cabinet.local");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/kinescope/authorize") {
    try {
      const body = JSON.parse(await readBody(req));
      const payload = verifyJwt(body && body.token);
      const lessonKey = payload && payload.lesson;
      const found = lessonKey ? findLesson(String(lessonKey).split("/")[0], String(lessonKey).split("/")[1]) : null;
      if (!payload || !found || found.lesson.kinescopeId !== payload.vid) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200);
      res.end();
    } catch {
      res.writeHead(403);
      res.end();
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/assets/")) {
    const name = path.basename(pathname);
    const filePath = path.join(ROOT, "public", name);
    if (!filePath.startsWith(path.join(ROOT, "public"))) {
      res.writeHead(404);
      res.end();
      return;
    }
    serveAsset(res, filePath);
    return;
  }

  try {
    if (req.method === "POST" && pathname === "/login") {
      await readBody(req);
      sendJson(res, 405, { ok: false, error: "no_school_password" });
      return;
    }

    if (req.method === "GET" && pathname === "/enter") {
      const bearer = bearerFrom(req, url);
      if (!bearer) {
        redirect(res, "/login?error=link");
        return;
      }
      const result = await crmCall("POST", "/api/v1/me/online-school/enter", { bearer });
      const parsed = result.status === 200 ? parseAccessBody(result.json) : null;
      if (!parsed) {
        redirect(res, CRM_BASE ? "/login?error=link" : "/login?error=crm");
        return;
      }
      accessCache.set(parsed.client_id, {
        at: Date.now(),
        data: {
          client_id: parsed.client_id,
          deal_id: parsed.deal_id,
          name: parsed.name,
          access: parsed.access,
          manual_wp_user_id: parsed.manual_wp_user_id,
          has_access: WATCH.has(parsed.access)
        }
      });
      redirect(res, "/", sessionCookie({
        client_id: parsed.client_id,
        deal_id: parsed.deal_id,
        crm_session: bearer,
        name: parsed.name
      }));
      return;
    }

    if (req.method === "POST" && pathname === "/logout") {
      const form = new URLSearchParams(await readBody(req));
      const session = readSession(req);
      if (!session || form.get("csrf") !== session.csrf) {
        redirect(res, "/login");
        return;
      }
      accessCache.delete(session.client_id);
      const cookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
      redirect(res, "/login", cookie);
      return;
    }

    const session = req.method === "GET" || req.method === "POST" ? readSession(req) : null;

    if (req.method === "GET" && pathname === "/login") {
      if (session) {
        redirect(res, "/");
        return;
      }
      send(res, 200, pageLogin(url.searchParams.get("error") || ""));
      return;
    }

    if (!session) {
      if (pathname.startsWith("/api/") || req.method !== "GET") {
        sendJson(res, 401, { ok: false, error: "session" });
        return;
      }
      redirect(res, "/login");
      return;
    }

    const access = await accessFor(session);
    if (!access) {
      const html = layout("Доступ", `${mast("Уроки", "")}<div class="sheet-wrap"><article class="sheet"><p class="warn">Не удалось прочитать доступ в CRM. Обновите страницу.</p></article></div>`, null);
      if (pathname.startsWith("/api/")) sendJson(res, 503, { ok: false, error: "crm" });
      else send(res, 503, html);
      return;
    }
    const viewer = { clientId: session.client_id, csrf: session.csrf };

    if (req.method === "GET" && pathname === "/api/catalog") {
      if (!access.has_access) {
        sendJson(res, 403, { access: access.access, sections: [] });
        return;
      }
      sendJson(res, 200, {
        access: access.access,
        deal_id: access.deal_id,
        manual_wp_user_id: access.manual_wp_user_id,
        ...catalogPayload(session.client_id)
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/progress") {
      const all = readProgress();
      const row = all[session.client_id] && typeof all[session.client_id] === "object" ? all[session.client_id] : {};
      sendJson(res, 200, { access: access.access, deal_id: access.deal_id, items: access.has_access ? row : {} });
      return;
    }

    if (req.method === "POST" && pathname === "/api/progress") {
      if (!access.has_access) {
        sendJson(res, 403, { access: access.access });
        return;
      }
      const body = JSON.parse(await readBody(req));
      const found = findLesson(String(body.section || ""), String(body.slug || ""));
      if (!found || typeof body.done !== "boolean") {
        sendJson(res, 400, { ok: false, error: "lesson" });
        return;
      }
      const key = `${found.section.id}/${found.lesson.slug}`;
      await setDone(session.client_id, key, body.done);
      sendJson(res, 200, { ok: true, key, done: body.done });
      return;
    }

    if (req.method === "GET" && pathname === "/api/playback") {
      if (!access.has_access) {
        sendJson(res, 403, { access: access.access });
        return;
      }
      const found = findLesson(url.searchParams.get("section") || "", url.searchParams.get("slug") || "");
      if (!found || !ID_OK.test(found.lesson.kinescopeId || "")) {
        sendJson(res, 404, { ok: false, error: "lesson" });
        return;
      }
      const token = playbackToken(session.client_id, access.access, found.section, found.lesson);
      sendJson(res, 200, {
        access: access.access,
        embed_url: embedUrl(found.lesson, token),
        expires_in: PLAYBACK_TTL
      });
      return;
    }

    if (req.method === "GET" && pathname === "/") {
      send(res, 200, pageSections(viewer, access));
      return;
    }

    const lessonMatch = pathname.match(/^\/lesson\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (req.method === "GET" && lessonMatch) {
      if (!access.has_access) {
        redirect(res, "/");
        return;
      }
      const found = findLesson(lessonMatch[1], lessonMatch[2]);
      if (!found) {
        send(res, 404, layout("Урок", `${mast("Уроки", "")}<div class="sheet-wrap"><article class="sheet"><p>Такого урока нет.</p></article></div>`, { csrf: session.csrf, name: access.name }));
        return;
      }
      send(res, 200, pageLesson(viewer, access, found.section, found.lesson));
      return;
    }

    const doneMatch = pathname.match(/^\/lesson\/([a-z0-9-]+)\/([a-z0-9-]+)\/done$/);
    if (req.method === "POST" && doneMatch) {
      const form = new URLSearchParams(await readBody(req));
      if (form.get("csrf") !== session.csrf || !access.has_access) {
        redirect(res, "/");
        return;
      }
      const found = findLesson(doneMatch[1], doneMatch[2]);
      if (!found) {
        redirect(res, "/");
        return;
      }
      const key = `${found.section.id}/${found.lesson.slug}`;
      await setDone(session.client_id, key, !isDone(session.client_id, key));
      redirect(res, `/lesson/${found.section.id}/${found.lesson.slug}`);
      return;
    }

    send(res, 404, layout("Кабинет", `${mast("Уроки", "")}<div class="sheet-wrap"><article class="sheet"><p>Страница не найдена.</p></article></div>`, { csrf: session.csrf, name: access.name }));
  } catch (error) {
    console.error("cabinet", error && error.message ? error.message : "error");
    if (pathname.startsWith("/api/")) sendJson(res, 500, { ok: false, error: "server" });
    else send(res, 500, layout("Кабинет", `${mast("Уроки", "")}<div class="sheet-wrap"><article class="sheet"><p class="warn">Не получилось открыть страницу. Обновите её.</p></article></div>`, null));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`cabinet ${HOST}:${PORT}`);
});
