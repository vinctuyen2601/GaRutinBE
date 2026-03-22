# GaRutin Backend API

Backend API cho hệ thống quản lý trang trại Gà Rutin - E-commerce & CMS.

## Tech Stack

- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL + TypeORM
- **Auth**: JWT + Passport
- **Storage**: Cloudflare R2
- **Port**: 4001 (development)

## Modules

| Module | Mô tả |
|--------|-------|
| `auth` | Đăng nhập, JWT |
| `users` | Quản lý tài khoản admin/staff |
| `categories` | Danh mục sản phẩm |
| `products` | Quản lý sản phẩm gà rutin |
| `orders` | Đơn hàng |
| `posts` | Bài viết blog |
| `site-config` | Cấu hình website |
| `media` | Upload file lên R2 |

## API Endpoints

### Auth
- `POST /api/auth/login` — Đăng nhập
- `GET /api/auth/me` — Thông tin user hiện tại

### Categories
- `GET /api/categories` — Danh sách danh mục
- `POST /api/categories` — Tạo danh mục
- `PATCH /api/categories/:id` — Cập nhật
- `DELETE /api/categories/:id` — Xóa

### Products
- `GET /api/products` — Danh sách sản phẩm
- `POST /api/products` — Tạo sản phẩm
- `PATCH /api/products/:id` — Cập nhật
- `DELETE /api/products/:id` — Xóa

### Orders
- `GET /api/orders` — Danh sách đơn hàng
- `POST /api/orders` — Tạo đơn hàng
- `PATCH /api/orders/:id` — Cập nhật trạng thái

### Posts
- `GET /api/posts` — Danh sách bài viết
- `POST /api/posts` — Tạo bài viết
- `PATCH /api/posts/:id` — Cập nhật
- `DELETE /api/posts/:id` — Xóa

### Media
- `POST /api/media/upload` — Upload ảnh lên R2

### Site Config
- `GET /api/site-config` — Lấy cấu hình
- `PATCH /api/site-config` — Cập nhật cấu hình

## Setup

Xem file [SETUP.md](SETUP.md) để hướng dẫn cài đặt chi tiết.
