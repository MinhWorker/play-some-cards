class_name XomDaoClient
extends Node
## The connection to the Xóm Đảo server: plain WebSocket + JSON on /ws (protocol in
## packages/shared/src/protocol.ts; the classes and names come from generated/).
##
##   var client := XomDaoClient.new()
##   add_child(client)
##   await client.connect_to_server("ws://localhost:8033/ws")
##   if await client.login_guest("Lan"):
##       await client.create_room("tic-tac-toe")       # client.room_code is the code to share
##       client.state_changed.connect(_on_state)       # every room:state as XomDaoRoomSnapshot
##       await client.send("place", {"x": 4, "y": 4})  # one of the game's events (game:move)
##
## Every request returns after the server answers: `request()` gives the raw reply
## (`{ ok, ... }`), the helpers return true on success and emit `error` with the message otherwise.
## When the connection drops it reconnects by itself, logs in again with `token` and resumes the
## room (`session:resume`), then emits `connected` again.

## Logged in (again, after a reconnect) and resumed: `user`, `balances` and `room_code` are set.
signal connected
## The connection dropped; it reconnects by itself unless `close()` was called.
signal disconnected
## The room changed: a new snapshot of it (`snapshot`).
signal state_changed(snapshot: XomDaoRoomSnapshot)
## Entered another room, or left one (`room_code` is then "").
signal room_changed(room_code: String)
## The game you played paid you; `balances` is already updated.
signal rewarded(notice: XomDaoRewardNotice)
## Any pushed event, as XomDaoProtocol.parse_event makes it (lobby:rooms, room:closed…).
signal event_received(event: String, data: Variant)
## A request failed: the server's message (Vietnamese), or "offline".
signal error(message: String)

## The socket opened (true) or closed (false).
signal link_changed(open: bool)

const OFFLINE := "offline"
## Waits between reconnect attempts grow up to this many seconds.
const MAX_RETRY_SECONDS := 8.0

## The server's /ws URL.
var url: String = ""
## The login token: keep it (user://) to log in again with `login_token()`.
var token: String = ""
var user: XomDaoUser
## Your resources (`core:coin` → amount), as the server's ledger reports them.
var balances: Dictionary = {}
## The room you are in ("" when none) and your id in it (your account id).
var room_code: String = ""
var player_id: String = ""
## The latest state of your room, or null.
var snapshot: XomDaoRoomSnapshot

var _socket := WebSocketPeer.new()
var _state: WebSocketPeer.State = WebSocketPeer.STATE_CLOSED
var _next_id: int = 0
var _pending: Dictionary = {}
var _closing: bool = false
var _retry: float = 0.0
var _retry_seconds: float = 0.5


## Opens the connection; true once it is open.
func connect_to_server(server_url: String) -> bool:
	url = server_url
	_closing = false
	if is_open():
		return true
	if _socket.connect_to_url(url) != OK:
		return false
	_state = WebSocketPeer.STATE_CONNECTING
	var open: bool = await link_changed
	return open


## Closes for good (no reconnect).
func close() -> void:
	_closing = true
	_socket.close()


func is_open() -> bool:
	return _state == WebSocketPeer.STATE_OPEN


## Logs in as a new guest with only a display name.
func login_guest(display_name: String) -> bool:
	return await _login(XomDaoProtocol.AUTH_GUEST, {"name": display_name})


func login(username: String, password: String) -> bool:
	return await _login(XomDaoProtocol.AUTH_LOGIN, {"username": username, "password": password})


## Logs in again with a token from an earlier login.
func login_token(saved_token: String) -> bool:
	return await _login(XomDaoProtocol.AUTH_TOKEN, {"token": saved_token})


## Makes a room for a game (with its setup options, if any) and enters it.
func create_room(game_id: String, options: Variant = null) -> bool:
	var data: Dictionary = {"gameId": game_id}
	if options != null:
		data["options"] = options
	return _entered(await _ok(XomDaoProtocol.ROOM_CREATE, data))


## Joins a room by its code (any case), as a "player" or a "spectator".
func join_room(code: String, role: String = "player") -> bool:
	var ack: Dictionary = await _ok(XomDaoProtocol.ROOM_JOIN, {"roomCode": code, "role": role})
	return _entered(ack)


func leave_room() -> bool:
	var ok: bool = not (await _ok(XomDaoProtocol.ROOM_LEAVE)).is_empty()
	if ok:
		_set_room("")
	return ok


## Host only: starts the game (or the next one).
func start_game() -> bool:
	return not (await _ok(XomDaoProtocol.GAME_START)).is_empty()


