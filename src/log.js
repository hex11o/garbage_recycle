import cron from "node-cron"
import _axios from "../api/index.js";
import XLSX from "xlsx"
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const timezone = 'Asia/Shanghai';
const API_TOKEN = process.env.API_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const filePath = './cache.json'

function getCurrentDate() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1并保证两位数
  const day = String(today.getDate()).padStart(2, '0'); // 保证日期是两位数

  return `${year}-${month}-${day}日报`;
}

// 任务函数
function executeTask() {
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, 'utf-8');
    if (fileData) {
      const parsedData = JSON.parse(fileData);
      const sendedToken = Array.from(Object.values(parsedData));
      // 处理数据
      const normalizeData = sendedToken.filter(({alerted}) => alerted).map(normalizeToken)
      // 按收益排序
      const profitOrderData = normalizeData.sort((a, b) => b[0] - a[0])
      // 输入日志
      const wb = XLSX.utils.book_new();
      const ws_data = [
        ["当前损益", "名称", "时间", "CA", "当前价格", "最大涨幅", "最大价格", "最低价格"],
        ...profitOrderData
      ]
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, `./${getCurrentDate()}.xlsx`);
      sendFileToTg()
    }
  }
}

function normalizeToken(item) {
  const { max_price, min_price, alert_10_price, target_token, created_at, current_price_usd, symbol, alerted } = item
  // 发送时与创建时间差
  const timeDiff = Math.floor((Date.now() - new Date(created_at).getTime()) / 1000);
  let timeText;
  if (timeDiff < 3600) { // Less than 1 hour
    timeText = `${Math.floor(timeDiff / 60)}m`;
  } else if (timeDiff < 86400) { // Less than 24 hours
    timeText = `${Math.floor(timeDiff / 3600)}h${Math.floor((timeDiff % 3600) / 60)}m`;
  } else { // Days
    timeText = `${Math.floor(timeDiff / 86400)}d${Math.floor((timeDiff % 86400) / 3600)}h`;
  }

  const currentProfit = (((current_price_usd - alert_10_price) / alert_10_price) * 100).toFixed(0)
  const maxProfit = (((max_price - alert_10_price) / alert_10_price) * 100).toFixed(0)
  return [`${currentProfit}%`, symbol, timeText, target_token, current_price_usd.toFixed(9), `${maxProfit}%`, max_price.toFixed(9), min_price.toFixed(9)]
}

function sendFileToTg() {
  // 创建一个表单数据对象
const form = new FormData();
// 将文件添加到表单数据中
form.append('chat_id', CHAT_ID);
form.append('document', fs.createReadStream(`./${getCurrentDate()}.xlsx`)); // 发送的文件

fetch(`https://api.telegram.org/bot${API_TOKEN}/sendDocument`, {
  method: 'POST',
  body: form
})
  .then(response => response.json())
  .catch(err => console.error('Error sending file:', err));
}

function log() {
  cron.schedule('0 9 * * *', () => {
    executeTask();
  }, {
    scheduled: true,
    timezone: timezone
  });
}

export default log
