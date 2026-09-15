import { noiNoiBo } from '../src/posts/noi-noi-bo';
let hong = 0;
const kiem = (t: string, a: unknown, b: unknown) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) console.log(`  ✓ ${t}`); else { hong++; console.log(`  ✗ ${t}\n      ra   ${x}\n      mong ${y}`); }
};
const KHO = [
  { slug: 'chon-phao', title: 'Cách chọn phao câu đài', tags: ['phao câu đài'], category: 'Chọn đồ nghề' },
  { slug: 'buoc-luoi', title: 'Buộc lưỡi câu chuẩn', tags: ['lưỡi câu'], category: 'Kỹ thuật câu' },
  { slug: 'moi-chep', title: 'Mồi câu cá chép', tags: ['mồi câu'], category: 'Mồi câu' },
];
const nay = { slug: 'bai-moi', category: 'Chọn đồ nghề' };
const dem = (h: string) => (h.match(/<a href="\/blog\//g) || []).length;

kiem('nối cụm khớp', dem(noiNoiBo('<p>Nói về phao câu đài rất hay.</p>', nay, KHO)), 1);
kiem('không nối chính nó', dem(noiNoiBo('<p>phao câu đài</p>', { slug: 'chon-phao', category: 'Chọn đồ nghề' }, KHO)), 0);
kiem('bỏ qua chỗ đã trong <a>', dem(noiNoiBo('<p><a href="/x">phao câu đài</a></p>', nay, KHO)), 0);
kiem('bỏ qua trong <h2>', dem(noiNoiBo('<h2>phao câu đài</h2>', nay, KHO)), 0);
// Đầu vào ĐÃ có 1 link tới chon-phao; đúng thì đầu ra vẫn đúng 1, không thêm.
kiem('không nối lại đích đã có link', dem(noiNoiBo('<p><a href="/blog/chon-phao">x</a> phao câu đài</p>', nay, KHO)), 1);
kiem('cụm hẹp nối được dù khác danh mục', dem(noiNoiBo('<p>cách lưỡi câu buộc</p>', nay, KHO)), 1);
kiem('tối đa 3 link', dem(noiNoiBo('<p>phao câu đài</p><p>'+'x'.repeat(300)+'lưỡi câu</p><p>'+'y'.repeat(300)+'mồi câu</p><p>'+'z'.repeat(300)+'phao câu đài</p>', nay, KHO)), 3);
kiem('nội dung rỗng không nổ', noiNoiBo('', nay, KHO), '');
kiem('giữ nguyên chữ hoa gốc', /<a href="\/blog\/chon-phao">Phao Câu Đài<\/a>/.test(noiNoiBo('<p>Phao Câu Đài đây</p>', nay, KHO)), true);
kiem('chạy hai lần không sinh link trùng', dem(noiNoiBo(noiNoiBo('<p>phao câu đài</p>', nay, KHO), nay, KHO)), 1);
console.log(hong ? `\n  ${hong} HỎNG` : '\n  Tất cả đạt');
