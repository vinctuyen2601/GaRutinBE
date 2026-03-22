# GaRutin Backend - Hướng dẫn Setup

## Yêu cầu

- Node.js >= 23 (khuyến nghị dùng NVM)
- PostgreSQL >= 18
- Git

## 1. Clone & Cài đặt

```bash
git clone git@github.com-vinctuyen2601:vinctuyen2601/GaRutinBE.git
cd GaRutinBE
npm install
```

## 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa `.env` với thông tin thực tế:

```env
NODE_ENV=development
PORT=4001

# Database (chọn 1 trong 2 cách)
DATABASE_URL=postgresql://user:pass@host/garutin
# Hoặc dùng từng biến riêng
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=garutin

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=30d

# Cloudflare R2
R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET=garutin
R2_PUBLIC_URL=https://cdn.garutin.com

# CORS
CMS_URL=http://localhost:5174
WEB_URL=http://localhost:3000
```

## 3. Tạo Database

```bash
# Vào PostgreSQL
sudo -u postgres psql

# Tạo DB và user
CREATE USER garutin_owner WITH PASSWORD 'your_password';
CREATE DATABASE garutin OWNER garutin_owner;
GRANT ALL PRIVILEGES ON DATABASE garutin TO garutin_owner;
\q
```

## 4. Chạy Migration

```bash
npm run migration:run
```

Migration sẽ tạo các bảng: `users`, `categories`, `products`, `posts`, `orders`, `site_config`.

## 5. Chạy Development

```bash
npm run start:dev
```

API chạy tại: `http://localhost:4001/api`

## 6. Build Production

```bash
npm run build
npm run start:prod
```

## Deploy lên EC2

### Lần đầu

```bash
# SSH vào EC2
ssh ubuntu@<EC2-IP>

# Clone repo
git clone git@github.com-vinctuyen2601:vinctuyen2601/GaRutinBE.git garutin-backend
cd garutin-backend

# Cấu hình .env
cp .env.example .env
nano .env

# Cài dependencies & build
npm install
npm run migration:run
npm run build

# Chạy với PM2
pm2 start npm --name "garutin-be" -- run start:prod
pm2 save
pm2 startup
```

### Cập nhật (tự động qua GitHub Actions)

Push lên branch `main` → GitHub Actions tự động deploy.

Cấu hình secrets trên GitHub repo:
- `EC2_HOST` — IP của EC2
- `EC2_SSH_KEY` — Nội dung file `.pem`

## Nginx Config (nếu chạy cùng EC2 với dự án khác)

```nginx
server {
    listen 80;
    server_name api.garutin.com;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/garutin-be /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
