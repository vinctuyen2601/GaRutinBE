# Hồ sơ quản lý — cửa hàng trực tuyến GaRutin

Lập ngày 10/09/2026 · Cập nhật lần cuối 10/09/2026 · Người lập: `quan-ly-tai-san`

Mọi số trong hồ sơ này đều **tự đo**, kèm cách đo lại. Đừng tin số cũ — hãy chạy lại.

---

## 1. Tài sản này là gì và tạo giá trị bằng cách nào

Trang trại **gà rutin** (chim cút Nhật Bản) bán trực tuyến: gà giống, gà lẻ
trống/mái, combo cặp, trứng, và vật tư nuôi.

Chuỗi tạo giá trị **thật sự** đang chạy như sau:

```
bài viết blog  →  Google  →  người đọc  →  trang sản phẩm  →  ĐA SỐ chốt qua Zalo
   (74 bài)                   (~420/tháng)                      ↑ hệ thống không thấy
```

Nghĩa là: **blog là kênh kéo khách, sản phẩm là nơi thuyết phục, còn chốt đơn
thì diễn ra ngoài hệ thống.** Ba khoản đầu tư khác nhau, và chỉ hai khoản đầu
đo được.

Ba kho mã: `GaRutinBE` (NestJS + Postgres), `GaRutinWeb` (Next.js), `GaRutinCMS`
(Vite/React). Hạ tầng: một máy EC2 chạy PM2, CSDL Postgres **nhiều khả năng
nằm cùng máy** (`DB_HOST=localhost` trong SETUP.md), ảnh trên Cloudflare R2,
API sau CloudFront.

---

## 2. Quy mô thật — đo ngày 10/09/2026

```
sản phẩm      20        mô tả: ngắn nhất 64 · trung vị 124 · dài nhất 2.208
                        13/20 dưới 300 ký tự · 13/20 chưa có video · 0 thiếu ảnh
                        2 sản phẩm TRÙNG TÊN "Mái vàng"
bài viết      74        chưa bài nào được gộp/chuyển hướng 301
khách 30 ngày 422       (972 lượt)
từ khoá       203       gộp 1 · bổ sung 68 · viết mới 57 · sửa tiêu đề 51 · đã tốt 11
review        5         toàn 5 sao, KHÔNG cái nào gắn với đơn hàng
đơn hàng      10        toàn bộ lịch sử — nhưng xem mục dưới
phễu 30 ngày  13/20 sản phẩm có tương tác · chạm 43 · thêm giỏ 4 · đặt 3 · bán 3
```

### Con số đơn hàng bị nhiễm — đừng dùng thô

Đọc từng đơn thì thấy **3 trong 10 không phải khách thật**: một đơn tên đúng
chữ `"test"` (27/07, 330.000đ), một đơn tên `"T"` (09/05), một đơn tên
`"VN_Ngu Oila\tN"` có ký tự tab — rác hoặc máy.

Còn lại **7 đơn thật: 4 xác nhận, 3 huỷ.** Và theo thời gian:

```
T5/2026   2 đơn — cả hai huỷ (1 trong đó là rác)
T7/2026   5 đơn — 2 xác nhận, 3 huỷ (1 trong đó là "test")
T9/2026   3 đơn — 3 xác nhận, 0 huỷ     ← hai tuần gần nhất
```

**Xu hướng đang tốt lên**, không phải đứng yên. Nói "10 đơn trong toàn bộ lịch
sử" là mô tả đúng nhưng gây hiểu sai.

### Cách đo lại

```bash
TOKEN=...   # POST /api/auth/login
A=https://api.garutin.com/api
curl -s "$A/products?limit=300"                     # mô tả, ảnh, video, trùng tên
curl -s "$A/posts?limit=500"                        # MẶC ĐỊNH CHỈ 12 — phải đặt limit
curl -s "$A/admin/analytics/visits?from=…&to=…"     -H "authorization: Bearer $TOKEN"
curl -s "$A/admin/analytics/product-funnel?from=…&to=…" -H "authorization: Bearer $TOKEN"
curl -s "$A/admin/orders?limit=300"                 -H "authorization: Bearer $TOKEN"
curl -s "$A/admin/keywords/phan-tich"               -H "authorization: Bearer $TOKEN"
```

---

## 3. Phần tạo ra giá trị lớn nhất → ưu tiên bảo vệ

