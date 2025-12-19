# Quiz Master - Hệ thống trắc nghiệm Python

## 🚀 Tính năng

✅ Đăng ký/Đăng nhập với email
✅ Quên mật khẩu & Reset qua email  
✅ Tạo câu hỏi tùy chỉnh với nhiều đáp án
✅ Tracking thời gian chi tiết
✅ Bảng xếp hạng
✅ Chế độ công khai/riêng tư
✅ Cookie & Access Token (7 ngày)
✅ Responsive design
✅ Debug mode chi tiết

## 📋 Yêu cầu hệ thống

- Node.js >= 14.0.0
- npm hoặc yarn
- Gmail account (cho tính năng reset password)

## 🔧 Cài đặt

### 1. Clone/Download project

```bash
git clone <repository-url>
cd quiz-app-fixed
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình email

1. Tạo App Password từ Google Account:
   - Truy cập https://myaccount.google.com/security
   - Bật "2-Step Verification"
   - Tạo "App Password" (chọn app: Mail, device: Other)
   - Copy password vừa tạo

2. Tạo file `.env`:

```bash
cp .env.example .env
```

3. Sửa file `.env`:

```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development
DEBUG=true
```

### 4. Chạy server

```bash
npm start
```

Server sẽ chạy tại: http://localhost:3000

## 🔍 Debug Mode

Debug mode giúp bạn theo dõi chi tiết hoạt động của server:

- `DEBUG=true`: Hiển thị tất cả logs chi tiết
- `DEBUG=false`: Chỉ hiển thị logs cần thiết

## 📧 Test Email

Khi server khởi động thành công với email đã cấu hình, hệ thống sẽ tự động gửi một email test đẹp về địa chỉ email bạn cấu hình để xác nhận email service hoạt động tốt.

## 🌐 Deploy lên Render

### 1. Chuẩn bị

1. Push code lên GitHub
2. Đảm bảo file `.gitignore` đã loại trừ `.env` và `data/*.json`

### 2. Tạo Web Service trên Render

1. Truy cập https://render.com
2. Tạo "New Web Service"
3. Connect GitHub repository
4. Cấu hình:
   - **Name**: quiz-master (hoặc tên bạn chọn)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: Render tự động detect (không cần chỉ định)

### 3. Thêm Environment Variables

Trong phần "Environment" của Render, thêm:

```
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
BASE_URL=https://your-app.onrender.com
NODE_ENV=production
DEBUG=false
```

**LƯU Ý QUAN TRỌNG:**
- Không set biến `PORT` trên Render - Render tự động set biến này
- `BASE_URL` phải là URL chính xác của app trên Render
- Đặt `DEBUG=false` cho production để tránh logs quá nhiều

### 4. Deploy

1. Click "Create Web Service"
2. Đợi deploy hoàn tất (5-10 phút)
3. Kiểm tra logs để xác nhận:
   - Server running successfully
   - Email service connected
   - Test email sent

## 🗂️ Cấu trúc thư mục

```
quiz-app-fixed/
├── server.js              # Express server chính
├── package.json          
├── .env.example          # Template cho .env
├── .env                  # Config (không commit)
├── README.md
├── public/               # Static files
│   ├── css/
│   │   ├── style.css     # Main styles
│   │   ├── auth.css      # Login/Register styles
│   │   ├── create.css    # Quiz creation styles
│   │   ├── quiz.css      # Quiz play styles
│   │   ├── myactivities.css
│   │   └── toast.css     # Toast notification styles
│   ├── js/
│   │   ├── home.js
│   │   ├── auth.js
│   │   ├── create.js
│   │   ├── edit.js
│   │   ├── myactivities.js
│   │   ├── quiz-play.js
│   │   ├── share.js
│   │   └── toast.js
│   ├── home.html
│   ├── login.html
│   ├── create.html
│   ├── edit.html
│   ├── myactivities.html
│   ├── quiz.html
│   ├── share.html
│   ├── settings.html
│   ├── reset-password.html
│   └── 404.html
└── data/                 # JSON database
    ├── .gitkeep
    ├── users.json
    ├── sessions.json
    ├── results.json
    ├── reset_tokens.json
    └── quizzes.json
```

## 🐛 Xử lý lỗi

### Port đã được sử dụng

```bash
# Tìm process đang dùng port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Email không gửi được

1. Kiểm tra App Password đã tạo đúng chưa
2. Đảm bảo 2-Step Verification đã bật
3. Kiểm tra console logs để xem lỗi cụ thể

### Deploy Render bị lỗi

1. Kiểm tra logs trên Render Dashboard
2. Đảm bảo không set biến `PORT` (Render tự set)
3. Kiểm tra `BASE_URL` đúng với URL của app
4. Xem logs chi tiết với `DEBUG=true` tạm thời

## 📝 API Endpoints

### Authentication
- `POST /api/register` - Đăng ký tài khoản mới
- `POST /api/login` - Đăng nhập
- `GET /api/verify` - Verify session
- `POST /api/logout` - Đăng xuất
- `POST /api/forgot-password` - Gửi email reset password
- `POST /api/reset-password` - Reset password với token

### Quiz Management
- `POST /api/quiz/create` - Tạo quiz mới
- `GET /api/quiz/my-activities` - Lấy danh sách quiz của user
- `GET /api/quiz/:id` - Lấy thông tin quiz
- `PUT /api/quiz/:id` - Cập nhật quiz
- `DELETE /api/quiz/:id` - Xóa quiz
- `POST /api/quiz/:id/duplicate` - Nhân đôi quiz
- `POST /api/quiz/:id/check-answer` - Kiểm tra đáp án

### Results
- `POST /api/save-result` - Lưu kết quả
- `GET /api/results` - Lấy kết quả của user
- `GET /api/leaderboard` - Bảng xếp hạng

## 🎯 Features đã sửa

✅ Sửa lỗi menu không mở được (3 gạch)
✅ Sửa lỗi hiệu ứng menu khựng, đứng
✅ Loại bỏ hiệu ứng thừa
✅ Sửa lỗi trang cài đặt không có nút menu
✅ Làm mờ menu item đang active
✅ Sửa lỗi trang tạo câu hỏi không truy cập được
✅ Sửa lỗi không tick được checkbox
✅ Sửa lỗi port không nhận đúng trên Render
✅ Sửa lỗi email không kết nối được
✅ Thêm debug mode chi tiết
✅ Gửi email test khi deploy hoàn tất

## 💡 Tips

1. **Development**: Luôn dùng `DEBUG=true` để theo dõi logs
2. **Production**: Dùng `DEBUG=false` để giảm logs
3. **Email testing**: Dùng email thật để test, không dùng fake email
4. **Render**: Đợi ít nhất 2-3 phút sau khi deploy để app khởi động hoàn toàn

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Console logs (nếu DEBUG=true)
2. Browser DevTools Console
3. Render logs (nếu deploy trên Render)

## 📄 License

MIT
