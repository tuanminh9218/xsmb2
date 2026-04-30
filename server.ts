import express from "express";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

const VAPID_KEYS_FILE = path.join(process.cwd(), "vapid.json");
let vapidKeys: { publicKey: string, privateKey: string };

if (fs.existsSync(VAPID_KEYS_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, "utf-8"));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
  "mailto:contact@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), "subscriptions.json");
let subscriptions: any[] = [];
if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
  subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8"));
}

app.get("/api/vapidPublicKey", (req, res) => {
  res.send(vapidKeys.publicKey);
});

app.post("/api/subscribe", (req, res) => {
  const subscription = req.body;
  if (subscription && subscription.endpoint) {
    if (!subscriptions.find(s => s.endpoint === subscription.endpoint)) {
      subscriptions.push(subscription);
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions));
    }
  }
  res.status(201).json({});
});

// Polling background logic to send push when new result arrives
let previousResultHash = "";

setInterval(async () => {
  // Vietnam is UTC+7. XSMB draw is 18:15 - 18:35.
  const now = new Date();
  const vnHour = (now.getUTCHours() + 7) % 24;
  
  // Poll between 18:00 and 19:00 Vietnam time
  if (vnHour === 18) {
    try {
      const data = await scrapeKqxsVn();
      if (data) {
        // Collect all non-empty results across all prizes
        let numCount = 0;
        let dbStr = "";
        if (data.dac_biet.length > 0) dbStr = data.dac_biet[0];
        for (let i = 1; i <= 7; i++) {
          numCount += data[`giai_${i}`].length;
        }
        
        const currentHash = `db:${dbStr}-total:${numCount}`;
        
        if (previousResultHash && currentHash !== previousResultHash) {
          // Send push notification about new result
          const payload = JSON.stringify({
            title: "Kết quả XSMB có cập nhật mới!",
            body: `Cập nhật kết quả mới. Đặc biệt: ${dbStr || 'Chưa có'}. Đang có ${numCount} lô đã ra.`,
            icon: "/vite.svg"
          });
          
          subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
              console.error("Push Error", err);
              // potentially remove dead subscription
            });
          });
        }
        previousResultHash = currentHash;
      }
    } catch (e) {
      console.error("Background polling error:", e);
    }
  }
}, 30000);

// --- Scraper Logic for North Vietnam Lottery (XSMB) ---

async function scrapeXskt(dateStr?: string) {
  // xskt.com.vn format for date: https://xskt.com.vn/xsmb/ngay-29-4-2026
  let url = "https://xskt.com.vn/xsmb";
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      url = `https://xskt.com.vn/xsmb/ngay-${parseInt(parts[2])}-${parseInt(parts[1])}-${parts[0]}`;
    }
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    const kqxs: any = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };

    const container = $("#MB0");
    if (container.length === 0) return null;
    
    let timeTitle = container.find(".dockq").attr("title");
    kqxs.time = timeTitle ? timeTitle.replace("Đọc kết quả ", "") : container.find("th").first().text().trim();

    container.find("tr").each((_, tr) => {
      let labelTd = $(tr).find('td[title^="Giải"]');
      if (labelTd.length > 0) {
        let label = labelTd.attr('title').toLowerCase();
        
        let valTd = labelTd.next('td');
        // replace <br> with space to properly extract numbers
        valTd.find('br').replaceWith(' ');
        
        let numbersRaw = valTd.text().trim();
        let numbers = numbersRaw.split(/\s+/).filter(Boolean);
        
        if (label === "giải đb" || label.includes("đb")) kqxs.dac_biet.push(...numbers);
        else if (label.includes("nhất") || label.includes("g1")) kqxs.giai_1.push(...numbers);
        else if (label.includes("nhì") || label.includes("g2")) kqxs.giai_2.push(...numbers);
        else if (label.includes("ba") || label.includes("g3")) kqxs.giai_3.push(...numbers);
        else if (label.includes("tư") || label.includes("g4")) kqxs.giai_4.push(...numbers);
        else if (label.includes("năm") || label.includes("năm") || label.includes("g5")) kqxs.giai_5.push(...numbers);
        else if (label.includes("sáu") || label.includes("g6")) kqxs.giai_6.push(...numbers);
        else if (label.includes("bảy") || label.includes("g7")) kqxs.giai_7.push(...numbers);
      }
    });

    return kqxs;
  } catch (error) {
    console.error("Error scraping xskt.com.vn:", error);
    return null;
  }
}

