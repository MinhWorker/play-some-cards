extends SceneTree
## Compiles every script and loads every scene of the client and the linked games, so parse
## errors and warnings set to errors (untyped declarations) fail the check.
## Run by tools/godot/check.mjs: godot --headless --path apps/client --script <this file>.

const SKIP: Array[String] = ["res://addons/gut/", "res://.godot/"]
const EXTENSIONS: Array[String] = ["gd", "tscn", "tres"]


func _initialize() -> void:
	var failed: Array[String] = []
	for path: String in _files("res://"):
		if ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE) == null:
			failed.append(path)
	for path: String in failed:
		printerr("Failed to load: " + path)
	quit(1 if failed else 0)


func _files(dir: String) -> Array[String]:
	var files: Array[String] = []
	for skip: String in SKIP:
		if dir.begins_with(skip):
			return files
	for name: String in DirAccess.get_files_at(dir):
		if name.get_extension() in EXTENSIONS:
			files.append(dir.path_join(name))
	for name: String in DirAccess.get_directories_at(dir):
		if not name.begins_with("."):
			files.append_array(_files(dir.path_join(name) + "/"))
	return files
