const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3020;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const ASSETS = path.join(ROOT, "public");

const PAGES = {
  "/": { title: "Онлайн-школа", file: "home" },
  "/kak-ustroeno": { title: "Как устроена школа", file: "how" },
  "/tarif": { title: "Доступ", file: "tarif" },
  "/register": { title: "Регистрация", file: "register" },
  "/login": { title: "Вход", file: "login" },
  "/account": { title: "Доступ", file: "account" }
};

function layout(page, body) {
  const nav = (href, label) =>
    `<a href="${href}"${page === href ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page === "/" ? "Кинолог.life — онлайн-школа" : `${PAGES[page].title} — Кинолог.life`}</title>
  <meta name="description" content="Онлайн-школа Кинолог.life: короткие уроки с собакой дома. Один доступ — 1 990 ₽ в месяц.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/shell-assets/site.css?v=2">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%236b4122' width='32' height='32' rx='6'/%3E%3C/svg%3E">
</head>
<body>
<a class="skip-link" href="#main">К содержанию</a>
<header class="site-header" id="top">
  <div class="site-header__inner">
    <div class="site-brand">
      <a class="site-logo" href="/" aria-label="Кинолог.life онлайн — главная">Kinolog.<span>life</span></a>
      <span class="site-logo__note">онлайн</span>
    </div>
    <button class="site-menu-toggle" type="button" id="menu-toggle" aria-expanded="false" aria-controls="site-menu">
      <span>Меню</span>
      <span class="site-menu-toggle__icon" aria-hidden="true"><i></i><i></i></span>
    </button>
    <button class="site-header__backdrop" type="button" data-menu-dismiss aria-label="Закрыть меню"></button>
    <div class="site-header__panel" id="site-menu">
      <nav class="global-nav" aria-label="Основная навигация">
        ${nav("/kak-ustroeno", "Как устроено")}
        ${nav("/tarif", "Доступ")}
      </nav>
      <a class="account-action" href="/account"${page === "/account" ? ' aria-current="page"' : ""}>Кабинет</a>
    </div>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="wrap site-footer__inner">
    <p>Онлайн-школа Kinolog.life. ИП Даровских А. А. · ИНН 430100731903 · ОГРНИП 324430000060748 · пгт. Арбаж, ул. Зелёная, д. 11 · <a href="mailto:info@kinologlife.online">info@kinologlife.online</a></p>
    <nav aria-label="Документы">
      <a href="/offer/">Оферта</a>
      <a href="/privacy-policy/">Персональные данные</a>
      <a href="/consent-pdn/">Согласие</a>
      <a href="/cookies-policy/">Cookie</a>
      <a href="/terms-of-use/">Соглашение</a>
      <a href="/contacts/">Контакты</a>
      <a href="https://kinolog.life/">Kinolog.life</a>
    </nav>
  </div>
</footer>
<div class="cookie" id="cookie-note">
  <p>Это окно запоминается в браузере. <a href="/cookies-policy/">Политика cookie</a>.</p>
  <button class="btn" type="button" id="cookie-ok">Понятно</button>
</div>
<script src="/shell-assets/site.js?v=2" defer></script>
</body>
</html>`;
}

