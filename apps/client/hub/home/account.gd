class_name HubAccount
extends Control
## Tài khoản, over Nhà: a guest logs in (username, password) or makes an account (plus the name
## shown in game); someone logged in sees their username and Đăng xuất. The hub acts on the
## signals: it keeps the new token and starts again as that player.

## Logged in, or made an account: the new login token.
signal signed_in(token: String)
signal signed_out

const WIDTH := 600.0
const FIELD_HEIGHT := 64.0

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Tài khoản", true)
var _mode: XomDaoChoice = XomDaoChoice.create(["Đăng nhập", "Tạo tài khoản"])
var _username := LineEdit.new()
var _password := LineEdit.new()
var _name := LineEdit.new()
var _name_label := Label.new()
var _show: XomDaoChoice = XomDaoChoice.create(["Ẩn", "Hiện"])
var _error := Label.new()
var _submit: XomDaoButton = XomDaoButton.create("Vào chơi", XomDaoUi.Kind.GO)
var _busy: bool = false


## The board for `user`: the login form for a guest, Đăng xuất otherwise.
static func create(user: XomDaoUser) -> HubAccount:
	var account := HubAccount.new()
	if Session.is_guest(user):
		account._build_form(user.name if user != null else "")
	else:
		account._build_signed_in(user)
	return account


func _init() -> void:
	name = "Account"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	_board.closed.connect(queue_free)
	add_child(_board)
	_board.content.custom_minimum_size.x = WIDTH
	resized.connect(_layout)


func _ready() -> void:
	_board.open()
	_layout()


func _build_form(guest_name: String) -> void:
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 12)
	_mode.name = "AccountMode"
	_mode.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_mode.changed.connect(func(_index: int) -> void: _switch())
	column.add_child(_mode)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 12)
	column.add_child(grid)
	_field(grid, _label("Tên đăng nhập"), _username, "Username", 20)
	_password.secret = true
	var password_row := HBoxContainer.new()
	password_row.add_theme_constant_override("separation", 8)
	password_row.add_child(_password)
	_show.name = "ShowPassword"
	_show.changed.connect(func(index: int) -> void: _password.secret = index == 0)
	password_row.add_child(_show)
	_field(grid, _label("Mật khẩu"), _password, "Password", 100, password_row)
	_name_label.text = "Tên trong game"
	_style_label(_name_label)
	_name.text = guest_name
	_field(grid, _name_label, _name, "DisplayName", 20)
	_error.name = "AccountError"
	_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_error.custom_minimum_size.x = WIDTH
	_error.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_error.add_theme_color_override("font_color", XomDaoUi.DOWN_ON_PAPER)
	_error.add_theme_font_size_override("font_size", 26)
	_error.visible = false
	column.add_child(_error)
	_submit.name = "AccountSubmit"
	_submit.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_submit.custom_minimum_size.x = 280.0
	_submit.pressed.connect(_send)
	column.add_child(_submit)
	_switch()


func _build_signed_in(user: XomDaoUser) -> void:
	var column: VBoxContainer = _board.content
	var who := Label.new()
	who.name = "AccountUsername"
	who.text = "Tên đăng nhập: %s" % user.username
	who.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	who.add_theme_font_size_override("font_size", 30)
	column.add_child(who)
	var out: XomDaoButton = XomDaoButton.create("Đăng xuất", XomDaoUi.Kind.DANGER)
	out.name = "SignOut"
	out.icon = XomDaoUi.icon("sign-out")
	out.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	out.custom_minimum_size.x = 280.0
	out.pressed.connect(
		func() -> void:
			signed_out.emit()
			queue_free()
	)
	column.add_child(out)


func _field(
	grid: GridContainer,
	label: Label,
	input: LineEdit,
	id: String,
	length: int,
	cell: Control = null
) -> void:
	grid.add_child(label)
	input.name = id
	input.max_length = length
	input.custom_minimum_size = Vector2(320.0, FIELD_HEIGHT)
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_DEFAULT
	input.add_theme_font_size_override("font_size", 28)
	input.text_submitted.connect(func(_text: String) -> void: _send())
	grid.add_child(cell if cell != null else input)


func _label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	_style_label(label)
	return label


func _style_label(label: Label) -> void:
	label.add_theme_font_override("font", XomDaoUi.body_font(true))
	label.add_theme_font_size_override("font_size", 26)
	label.add_theme_color_override("font_color", XomDaoUi.INK)


func _switch() -> void:
	var making: bool = _mode.selected == 1
	_name_label.visible = making
	_name.visible = making
	_submit.text = "Tạo tài khoản" if making else "Vào chơi"
	_error.visible = false
	_layout.call_deferred()


func _send() -> void:
	if _busy:
		return
	var username: String = _username.text.strip_edges()
	var making: bool = _mode.selected == 1
	if username == "" or _password.text == "" or (making and _name.text.strip_edges() == ""):
		_say("Điền đủ các ô")
		return
	_busy = true
	_submit.disabled = true
	var reply: Dictionary
	if making:
		reply = await Session.register(username, _password.text, _name.text.strip_edges())
	else:
		reply = await Session.log_in_with(username, _password.text)
	_busy = false
	_submit.disabled = false
	if reply.has("token"):
		signed_in.emit(str(reply["token"]))
		queue_free()
	else:
		_say(str(reply.get("message", "Máy chủ gặp lỗi, thử lại sau")))


func _say(message: String) -> void:
	_error.text = message
	_error.visible = true
	_layout.call_deferred()


func _on_shade_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and not _busy:
		queue_free()


func _layout() -> void:
	_board.reset_size()
	_board.position = (size - _board.size) / 2.0
