# Quiz Master

He thong tao, chia se va lam bai trac nghiem truc tuyen. Day la phien ban
**da duoc viet lai toan bo** tu ma nguon ban dau: sua loi, thiet ke lai
giao dien, bo sung co che chong gian lan va bao mat, hoan thien cac tinh
nang con thieu.

---

## 1. Loi chinh da sua (ly do ban gap "thieu quyen truy cap")

Khi mo man hinh **Sua quiz**, API `GET /api/quiz/:id` (goi voi header
`X-Request-Full-Data: true`) tra ve du lieu day du cho chu so huu nhung
**khong kem theo truong `isOwner`**. Giao dien lai kiem tra dung
`if (!quiz.isOwner)` de quyet dinh cho phep sua hay khong. Vi truong nay
luon la `undefined` (bi coi la sai), man hinh Sua **luon** bao "khong co
quyen chinh sua" va tu dong quay ve danh sach - xay ra voi **moi** quiz,
khong rieng gi quiz vua nhan doi (ban chi phat hien khi thu sua ban sao).

Da sua: route nay gio luon tra kem `isOwner: true/false` ro rang.

## 2. Cac loi va thieu sot khac da sua

| Van de | Truoc day | Sau khi sua |
|---|---|---|
| Trang Tao/Sua quiz vo bo cuc, nhieu phan tu khong bam duoc | File `create.css` chi co 2 dong CSS, phan con lai la comment de trong ("abbreviated for space") | Viet lai toan bo CSS cho trang nay, dam bao moi phan tu (nut them cau hoi, chon dap an dung, xoa dap an...) deu hien thi va bam duoc dung |
| Dap an dung bi lo qua API | `check-answer` luon tra `correctIndex` du tra loi dung hay sai - chi can mo tab Network la biet dap an | Chi tra `correctIndex` khi tra loi **dung** |
| Bang xep hang de bi gia mao | Thoi gian lam bai do trinh duyet tu tinh roi gui len, ai cung sua duoc qua Console | May chu tu quan ly "luot lam bai" va tinh thoi gian bang dong ho server |
| Loi bao mat phan quyen | Bat ky ai dang nhap cung goi duoc API xem nhat ky thiet bi / chan IP cua nguoi khac | Them he thong vai tro, cac API nay chi danh cho **Quan tri vien (admin)** |
| File tinh van tai duoc khi IP bi chan | Middleware chan IP dat **sau** `express.static` | Chuyen middleware chan IP len dau, truoc moi thu khac |
| Mat khau luu khong an toan | Bam bang SHA-256, khong salt (de bi do bang bang cau vong) | Bam bang scrypt + salt rieng cho tung nguoi dung |
| Khong chong duoc do quet mat khau | Khong gioi han so lan thu | Gioi han toc do (rate limit), tu khoa tai khoan tam thoi, tu dong chan IP nghi van |
| Ten dang nhap / noi dung quiz co the chua ma doc hai (XSS) | Chen thang du lieu nguoi dung vao `innerHTML` | Bat buoc escape hoac dung `textContent`; gioi han ky tu ten dang nhap |
| Thieu Bang xep hang | Co API `/api/leaderboard` nhung khong co giao dien nao goi | Them trang `/leaderboard/:id` theo tung quiz |
| Trang Cai dat gan nhu trong | Chi co nut dang xuat | Them: doi mat khau, quan ly phien dang nhap (dang xuat tung thiet bi / tat ca), lich su ket qua lam bai |
| Toan bo emoji trong giao dien | Dung emoji Unicode | Thay bang bo icon SVG rieng, tu ve, khong phu thuoc font he thong |
| Du lieu co the "mat" khi 2 nguoi luu cung luc | Doc/ghi file JSON truc tiep, khong co co che chong ghi de | Toan bo du lieu nap vao bo nho dem (cache) RAM, dam bao khong bi ghi chong cheo |

## 3. He thong chong gian lan (anti-cheat)

Trong `server.js`, moi luot lam bai (`attempt`) duoc may chu quan ly rieng:

