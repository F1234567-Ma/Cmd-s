const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const driveUrls = [
  "https://drive.google.com/file/d/1iROvEF462XlKZrkf1HLnc593WnhkyjXi/view?usp=drivesdk",
  "https://drive.google.com/file/d/1uL87y9i7UOznZdTJw18NPHvjCifCHY4J/view?usp=drivesdk",
  "https://drive.google.com/file/d/1zgOIS1PJl2bOmokfsogEdA4aw45UeGq7/view?usp=drivesdk",
  "https://drive.google.com/file/d/1pVww-djaGN0C7ZBDHfenCOGhYBQVT3LN/view?usp=drivesdk",
  "https://drive.google.com/file/d/1q6V7BaFM2vrnDI9nnRqkFHm0CwMLzFvy/view?usp=drivesdk",
  "https://drive.google.com/file/d/1ruvXvIPRxHeyv-lALGn9z3uRJWKO8cQJ/view?usp=drivesdk",
  "https://drive.google.com/file/d/1ZilBXI_7q55GhzXGD_6aYFOHuqnYIzfU/view?usp=drivesdk",
  "https://drive.google.com/file/d/12QS_VdvKXC59VwVh97ibY6hax6WIWfFY/view?usp=drivesdk",
  "https://drive.google.com/file/d/1QPt3fr1x0YhD7If7emFZkcCZBKKX2M8R/view?usp=drivesdk",
  "https://drive.google.com/file/d/1SvwubL2iZEke5SstxuwoS9NE5R6fZqGe/view?usp=drivesdk",
  "https://drive.google.com/file/d/1mBCQ9fnGgwg3dvtEgOmXsnGSRTF3wJQR/view?usp=drivesdk",
  "https://drive.google.com/file/d/17ZGxPy-yfHec0PHupgio1idncnDbO-TM/view?usp=drivesdk"
];

const LOCAL_BG_DIR = path.resolve(__dirname, "assets", "cache", "bg_pngs");

const GITHUB_OWNER = "F1234567-Ma";
const GITHUB_REPO = "V9-";
const GITHUB_REF = "db6088a5a820b9abf22e2cc9e720f407cd59bdef";
const GITHUB_DIR = "scripts/events/assets/cache/bg_pngs";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DIR}?ref=${GITHUB_REF}`;

let githubFileListCache = null;

function driveIdToDirectUrl(shareUrl) {
  if (typeof shareUrl !== "string") return "";
  const match = shareUrl.trim().match(/\/d\/([a-zA-Z0-9_-]+)/);
  const id = match ? match[1] : shareUrl.trim();
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

async function fetchBuffer(url, timeout = 10000) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    maxRedirects: 5,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return Buffer.from(res.data);
}

async function getBgFromDrive(index) {
  const shareUrl = driveUrls[index];
  if (!shareUrl) throw new Error("No drive url at index " + index);
  const directUrl = driveIdToDirectUrl(shareUrl);
  return await fetchBuffer(directUrl);
}

async function getBgFromLocal(index) {
  await fs.ensureDir(LOCAL_BG_DIR);
  const files = (await fs.readdir(LOCAL_BG_DIR))
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();
  const file = files[index];
  if (!file) throw new Error("No local bg at index " + index);
  const filePath = String(path.join(LOCAL_BG_DIR, file));
  return await fs.readFile(filePath);
}

async function getBgFromGithub(index) {
  if (!githubFileListCache) {
    const res = await axios.get(GITHUB_API_URL, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    githubFileListCache = res.data
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const file = githubFileListCache[index];
  if (!file) throw new Error("No github bg at index " + index);
  return await fetchBuffer(file.download_url);
}

async function getRandomBackgroundBuffer() {
  const index = Math.floor(Math.random() * driveUrls.length);

  try {
    return await getBgFromDrive(index);
  } catch (e1) {
    console.log(`[welcome] drive bg #${index} failed: ${e1.message}, trying local cache...`);
  }

  try {
    return await getBgFromLocal(index);
  } catch (e2) {
    console.log(`[welcome] local bg #${index} failed: ${e2.message}, trying github...`);
  }

  try {
    return await getBgFromGithub(index);
  } catch (e3) {
    console.log(`[welcome] github bg #${index} failed: ${e3.message}, using solid fallback color.`);
  }

  return null;
}

