---
cursor:
  subagentId: "bc-4bb9dc86-06e0-57a0-a547-ea45ed21f1f6"
---

# Передача: онлайн-школа для агента «Приложение + CRM»

Снято с живых серверов и репозитория 29 октября 2026. Секретов, паролей и строк подключения здесь нет. Контракт входа и интеграционных API меняется только через этот документ: тихо править общий логин или эти эндпоинты нельзя.

Отдельной двери школы в приложении и задачи OSH-4 нет. В репозитории нет веток и коммитов iOS или OSH-4, откатывать нечего.

## 1. Репозитории, ветки, SHA

Публичная оболочка и новый кабинет лежат в git:

- Репозиторий: `https://github.com/vasapbro/dara`
- Ветка: `cursor/online-school-shell-f1f6`
- HEAD: `697b2aa614f378085b8a886d46d304b3b711679a`
- База `master`: `d80eeb4709f1acb8c99369fe995d1438829ef05b`
- Других веток на origin нет.

Коммиты ветки поверх `master`, от новых к старым:

| SHA | Смысл |
| --- | --- |
| `697b2aa614f378085b8a886d46d304b3b711679a` | Вёрстка входа и списка уроков |
| `220ff914c2eaef3540a9c0ea26c1e2550490030c` | Переход с сессии сайта в кабинет без второго пароля |
| `7120d2749ae311ef9dc735d09a7b3ff874c49b79` | Кабинет: два раздела и Kinescope |
| `2c803152b3838ed26673e3a126a8455ceeeb3f0a` | Меню и блок причин на главной |
| `123f775d1c97eafba9105d5550c68a5bcd4561aa` | Герой на акварельном лугу |
| `eeeff8342809abaa74ffbff31cd951a99051e554` | Акварельная оболочка |
| `cc60cce3137e581ecf0bafabcaf09e5eba6e9d42` | Публичная оболочка |

Каталоги в репозитории: `kinologlife-shell/`, `kinologlife-cabinet/`.

На VPS, не в git:

- Оболочка: `/root/kinologlife_shell` (код отдаётся контейнером как `/app`).
- Кабинет: `/root/kinologlife_cabinet/app` (том `/app`), данные `/root/kinologlife_cabinet/data`, секреты в файле рядом с compose, в git его нет.
- WordPress: `/root/wp_kinologlife/kinologlife_wp_html`, mu-plugins в `wp-content/mu-plugins/`.
- Старый кабинет Next.js: `/root/kinolog_baza`. Публичный хост на него больше не смотрит. Контейнер `kinolog_baza-frontend` оставлен как есть.
- CRM: `/root/kinolog_crm`. Каталога `.git` в корне CRM нет. Это отдельное приложение (backend на Python, frontend), не коммит dara.

SHA-256 файлов на диске совпал с деревом коммита `697b2aa`:

| Файл на сервере | SHA-256 |
| --- | --- |
| `/root/kinologlife_shell/server.js` | `6752352af67c999d7fd57261edf36e69df8482ee470b2fce302f892d1ca21a0f` |
| `/root/kinologlife_cabinet/app/server.js` | `122a5baa96fac1b7feebdae4f2e10088a707ce682b0f09f308cd78297c22d464` |
| `/root/kinologlife_cabinet/app/lessons.js` | `5de8b4182725d87f14d946cbccaf9d09e5376fae0b649a84f9cbee4872641309` |
| `/root/kinologlife_cabinet/app/public/cabinet.css` | `decaf864314a5574458a1eb05df52947a26e6013b41743b6a04d0e7320d35b2e` |
| `.../mu-plugins/kl-shell-public.php` | `057c1e814dbd3c49f485297563c1346ec3e972c41da95221f50a108246d03dba` |
| `.../mu-plugins/kl-cabinet-auth.php` | `11ce10266c1230b21afa577f11ec429ad5c7c4d05f5629380c64d6b43a43cedf` |
| `/etc/nginx/snippets/kinologlife-shell.conf` | `b852347664b37500d2bcee425b1907b7c353b11146b177d75414a679ade3441d` |

## 2. Что уже стоит и куда смотрит nginx

Проверено `docker ps` в момент снятия.

