const NodeRSA = require('node-rsa');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

class LicenseUtils {
  constructor() {
    this.keyPair = null;
    this.publicKeyPem = null;
    this.privateKeyPem = null;
    
    // 密钥存储路径
    this.keysDir = path.join(process.env.APPDATA || 
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : 
      process.env.HOME + '/.local/share'), 
      'cem-license-manager', 
      'keys');
      
    this.publicKeyPath = path.join(this.keysDir, 'public_key.pem');
    this.privateKeyPath = path.join(this.keysDir, 'private_key.pem');
  }
  
  // 初始化密钥
  async init() {
    try {
      // 确保密钥目录存在
      if (!fs.existsSync(this.keysDir)) {
        fs.mkdirSync(this.keysDir, { recursive: true });
      }
      
      // 检查密钥文件是否存在
      if (fs.existsSync(this.publicKeyPath) && fs.existsSync(this.privateKeyPath)) {
        // 从文件加载现有密钥
        this.publicKeyPem = fs.readFileSync(this.publicKeyPath, 'utf8');
        this.privateKeyPem = fs.readFileSync(this.privateKeyPath, 'utf8');
        console.log('Loaded existing RSA keys');
      } else {
        // 生成新的RSA密钥对
        await this.generateKeys();
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing license utils:', error);
      throw error;
    }
  }
  
  // 生成新的RSA密钥对
  async generateKeys() {
    try {
      // 生成2048位RSA密钥对
      const key = new NodeRSA({ b: 2048 });
      
      this.publicKeyPem = key.exportKey('public');
      this.privateKeyPem = key.exportKey('private');
      
      // 保存密钥到文件
      fs.writeFileSync(this.publicKeyPath, this.publicKeyPem);
      fs.writeFileSync(this.privateKeyPath, this.privateKeyPem);
      
      console.log('Generated and saved new RSA keys');
      return true;
    } catch (error) {
      console.error('Error generating RSA keys:', error);
      throw error;
    }
  }
  
  // 生成许可证密钥
  generateLicenseKey(data) {
    try {
      // 创建随机的许可证ID (16字符)
      const licenseId = forge.util.bytesToHex(forge.random.getBytesSync(8));
      
      // 基于数据创建一个唯一的指纹
      const fingerprint = this.generateFingerprint(data);
      
      // 组合许可证ID和指纹，格式化为许可证密钥
      const segments = [
        licenseId.substring(0, 4),
        licenseId.substring(4, 8),
        licenseId.substring(8, 12),
        licenseId.substring(12, 16),
        fingerprint.substring(0, 8)
      ];
      
      return segments.join('-').toUpperCase();
    } catch (error) {
      console.error('Error generating license key:', error);
      throw error;
    }
  }
  
  // 基于许可证数据生成指纹
  generateFingerprint(data) {
    try {
      // 组合关键数据
      const input = [
        data.name,
        data.email,
        data.company || '',
        typeof data.maxUsers === 'number' ? data.maxUsers.toString() : '1'
      ].join('|');
      
      // 创建MD5哈希
      const md = forge.md.md5.create();
      md.update(input);
      
      return md.digest().toHex();
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      throw error;
    }
  }
  
  // 签名许可证数据
  signLicense(licenseData) {
    try {
      // 序列化许可证数据
      const dataStr = JSON.stringify(licenseData);
      
      // 使用私钥签名数据
      const privateKey = new NodeRSA(this.privateKeyPem);
      const signature = privateKey.sign(dataStr, 'base64', 'utf8');
      
      return {
        data: licenseData,
        signature
      };
    } catch (error) {
      console.error('Error signing license:', error);
      throw error;
    }
  }
  
  // 验证许可证签名
  verifyLicense(license) {
    try {
      if (!license || !license.data || !license.signature) {
        return false;
      }
      
      // 序列化许可证数据
      const dataStr = JSON.stringify(license.data);
      
      // 使用公钥验证签名
      const publicKey = new NodeRSA(this.publicKeyPem);
      return publicKey.verify(dataStr, license.signature, 'utf8', 'base64');
    } catch (error) {
      console.error('Error verifying license:', error);
      return false;
    }
  }
  
  // 验证许可证是否过期
  isLicenseExpired(license) {
    try {
      if (!license || !license.data || !license.data.expiryDate) {
        return true; // 如果没有过期日期，视为已过期
      }
      
      const expiryDate = new Date(license.data.expiryDate);
      const now = new Date();
      
      return now > expiryDate;
    } catch (error) {
      console.error('Error checking license expiry:', error);
      return true; // 出错时也视为已过期
    }
  }
  
  // 导出公钥
  exportPublicKey() {
    return this.publicKeyPem;
  }
}

module.exports = LicenseUtils; 