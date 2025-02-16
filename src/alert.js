import _axios from "../api/index.js";
import axios from "axios";
import { sendedToken } from "./info.js";
import { sleep } from "../helper.js";

const API_TOKEN = process.env.API_TOKEN;
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID;
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
  const { current_price_usd: beforePrice } = beforeInfo
  const currentInfo = await getTokenCurrentInfo(token)
  const { current_price_usd } = currentInfo
  let priceChangeRatio = ((current_price_usd / beforePrice) * 100).toFixed(0) - 100
  // 变化比例超过阈值发送信息
  if (priceChangeRatio > threshold) {
    sendAlertMessage(beforeInfo, currentInfo, priceChangeRatio)
    beforeInfo.alerted = true;
    sendedToken.set(token, beforeInfo);
    await sleep(1000);
  } else if (priceChangeRatio < 0) {
    beforeInfo.current_price_usd = current_price_usd;
    sendedToken.set(token, beforeInfo);
  }
  await sleep(100);
}

const sendAlertMessage = async (beforeInfo, { symbol, current_price_usd }, priceChangeRatio) => {
  let {
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
  for (let [token, info] of tokenArray) {
    if (info.alerted) continue;
    await getTokenNew(token)
  }
}

const priceMonitor = () => {
  setInterval(() => {
    priceAlert()
  }, 30 * 1000)
}

export default priceMonitor
