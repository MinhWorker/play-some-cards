import { expect, it } from 'vitest';
import { eventNotice, landingHeading } from './eventNotice.js';

it('avoids repeating arrival and turn context', () => {
  expect(eventNotice('Đến Hàng Đào.', null, 'Hàng Đào')).toBe('');
  expect(eventNotice('Tới lượt Máy 1.', null, 'Hàng Đào')).toBe('');
});

it('presents a card once and retains its charge or debt outcome', () => {
  const card = 'Phí khám bệnh 50.';
  expect(eventNotice(card, card, 'Cộng đồng')).toBe('Khoẻ người, nhẹ ví: khám bệnh 50 ₫.');
  expect(
    eventNotice(`${card}: cần trả 50. Bán nhà hoặc thế chấp để trả nợ.`, card, 'Cộng đồng'),
  ).toContain('Chưa đủ tiền: cần trả 50 ₫.');
  expect(eventNotice('Đến Xuất phát.', 'Tiến về Xuất phát. Nhận 200.', 'Xuất phát')).toContain(
    '200',
  );
});

it('keeps purchase price and unfamiliar events intact', () => {
  expect(eventNotice('Đã mua Ga Bắc với 200.', null, 'Ga Bắc')).toBe('Chốt đất Ga Bắc! Giá 200 ₫.');
  expect(eventNotice('Tiền thuê Hàng Đào: −4', null, 'Hàng Đào')).toBe(
    'Trả 4 ₫ tiền thuê Hàng Đào.',
  );
});

it('distinguishes visiting jail, imprisonment and failed release', () => {
  expect(landingHeading(10, 'Nhà tù / Thăm', false)).toBe('Ghé thăm nhà tù');
  expect(landingHeading(10, 'Nhà tù / Thăm', true)).toBe('Bị đưa vào tù!');
  expect(eventNotice('Chưa ra tù: 2 + 3.', null, '')).toBe('Chưa tung được đôi: vẫn ở trong tù.');
  expect(eventNotice('Ba lần xúc xắc đôi: vào tù!', null, '')).toContain('3 lần liên tiếp');
});
