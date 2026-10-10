extends RefCounted
## The card rules the table needs on screen, ported from src/game/cards.ts (the server decides;
## this only greys out Đánh and picks the sound and words of a play). A card is 0–51:
## `rank * 4 + suit`, rank 0–12 = 3 … A 2, suit 0–3 = ♠ ♣ ♦ ♥.

const RANKS: Array[String] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
const SUITS: Array[String] = ["spade", "club", "diamond", "heart"]
## The rank of 2 ("heo").
const TWO := 12


static func rank_of(card: int) -> int:
	return card / 4


static func is_red(card: int) -> bool:
	return card % 4 >= 2


## What these cards make: {kind, size, top}, or {} when they are no combination. Kinds: single,
## pair, triple, quad, straight (3+ ranks in a row, no 2), pairs (3+ pairs in a row, no 2).
static func combo_of(cards: Array) -> Dictionary:
	var sorted: Array[int] = []
	for card: Variant in cards:
		if sorted.has(int(card)):
			return {}
		sorted.append(int(card))
	sorted.sort()
	var size: int = sorted.size()
	if size == 0:
		return {}
	var top: int = sorted[size - 1]
	var ranks: Array[int] = []
	for card: int in sorted:
		ranks.append(rank_of(card))
	if size == 1:
		return {"kind": "single", "size": 1, "top": top}
	if ranks.all(func(r: int) -> bool: return r == ranks[0]) and size <= 4:
		return {"kind": ["pair", "triple", "quad"][size - 2], "size": size, "top": top}
	if ranks.has(TWO):
		return {}
	if size >= 3 and _in_row(ranks, 1):
		return {"kind": "straight", "size": size, "top": top}
	if size >= 6 and size % 2 == 0 and _in_row(ranks, 2):
		return {"kind": "pairs", "size": size, "top": top}
	return {}


## Whether `play` may go on `table` ({} for a new trick: anything goes).
static func beats(play: Dictionary, table: Dictionary) -> bool:
	if play.is_empty():
		return false
	if table.is_empty():
		return true
	if play["kind"] == table["kind"] and play["size"] == table["size"]:
		return int(play["top"]) > int(table["top"])
	# Chặt: bombs beat the 2s and smaller bombs.
	var twos: bool = (
		rank_of(int(table["top"])) == TWO and (table["kind"] == "single" or table["kind"] == "pair")
	)
	var mine: int = _pairs(play)
	var theirs: int = _pairs(table)
	if mine == 3:
		return twos and table["kind"] == "single"
	if play["kind"] == "quad":
		return twos or theirs == 3
	if mine >= 4:
		return twos or table["kind"] == "quad" or (theirs >= 3 and mine > theirs)
	return false


## How a play hits the table, put on `before` (a play of the same trick, or {}): the sound, and
## the big words and their color for special plays ("" for none).
static func impact(play: Dictionary, before: Dictionary) -> Dictionary:
	var combo: Dictionary = combo_of(play.get("cards", []))
	var table: Dictionary = {}
	if not before.is_empty() and int(before.get("trick", -1)) == int(play.get("trick", -2)):
		table = combo_of(before.get("cards", []))
	var plain: String = "card-play" if combo.get("kind", "") == "single" else "combo"
	var out: Dictionary = {"sound": plain, "words": "", "color": Color("#FFE066"), "bomb": false}
	if combo.is_empty():
		return out
	if not table.is_empty() and (combo["kind"] != table["kind"] or combo["size"] != table["size"]):
		var words: String = "Chặt chồng!"
		if rank_of(int(table["top"])) == TWO:
			words = "Chặt đôi heo!" if table["kind"] == "pair" else "Chặt heo!"
		return {"sound": "special-cut", "words": words, "color": Color("#FF7A45"), "bomb": true}
	if combo["kind"] == "quad":
		return {"sound": "bomb", "words": "Tứ quý!", "color": Color("#FFB02E"), "bomb": true}
	if combo["kind"] == "pairs":
		var count: String = ["", "", "", "Ba", "Bốn", "Năm", "Sáu"][int(combo["size"]) / 2]
		var words: String = "%s đôi thông!" % count
		return {"sound": "bomb", "words": words, "color": Color("#FFB02E"), "bomb": true}
	if rank_of(int(combo["top"])) == TWO:
		var twos: Dictionary = {"single": "Heo!", "pair": "Đôi heo!", "triple": "Ba heo!"}
		out["words"] = str(twos.get(combo["kind"], ""))
		return out
	if combo["kind"] == "straight" and int(combo["size"]) >= 7:
		out["sound"] = "special-hand"
		out["words"] = "Sảnh rồng!" if int(combo["size"]) == 12 else "Sảnh dài!"
	return out


static func _in_row(ranks: Array[int], step: int) -> bool:
	for i: int in ranks.size():
		if ranks[i] != ranks[0] + i / step:
			return false
	return true


static func _pairs(combo: Dictionary) -> int:
	return int(combo["size"]) / 2 if combo["kind"] == "pairs" else 0
