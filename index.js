const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')();
const fs = require('fs');
const axios = require('axios');
const path = require('path');


let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
    console.log('Не удалось загрузить config.json. Проверьте, что файл существует и форматирован правильно.');
    process.exit(1);
}
console.log(' ');
console.log('—————————————————————');
console.log('Создатель: https://t.me/zombikot');
console.log('Телеграм канал: https://t.me/DesignClown/');
console.log('—————————————————————');
console.log(' ');

async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
    console.log('Cookies сохранены');
}

async function loadCookies(page) {
    if (fs.existsSync('cookies.json')) {
        const cookiesContent = fs.readFileSync('cookies.json', 'utf8');
        if (cookiesContent.trim().length > 0) {
            try {
                const cookies = JSON.parse(cookiesContent);
                await page.setCookie(...cookies);
                console.log('Cookies загружены, ждите авторизации');
            } catch (error) {
                console.error('Ошибка при загрузке cookies:', error.message);
            }
        } else {
            console.log('Файл cookies.json пуст.');
            console.log('Ожидайте авторизацию');
        }
    } else {
        console.log('Файл cookies.json не найден.');
    }
}

async function loginToFigma(email, password) {
    const browser = await puppeteer.launch({
        headless: true,  // Запуск в фоновом режиме
        args: ['--disable-dev-shm-usage'],
        defaultViewport: null
    });

    const page = await browser.newPage();

    await loadCookies(page);

    await page.goto('https://www.figma.com/files', { waitUntil: 'networkidle2' });

    if (page.url().includes('figma.com/files')) {
        console.log('Вы успешно авторизовались');
        return { browser, page };
    }

    await page.goto('https://www.figma.com/login', { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
        const emailInput = document.querySelector('input[name="email"]');
        if (emailInput) {
            emailInput.value = '';
        }
    });

    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');

    try {
        // Ждем появления ошибки, если она есть
        const errorSelector = 'p.auth_form_2024_brand_updates--error---NE-l';
        await page.waitForSelector(errorSelector, { timeout: 5000 });
        const errorMessage = await page.$eval(errorSelector, el => el.textContent);

        if (errorMessage.includes('That email and password combination is incorrect.')) {
            console.log('Ошибка: Неправильный email или пароль.');
            await browser.close();
            process.exit(1);  // Завершаем выполнение программы с ошибкой
        }
    } catch (error) {
        // Игнорируем ошибку, если элемент не найден, и продолжаем выполнение
    }

    try {
        await page.waitForSelector('h1.validate_email--header--USmEZ', { timeout: 10000 });
        console.log('Figma требует подтверждение через email.');

        const confirmationUrl = prompt('Введите URL из email для подтверждения входа: ');
        await page.goto(confirmationUrl, { waitUntil: 'networkidle2' });

        try {
            await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            if (page.url().includes('figma.com/files')) {
                console.log('Успешно авторизовались и попали на страницу файлов!');
                await saveCookies(page);
            } else {
                console.log('Авторизация прошла, но не удалось попасть на страницу файлов.');
            }
        } catch (error) {
            if (page.url().includes('figma.com/files')) {
                console.log('Успешно авторизовались и сразу попали на страницу файлов!');
                await saveCookies(page);
            } else {
                console.log('Что-то пошло не так, не удалось авторизоваться.');
            }
        }
    } catch (error) {
        console.error('Ошибка:', error.message);
        if (page.url().includes('figma.com/files')) {
            console.log('Успешно авторизовались на Figma!');
            await saveCookies(page);
        } else {
            console.log('Не удалось авторизоваться. Проверьте свои учетные данные.');
        }
    }

    return { browser, page };
}

function sanitizeProjectName(name) {
    return name.replace(/[^\w\s-]/g, '').trim();
}

function saveProjectStructureToFile(projectStructure) {
    const filePath = path.resolve(__dirname, 'project_structure.json');
    fs.writeFileSync(filePath, JSON.stringify(projectStructure, null, 2), 'utf8');
    console.log('Структура проекта сохранена в project_structure.json');
    console.log(' ');
}

function getUniqueFileName(directory, fileName, fileKey) {
    let baseName = path.basename(fileName, path.extname(fileName));
    let extension = path.extname(fileName);

    let uniqueName = `${baseName}_${fileKey}${extension}`;
    let counter = 1;

    while (fs.existsSync(path.join(directory, uniqueName))) {
        console.log(`Файл с именем ${uniqueName} уже существует. Переименовываем...`);
        uniqueName = `${baseName}_${fileKey} (${counter})${extension}`;
        counter++;
    }

    if (counter > 1) {
        console.log(`Файл будет сохранен как ${uniqueName}`);
    }

    return uniqueName;
}

