import cron from "node-cron"
import _axios from "../api/index.js";
import XLSX from "xlsx"
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import { config } from "dotenv";

config();

const timezone = 'Asia/Shanghai';
const API_TOKEN = process.env.API_TOKEN;
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID;
const filePath = './cache.json'

function formatTimestamp(timestamp = new Date().getTime()) {
  const date = new Date( new Date(timestamp).getTime() + 8*60*60*1000); // 手动加上 8 小时
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const pad = (num) => num.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}-${pad(minutes)}`;
}

// 任务函数
export function executeTask() {
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, 'utf-8');
    if (fileData) {
      const parsedData = JSON.parse(fileData);
      const sendedToken = Array.from(Object.values(parsedData));
      // 处理数据
      const normalizeData = sendedToken.filter(({ alerted }) => alerted).map(normalizeToken)
      // 按收益排序
      const profitOrderData = normalizeData.sort((a, b) => b[0] - a[0])
      // 输入日志
      const wb = XLSX.utils.book_new();
      const ws_data = [
        ["最大涨幅", "最大涨幅%", "最大跌幅%", "告警时间", "名称", "创建/发射时间", "CA", "当前价格", "当前损益", "最大价格", "最低价格", "首次报警价格"],
        ...profitOrderData
      ]
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, `${formatTimestamp()}.xlsx`);
      sendFileToTg()
    }
  }
}

function normalizeToken(item) {
  const { max_price, min_price, alert_10_price, target_token, created_at, current_price_usd, symbol, alert_10_at } = item

  const currentProfit = (((current_price_usd - alert_10_price) / alert_10_price) * 100).toFixed(0)
  const maxProfit = (((max_price - alert_10_price) / alert_10_price) * 100).toFixed(0)
  const maxLoss = (((min_price - alert_10_price) / alert_10_price) * 100).toFixed(0)
  const alert_time = formatTimestamp(alert_10_at)
  return [maxProfit, `${maxProfit}%`, `${maxLoss}%`, alert_time, symbol, formatTimestamp(created_at), target_token, current_price_usd.toFixed(9), `${currentProfit}%`, max_price.toFixed(9), min_price.toFixed(9), alert_10_price.toFixed(9)]
}

function sendFileToTg() {
  // 创建一个表单数据对象
const form = new FormData();
// 将文件添加到表单数据中
form.append('chat_id', ALERT_CHAT_ID);
form.append('document', fs.createReadStream(`./${formatTimestamp()}.xlsx`)); // 发送的文件

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
  cron.schedule('0 21 * * *', () => {
    executeTask();
  }, {
    scheduled: true,
    timezone: timezone
  });
}

export default log
