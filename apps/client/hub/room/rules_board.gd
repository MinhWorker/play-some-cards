class_name HubRulesBoard
extends Control
## Luật: a game's rules on a paper board that scrolls, over a shade. The text is the game's
## RULES.md (godot:export puts it in the game's pack), or its one-line introduction without one.

const WIDTH := 640.0
const HEIGHT := 380.0

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Luật", true)
var _text := Label.new()


static func create(title: String, text: String) -> HubRulesBoard:
	var board := HubRulesBoard.new()
	board._board.title = title
	board._text.text = text
	return board


## Markdown made readable as plain text: no heading marks, emphasis or code ticks, and the
## first heading (the game's name, already on the board) dropped.
static func plain(markdown: String) -> String:
	var lines: PackedStringArray = []
	for line: String in markdown.split("\n"):
		if line.begins_with("# ") and lines.is_empty():
			continue
		var text: String = line.lstrip("#").strip_edges() if line.begins_with("#") else line
		if text.begins_with("- "):
			text = "• " + text.substr(2)
		lines.append(text.replace("**", "").replace("`", ""))
	return "\n".join(lines).strip_edges()


func _init() -> void:
	name = "RulesBoard"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	_board.closed.connect(queue_free)
	add_child(_board)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(WIDTH, HEIGHT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_board.content.add_child(scroll)
	_text.name = "RulesText"
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.custom_minimum_size.x = WIDTH - 24.0
	_text.add_theme_font_size_override("font_size", 28)
	scroll.add_child(_text)
	resized.connect(_layout)


func _ready() -> void:
	_board.open()
	_layout()


func _on_shade_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		queue_free()


func _layout() -> void:
	_board.reset_size()
	_board.position = (size - _board.size) / 2.0
