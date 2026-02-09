import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACCOUNTS_FILE = `${__dirname}/moltbook_accounts.json`;
const API_URL = 'https://www.moltbook.com/api/v1/agents/register';

// Cấu hình proxy cho register (có thể sửa trực tiếp ở đây)
const USING_PROXY = 0; // 0 = không dùng proxy, 1 = dùng proxy
const PROXY = null; // Ví dụ: "http://127.0.0.1:8080" hoặc "https://proxy-url:port"

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
    console.log(`✓ Saved ${accounts.length} account(s) to ${ACCOUNTS_FILE}`);
  } catch (error) {
    console.error('Error saving accounts:', error.message);
    throw error;
  }
}

/**
 * Tạo fetch options với proxy nếu cần
 */
function getFetchOptions() {
  const options = {};
  
  if (USING_PROXY === 1 && PROXY) {
    const proxyAgent = new HttpsProxyAgent(PROXY);
    options.agent = proxyAgent;
  }
  
  return options;
}

/**
 * Đăng ký tài khoản Moltbook mới
 */
async function registerMoltbookAccount(name, description = null) {
  try {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        description: description || `${name}'s AI agent on Moltbook`
      }),
      ...getFetchOptions()
    };
    
    const response = await fetch(API_URL, fetchOptions);

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }

    return {
      name: data.agent.name,
      api_key: data.agent.api_key,
      link_claim: data.agent.claim_url,
      status: 1,
      last_post: 0,
      wallet_link: null,
      delay: 120,
      using_proxy: 0,
      proxy: null
    };
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`);
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
 * Main function
 */
async function main() {
  try {
    // Hỏi tên agent từ console
    const agentName = await askQuestion('Nhập tên agent Moltbook: ');
    
    if (!agentName || agentName.trim() === '') {
      console.error('✖ Tên agent không được để trống!');
      process.exit(1);
    }

    console.log(`\nĐang đăng ký agent: ${agentName}...`);
    
    // Đăng ký tài khoản mới (không có mô tả)
    const newAccount = await registerMoltbookAccount(agentName.trim(), null);
    
    console.log('\n✓ Đăng ký thành công!');
    console.log(`  Tên: ${newAccount.name}`);
    console.log(`  API Key: ${newAccount.api_key}`);
    console.log(`  Link Claim: ${newAccount.link_claim}`);
    
    // Đọc danh sách tài khoản hiện có
    const accounts = await loadAccounts();
    
    // Kiểm tra xem tài khoản đã tồn tại chưa (theo tên)
    const existingIndex = accounts.findIndex(acc => acc.name === newAccount.name);
    
    if (existingIndex >= 0) {
      // Cập nhật tài khoản đã tồn tại (giữ nguyên status, last_post, wallet_link và delay nếu đã có)
      const existingAccount = accounts[existingIndex];
      accounts[existingIndex] = {
        ...newAccount,
        status: existingAccount.status !== undefined ? existingAccount.status : 1,
        last_post: existingAccount.last_post !== undefined ? existingAccount.last_post : 0,
        wallet_link: existingAccount.wallet_link !== undefined ? existingAccount.wallet_link : null,
        delay: existingAccount.delay !== undefined ? existingAccount.delay : 120
      };
      console.log(`  Đã cập nhật tài khoản: ${newAccount.name}`);
    } else {
      // Thêm tài khoản mới
      accounts.push(newAccount);
      console.log(`  Đã thêm tài khoản mới: ${newAccount.name}`);
    }
    
    // Lưu vào file JSON
    await saveAccounts(accounts);
    
    console.log('\n✓ Hoàn tất!');
    
  } catch (error) {
    console.error('\n✖ Lỗi:', error.message);
    process.exit(1);
  }
}

// Chạy script
main();

