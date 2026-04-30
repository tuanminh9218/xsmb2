const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeXsktComVn(dateStr) {
  let url = "https://xskt.com.vn/xsmb";
  if (dateStr) {
    url = `https://xskt.com.vn/xsmb/ngay-${dateStr}`;
  }
  
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    console.log("html length:", data.length);
    console.log("table kqxs:", $('.box-ketqua').length);
    
    const kqxs = {
      dac_biet: [], giai_1: [], giai_2: [], giai_3: [],
      giai_4: [], giai_5: [], giai_6: [], giai_7: [],
      time: ""
    };

    // Find the current result table
    const container = $("#MB0");
    if (container.length === 0) {
        console.log("Found no MB0");
    } else {
        console.log("Found MB0");
    }
    
    kqxs.time = container.find("h2").text().trim() || container.closest('.box').find('.title-phu a').first().text().trim();

    container.find("table tr").each((_, tr) => {
      const gName = $(tr).find(".txt-giai").text().trim().toLowerCase();
      const numbers = $(tr).find(".v-giai").text().trim().split(/\s+/).filter(Boolean);
      
      console.log(gName, numbers);
      
      if (gName.includes("đb")) kqxs.dac_biet.push(...numbers);
      else if (gName.includes("g1")) kqxs.giai_1.push(...numbers);
      else if (gName.includes("g2")) kqxs.giai_2.push(...numbers);
      else if (gName.includes("g3")) kqxs.giai_3.push(...numbers);
      else if (gName.includes("g4")) kqxs.giai_4.push(...numbers);
      else if (gName.includes("g5")) kqxs.giai_5.push(...numbers);
      else if (gName.includes("g6")) kqxs.giai_6.push(...numbers);
      else if (gName.includes("g7")) kqxs.giai_7.push(...numbers);
    });

    console.log(kqxs);
    return kqxs;
  } catch (error) {
    console.error("Error scraping xskt.com.vn:", error.message);
    return null;
  }
}

scrapeXsktComVn("29-4-2026");