| Контейнер | Состояние | Куда слушает |
| --- | --- | --- |
| `kinologlife_shell` | Up | host network, процесс на `127.0.0.1:3020` |
| `kinologlife_cabinet` | Up | host network, процесс на `127.0.0.1:3021` |
| `kinolog_baza-frontend` | Up 8 weeks | `127.0.0.1:3003` и `127.0.0.1:3011` |
| `wp_kinologlife-wordpress-1` | Up | `127.0.0.1:8088` |
| `kinolog_crm-db-1` | Up, healthy | `127.0.0.1:5432` |
| `kinolog_baza-db` | Up | `127.0.0.1:5436` |

Контейнера приложения CRM в этом списке не было. Код CRM на диске есть, база CRM поднята. Имя публичного URL CRM в этот документ не входит.

`kinologlife.online`. Порты 80 и 443 оба проксируют (TLS снимает площадка). Сниппет `/etc/nginx/snippets/kinologlife-shell.conf` отдаёт на `127.0.0.1:3020` пути `/`, `/kak-ustroeno`, `/tarif`, `/register`, `/login`, `/account`, `/shell-assets/`, `/shell-health`. Голый `GET /` с признаками WordPress (`kl_baza_sso`, `kl_confirm`, превью, `rest_route` и соседние) остаётся на WordPress `127.0.0.1:8088`. Голый `GET /join/` плагин уводит на `/tarif`. Возврат Robokassa (`rb_paid`, `pt`, cookie заявки и служебные флаги) остаётся на WordPress. Статьи, оферта, политики, `wp-admin` — WordPress.

Живые страницы оболочки:

- `https://kinologlife.online/`
- `https://kinologlife.online/kak-ustroeno`
- `https://kinologlife.online/tarif` — оплата, Robokassa, цена клуба 1 990 ₽
- `https://kinologlife.online/register`
- `https://kinologlife.online/login`
- `https://kinologlife.online/account`
- `GET /shell-health` → текст `ok`

`baza.kinologlife.online`. Файл `/etc/nginx/sites-available/baza`. `location /` проксирует на `http://127.0.0.1:3021`. Старый сокет коворкинга из этого файла убран. Откат nginx: `/root/nginx-backups/baza.bak-cabinet-20261029-131041`.

Кабинет: `https://baza.kinologlife.online/`. `GET /health` → `{"ok":true}`.

Что умеет кабинет сейчас: вход тем же паролем WordPress, список из двух разделов, страница урока с iframe Kinescope и отметкой «пройден». Квизов, лапок, коворкинга и формы оплаты в нём нет. Оплата остаётся на `/tarif`.

## 3. Пользователи школы и вход

Учётная запись школы — пользователь WordPress. Отдельной таблицы учеников и второго хранилища паролей нет.

Роль регистрации оболочки — `subscriber`. Логин равен email. Пароль пишет `wp_insert_user` как обычный пароль WordPress.

Регистрация `POST` на `admin-post.php`, `action=kl_shell_register`. Поля: `kl_email`, `kl_name`, `kl_password`, согласие `kl_shell_pdn`, nonce `kl_shell_nonce` (действие `kl_shell`), скрытое поле `company` — ловушка. Успех ставит cookie WordPress и ведёт на `/account?welcome=1`. Мета: `kl_email_verified=0`, `kl_shell_registered` = unix-время. Срок подписки регистрация не пишет. Письмо подтверждения уходит, если на сайте есть функции выдачи токена. Ошибки — редирект на `/register?error=`: `nonce`, `1`, `rate`, `consent`, `email`, `exists`, `fields`. Лимит 8 попыток за 15 минут с одного IP.

Вход на сайт `POST`, `action=kl_shell_login`. Поля `kl_login` (email или логин), `kl_password`, nonce, необязательный `next` только на путь этого же сайта. Внутри `wp_signon` с `remember`. Успех — редирект на `next` или `/account`. Ошибки: `/login?error=1`, `nonce`, `rate` (10 попыток / 15 минут с IP).

Выход: `POST action=kl_shell_logout` с тем же nonce, затем редирект на `/`.

Состояние для оболочки, без сессии, проверено живьём:

`GET /wp-admin/admin-post.php?action=kl_shell_me` → 200

```json
{"ok":true,"logged_in":false,"name":"","email":"","has_access":false,"access_until_unix":0,"access_until_label":"","recurring_active":false,"force_password":false,"email_verified":null,"sso_url":""}
```

`POST` на тот же `kl_shell_me` → 405 `{"ok":false}`.