1. Khi bat dau lam bai, may chu tao mot `attemptId` va ghi lai thoi diem
   bat dau (`startedAt`) theo dong ho **cua may chu**.
2. Khi chon dap an, giao dien goi API `check-answer`. May chu la noi
   **duy nhat** biet dap an dung; neu tra loi sai, may chu **khong** gui
   ve chi so dap an dung (tranh viec mo Console/Network de do dap an ma
   khong can tra loi that).
3. Bat buoc phai tra loi dung cau truoc thi moi duoc gui dap an cho cau
   tiep theo (chong goi thang API de nhay den mot cau bat ky).
4. Khi nop bai, thoi gian lam moi cau va tong thoi gian deu duoc **may
   chu tu tinh** dua tren cac moc thoi gian da ghi nhan o buoc 2 - hoan
   toan khong dung bat ky con so thoi gian nao ma trinh duyet gui len.
   Vi vay khong the mo Console de gia mao thoi gian = 0 giay nham leo
   top bang xep hang.
5. Moi luot lam bai chi duoc nop mot lan (`finished`), tranh spam ket
   qua vao bang xep hang.

Dong ho hien tren giao dien khi lam bai chi de nguoi choi tham khao truc
quan, khong anh huong ket qua cuoi cung.

## 4. He thong bao mat

- **Mat khau**: bam bang `scrypt` (co san trong Node.js) voi salt ngau
  nhien rieng cho tung nguoi dung. Du lieu mat khau kieu cu (neu co) van
  dang nhap duoc va se tu dong duoc nang cap.
- **Chong CSRF**: co che "double submit cookie" - moi yeu cau thay doi
  du lieu (POST/PUT/DELETE) phai gui kem header `X-CSRF-Token` khop voi
  cookie `csrfToken`. Cac file JS trong `public/assets/js/api.js` da tu
  dong lo phan nay, khong can lam gi them.
- **Gioi han toc do (rate limiting)**: gioi han so lan goi API nhay cam
  (dang nhap, dang ky, quen mat khau) theo dia chi IP; tu dong tam khoa
  tai khoan 15 phut sau 8 lan dang nhap sai lien tiep.
- **Tuong lua co ban**: tu dong them mot dia chi IP vao danh sach chan
  neu phat hien qua nhieu lan xac thuc that bai trong thoi gian ngan
  (nghi van do quet mat khau). Quan tri vien co the chan/mo chan IP thu
  cong tai trang `/admin`.
- **Tieu de bao mat HTTP**: `Content-Security-Policy`, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`
  (khi chay o che do production).
- **Phan quyen ro rang**: chi tai khoan co vai tro `admin` moi duoc xem
  nhat ky truy cap he thong hoac chan/mo chan IP. Nguoi dung dau tien
  dang ky tren he thong se tu dong la admin (xem muc 6).
- **Chong XSS**: moi du lieu do nguoi dung nhap (tieu de quiz, noi dung
  cau hoi, dap an...) deu duoc hien thi bang `textContent` hoac ham
  `escapeHtml()` thay vi chen thang vao HTML.

## 5. Cau truc du an

```
quiz-master/
├── server.js                  May chu chinh (Express)
├── package.json
├── .env.example                Mau bien moi truong - sao chep thanh .env
├── render.yaml                 Cau hinh trien khai Render
├── data/                       "Co so du lieu" dang file JSON (tu tao khi chay)
└── public/
    ├── *.html                  Cac trang giao dien
    └── assets/
        ├── css/                 Toan bo CSS (variables.css la bang mau/kich thuoc dung chung)
        └── js/                  Toan bo JavaScript phia trinh duyet
            ├── icons.js          Bo icon SVG dung chung (thay the emoji)
            ├── utils.js          Ham tien ich (escapeHtml, dinh dang ngay gio...)
            ├── api.js            Goi API + tu dinh kem CSRF token
            ├── nav.js            Dieu khien sidebar + trang thai dang nhap
            ├── quiz-editor.js    Logic soan cau hoi dung chung cho Tao/Sua quiz
            └── ...               Moi trang co 1 file JS rieng cung ten
