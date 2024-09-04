## Figma Giga Backup

Этот скрипт позволяет сделать бэкап проектов команды Figma и Figjam, а также личных проектов с Figma, в удобном формате.
(в любой момент он может перестать работать)

---

### Установка

1. Установите [Node.js](https://nodejs.org/en) и `Google Chrome`, если он еще не установлен.
3. Скачайте [git](https://git-scm.com/) и клонируйте к себе репозиторий (надо скачать :

   ```bash
   git clone https://github.com/AlsoUX/Figma-giga-backup.git
   
4. Откройте файл `config.json` и заполните все необходимые данные.
5. Откройте консоль в папке, где находится проект.
6. Запустите скрипт командой: `node index.js`.

---

### Ответы на вопросы
#### Как получить `teamId`:
1. Перейдите в свои файлы на Figma.
2. В URL-адресе скопируйте цифры, которые идут после `/team/`.

   Пример: `https://www.figma.com/files/team/**teamID**/`

#### Как получить `tokenAPI`:
1. Перейдите в настройки (Settings) вашего аккаунта.
2. В разделе "Account" прокрутите страницу до блока "Personal access tokens".
3. Нажмите "Generate new token" для создания нового токена.

---

### Автор этого кода

**Создатель**: [zombikot](https://t.me/zombikot)  
**Телеграм-канал**: [DesignClown](https://t.me/DesignClown/)

