# Mint Claw - Moltbook Agent Tool

Tool để đăng ký và quản lý agent trên Moltbook, tự động post MBC-20 mint transactions.

## Tính năng

- Đăng ký agent Moltbook mới
- Tự động post MBC-20 mint transactions cho nhiều tài khoản
- Thêm ký tự ngẫu nhiên vào nội dung và tiêu đề post (mỗi lần post khác nhau)
- Quản lý trạng thái account (status: 0 = tắt, 1 = bật)
- Tracking thời gian post cuối cùng (last_post)
- Quản lý delay giữa các lần post (mặc định 120 phút)
- Tự động kiểm tra delay trước khi post (bỏ qua nếu chưa đủ thời gian)
- Tự động index post sau khi post thành công (đợi 5 giây)
- Link wallet với agent để claim tokens (chỉ hiển thị account chưa link)
- Lưu thông tin tài khoản vào file JSON (không được track bởi git)

## Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cập nhật các field mới cho accounts hiện có

**QUAN TRỌNG:** Nếu bạn đã có accounts từ trước, cần chạy script này để thêm các field mới:

```bash
node update_accounts.js
```

Script này sẽ tự động thêm các field mới (`using_proxy`, `proxy`) cho tất cả accounts hiện có trong file `moltbook_accounts.json`.

## Cấu hình

### Cấu hình MBC-20 Mint

**Lưu ý:** Thực hiện bước này sau khi đã cài đặt dependencies và cập nhật accounts.

Trước khi sử dụng, bạn cần tạo file `config.js` từ file mẫu:

```bash
cp config.example.js config.js
```

Sau đó chỉnh sửa file `config.js` để cấu hình thông tin mint:

```javascript
// Cấu hình MBC-20 mint
export const mint_data = `{"p":"mbc-20","op":"mint","tick":"CLAW","amt":"100"}`;
```

**Các tham số:**
- `p`: Protocol (thường là "mbc-20")
- `op`: Operation (thường là "mint")
- `tick`: Token ticker (ví dụ: "CLAW")
- `amt`: Số lượng mint (ví dụ: "100")

**Lưu ý:** File `config.js` không được commit lên git (đã có trong `.gitignore`), chỉ có `config.example.js` được track để làm mẫu.

## Sử dụng

### 1. Đăng ký agent mới

```bash
node register_moltbook.js
# hoặc
npm run register
```

Nhập tên agent khi được hỏi. Thông tin sẽ được lưu vào `moltbook_accounts.json` với:
- `status: 1` (mặc định, account sẽ được post)
- `last_post: 0` (timestamp của lần post cuối, 0 = chưa post)
- `wallet_link: null` (wallet address đã link, null = chưa link)
- `delay: 120` (thời gian delay giữa các lần post, tính bằng phút)

### 2. Claim agent

**QUAN TRỌNG:** Trước khi có thể post, bạn phải claim agent bằng cách:

1. Mở file `moltbook_accounts.json`
2. Tìm `link_claim` của agent bạn muốn claim
3. Mở link đó trong trình duyệt (ví dụ: `https://moltbook.com/claim/moltbook_claim_...`)
4. Làm theo hướng dẫn trên trang web:
   - Xác thực email (tạo tài khoản để quản lý agent)
   - Đăng tweet để xác minh quyền sở hữu với verification code

Sau khi claim thành công, agent mới có thể post được.

### 3. Post mint transaction

**Chạy 1 lần:**
```bash
node mint_post.js
# hoặc
npm run mint
```

**Chạy lặp lại (theo phút):**
```bash
node mint_post.js <số_phút>
# Ví dụ: lặp lại mỗi 5 phút
node mint_post.js 5
# hoặc
npm run mint -- 5
```

Script sẽ tự động post cho tất cả tài khoản có `status !== 0` trong `moltbook_accounts.json`.

**Tính năng:**
- Mỗi lần post sẽ có ký tự ngẫu nhiên (10 ký tự) trong nội dung và tiêu đề
- Sau khi post thành công, tự động cập nhật `last_post` với timestamp hiện tại
- Đợi 5 giây rồi tự động gọi API index post
- Bỏ qua các account có `status = 0`
- **Kiểm tra delay:** Nếu thời gian từ lần post cuối < delay (phút), sẽ bỏ qua và hiển thị thời gian còn lại

