extends Node
## Who is playing: the login token kept between visits (user://session.cfg), and the account
## requests (register, log in, log out) the server answers over HTTP (/api/auth).

const FILE := "user://session.cfg"
## Where the old web app kept its token (localStorage), read once so its players stay logged in.
const LEGACY_KEY := "xomdao:token"


func saved_token() -> String:
	var config := ConfigFile.new()
	if config.load(FILE) != OK:
		return _legacy_token()
	return str(config.get_value("session", "token", ""))


func save_token(token: String) -> void:
	var config := ConfigFile.new()
	config.set_value("session", "token", token)
	config.save(FILE)


## Logs in with the saved token, or as a new guest; keeps the token for next time.
func log_in(client: XomDaoClient) -> bool:
	var token: String = saved_token()
	if token != "" and await client.login_token(token):
		save_token(token)
		return true
	if client.refused():
		return false
	if not await client.login_guest("Khách %d" % randi_range(100, 999)):
		return false
	save_token(client.token)
	return true


## A guest account (made by `auth:guest`): no username or password of its own.
static func is_guest(user: XomDaoUser) -> bool:
	return user == null or user.username.begins_with("khach")


## Logs in with a username and password; `{ token, user }` or `{ message }` on failure.
func log_in_with(username: String, password: String) -> Dictionary:
	return await _post("login", {"username": username, "password": password})


## Makes an account; `{ token, user }` or `{ message }` on failure.
func register(username: String, password: String, display_name: String) -> Dictionary:
	var body: Dictionary = {
		"username": username, "password": password, "name": display_name, "avatar": "boy"
	}
	return await _post("register", body)


## Ends this login token on the server (the next visit starts as a new guest).
func log_out(token: String) -> void:
	await _post("logout", {}, token)
	save_token("")


## The server's http(s) address, from the /ws URL the client connects to.
static func http_base(ws_url: String) -> String:
	var base: String = ws_url.trim_suffix("/ws")
	return "http" + base.substr(2) if base.begins_with("ws") else base


func _post(path: String, body: Dictionary, token: String = "") -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 30.0
	add_child(http)
	var headers: PackedStringArray = ["Content-Type: application/json"]
	if token != "":
		headers.append("Authorization: Bearer %s" % token)
	var url: String = "%s/api/auth/%s" % [http_base(Net.server_url()), path]
	var sent: int = http.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))
	if sent != OK:
		http.queue_free()
		return {"message": "Không kết nối được máy chủ, thử lại sau"}
	var reply: Array = await http.request_completed
	http.queue_free()
	var code: int = reply[1]
	var data: Variant = JSON.parse_string((reply[3] as PackedByteArray).get_string_from_utf8())
	if reply[0] != HTTPRequest.RESULT_SUCCESS:
		return {"message": "Không kết nối được máy chủ, thử lại sau"}
	if data is not Dictionary:
		data = {}
	if code >= 400 or (path != "logout" and not (data as Dictionary).has("token")):
		var message: Variant = (data as Dictionary).get("message")
		return {"message": message if message is String else "Máy chủ gặp lỗi, thử lại sau"}
	return data


func _legacy_token() -> String:
	if not OS.has_feature("web"):
		return ""
	var read: String = "localStorage.getItem('%s') || ''" % LEGACY_KEY
	return str(
		JavaScriptBridge.eval("(() => { try { return %s } catch { return '' } })()" % read, true)
	)
