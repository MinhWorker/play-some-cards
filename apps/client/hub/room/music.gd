class_name HubMusic
extends AudioStreamPlayer
## A game's music while its table shows: one of the tracks in its pack's music/ folder
## (`res://content/<id>/music/*.mp3`), picked at random, then another when it ends. Quiet when
## the player turned sound off.

const VOLUME_DB := -10.0

var _tracks: Array[String] = []


func _init() -> void:
	name = "Music"
	volume_db = VOLUME_DB
	finished.connect(_next)
	XomDaoSettings.current().changed.connect(_on_settings)


## Starts game `id`'s music, if its pack has any.
func play_for(id: String) -> void:
	_tracks.clear()
	var folder: String = "res://content/%s/music/" % id
	if DirAccess.dir_exists_absolute(folder):
		for file: String in ResourceLoader.list_directory(folder):
			if file.get_extension() in ["mp3", "ogg", "wav"]:
				_tracks.append(folder + file)
	_next()


func quiet() -> void:
	_tracks.clear()
	stop()


func _next() -> void:
	if _tracks.is_empty() or not XomDaoSettings.current().sound or not is_inside_tree():
		stop()
		return
	stream = load(_tracks.pick_random())
	play()


func _on_settings() -> void:
	if not XomDaoSettings.current().sound:
		stop()
	elif not playing:
		_next()
