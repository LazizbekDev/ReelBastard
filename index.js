import { Telegraf } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.use(express.json());

let lastChatId = null;

// 🧠 Prompt Templates
const PERSONALITY_PROMPT_TEMPLATE = (message) => `
You're an unfiltered, sarcastic dude chilling in a Telegram group full of movie maniacs. 
Reply like a chaotic Gen-Z meme lord, with brutal humor and ruthless roasts. 
No emojis unless absolutely needed. No Markdown. Avoid formal tone at all costs.
Reply to this message casually, like you're texting in a group chat:
"${message}"
`;

const RANDOM_MESSAGE_PROMPT = `
Send a random dark, sarcastic, savage message like you're chilling in a Telegram group full of movie nerds.
Use meme-style humor, Gen-Z slang, and don't be polite.
Only in casual English.
`;

// 🤖 Gemini response
async function getAIResponse(userMessage = null) {
  const prompt = userMessage
    ? PERSONALITY_PROMPT_TEMPLATE(userMessage)
    : RANDOM_MESSAGE_PROMPT;

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "😶";
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return "😶";
  }
}

bot.start((ctx) => {
  ctx.reply("🤖 Bot started! Type @botusername to mention me.");
  console.log("🤖 Bot started by user:", ctx.from.username);
});

// 💬 Reply on trigger
bot.on("text", async (ctx) => {
  const msg = ctx.message;
  const text = msg.text || "";
  lastChatId = msg.chat.id;
  console.log("🤖 Message received:", text);

  const botUsername = ctx.botInfo.username.toLowerCase();
  const isMentioned = text.toLowerCase().includes(`@${botUsername}`);
  const isReplyToBot =
    msg.reply_to_message?.from?.username?.toLowerCase() === botUsername;
  const hasQuestionMark = text.includes("?");

  if (isMentioned || isReplyToBot || hasQuestionMark) {
    let promptMessage = text;

    if (isMentioned) {
      const cleaned = text
        .replace(new RegExp(`@${botUsername}`, "gi"), "")
        .trim();
      promptMessage = `This dude mentioned you:\n${cleaned}`;
    }

    const reply = await getAIResponse(promptMessage);
    ctx.reply(reply, { reply_to_message_id: msg.message_id });
  }
});

// 🔁 Auto random reply every 5–10 hours
function startRandomMessageSender() {
  const scheduleNext = async () => {
    const timeout =
      Math.floor(Math.random() * (10 - 5 + 1) + 5) * 60 * 60 * 1000;
    setTimeout(async () => {
      if (lastChatId) {
        const msg = await getAIResponse();
        bot.telegram.sendMessage(lastChatId, msg);
      }
      scheduleNext(); // repeat
    }, timeout);
  };

  scheduleNext();
}

// 🌐 Optional express endpoint
app.get("/", (req, res) => {
  res.send("🤖 Bot is running...");
});

app.listen(process.env.PORT || 5000, () => {
  console.log("🌐 Server is live...");
});

// 🚀 Start the bot
bot.telegram.getMe().then((botInfo) => {
  bot.options.username = botInfo.username;
  console.log("🤖 Bot username:", botInfo.username);

  bot.launch();
  startRandomMessageSender();
  console.log("🤖 Bot launched via Telegraf");
});
