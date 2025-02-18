import _axios from "../api/index.js";
import axios from "axios";
import { config } from "dotenv";
import { sleep } from "../helper.js";
import fs from "fs";

config();

const API_TOKEN = process.env.API_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const filePath = './cache.json';
const timeRange = 72*60*60*1000
const marketcap_max= 20000
const tx_24h_count_min = 100
const volume_u_24h_min = 20000
const holders_top10_ratio_max = 50
const pageSize = 100

// 缓存数据
export let sendedToken = new Map()
if (fs.existsSync(filePath)) {
  const fileData = fs.readFileSync(filePath, 'utf-8');
  if (fileData) {
    const parsedData = JSON.parse(fileData);
    sendedToken = new Map(Object.entries(parsedData));
  }
}

// pump内盘
const getData = (pageNO = 1) => {
  return _axios.get("/v1api/v4/tokens/treasure/list", {
    params: {
      created_at_min: new Date(Date.now() - timeRange).getTime() / 1000,
      created_at_max: new Date(Date.now() - 30*60*1000).getTime() / 1000,
      marketcap_max,
      tx_24h_count_min,
      volume_u_24h_min,
      holders_top10_ratio_max,
      pageNO,
      pageSize,
      category: "pump_in_new"
    }
  }).then((s) => s.data.data)
}

// raydium外盘
const getOutData = (pageNO = 1) => {
  return _axios.get("/v1api/v4/tokens/treasure/list", {
    params: {
      created_at_min: new Date(Date.now() - timeRange).getTime() / 1000,
      marketcap_max,
      tx_24h_count_min,
      volume_u_24h_min,
      holders_top10_ratio_max,
      pageNO,
      pageSize,
      category: "pump_out_new"
    }
  }).then((s) => s.data.data)
}

function filter({ appendix, total }) {
  let social = appendix ? JSON.parse(appendix) : {}
  return social.website && (social.website.includes("github.com") || (
    social.twitter
    && total == 1
    && !social.website.includes("twitter.com")
    && !social.website.includes("youtube.com")
    && !social.website.includes("x.com")
    && !social.website.includes("wikipedia.org")
    && !social.website.includes("instagram.com")
    && !social.website.includes("facebook.com")
    && !social.website.includes("reddit.com")
    && !social.website.includes("tiktok.com")
    && !social.website.includes("linktr.ee")
    && !social.website.includes("kick.com")
    && !social.website.includes("twitch.tv")
    && !social.website.includes("coin")
    && !social.website.includes("youtu.be")
    && !social.website.includes(".top")
    && !social.website.includes("meme")
    && !social.website.includes("vercel.app")
    && !social.website.includes("t.me")
    && !social.website.includes("pump.fun")
    && !social.website.includes("token")
  ))
}

// 将信息处理为发送text
const normalizeMessage = (message) => {
  let {
    amm,
    target_token,
    token0_symbol,
    token1_symbol,
    tx_24h_count,
    volume_u_24h,
    makers_24h,
    created_at,
    market_cap,
    holders,
    appendix,
    holders_top10_ratio,
    current_price_usd,
  } = message

  appendix = appendix ? JSON.parse(appendix) : {}

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

  return `[$${token0_symbol != "SOL" ? token0_symbol : token1_symbol }]() （${amm}${amm === "pump" ? "内盘" : "外盘"}）
\`${target_token}\`
💹交易信息
├ 开盘时间：${timeText}
├ 市值：${(market_cap / 1000).toFixed(2)}k
├ 价格：${current_price_usd.toFixed(9)}
├ 持有人数：${holders}
├ 24h交易量：${volume_u_24h.toFixed(0)}
├ 24h交易数：${tx_24h_count}
└ 24h交易人数：${makers_24h}

🧑‍💻开发者信息
${appendix.twitter ? `├ 推特：[${appendix.twitter}](${appendix.twitter})` : ""}
├ 网站：[${appendix.website}](${appendix.website})
└ Top10占比：${holders_top10_ratio.toFixed(0)}%

[https://gmgn.ai/sol/token/${target_token}](https://gmgn.ai/sol/token/${target_token})
`
}

// 发送消息到频道
const sendMessageToChannel = (text, msg) => {
  axios.post(`https://api.telegram.org/bot${API_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    link_preview_options: {
      is_disabled: true
    },
    reply_markup: msg ? {
      inline_keyboard: [
        [{ text: "推特搜索", url: `https://x.com/search?q=${msg.target_token}&src=typed_query` }, { text: "🐶购买", url: `tg://resolve?domain=Tars_Dogeebot&start=rt_17336587515857_${msg.target_token}` }],
      ]
    } : {}
  })
    .catch((err) => {
      console.error('Error sending message', err);
    });
}

// 清理map
const clearStorage = () => {
  sendedToken.forEach((value, key) => {
    if (Math.floor((Date.now() - new Date(typeof value === "string" ? value : value.created_at)) / 1000) > timeRange) {
      sendedToken.delete(key)
      const mapObj = Object.fromEntries(sendedToken);
      fs.writeFileSync(filePath, JSON.stringify(mapObj, null, 2), 'utf-8');
    }
  })
}

const start = async () => {
  const allData = []

  const pumpData = await getData()
  const raydiumData = await getOutData()
  const pumpPage = Math.ceil(pumpData.total / 100)
  const raydiumPage = Math.ceil(raydiumData.total / 100)

  const firstPageData = [...pumpData.data, ...raydiumData.data].filter(filter)
  allData.push(...firstPageData)

  if (pumpPage > 1) {
    for (let i = 2; i <= pumpPage; i++) {
      const data = (await getData(i)).data.filter(filter)
      allData.push(...data)
    }
  }

  if (raydiumPage > 1) {
    for (let i = 2; i <= pumpPage; i++) {
      const data = (await getData(i)).data.filter(filter)
      allData.push(...data)
    }
  }
  const newToken = allData.filter(({ target_token }) => !sendedToken.has(target_token))
  console.log(new Date(), newToken.length);
  if (!newToken.length) return;
  for (let token of newToken) {
    const { target_token } = token;
    if (sendedToken.has(target_token)) return; // buggy, 前面请求回来的可能重复，在这里过滤
    sendedToken.set(target_token, token);
    // 发送消息
    sendMessageToChannel(normalizeMessage(token), token)
    const mapObj = Object.fromEntries(sendedToken);
    fs.writeFileSync(filePath, JSON.stringify(mapObj, null, 2), 'utf-8');
    await sleep(3000);
  }
}

// 每十分钟查询一次
export const run = () => {
  start()
  setInterval(() => {
    start()
  }, 10*60*1000)
}

// 每天清理缓存
export const clearData = () => {
  clearStorage()
  setInterval(() => {
    clearStorage()
  }, 24*60*60*1000)
}
