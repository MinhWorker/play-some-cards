extends RefCounted
## The card rules the table needs, ported from src/game/cards.ts, scoring.ts and arrange.ts (the
## server decides; this names your rows, warns of binh lủng and arranges for Tự xếp). A card is
## 0–51: `rank * 4 + suit`, rank 0–12 = 2 3 … 10 J Q K A, suit 0–3 = ♠ ♣ ♦ ♥ (XomDaoCard's order).

const RANKS: Array[String] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
const ACE := 12
const HIGH := 0
const PAIR := 1
const TWO_PAIRS := 2
const TRIPS := 3
const STRAIGHT := 4
const FLUSH := 5
const FULL_HOUSE := 6
const QUADS := 7
const STRAIGHT_FLUSH := 8
const HAND_NAMES: Array[String] = [
	"Mậu thầu", "Đôi", "Thú", "Sám cô", "Sảnh", "Thùng", "Cù lũ", "Tứ quý", "Thùng phá sảnh"
]
## Tới trắng by kind (SPECIALS in scoring.ts).
const SPECIAL_NAMES: Dictionary = {
	"three-straights": "Ba sảnh",
	"three-flushes": "Ba thùng",
	"six-pairs": "Sáu đôi",
	"five-pairs-trips": "Năm đôi một sám",
	"dragon": "Sảnh rồng",
	"dragon-flush": "Sảnh rồng đồng chất",
}
## Chi won with these is worth more than 1: [chi, category, points] (CHI_BONUSES).
const CHI_BONUSES: Array = [
	[2, TRIPS, 3],
	[1, FULL_HOUSE, 2],
	[0, QUADS, 4],
	[1, QUADS, 8],
	[0, STRAIGHT_FLUSH, 5],
	[1, STRAIGHT_FLUSH, 10]
]
## About how often a chi of each category wins (arrange.ts).
const WIN_CHANCE: Array = [
	[0.0, 0.08, 0.28, 0.5, 0.62, 0.74, 0.86, 0.97, 1.0, 1.0],
	[0.03, 0.3, 0.6, 0.78, 0.86, 0.92, 0.97, 1.0, 1.0, 1.0],
	[0.05, 0.4, 0.95, 0.97, 1.0],
]
const DIGIT := 13
const CATEGORY := 371293  # 13 ** 5


static func rank_of(card: int) -> int:
	return card / 4


## [category, strength] of 3 or 5 cards; a higher strength is the stronger hand (handOf).
static func hand_of(cards: Array) -> Array[int]:
	var ranks: Array[int] = []
	for card: Variant in cards:
		ranks.append(int(card) / 4)
	ranks.sort()
	ranks.reverse()
	var counts: Dictionary = {}
	for r: int in ranks:
		counts[r] = int(counts.get(r, 0)) + 1
	var groups: Array = []
	for r: int in counts:
		groups.append([r, int(counts[r])])
	groups.sort_custom(
		func(a: Array, b: Array) -> bool: return a[1] > b[1] or (a[1] == b[1] and a[0] > b[0])
	)
	var shape: String = ""
	var by_group: Array[int] = []
	for group: Array in groups:
		shape += str(group[1])
		by_group.append(int(group[0]))
	var five: bool = cards.size() == 5
	var flush: bool = five
	if five:
		for card: Variant in cards:
			flush = flush and int(card) % 4 == int(cards[0]) % 4
	var wheel: bool = five and shape == "11111" and ranks == [ACE, 3, 2, 1, 0]
	var run: bool = five and shape == "11111" and (ranks[0] - ranks[4] == 4 or wheel)
	var top: int = 3 if wheel else ranks[0]
	if run and flush:
		return _make(STRAIGHT_FLUSH, [top])
	if shape == "41":
		return _make(QUADS, by_group)
	if shape == "32":
		return _make(FULL_HOUSE, by_group)
	if flush:
		return _make(FLUSH, ranks)
	if run:
		return _make(STRAIGHT, [top])
	if shape.begins_with("3"):
		return _make(TRIPS, by_group)
	if shape.begins_with("22"):
		return _make(TWO_PAIRS, by_group)
	if shape.begins_with("2"):
		return _make(PAIR, by_group)
	return _make(HIGH, ranks)


