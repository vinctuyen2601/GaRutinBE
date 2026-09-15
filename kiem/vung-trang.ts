import { sinhCumHoi, xepLoaiVungTrang, laThuongMai } from '../src/keywords/vung-trang';

let hong = 0;
const kiem = (t: string, a: unknown, b: unknown) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) console.log(`  ✓ ${t}`); else { hong++; console.log(`  ✗ ${t}\n      ra   ${x}\n      mong ${y}`); }
};

// ── sinhCumHoi ───────────────────────────────────────────────────────────────
const cum = sinhCumHoi(['gà rutin'], 500);
kiem('có cụm gốc trần', cum.includes('gà rutin'), true);
kiem('có bổ ngữ TRƯỚC', cum.includes('mua gà rutin'), true);
kiem('có bổ ngữ SAU', cum.includes('gà rutin giá bao nhiêu'), true);
kiem('có ghép chữ cái', cum.includes('gà rutin a') && cum.includes('gà rutin b'), true);
kiem('không trùng lặp', cum.length, new Set(cum).size);
kiem('tôn trọng giới hạn', sinhCumHoi(['gà rutin'], 7).length, 7);
kiem('bỏ cụm gốc rỗng', sinhCumHoi(['', '  '], 50).length, 0);
kiem('hai cụm gốc thì nhân đôi lưới', sinhCumHoi(['a1', 'b1'], 500).length, sinhCumHoi(['a1'], 500).length * 2);

// ── laThuongMai ──────────────────────────────────────────────────────────────
kiem('"mua gà rutin" là thương mại', laThuongMai('mua gà rutin'), true);
kiem('"giá gà rutin" là thương mại', laThuongMai('giá gà rutin'), true);
kiem('"gà rutin ở đâu" là thương mại', laThuongMai('gà rutin ở đâu'), true);
kiem('"cách nuôi gà rutin" KHÔNG phải', laThuongMai('cách nuôi gà rutin'), false);

// ── xepLoaiVungTrang ─────────────────────────────────────────────────────────
const BAI = [
  { slug: 'lam-chuong-ga-rutin', title: 'Chuồng nuôi gà rutin: cách làm và kích thước chuẩn' },
  { slug: 'ga-rutin-an-gi', title: 'Gà rutin ăn gì' },
];
const HANG = ['gà rutin', 'chuồng gà rutin'];
const ra = xepLoaiVungTrang(
  ['gà rutin', 'chuồng nuôi gà rutin', 'mua gà rutin ở bình dương', 'gà rutin đồng nai'],
  HANG, BAI,
);
const tim = (k: string) => ra.find((x) => x.keyword === k)!;
kiem('đã có hạng → da-xep-hang', tim('gà rutin').loai, 'da-xep-hang');
kiem('có bài, chưa hạng → co-bai-chua-hang', tim('chuồng nuôi gà rutin').loai, 'co-bai-chua-hang');
kiem('không bài, không hạng → vung-trang', tim('gà rutin đồng nai').loai, 'vung-trang');
kiem('bài gần đúng được gắn kèm', tim('chuồng nuôi gà rutin').baiGan, 'lam-chuong-ga-rutin');
kiem('vùng trắng THƯƠNG MẠI đứng trên vùng trắng thường',
  tim('mua gà rutin ở bình dương').diem > tim('gà rutin đồng nai').diem, true);
kiem('đã có hạng thì điểm thấp nhất',
  tim('gà rutin').diem < tim('gà rutin đồng nai').diem, true);
kiem('xếp giảm dần theo điểm',
  ra.every((x, i) => i === 0 || ra[i - 1].diem >= x.diem), true);
kiem('danh sách rỗng không nổ', xepLoaiVungTrang([], [], []).length, 0);

// Khớp theo TẬP TỪ LÕI, không đòi nguyên cụm. Bản đầu báo 227/228 vùng trắng
// cho site 94 bài vì đòi tiêu đề chứa đúng chuỗi truy vấn.
const r3 = xepLoaiVungTrang(
  ['giá trứng gà rutin', 'mua trứng gà rutin ở đâu', 'gà rutin đồng nai'],
  [],
  [{ slug: 'trung-ga-rutin', title: 'Trứng gà rutin: tác dụng và số lượng nên ăn' }],
);
kiem('"giá trứng gà rutin" khớp bài về trứng',
  r3.find((x) => x.keyword === 'giá trứng gà rutin')!.loai, 'co-bai-chua-hang');
kiem('"mua trứng gà rutin ở đâu" cũng khớp',
  r3.find((x) => x.keyword === 'mua trứng gà rutin ở đâu')!.loai, 'co-bai-chua-hang');
kiem('"gà rutin đồng nai" VẪN là vùng trắng',
  r3.find((x) => x.keyword === 'gà rutin đồng nai')!.loai, 'vung-trang');

// Cụm lõi KHÔNG bỏ dấu: `lông` và `lồng` phải là hai chùm khác nhau.
const r2 = xepLoaiVungTrang(['lồng gà rutin', 'lông gà rutin', 'lồng gà rutin đẹp'], [], []);
kiem('lồng/lông không bị gom chung chùm',
  r2.find((x) => x.keyword === 'lông gà rutin')!.coCum, 1);

console.log(hong ? `\n  ${hong} HỎNG` : '\n  Tất cả đạt');
process.exit(hong ? 1 : 0);