async function scrapeXosoComVn(dateStr?: string) {
  // xoso.com.vn format for date: https://xoso.com.vn/xsmb-29-04-2026.html
  let url = "https://xoso.com.vn/xo-so-mien-bac/xsmb-p1.html";
  if (dateStr) {
    url = `https://xoso.com.vn/xsmb-${dateStr}.html`;
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    const kqxs: any = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };

    // Find the current result table
    const container = $(".table-result").first();
    kqxs.time = $("h1").first().text().trim() || "Kết Quả Xổ Số";

    // Mapping prize rows
    container.find("tr").each((_, tr) => {
      let label = $(tr).find("th").first().text().trim().toLowerCase();
      if (!label) label = $(tr).find("td").first().text().trim().toLowerCase();

      const numbers = $(tr).find("td").last().text().trim().split(/\s+/).filter(Boolean);
      
      if (label === "đặc biệt" || label === "đb" || label.includes("đb") || label.includes("đặc biệt")) kqxs.dac_biet.push(...numbers);
      else if (label === "giải nhất" || label === "1" || label.includes("giải nhất")) kqxs.giai_1.push(...numbers);
      else if (label === "giải nhì" || label === "2" || label.includes("giải nhì")) kqxs.giai_2.push(...numbers);
      else if (label === "giải ba" || label === "3" || label.includes("giải ba")) kqxs.giai_3.push(...numbers);
      else if (label === "giải tư" || label === "4" || label.includes("giải tư")) kqxs.giai_4.push(...numbers);
      else if (label === "giải năm" || label === "5" || label.includes("giải năm")) kqxs.giai_5.push(...numbers);
      else if (label === "giải sáu" || label === "6" || label.includes("giải sáu")) kqxs.giai_6.push(...numbers);
      else if (label === "giải bảy" || label === "7" || label.includes("giải bảy")) kqxs.giai_7.push(...numbers);
    });

    // Fallback if table structure is different (some pages use classes directly)
    if (kqxs.dac_biet.length === 0) {
      container.find(".db, .v-gdb").each((_, el) => kqxs.dac_biet.push($(el).text().trim()));
      container.find(".g1, .v-g1").each((_, el) => kqxs.giai_1.push($(el).text().trim()));
      container.find(".g2, .v-g2").each((_, el) => kqxs.giai_2.push($(el).text().trim()));
      container.find(".g3, .v-g3").each((_, el) => kqxs.giai_3.push($(el).text().trim()));
      container.find(".g4, .v-g4").each((_, el) => kqxs.giai_4.push($(el).text().trim()));
      container.find(".g5, .v-g5").each((_, el) => kqxs.giai_5.push($(el).text().trim()));
      container.find(".g6, .v-g6").each((_, el) => kqxs.giai_6.push($(el).text().trim()));
      container.find(".g7, .v-g7").each((_, el) => kqxs.giai_7.push($(el).text().trim()));
    }

    return kqxs;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`404 error fetching from xoso.com.vn: ${url}`);
    } else {
      console.error("Error scraping xoso.com.vn:", error);
    }
    return null;
  }
}

