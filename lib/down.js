import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// 获取当前模块路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 目标 URL 和保存路径
const url = 'https://api.hakush.in/zzz/data/character.json';
const savePath = path.join(
  __dirname,
  '..',
  'resources',
  'hakush_data',
  'characters',
  'character.json'
);

// 确保目录存在
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`创建目录: ${dirPath}`);
  }
};

// 下载文件
const downloadFile = (url, savePath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(savePath);
    
    https.get(url, (response) => {
      // 处理重定向
      if ([301, 302, 307, 308].includes(response.statusCode)) {
        if (response.headers.location) {
          logger.debug(`重定向至: ${response.headers.location}`);
          return downloadFile(response.headers.location, savePath).then(resolve).catch(reject);
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`请求失败，状态码: ${response.statusCode}`));
        return;
      }
      
      // 管道写入文件
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        logger.debug(`文件已保存至: ${path.relative(__dirname, savePath)}`);
        resolve();
      });
      
    }).on('error', (err) => {
      // 清理部分下载的文件
      fs.unlink(savePath, () => {});
      reject(err);
    });
  });
};

// 检查并更新文件
const checkAndUpdateFile = async () => {
  try {
    // 确保目录存在
    const dirPath = path.dirname(savePath);
    ensureDirExists(dirPath);
    
    logger.debug('开始下载角色数据更新');
    
    // 直接下载最新数据（忽略本地文件大小）
    await downloadFile(url, savePath);
    
    logger.debug('角色数据更新成功!');
  } catch (err) {
    console.error('更新角色数据失败:', err.message);
    logger.error('角色数据更新失败:', err.message);
  }
};

// 执行检查并更新
export async function down() {
    await checkAndUpdateFile();
}