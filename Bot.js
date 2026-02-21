const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      lang VARCHAR(5) DEFAULT 'uz',
      premium BOOLEAN DEFAULT false,
      premium_until BIGINT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      username VARCHAR(255),
      type VARCHAR(10),
      amount DECIMAL,
      price DECIMAL,
      status VARCHAR(20) DEFAULT 'active',
      created_at BIGINT
    );
  `);
  console.log('✅ Database tables ready');
}
initDB();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "🌐 EKO TIZIM BOT\n\n" +
    "👋 Xush kelibsiz! Quyidagi buyruqlar:\n\n" +
    "💰 /conv 100 USD to UZS – konvertatsiya\n" +
    "📊 /rates – valyuta kurslari\n" +
    "🤖 /ai savol – AI tahlil\n" +
    "🔄 /p2p – P2P bozor\n" +
    "🌐 /lang – Til sozlamalari\n" +
    "❓ /help – Yordam"
  );
});

bot.onText(/\/p2p/, async (msg) => {
  const chatId = msg.chat.id;
  const res = await pool.query(
    "SELECT * FROM orders WHERE status = 'active' ORDER BY created_at DESC"
  );
  let msgText = "🔄 P2P BOZOR\n\n";
  if (res.rows.length > 0) {
    res.rows.forEach(order => {
      const icon = order.type === 'SELL' ? '🔴' : '🟢';
      msgText += `${icon} ${order.amount} USDT @ ${order.price} UZS\n`;
    });
  } else {
    msgText += "📭 Hozircha faol buyurtmalar yo'q.\n";
  }
  msgText += "\n➕ Sotish: /sell 100 USDT 13000\n";
  msgText += "🛒 Sotib olish: /buy 50 USDT 12800";
  bot.sendMessage(chatId, msgText);
});

bot.onText(/\/sell (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `user_${userId}`;
  const parts = match[1].split(' ');
  if (parts.length < 2) {
    return bot.sendMessage(chatId, "❌ Format: /sell 100 USDT 13000");
  }
  const amount = parseFloat(parts[0]);
  const price = parseFloat(parts[2]) || 0;
  await pool.query(
    "INSERT INTO orders (user_id, username, type, amount, price, created_at) VALUES ($1, $2, 'SELL', $3, $4, $5)",
    [userId, username, amount, price, Date.now()]
  );
  bot.sendMessage(chatId, "✅ E'loningiz qo'shildi!");
});

bot.onText(/\/buy (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `user_${userId}`;
  const parts = match[1].split(' ');
  if (parts.length < 2) {
    return bot.sendMessage(chatId, "❌ Format: /buy 50 USDT 12800");
  }
  const amount = parseFloat(parts[0]);
  const price = parseFloat(parts[2]) || 0;
  await pool.query(
    "INSERT INTO orders (user_id, username, type, amount, price, created_at) VALUES ($1, $2, 'BUY', $3, $4, $5)",
    [userId, username, amount, price, Date.now()]
  );
  bot.sendMessage(chatId, "✅ E'loningiz qo'shildi!");
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "❓ YORDAM\n\n" +
    "Quyidagi buyruqlar mavjud:\n\n" +
    "/start - Boshlash\n" +
    "/conv 100 USD to UZS - Konvertatsiya\n" +
    "/rates - Valyuta kurslari\n" +
    "/ai savol - AI tahlil\n" +
    "/p2p - P2P bozor\n" +
    "/sell 100 USDT 13000 - Sotish\n" +
    "/buy 50 USDT 12800 - Sotib olish\n" +
    "/lang - Til sozlamalari"
  );
});

bot.onText(/\/lang/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🇺🇿 O'zbek", callback_data: "lang_uz" }],
        [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }],
        [{ text: "🇬🇧 English", callback_data: "lang_en" }],
      ],
    },
  };
  bot.sendMessage(chatId, "🌐 Tilni tanlang:", options);
});

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === 'lang_uz') {
    await pool.query("INSERT INTO users (user_id, lang) VALUES ($1, 'uz') ON CONFLICT (user_id) DO UPDATE SET lang = 'uz'", [userId]);
    bot.sendMessage(message.chat.id, "✅ Til o'zbek tiliga o'rnatildi");
  } else if (data === 'lang_ru') {
    await pool.query("INSERT INTO users (user_id, lang) VALUES ($1, 'ru') ON CONFLICT (user_id) DO UPDATE SET lang = 'ru'", [userId]);
    bot.sendMessage(message.chat.id, "✅ Язык установлен на русский");
  } else if (data === 'lang_en') {
    await pool.query("INSERT INTO users (user_id, lang) VALUES ($1, 'en') ON CONFLICT (user_id) DO UPDATE SET lang = 'en'", [userId]);
    bot.sendMessage(message.chat.id, "✅ Language set to English");
  }
  bot.answerCallbackQuery(callbackQuery.id);
});

console.log('🤖 Bot ishga tushdi');
