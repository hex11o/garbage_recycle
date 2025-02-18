import _axios from "../api/index.js";
import axios from "axios";
import { sendedToken } from "./info.js";
import { sleep } from "../helper.js";
import fs from "fs";

const API_TOKEN = process.env.API_TOKEN;
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID;
const filePath = './cache.json';
const threshold = 10

// 发送消息： 当前价格变化比例超过10%
const getTokenCurrentInfo = (token) => {
  return _axios.get(`/v1api/v3/tokens/${token}-solana`).then((s) => {
    return JSON.parse(s.data.data).token
  })
}

const getTokenNew = async (token) => {
  const beforeInfo = sendedToken.get(token);
  if (typeof beforeInfo === "string") return;
  const { max_price, min_price } = beforeInfo
  const currentInfo = await getTokenCurrentInfo(token)
  const { current_price_usd, symbol } = currentInfo
  let priceChangeRatio = ((current_price_usd / min_price) * 100).toFixed(0) - 100
  // 更新当前价格与代币符号
  beforeInfo.current_price_usd = current_price_usd;
  beforeInfo.symbol = symbol;

  // 更新最大最小价格与时间
  const timestamp = Date.now()
  if (!max_price) {
    beforeInfo.max_price = current_price_usd;
    beforeInfo.min_price = current_price_usd;
  } else if (max_price < current_price_usd) {
    beforeInfo.max_price = current_price_usd
    beforeInfo.max_price_at = timestamp
  } else if (min_price > current_price_usd) {
    beforeInfo.min_price = current_price_usd
    beforeInfo.min_price_at = timestamp
  }
  // 变化比例超过阈值发送信息
  if (priceChangeRatio > threshold) {
    if (!beforeInfo.alerted) {
      // 记录首次报警时价格
      beforeInfo.alert_10_price = current_price_usd
      beforeInfo.alert_10_at = timestamp
    }
    if (priceChangeRatio > 10000) {
      if (beforeInfo.alerted_10000) return;
      beforeInfo.alerted_10000 = true
      beforeInfo.alerted_5000 = true
      beforeInfo.alerted_1000 = true
      beforeInfo.alerted_500 = true
      beforeInfo.alerted_100 = true
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else if (priceChangeRatio > 5000) {
      if (beforeInfo.alerted_5000) return;
      beforeInfo.alerted_5000 = true
      beforeInfo.alerted_1000 = true
      beforeInfo.alerted_500 = true
      beforeInfo.alerted_100 = true
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else if (priceChangeRatio > 1000) {
      if (beforeInfo.alerted_1000) return;
      beforeInfo.alerted_1000 = true
      beforeInfo.alerted_500 = true
      beforeInfo.alerted_100 = true
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else if (priceChangeRatio > 500) {
      if (beforeInfo.alerted_500) return;
      beforeInfo.alerted_500 = true
      beforeInfo.alerted_100 = true
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else if (priceChangeRatio > 100) {
      if (beforeInfo.alerted_100) return;
      beforeInfo.alerted_100 = true
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else if (priceChangeRatio > 50) {
      if (beforeInfo.alerted_50) return;
      beforeInfo.alerted_50 = true
      beforeInfo.alerted = true
    } else {
      if (beforeInfo.alerted) return;
      beforeInfo.alerted = true
    }
    sendAlertMessage(beforeInfo, priceChangeRatio)
    await sleep(1000);
  }
  sendedToken.set(token, beforeInfo);
  const mapObj = Object.fromEntries(sendedToken);
  fs.writeFileSync(filePath, JSON.stringify(mapObj, null, 2), 'utf-8');
  await sleep(100);
}

const sendAlertMessage = async (beforeInfo, priceChangeRatio) => {
  let {
    symbol,
    current_price_usd,
    target_token,
    created_at,
  } = beforeInfo

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

  const text = `⚠️⚠️垃圾异动 ***${priceChangeRatio}%***⚠️⚠️
\`${target_token}\`
├ 代币：[${symbol}](https://gmgn.ai/sol/token/${target_token})  
├ 开盘时间：${timeText}
└ 当前价格：***${current_price_usd.toFixed(9)}***

[https://gmgn.ai/sol/token/${target_token}](https://gmgn.ai/sol/token/${target_token})
`

  for (let id of ALERT_CHAT_ID.split(",")) {
    axios.post(`https://api.telegram.org/bot${API_TOKEN}/sendMessage`, {
      chat_id: id,
      text,
      parse_mode: "Markdown",
      link_preview_options: {
        is_disabled: true
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: "🐶立即购买", url: `tg://resolve?domain=Tars_Dogeebot&start=rt_17336587515857_${target_token}` }],
        ]
      }
    })
      .catch((err) => {
        console.error('Error sending message', err);
      });
    await sleep(1000)
  }
}

const priceAlert = async () => {
  var tokenArray = Object.entries(Object.fromEntries(sendedToken))
  for (let [token] of tokenArray) {
    await getTokenNew(token)
  }
}

const priceMonitor = () => {
  setInterval(() => {
    priceAlert()
  }, 30 * 1000)
}

export default priceMonitor
