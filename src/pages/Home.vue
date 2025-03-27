<template>
  <div class="home">
    <el-card class="license-form">
      <template #header>
        <h2>许可证生成</h2>
      </template>
      
      <el-form :model="form" label-width="120px">
        <el-form-item label="公司名称">
          <el-input v-model="form.companyName" placeholder="请输入公司名称"></el-input>
        </el-form-item>
        
        <el-form-item label="许可证类型">
          <el-select v-model="form.licenseType" placeholder="请选择许可证类型">
            <el-option label="试用版" value="trial"></el-option>
            <el-option label="标准版" value="standard"></el-option>
            <el-option label="专业版" value="professional"></el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="有效期">
          <el-date-picker
            v-model="form.expiryDate"
            type="date"
            placeholder="选择有效期"
            :disabled-date="disabledDate"
            format="YYYY-MM-DD"
          ></el-date-picker>
        </el-form-item>
        
        <el-form-item label="设备数量">
          <el-input-number v-model="form.deviceCount" :min="1" :max="100"></el-input-number>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="generateLicense">生成许可证</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const form = ref({
  companyName: '',
  licenseType: '',
  expiryDate: '',
  deviceCount: 1
})

const disabledDate = (time) => {
  return time.getTime() < Date.now() - 8.64e7 // 禁用今天之前的日期
}

const generateLicense = async () => {
  try {
    const result = await window.licenseAPI.generateLicense({
      companyName: form.value.companyName,
      licenseType: form.value.licenseType,
      expiryDate: form.value.expiryDate,
      deviceCount: form.value.deviceCount
    });
    
    if (result.success) {
      ElMessage.success(result.message);
    } else {
      ElMessage.error(result.message);
    }
  } catch (error) {
    ElMessage.error('生成许可证时发生错误');
    console.error(error);
  }
}

const resetForm = () => {
  form.value = {
    companyName: '',
    licenseType: '',
    expiryDate: '',
    deviceCount: 1
  }
}
</script>

<style scoped>
.home {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
}

.license-form {
  width: 100%;
  max-width: 600px;
}

:deep(.el-card__header) {
  text-align: center;
  background-color: #f0f2f5;
}

h2 {
  margin: 0;
  color: #303133;
}
</style> 