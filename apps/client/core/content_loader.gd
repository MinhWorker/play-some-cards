extends Node
## Loads a game's pack (content/<id>.<hash>.pck, listed in content/manifest.json) on demand.
## Packs are kept in user://content/ under their hashed names, so the next visit loads them
## without a download. In the editor and headless runs the games are already there through the
## content/<id> links (npm run godot:link).

## A pack finished mounting (or failed): loads waiting for it look again.
signal mounted(id: String)

## Bytes downloaded so far by this run (manifest and packs), for the load measurements.
var downloaded: int = 0
var _manifest: Dictionary = {}
## Packs being fetched now, by game id: a second load waits for the first.
var _mounting: Dictionary = {}


## The game's main scene (res://content/<id>/main.tscn), or null when it cannot be loaded.
func load_game(id: String) -> PackedScene:
	var path: String = "res://content/%s/main.tscn" % id
	if not ResourceLoader.exists(path) and not await _mount(id):
		return null
	return load(path) as PackedScene


## The games this client has a pack for: the web build's manifest, or the content/<id> links.
func available() -> Array[String]:
	var ids: Array[String] = []
	if await _load_manifest():
		ids.assign(_manifest.keys())
	elif DirAccess.dir_exists_absolute("res://content"):
		for id: String in DirAccess.get_directories_at("res://content"):
			if ResourceLoader.exists("res://content/%s/main.tscn" % id):
				ids.append(id)
	return ids


## Starts loading a game's pack in the background, so it is there when the game starts.
func preload_game(id: String) -> void:
	if not ResourceLoader.exists("res://content/%s/main.tscn" % id):
		await _mount(id)


func _load_manifest() -> bool:
	if not _manifest.is_empty():
		return true
	var base: String = _base_url()
	if base == "":
		return false
	var body: PackedByteArray = await _fetch(base + "manifest.json")
	var parsed: Variant = JSON.parse_string(body.get_string_from_utf8())
	if parsed is not Dictionary:
		return false
	_manifest = parsed
	return true


func _mount(id: String) -> bool:
	while _mounting.has(id):
		await mounted
	if ResourceLoader.exists("res://content/%s/main.tscn" % id):
		return true
	_mounting[id] = true
	var ok: bool = await _fetch_pack(id)
	_mounting.erase(id)
	mounted.emit(id)
	return ok


func _fetch_pack(id: String) -> bool:
	var base: String = _base_url()
	if not await _load_manifest():
		return false
	var file: String = str(_manifest.get(id, ""))
	if file == "":
		return false
	DirAccess.make_dir_recursive_absolute("user://content")
	var local: String = "user://content/" + file
	if not FileAccess.file_exists(local):
		var pack: PackedByteArray = await _fetch(base + file)
		if pack.is_empty():
			return false
		_forget_older(id)
		var out := FileAccess.open(local, FileAccess.WRITE)
		out.store_buffer(pack)
		out.close()
	return ProjectSettings.load_resource_pack(local)


## Removes this game's packs from earlier builds.
func _forget_older(id: String) -> void:
	for name: String in DirAccess.get_files_at("user://content"):
		if name.begins_with(id + "."):
			DirAccess.remove_absolute("user://content/" + name)


## content/ next to the page on the web; "" elsewhere.
func _base_url() -> String:
	if not OS.has_feature("web"):
		return ""
	return str(JavaScriptBridge.eval("new URL('content/', location.href).href", true))


func _fetch(url: String) -> PackedByteArray:
	var http := HTTPRequest.new()
	add_child(http)
	if http.request(url) != OK:
		http.queue_free()
		return PackedByteArray()
	var reply: Array = await http.request_completed
	http.queue_free()
	if int(reply[0]) != HTTPRequest.RESULT_SUCCESS or int(reply[1]) != 200:
		return PackedByteArray()
	var body: PackedByteArray = reply[3]
	downloaded += body.size()
	return body