**74 bài viết blog.** Đây là kênh kéo khách duy nhất đo được, và là khoản đầu
tư lớn nhất tính bằng công sức — hàng trăm giờ viết, không thể dựng lại nhanh.
Thứ hạng Google gắn với chúng còn khó lấy lại hơn: mất bài thì mất luôn thứ
hạng, và xây lại mất nhiều tháng.

**20 sản phẩm cùng ảnh trên R2.** Ảnh gà chụp thật, không mua được.

**Quan hệ khách hàng nằm trên Zalo.** Có giá trị nhất, và **hoàn toàn không
nằm trong tài sản này** — không ai sao lưu được nó.

---

## 4. Mất gì thì không lấy lại được → danh sách bảo vệ

> ### ⚠ Không tìm thấy bất kỳ cơ chế sao lưu CSDL nào
>
> Đã tra `.github/workflows/`, `package.json`, `SETUP.md`: không có `pg_dump`,
> không có snapshot, không có lịch sao lưu, không có tài liệu phục hồi.
>
> Cộng với việc Postgres nhiều khả năng chạy **cùng máy EC2** với ứng dụng:
> một sự cố ổ đĩa là mất 74 bài viết, 20 sản phẩm, toàn bộ số liệu truy cập và
> đơn hàng — **vĩnh viễn**.
>
> Đây là rủi ro lớn nhất của tài sản này, lớn hơn mọi vấn đề nội dung hay SEO
> gộp lại. Cần xác minh ngay: AWS có bật snapshot tự động không? Nếu có thì
> **đã từng thử phục hồi chưa?** Một bản sao lưu chưa từng phục hồi thử thì
> chưa phải bản sao lưu.

Các khoản khác trong danh sách bảo vệ:

