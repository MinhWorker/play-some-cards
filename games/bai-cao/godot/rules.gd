extends RefCounted
## The card rules the table shows, ported from src/game/cards.ts (the server decides; this only
## names hands and picks sounds). A card is 0–51: `rank * 4 + suit`, rank 0–12 = A 2 … 10 J Q K,
## suit 0–3 = ♣ ♠ ♥ ♦.

const RANKS: Array[String] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
## XomDaoCard's suit (♠ ♣ ♦ ♥) for each of ours (♣ ♠ ♥ ♦).
const CARD_SUIT: Array[int] = [1, 0, 3, 2]


static func rank_of(card: int) -> int:
	return card / 4


## A card's points: A is 1, 2–9 their number, 10 J Q K nothing.
static func points_of(card: int) -> int:
	return 0 if rank_of(card) >= 9 else rank_of(card) + 1


## Ba Tây: three face cards (J, Q, K).
static func is_tay(cards: Array) -> bool:
	return cards.size() == 3 and cards.all(func(card: Variant) -> bool: return int(card) / 4 >= 10)


## What a hand is called: "Ba Tây", "9 nút", "Bù".
static func hand_name(cards: Array) -> String:
	if is_tay(cards):
		return "Ba Tây"
	var points: int = 0
	for card: Variant in cards:
		points += points_of(int(card))
	points %= 10
	return "%d nút" % points if points > 0 else "Bù"
