extends Node
## The connection to the game server (WebSocket + JSON): one XomDaoClient for the whole app.

var client := XomDaoClient.new()


func _ready() -> void:
	client.name = "Client"
	add_child(client)
