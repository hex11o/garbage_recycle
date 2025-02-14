import _axios from "./api/index.js";
import axios from "axios";
import { config } from "dotenv";
import fs from "fs";

config();

const API_TOKEN = process.env.API_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const filePath = './cache.json';

// 缓存数据
let sendedToken = new Map()
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
      created_at_min: new Date(Date.now() - 48*60*60*1000).getTime() / 1000,
      created_at_max: new Date(Date.now() - 30*60*1000).getTime() / 1000,
      marketcap_max: 20000,
      tx_24h_count_min: 100,
      volume_u_24h_min: 20000,
      holders_top10_ratio_max: 50,
      pageNO,
      pageSize: 100,
      category: "pump_in_new"
    }
  }).then((s) => s.data.data)
}
// const data = await getData()
// console.log(data.total);

// raydium外盘
const getOutData = (pageNO = 1) => {
  return _axios.get("/v1api/v4/tokens/treasure/list", {
    params: {
      created_at_min: new Date(Date.now() - 48*60*60*1000).getTime() / 1000,
      marketcap_max: 20000,
      tx_24h_count_min: 100,
      volume_u_24h_min: 20000,
      holders_top10_ratio_max: 50,
      pageNO,
      pageSize: 100,
      category: "pump_out_new"
    }
  }).then((s) => s.data.data)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    && !social.website.includes("token")
  ))
}

// 获取所有数据，需要有推特链接
const getAllToken = async () => {
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
  if (!newToken.length) return;
  console.log(new Date(), newToken.length);
  for (let token of newToken) {
    const { target_token, created_at } = token;
    if (sendedToken.has(target_token)) return; // buggy, 前面请求回来的可能重复，在这里过滤
    sendedToken.set(target_token, created_at);
    // 发送消息
    sendMessageToChannel(normalizeMessage(token), token)
    const mapObj = Object.fromEntries(sendedToken);
    fs.writeFileSync(filePath, JSON.stringify(mapObj, null, 2), 'utf-8');
    await sleep(3000);
  }
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
    rug,
    total
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

🟢GMGN查看
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
    if (Math.floor((Date.now() - new Date(value)) / 1000) > 86400) {
      sendedToken.delete(key)
    }
  })
}

// 每十分钟查询一次
const run = () => {
  setInterval(() => {
    getAllToken()
  }, 10*60*1000)
}

// 每天清理缓存
const clearData = () => {
  setInterval(() => {
    clearStorage()
  }, 24*60*60*1000)
}

getAllToken();
run();
clearData();