async function scrapeKqxsVn(dateStr?: string) {
  // kqxs.vn format for date: https://kqxs.vn/mien-bac/29-04-2026 (although invalid dates redirect to today)
  let url = "https://kqxs.vn/mien-bac";
  if (dateStr) {
    url = `https://kqxs.vn/mien-bac/${dateStr}.html`;
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    const kqxs: any = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };

    const tbl = $(".table-result-lottery").first();
    if (tbl.length === 0) return null;
    
    kqxs.time = tbl.find('caption').text().trim() || "Kết quả xổ số";
    
    tbl.find("tr").each((_, tr) => {
        const label = $(tr).find("td").first().text().trim().toLowerCase();
        let numbers: string[] = [];
        $(tr).find("td:not(:first-child)").each((_, vTd) => {
            let numStr = $(vTd).text().trim();
            let spans = $(vTd).find('span');
            if (spans.length > 0) {
              spans.each((_, span) => {
                  let ns = $(span).text().trim();
                  numbers.push(...ns.split(/[-,\s\.]+/).filter(Boolean));
              });
            } else if (numStr) {
                 numbers.push(...numStr.split(/[-,\s\.]+/).filter(Boolean));
            }
        });
        
        if (label === "đặc biệt" || label === "đb" || label.includes("đb") || label.includes("đặc biệt")) kqxs.dac_biet.push(...numbers);
        else if (label === "giải nhất" || label === "1" || label.includes("giải nhất")) kqxs.giai_1.push(...numbers);
        else if (label === "giải nhì" || label === "2" || label.includes("giải nhì")) kqxs.giai_2.push(...numbers);
        else if (label === "giải ba" || label === "3" || label.includes("giải ba")) kqxs.giai_3.push(...numbers);
        else if (label === "giải tư" || label === "4" || label.includes("giải tư")) kqxs.giai_4.push(...numbers);
        else if (label === "giải năm" || label === "5" || label.includes("giải năm")) kqxs.giai_5.push(...numbers);
        else if (label === "giải sáu" || label === "6" || label.includes("giải sáu")) kqxs.giai_6.push(...numbers);
        else if (label === "giải bảy" || label === "7" || label.includes("giải bảy")) kqxs.giai_7.push(...numbers);
    });

    // Final validation: if we have NO numbers at all, return null to trigger error
    if (kqxs.dac_biet.length === 0 && kqxs.giai_1.length === 0) return null;

    return kqxs;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`404 error fetching from kqxs.vn: ${url}`);
    } else {
      console.error("Error scraping kqxs.vn:", error);
    }
    return null;
  }
}

async function scrapeMinhNgoc(dateStr?: string) {
  let url = "https://www.minhngoc.net.vn/ket-qua-xo-so/mien-bac.html";
  if (dateStr) {
    // format expected: DD-MM-YYYY
    url = `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-bac/${dateStr}.html`;
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    const kqxs: any = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };

    // Extract time
    let timeText = $(".ngay").first().text().trim();
    if (!timeText) {
      timeText = $(".title-kq-mien").text().trim();
    }
    if (timeText.includes("Ký hiệu")) {
      timeText = timeText.split("Ký hiệu")[0].trim();
    }
    kqxs.time = timeText;
    
    // Giai Dac Biet
    const dbEl = $(".giaidb").first().find('div');
    if (dbEl.length > 0) {
      dbEl.each((_, el) => {
        const text = $(el).text().trim();
        if (text) kqxs.dac_biet.push(text);
      });
    } else {
      const dbText = $(".giaidb").first().text().trim();
      if (dbText) kqxs.dac_biet.push(dbText);
    }

    // Other prizes
    for (let i = 1; i <= 7; i++) {
        const giaiEl = $(`.giai${i}`).first().find('div');
        if (giaiEl.length > 0) {
          giaiEl.each((_, el) => {
            let text = $(el).text().trim();
            if (text) {
              kqxs[`giai_${i}`].push(...text.split(/\s+|-/).filter(Boolean));
            }
          });
        } else {
          let text = $(`.giai${i}`).first().text().trim();
          if (text) {
            kqxs[`giai_${i}`].push(...text.split(/\s+|-/).filter(Boolean));
          }
        }
    }

    return kqxs;
  } catch (error) {
    console.error("Error scraping minhngoc.net:", error);
    return null;
  }
}

// --- API Routes ---

const fetchLotteryFromSource = async (source: any, normalizedDate?: string, originalDate?: string) => {
  try {
    if (source === "minhngoc") {
      return await scrapeMinhNgoc(normalizedDate);
    } else if (source === "xosocomvn") {
      return await scrapeXosoComVn(normalizedDate);
    } else if (source === "xskt") {
      return await scrapeXskt(originalDate); 
    } else {
      return await scrapeKqxsVn(normalizedDate);
    }
  } catch (err) {
    console.error(`Error in fetchLotteryFromSource for ${source}:`, err);
    return null;
  }
};

