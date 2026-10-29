---
cursor:
  subagentId: "bc-4bb9dc86-06e0-57a0-a547-ea45ed21f1f6"
---

# Передача: онлайн-школа для агента «Приложение + CRM»

Обновлено 29 октября 2026 под контракт онлайн-школы. Секретов, паролей и строк подключения здесь нет. Ветки `cursor/online-school-ios-f98a` и `cursor/online-school-crm-f98a` этим изменением не трогались.

Школа публикует здесь каталог, прогресс, playback и чтение доступа из CRM. iOS ходит в школу только по этим маршрутам. Пока живой хост не обновлён, адаптер по-прежнему не должен притворяться, что боевой `baza.kinologlife.online` уже отвечает этим контрактом: на сервере ещё предыдущая сборка.

## 1. Репозиторий

- Репозиторий: `https://github.com/vasapbro/dara`
- Ветка: `cursor/online-school-shell-f1f6`
- Родитель этого изменения: `b07f58713f84824ec61354f47dfb86cdb117e2fa`
- База `master`: `d80eeb4709f1acb8c99369fe995d1438829ef05b`
- Каталоги: `kinologlife-shell/`, `kinologlife-cabinet/`

Коммит, который вводит сессию CRM, каталог, прогресс и playback, указан в конце файла после публикации.

На origin этой ветки нет веток iOS и CRM. Их коммиты в dara не входят.

На VPS, не в git:

- Оболочка: `/root/kinologlife_shell`
- Кабинет: `/root/kinologlife_cabinet/app`, данные `/root/kinologlife_cabinet/data`, секреты в файле рядом с compose
- WordPress: `/root/wp_kinologlife/kinologlife_wp_html`
- Старый кабинет Next.js: `/root/kinolog_baza`. Контейнер `kinolog_baza-frontend` не трогать
- CRM на диске: `/root/kinolog_crm`

Снимок файлов на диске от 29 октября совпадал с `697b2aa614f378085b8a886d46d304b3b711679a`. Этот коммит на сервер ещё не скопирован.

## 2. Что стоит на хосте и что меняет этот коммит

Проверено ранее, контейнеры не перезапускались этим проходом.

| Контейнер | Куда слушает |
| --- | --- |
| `kinologlife_shell` | `127.0.0.1:3020` |
| `kinologlife_cabinet` | `127.0.0.1:3021` |
| `kinolog_baza-frontend` | `127.0.0.1:3003` и `127.0.0.1:3011` |
| `wp_kinologlife-wordpress-1` | `127.0.0.1:8088` |

`kinologlife.online`: nginx отдаёт на оболочку `/`, `/kak-ustroeno`, `/tarif`, `/register`, `/login`, `/account`, `/shell-assets/`, `/shell-health`. Оплата Robokassa остаётся на `/tarif`, 1 990 ₽. Голый `GET /join/` уходит на `/tarif`. Статьи и юридические страницы остаются на WordPress.

`baza.kinologlife.online`: `location /` смотрит на `127.0.0.1:3021`. Откат nginx: `/root/nginx-backups/baza.bak-cabinet-20261029-131041`.

`CRM_BASE_URL` кабинета — только `https://crm-paytest.kinologlife.online`. Другой origin процесс не вызывает: в лог пишется отказ, запрос не уходит. Боевая CRM не используется. В `docker-compose.yml` кабинета эта переменная задана явно и перекрывает файл секретов.

29 октября те же маршруты сначала отвечали `404`. Повторная проверка: `POST /api/v1/me/online-school/enter` и `GET /api/v1/me/online-school/access` с пустым Bearer отвечают `401` `UNAUTHORIZED` / `Platform session required`. Маршруты смонтированы. Боевая CRM не вызывалась. Контейнер `kinolog_baza-frontend` не перезапускался.

## 3. Сессия только из CRM

Пароль школы не создаётся и не проверяется. `POST /login` тело не читает как пароль и отвечает `405`:

```json
{"ok":false,"error":"no_school_password"}
```

`GET /login` — страница без поля пароля. Текст: сессия приходит из общего аккаунта, собака не нужна.

Сессия — это Bearer после общего входа или регистрации приложения (`POST /api/v1/auth/unified/login`, `POST /api/v1/auth/client/register`). Отдельного школьного билета нет. Повторный пароль не спрашивается.

Вход в уроки:

1. Приложение открывает `GET https://baza.kinologlife.online/enter?t=BEARER` или шлёт тот же заголовок `Authorization: Bearer`.
2. Кабинет вызывает только Paytest: `POST /api/v1/me/online-school/enter`. Тело пустое. Заголовок `Authorization: Bearer` — та же сессия. Cookie браузера в CRM не уходит.
3. Успех `200` — cookie `kl_cab` и `303` на `/`.

