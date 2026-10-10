class_name XomDaoRoomSnapshot
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var code: String = ""
var game_id: String = ""
var host_id: Variant = null
var players: Array[XomDaoPlayerInfo] = []
var spectators: Array[XomDaoPlayerInfo] = []
var seats: Array[XomDaoPlayerInfo] = []
var status: String = ""
var view: Variant = null
var result: XomDaoGameResult
var score: XomDaoRoomScore
var options: Variant = null
var round: int = 0
var last: XomDaoLastMove
var timer: XomDaoRoomTimer
var played: XomDaoPlayed


static func from_dict(d: Dictionary) -> XomDaoRoomSnapshot:
	var o := XomDaoRoomSnapshot.new()
	o.code = str(d.get("code", ""))
	o.game_id = str(d.get("gameId", ""))
	o.host_id = d.get("hostId")
	for item: Variant in _list(d, "players"):
		if item is Dictionary:
			o.players.append(XomDaoPlayerInfo.from_dict(item))
	for item: Variant in _list(d, "spectators"):
		if item is Dictionary:
			o.spectators.append(XomDaoPlayerInfo.from_dict(item))
	for item: Variant in _list(d, "seats"):
		if item is Dictionary:
			o.seats.append(XomDaoPlayerInfo.from_dict(item))
	o.status = str(d.get("status", ""))
	o.view = d.get("view")
	if d.get("result") is Dictionary:
		o.result = XomDaoGameResult.from_dict(d["result"])
	o.score = XomDaoRoomScore.from_dict(_dict(d, "score"))
	o.options = d.get("options")
	o.round = int(d.get("round", 0))
	if d.get("last") is Dictionary:
		o.last = XomDaoLastMove.from_dict(d["last"])
	if d.get("timer") is Dictionary:
		o.timer = XomDaoRoomTimer.from_dict(d["timer"])
	if d.get("played") is Dictionary:
		o.played = XomDaoPlayed.from_dict(d["played"])
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["code"] = code
	d["gameId"] = game_id
	if host_id != null:
		d["hostId"] = host_id
	d["players"] = _dicts(players)
	d["spectators"] = _dicts(spectators)
	d["seats"] = _dicts(seats)
	d["status"] = status
	d["view"] = view
	d["result"] = result.to_dict() if result != null else null
	d["score"] = score.to_dict()
	d["options"] = options
	d["round"] = round
	d["last"] = last.to_dict() if last != null else null
	d["timer"] = timer.to_dict() if timer != null else null
	d["played"] = played.to_dict() if played != null else null
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
