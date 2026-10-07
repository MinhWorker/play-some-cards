# Âm thanh Cờ Cá Ngựa

Bộ âm thanh dùng trực tiếp trong `games/co-ca-ngua/assets/`. Sáu bản `music-co-ca-ngua-*.mp3` được ứng dụng chọn ngẫu nhiên cho bàn chơi. Hiệu ứng dùng WAV mono PCM 16-bit, 48 kHz; tiếng bước ngựa được rút ngắn và giảm âm lượng để không chồng tiếng qua nhiều ô.

Các điểm phát âm thanh nằm trong [`CoCaNguaView.ts`](../games/co-ca-ngua/src/scenes/CoCaNguaView.ts). Hoạt ảnh và tiếng xúc xắc, bước ngựa, đá ngựa, vào chuồng, về đích đi theo nước đi đã được server chấp nhận. Khôi phục state, xem lại và đổi người xem dựng lại bàn im lặng; runtime hủy hiệu ứng cũ khi sang ván hoặc rời bàn.

Game dùng luật không có ô an toàn hay nhảy qua ngựa. Tên file `ludo-token-safe` được giữ để dùng cho tiếng vào chuồng; các file chưa có điểm phát được giữ trong bộ âm thanh gốc của plugin.