app.get("/api/lottery", async (req, res) => {
  const preferredSource = (req.query.source as string) || "kqxsvn";
  const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
  
  // Normalize dateStr from YYYY-MM-DD to DD-MM-YYYY for most providers
  let normalizedDate = dateStr;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    normalizedDate = `${d}-${m}-${y}`;
  }

  let data = await fetchLotteryFromSource(preferredSource, normalizedDate, dateStr);
  
  if (data) {
    data.source_used = preferredSource;
  }
  
  if (!data) {
    // try fallbacks if preferred source fails
    const fallbacks = ["minhngoc", "xskt", "kqxsvn", "xosocomvn"].filter(s => s !== preferredSource);
    for (const source of fallbacks) {
      data = await fetchLotteryFromSource(source, normalizedDate, dateStr);
      if (data) {
        data.source_used = source;
        break;
      }
    }
  }
  
  if (!data) {
    return res.status(404).json({ error: "Không tìm thấy kết quả cho ngày này hoặc tất cả các nguồn dữ liệu đang bận. Vui lòng thử lại sau hoặc chọn nguồn khác." });
  }

  // Pre-process winning numbers
  const lo_2so: string[] = [];
  Object.keys(data).forEach(key => {
    if (Array.isArray(data[key])) {
      data[key].forEach((num: string) => {
        if (num && typeof num === 'string' && num.length >= 2) {
          lo_2so.push(num.slice(-2));
        }
      });
    }
  });

  res.json({ 
    ...data, 
    lo_2so, 
    de_2so: data.dac_biet && data.dac_biet[0]?.slice(-2) ? [data.dac_biet[0].slice(-2)] : [] 
  });
});

app.post("/api/calculate", async (req, res) => {
  try {
    const { data: userData, lottery: kqxs, rates } = req.body;
    
    const lo_2so = kqxs.lo_2so || [];
    const de_2so = kqxs.de_2so || [];
    
    const danh_sach = userData.danh_sach || (userData.khach_hang ? [userData] : []);
    const danh_sach_khach: any[] = [];
    
    danh_sach.forEach((khach: any) => {
      let tong_tien_thang = 0;
      const chi_tiet_ket_qua: any[] = [];
      
      const chi_tiet = khach.chi_tiet || khach.chi_detail || [];
      chi_tiet.forEach((item: any) => {
        const loai = (item.loai || "").toLowerCase();
        const ds_so = Array.isArray(item.so) ? item.so : (item.so ? [item.so] : []);
        
        if (loai === "lo") {
          ds_so.forEach((so: string) => {
            const nhay = lo_2so.filter((s: string) => s === so).length;
            const isWin = nhay > 0;
            const tien_thang = isWin ? (item.diem || 0) * (rates.lo || 80000) * nhay : 0;
            if (isWin) tong_tien_thang += tien_thang;
            chi_tiet_ket_qua.push({ loai: "Lô", so, nhay, tien_thang, isWin });
          });
        } else if (loai === "de") {
          ds_so.forEach((so: string) => {
            const isWin = de_2so.includes(so);
            const tien_thang = isWin ? (item.tien_cuoc || 0) * (rates.de || 70) : 0;
            if (isWin) tong_tien_thang += tien_thang;
            chi_tiet_ket_qua.push({ loai: "Đề", so, tien_thang, isWin });
          });
        } else if (loai.startsWith("xien")) {
          const isWin = ds_so.length > 0 && ds_so.every((s: string) => lo_2so.includes(s));
          const len = ds_so.length;
          const rate = rates[`xien${len}`] || rates.xien2 || 10;
          const tien_thang = isWin ? (item.tien_cuoc || 0) * rate : 0;
          if (isWin) tong_tien_thang += tien_thang;
          chi_tiet_ket_qua.push({ loai: `Xiên ${len}`, so: ds_so.join("-"), tien_thang, isWin });
        }
      });
      
      danh_sach_khach.push({
        khach_hang: khach.khach_hang || "Không tên",
        chi_tiet_ket_qua,
        tong_tien_thang,
        loi_nhuan: tong_tien_thang - (khach.tong_tien_xac || 0),
        tong_tien_xac: khach.tong_tien_xac || 0
      });
    });
    
    res.json({
      danh_sach: danh_sach_khach,
      tong_tien_thang: danh_sach_khach.reduce((sum, k) => sum + k.tong_tien_thang, 0),
      loi_nhuan: danh_sach_khach.reduce((sum, k) => sum + k.loi_nhuan, 0),
      tong_tien_xac: danh_sach_khach.reduce((sum, k) => sum + k.tong_tien_xac, 0)
    });
  } catch (error) {
    console.error("Calculate Error:", error);
    res.status(500).json({ error: "Lỗi trong quá trình tính toán" });
  }
});

// --- Vite and Production setup ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
