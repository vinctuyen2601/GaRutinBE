# Kết nối Google Search Console

Hướng dẫn để trang **Từ khoá & SEO** trong CMS tự lấy số liệu từ Google, thay vì
phải dán tay mỗi lần.

---

## Vì sao không dùng API key

Search Console **không hỗ trợ API key** cho dữ liệu riêng. Số liệu truy vấn thuộc
quyền sở hữu website, nên Google bắt buộc xác thực bằng một trong hai cách:

| Cách | Đặc điểm |
|---|---|
| OAuth 2.0 | Cần con người bấm "đồng ý" trên màn hình Google, và phải làm lại khi token hết hạn |
| **Service account** | Máy chủ tự ký, chạy tự động mãi mãi — **dùng cách này** |

Service account là một "tài khoản máy": nó có địa chỉ email riêng, và bạn cấp
quyền cho email đó trong Search Console y như cấp cho một người.

---

## 1. Tạo service account trên Google Cloud

1. Mở [console.cloud.google.com](https://console.cloud.google.com) → tạo project
   (hoặc dùng project sẵn có)
2. **APIs & Services → Library** → tìm **Google Search Console API** → **Enable**
3. **APIs & Services → Credentials** → **Create credentials** → **Service account**
4. Đặt tên bất kỳ, ví dụ `server-garutin` → **Create and continue**
5. Phần cấp role: **bỏ trống, bấm Continue** — quyền sẽ cấp bên Search Console,
   không phải ở đây
6. **Done**

### Lấy tệp khoá

Bấm vào service account vừa tạo → tab **Keys** → **Add key** → **Create new key**
→ chọn **JSON** → **Create**. Trình duyệt tải về một tệp `.json`.

> **Tệp này chỉ tải được một lần.** Mất thì phải tạo khoá mới, Google không cho
> xem lại.

---

## 2. Cấp quyền trong Search Console

**Đây là bước hay bị bỏ sót nhất.** Thiếu nó thì API trả lỗi `403` dù khoá hoàn
toàn đúng — và vì khoá đúng nên rất dễ đi tìm nhầm chỗ.

1. Mở [search.google.com/search-console](https://search.google.com/search-console)
2. Chọn website → **Cài đặt** (bánh răng, góc trái dưới)
3. **Người dùng và quyền** → **Thêm người dùng**
4. Dán **email của service account** — dạng
   `ten@ten-project.iam.gserviceaccount.com`, lấy trong tệp JSON ở trường
   `client_email`
5. Quyền: **Đầy đủ** → **Thêm**

---

## 3. Khai biến môi trường trên máy chủ

Thêm ba dòng vào `.env`:

```bash
GSC_CLIENT_EMAIL=server-garutin@garutin.iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...\n-----END PRIVATE KEY-----\n"
GSC_SITE_URL=sc-domain:garutin.com
```

Lấy giá trị từ tệp JSON: `client_email` và `private_key`.

### `GSC_PRIVATE_KEY` — hai điều phải đúng

- **Giữ nguyên các ký tự `\n`** như trong tệp JSON, đừng thay bằng xuống dòng thật
- **Bọc trong dấu nháy kép**, nếu không shell hiểu nhầm

Mã nguồn tự đổi `\n` thành xuống dòng thật lúc chạy.

### `GSC_SITE_URL` — phải đúng dạng property

Search Console có hai loại property, và dùng sai dạng sẽ ra lỗi `403` giống hệt
lỗi thiếu quyền:

| Loại property | Giá trị cần khai |
|---|---|
| Domain (xác minh bằng DNS) | `sc-domain:garutin.com` |
| URL prefix (xác minh bằng tệp/thẻ) | `https://garutin.com/` — **có dấu `/` cuối** |

Không chắc đang dùng loại nào? Xem góc trái trên trong Search Console: property
dạng Domain hiện tên miền trần, dạng URL prefix hiện cả `https://`.

Sau khi sửa `.env`, **khởi động lại máy chủ**:

```bash
pm2 restart garutin-be
```

---

## 4. Kiểm tra

Vào CMS → **Từ khoá & SEO**. Nếu cấu hình đúng, nút **"Đồng bộ Search Console"**
sẽ xuất hiện cạnh nút "Nhập tay" — nút này chỉ hiện khi máy chủ đã có đủ ba biến.

Bấm vào, sau vài giây sẽ báo số truy vấn lấy được.

---

## Xử lý lỗi

### `403 — User does not have sufficient permission`

Khoá đúng, nhưng service account chưa có quyền. Hai khả năng:

1. **Chưa làm bước 2** — đây là nguyên nhân phổ biến nhất
2. **`GSC_SITE_URL` sai dạng** — xem bảng ở mục 3

### `error:0909006C:PEM routines:get_name:no start line`

`GSC_PRIVATE_KEY` bị hỏng định dạng. Kiểm:

- Có bọc trong dấu nháy kép không
- Các `\n` còn nguyên không, hay đã bị thay bằng xuống dòng thật
- Có copy thiếu dòng `-----BEGIN` hoặc `-----END` không

### `invalid_grant: Invalid JWT Signature`

Khoá riêng không khớp với `client_email`. Thường do lấy hai giá trị từ hai tệp
JSON khác nhau — kiểm lại cả hai cùng đến từ một tệp.

### Nút "Đồng bộ" không hiện trong CMS

Máy chủ chưa thấy đủ ba biến. Kiểm đã khởi động lại chưa, và tên biến có đúng
chính tả không.

### Đồng bộ được nhưng 0 truy vấn

Search Console **trễ khoảng 2 ngày** và chỉ có dữ liệu từ lúc website được xác
minh. Website mới xác minh thì chưa có gì để lấy.

---

## Xoay khoá

Nên làm định kỳ, và **bắt buộc làm** nếu tệp JSON từng bị gửi qua chat, email hay
commit nhầm vào git.

1. Google Cloud → service account → tab **Keys**
2. **Add key** → tạo khoá JSON mới
3. Cập nhật `GSC_PRIVATE_KEY` trên máy chủ, khởi động lại, kiểm tra chạy được
4. Quay lại tab Keys → **xoá khoá cũ**

Làm theo đúng thứ tự này thì không có phút nào chức năng bị gián đoạn.

---

## Ghi chú kỹ thuật

- Không dùng thư viện `googleapis`: chỉ cần hai lời gọi HTTP, mà gói đó nặng vài
  chục megabyte. Node tự ký RS256 bằng `crypto` có sẵn.
  Mã ở `src/keywords/search-console.service.ts`.
- Access token sống 1 giờ và được lấy mới mỗi lần đồng bộ — không lưu lại, nên
  không có gì để rò rỉ.
- Mặc định lấy **90 ngày gần nhất**, tối đa 500 truy vấn.
- Ngày kết thúc là **hôm qua**, không phải hôm nay: Search Console trễ khoảng 2
  ngày nên dữ liệu hôm nay luôn rỗng, dễ làm người đọc tưởng lưu lượng tụt.
- Từ khoá chưa có trong hệ thống sẽ được **tạo mới** khi đồng bộ. Đây là phần
  đáng giá nhất — nó phát hiện nhu cầu mà mình chưa biết là đang có.
