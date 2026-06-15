# 报销材料整理工具

一个帮助整理报销文件的桌面应用，支持自动识别、规范命名、超标检测。

## 功能

- 📋 **报销标准查询**：上传公司标准文件，按城市查询各项限额
- 📂 **文件整理**：批量上传发票/行程单，自动识别并按规范命名，打包下载
- ✅ **超标检测**：自动检测每日餐费、打车费是否超标，给出调整建议

## 开发启动

```bash
# 安装依赖
npm install

# 启动 Vite（在终端1运行）
npm run dev

# 启动 Electron 窗口（在终端2运行）
npx electron .
```

## 打包为 .exe 安装包

```bash
npm run electron:build
# 输出在 release/ 目录
```

## 技术栈

- Electron + React + Vite
- pdf-parse（PDF文本提取）
- tesseract.js（OCR图片识别）
- exceljs（Excel解析）
- pdf-lib（图片转PDF）
- archiver（ZIP打包）
