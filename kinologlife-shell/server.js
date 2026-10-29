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
    `<a href="${href}" data-menu-dismiss${page === href ? ' aria-current="page"' : ""}>${label}</a>`;
  const home = page === "/";
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${home ? "Кинолог LIFE — онлайн-школа" : `${PAGES[page].title} — Кинолог LIFE`}</title>
  <meta name="description" content="Онлайн-школа Кинолог LIFE: короткие уроки с собакой дома. Один доступ — 1 990 ₽ в месяц.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/shell-assets/site.css?v=3">
  <link rel="icon" href="/shell-assets/logo.png" type="image/png">
</head>
<body class="${home ? "is-home" : "is-inner"}">
<a class="skip-link" href="#main">К содержанию</a>
<div class="meadow-bg" aria-hidden="true"></div>
<header class="site-header" id="top">
  <a class="site-logo" href="/" aria-label="Кинолог LIFE — на главную">
    <img src="/shell-assets/logo.png?v=3" alt="" width="1680" height="1073">
  </a>
  <button class="site-menu-toggle" type="button" id="menu-toggle" aria-expanded="false" aria-controls="site-menu">
    <span class="visually-hidden">Меню</span>
    <i></i><i></i><i></i>
  </button>
  <button class="site-header__backdrop" type="button" data-menu-dismiss aria-label="Закрыть меню"></button>
  <nav class="site-header__panel global-nav" id="site-menu" aria-label="Основная навигация">
    ${nav("/#komu", "Кому подойдёт")}
    ${nav("/kak-ustroeno", "Как устроено")}
    ${nav("/tarif", "Доступ")}
    ${nav("/login", "Вход")}
    ${nav("/register", "Регистрация")}
    ${nav("/account", "Кабинет")}
  </nav>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="site-footer__inner">
    <p>Онлайн-школа Кинолог LIFE. ИП Даровских А. А. · ИНН 430100731903 · ОГРНИП 324430000060748 · пгт. Арбаж, ул. Зелёная, д. 11 · <a href="mailto:info@kinologlife.online">info@kinologlife.online</a></p>
    <nav aria-label="Документы">
      <a href="/offer/">Оферта</a>
      <a href="/privacy-policy/">Персональные данные</a>
      <a href="/consent-pdn/">Согласие</a>
      <a href="/cookies-policy/">Cookie</a>
      <a href="/terms-of-use/">Соглашение</a>
      <a href="/contacts/">Контакты</a>
    </nav>
  </div>
</footer>
<div class="cookie" id="cookie-note">
  <p>Пользуясь сайтом, вы соглашаетесь с <a href="/cookies-policy/">политикой cookie</a>.</p>
  <button class="btn" type="button" id="cookie-ok">Хорошо</button>
</div>
<script src="/shell-assets/site.js?v=3" defer></script>
</body>
</html>`;
}

const BODIES = {
  "/": layout("/", `
  <section class="hero">
    <div class="hero__card">
      <h1>Кинолог LIFE</h1>
      <p class="lead">Онлайн-школа. Короткие уроки, чтобы заниматься с собакой дома.</p>
      <div class="hero__actions">
        <a class="btn" href="/tarif">Открыть доступ</a>
      </div>
    </div>
  </section>
  <section class="band" id="komu">
    <div class="band__inner">
      <h2>Когда занятия дома уже нужны</h2>
      <div class="cards">
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>Лает, когда остаётся одна, и не может успокоиться в квартире.</p></article>
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>На прогулке не отзывается и не слышит «ко мне».</p></article>
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>Прыгает на гостей и не встречает людей спокойно.</p></article>
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>Тянет поводок, и прогулка превращается в борьбу.</p></article>
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>Грызёт вещи, пока вас нет рядом.</p></article>
        <article class="card"><span class="mark" aria-hidden="true">·</span><p>Боится людей и других собак, тяжело выходить из дома.</p></article>
      </div>
    </div>
  </section>
  <section class="band">
    <div class="band__inner">
      <h2>Как устроена школа</h2>
      <div class="steps">
        <article class="step"><b>01</b><h3>Аккаунт</h3><p>Почта и пароль. Если аккаунт уже есть, войдите.</p></article>
        <article class="step"><b>02</b><h3>Оплата</h3><p>1&nbsp;990&nbsp;₽ в месяц через Robokassa. Условия — в оферте.</p></article>
        <article class="step"><b>03</b><h3>Уроки</h3><p>После оплаты открывается кабинет с занятиями. Смотрите и повторяете дома.</p></article>
      </div>
    </div>
  </section>
  <section class="band">
    <div class="price-card">
      <div>
        <p class="eyebrow">Один доступ</p>
        <strong>1&nbsp;990&nbsp;₽</strong>
        <p>в месяц за уроки и материалы</p>
      </div>
      <a class="btn" href="/tarif">Оформить доступ</a>
    </div>
  </section>`),

  "/kak-ustroeno": layout("/kak-ustroeno", `
  <section class="sheet">
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
  <section class="sheet">
    <p class="eyebrow">Доступ</p>
    <h1>Уроки и материалы</h1>
    <div id="pay-root"><p class="fine">Готовим форму оплаты…</p></div>
  </section>`),

  "/register": layout("/register", `
  <section class="sheet">
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
  <section class="sheet">
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
  <section class="sheet">
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
      ".png": "image/png",
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
    send(res, 404, layout("/", `<section class="sheet"><h1>Страница не найдена</h1><p><a href="/">На главную</a></p></section>`), "text/html; charset=utf-8");
    return;
  }
  send(res, 200, html, "text/html; charset=utf-8");
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`kinologlife-shell ${HOST}:${PORT}\n`);
});