Bearer: `^[A-Za-z0-9._~+/=-]{20,1800}$`. Иначе `303 /login?error=link`.

Ответ CRM `200` и JSON. Кабинет берёт только:

| Поле | Правило |
| --- | --- |
| `client_id` | строка `^[A-Za-z0-9_-]{1,80}$` или положительное целое |
| `deal_id` | то же правило, обязателен |
| `access` | `none`, `gifted` или `paid` |
| `name` | если это строка, обрезается до 80 символов; иначе пусто |
| `wp_user_id` | только если CRM уже прислал положительное целое. Иначе `null`. Само по себе доступ не открывает |

Почта в ответе не читается, не хранится и не используется для поиска. Слияния по email нет.

Любой другой статус или форма — `303 /login?error=link`. Если origin не Paytest — `303 /login?error=crm`, запрос не отправляется. Таймаут — 8 секунд.

Cookie `kl_cab`: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 14 суток, без Domain. Подпись HMAC кабинета. Внутри: `client_id`, `deal_id`, Bearer в поле `crm_session`, `name`, `exp`, `csrf`. Старая cookie с `uid` WordPress не принимается.

На каждый запрос доступ читается заново тем же Bearer:

`GET /api/v1/me/online-school/access`

`Authorization: Bearer`. Тело не передаётся.

Ответ `200` с теми же полями. `client_id` должен совпасть с cookie, иначе отказ. Иной ответ — страница и API `503` `{"ok":false,"error":"crm"}`. Память процесса держит ответ 45 секунд.

Смотреть можно при `paid` и `gifted`. `none` каталог не открывает. Значений `active` и `expired` кабинет не принимает.

Выход: `POST /logout` с тем же `csrf`. Cookie сбрасывается.

### Ученика по почте школа не создаёт

`kl_shell_register` пользователя WordPress не вставляет. Любой вызов сразу уводит на `/register?error=crm`.

Страница `https://kinologlife.online/register` форму пароля не показывает. Текст: регистрация начинается в приложении, `source` / `ref` = `online_school`, `POST /api/v1/auth/client/register` на стороне CRM. Собаку страница не спрашивает.

Почта занята — это ответ CRM `409 EMAIL_TAKEN`. Школа второй записи не заводит.

### Старый аккаунт WordPress — только ручная связь

`wp_user_id` из CRM сохраняется как `manual_wp_user_id`, если это положительное целое. Это уже согласованная связь. Само по себе число доступ не открывает. Совпадение почты слиянием не является. Кабинет пользователя WordPress по почте не ищет и записи не склеивает.

Старые ключи прогресса по числовому id WordPress в новый файл не переносятся.

### Собака не нужна

В сессии, каталоге, прогрессе и регистрации поля собаки нет. Картинки луга на странице — оформление, не карточка собаки. Доступ `paid` и `gifted` открывает каталог и без собаки.

### Что осталось у WordPress и кабинетом не используется

Вход на `https://kinologlife.online/login` по-прежнему проверяет старый пароль WordPress (`kl_shell_login` / `wp_signon`) для страницы оплаты `/account`. Этот вход cookie кабинета не ставит и ученика не создаёт. Кнопка перехода в уроки с сайта убрана: `sso_url` всегда пустой.

Эндпоинты `kl_cabinet_login`, `kl_cabinet_redeem`, `kl_cabinet_access`, `kl_cabinet_go` в mu-plugin ещё лежат. Новый кабинет их не вызывает. Одноразовый билет WordPress на `/enter` новый код пытается обменять в CRM и, не получив ответ CRM, уводит на `/login?error=link`.

`GET /api/client/wp-sso` кабинет не реализует.

## 4. Каталог, прогресс, playback

База: `https://baza.kinologlife.online`. Браузер ходит с cookie `kl_cab`. Без cookie API отвечает `401` `{"ok":false,"error":"session"}`, HTML-страницы — `303 /login`.

`GET /health` без сессии: `{"ok":true}`.

Каталог в коде: `kinologlife-cabinet/lessons.js`. Два раздела, `obuchenie` и `zapisi`. Идентификаторы роликов в JSON каталога наружу не отдаются.

### Каталог

`GET /api/catalog`

Доступ `paid` или `gifted`, оба отдают один и тот же список:

