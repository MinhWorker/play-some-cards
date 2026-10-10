class_name XomDaoUi
extends RefCounted
## The shared look of every screen and game (docs/art-direction.md): the palette, the fonts,
## the sizes, the button colours per kind of action, the theme and the UI sounds.
##
##   theme = XomDaoUi.theme()                 # on the root Control of a screen
##   XomDaoUi.play(self, XomDaoUi.SOUND_TAP)  # the shared UI sounds
##   XomDaoUi.money(2450)                     # "2.450"

## What a button does, which picks its colours (art-direction.md, "Màu nút theo loại hành động").
enum Kind { PLAY, GO, SOCIAL, CONFIRM, BACK, INFO, DANGER }

const SKY := Color("#8FD3F4")
const SEA := Color("#3EC1C9")
const SEA_DEEP := Color("#1E8FA6")
const SAND := Color("#F3DDB0")
const PAPER := Color("#FBF1DC")
const PAPER_DARK := Color("#E6D2AA")
const HONEY := Color("#D9963F")
const HONEY_DARK := Color("#9C5F2A")
const BAMBOO := Color("#6DB34A")
const BAMBOO_DARK := Color("#3F7F33")
const LANTERN := Color("#E0352B")
const LACQUER := Color("#B8262A")
const LACQUER_DARK := Color("#7A1418")
const GOLD := Color("#E7B53C")
const GOLD_DARK := Color("#B9822A")
const COIN := Color("#D4A24C")
const COIN_DARK := Color("#8F6526")
const GEM := Color("#3FBF7F")
const GEM_DARK := Color("#23875A")
const INK := Color("#4A2E1C")
const CREAM := Color("#FFF6E3")
const HUD := Color(0.227, 0.141, 0.086, 0.85)
const SHADOW := Color(0.227, 0.141, 0.086, 0.25)
## Numbers that went up or down, on a dark background and on paper.
const UP := Color("#3FBF7F")
const DOWN := Color("#E0352B")
const UP_ON_PAPER := Color("#2E8B4A")
const DOWN_ON_PAPER := Color("#B3261E")

## Sizes in frame units (docs/ui-guide.md).
const TOUCH := 88.0
const TEXT_MIN := 24
const TEXT := 32
const TITLE := 48
const RADIUS := 24
const BORDER := 3
const PAD := 32

const SOUND_TAP := "tap"
const SOUND_PANEL := "panel"
const SOUND_COIN := "coin"

const _DIR := "res://addons/xomdao_sdk/ui/"
## Background and border of a button per Kind.
const _KIND_COLORS: Dictionary = {
	Kind.PLAY: [LACQUER, GOLD],
	Kind.GO: [LACQUER, GOLD],
	Kind.SOCIAL: [Color("#1E8FA6"), Color("#14687A")],
	Kind.CONFIRM: [Color("#3F7F33"), Color("#2B5A23")],
	Kind.BACK: [Color("#4E5D6C"), Color("#36414C")],
	Kind.INFO: [Color("#9C5F2A"), Color("#6E4220")],
	Kind.DANGER: [Color("#3A2416"), LANTERN],
}

static var _theme: Theme
static var _fonts: Dictionary = {}
static var _players: Dictionary = {}


## Baloo 2 at a weight (700 bold, 800 extra bold): titles, numbers, button labels.
static func display_font(weight: int = 800) -> Font:
	var key: String = "baloo%d" % weight
	if not _fonts.has(key):
		var font := FontVariation.new()
		font.base_font = load(_DIR + "fonts/Baloo2.ttf")
		font.variation_opentype = {
			TextServerManager.get_primary_interface().name_to_tag("wght"): weight
		}
		font.opentype_features = {TextServerManager.get_primary_interface().name_to_tag("tnum"): 1}
		_fonts[key] = font
	return _fonts[key]


## Be Vietnam Pro: body text (Medium) and small labels (SemiBold).
static func body_font(semibold: bool = false) -> Font:
	var file: String = "BeVietnamPro-SemiBold.ttf" if semibold else "BeVietnamPro-Medium.ttf"
	if not _fonts.has(file):
		_fonts[file] = load(_DIR + "fonts/" + file)
	return _fonts[file]


## A Phosphor (Fill) icon by name: list, arrow-left, gear, speaker-high, x, users, clock…
static func icon(name: String) -> Texture2D:
	return load(_DIR + "icons/%s.svg" % name)


