extends RefCounted
## The words on Cờ tỷ phú's card: a square's price, rent and owner, and a trade offer.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const SPECIAL_TEXT: Dictionary = {
	"start": "Đi qua nhận 200.",
	"tax": "Nộp %s hoặc 10%% tiền mặt, lấy số lớn hơn.",
	"chance": "Rút một thẻ Cơ hội.",
	"chest": "Rút một thẻ Khí vận.",
	"jail": "Chỉ ghé thăm. Người trong tù không thu tiền thuê.",
	"airport": "Bay tới một ô ngẫu nhiên.",
	"go-jail": "Vào tù ngay.",
}


## "Minh đưa: Hạ Long, 100 ₫ / Máy 1 đưa: không".
static func trade(offer: Dictionary, names: Array[String]) -> String:
	var give: Array[String] = _side(offer["give"], int(offer["giveCash"]), offer.get("giveCard"))
	var take: Array[String] = _side(offer["take"], int(offer["takeCash"]), offer.get("takeCard"))
	var from: int = int(offer["from"])
	var to: int = int(offer["to"])
	return "%s đưa: %s\n%s đưa: %s" % [names[from], ", ".join(give), names[to], ", ".join(take)]


static func _side(square: Variant, cash: int, card: Variant) -> Array[String]:
	var out: Array[String] = []
	if square != null:
		out.append(str(Rules.SQUARES[int(square)]["name"]))
	if cash > 0:
		out.append(XomDaoUi.money(cash) + " ₫")
	if card == true:
		out.append("vé ra tù")
	if out.is_empty():
		out.append("không")
	return out


static func square(view: Dictionary, i: int, names: Array[String]) -> String:
	var square: Dictionary = Rules.SQUARES[i]
	var kind: String = square["kind"]
	if not Rules.is_deed(i):
		var text: String = SPECIAL_TEXT.get(kind, "")
		return text % XomDaoUi.money(int(square["tax"])) if kind == "tax" else text
	var lines: Array[String] = []
	var deed: Dictionary = view["properties"][i]
	var owner: int = -1 if deed.get("owner") == null else int(deed["owner"])
	lines.append("Giá %s ₫" % XomDaoUi.money(Rules.price(i)))
	match kind:
		"street":
			var ladder: Array = square["rent"]
			lines.append(
				(
					"Thuê %s, khách sạn %s ₫"
					% [XomDaoUi.money(int(ladder[0])), XomDaoUi.money(int(ladder[5]))]
				)
			)
			lines.append("Xây %s ₫ mỗi lần" % XomDaoUi.money(int(square["houseCost"])))
		"station":
			lines.append("Thuê %d ₫ cho mỗi bến của chủ" % Rules.STATION_FEE)
			if owner < 0:
				lines.append(station_bids(view, i, names))
		"utility":
			lines.append("Thuê = tổng xúc xắc × 4, đủ bộ × 10")
	if owner < 0:
		lines.append("Chưa có chủ")
	else:
		var holding: String = "Chủ: %s" % names[owner]
		var houses: int = int(deed["houses"])
		if houses == 5:
			holding += " · khách sạn"
		elif houses > 0:
			holding += " · %d nhà" % houses
		lines.append(holding)
		if bool(deed["mortgaged"]):
			lines.append(Rules.mortgage_status(view, i))
		else:
			lines.append("Thuê bây giờ %s ₫" % XomDaoUi.money(Rules.rent(view, i)))
	return "\n".join(lines)


static func station_bids(view: Dictionary, i: int, names: Array[String]) -> String:
	var auctions: Dictionary = view.get("stationAuctions", {})
	var auction: Variant = auctions.get(str(i), auctions.get(i))
	if auction is not Dictionary:
		return "Góp tiền khi dừng ở bến"
	var bids: Array = (auction as Dictionary)["bids"]
	var parts: Array[String] = []
	for seat: int in bids.size():
		if int(bids[seat]) > 0:
			parts.append("%s %s" % [names[seat], XomDaoUi.money(int(bids[seat]))])
	return "Đã góp: " + (", ".join(parts) if not parts.is_empty() else "chưa ai")


## The line over your actions: whose turn, the auction, what you owe.
static func status(view: Dictionary, me: int, names: Array[String]) -> String:
	var winner: Variant = view.get("winner")
	if winner != null:
		return "Bạn thắng!" if int(winner) == me else "%s thắng!" % names[int(winner)]
	var seat: int = Rules.decision_seat(view)
	var phase: String = view["phase"]
	if phase == "auction" and view.get("auction") is Dictionary:
		var auction: Dictionary = view["auction"]
		var name_of: String = Rules.SQUARES[int(auction["square"])]["name"]
		var highest: int = int(auction["highest"])
		return "%s: %s ₫" % [name_of, XomDaoUi.money(highest)] if highest > 0 else name_of
	if phase == "debt" and seat == me:
		return (
			"Thiếu %s ₫"
			% XomDaoUi.money(int(view["debt"]["amount"]) - int(view["players"][me]["cash"]))
		)
	if seat == me:
		return "Lượt bạn"
	return "Lượt %s" % names[seat]


## A money change floating over a slot: big, outlined, in `color`.
static func floater(text: String, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)
	return label
