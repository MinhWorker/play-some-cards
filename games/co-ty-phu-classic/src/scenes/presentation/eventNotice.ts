const cardCopy: Record<string, string> = {
  'Ngân hàng trả lãi 50.': 'Tiền cũng biết đẻ tiền: nhận lãi 50 ₫!',
  'Nhận cổ tức 100.': 'Đầu tư có lời! Nhận cổ tức 100 ₫.',
  'Nộp phạt chạy quá tốc độ 15.': 'Chân ga hơi nhiệt tình! Nộp phạt 15 ₫.',
  'Vào tù ngay.': 'Bị đưa vào tù!',
  'Giữ thẻ ra tù miễn phí.': 'Một vé ra tù miễn phí! Cất kỹ nhé.',
  'Được thưởng 150.': 'Lộc tới cửa! Nhận thưởng 150 ₫.',
  'Ngân hàng chia lợi nhuận 200.': 'Ngân hàng hào phóng hôm nay: nhận 200 ₫!',
  'Hoàn thuế 20.': 'Thuế quay về ví! Nhận lại 20 ₫.',
  'Nhận quà 100.': 'Có quà, có vui! Nhận 100 ₫.',
  'Phí khám bệnh 50.': 'Khoẻ người, nhẹ ví: khám bệnh 50 ₫.',
  'Phí học tập 50.': 'Đầu tư cho tri thức: trả học phí 50 ₫.',
  'Bán cổ phiếu, nhận 50.': 'Chốt lời gọn gàng! Nhận 50 ₫ từ cổ phiếu.',
  'Được thừa kế 100.': 'Gia sản bất ngờ! Nhận thừa kế 100 ₫.',
  'Trúng giải thưởng 10.': 'Giải nhỏ, vui to! Nhận 10 ₫.',
};

/** One event body: card text and its resulting notice share the same line. */
export function eventNotice(notice: string, card: string | null, location: string): string {
  const arrival = notice === `Đến ${location}.`;
  if (notice.startsWith('Tới lượt ')) return '';
  if (notice === 'Bắt đầu ván mới.') return 'Ví đầy, mơ lớn!';
  if (arrival && !card) return '';
  const text = arrival ? (card ?? '') : notice;
  const debt = text.match(/^(.*): cần trả (\d+)\. Bán nhà hoặc thế chấp để trả nợ\.$/);
  if (debt) return `Chưa đủ tiền: cần trả ${money(debt[2]!)}. ${debt[1]!.replace(/\.$/, '')}.`;
  const rent = text.match(/^Tiền thuê (.+): −(\d+)$/);
  if (rent) return `Trả ${money(rent[2]!)} tiền thuê ${rent[1]}.`;
  const tax = text.match(/^(Thuế thu nhập|Thuế xa xỉ|Tiền bảo lãnh ra tù): −(\d+)$/);
  if (tax) return `${tax[1]}: đã trả ${money(tax[2]!)}.`;
  if (text === 'Ba lần xúc xắc đôi: vào tù!') return 'Tung đôi 3 lần liên tiếp: bị đưa vào tù!';
  if (/^Chưa ra tù:/.test(text)) return 'Chưa tung được đôi: vẫn ở trong tù.';
  // The notice can contain a card followed by the actual charge or debt. Keep that outcome.
  for (const [original, copy] of Object.entries(cardCopy)) {
    if (!text.startsWith(original)) continue;
    const outcome = text.slice(original.length);
    const paid = outcome.match(/^: −(\d+)$/);
    if (paid && original.endsWith(` ${paid[1]}.`)) return copy;
    return copy + outcome.replace(/^:/, '');
  }
  if (text === 'Vào tù!') return 'Bị đưa vào tù!';
  if (text === 'Đã trả 50 để ra tù.') return 'Tự do có giá: 50 ₫. Trở lại thương trường!';
  if (text === 'Đã dùng thẻ ra tù miễn phí.')
    return 'Vé cứu nguy đã phát huy tác dụng! Ra tù miễn phí.';
  if (text === 'Hai bên đã trao đổi tài sản.') return 'Bắt tay chốt kèo! Tài sản đã đổi chủ.';
  if (text === 'Không ai mua đất trong phiên đấu giá.')
    return 'Cả bàn giữ ví! Phiên đấu giá không có người mua.';
  const sale = text.match(/^(Bán nhà ở|Thế chấp) (.+), nhận (\d+)\.$/);
  if (sale) return `${sale[1]} ${sale[2]}: nhận ${money(sale[3]!)}.`;
  const redeem = text.match(/^Chuộc (.+) với (\d+)\.$/);
  if (redeem) return `Đã chuộc ${redeem[1]}: trả ${money(redeem[2]!)}.`;
  const settled = text.match(/^Đã trả (\d+): (.+)\.$/);
  if (settled) return `Đã trả nợ ${money(settled[1]!)}: ${settled[2]}.`;
  const purchase = text.match(/^Đã mua (.+) với (\d+)\.$/);
  if (purchase)
    return `Chốt đất ${purchase[1]}! Giá ${Number(purchase[2]).toLocaleString('vi-VN')} ₫.`;
  return text;
}

const money = (amount: string) => `${Number(amount).toLocaleString('vi-VN')} ₫`;

export function landingHeading(square: number, name: string, jailed: boolean): string {
  if (square === 10) return jailed ? 'Bị đưa vào tù!' : 'Ghé thăm nhà tù';
  return `Đến ${name}`;
}