static func _make(category: int, ranks: Array[int]) -> Array[int]:
	var strength: int = category * CATEGORY
	for i: int in ranks.size():
		strength += ranks[i] * int(pow(DIGIT, 4 - i))
	return [category, strength]


static func hand_name(cards: Array) -> String:
	return HAND_NAMES[hand_of(cards)[0]]


## Why `rows` (chi 1, chi 2, chi 3) are binh lủng, or "" when they are fine.
static func foul_of(rows: Array) -> String:
	var one: int = hand_of(rows[0])[1]
	var two: int = hand_of(rows[1])[1]
	var three: int = hand_of(rows[2])[1]
	if two > one:
		return "Chi 2 mạnh hơn chi 1"
	if three > two:
		return "Chi 3 mạnh hơn chi 2"
	return ""


## The 13 positions (chi 1 = 0–4, chi 2 = 5–9, chi 3 = 10–12) as the three rows.
static func rows_of(order: Array) -> Array:
	return [order.slice(0, 5), order.slice(5, 10), order.slice(10, 13)]


static func chi_points(chi: int, cards: Array) -> int:
	var category: int = hand_of(cards)[0]
	for bonus: Array in CHI_BONUSES:
		if bonus[0] == chi and bonus[1] == category:
			return bonus[2]
	return 1


static func _worth(chi: int, cards: Array) -> float:
	var hand: Array[int] = hand_of(cards)
	var chances: Array = WIN_CHANCE[chi]
	var step: int = mini(hand[0], 2) if chi == 2 else hand[0]
	var low: float = chances[step]
	var high: float = chances[step + 1]
	var chance: float = low + (high - low) * (float(hand[1] % CATEGORY) / CATEGORY)
	return chance * chi_points(chi, cards)


## The best valid rows for 13 cards, as 13 positions (bestRows in arrange.ts).
static func best_order(hand: Array) -> Array:
	var all: int = (1 << hand.size()) - 1
	var bits := PackedByteArray()
	bits.resize(all + 1)
	var strength := PackedInt64Array()
	strength.resize(all + 1)
	var worth := PackedFloat64Array()
	worth.resize(all + 1)
	var worth_two := PackedFloat64Array()
	worth_two.resize(all + 1)
	var fives: Array[int] = []
	for mask: int in all + 1:
		bits[mask] = bits[mask >> 1] + (mask & 1) if mask > 0 else 0
		var n: int = bits[mask]
		if n != 5 and n != 3:
			continue
		var cards: Array = _cards_of(hand, mask)
		strength[mask] = hand_of(cards)[1]
		if n == 5:
			fives.append(mask)
			worth[mask] = _worth(0, cards)
			worth_two[mask] = _worth(1, cards)
		else:
			worth[mask] = _worth(2, cards)
	var best_score: float = -1.0
	var best: Array[int] = [0, 0, 0]
	for one: int in fives:
		var rest: int = all ^ one
		var two: int = rest
		while two:
			if bits[two] == 5:
				var three: int = rest ^ two
				var s2: int = strength[two]
				if s2 <= strength[one] and strength[three] <= s2:
					var score: float = worth[one] + worth_two[two] + worth[three]
					if score > best_score:
						best_score = score
						best = [one, two, three]
			two = (two - 1) & rest
	return _cards_of(hand, best[0]) + _cards_of(hand, best[1]) + _cards_of(hand, best[2])


static func _cards_of(hand: Array, mask: int) -> Array:
	var cards: Array = []
	for i: int in hand.size():
		if mask & (1 << i):
			cards.append(int(hand[i]))
	return cards