Когда человек вошёл, те же поля заполняются из пользователя. `email_verified`: `true` при мете `1`, `false` при `0`, `null` если меты нет. `sso_url` непустой только при доступе к урокам и равен `https://kinologlife.online/wp-admin/admin-post.php?action=kl_cabinet_go`. `force_password` истинно при `kl_rb_force_pw=1`. `recurring_active` истинно при `kl_rb_recurring_active=1`.

Оплата с оболочки не реализована заново. `GET action=kl_shell_pay` без сессии вернул `ok`, `price` 1990, `curator_price` 14990, `configured` true, `consent_required` true и HTML nonce Robokassa (`kl_rb_nonce`, действие `kl_rb_start`). Форма на `/tarif` уходит в существующий `action=kl_rb_start_sub`. Result URL Robokassa не менялся.

### Переход сайт → кабинет

Cookie кабинета не ставится на `.kinologlife.online`. Связка одноразовая.

1. Кнопка «Перейти к урокам» или «Войти с сайта» открывает `GET action=kl_cabinet_go`.
2. Без сессии WordPress ответ 302 на `https://kinologlife.online/login`. Это проверено.
3. С сессией плагин кладёт на 90 секунд transient `klgo_` + sha256 токена = id пользователя, заголовок `Referrer-Policy: no-referrer`, 302 на `https://baza.kinologlife.online/enter?t=...`. Токен — 32 случайных байта в base64url.
4. Кабинет `GET /enter?t=` шлёт токен сервером на `kl_cabinet_redeem`. Transient сразу удаляется. Успех: cookie `kl_cab` и 303 на `/`.
5. Повтор той же ссылки, битый `t` или пустой `/enter` → 303 на `/login?error=link`. Пустой `/enter` проверен: 303 `/login?error=link`. Текст на странице: «Ссылка на уроки устарела. Откройте их снова со страницы доступа.»

Прямой вход в кабинет остаётся. `POST /login` поля `email` и `password`. Кабинет спрашивает WordPress `kl_cabinet_login` (`wp_authenticate`, cookie WordPress браузеру не ставится). Пустые поля проверены: 303 `/login?error=1`. Чужой или неверный пароль — тот же код. Лимит 8 попыток за 15 минут и в PHP, и в процессе Node; при лимите `/login?error=rate`.

Сессия кабинета: cookie `kl_cab`, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 14 суток, без атрибута Domain (только хост `baza`). Полезная нагрузка: `uid`, `exp`, `csrf`, подписана HMAC. На каждый запрос доступ перепроверяется через `kl_cabinet_access`, кэш в памяти 45 секунд, при отказе WordPress страница «Не удалось проверить доступ». Выход — `POST /logout` с тем же `csrf`.

Без доступа список уроков не отдаётся, есть ссылка на `https://kinologlife.online/tarif`. С доступом `GET /` — два раздела, `GET /lesson/{section}/{slug}` — урок, `POST /lesson/{section}/{slug}/done` переключает отметку.

Старый путь тестировщика `GET https://baza.kinologlife.online/api/client/wp-sso` новый кабинет не обслуживает: запрос без сессии заканчивается страницей входа кабинета. Константа в `kl-tester-invite.php`: `KL_TESTER_BAZA_CALLBACK` = origin baza + `/api/client/wp-sso`.

## 4. Какие API есть на самом деле

Каталога, прогресса и профиля в виде публичного JSON для приложения нет. Каталог — файл `lessons.js`, страница рисуется HTML. Прогресс — локальный JSON, не HTTP.

### Оболочка, admin-post

База: `https://kinologlife.online/wp-admin/admin-post.php?action=`

| action | Метод | Кто вызывает | Ответ |
| --- | --- | --- | --- |
| `kl_shell_boot` | GET | страница оболочки | 200 `{"ok":true,"nonce_html":"..."}` |
| `kl_shell_me` | GET | страница оболочки | JSON из раздела 3. Иной метод — 405 |
| `kl_shell_pay` | GET | страница тарифа | цена, флаги Robokassa, nonce. Иной метод — 405 |
| `kl_shell_login` | POST | форма | редирект, не JSON |
| `kl_shell_register` | POST | форма | редирект, не JSON |
| `kl_shell_logout` | POST | форма | редирект |

### Кабинет ↔ WordPress, только сервер-сервер