```json
{
  "access": "gifted",
  "deal_id": "deal-gift",
  "manual_wp_user_id": null,
  "sections": [
    {
      "id": "obuchenie",
      "title": "Обучение",
      "lead": "Короткие практические темы. Список можно дополнять по одной.",
      "lessons": [
        {
          "slug": "marker",
          "title": "Как приучить к маркеру",
          "note": "Маркер — короткий звук перед наградой. Собака учится: этот звук значит, что ценное уже в пути.",
          "done": false
        }
      ]
    }
  ]
}
```

`access=gifted` и `access=paid` собираются одной функцией. Отличаются `access`, `deal_id` и `manual_wp_user_id`, если CRM его прислал. Названия, slug и заметки совпадают. Локальная проверка с подставным CRM это подтвердила: шесть уроков, первый — «Как приучить к маркеру». Почта из ответа CRM в каталог не попадает.

`none`: `403`

```json
{"access":"none","sections":[]}
```

HTML в этом случае — закрытая страница без названий уроков. Текст говорит, что оплаченная и подаренная подписка открывают один каталог. Регистрация сама уроки не включает.

Уроки сейчас:

| Раздел | slug | Название |
| --- | --- | --- |
| obuchenie | marker | Как приучить к маркеру |
| obuchenie | stay | Как учить выдержке команды |
| zapisi | heel-enzi | Выправка: работа с Энзи |
| zapisi | fix-heel | Чиним выправку |
| zapisi | emergency-sit | Аварийное «Сидеть» |
| zapisi | recall-proof | Подзыв на сложных собаках |

### Прогресс

Ключ — строка `client_id` CRM, не id WordPress. Файл данных процесса: `progress.json` в `DATA_DIR` (на сервере `/root/kinologlife_cabinet/data`). Внутри ключ `section/slug`, значение — unix в миллисекундах, если урок отмечен. Файл один на процесс.

`GET /api/progress`

С доступом `paid` или `gifted`:

```json
{"access":"paid","deal_id":"42","items":{"obuchenie/marker":1761740000000}}
```

Без права смотреть: `200` и `items: {}`. Записи при этом не стираются.

`POST /api/progress`

```json
{"section":"obuchenie","slug":"marker","done":true}
```

- `200` `{"ok":true,"key":"obuchenie/marker","done":true}`
- `400` `{"ok":false,"error":"lesson"}` — нет такого урока или `done` не boolean
- `403` `{"access":"none"}`

`done: false` снимает отметку.

Страница урока по-прежнему переключает отметку формой `POST /lesson/{section}/{slug}/done` с `csrf`. Это тот же файл.

### Playback

`GET /api/playback?section=obuchenie&slug=marker`

Только при `paid` или `gifted`:

```json
{
  "access": "gifted",
  "embed_url": "https://kinescope.io/embed/ИД?drmauthtoken=КОРОТКИЙ_JWT",
  "expires_in": 300
}
```

Нет урока или пустой id ролика: `404` `{"ok":false,"error":"lesson"}`. Нет права: `403` `{"access":"..."}`.

Страница `GET /lesson/{section}/{slug}` вставляет тот же `embed_url` в iframe. Без права смотреть урок уводит на `/`.

## 5. Kinescope: короткий токен зрителю

Секрет подписи и любой токен API Kinescope остаются только на стороне школы, в окружении процесса кабинета. В HTML, в JSON каталога и в приложении их нет. В репозитории токена API Kinescope нет. Кабинет в `api.kinescope.io` не ходит.

Зрителю уходит JWT на 300 секунд, алгоритм HS256, в query `drmauthtoken`:

`https://kinescope.io/embed/{embedId}?drmauthtoken={jwt}`

Поля JWT: `iss` = `kinologlife-cabinet`, `aud` = `kinescope`, `sub` = `client_id`, `access` (`paid` или `gifted`), `lesson` = `section/slug`, `vid` = id ролика, `exp`. Подпись — тот же HMAC, что у cookie кабинета. Значение не публикуется.

Проверка права на просмотр: Kinescope вызывает школу.

`POST /api/kinescope/authorize`

Тело, которое присылает Kinescope: `id`, `ip`, `type`, `token`, `user_agent`. Кабинет смотрит только `token`. Ответ без тела.

- `200` — JWT подписан, не просрочен, `access` это `paid` или `gifted`, `vid` совпал с id ролика этого урока
- `403` — иначе

Поле `id` в вызове Kinescope часто UUID, а не id встраивания. Кабинет его с id ролика не сравнивает. Решение Kinescope принимает по коду ответа. Для строгого режима нужен именно HTTP 200.

Оператор один раз указывает в кабинете Kinescope адрес `https://baza.kinologlife.online/api/kinescope/authorize`. Кабинет этот адрес сам не прописывает: токена API Kinescope у процесса нет. Пока колбэк не включён, публичный embed может открываться и без проверки. Зритель всё равно получает только короткий JWT, не секрет.

