export type Deck = 'chance' | 'chest';
export type Card =
  | { text: string; kind: 'cash'; amount: number }
  | { text: string; kind: 'move'; target: number }
  | { text: string; kind: 'nearest'; target: 'station' | 'utility' }
  | { text: string; kind: 'jail' | 'free' }
  | { text: string; kind: 'repairs'; house: number; hotel: number }
  | { text: string; kind: 'shortage'; square: 12 | 28 };

export const CHANCE: readonly Card[] = [
  { text: 'Tiến về Xuất phát. Nhận 200.', kind: 'move', target: 0 },
  { text: 'Tới Bến xe gần nhất.', kind: 'nearest', target: 'station' },
  { text: 'Tới Điện lực hoặc Cấp nước gần nhất.', kind: 'nearest', target: 'utility' },
  { text: 'Tới Cà Mau.', kind: 'move', target: 39 },
  { text: 'Tới Vinh.', kind: 'move', target: 18 },
  { text: 'Ngân hàng trả lãi 50.', kind: 'cash', amount: 50 },
  { text: 'Nhận cổ tức 100.', kind: 'cash', amount: 100 },
  { text: 'Nộp phạt chạy quá tốc độ 15.', kind: 'cash', amount: -15 },
  { text: 'Sửa chữa: 25 mỗi nhà, 100 mỗi khách sạn.', kind: 'repairs', house: 25, hotel: 100 },
  { text: 'Vào tù ngay.', kind: 'jail' },
  { text: 'Giữ thẻ ra tù miễn phí.', kind: 'free' },
  { text: 'Được thưởng 150.', kind: 'cash', amount: 150 },
  {
    text: 'Thiếu điện: thuế Điện lực gấp đôi trong vòng bàn kế tiếp.',
    kind: 'shortage',
    square: 12,
  },
  {
    text: 'Thiếu nước: thuế Cấp nước gấp đôi trong vòng bàn kế tiếp.',
    kind: 'shortage',
    square: 28,
  },
];

export const CHEST: readonly Card[] = [
  { text: 'Tiến về Xuất phát. Nhận 200.', kind: 'move', target: 0 },
  { text: 'Ngân hàng chia lợi nhuận 200.', kind: 'cash', amount: 200 },
  { text: 'Hoàn thuế 20.', kind: 'cash', amount: 20 },
  { text: 'Nhận quà 100.', kind: 'cash', amount: 100 },
  { text: 'Phí khám bệnh 50.', kind: 'cash', amount: -50 },
  { text: 'Phí học tập 50.', kind: 'cash', amount: -50 },
  { text: 'Bán cổ phiếu, nhận 50.', kind: 'cash', amount: 50 },
  { text: 'Được thừa kế 100.', kind: 'cash', amount: 100 },
  { text: 'Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn.', kind: 'repairs', house: 40, hotel: 115 },
  { text: 'Vào tù ngay.', kind: 'jail' },
  { text: 'Giữ thẻ ra tù miễn phí.', kind: 'free' },
  { text: 'Trúng giải thưởng 10.', kind: 'cash', amount: 10 },
];

export const shuffle = (size: number, rng: () => number) => {
  const cards = Array.from({ length: size }, (_, i) => i);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
};
