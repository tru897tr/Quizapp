# Quiz Master - Hệ thống trắc nghiệm Python

## Tính năng

✅ Đăng ký/Đăng nhập với email
✅ Quên mật khẩu & Reset qua email
✅ 35 câu hỏi Python với xáo trộn đáp án
✅ Tracking thời gian chi tiết
✅ Bảng xếp hạng
✅ Chế độ toàn màn hình
✅ Cookie & Access Token (7 ngày)
✅ Responsive design

## Cài đặt

1. Clone/Download project
2. Copy `.env.example` thành `.env` và cấu hình email
3. Chạy: `npm install`
4. Chạy: `npm start`
5. Truy cập: http://localhost:3000

## Cấu hình Email

Để sử dụng tính năng reset password, bạn cần:

1. Tạo App Password từ Google Account
2. Cập nhật EMAIL_USER và EMAIL_PASS trong file .env

## Deploy lên Render

1. Push code lên GitHub
2. Tạo Web Service trên Render.com
3. Thêm Environment Variables:
   - EMAIL_USER=your@gmail.com
   - EMAIL_PASS=your-app-password
   - BASE_URL=https://your-app.onrender.com
4. Deploy!

## Cấu trúc

```
quiz-app/
├── server.js          # Express server
├── package.json       
├── .env.example       
├── public/            
│   ├── css/          
│   ├── js/           
│   ├── home.html     # Trang chủ
│   ├── login.html    # Đăng nhập/ký
│   ├── quiz.html     # Trang quiz
│   ├── reset-password.html
│   └── 404.html      
└── data/             # JSON storage
```

## License

MIT
