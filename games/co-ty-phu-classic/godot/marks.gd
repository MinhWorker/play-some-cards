extends Control
## The marks Cờ tỷ phú draws over board.webp (this control covers the whole picture): each deed's
## owner band with its houses or hotel, a dark veil on a mortgaged deed, the contributions at a
## bus station, a ring round the tapped and the pending square, and the seat sockets of the
## printed panel in the players' colours.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const INKS: Array[Color] = [Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")]

var view: Dictionary = {}
var focus: int = -1


static func _inner_edge(i: int) -> Array[int]:
	if i < 10:
		return [0, 1]
	if i < 20:
		return [1, 2]
	if i < 30:
		return [3, 2]
	return [0, 3]


func _draw() -> void:
	if view.is_empty():
		return
	var pending: Variant = view.get("pending")
	for i: int in 40:
		var quad := PackedVector2Array()
		for corner: Vector2 in Rules.CELLS[i]:
			quad.append(corner * size)
		if Rules.is_deed(i):
			_draw_deed(i, quad)
			_draw_price(i)
		if i == focus or (pending != null and int(pending) == i):
			var ring := PackedVector2Array(quad)
			ring.append(quad[0])
			var color: Color = XomDaoUi.CREAM if i == focus else XomDaoUi.GOLD
			draw_polyline(ring, color, 4.0 if i == focus else 3.0, true)
	# The seat sockets on the printed panel.
	for seat: int in (view["players"] as Array).size():
		var socket: Vector2 = Rules.PANEL_SEATS[seat]
		var middle: Vector2 = Rules.plane_point(socket) * size
		var radius: float = Rules.PANEL_SEAT_RADIUS * size.x * 0.72
		var ink: Color = INKS[seat % 4]
		if bool(view["players"][seat]["bankrupt"]):
			ink = Color(0.55, 0.55, 0.55)
		draw_circle(middle, radius, ink)
		if seat == Rules.decision_seat(view):
			draw_arc(middle, radius + 3.0, 0.0, TAU, 24, XomDaoUi.GOLD, 3.0, true)


func _draw_deed(i: int, quad: PackedVector2Array) -> void:
	var deed: Dictionary = view["properties"][i]
	var held: Variant = deed.get("owner")
	var owner: int = -1 if held == null else int(held)
	if bool(deed["mortgaged"]):
		draw_colored_polygon(quad, Color(0.1, 0.08, 0.06, 0.45))
	if owner >= 0:
		var edge: Array[int] = _inner_edge(i)
		var a: Vector2 = quad[edge[0]]
		var b: Vector2 = quad[edge[1]]
		var inward: Vector2 = ((quad[0] + quad[2]) / 2.0 - (a + b) / 2.0) * 0.4
		var band := PackedVector2Array([a, b, b + inward, a + inward])
		draw_colored_polygon(band, Color(INKS[owner % 4], 0.85))
		var houses: int = int(deed["houses"])
		var middle: Vector2 = (a + b) / 2.0 + inward / 2.0
		var along: Vector2 = (b - a) / 5.0
		var side: float = minf(along.length() * 0.8, inward.length() * 0.7)
		if houses == 5:
			draw_rect(
				Rect2(middle - Vector2(side, side / 2.0), Vector2(side * 2.0, side)),
				XomDaoUi.LACQUER
			)
		for k: int in houses if houses < 5 else 0:
			var spot: Vector2 = middle + along * (k - (houses - 1) / 2.0)
			draw_rect(Rect2(spot - Vector2.ONE * side / 2.0, Vector2.ONE * side), XomDaoUi.GEM)
	var auctions: Dictionary = view.get("stationAuctions", {})
	var auction: Variant = auctions.get(str(i), auctions.get(i))
	if auction is Dictionary:
		var bids: Array = (auction as Dictionary)["bids"]
		var center: Vector2 = (quad[0] + quad[1] + quad[2] + quad[3]) / 4.0
		var step: float = (quad[1] - quad[0]).length() / 5.0
		for seat: int in bids.size():
			if int(bids[seat]) > 0:
				draw_circle(center + Vector2(step * (seat - 1.5), 0.0), step * 0.4, INKS[seat % 4])


## The deed's price on the outer part of its square, in the board's ink.
func _draw_price(i: int) -> void:
	var font: Font = XomDaoUi.display_font(800)
	var font_size: int = XomDaoUi.TEXT_MIN
	var spot: Vector2 = Rules.cell_point(i, 0.5, 0.8)
	if i > 10 and i < 20:
		spot = Rules.cell_point(i, 0.72, 0.5)
	elif i > 20 and i < 30:
		spot = Rules.cell_point(i, 0.5, 0.22)
	elif i > 30:
		spot = Rules.cell_point(i, 0.28, 0.5)
	var at: Vector2 = spot * size
	var text: String = str(Rules.price(i))
	var width: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(
		font,
		at + Vector2(-width / 2.0, font_size * 0.35),
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		Color("#5A3A22")
	)
