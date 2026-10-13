// Словари интерфейса. Ключ — русский текст (он же язык по умолчанию), значение — перевод.
// Чтобы добавить язык: новый объект ниже (например, en) + запись в LANGS (app.js) + переводы в decks.js.
window.I18N = {
  fr: {
    'Иероглифы — карточки': 'Caractères — cartes mémoire',
    'Учить': 'Étudier', 'Писать': 'Écrire', 'Карточки': 'Cartes', 'Колоды': 'Paquets', 'Статистика': 'Statistiques',
    'Иероглиф → смысл': 'Caractère → sens', 'Пиньинь → иероглиф': 'Pinyin → caractère',
    'Колода': 'Paquet', 'Порция': 'Série', 'все': 'tout', '← Назад': '← Retour',
    'Повторять и известные': 'Réviser aussi les cartes connues', 'Озвучка ответа': 'Lecture audio de la réponse',
    'Иероглиф': 'Caractère', 'Пиньинь': 'Pinyin', 'Перевод': 'Traduction',
    'Пример предложения (необязательно)': 'Exemple de phrase (facultatif)',
    'Отмена': 'Annuler', 'Экспорт': 'Exporter', 'Импорт': 'Importer', 'Закрыть': 'Fermer',
    'привет': 'bonjour',
    '我喜欢学中文。 Wǒ xǐhuan xué zhōngwén. Я люблю учить китайский.': "我喜欢学中文。 Wǒ xǐhuan xué zhōngwén. J'aime étudier le chinois.",
    'Поиск: иероглиф, пиньинь, перевод': 'Recherche : caractère, pinyin, traduction',
    'Редактирование': 'Modification', 'Сохранить': 'Enregistrer', 'Новая карточка': 'Nouvelle carte', 'Добавить': 'Ajouter',

    'Браузер не поддерживает озвучку': 'Votre navigateur ne prend pas en charge la synthèse vocale',
    'В системе нет китайского голоса': "Aucune voix chinoise n'est installée sur cet appareil",
    'Все карточки': 'Toutes les cartes', 'Мои карточки': 'Mes cartes',
    'Осталось: {n}': 'Restantes : {n}',
    'Пока нет карточек': 'Aucune carte pour le moment', 'Добавьте первый иероглиф.': 'Ajoutez votre premier caractère.',
    'Добавить карточку': 'Ajouter une carte',
    'Здесь пока пусто': "Rien ici pour l'instant", 'В выбранной колоде нет карточек.': 'Le paquet sélectionné ne contient aucune carte.',
    'К колодам': 'Aux paquets',
    'Порция закончена': 'Série terminée', 'Ещё не выучено: {n}.': 'Encore à apprendre : {n}.', 'Следующая порция': 'Série suivante',
    'Всё выучено': 'Tout est appris', 'Неизвестных карточек не осталось.': "Il ne reste aucune carte inconnue.",
    'Повторить все': 'Tout réviser',
    'Вспомните иероглиф, затем переверните': 'Rappelez-vous le caractère, puis retournez la carte',
    'Нажмите, чтобы перевернуть': 'Touchez pour retourner', 'Перевернуть карточку': 'Retourner la carte',
    'Озвучить': 'Écouter', 'Порядок черт': 'Ordre des traits', 'Показать ответ': 'Afficher la réponse',
    'Не знаю': 'Je ne sais pas', 'Знаю': 'Je sais',
    'Пробел — перевернуть · ← не знаю · → знаю': 'Espace : retourner · ← je ne sais pas · → je sais',
    'Тоны:': 'Tons :', 'лёгкий': 'neutre',

    'Библиотека черт не загрузилась — нужен интернет': "La bibliothèque des traits n'a pas pu se charger — connexion Internet requise",
    'Нет данных черт для «{ch}»': 'Pas de données de traits pour « {ch} »',
    'В карточке нет иероглифов': 'Cette carte ne contient aucun caractère chinois',
    'Нет карточек для письма': 'Aucune carte à écrire', 'Добавьте карточки с иероглифами.': 'Ajoutez des cartes avec des caractères.',
    'Нужен интернет': 'Connexion requise', 'Библиотека черт не загрузилась.': "La bibliothèque des traits n'a pas pu se charger.",
    'Рисуйте черты по порядку · ошибок:': 'Tracez les traits dans l’ordre · erreurs :',
    'Подсказка': 'Indice', 'Пропустить': 'Passer', 'Дальше': 'Suivant',
    'Верно! Ошибок: {e}, подсказок: {h}': 'Correct ! Erreurs : {e}, indices : {h}',

    'Узнаю': 'Reconnu', 'Вспоминаю': 'Rappelé',
    'Звук': 'Son', 'Изменить': 'Modifier', 'Удалить': 'Supprimer',
    'Ничего не найдено': 'Aucun résultat', 'Список пуст — добавьте первую карточку выше': 'La liste est vide — ajoutez une première carte ci-dessus',
    'Удалить карточку?': 'Supprimer cette carte ?', 'Удалено': 'Supprimée', 'Сохранено': 'Enregistré', 'Добавлено': 'Ajoutée',
    'Импортировано: {n}': 'Cartes importées : {n}', 'Не удалось прочитать файл': 'Impossible de lire le fichier',

    'ответов сегодня': "réponses aujourd'hui", 'точность сегодня': "précision aujourd'hui", 'дней подряд': "jours d'affilée",
    'написано сегодня': "tracés aujourd'hui", 'узнаю': 'reconnus', 'вспоминаю иероглиф': 'caractères rappelés',
    'Прогресс колоды (всего {n})': 'Progression du paquet (total : {n})',
    'Иероглиф → смысл:': 'Caractère → sens :', 'Пиньинь → иероглиф:': 'Pinyin → caractère :',
    'Активность за 14 дней': 'Activité sur 14 jours',

    'Файл decks.js не загрузился': "Le fichier decks.js n'a pas pu se charger",
    'Он должен лежать рядом с index.html. Загрузите его в репозиторий и обновите страницу.': "Il doit se trouver à côté de index.html. Téléversez-le dans le dépôt, puis actualisez la page.",
    'В колоде слов: {a} · добавлено: {b} · выучено: {c}': 'Mots dans le paquet : {a} · ajoutés : {b} · appris : {c}',
    'Все слова добавлены': 'Tous les mots sont ajoutés', 'Добавить недостающие': 'Ajouter les mots manquants',
    'Добавить в мои карточки': 'Ajouter à mes cartes', 'Убрать колоду': 'Retirer le paquet',
    'Готовых колод пока нет': "Aucun paquet prêt à l'emploi pour l'instant",
    'Добавлено карточек: {n}': 'Cartes ajoutées : {n}', 'Все слова уже есть в ваших карточках': 'Tous les mots sont déjà dans vos cartes',
    'Удалить {n} карточек этой колоды вместе с их прогрессом? Ваши собственные карточки не тронутся.':
      'Supprimer les {n} cartes de ce paquet, avec leur progression ? Vos propres cartes ne seront pas touchées.',
    'Колода убрана': 'Paquet retiré'
  }
};
