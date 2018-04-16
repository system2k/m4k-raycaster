var fs          = require("fs");
var http        = require("http");
var querystring = require("querystring");
var url_parse   = require("url");
var ws          = require("ws");

console.log("Starting server...");

var port = 28476;
var database_name = "./world.m4k";

var map;

if(!fs.existsSync(database_name)) {
	map = new Uint8Array(64 * 64 * 64);
	console.log("Creating level...")
	for (x = 0; x < 64; x++) { // default map (grass and dirt flat-land)
		for (y = 0; y < 64; y++) {
			for ( var z = 0; z < 64; z++) {
				i = z << 12 | y << 6 | x; // convert XYZ into index
				var block = 0;
				if(y === 45) block = 1;
				if(y > 45) block = 2;
				map[i] = block;
			}
		}
	}
	fs.writeFileSync(database_name, map);
} else {
	map = new Uint8Array(fs.readFileSync(database_name));
}

// detect test flags
var args = process.argv;
args.forEach(function(a) {
	if(a == "--test") {
		port = 9991;
		database_name = "test_world.m4k";
		return;
	}
});

var static_files = {};
static_files.icon = fs.readFileSync("./favicon.png");
static_files.client = fs.readFileSync("./index.html");
static_files.m4k_js = fs.readFileSync("./m4k.js");

var server = http.createServer(function(req, res) {
	var url = url_parse.parse(req.url)
	var path = url.pathname
	if(path.charAt(0) == "/") path = path.substr(1);
	if(path.charAt(path.length - 1) == "/") path = path.slice(0, path.length - 1);
	
	if(path == "favicon.png") {
		var img = new Buffer(static_files.icon);

		res.writeHead(200, {
		  "Content-Type": "image/png",
		  "Content-Length": img.length
		});
		res.end(img);
	}
	if(path == "") {
		var cl = new Buffer(static_files.client);

		res.writeHead(200, {
		  "Content-Type": "text/html",
		  "Content-Length": cl.length
		});
		res.end(cl);
	}
	if(path == "m4k.js") {
		var cl = new Buffer(static_files.m4k_js);

		res.writeHead(200, {
		  "Content-Type": "text/js",
		  "Content-Length": cl.length
		});
		res.end(cl);
	}
})
async function runserver() {
	server.listen(port, function() {
		var addr = server.address();
		console.log("M4k server is hosted on " + addr.address + ":" + addr.port)
	});
	init_ws();
}
runserver();

function is_whole_number(x) {
	var isNumber = typeof x === "number" && !isNaN(x) && isFinite(x)
	if(isNumber) {
		return x === Math.trunc(x)
	}
	return false
}

var map_updated = false;
setInterval(function() {
	if(!map_updated) return;
	map_updated = false; // if true, then set to false
	fs.writeFileSync(database_name, map);
	console.log("updated map")
}, 5000)

function init_ws() {
	var wss = new ws.Server({ server });
	wss.on("connection", function(ws) {
		var closed = false;
		var mapReq = false;
		ws.on("message", async function(message) {
			/*ws.send(JSON.stringify({
				command: "get",
				result: result
			}))*/
			data = JSON.parse(message)
			if(data.type == "block_upd") {
				var index = data.index;
				var block = data.block;
				var mode = data.mode;
				if(mode == 1) {
					map[index] = block;
				} else if(mode == 0) {
					map[index] = 0;
				}
				map_updated = true;
				wss.clients.forEach(function(e) {
					if(e == ws) return;
					e.send(JSON.stringify({
						type: "block_changed",
						index: index,
						block: block,
						mode: mode
					}))
				})
			}
			if(data.type == "send_chat") {
				wss.clients.forEach(function(e) {
					if(e == ws) return;
					e.send(JSON.stringify({
						type: "chat",
						message: data.message,
						name: data.name
					}))
				})
			}
			if(data.type == "request_map" && !mapReq) {
				mapReq = true
				var mapcopy = map.slice(0);
				for(var i = 0; i < 64; i++) {
					if(closed) break;
					ws.send(JSON.stringify({
						type: "map_seg",
						segment: i,
						data: Array.from(mapcopy.slice(i * 4096, i * 4096 + 4096))
					}))
				}
				mapcopy = null;
			}
		});
		
		ws.on("close", function(){
			closed = true;
			//console.log("closed")
		})
		ws.on("error", function(a,b,c){
			//console.log("err", a, b, c)
		})
	});
}