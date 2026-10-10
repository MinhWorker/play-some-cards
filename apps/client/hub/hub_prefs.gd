class_name HubPrefs
extends RefCounted
## What the hub remembers per account on this device (user://hub.cfg): the game on CHƠI.

const PATH := "user://hub.cfg"


static func selected_game(user_id: String, path: String = PATH) -> String:
	var config := ConfigFile.new()
	if config.load(path) != OK:
		return ""
	return str(config.get_value("selected", user_id, ""))


static func set_selected_game(user_id: String, game_id: String, path: String = PATH) -> void:
	var config := ConfigFile.new()
	config.load(path)
	config.set_value("selected", user_id, game_id)
	config.save(path)
