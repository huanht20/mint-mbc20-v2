import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import { mint_data } from './config.js';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACCOUNTS_FILE = `${__dirname}/moltbook_accounts.json`;
const POST_API_URL = 'https://www.moltbook.com/api/v1/posts';
const INDEX_POST_API_URL = 'https://mbc20.xyz/api/index-post';

/**
 * Tạo 10 ký tự ngẫu nhiên gồm số và chữ
 */
function generateRandomCharacters() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 10; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

/**
 * Tạo nội dung post với ký tự random mới mỗi lần
 */
function getPostContent() {
  return `${mint_data}
${generateRandomCharacters()}`;
}


/**
 * Đọc danh sách tài khoản từ file JSON
 */
async function loadAccounts() {
  try {
    if (existsSync(ACCOUNTS_FILE)) {
      const data = await readFile(ACCOUNTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading accounts:', error.message);
    return [];
  }
}

/**
 * Lưu danh sách tài khoản vào file JSON
 */
async function saveAccounts(accounts) {
  try {
    await writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving accounts:', error.message);
    throw error;
  }
}

/**
 * Hỏi input từ console
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Tạo fetch options với proxy nếu cần
 */
function getFetchOptions(account) {
  const options = {};
  
  if (account.using_proxy === 1 && account.proxy) {
    const proxyAgent = new HttpsProxyAgent(account.proxy);
    options.agent = proxyAgent;
  }
  
  return options;
}

/**
 * Tạo post trên Moltbook
 */
async function createPost(apiKey, account) {
  try {
    const title = `MBC-20 Mint: CLAW ${generateRandomCharacters()}`;
    const content = getPostContent();
    
    const body = {
      submolt: "general",
      title: title,
      content: content
    };
    
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      ...getFetchOptions(account)
    };
    
    const response = await fetch(POST_API_URL, fetchOptions);

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    throw new Error(`Post failed: ${error.message}`);
  }
}

/**
 * Delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Index post sau khi đã post thành công
 */
async function indexPost(postId, account) {
  try {
    const fetchOptions = {
      ...getFetchOptions(account)
    };
    
    const response = await fetch(`${INDEX_POST_API_URL}?id=${postId}`, fetchOptions);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(`Index post failed: ${error.message}`);
  }
}

/**
 * Post cho tất cả accounts
 */
async function postToAllAccounts(accounts, iteration = 1) {
  const results = [];
  let successCount = 0;
  let failCount = 0;

  if (iteration > 1) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Lần mint thứ ${iteration}`);
    console.log(`${'='.repeat(50)}`);
  }

  // Post từng tài khoản
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    
    // Bỏ qua account có status = 0
    if (account.status === 0) {
      console.log(`[${i + 1}/${accounts.length}] Bỏ qua ${account.name} (status = 0)`);
      continue;
    }
    
    // Kiểm tra delay - nếu chưa đủ thời gian thì bỏ qua
    const delayMinutes = account.delay !== undefined ? account.delay : 120; // Mặc định 120 phút
    const delaySeconds = delayMinutes * 60; // Chuyển từ phút sang giây
    const currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp hiện tại (giây)
    const lastPost = account.last_post || 0;
    
    if (lastPost > 0) {
      const timeSinceLastPost = currentTimestamp - lastPost;
      if (timeSinceLastPost < delaySeconds) {
        const remainingMinutes = Math.ceil((delaySeconds - timeSinceLastPost) / 60);
        console.log(`[${i + 1}/${accounts.length}] Bỏ qua ${account.name} (chưa đủ delay, còn ${remainingMinutes} phút)`);
        continue;
      }
    }
    
    console.log(`[${i + 1}/${accounts.length}] Posting với ${account.name}...`);

    try {
      const result = await createPost(account.api_key, account);
      const postId = result.post?.id;
      
      results.push({
        account: account.name,
        success: true,
        post_id: postId,
        post_url: result.post?.url,
        verification_required: result.verification_required
      });
      successCount++;
      console.log(`  ✓ Thành công! Post ID: ${postId}`);
      if (result.verification_required) {
        console.log(`  ⚠ Cần verification để publish`);
      }
      
      // Cập nhật last_post nếu có postId
      if (postId) {
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (giây)
        account.last_post = timestamp;
        
        // Tìm và cập nhật account trong accounts array
        const accountIndex = accounts.findIndex(acc => acc.name === account.name);
        if (accountIndex >= 0) {
          accounts[accountIndex].last_post = timestamp;
          // Lưu lại file JSON
          await saveAccounts(accounts);
          console.log(`  ✓ Đã cập nhật last_post: ${timestamp}`);
        }
        
        // Đợi 5 giây rồi index post
        console.log(`  ⏳ Waiting for index...`);
        await delay(5000);
        
        try {
          const indexResult = await indexPost(postId, account);
          console.log(`  ✓ Đã index post! Processed: ${indexResult.processed}`);
        } catch (indexError) {
          console.log(`  ⚠ Lỗi khi index post: ${indexError.message}`);
        }
      }
    } catch (error) {
      results.push({
        account: account.name,
        success: false,
        error: error.message
      });
      failCount++;
      console.log(`  ✖ Lỗi: ${error.message}`);
    }

    // Delay giữa các request để tránh rate limit
    if (i < accounts.length - 1) {
      await delay(1000); // 1 giây delay
    }
  }

  // Tính số account active (không tính account có status = 0)
  const activeAccountsCount = accounts.filter(acc => acc.status !== 0).length;
  
  // Tổng kết
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tổng kết lần ${iteration}:`);
  console.log(`  ✓ Thành công: ${successCount}/${activeAccountsCount}`);
  console.log(`  ✖ Thất bại: ${failCount}/${activeAccountsCount}`);
  console.log(`${'='.repeat(50)}\n`);

  return { results, successCount, failCount };
}

