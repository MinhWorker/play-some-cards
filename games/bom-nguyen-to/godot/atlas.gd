extends RefCounted
## The packed sprite sheets (art/<sheet>.webp with its TexturePacker art/<sheet>.json, made by
## sources/pack-sprites.py) as SpriteFrames: frames named `<clip>-NN` become the clip `<clip>`.
## Trimmed frames get their margin back, so every frame of a sheet has the same size.

const ART := "res://content/bom-nguyen-to/art/"
## Clip speeds (src/scenes/animations.ts): frames per second and whether it loops.
const ACTOR_CLIPS: Dictionary = {
	"idle": [4.0, true],
	"walk": [8.0, true],
	"place": [12.0, false],
	"skill": [12.0, false],
	"hit": [12.0, false],
	"frozen": [3.0, true],
	"ko": [8.0, false],
	"spawn": [10.0, false],
}
const EFFECT_CLIPS: Dictionary = {
	"crate-break": [16.0, false],
	"stun": [10.0, true],
	"dust": [16.0, false],
	"dash": [16.0, false],
	"freeze": [8.0, true],
	"victory": [12.0, false],
	"skill-fire": [16.0, false],
	"skill-water": [16.0, false],
	"skill-lightning": [16.0, false],
	"skill-ice": [16.0, false],
	"skill-wind": [16.0, false],
}

static var _cache: Dictionary = {}


## A sheet's frames by name, each an AtlasTexture of the frame's full (untrimmed) size.
static func textures(sheet: String) -> Dictionary:
	if _cache.has(sheet):
		return _cache[sheet]
	var image: Texture2D = load(ART + sheet + ".webp")
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(ART + sheet + ".json"))
	var out: Dictionary = {}
	if data is Dictionary:
		var frames: Dictionary = data["frames"]
		for name: String in frames:
			var info: Dictionary = frames[name]
			var frame: Dictionary = info["frame"]
			var trim: Dictionary = info["spriteSourceSize"]
			var full: Dictionary = info["sourceSize"]
			var texture := AtlasTexture.new()
			texture.atlas = image
			texture.region = Rect2(frame["x"], frame["y"], frame["w"], frame["h"])
			texture.margin = Rect2(
				trim["x"], trim["y"], float(full["w"]) - frame["w"], float(full["h"]) - frame["h"]
			)
			out[name] = texture
	_cache[sheet] = out
	return out


## SpriteFrames of a sheet with these clips ({name: [fps, loop]}); each clip takes the frames
## named `<name>-NN` in order. `suffixes` repeats each clip per suffix (`walk-down`, …).
static func sprite_frames(sheet: String, clips: Dictionary, suffixes: Array = [""]) -> SpriteFrames:
	var all: Dictionary = textures(sheet)
	var names: Array = all.keys()
	names.sort()
	var out := SpriteFrames.new()
	out.remove_animation("default")
	for clip: String in clips:
		for suffix: String in suffixes:
			var anim: String = clip + suffix
			out.add_animation(anim)
			out.set_animation_speed(anim, clips[clip][0])
			out.set_animation_loop(anim, clips[clip][1])
			for name: String in names:
				if name.begins_with(anim + "-") and name.trim_prefix(anim + "-").is_valid_int():
					out.add_frame(anim, all[name])
	return out


## A character's clips: `<state>-<facing>` for the eight states and four facings.
static func actor(element: String) -> SpriteFrames:
	var key: String = "frames:actor-" + element
	if not _cache.has(key):
		_cache[key] = sprite_frames(
			"actor-" + element, ACTOR_CLIPS, ["-down", "-up", "-left", "-right"]
		)
	return _cache[key]


## The effect clips of cartoon-fx (crate-break, dust, skill-<element>, …).
static func effects() -> SpriteFrames:
	if not _cache.has("frames:fx"):
		_cache["frames:fx"] = sprite_frames("cartoon-fx", EFFECT_CLIPS)
	return _cache["frames:fx"]


## The arena clips: the ticking bomb and each element's blast.
static func arena() -> SpriteFrames:
	if not _cache.has("frames:arena"):
		var clips: Dictionary = {"bomb": [8.0, true]}
		for element: String in ["fire", "water", "lightning", "ice", "wind"]:
			clips["blast-" + element] = [12.0, true]
		_cache["frames:arena"] = sprite_frames("arena-fx", clips)
	return _cache["frames:arena"]


## One still frame of arena-fx (`item-heal-00`, …).
static func still(name: String) -> Texture2D:
	return textures("arena-fx").get(name)
