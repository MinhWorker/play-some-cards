class_name XomDaoGameCard
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var name: String = ""
var kind: String = ""
var genre: String = ""
var tagline: String = ""
var min_players: int = 0
var max_players: int = 0
var duration: Dictionary = {}
var card: String = ""
var status: String = ""
var reward_cap: Dictionary = {}
var event: XomDaoEventInfo
var closes_in: int = 0
var playing: int = 0
var open_rooms: int = 0


static func from_dict(d: Dictionary) -> XomDaoGameCard:
	var o := XomDaoGameCard.new()
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.kind = str(d.get("kind", ""))
	o.genre = str(d.get("genre", ""))
	o.tagline = str(d.get("tagline", ""))
	o.min_players = int(d.get("minPlayers", 0))
	o.max_players = int(d.get("maxPlayers", 0))
	o.duration = _dict(d, "duration")
	o.card = str(d.get("card", ""))
	o.status = str(d.get("status", ""))
	o.reward_cap = _dict(d, "rewardCap")
	if d.get("event") is Dictionary:
		o.event = XomDaoEventInfo.from_dict(d["event"])
	o.closes_in = int(d.get("closesIn", 0))
	o.playing = int(d.get("playing", 0))
	o.open_rooms = int(d.get("openRooms", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["name"] = name
	d["kind"] = kind
	d["genre"] = genre
	d["tagline"] = tagline
	d["minPlayers"] = min_players
	d["maxPlayers"] = max_players
	d["duration"] = duration
	d["card"] = card
	d["status"] = status
	d["rewardCap"] = reward_cap
	if event != null:
		d["event"] = event.to_dict()
	if closes_in != 0:
		d["closesIn"] = closes_in
	d["playing"] = playing
	d["openRooms"] = open_rooms
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
