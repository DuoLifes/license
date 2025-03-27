const { contextBridge, ipcRenderer } = require('electron');

// 安全地序列化数据
const safeStringify = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('数据序列化失败:', error);
    return null;
  }
};

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('licenseAPI', {
  // 生成许可证
  generateLicense: async (licenseData) => {
    try {
      const safeData = safeStringify(licenseData);
      if (!safeData) {
        throw new Error('无效的许可证数据');
      }
      return await ipcRenderer.invoke('generate-license', safeData);
    } catch (error) {
      console.error('生成许可证失败:', error);
      return { success: false, message: error.message };
    }
  },
  
  // 验证许可证
  verifyLicense: async (licenseKey) => {
    try {
      if (typeof licenseKey !== 'string') {
        throw new Error('无效的许可证密钥');
      }
      return await ipcRenderer.invoke('verify-license', licenseKey);
    } catch (error) {
      console.error('验证许可证失败:', error);
      return { success: false, message: error.message };
    }
  },
  
  // 获取系统信息
  getSystemInfo: async () => {
    try {
      return await ipcRenderer.invoke('get-system-info');
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return { error: error.message };
    }
  }
}); 