## The background and border colours of a button that does this kind of action.
static func kind_colors(kind: Kind) -> Array[Color]:
	var pair: Array = _KIND_COLORS[kind]
	return [pair[0], pair[1]]


## A rounded box: the base of buttons, chips, pills and panels.
static func box(
	color: Color, border: Color = Color.TRANSPARENT, border_width: int = 0, radius: float = RADIUS
) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(int(radius))
	style.corner_detail = 12
	style.anti_aliasing = true
	return style


## Adds the short soft shadow every raised thing casts (light from the top left).
static func with_shadow(style: StyleBoxFlat) -> StyleBoxFlat:
	style.shadow_color = SHADOW
	style.shadow_size = 4
	style.shadow_offset = Vector2(4.0, 6.0)
	return style


## The shared theme: fonts, text colours and the default look of plain controls.
static func theme() -> Theme:
	if _theme != null:
		return _theme
	_theme = Theme.new()
	_theme.default_font = body_font()
	_theme.default_font_size = TEXT
	_theme.set_color("font_color", "Label", INK)
	_theme.set_font("font", "Button", display_font(800))
	_theme.set_font_size("font_size", "Button", 32)
	for state: String in [
		"font_color", "font_hover_color", "font_pressed_color", "font_focus_color"
	]:
		_theme.set_color(state, "Button", CREAM)
	_theme.set_color("font_disabled_color", "Button", CREAM)
	_theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	_theme.set_stylebox("panel", "PanelContainer", box(PAPER, PAPER_DARK, BORDER))
	_theme.set_type_variation("TitleLabel", "Label")
	_theme.set_font("font", "TitleLabel", display_font(800))
	_theme.set_font_size("font_size", "TitleLabel", TITLE)
	_theme.set_type_variation("HudLabel", "Label")
	_theme.set_font("font", "HudLabel", display_font(800))
	_theme.set_color("font_color", "HudLabel", CREAM)
	_theme.set_type_variation("SmallLabel", "Label")
	_theme.set_font("font", "SmallLabel", body_font(true))
	_theme.set_font_size("font_size", "SmallLabel", TEXT_MIN)
	return _theme


## "2.450": a whole amount with dots between thousands.
static func money(amount: int) -> String:
	var digits: String = str(absi(amount))
	var out: String = ""
	for i: int in digits.length():
		if i > 0 and (digits.length() - i) % 3 == 0:
			out += "."
		out += digits[i]
	return ("−" if amount < 0 else "") + out


## "+120" or "−20" (a real minus sign); 0 stays "0".
static func delta(amount: int) -> String:
	return ("+" if amount > 0 else "") + money(amount)


## The colour of a change: green when up, red when down, `still` when 0.
static func delta_color(amount: int, on_paper: bool = false, still: Color = INK) -> Color:
	if amount > 0:
		return UP_ON_PAPER if on_paper else UP
	if amount < 0:
		return DOWN_ON_PAPER if on_paper else DOWN
	return still


## Plays a shared UI sound (SOUND_TAP, SOUND_PANEL, SOUND_COIN) unless the player muted sound.
static func play(from: Node, sound: String) -> void:
	if not XomDaoSettings.current().sound or from == null or not from.is_inside_tree():
		return
	var root: Window = from.get_tree().root
	var player: AudioStreamPlayer = _players.get(sound)
	if player == null or not is_instance_valid(player):
		player = AudioStreamPlayer.new()
		player.name = "XomDaoSound_" + sound
		player.stream = load(_DIR + "sounds/%s.wav" % sound)
		player.max_polyphony = 4
		# Deferred: the root may be busy adding children when the first sound plays.
		root.add_child.call_deferred(player)
		_players[sound] = player
	if player.is_inside_tree():
		player.play()
	elif player.ready.get_connections().is_empty():
		player.ready.connect(player.play.bind(0.0), CONNECT_ONE_SHOT)


## The "bounce" every pressed thing does: down to 94% in 80 ms, back in 120 ms.
static func bounce(node: Control) -> void:
	node.pivot_offset = node.size / 2.0
	var tween: Tween = node.create_tween()
	tween.tween_property(node, "scale", Vector2.ONE * 0.94, 0.08)
	tween.tween_property(node, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK)
