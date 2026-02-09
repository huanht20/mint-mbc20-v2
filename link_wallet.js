import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACCOUNTS_FILE = `${__dirname}/moltbook_accounts.json`;
const POST_API_URL = 'https://www.moltbook.com/api/v1/posts';
const INDEX_POST_API_URL = 'https://mbc20.xyz/api/index-post';

// Wallet address - biến được khai báo
let WALLET_ADDRESS = '';

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
 * Tạo nội dung post link wallet
 */
function createLinkContent(wallet) {
  const linkData = {
    p: "mbc-20",
    op: "link",
    wallet: wallet
  };
  
  return `${JSON.stringify(linkData)}\n\nmbc20.xyz`;
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
 * Tạo post link wallet trên Moltbook
 */
async function createLinkPost(apiKey, wallet, account) {
  try {
    const content = createLinkContent(wallet);
    const title = `Link wallet ${generateRandomCharacters()}`;

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submolt: "general",
        title: title,
        content: content
      }),
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
 * Main function
 */
async function main() {
  try {
    // Đọc danh sách tài khoản
    const allAccounts = await loadAccounts();
    
    if (allAccounts.length === 0) {
      console.error('✖ Không có tài khoản nào trong file!');
      console.error(`  Hãy chạy: node register_moltbook.js để đăng ký tài khoản trước.`);
      process.exit(1);
    }

    // Lọc chỉ lấy các account đủ điều kiện post:
    // 1. wallet_link là null (chưa link)
    // 2. status !== 0 (account đang bật)
    // 3. Đủ delay (nếu có last_post)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const accounts = allAccounts.filter(acc => {
      // Bỏ qua nếu đã link wallet
      if (acc.wallet_link !== null && acc.wallet_link !== undefined) {
        return false;
      }
      
      // Bỏ qua nếu status = 0
      if (acc.status === 0) {
        return false;
      }
      
      // Kiểm tra delay nếu có last_post
      const lastPost = acc.last_post || 0;
      if (lastPost > 0) {
        const delayMinutes = acc.delay !== undefined ? acc.delay : 120;
        const delaySeconds = delayMinutes * 60;
        const timeSinceLastPost = currentTimestamp - lastPost;
        if (timeSinceLastPost < delaySeconds) {
          return false; // Chưa đủ delay
        }
      }
      
      return true;
    });
    
    if (accounts.length === 0) {
      console.error('✖ Không có tài khoản nào đủ điều kiện để link wallet!');
      console.error(`  Các tài khoản có thể đã link wallet, bị tắt (status = 0), hoặc chưa đủ delay.`);
      process.exit(1);
    }

    // Hiển thị danh sách tài khoản đủ điều kiện
    console.log(`\nDanh sách tài khoản đủ điều kiện link wallet (${accounts.length}/${allAccounts.length}):`);
    accounts.forEach((acc, index) => {
      console.log(`  ${index + 1}. ${acc.name}`);
    });

    // Hỏi user chọn account
    const accountInput = await askQuestion(`\nChọn account để link (nhập số 1-${accounts.length}, hoặc 'all' để chọn tất cả): `);
    
    let selectedAccounts = [];
    
    if (accountInput.trim().toLowerCase() === 'all') {
      selectedAccounts = accounts;
      console.log(`\nĐã chọn tất cả ${accounts.length} account(s)`);
    } else {
      const accountIndex = parseInt(accountInput.trim()) - 1;
      if (isNaN(accountIndex) || accountIndex < 0 || accountIndex >= accounts.length) {
        console.error('✖ Lựa chọn không hợp lệ!');
        process.exit(1);
      }
      selectedAccounts = [accounts[accountIndex]];
      console.log(`\nĐã chọn account: ${accounts[accountIndex].name}`);
    }

    // Hỏi wallet address
    const walletInput = await askQuestion('\nNhập wallet address để link với agent: ');
    const wallet = walletInput.trim();
    
    if (!wallet || wallet === '') {
      console.error('✖ Wallet address không được để trống!');
      process.exit(1);
    }

    // Validate wallet format (basic check - starts with 0x and has 42 chars)
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      console.error('✖ Wallet address không đúng format! (phải bắt đầu với 0x và có 42 ký tự)');
      process.exit(1);
    }

    WALLET_ADDRESS = wallet;

    console.log(`\nWallet address: ${WALLET_ADDRESS}`);
    console.log(`\nNội dung sẽ được post:`);
    console.log(createLinkContent(WALLET_ADDRESS));
    console.log(`\nĐang post cho ${selectedAccounts.length} account(s)...\n`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Post từng tài khoản
    for (let i = 0; i < selectedAccounts.length; i++) {
      const account = selectedAccounts[i];
      
      // Kiểm tra delay - nếu chưa đủ thời gian thì bỏ qua
      const delayMinutes = account.delay !== undefined ? account.delay : 120; // Mặc định 120 phút
      const delaySeconds = delayMinutes * 60; // Chuyển từ phút sang giây
      const currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp hiện tại (giây)
      const lastPost = account.last_post || 0;
      
      if (lastPost > 0) {
        const timeSinceLastPost = currentTimestamp - lastPost;
        if (timeSinceLastPost < delaySeconds) {
          const remainingMinutes = Math.ceil((delaySeconds - timeSinceLastPost) / 60);
          console.log(`[${i + 1}/${selectedAccounts.length}] Bỏ qua ${account.name} (chưa đủ delay, còn ${remainingMinutes} phút)`);
          continue;
        }
      }
      
      console.log(`[${i + 1}/${selectedAccounts.length}] Posting với ${account.name}...`);

      try {
        const result = await createLinkPost(account.api_key, WALLET_ADDRESS, account);
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
        
        // Cập nhật wallet_link và last_post trong allAccounts nếu post thành công
        if (postId) {
          const accountIndex = allAccounts.findIndex(acc => acc.name === account.name);
          if (accountIndex >= 0) {
            const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (giây)
            allAccounts[accountIndex].wallet_link = WALLET_ADDRESS;
            allAccounts[accountIndex].last_post = timestamp;
            // Lưu lại file JSON
            await saveAccounts(allAccounts);
            console.log(`  ✓ Đã cập nhật wallet_link: ${WALLET_ADDRESS}`);
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
      if (i < selectedAccounts.length - 1) {
        await delay(1000); // 1 giây delay
      }
    }

    // Tổng kết
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Tổng kết:`);
    console.log(`  ✓ Thành công: ${successCount}/${selectedAccounts.length}`);
    console.log(`  ✖ Thất bại: ${failCount}/${selectedAccounts.length}`);
    console.log(`${'='.repeat(50)}\n`);

    // Hiển thị chi tiết kết quả
    if (results.length > 0) {
      console.log('Chi tiết kết quả:');
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✓ ${result.account}: ${result.post_id || 'N/A'}`);
        } else {
          console.log(`  ✖ ${result.account}: ${result.error}`);
        }
      });
    }

    console.log(`\nLưu ý: Post này sẽ cho phép wallet owner claim mbc-20 token balances as ERC-20 tokens on Base.`);

  } catch (error) {
    console.error('\n✖ Lỗi:', error.message);
    process.exit(1);
  }
}

// Chạy script
main();