## Sends one of the game's events (`place`, `play-card`…) with its payload.
func send(event: String, payload: Dictionary = {}) -> bool:
	var move: Dictionary = {"event": event, "payload": payload}
	return not (await _ok(XomDaoProtocol.GAME_MOVE, {"move": move})).is_empty()


## Sends any request and returns the server's raw reply (`{ "ok": true, ... }` or
## `{ "ok": false, "error": ... }`).
func request(event: String, data: Dictionary = {}) -> Dictionary:
	if not is_open():
		return {"ok": false, "error": OFFLINE}
	_next_id += 1
	var waiting := _Waiting.new()
	_pending[_next_id] = waiting
	_socket.send_text(JSON.stringify({"id": _next_id, "event": event, "data": data}))
	var ack: Dictionary = await waiting.done
	return ack


func _process(delta: float) -> void:
	_socket.poll()
	var state: WebSocketPeer.State = _socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		while _socket.get_available_packet_count() > 0:
			_receive(_socket.get_packet().get_string_from_utf8())
	if state != _state:
		_changed(state)
	if state == WebSocketPeer.STATE_CLOSED and not _closing and url != "" and _retry > 0.0:
		_retry -= delta
		if _retry <= 0.0:
			_reconnect()


func _changed(state: WebSocketPeer.State) -> void:
	var was_open: bool = is_open()
	_state = state
	if state == WebSocketPeer.STATE_OPEN:
		_retry_seconds = 0.5
		link_changed.emit(true)
	elif state == WebSocketPeer.STATE_CLOSED:
		for id: int in _pending.keys():
			_resolve.call_deferred(_pending[id], {"ok": false, "error": OFFLINE})
		_pending.clear()
		link_changed.emit(false)
		if was_open:
			disconnected.emit()
		if not _closing:
			_retry = _retry_seconds
			_retry_seconds = minf(_retry_seconds * 2.0, MAX_RETRY_SECONDS)


## Answers a request after the current frame's packets, so callers never resume inside
## _process.
func _resolve(waiting: _Waiting, ack: Dictionary) -> void:
	waiting.done.emit(ack)


func _reconnect() -> void:
	if not await connect_to_server(url) or token == "":
		return
	await login_token(token)


func _receive(text: String) -> void:
	var message: Variant = JSON.parse_string(text)
	if message is not Dictionary:
		return
	if message.has("id"):
		var waiting: _Waiting = _pending.get(int(message["id"]))
		_pending.erase(int(message["id"]))
		if waiting != null:
			var ack: Variant = message.get("ack")
			_resolve.call_deferred(
				waiting, ack if ack is Dictionary else {"ok": false, "error": "?"}
			)
		return
	var event: String = str(message.get("event", ""))
	var data: Variant = XomDaoProtocol.parse_event(event, message.get("data"))
	if data is XomDaoRoomSnapshot:
		snapshot = data
		_set_room(snapshot.code)
		state_changed.emit(snapshot)
	elif data is XomDaoRoomClosed:
		snapshot = null
		_set_room("")
	elif data is XomDaoRewardNotice:
		balances = data.balances
		rewarded.emit(data)
	event_received.emit(event, data)


func _login(event: String, data: Dictionary) -> bool:
	data["protocol"] = XomDaoProtocol.VERSION
	var ack: Dictionary = await _ok(event, data)
	if ack.is_empty():
		return false
	var auth := XomDaoAuthReply.from_dict(ack)
	token = auth.token
	user = auth.user
	var resumed: Dictionary = await _ok(XomDaoProtocol.SESSION_RESUME)
	if resumed.is_empty():
		return false
	var session := XomDaoSessionInfo.from_dict(resumed)
	balances = session.balances
	if session.room != null:
		player_id = session.room.player_id
		_set_room(session.room.room_code)
	else:
		snapshot = null
		_set_room("")
	connected.emit()
	return true


## The reply's data on success; {} after emitting `error` otherwise.
func _ok(event: String, data: Dictionary = {}) -> Dictionary:
	var ack: Dictionary = await request(event, data)
	if ack.get("ok") == true:
		return ack
	error.emit(str(ack.get("error", "?")))
	return {}


func _entered(ack: Dictionary) -> bool:
	if ack.is_empty():
		return false
	var joined := XomDaoJoinedRoom.from_dict(ack)
	player_id = joined.player_id
	_set_room(joined.room_code)
	return true


func _set_room(code: String) -> void:
	if code == room_code:
		return
	room_code = code
	if code == "":
		snapshot = null
	room_changed.emit(code)


## One request waiting for its reply.
class _Waiting:
	extends RefCounted
	signal done(ack: Dictionary)