Кабинет ходит на WordPress по `127.0.0.1:8088`, Host `kinologlife.online`, заголовок `X-KL-Cabinet`. Секрет — опция `kl_cabinet_shared_secret` (не autoload) и переменная процесса кабинета. Значение короче 32 символов или неверный заголовок: HTTP 404 `{"ok":false}`. Это не публичный API браузера.

`POST action=kl_cabinet_login`, тело form: `email`, `password`.

- 200: `{"ok":true,"uid":число,"name":"...","email":"...","has_access":bool,"access_until":unix}`
- 401: `{"ok":false,"error":"auth"}` — пустые поля, пароль длиннее 200, неверный пароль
- 429: `{"ok":false,"error":"rate"}`
- 404: нет или неверен секрет

`POST action=kl_cabinet_access`, тело `uid`. Успех — тот же объект. Нет пользователя или `uid<=0` — 404 `{"ok":false}`.

`POST action=kl_cabinet_redeem`, тело `token`. Токен должен совпасть с `^[A-Za-z0-9_-]{20,128}$`. Успех — тот же объект доступа. Неверный или уже использованный токен — 401 `{"ok":false}`.

`GET action=kl_cabinet_go` — браузерный редирект из раздела 3, не JSON. Не-GET — 405.

Браузерные маршруты кабинета отдают HTML или редирект. `GET /health` — единственный JSON кабинета наружу: `{"ok":true}`.

### WordPress REST `kl/v1`, уже занятые школой и CRM

Без заголовка `X-KL-CRM-Token` проверено:

- `GET /wp-json/kl/v1/online-users` → 401 `{"code":"kl_rb_log_forbidden","message":"Missing X-KL-CRM-Token","data":{"status":401}}`
- `POST /wp-json/kl/v1/online-funnel-snapshot` → тот же 401
- `POST /wp-json/kl/v1/baza-verify-login` с пустым JSON → 401 `{"code":"rest_forbidden","message":"Извините, вам не разрешено выполнять данное действие.","data":{"status":401}}`
- `POST /wp-json/kl/v1/user-subscription-access` → тот же `rest_forbidden`
- `POST /wp-json/kl/v1/promo-codes/validate` с пустым телом → 200 `{"valid":false}` (этот метод без CRM-токена ответил)

Заголовок старого серверного доступа baza: `x-baza-key`. Значение не приводится.

`GET /wp-json/kl/v1/online-users` — список. Ответ: `items`, `total`, `page`, `per_page`, `total_pages`. Элемент `items`:

`wp_user_id`, `user_login`, `user_email`, `display_name`, `registered_at` (ISO), `wp_roles`, `role_labels`, `is_admin`, `is_tester`, `access_kind`, `access_label`, `access_active`, `articles_active`, `video_active`, `articles_until`, `video_until`, `telegram_id`, `telegram_username`, счётчики и список активных устройств (`ip`, `ua`, `last_seen`, `source`).

`access_kind`: `admin` (право `manage_options`, подпись «Админ»), `club` (видео или старый клуб, подпись «Клуб (видео + база)»), `articles` («База знаний»), `none` («Нет подписки»). `is_tester` — мета `kl_tester`.

`POST /wp-json/kl/v1/online-users` создаёт пользователя WordPress. Поля: `user_login`, `user_email`, `user_pass`, `display_name`, `club_days`. После успешной вставки код пишет `kl_tester=1`, `kl_tester_source=crm`, `kl_email_verified=1` и вызывает выдачу дней. Ответ 201 `{"item": ...}` — та же строка, что в списке. Ошибки из кода: `kl_crm_users_bad_request` 400, `kl_crm_users_bad_email` 400, `kl_crm_users_login_taken` 409, `kl_crm_users_email_taken` 409, `kl_crm_users_create_fail` 400 или 500.

`POST /wp-json/kl/v1/online-users/{id}` меняет те же поля и может дописать `club_days`. 200 `{"item": ...}`. Ошибки: `kl_crm_users_not_found` 404, логин или email заняты 409, `kl_crm_users_update_fail` 400 или 500.

Выдача дней `kl_crm_online_users_grant_club_days`: дни от 1 до 3650, срок = max(сейчас, текущие articles, текущие video) + дни × 86400. Пишет и `kl_sub_articles_until`, и `kl_sub_video_until`. Ноль дней ничего не продлевает.

`POST /wp-json/kl/v1/online-user-profiles` — профили по списку id. В коде ответ `{"items":[...]}` с `user_email` и соседними полями; больше 300 id → 400 `{"error":"too_many_ids","max":300}`.