```

## 6. Chay thu tren may ca nhan

Yeu cau: da cai [Node.js](https://nodejs.org) tu ban 18 tro len.

```bash
# 1. Cai dat thu vien
npm install

# 2. Tao file cau hinh
cp .env.example .env
# Mo file .env va doi SESSION_SECRET sang mot chuoi bat ky (bao mat hon)

# 3. Chay server
npm start
```

Mo trinh duyet tai `http://localhost:3000`.

**Tai khoan quan tri vien (admin) dau tien**: nguoi **dau tien** dang ky
tren he thong se tu dong duoc cap quyen admin. Neu muon chi dinh admin
theo ten dang nhap cu the thay vi dua vao thu tu dang ky, hay dien bien
`ADMIN_USERNAMES` trong file `.env` (cach nhau boi dau phay).

## 7. Trien khai len Render

### Cach 1 - Dung Blueprint (nhanh nhat)
1. Day toan bo thu muc nay len mot repository GitHub cua ban.
2. Vao [Render Dashboard](https://dashboard.render.com) > **New** >
   **Blueprint**.
3. Chon repository vua tao. Render se tu doc file `render.yaml` co san
   trong du an va cau hinh san dich vu.
4. Dien cac bien con thieu khi duoc hoi (it nhat nen dien `BASE_URL` la
   duong dan Render cap cho ban, vi du `https://quiz-master-xxxx.onrender.com`).
5. Bam **Apply** va doi Render build xong.

### Cach 2 - Tao thu cong
1. Vao Render Dashboard > **New** > **Web Service**.
2. Chon repository chua du an.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Vao tab **Environment**, them cac bien tu file `.env.example`
   (it nhat can `SESSION_SECRET`, nen la mot chuoi ngau nhien dai).
6. Bam **Create Web Service**.

### Luu y quan trong ve du lieu tren Render
Du an nay dung file JSON de luu du lieu (khong dung he quan tri co so
du lieu rieng) de giu su don gian, de tu triem khai ma khong can them
dich vu database. O **goi mien phi (Free)** cua Render, o dia se bi **xoa
trang** moi khi ban trien khai lai phien ban moi (redeploy) - day la gioi
han cua nen tang Render, khong phai loi cua ung dung. Neu can du lieu ton
tai lau dai qua nhieu lan trien khai, ban co the:
- Nang cap len goi co ho tro **Persistent Disk** (o dia ben vung) cua
  Render va gan vao thu muc `data/`, hoac
- Chuyen sang mot he quan tri co so du lieu that su (PostgreSQL, MongoDB
  Atlas...) - se can sua lai phan doc/ghi trong `server.js`.

Trong luc dich vu dang chay binh thuong (khong redeploy), du lieu van
duoc luu ben vung binh thuong nho co che dong bo bo nho dem xuong dia
noi trong `server.js`.

## 8. Bien moi truong

Xem chi tiet va vi du trong file `.env.example`. Cac bien quan trong:

| Bien | Bat buoc | Y nghia |
|---|---|---|
| `SESSION_SECRET` | Nen co | Chuoi bi mat dung noi bo, doi truoc khi dua len moi truong that |
| `BASE_URL` | Khuyen nghi | Dia chi goc, dung de tao link trong email dat lai mat khau |
| `ADMIN_USERNAMES` | Khong | Danh sach ten dang nhap se tu duoc cap quyen admin |
| `EMAIL_USER`, `EMAIL_PASS` | Khong | Bat tinh nang "Quen mat khau" qua Gmail (dung App Password) |
| `DISCORD_WEBHOOK` | Khong | Nhan log/canh bao qua kenh Discord |

## 9. Gioi han da biet

- Chua co tinh nang xac thuc email khi dang ky (email chi dung de gui
  lai mat khau).
- Chan IP la chan theo dia chi IP nguon (co the anh huong nguoi dung
  dung chung mang - vi du mang truong hoc, cong ty) chu khong phai
  "van tay thiet bi" that su.
- Bo dem gioi han toc do (rate limit) va khoa tai khoan tam thoi luu
  trong bo nho RAM nen se duoc dat lai neu server khoi dong lai; day la
  danh doi hop ly cho quy mo ung dung nay.