function waitForDownloadComplete(downloadPath) {
    return new Promise((resolve) => {
        const downloadInterval = setInterval(() => {
            const files = fs.readdirSync(downloadPath);
            const downloadingFile = files.find(file => file.endsWith('.crdownload') || file.endsWith('.part'));
            if (!downloadingFile) {
                clearInterval(downloadInterval);
                resolve();
            }
        }, 1000);
    });
}

async function getTeamProjects(apiToken, teamId) {
    const url = `https://api.figma.com/v1/teams/${teamId}/projects`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-FIGMA-TOKEN': apiToken
            }
        });

        const projects = response.data.projects;

        console.log('Список проектов команды:');
        projects.forEach((project, index) => {
            console.log(`${index + 1}: ${project.name} (ID: ${project.id})`);
        });

        return projects;
    } catch (error) {
        console.error('Ошибка при получении проектов команды:', error.message);
    }
}

async function getProjectFiles(apiToken, projectId) {
    const url = `https://api.figma.com/v1/projects/${projectId}/files`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-FIGMA-TOKEN': apiToken
            }
        });

        const files = response.data.files;

        console.log(`Файлы в проекте ${projectId}:`);
        files.forEach((file, index) => {
            console.log(`${index + 1}: ${file.name} (Key: ${file.key})`);
        });

        return files;
    } catch (error) {
        console.error(`Ошибка при получении файлов проекта ${projectId}:`, error.message);
    }
}

async function getDraftFiles(apiToken) {
    const draftProjectId = '270524617';
    const url = `https://api.figma.com/v1/projects/${draftProjectId}/files`;

    try {
        const response = await axios.get(url, {
            headers: {
                'X-FIGMA-TOKEN': apiToken
            }
        });

        const files = response.data.files;

        console.log(`Файлы в черновиках:`);
        files.forEach((file, index) => {
            console.log(`${index + 1}: ${file.name} (Key: ${file.key})`);
        });

        return files;
    } catch (error) {
        console.error('Ошибка при получении файлов черновиков:', error.message);
    }
}

async function waitForPageLoad(page) {
    try {
        await page.waitForSelector('.progress_bar--centerContainer--rTlLS', { timeout: 10000 });

        await page.waitForFunction(
            () => !document.querySelector('.progress_bar--centerContainer--rTlLS'),
            { timeout: 60000 }
        );
        console.log('Проект успешно загружен.');
    } catch (error) {
        console.log('Индикатор загрузки не найден или загрузка завершилась быстро.');
    }
}

