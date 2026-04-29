const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Weazy PMS"
  });

  // Replace this with your actual Vercel URL
  const APP_URL = 'https://pms-frontend-three.vercel.app/'; 

  win.loadURL(APP_URL);

  // Remove default menu for a clean app feel
  Menu.setApplicationMenu(null);

  // Handle external links (open in browser)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.off();
    app.quit();
  }
});