`POST /wp-json/kl/v1/online-funnel-snapshot` — снимок для воронки CRM. Больше 300 записей → 400 `{"error":"too_many","max":300}`. Иначе 200 `{"results":[...]}`. Поля результата, которые читает код: `has_wp_account`, `tg_linked`, `payment_count`, `payment_sum`, `first_paid_at`, `last_paid_at`, `has_active_access`, `has_promo`, `promo_code`, `promo_access_active`, `promo_duration_days`. Id ищется по ключам `wp_user_id`, `user_id`, `lk_user_id`. Живой успешный снимок в этот проход не снимался: без токена метод закрыт.

Рядом, тем же токеном CRM, уже висят и не являются кабинетом: `GET /subscription-payments`, `GET /subscription-active-stats`, `GET /site-period-stats`, `POST /send-email`, промокоды ниже. Их контракт для школы не расширять втихую.

Старая проверка пароля для прежнего кабинета, заголовок `x-baza-key`:

`POST /wp-json/kl/v1/baza-verify-login`, JSON `login` и `password`.

- 400 `{"ok":false,"error":"credentials_required"}`
- 429 `{"ok":false,"error":"rate_limited"}`
- 401 `{"ok":false,"error":"invalid_credentials"}`
- 200: `ok`, `login`, `user_id`, `is_admin`, `has_minimum_access`, `has_articles`, `has_video`

`POST /wp-json/kl/v1/user-subscription-access` и `POST /user-subscription-access-by-cookie` отдают полный набор доступа (поля в разделе 6). Без ключа снаружи — `rest_forbidden`, тело метода не разбирается.

`POST /wp-json/kl/v1/baza-cancel-recurring` и `POST /baza-request-password-reset` тоже за тем же ключом. Сброс пароля вызывает штатную почту WordPress. Это не второй пароль школы, и для общего аккаунта его не копировать.

## 5. Kinescope: как даётся просмотр

Кабинет не ходит в API Kinescope и не хранит токен Kinescope. В `/root/kinolog_baza/.env` переменной `KINESCOPE` нет. Ролики остаются на Kinescope.

Право смотреть проверяет кабинет до отрисовки: сессия `kl_cab` и `has_access` из набора WordPress. Нет доступа — iframe не строится, урок редиректит на список. Есть доступ — в страницу вставляется

`https://kinescope.io/embed/{kinescopeId}`

с `allow`: autoplay, fullscreen, picture-in-picture, encrypted-media, gyroscope, accelerometer, clipboard-write, screen-wake-lock. CSP страницы разрешает фреймы `https://kinescope.io`. Отдельной подписи URL кабинетом нет. Ограничение домена, если оно включено, живёт в кабинете Kinescope; новый хост тот же `baza.kinologlife.online`, что у старой школы.

Пустой или неподходящий id (не `^[A-Za-z0-9_-]{8,64}$`) оставляет слот без плеера.

Старый разбор ссылки остался в `/root/kinolog_baza/lib/kinescope-parse.ts`. Старые курсы на диске: `lib/courses/k9-shield.ts`, `lib/courses/stsk9.ts`. Новый кабинет их целиком не подключает.

Текущие id в `lessons.js`:

| Раздел | slug | Название | id |
| --- | --- | --- | --- |
| obuchenie | marker | Как приучить к маркеру | `wuFs5EfuUYdsSH3Y8B78XN` |
| obuchenie | stay | Как учить выдержке команды | `hZ4sttbTLheMzWg2JYB1Tr` |
| zapisi | heel-enzi | Выправка: работа с Энзи | `qNfzV7vy2uriexmepPkhy5` |
| zapisi | fix-heel | Чиним выправку | `6ZwUBRf6cXVXjtw6SvB16u` |
| zapisi | emergency-sit | Аварийное «Сидеть» | `iM2c6yFb4xbS5oHiYYCF1B` |
| zapisi | recall-proof | Подзыв на сложных собаках | `iYjwpUuGCceZuKTv7AkaQQ` |

Отметка «пройден» не связана с Kinescope. Файл `/root/kinologlife_cabinet/data/progress.json`: ключ — id пользователя WordPress, внутри ключ `section/slug`, значение — unix в миллисекундах. Повторный POST ту же отметку снимает. Это один файл одного процесса, не API и не поле CRM.

## 6. Как записана подписка

