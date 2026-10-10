extends Node
## Who is playing: the login token kept between visits (user://session.cfg).

const FILE := "user://session.cfg"


func saved_token() -> String:
	var config := ConfigFile.new()
	if config.load(FILE) != OK:
		return ""
	return str(config.get_value("session", "token", ""))


func save_token(token: String) -> void:
	var config := ConfigFile.new()
	config.set_value("session", "token", token)
	config.save(FILE)


## Logs in with the saved token, or as a new guest; keeps the token for next time.
func log_in(client: XomDaoClient) -> bool:
	var token: String = saved_token()
	if token != "" and await client.login_token(token):
		return true
	if not await client.login_guest("Khách %d" % randi_range(100, 999)):
		return false
	save_token(client.token)
	return true
