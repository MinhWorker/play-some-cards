class_name HubMoneyRow
extends HBoxContainer
## The top right of every hub screen: the coin balance ("Coins") and ⚙ ("Settings").
## receive() flies coins from a point into the balance and counts it up.

signal settings_pressed

const FLYING := 8

var coins: XomDaoMoney = XomDaoMoney.create(0)
var settings: XomDaoIconButton = XomDaoIconButton.create("gear")


func _init() -> void:
	add_theme_constant_override("separation", 12)
	alignment = BoxContainer.ALIGNMENT_END
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	coins.name = "Coins"
	coins.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	add_child(coins)
	settings.name = "Settings"
	settings.pressed.connect(settings_pressed.emit)
	add_child(settings)


## Shows a balance without fuss.
func show_balance(amount: int) -> void:
	coins.amount = amount


## Coins fly from `from` (global position) into the balance, which then counts up to `amount`.
func receive(amount: int, from: Vector2) -> void:
	if amount == coins.amount:
		return
	if amount < coins.amount or not is_inside_tree():
		coins.count_to(amount)
		return
	var target: Vector2 = coins.global_position + Vector2(36.0, coins.size.y / 2.0)
	for i: int in FLYING:
		var coin := XomDaoResourceIcon.new()
		coin.custom_minimum_size = Vector2(44.0, 44.0)
		coin.size = coin.custom_minimum_size
		coin.top_level = true
		coin.z_index = 50
		add_child(coin)
		coin.global_position = from + Vector2(randf_range(-40.0, 40.0), randf_range(-20.0, 20.0))
		var tween: Tween = coin.create_tween()
		tween.tween_interval(i * 0.05)
		(
			tween
			. tween_property(coin, "global_position", target - coin.size / 2.0, 0.45)
			. set_trans(Tween.TRANS_QUAD)
			. set_ease(Tween.EASE_IN)
		)
		tween.tween_callback(coin.queue_free)
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	await get_tree().create_timer(0.45 + FLYING * 0.05).timeout
	coins.count_to(amount)