Цена клуба в коде и в живом `kl_shell_pay`: `KL_SUB_PRICE_CLUB` = 1990. Комментарий у константы: одна цена клуба, рубли в месяц, для разового счёта — 30 дней. Старая витринная цена `KL_SUB_LIST_PRICE_CLUB` = 4990. Куратор `KL_SUB_PRICE_CURATOR` = 14990; для школьного продукта решение ниже — только 1 990 ₽.

Срок — unix в метах пользователя:

- `kl_sub_articles_until`
- `kl_sub_video_until`
- запасной старый вид: если своё поле 0, а `kl_sub_tier` равен `articles` или `video`, берётся `kl_sub_expires`
- куратор: `kl_curator_until` (в доступ уроков школы сам по себе не входит)

`kl_sub_user_has_tier` истинен, только если соответствующий until больше `time()`.

Набор `kl_baza_access_bundle_for_uid` (его читают и оболочка, и кабинет):

- `has_articles`, `has_video` — по сроку
- `legacy` — `kl_kb_user_has_legacy_full_community_access`: роль administrator или editor, право `manage_options`, активный уровень Paid Memberships Pro, активная подписка WooCommerce Subscriptions, мета `wpshop_subscription_active` или `_wpcommunity_subscription`
- `is_staff_account` / `is_unlimited_access` — `manage_options` или `edit_others_posts`
- `has_minimum_access` = legacy или articles или video или сотрудник
- `access_until_unix` = max(articles, video). У сотрудника и у legacy срок может быть 0, а доступ при этом есть
- `recurring_active` — мета `kl_rb_recurring_active` равна `1`. Сама по себе доступ не открывает: если срок уже прошёл, `has_minimum_access` ложен, пока оплата не сдвинет until
- `recurring_cancelled_at_unix`, `last_payment_unix`, `has_curator`, `subscription_label`

Кабинет считает доступ открытым, если `has_minimum_access` или безлимит или сотрудник.

Четыре состояния, как они лежат в данных:

- Активная. `kl_sub_video_until` или `kl_sub_articles_until` в будущем, либо legacy, либо сотрудник. В CRM-строке `access_kind` будет `club` или `articles`, `access_active` true. У видео `access_kind=club`.
- Нет подписки. Оба until равны 0 и нет legacy и нет прав сотрудника. `access_kind=none`, `has_access` false, `access_until_unix` 0. Так остаётся человек сразу после регистрации оболочки.
- Истекла. Until записан и он меньше или равен текущему времени. Мета не стирается, сравнение с `time()` даёт отказ. Рекуррентный флаг может ещё быть `1` — на право смотреть это не влияет.
- Подарок. Отдельного флага «подарок» кабинет не читает. Подарок становится теми же until, поэтому кабинет его видит. Три уже существующих способа:
  - Промокод `kl_promo_grant_access` пишет оба until от max(сейчас, текущие сроки), плюс `kl_promo_code`, `kl_promo_access_until`, `kl_promo_duration_days`, `kl_email_verified=1`, `kl_rb_created_via=promo_code`. Продление `kl_promo_extend_user_access` снова пишет оба until и промо-срок.
  - Инвайт тестировщика `kl_tester_grant_access` пишет оба until на `kl_tester_days()`, мету `kl_tester`, `kl_tester_granted_at`, `kl_email_verified=1`.
  - CRM `club_days` пишет оба until. Создание пользователя из CRM дополнительно помечает `kl_tester=1` и `kl_tester_source=crm`.

REST промокодов, тот же префикс `kl/v1`: `GET/POST /promo-codes`, `POST /promo-codes/validate`, `POST /promo-codes/trial-issue`, `POST /promo-access/extend`, `POST /promo-codes/revoke`. После применения промокод уведомляет CRM путями `/public/promo-redeem` и `/public/promo-issue-sync` (хост в этом документе не приводится). Успешная оплата Robokassa вызывает `kl_crm_notify_subscription_paid` и пишет оба until, `kl_rb_recurring_active=1` и соседние `kl_rb_recurring_*`, если это рекуррентный клуб.

## 7. Один аккаунт с CRM: что менять

Решения, которые нужно соблюдать. Это задание, а не описание уже сделанного.

- Одно приложение и один аккаунт.
- Уже существующий клиент входит теми же учётными данными.
- Новый человек проходит общую регистрацию, которая начинается с онлайн-школы.
- Контакт попадает в общую CRM, в отдельную воронку онлайн-школы.
- Собака необязательна.
- Подписка 1 990 ₽ в месяц, подаренный доступ возможен.
- Регистрация бесплатная и сама подписку не включает.

