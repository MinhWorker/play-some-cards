extends RefCounted
## Cờ tỷ phú Classic's board and the sums the table shows, copied from the TypeScript rules:
## the squares from `BOARD` in src/game/model.ts, rent and mortgage sums from src/game/rules.ts,
## who decides from src/game/turnClock.ts. Square corners come from
## src/scenes/board/boardGeometry.ts (rendered with sources/render_board_25d.py).

const STARTING_CASH := 1000
const STATION_STEP := 50
const STATION_FEE := 50
const BAIL := 50
const STATIONS: Array[int] = [5, 15, 25, 35]
const UTILITIES: Array[int] = [12, 28]
const SQUARES: Array[Dictionary] = [
	{"name": "Xuất phát", "kind": "start"},
	{
		"name": "Phú Quốc",
		"kind": "street",
		"price": 200,
		"group": "nau",
		"rent": [20, 80, 220, 600, 800, 1000],
		"houseCost": 100
	},
	{
		"name": "Lào Cai",
		"kind": "street",
		"price": 150,
		"group": "nau",
		"rent": [15, 60, 165, 450, 600, 750],
		"houseCost": 75
	},
	{
		"name": "Việt Trì",
		"kind": "street",
		"price": 180,
		"group": "nau",
		"rent": [18, 72, 198, 540, 720, 900],
		"houseCost": 90
	},
	{"name": "Thuế thu nhập", "kind": "tax", "tax": 100},
	{"name": "Bến Bắc", "kind": "station", "price": 200},
	{
		"name": "Hạ Long",
		"kind": "street",
		"price": 280,
		"group": "xanh-nhat",
		"rent": [28, 112, 308, 840, 1120, 1400],
		"houseCost": 140
	},
	{"name": "Cơ hội", "kind": "chance"},
	{
		"name": "Hải Phòng",
		"kind": "street",
		"price": 320,
		"group": "xanh-nhat",
		"rent": [32, 128, 352, 960, 1280, 1600],
		"houseCost": 160
	},
	{
		"name": "Hà Nội",
		"kind": "street",
		"price": 350,
		"group": "xanh-nhat",
		"rent": [35, 140, 385, 1050, 1400, 1750],
		"houseCost": 175
	},
	{"name": "Nhà tù", "kind": "jail"},
	{
		"name": "Hải Dương",
		"kind": "street",
		"price": 220,
		"group": "hong",
		"rent": [22, 88, 242, 660, 880, 1100],
		"houseCost": 110
	},
	{"name": "Điện lực", "kind": "utility", "price": 150},
	{
		"name": "Thái Bình",
		"kind": "street",
		"price": 260,
		"group": "hong",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{
		"name": "Nam Định",
		"kind": "street",
		"price": 240,
		"group": "hong",
		"rent": [24, 96, 264, 720, 960, 1200],
		"houseCost": 120
	},
	{"name": "Bến Tây", "kind": "station", "price": 200},
	{
		"name": "Thanh Hóa",
		"kind": "street",
		"price": 270,
		"group": "cam",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Khí vận", "kind": "chest"},
	{
		"name": "Vinh",
		"kind": "street",
		"price": 260,
		"group": "cam",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{
		"name": "Hà Tĩnh",
		"kind": "street",
		"price": 170,
		"group": "cam",
		"rent": [17, 68, 187, 510, 680, 850],
		"houseCost": 85
	},
	{"name": "Sân bay", "kind": "airport"},
	{
		"name": "Huế",
		"kind": "street",
		"price": 270,
		"group": "do",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Cơ hội", "kind": "chance"},
	{
		"name": "Đà Nẵng",
		"kind": "street",
		"price": 300,
		"group": "do",
		"rent": [30, 120, 330, 900, 1200, 1500],
		"houseCost": 150
	},
	{
		"name": "Hội An",
		"kind": "street",
		"price": 250,
		"group": "do",
		"rent": [25, 100, 275, 750, 1000, 1250],
		"houseCost": 125
	},
	{"name": "Bến Nam", "kind": "station", "price": 200},
	{
		"name": "Kon Tum",
		"kind": "street",
		"price": 140,
		"group": "vang",
		"rent": [14, 56, 154, 420, 560, 700],
		"houseCost": 70
	},
	{
		"name": "Pleiku",
		"kind": "street",
		"price": 160,
		"group": "vang",
		"rent": [16, 64, 176, 480, 640, 800],
		"houseCost": 80
	},
	{"name": "Cấp nước", "kind": "utility", "price": 150},
	{
		"name": "Đà Lạt",
		"kind": "street",
		"price": 270,
		"group": "vang",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Vào tù", "kind": "go-jail"},
	{
		"name": "Nha Trang",
		"kind": "street",
		"price": 280,
		"group": "xanh-la",
		"rent": [28, 112, 308, 840, 1120, 1400],
		"houseCost": 140
	},
	{
		"name": "Vũng Tàu",
		"kind": "street",
		"price": 260,
		"group": "xanh-la",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{"name": "Khí vận", "kind": "chest"},
	{
		"name": "Biên Hòa",
		"kind": "street",
		"price": 220,
		"group": "xanh-la",
		"rent": [22, 88, 242, 660, 880, 1100],
		"houseCost": 110
	},
	{"name": "Bến Đông", "kind": "station", "price": 200},
	{
		"name": "Tp. HCM",
		"kind": "street",
		"price": 350,
		"group": "xanh-dam",
		"rent": [35, 140, 385, 1050, 1400, 1750],
		"houseCost": 175
	},
	{
		"name": "Cần Thơ",
		"kind": "street",
		"price": 300,
		"group": "xanh-dam",
		"rent": [30, 120, 330, 900, 1200, 1500],
		"houseCost": 150
	},
	{"name": "Thuế xa xỉ", "kind": "tax", "tax": 200},
	{
		"name": "Cà Mau",
		"kind": "street",
		"price": 180,
		"group": "xanh-dam",
		"rent": [18, 72, 198, 540, 720, 900],
		"houseCost": 90
	},
]
const GROUP_COLORS: Dictionary = {
	"nau": Color("#434959"),
	"xanh-nhat": Color("#73dde7"),
	"hong": Color("#b94dd6"),
	"cam": Color("#7451c7"),
	"do": Color("#c3288e"),
	"vang": Color("#77717d"),
	"xanh-la": Color("#673c91"),
	"xanh-dam": Color("#176578"),
}
## Each square's corners on board-25d.webp (fractions of its width and height): top left,
## top right, bottom right, bottom left.
const CELLS: Array = [
	[
		Vector2(0.788285, 0.705104),
		Vector2(0.910805, 0.705104),
		Vector2(0.922681, 0.836335),
		Vector2(0.796618, 0.836335)
	],
	[
		Vector2(0.724221, 0.705104),
		Vector2(0.788285, 0.705104),
		Vector2(0.796618, 0.836335),
		Vector2(0.730703, 0.836335)
	],
	[
		Vector2(0.660158, 0.705104),
		Vector2(0.724221, 0.705104),
		Vector2(0.730703, 0.836335),
		Vector2(0.664788, 0.836335)
	],
	[
		Vector2(0.596095, 0.705104),
		Vector2(0.660158, 0.705104),
		Vector2(0.664788, 0.836335),
		Vector2(0.598873, 0.836335)
	],
	[
		Vector2(0.532032, 0.705104),
		Vector2(0.596095, 0.705104),
		Vector2(0.598873, 0.836335),
		Vector2(0.532958, 0.836335)
	],
	[
		Vector2(0.467968, 0.705104),
		Vector2(0.532032, 0.705104),
		Vector2(0.532958, 0.836335),
		Vector2(0.467042, 0.836335)
	],
	[
		Vector2(0.403905, 0.705104),
		Vector2(0.467968, 0.705104),
		Vector2(0.467042, 0.836335),
		Vector2(0.401127, 0.836335)
	],
	[
		Vector2(0.339842, 0.705104),
		Vector2(0.403905, 0.705104),
		Vector2(0.401127, 0.836335),
		Vector2(0.335212, 0.836335)
	],
	[
		Vector2(0.275779, 0.705104),
		Vector2(0.339842, 0.705104),
		Vector2(0.335212, 0.836335),
		Vector2(0.269297, 0.836335)
	],
	[
		Vector2(0.211715, 0.705104),
		Vector2(0.275779, 0.705104),
		Vector2(0.269297, 0.836335),
		Vector2(0.203382, 0.836335)
	],
	[
		Vector2(0.089195, 0.705104),
		Vector2(0.211715, 0.705104),
		Vector2(0.203382, 0.836335),
		Vector2(0.077319, 0.836335)
	],
	[
		Vector2(0.095359, 0.636984),
		Vector2(0.216041, 0.636984),
		Vector2(0.211715, 0.705104),
		Vector2(0.089195, 0.705104)
	],
	[
		Vector2(0.101341, 0.570878),
		Vector2(0.220239, 0.570878),
		Vector2(0.216041, 0.636984),
		Vector2(0.095359, 0.636984)
	],
	[
		Vector2(0.107149, 0.506699),
		Vector2(0.224315, 0.506699),
		Vector2(0.220239, 0.570878),
		Vector2(0.101341, 0.570878)
	],
	[
		Vector2(0.11279, 0.444363),
		Vector2(0.228274, 0.444363),
		Vector2(0.224315, 0.506699),
		Vector2(0.107149, 0.506699)
	],
	[
		Vector2(0.118272, 0.383792),
		Vector2(0.23212, 0.383792),
		Vector2(0.228274, 0.444363),
		Vector2(0.11279, 0.444363)
	],
	[
		Vector2(0.1236, 0.324911),
		Vector2(0.23586, 0.324911),
		Vector2(0.23212, 0.383792),
		Vector2(0.118272, 0.383792)
	],
	[
		Vector2(0.128782, 0.267652),
		Vector2(0.239496, 0.267652),
		Vector2(0.23586, 0.324911),
		Vector2(0.1236, 0.324911)
	],
	[
		Vector2(0.133823, 0.211948),
		Vector2(0.243033, 0.211948),
		Vector2(0.239496, 0.267652),
		Vector2(0.128782, 0.267652)
	],
	[
		Vector2(0.138728, 0.157736),
		Vector2(0.246476, 0.157736),
		Vector2(0.243033, 0.211948),
		Vector2(0.133823, 0.211948)
	],
	[
		Vector2(0.148186, 0.053225),
		Vector2(0.253113, 0.053225),
		Vector2(0.246476, 0.157736),
		Vector2(0.138728, 0.157736)
	],
	[
		Vector2(0.253113, 0.053225),
		Vector2(0.307977, 0.053225),
		Vector2(0.302815, 0.157736),
		Vector2(0.246476, 0.157736)
	],
	[
		Vector2(0.307977, 0.053225),
		Vector2(0.362841, 0.053225),
		Vector2(0.359153, 0.157736),
		Vector2(0.302815, 0.157736)
	],
	[
		Vector2(0.362841, 0.053225),
		Vector2(0.417704, 0.053225),
		Vector2(0.415492, 0.157736),
		Vector2(0.359153, 0.157736)
	],
	[
		Vector2(0.417704, 0.053225),
		Vector2(0.472568, 0.053225),
		Vector2(0.471831, 0.157736),
		Vector2(0.415492, 0.157736)
	],
	[
		Vector2(0.472568, 0.053225),
		Vector2(0.527432, 0.053225),
		Vector2(0.528169, 0.157736),
		Vector2(0.471831, 0.157736)
	],
	[
		Vector2(0.527432, 0.053225),
		Vector2(0.582296, 0.053225),
		Vector2(0.584508, 0.157736),
		Vector2(0.528169, 0.157736)
	],
	[
		Vector2(0.582296, 0.053225),
		Vector2(0.637159, 0.053225),
		Vector2(0.640847, 0.157736),
		Vector2(0.584508, 0.157736)
	],
	[
		Vector2(0.637159, 0.053225),
		Vector2(0.692023, 0.053225),
		Vector2(0.697185, 0.157736),
		Vector2(0.640847, 0.157736)
	],
	[
		Vector2(0.692023, 0.053225),
		Vector2(0.746887, 0.053225),
		Vector2(0.753524, 0.157736),
		Vector2(0.697185, 0.157736)
	],
	[
		Vector2(0.746887, 0.053225),
		Vector2(0.851814, 0.053225),
		Vector2(0.861272, 0.157736),
		Vector2(0.753524, 0.157736)
	],
	[
		Vector2(0.753524, 0.157736),
		Vector2(0.861272, 0.157736),
		Vector2(0.866177, 0.211948),
		Vector2(0.756967, 0.211948)
	],
	[
		Vector2(0.756967, 0.211948),
		Vector2(0.866177, 0.211948),
		Vector2(0.871218, 0.267652),
		Vector2(0.760504, 0.267652)
	],
	[
		Vector2(0.760504, 0.267652),
		Vector2(0.871218, 0.267652),
		Vector2(0.8764, 0.324911),
		Vector2(0.76414, 0.324911)
	],
	[
		Vector2(0.76414, 0.324911),
		Vector2(0.8764, 0.324911),
		Vector2(0.881728, 0.383792),
		Vector2(0.76788, 0.383792)
	],
	[
		Vector2(0.76788, 0.383792),
		Vector2(0.881728, 0.383792),
		Vector2(0.88721, 0.444363),
		Vector2(0.771726, 0.444363)
	],
	[
		Vector2(0.771726, 0.444363),
		Vector2(0.88721, 0.444363),
		Vector2(0.892851, 0.506699),
		Vector2(0.775685, 0.506699)
	],
	[
		Vector2(0.775685, 0.506699),
		Vector2(0.892851, 0.506699),
		Vector2(0.898659, 0.570878),
		Vector2(0.77976, 0.570878)
	],
	[
		Vector2(0.77976, 0.570878),
		Vector2(0.898659, 0.570878),
		Vector2(0.904641, 0.636984),
		Vector2(0.783959, 0.636984)
	],
	[
		Vector2(0.783959, 0.636984),
		Vector2(0.904641, 0.636984),
		Vector2(0.910805, 0.705104),
		Vector2(0.788285, 0.705104)
	],
]
const IMAGE_RATIO := 1.2727272727272727
const HOMOGRAPHY: Array[float] = [
	0.765042, -0.09543849, 0.117479, 0, 0.73190475, 0.020574, 0, -0.19087698, 1
]
## The printed players' panel in board units (PLAYER_PANEL in boardGeometry.ts).
const PANEL_AVATAR := Vector3(0.262, 0.296, 0.058)
const PANEL_NAME := Vector2(0.34, 0.243)
const PANEL_CASH := Vector2(0.34, 0.292)
const PANEL_SEATS: Array[Vector2] = [
	Vector2(0.618, 0.217), Vector2(0.618, 0.2655), Vector2(0.618, 0.314), Vector2(0.618, 0.3625)
]
const PANEL_SEAT_RADIUS := 0.019
## The green field inside the squares, in board units.
const FIELD := Rect2(0.155, 0.412, 0.69, 0.378)


## A point of the printed board (board units) on board-25d.webp (fractions of its size).
static func plane_point(at: Vector2) -> Vector2:
	var h: Array[float] = HOMOGRAPHY
	var w: float = h[6] * at.x + h[7] * at.y + h[8]
	return Vector2((h[0] * at.x + h[1] * at.y + h[2]) / w, (h[3] * at.x + h[4] * at.y + h[5]) / w)


## A point inside square `i` (u across it, v down it, both 0–1), on board-25d.webp.
static func cell_point(i: int, u: float, v: float) -> Vector2:
	var q: Array = CELLS[i]
	var a: Vector2 = q[0]
	var b: Vector2 = q[1]
	var c: Vector2 = q[2]
	var d: Vector2 = q[3]
	return a * (1.0 - u) * (1.0 - v) + b * u * (1.0 - v) + c * u * v + d * (1.0 - u) * v


static func is_deed(i: int) -> bool:
	return SQUARES[i]["kind"] in ["street", "station", "utility"]


static func price(i: int) -> int:
	return int(SQUARES[i].get("price", 0))


## The least raise in an owner's auction (`auctionRaise`).
static func auction_raise(i: int) -> int:
	return ceili(price(i) / 5.0)


static func group_of(i: int) -> Array[int]:
	var out: Array[int] = []
	var group: String = str(SQUARES[i].get("group", ""))
	if group == "":
		return out
	for j: int in SQUARES.size():
		if SQUARES[j].get("group", "") == group:
			out.append(j)
	return out


static func owns_group(properties: Array, owner: int, i: int) -> bool:
	var squares: Array[int] = group_of(i)
	if squares.is_empty():
		return false
	for j: int in squares:
		if _owner(properties, j) != owner:
			return false
	return true


static func _owner(properties: Array, i: int) -> int:
	var owner: Variant = (properties[i] as Dictionary).get("owner")
	return -1 if owner == null else int(owner)


## What landing on `i` costs right now (`rent`), with `roll` for a utility.
static func rent(view: Dictionary, i: int, roll: int = 7) -> int:
	var properties: Array = view["properties"]
	var deed: Dictionary = properties[i]
	var owner: int = _owner(properties, i)
	if owner < 0 or bool(deed["mortgaged"]) or bool(view["players"][owner]["jailed"]):
		return 0
	var kind: String = SQUARES[i]["kind"]
	if kind == "station":
		var count: int = 0
		for j: int in STATIONS:
			count += 1 if _owner(properties, j) == owner else 0
		return STATION_FEE * count
	if kind == "utility":
		return roll * utility_multiplier(view, i)
	var ladder: Array = SQUARES[i]["rent"]
	return int(ladder[int(deed["houses"])]) * (3 if owns_group(properties, owner, i) else 1)


static func utility_multiplier(view: Dictionary, i: int) -> int:
	var properties: Array = view["properties"]
	var owner: int = _owner(properties, i)
	if owner < 0:
		return 0
	var both: bool = (
		_owner(properties, UTILITIES[0]) == owner and _owner(properties, UTILITIES[1]) == owner
	)
	var shortage: bool = false
	for event: Variant in view.get("shortages", []):
		var e: Dictionary = event
		shortage = shortage or (int(e["square"]) == i and int(e["round"]) == int(view["round"]))
	return (10 if both else 4) * (2 if shortage else 1)


static func mortgage_amount(properties: Array, i: int) -> int:
	var deed: Dictionary = properties[i]
	return int((price(i) + int(deed["houses"]) * int(SQUARES[i].get("houseCost", 0))) / 2.0)


static func redeem_amount(properties: Array, i: int) -> int:
	var deed: Dictionary = properties[i]
	var principal: int = mortgage_amount(properties, i)
	if deed.get("mortgage") is Dictionary:
		principal = int(deed["mortgage"]["principal"])
	return ceili(principal * 11 / 10.0)


static func bank_houses(properties: Array) -> int:
	var used: int = 0
	for deed: Variant in properties:
		var houses: int = int((deed as Dictionary)["houses"])
		used += 0 if houses == 5 else houses
	return 32 - used


static func bank_hotels(properties: Array) -> int:
	var used: int = 0
	for deed: Variant in properties:
		used += 1 if int((deed as Dictionary)["houses"]) == 5 else 0
	return 12 - used


## "Chuộc: còn 2 lượt" (`mortgageStatus`).
static func mortgage_status(view: Dictionary, i: int) -> String:
	var deed: Dictionary = view["properties"][i]
	if deed.get("mortgage") is not Dictionary:
		return "Đang thế chấp"
	var borrower: int = int(deed["mortgage"]["borrower"])
	var remaining: int = int(deed["mortgage"]["deadline"]) - int(view["playerTurns"][borrower])
	var left: int = remaining + (1 if int(view["turn"]) == borrower and remaining < 3 else 0)
	return "Chuộc: hết lượt này" if remaining <= 0 else "Chuộc: còn %d lượt" % left


## Whose decision the room waits on (`decisionSeat`).
static func decision_seat(view: Dictionary) -> int:
	var phase: String = view["phase"]
	if phase == "auction" and view.get("auction") is Dictionary:
		return int(view["auction"]["bidder"])
	if phase == "trade" and view.get("trade") is Dictionary:
		return int(view["trade"]["to"])
	if phase == "debt" and view.get("debt") is Dictionary and view["debt"].get("payer") != null:
		return int(view["debt"]["payer"])
	return int(view["turn"])


## What the Bid button offers: one more contribution at a station, the least raise elsewhere.
static func bid_amount(view: Dictionary) -> int:
	var auction: Dictionary = view["auction"]
	if auction.get("seller") == null:
		return int(auction["highest"]) + STATION_STEP
	return int(auction["highest"]) + auction_raise(int(auction["square"]))


## Each seat's net change over a view's money transfers ({seat: amount}).
static func net_changes(transfers: Array) -> Dictionary:
	var net: Dictionary = {}
	for item: Variant in transfers:
		var transfer: Dictionary = item
		var amount: int = int(transfer["amount"])
		if transfer.get("from") != null:
			net[int(transfer["from"])] = int(net.get(int(transfer["from"]), 0)) - amount
		if transfer.get("to") != null:
			net[int(transfer["to"])] = int(net.get(int(transfer["to"]), 0)) + amount
	return net


## The sound of a view's money: rent, a purchase, or coins.
static func money_sound(transfers: Array) -> String:
	var sound: String = "coin"
	for item: Variant in transfers:
		var reason: String = str((item as Dictionary).get("reason", ""))
		if reason.begins_with("Tiền thuê"):
			return "rent"
		if reason.begins_with("Mua"):
			sound = "buy"
	return sound