async function getAvatarBuffer(userID) {
  const url = `https://graph.facebook.com/${userID}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
  return await fetchBuffer(url);
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawGradientText(ctx, text, x, y, font, colors) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(text).width;
  const gradient = ctx.createLinearGradient(x - width / 2, y, x + width / 2, y);
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));

  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(20,0,30,0.55)";
  ctx.strokeText(text, x, y);

  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
}

async function buildWelcomeImage({ avatarBuffer, userName, threadName, memberCount, inviterName }) {
  const W = 1000, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bgBuffer = await getRandomBackgroundBuffer();
  if (bgBuffer) {
    const bgImg = await loadImage(bgBuffer);
    drawCoverImage(ctx, bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#2b1b3d";
    ctx.fillRect(0, 0, W, H);
  }

  const avatarRadius = 100;
  const strokeWidth = 4;
  const cx = W / 2;
  const cy = 165;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, avatarRadius + strokeWidth, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const avatarImg = await loadImage(avatarBuffer);
  drawCoverImage(ctx, avatarImg, cx - avatarRadius, cy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
  ctx.restore();

  let nameFont = 54;
  ctx.font = `bold ${nameFont}px sans-serif`;
  const maxNameWidth = W - 80;
  while (ctx.measureText(`Hey ${userName}`).width > maxNameWidth && nameFont > 26) {
    nameFont -= 2;
    ctx.font = `bold ${nameFont}px sans-serif`;
  }

  drawGradientText(ctx, `Hey ${userName}`, W / 2, 335, `bold ${nameFont}px sans-serif`,
    ["#ff7eb3", "#ffd36e", "#7ee8fa"]);

  drawGradientText(ctx, `Welcome To ${threadName}`, W / 2, 395, "bold 30px sans-serif",
    ["#c77dff", "#ff9ecb"]);

  drawGradientText(ctx, `Member #${memberCount}`, W / 2, 435, "bold 24px sans-serif",
    ["#ffe66d", "#ffb86c"]);

  drawGradientText(ctx, `Added By ${inviterName}`, W / 2, 470, "bold 20px sans-serif",
    ["#9be7ff", "#c9ffbf"]);

  return canvas.toBuffer("image/png");
}

module.exports.config = {
  name: "welcome",
  version: "1.0.70",
  author: "badhob",
  countDown: 5,
  role: 0,
  description: {
    en: "Send a welcome image with random background when someone joins the group"
  },
  category: "event",
  guide: {
    en: "{pn} auto-runs on member join, nothing to type"
  }
};

module.exports.onStart = async function ({ api, event }) {
  try {
    if (event.logMessageType !== "log:subscribe") return;

    const threadID = event.threadID;
    const addedParticipants = event.logMessageData.addedParticipants || [];
    if (addedParticipants.length === 0) return;

    const threadInfo = await api.getThreadInfo(threadID);
    const threadName = threadInfo.threadName || threadInfo.name || "the group";
    const memberCount = threadInfo.participantIDs
      ? threadInfo.participantIDs.length
      : (threadInfo.userInfo ? threadInfo.userInfo.length : addedParticipants.length);

    const inviterID = event.author;
    let inviterName = "Unknown";
    if (inviterID) {
      try {
        const inviterInfo = await api.getUserInfo(inviterID);
        inviterName = inviterInfo[inviterID] ? inviterInfo[inviterID].name : "Unknown";
      } catch (e) {
        console.log("[welcome] inviter fetch failed:", e.message);
      }
    }

    for (const participant of addedParticipants) {
      const userID = participant.userFbId || participant.id;
      if (!userID || userID === api.getCurrentUserID()) continue;

      let userName = participant.fullName;
      if (!userName) {
        try {
          const info = await api.getUserInfo(userID);
          userName = info[userID] ? info[userID].name : "New Member";
        } catch (e) {
          userName = "New Member";
        }
      }

      let avatarBuffer;
      try {
        avatarBuffer = await getAvatarBuffer(userID);
      } catch (e) {
        console.log("[welcome] avatar fetch failed:", e.message);
        continue;
      }

      const inviterDisplay = inviterID && inviterID !== userID ? inviterName : "Group Link";

      const imageBuffer = await buildWelcomeImage({
        avatarBuffer,
        userName,
        threadName,
        memberCount,
        inviterName: inviterDisplay
      });

      const tmpDir = path.resolve(__dirname, "assets", "cache", "tmp");
      await fs.ensureDir(tmpDir);
      
      const tmpPath = String(path.join(tmpDir, `welcome_${userID}_${Date.now()}.png`));
      await fs.writeFile(tmpPath, imageBuffer);

      if (typeof tmpPath === "string" && fs.existsSync(tmpPath)) {
        await api.sendMessage(
          {
            attachment: fs.createReadStream(tmpPath)
          },
          threadID,
          () => {
            setTimeout(() => {
              fs.unlink(tmpPath).catch(() => {});
            }, 1000);
          }
        );
      }
    }
  } catch (err) {
    console.log("[welcome] event error:", err);
  }
};