async function waitForSaveOrDownloadImages(page) {
    const maxAttempts = 4;
    let indicatorStillVisible = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Попытка ${attempt} из ${maxAttempts}...`);

        try {
            const saveOrDownload = await page.waitForFunction(
                () => {
                    const messageElement = document.querySelector('[data-testid="visual-bell-message"]');
                    return messageElement && (messageElement.textContent.includes('Saving') || messageElement.textContent.includes('Downloading images'));
                },
                { timeout: 20000 }
            );

            if (saveOrDownload) {
                console.log('Процесс сохранения или загрузки изображений начался...');

                while (true) {
                    indicatorStillVisible = await page.evaluate(() => {
                        const messageElement = document.querySelector('[data-testid="visual-bell-message"]');
                        return messageElement && messageElement.textContent.includes('Downloading images');
                    });

                    if (!indicatorStillVisible) {
                        console.log('Индикатор исчез, проверяем начало скачивания...');
                        return true;
                    }

                    console.log('Figma формирует файл, это может занять пару минут.');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } catch (error) {
            console.log('Индикатор загрузки не найден или завершился быстро.');

            if (attempt < maxAttempts) {
                console.log('Повторный ввод команды для скачивания...');
                await page.keyboard.down('Meta');
                await page.keyboard.press('/');
                await page.keyboard.up('Meta');
                await page.keyboard.type('save local copy', { delay: 50 });
                await page.keyboard.press('Enter');
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return false;
}

async function startFileDownload(page, fileKey, projectDownloadPath, projectStructure, projectName, fileName) {
    const fileUrl = `https://www.figma.com/file/${fileKey}/`;

    const tempDownloadPath = path.join(projectDownloadPath, 'temp', fileKey);
    if (!fs.existsSync(tempDownloadPath)) {
        fs.mkdirSync(tempDownloadPath, { recursive: true });
    }

    try {
        console.log(`Заходим в проект ${fileKey}`);

        await page._client().send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: tempDownloadPath });

        await page.goto(fileUrl, { waitUntil: 'networkidle2' });

        await waitForPageLoad(page);

        const currentUrl = page.url();
        if (currentUrl.includes('/board/')) {
            console.log(`Это FigJam проект. Обрабатываем как .jam файл.`);

            await page.keyboard.down('Meta');
            await page.keyboard.press('/');
            await page.keyboard.up('Meta');
            await page.keyboard.type('save local copy', { delay: 50 });
            await page.keyboard.press('Enter');

            await waitForDownloadComplete(tempDownloadPath);

            const downloadedFiles = fs.readdirSync(tempDownloadPath);
            const downloadedFileName = downloadedFiles.find(file => !file.endsWith('.crdownload'));

            if (downloadedFileName) {
                const downloadedFilePath = path.join(tempDownloadPath, downloadedFileName);

                const uniqueFileName = getUniqueFileName(projectDownloadPath, fileName, fileKey) + '.jam';
                const uniqueFilePath = path.join(projectDownloadPath, uniqueFileName);

                fs.renameSync(downloadedFilePath, uniqueFilePath);

                console.log(`FigJam файл был переименован и сохранен как ${uniqueFileName}.`);
                updateFileStatusInProject(projectStructure, projectName, fileKey, 'Successfully_downloaded');
            } else {
                console.log(`Не удалось найти загруженный FigJam файл для ${fileName}.`);
                updateFileStatusInProject(projectStructure, projectName, fileKey, 'Error');
            }
        } else {
            console.log('Начинаем ввод команды для скачивания файла.');
            await page.keyboard.down('Meta');
            await page.keyboard.press('/');
            await page.keyboard.up('Meta');
            await page.keyboard.type('save local copy', { delay: 50 });
            await page.keyboard.press('Enter');

            const downloadReady = await waitForSaveOrDownloadImages(page);

            if (downloadReady) {
                await waitForDownloadComplete(tempDownloadPath);

                const downloadedFiles = fs.readdirSync(tempDownloadPath);
                const downloadedFileName = downloadedFiles.find(file => !file.endsWith('.crdownload'));

                if (downloadedFileName) {
                    const downloadedFilePath = path.join(tempDownloadPath, downloadedFileName);
                    const fileExtension = path.extname(downloadedFileName);

                    const uniqueFileName = getUniqueFileName(projectDownloadPath, path.basename(fileName, fileExtension), fileKey) + fileExtension;
                    const uniqueFilePath = path.join(projectDownloadPath, uniqueFileName);

                    fs.renameSync(downloadedFilePath, uniqueFilePath);

                    console.log(`Файл ${downloadedFileName} был переименован и сохранен как ${uniqueFileName}.`);
                    updateFileStatusInProject(projectStructure, projectName, fileKey, 'Successfully_downloaded');
                } else {
                    console.log(`Не удалось найти загруженный файл для ${fileName}.`);
                    updateFileStatusInProject(projectStructure, projectName, fileKey, 'Error');
                }
            } else {
                console.log(`Скачивание файла ${fileName} не началось. Пропускаем этот файл.`);
                updateFileStatusInProject(projectStructure, projectName, fileKey, 'Error');
            }
        }
    } catch (error) {
        console.error(`Ошибка при запуске скачивания файла ${fileKey}:`, error.message);
        updateFileStatusInProject(projectStructure, projectName, fileKey, 'Error');
    } finally {
        fs.rmSync(tempDownloadPath, { recursive: true, force: true });
    }
}

function updateFileStatusInProject(projectStructure, projectName, fileKey, status) {
    const project = projectStructure.find(p => p.name === projectName);
    if (project) {
        const file = project.files.find(f => f.key === fileKey);
        if (file) {
            file.status = status;
            saveProjectStructureToFile(projectStructure);
        }
    }
}

