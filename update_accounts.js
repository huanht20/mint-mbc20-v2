import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACCOUNTS_FILE = `${__dirname}/moltbook_accounts.json`;

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
 * Cập nhật các field mới cho tất cả accounts
 */
async function updateAccounts() {
  try {
    const accounts = await loadAccounts();
    
    if (accounts.length === 0) {
      console.log('✖ Không có tài khoản nào trong file!');
      return;
    }

    console.log(`\nTìm thấy ${accounts.length} tài khoản`);
    console.log('Đang cập nhật các field mới...\n');

    let updatedCount = 0;

    accounts.forEach((account, index) => {
      let updated = false;
      
      // Thêm using_proxy nếu chưa có
      if (account.using_proxy === undefined) {
        account.using_proxy = 0;
        updated = true;
      }
      
      // Thêm proxy nếu chưa có
      if (account.proxy === undefined) {
        account.proxy = null;
        updated = true;
      }
      
      if (updated) {
        updatedCount++;
        console.log(`  ✓ Đã cập nhật: ${account.name}`);
      } else {
        console.log(`  - Đã có đầy đủ: ${account.name}`);
      }
    });

    if (updatedCount > 0) {
      await saveAccounts(accounts);
      console.log(`\n✓ Hoàn tất! Đã cập nhật ${updatedCount}/${accounts.length} tài khoản.`);
    } else {
      console.log(`\n✓ Tất cả tài khoản đã có đầy đủ các field mới.`);
    }

  } catch (error) {
    console.error('\n✖ Lỗi:', error.message);
    process.exit(1);
  }
}

// Chạy script
updateAccounts();

