extends GutTest


func test_core_is_centred_in_a_wide_frame() -> void:
	var rect: Rect2 = XomDaoFrame.core_rect(Vector2(1600.0, 720.0))
	assert_eq(rect.position, Vector2(320.0, 0.0))
	assert_eq(rect.size, XomDaoFrame.CORE)


func test_autoloads_are_registered() -> void:
	for autoload: String in ["Net", "Session", "Wallet", "ContentLoader"]:
		assert_not_null(get_tree().root.get_node_or_null(autoload), autoload)


func test_main_scene_fills_the_frame() -> void:
	var main: Control = add_child_autofree(load("res://hub/main.tscn").instantiate())
	var core: Control = main.get_node("Core")
	assert_eq(core.size, XomDaoFrame.CORE)
