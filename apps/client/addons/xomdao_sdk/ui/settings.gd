class_name XomDaoSettings
extends RefCounted
## The player's interface settings, kept in user://settings.cfg: sound, the HUD scale, the
## margin to the screen edge and the picture quality. One shared instance:
##
##   XomDaoSettings.current().ui_scale
##   XomDaoSettings.current().changed.connect(_on_settings)

signal changed

## Choices offered in the menu (Cài đặt).
const SCALES: Array[float] = [0.85, 1.0, 1.15, 1.3]
const MARGINS: Array[int] = [12, 24, 40]
const QUALITIES: Array[String] = ["low", "medium", "high"]
const PATH := "user://settings.cfg"

static var _current: XomDaoSettings

var sound: bool = true
## How big the player's HUD is drawn (1.0 = the sizes in docs/ui-guide.md).
var ui_scale: float = 1.0
## Distance in units from the screen edge (or the notch) to the corner buttons.
var margin: int = 24
var quality: String = "high"
## Where the settings are saved ("" keeps them in memory: tests).
var path: String = PATH


## The app's settings, loaded on first use.
static func current() -> XomDaoSettings:
	if _current == null:
		_current = XomDaoSettings.new()
		_current.load_file()
	return _current


func load_file() -> void:
	if path == "":
		return
	var file := ConfigFile.new()
	if file.load(path) != OK:
		return
	sound = bool(file.get_value("ui", "sound", sound))
	ui_scale = _nearest(float(file.get_value("ui", "scale", ui_scale)))
	var saved_margin: int = int(file.get_value("ui", "margin", margin))
	margin = saved_margin if MARGINS.has(saved_margin) else 24
	var saved_quality: String = str(file.get_value("ui", "quality", quality))
	quality = saved_quality if QUALITIES.has(saved_quality) else "high"
	_apply()


## Changes one setting ("sound", "ui_scale", "margin", "quality"), saves and tells listeners.
func set_value(key: String, value: Variant) -> void:
	match key:
		"sound":
			sound = bool(value)
		"ui_scale":
			ui_scale = _nearest(float(value))
		"margin":
			margin = int(value) if MARGINS.has(int(value)) else margin
		"quality":
			quality = str(value) if QUALITIES.has(str(value)) else quality
		_:
			push_error("XomDaoSettings: no setting %s" % key)
			return
	_apply()
	save()
	changed.emit()


func save() -> void:
	if path == "":
		return
	var file := ConfigFile.new()
	file.set_value("ui", "sound", sound)
	file.set_value("ui", "scale", ui_scale)
	file.set_value("ui", "margin", margin)
	file.set_value("ui", "quality", quality)
	file.save(path)


func _apply() -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), not sound)


func _nearest(value: float) -> float:
	var best: float = SCALES[0]
	for option: float in SCALES:
		if absf(option - value) < absf(best - value):
			best = option
	return best