Как это стыкуется с тем, что уже есть.

Пароль один: пароль пользователя WordPress. Оболочка проверяет его через `wp_signon`, кабинет и `baza-verify-login` — через `wp_authenticate`. Вторую систему паролей не заводить. CRM не хранит и не проверяет свой пароль школы. Проверка входа — существующий WordPress.

Школьные учётки и контакты CRM — разные записи. Пользователь школы: WordPress, id `wp_user_id`. Контакт CRM: модель `Client` в `/root/kinolog_crm/backend/app/models/client.py`. Поля контакта: `id`, `full_name`, `phone`, `email`, `telegram_id`, `telegram_username`, UTM, `funnel_stage`, `funnel_auto`, `pipeline_id` и связи. Колонки `wp_user_id` у контакта нет. Собака — отдельная связь `dogs` (`name`, `breed`, `age`, `weight`, `features`, `photo_url`), к регистрации школы не привязана. Кабинет собаку не спрашивает и не хранит.

Связывать безопасно только явной записью стабильного id: id пользователя WordPress на контакте CRM. Запись появляется после подтверждённого события: почта подтверждена (`kl_email_verified=1`), прошла оплата, или человек в CRM связал записи вручную. Совпадение неподтверждённого email слиянием не является. Регистрация оболочки ставит `kl_email_verified=0`. Пока почта не подтверждена, контакт с таким email не сливать с пользователем WordPress, даже если строки равны. Разные email не связывать автоматически.

Повторная регистрация на тот же email в WordPress уже отвергается (`error=exists` и `email_exists`). Это защита от второго пользователя WordPress, не повод склеить контакт CRM.

Что ещё не сделано и должно появиться отдельным контрактом, а не тихой правкой логина:

- Регистрация оболочки создаёт только пользователя WordPress. Контакт CRM она не создаёт.
- Воронка, которая уже есть у онлайн-продукта CRM, — стадии `o_reg` («Прошли регистрацию на сайте»), `o_tg` («Привязали ТГ бота»), `o_paid` («Оплатили доступ»), `o_recur_ok` («Повторная оплата получена»), `o_recur_miss` («Повторная оплата не получена»). Это не отдельная воронка онлайн-школы. Школьную воронку нужно завести отдельно и класть туда новый контакт. Старые стадии онлайн-продукта не переиспользовать как школьные.
- Собака в этой регистрации не нужна. Поле можно оставить пустым.
- Подписка школы — те же `kl_sub_video_until` и `kl_sub_articles_until` на 30 дней за 1 990 ₽. Подарок — уже существующие промо, инвайт или `club_days`, без нового флага.
- Регистрация по-прежнему не пишет until.

Пока явной связи нет, снимок `online-funnel-snapshot` умеет только узнать по уже переданному id WordPress, есть ли аккаунт, оплата и промо. Сам он контакт не создаёт.

## 8. Незаконченное и от чего зависит

Не начинать и не откатывать:

- Приложения iOS нет. OSH-4 нет. Веток и коммитов под них нет.
- Общий логин и API из разделов 3–4 не менять без новой записи в этом файле.

Не сделано и зависит от решения в разделе 7:

- Явное поле связи контакт CRM ↔ `wp_user_id`, запись только после подтверждения.
- Отдельная воронка онлайн-школы и создание контакта из регистрации школы.
- Регистрация не требует собаку и не открывает подписку — это уже так на стороне WordPress; сторона CRM ещё не подключена.

Дыры текущего кабинета, их можно чинить отдельно, не трогая контракт входа:

- Прогресс — один JSON на одном процессе. Второй экземпляр кабинета его не разделит.
- Каталог зашит в `lessons.js`. Длительность роликов Kinescope кабинет не проверяет.
- Инвайт тестировщика всё ещё целится в `/api/client/wp-sso`, а этот путь новый кабинет не реализует.
- Старый контейнер `kinolog_baza-frontend` и его процесс не останавливать и не использовать как место деплоя.
- Публичного JSON профиля, каталога, урока, прогресса и права на видео для приложения нет. Пока его нет, приложение не должно придумывать параллельную дверь. Когда понадобится, контракт пишется сюда до кода.

Откат кабинета и оболочки описан в `/cursor/stores/self/docs/shell-status.md`.
