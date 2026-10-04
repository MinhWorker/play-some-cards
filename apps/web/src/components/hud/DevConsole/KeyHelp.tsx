/** Shortcut reference opened with the physical question-mark key in an empty command input. */
export function KeyHelp() {
  return (
    <div className="dev-console-help">
      <div>Ctrl+` · Ẩn/hiện　Ctrl+/ · Gõ lệnh　Esc · Đóng gợi ý / thoát</div>
      <div>Enter · Chạy　↑ ↓ · Lịch sử　Tab / Shift+Tab · Gợi ý　PageUp / PageDown · Cuộn log</div>
      <div>? · Phím tắt　help · Lệnh server　.pin 1 … / !1 · Ghim / chạy ghim</div>
    </div>
  );
}
