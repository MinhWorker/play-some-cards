class_name XomDaoCard
extends Control
## One playing card for the card games: the classic face (a blank card, the rank in the app's
## font, the suit symbols) or the back the holder wears. It fills its own rect, 2:3; whoever holds
## it moves, sizes and turns it. Each game maps its own card numbers to `rank` and `suit`.

## Height / width.
const RATIO := 1.5
## The suits, in `suit` order.
const SUITS: Array[String] = ["spade", "club", "diamond", "heart"]
const RED := Color("#C8102E")
const BLACK := Color("#1D1D1F")
## Centres from the card's middle (in card widths / heights) and sizes (in card widths).
const RANK_SPOT := Vector3(-0.27, -0.34, 0.32)
const SMALL_SPOT := Vector3(-0.27, -0.15, 0.22)
const BIG_SPOT := Vector3(0.1, 0.14, 0.52)

const _FACE: Texture2D = preload("res://addons/xomdao_sdk/ui/cards/face-classic.webp")
const _SUIT_ART: Array[Texture2D] = [
	preload("res://addons/xomdao_sdk/ui/cards/suit-spade.webp"),
	preload("res://addons/xomdao_sdk/ui/cards/suit-club.webp"),
	preload("res://addons/xomdao_sdk/ui/cards/suit-diamond.webp"),
	preload("res://addons/xomdao_sdk/ui/cards/suit-heart.webp"),
]

## The rank as printed ("A", "10", "K"), or "" face down.
var rank: String = "":
	set(value):
		rank = value
		queue_redraw()

## 0–3 = ♠ ♣ ♦ ♥ (the two last are red).
var suit: int = 0:
	set(value):
		suit = value
		queue_redraw()

## A gold edge on a picked card.
var picked: bool = false:
	set(value):
		picked = value
		queue_redraw()

## The back it shows face down: the card back its holder wears (XomDaoLooks).
var back: Texture2D = XomDaoLooks.card_back(""):
	set(value):
		back = value
		queue_redraw()

## Dims the card (a play under the newest one on the pile, a weaker hand).
var dim: bool = false:
	set(value):
		dim = value
		self_modulate = Color(0.82, 0.8, 0.76) if value else Color.WHITE


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(_on_resized)


## Face up when it has a rank.
func is_face_up() -> bool:
	return rank != ""


## Shows this face (or the back, with an empty rank).
func show_face(rank_text: String, suit_index: int) -> void:
	suit = suit_index
	rank = rank_text


func _on_resized() -> void:
	pivot_offset = size / 2.0
	queue_redraw()


func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	var shadow: StyleBoxFlat = XomDaoUi.box(
		Color(0, 0, 0, 0.22), Color.TRANSPARENT, 0, size.x * 0.08
	)
	shadow.draw(get_canvas_item(), Rect2(Vector2(2.0, 3.0), size))
	if rank == "":
		draw_texture_rect(back, rect, false)
	else:
		_draw_face(rect)
	if picked:
		var edge: StyleBoxFlat = XomDaoUi.box(Color(0, 0, 0, 0), XomDaoUi.GOLD, 4, size.x * 0.08)
		edge.draw(get_canvas_item(), rect.grow(1.0))


func _draw_face(rect: Rect2) -> void:
	draw_texture_rect(_FACE, rect, false)
	var w: float = size.x
	var h: float = size.y
	var middle: Vector2 = size / 2.0
	var ink: Color = RED if suit >= 2 else BLACK
	var font: Font = XomDaoUi.display_font(800)
	# The spot's size is the letter height; a font's cap height is about 0.72 of its size.
	var font_size: int = maxi(8, int(w * RANK_SPOT.z / 0.72))
	var text_size: Vector2 = font.get_string_size(rank, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
	var at: Vector2 = middle + Vector2(w * RANK_SPOT.x, h * RANK_SPOT.y)
	var ascent: float = font.get_ascent(font_size)
	var baseline: Vector2 = at + Vector2(-text_size.x / 2.0, ascent - text_size.y / 2.0)
	if rank.length() > 1:
		# Two letters: squeeze them into the corner.
		draw_set_transform(at, 0.0, Vector2(0.78, 1.0))
		baseline = Vector2(-text_size.x / 2.0, ascent - text_size.y / 2.0)
	draw_string(font, baseline, rank, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)
	draw_set_transform(Vector2.ZERO)
	var art: Texture2D = _SUIT_ART[clampi(suit, 0, 3)]
	_draw_suit(art, middle + Vector2(w * SMALL_SPOT.x, h * SMALL_SPOT.y), w * SMALL_SPOT.z)
	_draw_suit(art, middle + Vector2(w * BIG_SPOT.x, h * BIG_SPOT.y), w * BIG_SPOT.z)


func _draw_suit(texture: Texture2D, center: Vector2, width: float) -> void:
	var height: float = width * texture.get_height() / texture.get_width()
	draw_texture_rect(
		texture, Rect2(center - Vector2(width, height) / 2.0, Vector2(width, height)), false
	)
