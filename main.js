const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const os = require('os');

// 禁用硬件加速
app.disableHardwareAcceleration();

// 处理 IPC 调用
ipcMain.handle('generate-license', async (event, licenseData) => {
  try {
    // TODO: 实现许可证生成逻辑
    console.log('生成许可证:', licenseData);
    return { success: true, message: '许可证生成成功' };
  } catch (error) {
    console.error('生成许可证失败:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('verify-license', async (event, licenseKey) => {
  try {
    // TODO: 实现许可证验证逻辑
    console.log('验证许可证:', licenseKey);
    return { success: true, message: '许可证有效' };
  } catch (error) {
    console.error('验证许可证失败:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-system-info', async () => {
  try {
    return {
      platform: os.platform(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return { error: error.message };
  }
});

function createWindow() {
  // 配置 session
  if (isDev) {
    // 拦截开发者工具的请求
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (details.url.includes('chrome-devtools://')) {
        callback({ cancel: true });
        return;
      }
      callback({ cancel: false });
    });
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev,
      spellcheck: false,
      autoplayPolicy: 'user-gesture-required',
      enableWebSQL: false,
      // 禁用所有自动填充功能
      autofill: false
    }
  });

  // 设置 CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self';" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' data: https:;" +
          "connect-src 'self' http://localhost:* ws://localhost:*;" +
          "frame-ancestors 'none';" +
          "form-action 'none';"
        ]
      }
    });
  });

  if (isDev) {
    // 开发模式下的配置
    mainWindow.webContents.once('dom-ready', () => {
      // 使用分离模式打开开发者工具，但不激活
      mainWindow.webContents.openDevTools({
        mode: 'detach',
        activate: false
      });

      // 注入控制台过滤器
      mainWindow.webContents.executeJavaScript(`
        // 保存原始的控制台方法
        const originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error
        };

        // 创建过滤函数
        const shouldFilter = (args) => {
          return args.some(arg => {
            if (typeof arg === 'string') {
              return arg.includes('Autofill') || 
                     arg.includes('PasswordManager') ||
                     arg.includes('clone') ||
                     arg.includes('devtools://') ||
                     arg.includes('ERR_BLOCKED_BY_CLIENT');
            }
            return false;
          });
        };

        // 重写控制台方法
        console.warn = (...args) => {
          if (!shouldFilter(args)) {
            originalConsole.warn.apply(console, args);
          }
        };

        console.error = (...args) => {
          if (!shouldFilter(args)) {
            originalConsole.error.apply(console, args);
          }
        };

        // 处理未捕获的错误和拒绝
        window.addEventListener('error', (event) => {
          if (shouldFilter([event.message])) {
            event.preventDefault();
          }
        });

        window.addEventListener('unhandledrejection', (event) => {
          if (shouldFilter([event.reason?.message])) {
            event.preventDefault();
          }
        });
      `);
    });

    // 处理渲染进程的错误
    mainWindow.webContents.on('console-message', (event) => {
      const message = event.message || '';
      const shouldFilter = 
        message.includes('Autofill') || 
        message.includes('PasswordManager') ||
        message.includes('clone') ||
        message.includes('devtools://') ||
        message.includes('ERR_BLOCKED_BY_CLIENT') ||
        message.includes('Failed to load URL');

      if (shouldFilter) {
        event.preventDefault();
      }
    });
  }

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(error => {
      if (!error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.error('加载应用失败:', error);
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).catch(console.error);
  }

  return mainWindow;
}

// 在应用启动时配置
app.whenReady().then(() => {
  // 配置应用
  app.commandLine.appendSwitch('disable-features', 'Autofill,AutofillServerCommunication,AutofillAddresses,AutofillCreditCards,AutofillProfiles,AutofillPasswordManager,PasswordManager,PasswordManagerServerCommunication,AutofillPasswordManagerServerCommunication,AutofillPasswordManagerServerCommunication,AutofillPasswordManagerServerCommunication');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
  app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');
  app.commandLine.appendSwitch('enable-logging', 'stderr');
  app.commandLine.appendSwitch('v', '-1');  // 禁用所有日志
  
  // 配置 session
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'geolocation'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // 禁用所有 session 的 Autofill
  session.defaultSession.setSpellCheckerLanguages([]);
  session.defaultSession.setSpellCheckerEnabled(false);
  
  // 处理未捕获的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    const message = reason?.message || String(reason);
    if (!message.includes('Autofill') && 
        !message.includes('PasswordManager') &&
        !message.includes('clone') &&
        !message.includes('devtools://')) {
      console.log('未处理的 Promise 拒绝:', message);
    }
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    const message = error?.message || String(error);
    if (!message.includes('Autofill') && 
        !message.includes('PasswordManager') &&
        !message.includes('clone') &&
        !message.includes('devtools://')) {
      console.error('未捕获的异常:', message);
    }
  });
  
  // 配置日志级别
  process.env.ELECTRON_ENABLE_LOGGING = '0';
  process.env.ELECTRON_DEBUG_NOTIFICATIONS = 'false';
  process.env.ELECTRON_ENABLE_STACK_DUMPING = '0';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  
  const mainWindow = createWindow();

  // 配置主窗口的 session
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'geolocation'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    // 注入额外的 Autofill 禁用代码
    mainWindow.webContents.executeJavaScript(`
      // 禁用所有表单自动填充
      document.addEventListener('DOMContentLoaded', () => {
        const forms = document.getElementsByTagName('form');
        for (let form of forms) {
          form.setAttribute('autocomplete', 'off');
          const inputs = form.getElementsByTagName('input');
          for (let input of inputs) {
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocapitalize', 'off');
            input.setAttribute('spellcheck', 'false');
          }
        }
      });

      // 禁用 Chrome 的自动填充 API
      if (window.chrome && window.chrome.autofill) {
        window.chrome.autofill = undefined;
      }
    `);
  });
}).catch(error => {
  if (!error.message.includes('Autofill') && 
      !error.message.includes('PasswordManager') &&
      !error.message.includes('clone') &&
      !error.message.includes('devtools://')) {
    console.error('应用启动失败:', error);
  }
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 