- **Ảnh sản phẩm trên R2** — R2 không tự có phiên bản cũ. Xoá là mất.
- **Khoá bí mật**: `JWT_SECRET`, `DB_PASSWORD`, `GSC_PRIVATE_KEY`,
  `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `SERPER_API_KEY`. Chỉ tồn tại
  trong `.env` trên máy chủ. Mất máy là mất khoá.
  *Điểm tốt:* đã kiểm lịch sử git — chưa bao giờ commit nhầm `.env`, chỉ có
  `.env.example`.
- **Thứ hạng tìm kiếm** — không phải tệp, nhưng mất thì mất nhiều tháng.

---

## 5. Đang âm thầm xấu đi

**13/20 sản phẩm có mô tả gần như trống** (trung vị 124 ký tự; 17fishing cùng
hệ là 1.671). Không tự tốt lên, và mỗi ngày trôi qua là mất khách âm thầm —
khách xem rồi đi, không ai báo.

**Công cụ đã xây nhưng chưa dùng.** Chức năng gộp bài với chuyển hướng 301 đã
hoàn thành, nhưng **chưa bài nào được gộp** (`redirectTo` = 0/74). 51 từ khoá
đang ở trạng thái "sửa tiêu đề" — việc rẻ nhất trong tất cả, chưa làm.

**Dữ liệu đơn hàng nhiễm đơn test** và chưa được dọn. Càng để lâu càng khó
phân biệt, và mọi thống kê về sau đều lệch.

**Trường tên khách nhận rác** — có đơn chứa ký tự tab trong tên.

**Phụ thuộc LLM mục ruỗng theo thời gian.** Đã hai lần model bị khai tử giữa
chừng (`llama-3.3-70b`, `gemini-2.5-flash`). Sẽ còn xảy ra.

**7/20 sản phẩm không có tương tác nào trong 30 ngày** — chưa rõ vì hàng không
ai cần hay vì không ai tìm thấy.

---

## 6. Ngữ nghĩa dễ hiểu sai — bẫy đã có người mắc

| Bẫy | Sự thật |
|---|---|
| "Khách xem" = người thấy sản phẩm | Chỉ đếm người **mở trang chi tiết**. Nút thêm giỏ nằm trên thẻ ở trang danh sách nên `xem 0 · thêm giỏ 1` là **đúng** |
| Tỉ lệ thêm giỏ = giỏ ÷ lượt xem | Phải chia cho `reachers` (khách có bất kỳ tương tác nào). Chia cho `viewers` từng ra **300%** |
| Lượt truy cập = người thật | Đã lọc bot và lọc sự kiện phễu. Từng có ngày `/blog:` — đường dẫn không tồn tại — chiếm **28%** lưu lượng |
| utm_source ⇒ chiến dịch của shop | Chiến dịch nhận bằng `utm_campaign`. ChatGPT tự gắn `utm_source=chatgpt.com` |
| Tỉ lệ mua phản ánh sức bán | **Thiếu tử số** — đa số đơn chốt Zalo, không vào hệ thống |

Chi tiết đầy đủ ở `CLAUDE.md` cùng thư mục.

---

## 7. Chỗ tôi mù, và cần gì để hết mù

**Toàn bộ việc bán hàng qua Zalo.** Không thấy gì: bao nhiêu đơn, khách hỏi gì,
vì sao không chốt. Đây là mảng mù lớn nhất và nó làm hỏng mọi kết luận về
chuyển đổi. *Hết mù bằng cách:* nhập đơn Zalo vào hệ thống, dù chỉ nhập tay.

**Không biết có sao lưu ở tầng hạ tầng hay không.** Tôi chỉ đọc được mã và API,
không nhìn được bảng điều khiển AWS. *Hết mù bằng cách:* chủ shop kiểm và ghi
lại kết quả vào mục 4.

**Không biết vì sao 3 đơn thật bị huỷ.** Hệ thống không lưu lý do huỷ. *Hết mù
bằng cách:* thêm trường lý do, hoặc chủ shop nhớ lại và ghi vào mục 10.

**Khối "trực tiếp" 598 lượt/14 ngày chưa soi.** Với tiền lệ `/blog:`, nghi phần
lớn là máy quét. Chưa kiểm. *Hết mù bằng cách:* đối chiếu user agent và mẫu
đường dẫn.

**Không biết 7 sản phẩm im lặng là do đâu.** Cần đối chiếu với Search Console
xem có ai tìm chúng không.

---

## 8. Việc còn treo, ai đang chờ quyết

| Việc | Chờ ai |
|---|---|
| Xác minh sao lưu CSDL — **gấp nhất** | chủ shop kiểm AWS |
| `mua-ga-rutin-ha-noi-uy-tin`: giữ hay gộp? (shop có ship Hà Nội không?) | chủ shop quyết — **đừng tự gộp** |
| Gộp 17 bài quận huyện về `mua-ga-rutin-tp-hcm` | chủ shop chạy |
| Dọn 2 sản phẩm trùng tên "Mái vàng" | chủ shop quyết giữ cái nào |
| Xoá 3 đơn test khỏi dữ liệu | chủ shop quyết |
| 17fishing chưa nối Search Console | |
| Mã chết: `crawl-to-drafts` (không có lối vào), trang `/keywords-cu` | |

---

## 9. Nhịp kiểm đề xuất

Chưa thống nhất với chủ shop — đây là đề xuất.

| Nhịp | Kiểm gì | Phát hiện được chuyện gì |
|---|---|---|
| Tuần | mô tả sản phẩm < 300 ký tự; sản phẩm có khách xem mà không ai thêm giỏ | hàng trên kệ đang mất khách |
| Tuần | từ khoá mới trong Search Console | nhu cầu mới chưa có nội dung đón |
| Tháng | so số liệu với mục 2 | tài sản đang lớn hay teo |
| Tháng | **kiểm sao lưu có phục hồi được không** | rủi ro mất trắng |
| Quý | phụ thuộc: model LLM còn sống không, khoá còn hạn không | mục ruỗng âm thầm |

---

## 10. Nhật ký quyết định

| Ngày | Quyết gì | Vì sao | Kết quả |
|---|---|---|---|
| 09/09/2026 | Phễu tính mẫu số bằng `reachers` thay `viewers` | tỉ lệ ra 300% và chia cho 0; nút thêm giỏ nằm ngoài trang chi tiết | đã sửa, số về đúng khoảng |
| 09/09/2026 | Không đếm trang 404 là lượt xem | `/blog:` chiếm 28% lưu lượng một ngày | đã sửa |
| 09/09/2026 | Chiến dịch nhận bằng `utm_campaign`, tách nhóm "trợ lý AI" | ChatGPT tự gắn utm_source, làm hỏng ranh giới quảng cáo/tự nhiên | đã sửa |
| 09/09/2026 | Ép trần độ dài SEO bằng mã, không bằng prompt | prompt ghi ≤158, chạy thật ra 160/182/161 | đã sửa |
| 10/09/2026 | Vai trợ lý thu về **quản lý gian hàng và tiếp thị** | 3/7 trách nhiệm quản lý có đủ dữ liệu; đơn hàng và sổ sách mù | |
| 10/09/2026 | Hoãn xây bot Telegram, dùng Remote Control trước | Remote Control phủ 2/3 yêu cầu với chi phí xây bằng 0 | đang thử |

---

## 11. Hiểu biết tích luỹ

*Chỉ thêm, không xoá. Sai thì viết đính chính bên dưới, giữ nguyên dòng cũ.*

### 09/09/2026 · Đọc mã rồi kết luận mà không đo dữ liệu là đoán, không phải chẩn đoán
**Điều đã biết:** Khi phễu hiện "thêm giỏ 1 · tỉ lệ 0", tôi đọc SQL rồi kết
luận mẫu số bị thổi phồng bởi lượt xem cũ từ trước khi bật đo. Kéo dữ liệu thật
về thì ngược hẳn: mẫu số bị **thiếu**, vì khách thêm giỏ từ trang danh sách mà
không mở trang chi tiết.
**Biết bằng cách:** đối chiếu bảng theo trang với bảng phễu cùng một ngày — hai
sản phẩm có người thêm giỏ đều không nằm trong danh sách trang được xem.
**Hệ quả về sau:** với tài sản này, mã cho biết *ý nghĩa*, chỉ dữ liệu mới cho
biết *sự thật*. Luôn kéo số trước khi kết luận.

### 09/09/2026 · Phép đo của chính mình cũng có thể sai
**Điều đã biết:** Báo "chưa deploy" ba lần liền, trong khi bản mới đã lên từ
lâu. Biểu thức lọc đường dẫn chunk không nhận dấu ngoặc vuông nên chưa bao giờ
tải đúng tệp cần kiểm.
**Hệ quả về sau:** khi kết quả đo mâu thuẫn với điều hợp lý, nghi công cụ đo
trước khi nghi hệ thống.

### 09/09/2026 · Ràng buộc đo được thì ép bằng mã, đừng nài nỉ trong prompt
**Điều đã biết:** Prompt ghi "TUYỆT ĐỐI không quá 158 ký tự"; chạy thật ba lần
ra 160, 182, 161. Thêm chữ nài nỉ chỉ làm phần suy luận dài ra và gây hỏng
khác.
**Hệ quả về sau:** độ dài, định dạng, danh sách cho phép — ép bằng mã. Prompt
chỉ lo phần không đo được.

### 09/09/2026 · Nhà cung cấp LLM khác nhau hành xử khác nhau, và im lặng
**Điều đã biết:** Cùng một lệnh lúc chạy lúc trả 500. Nguyên nhân: một nhà phớt
lờ `response_format` và trả văn xuôi; `callLLM` coi đó là thành công nên ba nhà
còn lại không bao giờ được thử.
**Hệ quả về sau:** mọi phép kiểm chất lượng phải nằm **trong** vòng dự phòng,
không nằm ở nơi gọi. Lỗi phụ thuộc nhà cung cấp trông y hệt lỗi ngẫu nhiên.

### 10/09/2026 · Một con số tổng có thể che giấu điều ngược lại
**Điều đã biết:** "10 đơn trong toàn bộ lịch sử" nghe như shop đứng yên. Mở
từng đơn ra: 3 cái là rác/test, còn 7 đơn thật, và **ba đơn tháng 9 đều xác
nhận** — xu hướng đang tốt lên.
**Biết bằng cách:** liệt kê từng đơn kèm tên khách, ngày, trạng thái.
**Hệ quả về sau:** với dữ liệu ít, đừng bao giờ dùng số tổng. Mở hết ra mà đọc
— chỉ có mười dòng.

### 10/09/2026 · Chỗ nguy hiểm nhất là chỗ chưa ai nhìn
**Điều đã biết:** Cả ngày sửa mẫu số của một phân số, trong khi không ai kiểm
xem cơ sở dữ liệu có được sao lưu không. Hoá ra không tìm thấy cơ chế nào.
**Hệ quả về sau:** chạy giai đoạn "mất gì thì không lấy lại được" **trước**
mọi việc tối ưu. Việc tối ưu luôn hấp dẫn hơn và luôn được làm trước nếu không
có kỷ luật.

### 10/09/2026 · Về cách chủ shop làm việc
**Điều đã biết:** Thích nói thẳng, kéo lại ngay khi tôi lan man sang kiến trúc
thay vì trả lời câu được hỏi. Ưu tiên đã nêu rõ: **sản phẩm + review > bài viết
SEO > vận hành**. Không muốn nghe hứa hẹn doanh thu.
**Hệ quả về sau:** trả lời đúng câu được hỏi trước, đề xuất mở rộng sau và phải
ngắn.

---

*Hồ sơ này do người quản lý lập và tự cập nhật. Sửa số thì sửa kèm ngày đo.*