Id роликов в `lessons.js` не менялись:

| slug | id |
| --- | --- |
| marker | `wuFs5EfuUYdsSH3Y8B78XN` |
| stay | `hZ4sttbTLheMzWg2JYB1Tr` |
| heel-enzi | `qNfzV7vy2uriexmepPkhy5` |
| fix-heel | `6ZwUBRf6cXVXjtw6SvB16u` |
| emergency-sit | `iM2c6yFb4xbS5oHiYYCF1B` |
| recall-proof | `iYjwpUuGCceZuKTv7AkaQQ` |

## 6. Как кабинет читает доступ

Источник права смотреть — только ответ Paytest `access` на `GET /api/v1/me/online-school/access`. Мета WordPress кабинет не читает. Боевая CRM не опрашивается.

| `access` | Каталог | Playback | Прогресс на запись |
| --- | --- | --- | --- |
| `paid` | полный, те же уроки | да | да |
| `gifted` | тот же полный каталог | да | да |
| `none` | `403`, пустой `sections` | нет | нет |

Подарок не превращается в отдельный флаг школы. Если CRM прислал `gifted`, ученик видит тот же каталог, что при `paid`. Регистрация сама `paid` не ставит: пока CRM не прислал `paid` или `gifted`, уроки закрыты. `deal_id` кабинет хранит и отдаёт в каталоге, сделку сам не создаёт.

Цена продукта по-прежнему 1 990 ₽ в месяц на `https://kinologlife.online/tarif`. Оплату урока кабинет не проводит и покупку не имитирует. Когда CRM решит, что оплата или подарок открыли доступ, он отдаёт `paid` или `gifted`. Как именно CRM выставляет это поле, школа не дублирует.

Старые способы WordPress (промокод, инвайт, `club_days`) по-прежнему пишут until в мета пользователя. Для нового кабинета это не доступ, пока CRM явно не прислал `paid` или `gifted`. `wp_user_id` учитывается только если CRM уже прислал связь.

## 7. Один аккаунт

Соблюдено на стороне школы в этом коммите:

- Один человек. Школа второго ученика по почте не создаёт.
- Пароль только у CRM. Кабинет пароль не хранит и не проверяет.
- Уже существующая сессия CRM открывает школу билетом, без второго пароля.
- Новый человек регистрируется общим `POST /api/v1/auth/client/register`, источник `online_school`.
- Собака необязательна.
- Подписка 1 990 ₽ в месяц. `access=gifted` открывает тот же каталог, что `access=paid`.
- Регистрация бесплатная и сама подписку не включает.
- Старый аккаунт WordPress связывается только явным `wp_user_id` от CRM. Автослияния по почте нет.

Воронка и карточка `Client` остаются у CRM: одна сделка `kind=online_school`, пайплайн `online_main`, собака сделке не нужна. Школа сделку не создаёт.

## 8. Что ещё не сделано

- Кабинет на `baza.kinologlife.online` переведён на эту сборку после того, как Paytest стал отвечать на enter и access. Origin только Paytest. Контейнер `kinolog_baza-frontend` не трогался.
- Колбэк Kinescope на `/api/kinescope/authorize` оператор включает сам.
- Прогресс — один JSON. Второй экземпляр кабинета его не разделит. Старые числовые ключи не импортируются.
- Вход WordPress на публичном `/login` ещё проверяет старый пароль для страницы оплаты. В кабинет эта сессия не проходит.
- Инвайт тестировщика всё ещё целится в `/api/client/wp-sso`.
- Разделы контракта после правила воронки на этой машине не были смонтированы. Маршруты выше — сторона школы. Если CRM ждёт другие пути, правка согласуется здесь, а не тихим вторым API.
- Ветки iOS и CRM не менялись.

Откат оболочки и кабинета описан в `/cursor/stores/self/docs/shell-status.md`.

Код сессии CRM: `245532c288c91c0bafd973b006391ddbc51dd63c`. Сборка Paytest, которая читает `paid` / `gifted` / `none`, — `41b5774a9c1c5053833bdafe2507f5cb535a344f` на ветке `cursor/online-school-shell-f1f6`. Она выложена в `kinologlife_cabinet` на порту `127.0.0.1:3021`. Проверка с сервера: `GET /health` → `{"ok":true}`, `POST /login` → `405 no_school_password`, вход с пустым Bearer → `303 /login?error=link`. Контейнер `kinolog_baza-frontend` в этот момент был Up 8 weeks.
