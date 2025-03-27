const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.env.APPDATA || 
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : 
      process.env.HOME + '/.local/share'), 
      'cem-license-manager', 
      'licenses.db');
  }

  // 初始化数据库连接和表
  async init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 创建和打开数据库连接
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('Could not connect to database', err);
            reject(err);
            return;
          }
          
          // 创建许可证表（如果不存在）
          this.db.run(`
            CREATE TABLE IF NOT EXISTS licenses (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              company TEXT,
              email TEXT,
              license_key TEXT NOT NULL UNIQUE,
              start_date TEXT,
              expiry_date TEXT,
              max_users INTEGER DEFAULT 1,
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('Error creating table', err);
              reject(err);
              return;
            }
            console.log('Database initialized successfully');
            resolve(true);
          });
        });
      });
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  // 关闭数据库连接
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database', err);
            reject(err);
            return;
          }
          console.log('Database connection closed');
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // 获取所有许可证
  async getAllLicenses() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM licenses ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
          console.error('Error getting licenses:', err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // 根据ID获取许可证
  async getLicense(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM licenses WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error(`Error getting license with ID ${id}:`, err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  // 添加新许可证
  async addLicense(licenseData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO licenses (
          name, company, email, license_key, start_date, expiry_date, 
          max_users, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        licenseData.name,
        licenseData.company,
        licenseData.email,
        licenseData.licenseKey,
        licenseData.startDate,
        licenseData.expiryDate,
        licenseData.maxUsers || 1,
        licenseData.status || 'active',
        function(err) {
          if (err) {
            console.error('Error adding license:', err);
            reject(err);
            return;
          }
          
          // this.lastID 包含插入的记录ID
          resolve({
            id: this.lastID,
            ...licenseData
          });
        }
      );
      
      stmt.finalize();
    });
  }

  // 更新许可证
  async updateLicense(id, licenseData) {
    // 从licenseData中提取需要更新的字段
    const fields = [];
    const values = [];
    
    if (licenseData.name !== undefined) {
      fields.push('name = ?');
      values.push(licenseData.name);
    }
    
    if (licenseData.company !== undefined) {
      fields.push('company = ?');
      values.push(licenseData.company);
    }
    
    if (licenseData.email !== undefined) {
      fields.push('email = ?');
      values.push(licenseData.email);
    }
    
    if (licenseData.licenseKey !== undefined) {
      fields.push('license_key = ?');
      values.push(licenseData.licenseKey);
    }
    
    if (licenseData.startDate !== undefined) {
      fields.push('start_date = ?');
      values.push(licenseData.startDate);
    }
    
    if (licenseData.expiryDate !== undefined) {
      fields.push('expiry_date = ?');
      values.push(licenseData.expiryDate);
    }
    
    if (licenseData.maxUsers !== undefined) {
      fields.push('max_users = ?');
      values.push(licenseData.maxUsers);
    }
    
    if (licenseData.status !== undefined) {
      fields.push('status = ?');
      values.push(licenseData.status);
    }
    
    // 添加更新时间
    fields.push('updated_at = CURRENT_TIMESTAMP');
    
    // 添加ID作为WHERE条件的参数
    values.push(id);
    
    // 如果没有需要更新的字段，直接返回
    if (fields.length === 1) { // 仅有updated_at字段
      return { changes: 0 };
    }
    
    const sql = `UPDATE licenses SET ${fields.join(', ')} WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) {
          console.error(`Error updating license with ID ${id}:`, err);
          reject(err);
          return;
        }
        
        resolve({ changes: this.changes });
      });
    });
  }

  // 删除许可证
  async deleteLicense(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM licenses WHERE id = ?', [id], function(err) {
        if (err) {
          console.error(`Error deleting license with ID ${id}:`, err);
          reject(err);
          return;
        }
        
        resolve({ changes: this.changes });
      });
    });
  }

  // 查找许可证
  async searchLicenses(query) {
    const searchTerm = `%${query}%`;
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM licenses 
         WHERE name LIKE ? 
         OR company LIKE ? 
         OR email LIKE ? 
         OR license_key LIKE ?
         ORDER BY created_at DESC`,
        [searchTerm, searchTerm, searchTerm, searchTerm],
        (err, rows) => {
          if (err) {
            console.error('Error searching licenses:', err);
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }
}

module.exports = DatabaseManager; 