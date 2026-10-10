extends Control
## The first screen. For now an empty sky with the core outlined. ?gallery=<page> (web) or
## `-- --gallery=<page>` opens the UI component gallery instead.


func _ready() -> void:
	print("xomdao:ready")
	var page: int = gallery_page()
	if page > 0:
		var gallery: Control = load("res://hub/gallery/gallery.tscn").instantiate()
		gallery.set("page", page)
		get_tree().root.add_child.call_deferred(gallery)
		queue_free()


## The gallery page asked for in the URL or on the command line, 0 when none.
static func gallery_page() -> int:
	var args: String = " ".join(OS.get_cmdline_user_args())
	if OS.has_feature("web"):
		args += " " + str(JavaScriptBridge.eval("window.location.search", true))
	var found: RegExMatch = RegEx.create_from_string("gallery(?:=(\\d+))?").search(args)
	if found == null:
		return 0
	return maxi(1, found.get_string(1).to_int())
