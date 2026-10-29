const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const catalog = require("./lessons");

const PORT = Number(process.env.PORT || 3021);
const HOST = "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const HMAC = process.env.CABINET_HMAC || "";
const SHARED = process.env.WP_SHARED_SECRET || "";
const WP_HOST = process.env.WP_HOST || "127.0.0.1";
const WP_PORT = Number(process.env.WP_PORT || 8088);
const COOKIE = "kl_cab";
const WEEK = 14 * 24 * 60 * 60 * 1000;
const ID_OK = /^[A-Za-z0-9_-]{8,64}$/;

if (HMAC.length < 32 || SHARED.length < 32) {
  console.error("cabinet secrets missing");
  process.exit(1);
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
    if (!data || typeof data.uid !== "number" || data.exp < Date.now()) return null;
    if (typeof data.csrf !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

function setCookie(res, value, maxAge) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}

function wpPost(action, fields) {
  const body = new URLSearchParams(fields).toString();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: WP_HOST,
        port: WP_PORT,
        method: "POST",
        path: `/wp-admin/admin-post.php?action=${action}`,
        headers: {
          Host: "kinologlife.online",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "X-KL-Cabinet": SHARED,
          "X-Forwarded-Proto": "https"
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
    req.setTimeout(12000, () => req.destroy(new Error("wp timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

const accessCache = new Map();

async function accessFor(uid) {
  const hit = accessCache.get(uid);
  if (hit && Date.now() - hit.at < 45000) return hit.data;
  const result = await wpPost("kl_cabinet_access", { uid: String(uid) });
  if (!result.json || !result.json.ok) return null;
  accessCache.set(uid, { at: Date.now(), data: result.json });
  return result.json;
}

const loginHits = new Map();

function loginLimited(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const rows = (loginHits.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  loginHits.set(key, rows);
  return rows.length >= 8;
}

function loginHit(email) {
  const key = email.toLowerCase();
  const rows = loginHits.get(key) || [];
  rows.push(Date.now());
  loginHits.set(key, rows);
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

function isDone(uid, key) {
  const all = readProgress();
  return Boolean(all[String(uid)] && all[String(uid)][key]);
}

function layout(title, body, who) {
  const account = who
    ? `<p class="who">${esc(who.email || who.name || "")}</p>
       <form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(who.csrf)}"><button class="linkish" type="submit">Выйти</button></form>`
    : "";
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
  <link rel="stylesheet" href="/assets/cabinet.css?v=1">
  <link rel="icon" href="/assets/logo.png" type="image/png">
</head>
<body>
<a class="skip-link" href="#main">К содержанию</a>
<header class="top">
  <a class="logo" href="${who ? "/" : "https://kinologlife.online/"}" aria-label="Кинолог LIFE">
    <img src="/assets/logo.png" alt="Кинолог LIFE">
  </a>
  <div class="top-actions">${account}</div>
</header>
${body}
</body>
</html>`;
}

function mast(title, text) {
  return `<section class="mast">
    <h1>${esc(title)}</h1>
    ${text ? `<p>${esc(text)}</p>` : ""}
    <div class="mast__wave" aria-hidden="true"></div>
  </section>`;
}

function pageSections(user, access) {
  if (!access.has_access) {
    const body = `${mast("Уроки", "Доступ откроется после оплаты на сайте школы.")}
      <article class="sheet login-sheet">
        <p>Сейчас уроки закрыты. Оплата остаётся на сайте школы, через Robokassa.</p>
        <p><a class="btn" href="https://kinologlife.online/tarif">Открыть доступ</a></p>
      </article>`;
    return layout("Доступ", body, { ...user, csrf: user.csrf, email: access.email });
  }
  const doneCount = (section) =>
    section.lessons.filter((lesson) => isDone(user.uid, `${section.id}/${lesson.slug}`)).length;
  const blocks = sections
    .map((section) => {
      const cards = section.lessons
        .map((lesson, index) => {
          const done = isDone(user.uid, `${section.id}/${lesson.slug}`);
          return `<li><a class="card${done ? " is-done" : ""}" href="/lesson/${section.id}/${lesson.slug}">
            <b class="n">${String(index + 1).padStart(2, "0")}</b>
            <span class="copy"><strong>${esc(lesson.title)}</strong><span>${esc(lesson.note)}</span></span>
            <em class="pill">${done ? "Пройден" : "Видео"}</em>
          </a></li>`;
        })
        .join("");
      return `<section class="section" id="${esc(section.id)}">
        <h2>${esc(section.title)}</h2>
        <p class="lead">${esc(section.lead)} ${doneCount(section)} из ${section.lessons.length} отмечено.</p>
        <ul class="cards">${cards}</ul>
      </section>`;
    })
    .join("");
  const body = `${mast("Уроки", "Два раздела: короткие темы и полные записи занятий.")}
    <div class="board" id="sections">${blocks}</div>`;
  return layout("Уроки", body, { csrf: user.csrf, email: access.email });
}

function pageLesson(user, access, section, lesson) {
  const key = `${section.id}/${lesson.slug}`;
  const done = isDone(user.uid, key);
  const player = lesson.kinescopeId && ID_OK.test(lesson.kinescopeId)
    ? `<div class="player"><iframe src="https://kinescope.io/embed/${encodeURIComponent(lesson.kinescopeId)}" title="${esc(lesson.title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock" allowfullscreen loading="lazy"></iframe></div>`
    : `<div class="player"><div class="player-empty">Видео на Kinescope появится в этом окне.</div></div>`;
  const body = `${mast(section.title, "")}
    <article class="sheet">
      <a class="back" href="/#${esc(section.id)}">К списку</a>
      <h1>${esc(lesson.title)}</h1>
      ${player}
      <p class="note">${esc(lesson.note)}</p>
      <form method="post" action="/lesson/${esc(section.id)}/${esc(lesson.slug)}/done">
        <input type="hidden" name="csrf" value="${esc(user.csrf)}">
        <button class="btn${done ? " done" : ""}" type="submit">${done ? "Пройден · снять отметку" : "Отметить пройденным"}</button>
      </form>
    </article>`;
  return layout(lesson.title, body, { csrf: user.csrf, email: access.email });
}

function pageLogin(error) {
  const message = error === "rate"
    ? "Слишком много попыток. Подождите немного."
    : error
      ? "Неверный адрес или пароль."
      : "";
  const body = `${mast("Вход", "Тот же адрес и пароль, что на сайте школы.")}
    <article class="sheet login-sheet">
      <h1>Кабинет</h1>
      ${message ? `<p class="warn">${esc(message)}</p>` : ""}
      <form method="post" action="/login">
        <label>Почта<input type="email" name="email" autocomplete="username" required></label>
        <label>Пароль<input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Войти</button>
      </form>
      <p class="links"><a href="https://kinologlife.online/tarif">Оплатить доступ</a><a href="https://kinologlife.online/register">Регистрация</a></p>
    </article>`;
  return layout("Вход", body, null);
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

function redirect(res, location, cookie) {
  const headers = { Location: location, "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  res.writeHead(303, headers);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 20000) {
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://cabinet.local");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
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
      const form = new URLSearchParams(await readBody(req));
      const email = String(form.get("email") || "").trim().toLowerCase();
      const password = String(form.get("password") || "");
      if (!email || !password || loginLimited(email)) {
        redirect(res, loginLimited(email) ? "/login?error=rate" : "/login?error=1");
        return;
      }
      const result = await wpPost("kl_cabinet_login", { email, password });
      if (!result.json || !result.json.ok || result.json.error) {
        loginHit(email);
        const code = result.json && result.json.error === "rate" ? "rate" : "1";
        redirect(res, `/login?error=${code}`);
        return;
      }
      accessCache.set(result.json.uid, { at: Date.now(), data: result.json });
      const token = sign({
        uid: result.json.uid,
        exp: Date.now() + WEEK,
        csrf: crypto.randomBytes(16).toString("hex")
      });
      const cookie = `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${14 * 24 * 60 * 60}`;
      redirect(res, "/", cookie);
      return;
    }

    if (req.method === "POST" && pathname === "/logout") {
      const form = new URLSearchParams(await readBody(req));
      const session = readSession(req);
      if (!session || form.get("csrf") !== session.csrf) {
        redirect(res, "/login");
        return;
      }
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
      if (req.method === "GET") {
        redirect(res, "/login");
        return;
      }
      res.writeHead(401);
      res.end();
      return;
    }

    const access = await accessFor(session.uid);
    if (!access) {
      send(res, 503, layout("Доступ", `${mast("Уроки", "")}<article class="sheet login-sheet"><p class="warn">Не удалось проверить доступ. Обновите страницу.</p></article>`, null));
      return;
    }
    const viewer = { uid: session.uid, csrf: session.csrf };

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
        send(res, 404, layout("Урок", `${mast("Уроки", "")}<article class="sheet"><p>Такого урока нет.</p></article>`, { csrf: session.csrf, email: access.email }));
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
      await withProgress(async () => {
        const all = readProgress();
        const row = all[String(session.uid)] && typeof all[String(session.uid)] === "object"
          ? all[String(session.uid)]
          : {};
        if (row[key]) delete row[key];
        else row[key] = Date.now();
        all[String(session.uid)] = row;
        writeProgress(all);
      });
      redirect(res, `/lesson/${found.section.id}/${found.lesson.slug}`);
      return;
    }

    send(res, 404, layout("Кабинет", `${mast("Уроки", "")}<article class="sheet"><p>Страница не найдена.</p></article>`, { csrf: session.csrf, email: access.email }));
  } catch (error) {
    console.error("cabinet", error && error.message ? error.message : "error");
    send(res, 500, layout("Кабинет", `${mast("Уроки", "")}<article class="sheet"><p class="warn">Не получилось открыть страницу. Обновите её.</p></article>`, null));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`cabinet ${HOST}:${PORT}`);
});
