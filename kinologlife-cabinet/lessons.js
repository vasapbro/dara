/**
 * Two sections only. Add a lesson by appending an object.
 * kinescopeId is the id from the existing player: https://kinescope.io/embed/<id>
 * Leave kinescopeId empty to keep the video slot until a film is attached.
 */
module.exports = {
  sections: [
    {
      id: "obuchenie",
      title: "Обучение",
      lead: "Короткие практические темы. Список можно дополнять по одной.",
      lessons: [
        {
          slug: "marker",
          title: "Как приучить к маркеру",
          note: "Маркер — короткий звук перед наградой. Собака учится: этот звук значит, что ценное уже в пути.",
          kinescopeId: "wuFs5EfuUYdsSH3Y8B78XN"
        },
        {
          slug: "stay",
          title: "Как учить выдержке команды",
          note: "Команда, пауза, награда за то, что собака осталась. На секунду дольше, чем в прошлый раз.",
          kinescopeId: "hZ4sttbTLheMzWg2JYB1Tr"
        }
      ]
    },
    {
      id: "zapisi",
      title: "Записи занятий",
      lead: "Полные записи коррекции с реальных занятий, около 40 минут. Это длинная форма коротких роликов.",
      lessons: [
        {
          slug: "heel-enzi",
          title: "Выправка: работа с Энзи",
          note: "Полная запись занятия: рядом у ноги под отвлечениями.",
          kinescopeId: "qNfzV7vy2uriexmepPkhy5"
        },
        {
          slug: "fix-heel",
          title: "Чиним выправку",
          note: "Полная запись: где ломается позиция и как её вернуть на занятии.",
          kinescopeId: "6ZwUBRf6cXVXjtw6SvB16u"
        },
        {
          slug: "emergency-sit",
          title: "Аварийное «Сидеть»",
          note: "Полная запись коррекции: чёткая остановка без суеты.",
          kinescopeId: "iM2c6yFb4xbS5oHiYYCF1B"
        },
        {
          slug: "recall-proof",
          title: "Подзыв на сложных собаках",
          note: "Полная запись занятия: «ко мне» рядом с сильным отвлечением.",
          kinescopeId: "iYjwpUuGCceZuKTv7AkaQQ"
        }
      ]
    }
  ]
};