/**
 * Main function
 */
async function main() {
  try {
    // Đọc tham số từ CLI (số phút lặp lại)
    const repeatMinutes = process.argv[2] ? parseFloat(process.argv[2]) : null;

    // Đọc danh sách tài khoản
    const accounts = await loadAccounts();
    
    if (accounts.length === 0) {
      console.error('✖ Không có tài khoản nào trong file!');
      console.error(`  Hãy chạy: node register_moltbook.js để đăng ký tài khoản trước.`);
      process.exit(1);
    }

    // Lọc các account active (status !== 0)
    const activeAccounts = accounts.filter(acc => acc.status !== 0);
    const inactiveCount = accounts.length - activeAccounts.length;
    
    console.log(`\nTìm thấy ${accounts.length} tài khoản:`);
    accounts.forEach((acc, index) => {
      const statusText = acc.status === 0 ? ' (status = 0 - bỏ qua)' : '';
      console.log(`  ${index + 1}. ${acc.name}${statusText}`);
    });
    
    if (inactiveCount > 0) {
      console.log(`\n⚠ ${inactiveCount} tài khoản sẽ bị bỏ qua (status = 0)`);
    }
    console.log(`✓ ${activeAccounts.length} tài khoản sẽ được post`);


    if (repeatMinutes && repeatMinutes > 0) {
      const repeatMs = repeatMinutes * 60 * 1000; // Chuyển phút sang milliseconds
      console.log(`\nChế độ lặp lại: Mỗi ${repeatMinutes} phút`);
      console.log(`Nhấn Ctrl+C để dừng\n`);

      let iteration = 1;
      let totalSuccess = 0;
      let totalFail = 0;

      // Vòng lặp vô hạn
      while (true) {
        const { successCount, failCount } = await postToAllAccounts(accounts, iteration);
        totalSuccess += successCount;
        totalFail += failCount;

        // Tính thời gian chờ đến lần tiếp theo
        const nextTime = new Date(Date.now() + repeatMs);
        console.log(`Chờ đến ${nextTime.toLocaleTimeString()} để mint tiếp...`);
        console.log(`Tổng cộng: ✓ ${totalSuccess} thành công, ✖ ${totalFail} thất bại\n`);

        // Delay trước lần mint tiếp theo
        await delay(repeatMs);
        iteration++;
      }
    } else {
      // Chạy 1 lần như bình thường
      const activeAccounts = accounts.filter(acc => acc.status !== 0);
      console.log(`\nĐang post cho ${activeAccounts.length} tài khoản...\n`);
      await postToAllAccounts(accounts, 1);
    }

  } catch (error) {
    if (error.message.includes('SIGINT') || error.message.includes('SIGTERM')) {
      console.log('\n\nĐã dừng mint.');
      process.exit(0);
    }
    console.error('\n✖ Lỗi:', error.message);
    process.exit(1);
  }
}

// Xử lý Ctrl+C để dừng gracefully
process.on('SIGINT', () => {
  console.log('\n\nĐang dừng...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nĐang dừng...');
  process.exit(0);
});

// Chạy script
main();

