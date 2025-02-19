import fs from "fs";
import path from "path";

const directoryPath = "./"

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.log('读取目录失败:', err);
    return;
  }

  // 遍历所有文件
  files.forEach((file) => {
    // 判断文件扩展名是否是 .xlsx
    if (path.extname(file) === '.xlsx') {
      const filePath = path.join(directoryPath, file);
      
      // 删除文件
      fs.unlink(filePath, (err) => {
        if (err) {
          console.log(`删除文件 ${file} 失败:`, err);
        } else {
          console.log(`成功删除文件: ${file}`);
        }
      });
    }
  });
});