(async () => {
    const email = config.email || prompt('Введите email: ');
    const password = config.password || prompt('Введите пароль: ', { echo: '*' });
    const teamId = config.teamId || prompt('Введите ID команды: ');
    const apiToken = config.apiToken || prompt('Введите Figma API Token: ');

    if (!email || !password || !teamId || !apiToken) {
        console.log('Email, пароль, ID команды и Figma API Token обязательны для ввода.');
        process.exit(1);
    }

    let projectStructure = [];
    let totalFiles = 0;
    let downloadedFiles = 0;

    let choice;
    do {
        console.log(' ');
        console.log('1: Скачать все проекты.');
        console.log('2: Скачать проекты в Draft.');
        console.log('3: Скачать проекты команды.');
        choice = prompt('Выберите действие: ').trim();
    } while (choice !== '1' && choice !== '2' && choice !== '3');

    let downloadChoice;
    do {
        console.log(' ');
        console.log('1: Скачать все файлы.');
        console.log('2: Скачать только недостающие файлы.');
        downloadChoice = prompt('Выберите действие: ').trim();
    } while (downloadChoice !== '1' && downloadChoice !== '2');

    const { browser, page } = await loginToFigma(email, password);

    if (choice === '1') {
        console.log('Все проекты будут скачаны.');
        const projects = await getTeamProjects(apiToken, teamId);

        projectStructure = projects.map(project => {
            const sanitizedProjectName = sanitizeProjectName(project.name);
            const projectDownloadPath = path.join(__dirname, 'project', sanitizedProjectName);

            if (!fs.existsSync(projectDownloadPath)) {
                fs.mkdirSync(projectDownloadPath, { recursive: true });
            }

            return {
                id: project.id,
                name: sanitizedProjectName,
                path: projectDownloadPath,
                files: []
            };
        });

        for (let project of projectStructure) {
            const files = await getProjectFiles(apiToken, project.id);
            if (downloadChoice === '1') {
                project.files = files.map(file => ({
                    key: file.key,
                    name: file.name,
                    status: 'Not_downloaded'
                }));
                totalFiles += project.files.length;
            } else {
                if (!projectStructure.find(p => p.id === project.id)) {
                    project.files = files.map(file => ({
                        key: file.key,
                        name: file.name,
                        status: 'Not_downloaded'
                    }));
                    totalFiles += project.files.length;
                } else {
                    project.files = project.files.filter(file => file.status !== 'Successfully_downloaded');
                    totalFiles += project.files.length;
                }
            }
        }

        const draftFiles = await getDraftFiles(apiToken);
        if (draftFiles.length > 0) {
            const draftProject = {
                id: 'drafts',
                name: 'Drafts',
                path: path.join(__dirname, 'project', 'Drafts'),
                files: draftFiles.map(file => ({
                    key: file.key,
                    name: file.name,
                    status: 'Not_downloaded'
                }))
            };
            projectStructure.push(draftProject);
            totalFiles += draftFiles.length;
        }

        saveProjectStructureToFile(projectStructure);
    } else if (choice === '2') {
        console.log('Будут скачаны только черновики.');
        const draftFiles = await getDraftFiles(apiToken);
        if (draftFiles.length > 0) {
            const draftProject = {
                id: 'drafts',
                name: 'Drafts',
                path: path.join(__dirname, 'project', 'Drafts'),
                files: draftFiles.map(file => ({
                    key: file.key,
                    name: file.name,
                    status: 'Not_downloaded'
                }))
            };
            projectStructure.push(draftProject);
            totalFiles += draftFiles.length;
        }

        saveProjectStructureToFile(projectStructure);
    } else if (choice === '3') {
        console.log('Будут скачаны только проекты команды.');
        const projects = await getTeamProjects(apiToken, teamId);

        projectStructure = projects.map(project => {
            const sanitizedProjectName = sanitizeProjectName(project.name);
            const projectDownloadPath = path.join(__dirname, 'project', sanitizedProjectName);

            if (!fs.existsSync(projectDownloadPath)) {
                fs.mkdirSync(projectDownloadPath, { recursive: true });
            }

            return {
                id: project.id,
                name: sanitizedProjectName,
                path: projectDownloadPath,
                files: []
            };
        });

        for (let project of projectStructure) {
            const files = await getProjectFiles(apiToken, project.id);
            project.files = files.map(file => ({
                key: file.key,
                name: file.name,
                status: 'Not_downloaded'
            }));
            totalFiles += project.files.length;
        }

        saveProjectStructureToFile(projectStructure);
    }
    console.log(` `);
    console.log(`<———————————>`);
    console.log(`Скачено: ${downloadedFiles} из ${totalFiles}`);
    console.log(`<———————————>`);
    console.log(` `);

    for (let project of projectStructure) {
        for (let file of project.files) {
            if (file.status !== 'Successfully_downloaded') {
                await startFileDownload(page, file.key, project.path, projectStructure, project.name, file.name);
                downloadedFiles++;
                console.log(` `);
                console.log(`<———————————————>`);
                console.log(`Скачено: ${downloadedFiles} из ${totalFiles}`);
                console.log(`<———————————————>`);
                console.log(` `);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    await browser.close();
})();