const BODIES = {
  "/": layout("/", `
  <section class="wrap hero">
    <div>
      <p class="eyebrow">Онлайн-школа</p>
      <h1>Короткие уроки, чтобы заниматься с собакой дома</h1>
      <p class="lead">Один доступ: видео и материалы. Занимаетесь в своём темпе, без чужой программы и без очной группы.</p>
      <div class="hero__actions">
        <a class="btn" href="/tarif">Открыть доступ</a>
        <a class="text-link" href="/kak-ustroeno">Как это устроено</a>
      </div>
    </div>
    <figure class="hero__photo">
      <img src="/shell-assets/lab-walk.webp" alt="Светлая собака идёт рядом с человеком на городской прогулке" width="1200" height="1500">
    </figure>
  </section>
  <section class="wrap section">
    <h2>Три шага</h2>
    <div class="steps">
      <article class="step"><b>01</b><div><h3>Аккаунт</h3><p>Почта и пароль. Если аккаунт уже есть — просто войдите.</p></div></article>
      <article class="step"><b>02</b><div><h3>Оплата</h3><p>1&nbsp;990&nbsp;₽ в месяц через Robokassa. Условия — в оферте.</p></div></article>
      <article class="step"><b>03</b><div><h3>Уроки</h3><p>После оплаты открывается кабинет с занятиями.</p></div></article>
    </div>
  </section>
  <section class="wrap section">
    <div class="price-band">
      <div>
        <p class="eyebrow">Одна цена</p>
        <strong>1&nbsp;990&nbsp;₽</strong>
        <p>в месяц за уроки и материалы</p>
      </div>
      <a class="btn" href="/tarif">Оформить доступ</a>
    </div>
  </section>`),

  "/kak-ustroeno": layout("/kak-ustroeno", `
  <section class="wrap panel">
    <p class="eyebrow">Как устроено</p>
    <h1>Школа живёт в браузере</h1>
    <p class="lead">Это онлайн-курс для занятий дома. Регистрация, оплата и срок доступа — здесь. Сами уроки открываются в кабинете после оплаты.</p>
    <div class="steps">
      <article class="step"><b>01</b><div><h3>Регистрация</h3><p>Имя, почта и пароль. Можно и сразу оплатить с почты — аккаунт создастся при платеже, пароль придёт письмом.</p></div></article>
      <article class="step"><b>02</b><div><h3>1&nbsp;990&nbsp;₽ в месяц</h3><p>Платёж принимает Robokassa. Автопродление описано в оферте, его можно отменить.</p></div></article>
      <article class="step"><b>03</b><div><h3>Кабинет</h3><p>Пока доступ активен, с этой страницы вы переходите к урокам. Когда срок кончается, доступ закрывается до следующей оплаты.</p></div></article>
    </div>
    <p class="hero__actions"><a class="btn" href="/tarif">К оплате</a></p>
  </section>`),

  "/tarif": layout("/tarif", `
  <section class="wrap panel">
    <p class="eyebrow">Доступ</p>
    <h1>Уроки и материалы</h1>
    <div id="pay-root"><p class="fine">Готовим форму оплаты…</p></div>
  </section>`),

  "/register": layout("/register", `
  <section class="wrap panel">
    <p class="eyebrow">Регистрация</p>
    <h1>Аккаунт школы</h1>
    <p class="lead">Пароль задаёте вы. Письмо со ссылкой подтверждения придёт на почту. Оплата — следующим шагом.</p>
    <p class="warn" id="reg-error" hidden></p>
    <form method="post" action="/wp-admin/admin-post.php" data-shell-nonce="kl_shell_boot">
      <input type="hidden" name="action" value="kl_shell_register">
      <span data-nonce-slot></span>
      <label class="honeypot">Компания<input type="text" name="company" tabindex="-1" autocomplete="off"></label>
      <label>Имя<input type="text" name="kl_name" required maxlength="80" autocomplete="name"></label>
      <label>Эл. почта<input type="email" name="kl_email" required autocomplete="email" inputmode="email"></label>
      <label>Пароль<input type="password" name="kl_password" required minlength="8" maxlength="200" autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="kl_shell_pdn" value="1" required><span>Даю согласие на <a href="/consent-pdn/" target="_blank" rel="noopener">обработку персональных данных</a> и принимаю <a href="/terms-of-use/" target="_blank" rel="noopener">соглашение</a>.</span></label>
      <button class="btn" type="submit" disabled>Создать аккаунт</button>
      <p class="warn" data-form-error hidden></p>
    </form>
    <p class="fine">Уже регистрировались? <a href="/login">Войти</a></p>
  </section>`),

  "/login": layout("/login", `
  <section class="wrap panel">
    <p class="eyebrow">Вход</p>
    <h1>С возвращением</h1>
    <p class="lead">Та же почта и пароль, что и раньше. Новые аккаунты входят сюда же.</p>
    <p class="warn" id="login-error" hidden></p>
    <form method="post" action="/wp-admin/admin-post.php" data-shell-nonce="kl_shell_boot">
      <input type="hidden" name="action" value="kl_shell_login">
      <input type="hidden" name="next" id="login-next" value="/account">
      <span data-nonce-slot></span>
      <label>Почта или логин<input type="text" name="kl_login" required autocomplete="username"></label>
      <label>Пароль<input type="password" name="kl_password" required autocomplete="current-password"></label>
      <button class="btn" type="submit" disabled>Войти</button>
      <p class="warn" data-form-error hidden></p>
    </form>
    <p class="fine"><a href="/register">Создать аккаунт</a> · <a href="/wp-login.php?action=lostpassword">Забыли пароль</a></p>
  </section>`),

  "/account": layout("/account", `
  <section class="wrap panel">
    <p class="eyebrow">Кабинет</p>
    <h1>Ваш доступ</h1>
    <div id="account-root"><p class="fine">Проверяем подписку…</p></div>
  </section>`)
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": type.includes("html") ? "no-cache" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(body);
}

function asset(reqPath, res) {
  const rel = reqPath.replace(/^\/shell-assets\//, "");
  if (!rel || rel.includes("\0") || rel.split("/").some((p) => p === "..")) {
    send(res, 403, "forbidden", "text/plain; charset=utf-8");
    return;
  }
  const file = path.normalize(path.join(ASSETS, rel));
  if (!file.startsWith(ASSETS + path.sep) && file !== ASSETS) {
    send(res, 403, "forbidden", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, "not found", "text/plain; charset=utf-8");
      return;
    }
    const ext = path.extname(file);
    const types = {
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".webp": "image/webp",
      ".svg": "image/svg+xml"
    };
    send(res, 200, data, types[ext] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "method", "text/plain; charset=utf-8");
    return;
  }
  if (pathname === "/shell-health") {
    send(res, 200, "ok", "text/plain; charset=utf-8");
    return;
  }
  if (url.pathname.startsWith("/shell-assets/")) {
    asset(decodeURIComponent(url.pathname), res);
    return;
  }
  const html = BODIES[pathname];
  if (!html) {
    send(res, 404, layout("/", `<section class="wrap panel"><h1>Страница не найдена</h1><p><a href="/">На главную</a></p></section>`), "text/html; charset=utf-8");
    return;
  }
  send(res, 200, html, "text/html; charset=utf-8");
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`kinologlife-shell ${HOST}:${PORT}\n`);
});
