extends XomDaoCard
## One Tiến Lên card (XomDaoCard, the SDK's card face) by its number: `card` 0–51 as in
## rules.gd, or -1 face down.

const Rules := preload("res://content/tien-len/rules.gd")

## The card shown face up, or -1 face down.
var card: int = -1:
	set(value):
		card = value
		if value < 0:
			show_face("", 0)
		else:
			show_face(Rules.RANKS[Rules.rank_of(value)], value % 4)


static func create(value: int, width: float) -> Control:
	var view: Control = load("res://content/tien-len/card.gd").new()
	view.set("card", value)
	view.size = Vector2(width, width * RATIO)
	return view
