/** Kiểm phần thuần của chức năng đọc bảng xếp hạng đối thủ. */
import { tenMien, phanLoai, phanTichSerp } from '../src/keywords/doi-thu';

let dat = 0, truot = 0;
const la = (ten: string, thuc: unknown, mong: unknown) => {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong);
  ok ? dat++ : truot++;
  if (!ok) console.log(`  ✗ ${ten}\n      mong : ${JSON.stringify(mong)}\n      thực : ${JSON.stringify(thuc)}`);
};

const MINH = 'garutin.com';
const o = (link: string, position?: number) => ({ link, title: 't', position });

// tenMien
la('bỏ www', tenMien('https://www.shopee.vn/abc'), 'shopee.vn');
la('giữ tên miền con', tenMien('https://admin.garutin.com/x'), 'admin.garutin.com');
la('hạ chữ thường', tenMien('https://GaRutin.COM/a'), 'garutin.com');
la('url rác trả rỗng', tenMien('không phải url'), '');
la('chuỗi rỗng', tenMien(''), '');

// phanLoai
la('chính mình', phanLoai('garutin.com', MINH), 'cua-minh');
la('tên miền con của mình', phanLoai('blog.garutin.com', MINH), 'cua-minh');
la('www của mình đã bỏ tiền tố', phanLoai('garutin.com', 'www.garutin.com'), 'cua-minh');
la('sàn', phanLoai('shopee.vn', MINH), 'san');
la('mạng xã hội', phanLoai('tiktok.com', MINH), 'mang-xa-hoi');
la('m.facebook.com là mạng xã hội', phanLoai('m.facebook.com', MINH), 'mang-xa-hoi');
la('blog thường', phanLoai('lolipet.net', MINH), 'khac');
la('rỗng là khác', phanLoai('', MINH), 'khac');
// Bẫy hậu tố: tên miền chỉ KẾT THÚC bằng chuỗi giống nhau thì không phải một
la('notshopee.vn không phải shopee.vn', phanLoai('notshopee.vn', MINH), 'khac');
la('khongphaigarutin.com không phải của mình', phanLoai('khongphaigarutin.com', MINH), 'khac');

// phanTichSerp — trang một toàn sàn và mạng xã hội
{
  const r = phanTichSerp('gà rutin', [
    o('https://shopee.vn/a', 1), o('https://www.facebook.com/b', 2),
    o('https://tiktok.com/c', 3), o('https://lazada.vn/d', 4),
    o('https://lolipet.net/e', 5), o('https://garutin.com/f', 6),
  ], MINH);
  la('đếm sàn', r.soSan, 2);
  la('đếm mạng xã hội', r.soMangXaHoi, 2);
  la('tìm ra hạng của mình', r.hangCuaMinh, 6);
  la('4/6 là quá nửa → khó với tới', r.ketLuan, 'kho-voi-toi');
}

// phanTichSerp — trang một toàn blog nhỏ
{
  const r = phanTichSerp('chuồng gà rutin', [
    o('https://lolipet.net/a', 1), o('https://blogA.vn/b', 2),
    o('https://blogB.vn/c', 3), o('https://shopee.vn/d', 4),
  ], MINH);
  la('một sàn trên bốn → với tới được', r.ketLuan, 'voi-toi-duoc');
  la('mình không có mặt', r.hangCuaMinh, null);
}

// Đúng ngưỡng: 2/4 KHÔNG phải quá nửa
{
  const r = phanTichSerp('x', [
    o('https://shopee.vn/a', 1), o('https://tiktok.com/b', 2),
    o('https://blogA.vn/c', 3), o('https://blogB.vn/d', 4),
  ], MINH);
  la('đúng một nửa thì vẫn với tới được', r.ketLuan, 'voi-toi-duoc');
}

// Dự phòng khi serper không trả `position`
{
  const r = phanTichSerp('y', [o('https://a.vn/1'), o('https://garutin.com/2')], MINH);
  la('lấy thứ tự mảng làm hạng', r.ketQua.map((k) => k.hang), [1, 2]);
  la('hạng của mình theo dự phòng', r.hangCuaMinh, 2);
}

// Rỗng và cắt 10
la('organic rỗng', phanTichSerp('z', [], MINH).ketQua.length, 0);
la('SERP rỗng không kết luận bừa', phanTichSerp('z', [], MINH).ketLuan, 'voi-toi-duoc');
la('cắt còn 10', phanTichSerp('z', Array.from({ length: 20 }, (_, i) => o(`https://a${i}.vn/x`, i + 1)), MINH).ketQua.length, 10);
// Link hỏng không được làm sập cả hàng
la('link rác vẫn ra dòng', phanTichSerp('z', [{ link: 'xxx', title: 't' }], MINH).ketQua[0].loai, 'khac');

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
