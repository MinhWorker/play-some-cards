extends GutTest


func test_core_is_centred_in_a_wide_frame() -> void:
	var rect: Rect2 = XomDaoFrame.core_rect(Vector2(1600.0, 720.0))
	assert_eq(rect.position, Vector2(320.0, 0.0))
	assert_eq(rect.size, XomDaoFrame.CORE)


func test_autoloads_are_registered() -> void:
	for autoload: String in ["Net", "Session", "Wallet", "ContentLoader", "TestBridge"]:
		assert_not_null(get_tree().root.get_node_or_null(autoload), autoload)


func test_main_scene_starts_by_connecting() -> void:
	var main: Control = add_child_autofree(load("res://hub/main.tscn").instantiate())
	var screen: Control = main.get_node("Screen")
	assert_eq(screen.size, main.size)
	await wait_process_frames(2)
	assert_eq(TestBridge.scene, "status")
