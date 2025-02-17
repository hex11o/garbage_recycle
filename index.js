import { config } from "dotenv";
import { run, clearData } from "./src/info.js"
import priceMonitor from "./src/alert.js"
import log from "./src/log.js"

config();

// 垃圾回收
run();
clearData();
log();

// 价格监控
priceMonitor();
