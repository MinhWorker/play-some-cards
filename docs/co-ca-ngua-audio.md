# Âm thanh Cờ Cá Ngựa

Bộ âm thanh đầy đủ nằm trong `games/co-ca-ngua/assets/`; bàn Godot dùng bản sao trong
`games/co-ca-ngua/godot/sounds/` và `godot/music/`. Sáu bản `music-co-ca-ngua-*.mp3` được chọn
ngẫu nhiên khi bàn chơi hiện. Hiệu ứng dùng WAV mono PCM 16-bit, 48 kHz; tiếng bước ngựa được rút
ngắn và giảm âm lượng để không chồng tiếng qua nhiều ô.

Các điểm phát âm thanh nằm trong [`godot/main.gd`](../games/co-ca-ngua/godot/main.gd) (`_sfx`).
Tiếng xúc xắc, bước ngựa, đá ngựa, vào chuồng, về đích đi theo nước đi đã được server chấp nhận.

Game dùng luật không có ô an toàn hay nhảy qua ngựa. Tên file `ludo-token-safe` được giữ để dùng cho tiếng vào chuồng; các file chưa có điểm phát được giữ trong bộ âm thanh gốc của plugin.
