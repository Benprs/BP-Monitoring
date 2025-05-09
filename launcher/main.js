const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const kill = require('tree-kill');
const simpleGit = require('simple-git');
const git = simpleGit();
let viteProcess;
let mainWindow;
let tray;

app.disableHardwareAcceleration();

console.log('Launcher started');

// Charge la configuration
const configPath = path.join(__dirname, '../config.json'); // Chemin vers le fichier de configuration
let config = { showLauncherLogs: true, 'dev-mode': false }; // Valeurs par défaut
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Fonction de vérification et mise à jour
async function checkForUpdates() {
    if (config['dev-mode']) {
        console.log('Dev mode actif : bypass de la verification des mises à jour.');
        return;
    }

    console.log('Vérification des mises à jour...');
    try {
        // Assurez-vous que le dépôt est propre
        const status = await git.status();
        if (!status.isClean()) {
            console.log('Le dépôt contient des modifications locales. Mise à jour annulée.');
            return;
        }

        // Récupère les dernières modifications
        await git.fetch();
        const behind = (await git.log(['origin/main..HEAD'])).total;

        if (behind > 0) {
            console.log(`Mise à jour disponible : ${behind} commits derrière.`);
            console.log('Application des mises à jour...');
            await git.pull('origin', 'main');
            console.log('Mise à jour terminée. Redémarrage requis.');
            app.relaunch();
            app.exit();
        } else {
            console.log('Aucune mise à jour disponible.');
        }
    } catch (err) {
        console.error('Erreur lors de la vérification des mises à jour :', err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        resizable: false,
        webPreferences: {
            preload: __dirname + '/preload.js',
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('index.html');
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../assets/images/icon.png')); // Chemin vers l'icône
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Ouvrir le Dashboard',
            click: () => {
                exec('start http://localhost:5173', (error) => {
                    if (error) {
                        console.error('Failed to open browser:', error);
                    } else {
                        console.log('Browser opened successfully');
                    }
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Quitter',
            click: () => {
                console.log('Quitting application...');
                if (viteProcess) {
                    console.log('Stopping Vite process...');
                    kill(viteProcess.pid, 'SIGKILL', (err) => {
                        if (err) {
                            console.error('Failed to kill Vite process:', err);
                        } else {
                            console.log('Vite process killed successfully');
                            viteProcess = null; // Réinitialise viteProcess après l'arrêt
                            app.exit(); // Force la fermeture complète de l'application
                        }
                    });
                } else {
                    app.exit(); // Force la fermeture complète si aucun processus Vite n'est actif
                }
            }
        }
    ]);
    tray.setToolTip('Serveur Vite en cours d\'exécution');
    tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
    console.log('creating window');
    await checkForUpdates(); // Vérifie les mises à jour avant de créer la fenêtre
    createWindow();

    ipcMain.handle('launch-vite', async () => {
        console.log('ipcMain.handle("launch-vite") triggered');
        try {
            if (viteProcess) {
                console.log('Vite process already running.');
                return;
            }
            console.log('Starting Vite process...');
            viteProcess = spawn('npx', ['vite'], { cwd: __dirname + '/..', shell: true });

            if (config.showLauncherLogs) {
                viteProcess.stdout.on('data', data => console.log(`[vite stdout] ${data}`));
                viteProcess.stderr.on('data', data => console.error(`[vite stderr] ${data}`));
            }
            viteProcess.on('close', code => console.log(`Vite exited with code ${code}`));

            console.log('Waiting for Vite to be ready...');
            setTimeout(() => {
                console.log('Opening dashboard in browser...');
                exec('start http://localhost:5173', (error) => {
                    if (error) {
                        console.error('Failed to open browser:', error);
                    } else {
                        console.log('Browser opened successfully');
                    }

                    // Crée l'icône dans la barre d'état système
                    if (!tray) {
                        createTray();
                    }

                    // Ferme la fenêtre Electron après 2 secondes
                    if (mainWindow) {
                        console.log('Closing launcher window in 2 seconds...');
                        setTimeout(() => {
                            mainWindow.close();
                        }, 2000);
                    }
                });
            }, 3000);
        } catch (err) {
            console.error('Error launching Vite:', err);
        }
    });

    mainWindow.on('close', (event) => {
        event.preventDefault(); // Empêche la fermeture complète
        mainWindow.hide(); // Cache la fenêtre au lieu de la fermer
        if (!tray) {
            createTray(); // Crée l'icône dans la barre d'état système
        }
    });

    mainWindow.webContents.once('did-finish-load', () => {
        console.log('Launcher loaded, triggering Vite...');
        mainWindow.webContents.send('launch-vite');
        console.log('launch-vite event sent to renderer process');
    });
}).catch(err => {
    console.error('Failed to create window:', err);
});

app.on('window-all-closed', () => {
    // Ne quitte pas l'application si le serveur Vite est actif
    if (viteProcess) {
        console.log('Server still running in the background.');
    } else {
        if (process.platform !== 'darwin') app.quit();
    }
});

process.on('uncaughtException', err => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', reason => {
    console.error('Unhandled promise rejection:', reason);
});