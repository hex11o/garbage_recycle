import { config } from "dotenv";
import { run, clearData } from "./src/info.js"
import priceMonitor from "./src/alert.js"

config();

// 垃圾回收
run();
clearData();

// 价格监控
priceMonitor();
