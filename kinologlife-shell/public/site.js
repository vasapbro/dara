(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.getElementById("menu-toggle");
  if (header && toggle) {
    var close = function () {
      header.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    header.querySelectorAll("[data-menu-dismiss]").forEach(function (el) {
      el.addEventListener("click", close);
    });
  }

  var cookie = document.getElementById("cookie-note");
  if (cookie) {
    try {
      if (localStorage.getItem("kl-shell-cookie") === "1") cookie.hidden = true;
    } catch (e) {}
    var ok = document.getElementById("cookie-ok");
    if (ok) {
      ok.addEventListener("click", function () {
        try { localStorage.setItem("kl-shell-cookie", "1"); } catch (e) {}
        cookie.hidden = true;
      });
    }
  }

  function api(action) {
    return fetch("/wp-admin/admin-post.php?action=" + action, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      if (!res.ok) throw new Error("bad");
      return res.json();
    });
  }

  var query = new URLSearchParams(location.search);
  var messages = {
    "1": "Не получилось. Проверьте почту и пароль.",
    nonce: "Страница устарела. Обновите её и попробуйте снова.",
    rate: "Слишком много попыток. Подождите пятнадцать минут.",
    email: "Нужна настоящая почта.",
    exists: "Такая почта уже зарегистрирована. Войдите.",
    fields: "Имя от 2 символов и пароль от 8.",
    consent: "Нужно согласие на обработку персональных данных."
  };
  ["login-error", "reg-error"].forEach(function (id) {
    var el = document.getElementById(id);
    var code = query.get("error");
    if (el && code && messages[code]) {
      el.hidden = false;
      el.textContent = messages[code];
    }
  });
  var nextField = document.getElementById("login-next");
  var wanted = query.get("next") || "";
  if (nextField && wanted.startsWith("/") && !wanted.startsWith("//")) {
    nextField.value = wanted;
  }

  document.querySelectorAll("form[data-shell-nonce]").forEach(function (form) {
    var action = form.getAttribute("data-shell-nonce");
    var slot = form.querySelector("[data-nonce-slot]");
    var button = form.querySelector("button[type=submit]");
    api(action).then(function (data) {
      if (slot && data.nonce_html) slot.innerHTML = data.nonce_html;
      if (button) button.disabled = false;
    }).catch(function () {
      var warn = form.querySelector("[data-form-error]");
      if (warn) {
        warn.hidden = false;
        warn.textContent = "Не удалось подготовить форму. Обновите страницу.";
      }
    });
  });

  var payRoot = document.getElementById("pay-root");
  if (payRoot) {
    var params = new URLSearchParams(location.search);
    api("kl_shell_pay").then(function (data) {
      renderPay(payRoot, data, params.get("from") === "baza");
    }).catch(function () {
      payRoot.innerHTML = '<p class="warn">Форма оплаты не открылась. Напишите на info@kinologlife.online или откройте <a href="/contacts/">контакты</a>.</p>';
    });
  }

  var account = document.getElementById("account-root");
  if (account) {
    api("kl_shell_me").then(function (data) {
      renderAccount(account, data);
    }).catch(function () {
      account.innerHTML = '<p class="warn">Не удалось прочитать состояние доступа. Обновите страницу.</p>';
    });
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
  }

  function renderPay(root, data, fromBaza) {
    var html = "";
    if (fromBaza) {
      html += '<p class="note">Уроки откроются после оплаты доступа.</p>';
    }
    if (!data.configured) {
      html += '<p class="warn">Онлайн-оплата временно недоступна. Напишите в <a href="/contacts/">поддержку</a>.</p>';
      root.innerHTML = html;
      return;
    }
    html += '<p class="price-line"><strong>' + money(data.price || 1990) + '</strong> в месяц</p>';
    html += '<p class="fine">Уроки и материалы онлайн-школы. Оплата проходит в Robokassa. Условия списания, возврата и отмены — в <a href="' + esc(data.offer_url) + '" target="_blank" rel="noopener">оферте</a>.</p>';
    if (data.logged_in) {
      html += '<p class="fine">Аккаунт: ' + esc(data.email || data.name || "вы вошли") + '</p>';
    }
    html += '<form method="post" action="/wp-admin/admin-post.php">';
    html += '<input type="hidden" name="action" value="kl_rb_start_sub">';
    html += data.nonce_html || "";
    html += '<input type="hidden" name="tier" value="club">';
    if (!data.logged_in) {
      html += '<label>Эл. почта<input type="email" name="kl_email" required autocomplete="email" inputmode="email" placeholder="you@example.com"></label>';
      html += '<p class="fine"><a href="/login?next=/tarif">Уже есть аккаунт? Войти</a></p>';
    }
    html += consentBox("kl_rb_pdn_consent", 'Даю согласие на <a href="' + esc(data.pdn_url) + '" target="_blank" rel="noopener">обработку персональных данных</a> в соответствии с <a href="' + esc(data.privacy_url) + '" target="_blank" rel="noopener">политикой конфиденциальности</a>.');
    if (data.consent_required) {
      html += consentBox("kl_rb_recurring_consent", esc(data.consent_text || "Я согласен на автоматические списания согласно оферте"));
    }
    html += '<button class="btn" type="submit">Открыть доступ</button>';
    html += "</form>";
    if (data.logged_in && data.can_curator) {
      html += '<div class="addon"><p class="fine">Куратор — разбор ролика, ' + money(data.curator_price || 14990) + " за 30 дней, без автосписания. Не заменяет доступ к урокам.</p>";
      html += '<form method="post" action="/wp-admin/admin-post.php">';
      html += '<input type="hidden" name="action" value="kl_rb_start_sub">';
      html += data.nonce_html || "";
      html += '<input type="hidden" name="tier" value="curator">';
      html += consentBox("kl_rb_pdn_consent", 'Даю согласие на <a href="' + esc(data.pdn_url) + '" target="_blank" rel="noopener">обработку персональных данных</a>.');
      html += '<button class="btn" type="submit">Добавить куратора</button></form></div>';
    }
    root.innerHTML = html;
  }

  function renderAccount(root, data) {
    if (!data.logged_in) {
      root.innerHTML = '<p class="lead">Войдите, чтобы увидеть срок доступа.</p><p><a class="btn" href="/login?next=/account">Войти</a></p>';
      return;
    }
    var html = '<div class="status-card">';
    html += "<h2>" + esc(data.name || data.email) + "</h2>";
    html += "<p>" + esc(data.email || "") + "</p>";
    if (data.has_access) {
      html += "<p>Доступ открыт" + (data.access_until_label ? " до <strong>" + esc(data.access_until_label) + "</strong>" : "") + ".</p>";
      if (data.recurring_active) html += "<p class=\"fine\">Автопродление включено.</p>";
      html += '<p class="fine">Уроки открываются из общего аккаунта. Отдельный пароль школы в кабинет не передаётся.</p>';
    } else {
      html += "<p>Сейчас доступа к урокам нет.</p>";
      html += '<p><a class="btn" href="/tarif">Открыть доступ</a></p>';
    }
    if (data.email_verified === false) {
      html += '<p class="fine">Подтвердите почту по ссылке из письма. Доступ к урокам это не блокирует.</p>';
    }
    html += "</div>";
    html += '<form method="post" action="/wp-admin/admin-post.php" data-shell-nonce="kl_shell_boot">';
    html += '<input type="hidden" name="action" value="kl_shell_logout">';
    html += '<span data-nonce-slot></span>';
    html += '<button class="btn" type="submit" disabled>Выйти</button>';
    html += '<p class="warn" data-form-error hidden></p>';
    html += "</form>";
    root.innerHTML = html;
    root.querySelectorAll("form[data-shell-nonce]").forEach(function (form) {
      api("kl_shell_boot").then(function (boot) {
        var slot = form.querySelector("[data-nonce-slot]");
        if (slot) slot.innerHTML = boot.nonce_html || "";
        var button = form.querySelector("button");
        if (button) button.disabled = false;
      });
    });
  }

  function consentBox(name, inner) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="1" required><span>' + inner + "</span></label>";
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