**Cách quản lý account:**
- Để tắt một account, sửa `status: 0` trong `moltbook_accounts.json`
- Để bật lại, sửa `status: 1`
- Để thay đổi delay, sửa `delay: <số_phút>` (ví dụ: `delay: 60` = 60 phút)

**Chạy:**
- Nếu không có tham số: chạy 1 lần và dừng
- Nếu có tham số (số phút): sẽ lặp lại mint sau mỗi khoảng thời gian đó
- Nhấn `Ctrl+C` để dừng khi đang chạy lặp lại

### 4. Link wallet với agent

```bash
node link_wallet.js
# hoặc
npm run link
```

Script sẽ:
1. **Chỉ hiển thị các account chưa link wallet** (wallet_link = null)
2. Hỏi bạn chọn account nào để link (nhập số hoặc 'all' để chọn tất cả)
3. Hỏi wallet address (ví dụ: `0xeBac9445C00F1B1967b527DdC94FeCF72283725C`)
4. Kiểm tra delay trước khi post (bỏ qua nếu chưa đủ thời gian)
5. Tự động post message link wallet cho account đã chọn
6. Sau khi post thành công, tự động cập nhật `wallet_link` và `last_post`

**Tính năng:**
- Tiêu đề post: "Link wallet {10 ký tự ngẫu nhiên}"
- Nội dung: JSON với format `{"p":"mbc-20","op":"link","wallet":"..."}` + `mbc20.xyz`
- Post này sẽ cho phép wallet owner claim mbc-20 token balances as ERC-20 tokens on Base

## Cấu trúc file

- `register_moltbook.js` - Script đăng ký agent
- `mint_post.js` - Script post mint transactions với ký tự ngẫu nhiên và index post
- `link_wallet.js` - Script link wallet với agent
- `update_accounts.js` - Script cập nhật các field mới cho accounts hiện có (chạy sau khi cài đặt)
- `config.example.js` - File mẫu cấu hình MBC-20 mint
- `config.js` - File cấu hình thực tế (không được track bởi git, cần copy từ config.example.js)
- `moltbook_accounts.json` - File lưu thông tin tài khoản (không được track bởi git)
- `package.json` - Package configuration

### Cấu trúc `moltbook_accounts.json`

```json
[
  {
    "name": "agent_name",
    "api_key": "moltbook_sk_...",
    "link_claim": "https://moltbook.com/claim/...",
    "status": 1,
    "last_post": 1735689600,
    "wallet_link": "0xeBac9445C00F1B1967b527DdC94FeCF72283725C",
    "delay": 120
  }
]
```

**Các field:**
- `status`: 0 = tắt (không post), 1 = bật (sẽ post)
- `last_post`: Unix timestamp (giây) của lần post cuối cùng, 0 = chưa post
- `wallet_link`: Wallet address đã link, `null` = chưa link wallet
- `delay`: Thời gian delay giữa các lần post (tính bằng phút), mặc định 120 phút
- `using_proxy`: 0 = không dùng proxy, 1 = dùng proxy
- `proxy`: Địa chỉ proxy (ví dụ: `"http://127.0.0.1:8080"`), `null` = không có proxy

## Lưu ý

- **Cài đặt:** Phải chạy `npm install` để cài đặt dependencies (https-proxy-agent)
- **Cập nhật accounts:** Nếu có accounts từ trước, phải chạy `node update_accounts.js` để thêm các field mới
- File `moltbook_accounts.json` chứa API keys và claim URLs, không được commit lên git
- **Bắt buộc:** Phải claim agent trước khi có thể post (sử dụng `link_claim` trong file JSON)
- Mỗi lần post sẽ có nội dung và tiêu đề khác nhau nhờ ký tự ngẫu nhiên
- Script tự động cập nhật `last_post` sau mỗi lần post thành công (mint post và link wallet)
- **Delay:** Script sẽ tự động kiểm tra và bỏ qua account nếu chưa đủ thời gian delay kể từ lần post cuối
- **Proxy:** Có thể cấu hình proxy cho từng account bằng cách đặt `using_proxy: 1` và `proxy: "http://proxy-url:port"` trong file JSON
- Để tạm dừng một account, đặt `status: 0` trong file JSON
- Để thay đổi delay, sửa `delay: <số_phút>` trong file JSON (ví dụ: `delay: 60` = 60 phút)
- Link wallet chỉ hiển thị các account chưa link wallet (`wallet_link = null`)

