import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// ✅ 从环境变量读取所有账号配置，格式：[{ username, password, machines: [id1, id2] }, ...]
const ACCOUNTS = JSON.parse(process.env.FC_ACCOUNTS || "[]");
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

if (!ACCOUNTS.length) {
  console.error("❌ 未配置 FC_ACCOUNTS 环境变量或内容为空");
  process.exit(1);
}

// ✅ 可扩展的接口配置
const apiEndpoints = [
  "https://raspy-disk-b126.dj2cubz.workers.dev/",
  "https://round-breeze-41c8.dj2cubz.workers.dev/"
];

const getRandomEndpoint = () => apiEndpoints[Math.floor(Math.random() * apiEndpoints.length)];

/**
 * ✅ Telegram 消息推送
 * @param {string} message
 */
async function sendTelegramMessage(message) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn("⚠️ 未配置 Telegram 推送信息");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: "Markdown"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ Telegram 推送失败: ${errorText}`);
    } else {
      console.log("✅ Telegram 消息已成功发送");
    }
  } catch (err) {
    console.error("❌ Telegram 推送异常:", err);
  }
}

/**
 * ✅ 请求续期接口
 * @param {string} username
 * @param {string} password
 * @param {number} machineId
 */
async function renewMachine(username, password, machineId) {
  const payload = { username, password, port: parseInt(machineId, 10) };
  const endpoint = getRandomEndpoint();
  console.log(`📡 请求接口: ${endpoint} [用户: ${username}, 机器: ${machineId}]`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`🔁 返回状态码: ${response.status}`);

    try {
      const json = JSON.parse(responseText);
      const message = json?.message || "⚠️ 未包含 message 字段";

      const decoratedMsg = `🧾 *${username}* @ *机器 ${machineId}*\n${message}`;
      console.log("📬 接口返回:", message);
      await sendTelegramMessage(decoratedMsg);

      if (
        message.includes("请求体不是有效的 JSON") ||
        message.includes("缺少用户名、密码或端口号")
      ) {
        return false;
      }
    } catch (parseError) {
      const errorMsg = `⚠️ 返回内容非 JSON [${username}@${machineId}]:\n${responseText}`;
      console.warn(errorMsg);
      await sendTelegramMessage(errorMsg);
    }
  } catch (err) {
    const errorMsg = `❌ 请求失败 [${username}@${machineId}]: ${err.message}`;
    console.error(errorMsg);
    await sendTelegramMessage(errorMsg);
  }
  return true;
}

(async () => {
  console.log("🚀 开始执行多账号续期任务...");
  for (const account of ACCOUNTS) {
    const { username, password, machines } = account;
    if (!username || !password || !Array.isArray(machines)) {
      console.warn(`⚠️ 无效账号配置: ${JSON.stringify(account)}`);
      continue;
    }

    for (const machineId of machines) {
      await renewMachine(username, password, parseInt(machineId, 10));
      await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 1000))); // 防止过快请求
    }
  }
})();
