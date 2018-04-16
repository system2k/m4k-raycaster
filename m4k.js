var server_initted = false;
var gameCanvas = document.getElementById("game");
gameCanvas.style.display = "none";
var map = new Uint8Array(64 * 64 * 64); // all blocks
var loading = document.getElementById("loading");
var info_a = document.getElementById("info_a");
var body = document.getElementsByTagName("body")[0];

var textar = document.createElement("textarea");
textar.style.position = "absolute"
textar.style.top = "-1000px"
textar.style.left = "-1000px"
body.appendChild(textar)

var w = 300;
var h = 250;

ctx = gameCanvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false; // < No longer needed on Firefox
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.oImageSmoothingEnabled = false;

pixels = ctx.createImageData(w, h); // initialize the image data array

for (i = 0; i < w * h; i++) { // make alpha channel opaque
	pixels.data[i * 4 + 3] = 255;
}

var inittedMap = false;

// some event for when someone chats. Can be used for scripting
function onChatMessage() {};

var name = "USER 0X" + (Math.floor(Math.random() * 256).toString(16)).toUpperCase().padStart(2, "0");

var Socket;
function createSocket() {
	var mapSegmentsLoaded = 0;
	Socket = new WebSocket("ws://" + window.location.host);
	Socket.onmessage = function(msg) {
		var res = JSON.parse(msg.data)
		if(res.type == "map_seg") {
			mapSegmentsLoaded++;
			loading.innerText = "Loaded segment [" + mapSegmentsLoaded + " of 64]"
			for(var i = 0; i < 4096; i++) {
				map[res.segment * 4096 + i] = res.data[i];
			}
			if(mapSegmentsLoaded >= 64) {
				console.log("Loaded map")
				init();
			}
		}
		if(res.type == "block_changed") {
			var index = res.index;
			var block = res.block;
			var mode = res.mode;
			if(mode == 1) {
				map[index] = block;
			} else if(mode == 0) {
				map[index] = 0;
			}
		}
		if(res.type == "chat") {
			console.log(">> " + res.name + ": " + res.message)
			onChatMessage(res.message);
		}
		//console.log(res)
	}
	Socket.onopen = function() {
		console.log("socket opened")
		/*if(!server_initted) {
			server_initted = true;
			init();
		}*/
		if(!inittedMap) {
			Socket.send(JSON.stringify({
				type: "request_map"
			}))
			inittedMap = true
		}
	}
	Socket.onclose = function() {
		setTimeout(function() {
			console.log("Reconnected socket");
			createSocket();
		}, 2000)
	}
}
// Socket.send(msg)
createSocket();

var automaticGameSize = false; //if true, it changes game resolution to screen size (will be slow on bigger windows.)
var move_speed = 0.1
var camera_move_speed = 0.005 //camera speed using mouse
var keyboard_camera_move_speed = 0.015 //camera speed using arrow keys

var clientW = window.innerWidth; // window sizes
var clientH = window.innerHeight;

var ctx, pixels;

var texmap = new Uint32Array(16 * 16 * 3 * 27); // all textures
						//   a    b    c   d
						//a: width, b: height, c: amount of textures for some sides of a block, d: number of textures

var MD_left = false; // mouse down left
var MD_right = false; // mouse down right
var pointLock = false // Is the cursor (pointer) locked so that the camera can be moved by the mouse?
var CantClick = 0; // execute click, make CantClick 1, wait 500 or 250 MS and make CantClick 0. Makes sure clicks are not executed for every frame
var HCW = 0; // at first, wait 500 MS after holding mouse button down. Then repeat clicks 250 MS apart after HCW = 1

var Night = 0 // Night or day

var FPSlabel = document.getElementById("fps")

var mouseWheel; // function executed on a mouse wheel scroll
function init() { // initialize texture, canvas pixels, events, and the clock
	loading.style.display = "none"; // hide loading label
	gameCanvas.style.display = ""; // show gameCanvas
	setTimeout(function() {
		info_a.style.display = "none";
	}, 3000)
	var glass_colors = [0, 0xFEFEFE, 0xC0F5FE, 0xB3D6DB]
	var glass_map = "1110111111111112100000010000000210010020000000001010000000000012110000000100020310000000100020000000000200000003102000200000000312000000000000031000000010000000000000010000010010000020000010030200000000010003200000000020000310000000000000021333330033033332"

	for ( var i = 1; i <= 25; i++) { // for each texture
		var br = 255 - ((Math.random() * 96) | 0); // number between 160 - 255 (gives texture a random noise)
		for ( var y = 0; y < 16 * 3; y++) {
			for ( var x = 0; x < 16; x++) {
				var color = 0x966C4A; // default color (brown-like)
				if (i == 3) { // stone
					color = 0x7F7F7F;
				}
				
				if (i != 3 || ((Math.random() * 3) | 0) === 0) {
					br = 255 - ((Math.random() * 96) | 0); // reset the random noise
				}
				
				if ((i == 1 && y < (((x * x * 3 + x * 81) >> 2) & 3) + 18)) { // grass
					color = 0x6AAA40;
				} else if ((i == 1 && y < (((x * x * 3 + x * 81) >> 2) & 3) + 19)) {
					br = br * 2 / 3;
				}
				
				if (i == 4) { // brick
					color = 0xB53A15;
					if ((x + (y >> 2) * 4) % 8 === 0 || y % 4 === 0) {
						color = 0xBCAFA5;
					}
				}
				
				if (i == 5) { // wood
					color = 0x675231;
					if (x > 0 && x < 15
							&& ((y > 0 && y < 15) || (y > 32 && y < 47))) {
						color = 0xBC9862;
						var xd = (x - 7);
						var yd = ((y & 15) - 7);
						if (xd < 0)
							xd = 1 - xd;
						if (yd < 0)
							yd = 1 - yd;
						if (yd > xd)
							xd = yd;

						br = 196 - ((Math.random() * 32) | 0) + xd % 3 * 32;
					} else if (((Math.random() * 2) | 0) === 0) {
						br = br * (150 - (x & 1) * 100) / 100;
					}
				}
				var brr = br;
				if (y >= 32)
					brr /= 2;

				if (i == 6) { // leaves
					color = 0x50D937;
					if (((Math.random() * 2) | 0) === 0) {
						color = 0;
						brr = 255;
					}
				}
				
				if (i == 7) { // water
					color = 0x4040ff;
				}
				
				if(i == 8) { // glass
					color = glass_colors[glass_map[(y%16)*16+x]]
					brr = 255;
				}
				if(i == 9) { // green crystal
					var y_ = y%16
					color = ((x+y_)*4352)
					if(color < 1) color = 1
					brr = 255
				}
				if(i == 10) { // WHITE
					color = 0xDDDDDD;
					brr = 255
				}
				if(i == 11) { // BLACK
					color = 0x191616;
					brr = 255
				}
				if(i == 12) { // RED
					color = 0x963430;
					brr = 255
				}
				if(i == 13) { // GREEN
					color = 0x35461B;
					brr = 255
				}
				if(i == 14) { // BLUE
					color = 0x2E388D;
					brr = 255
				}
				if(i == 15) { // ORANGE
					color = 0xDB7D3E;
					brr = 255
				}
				if(i == 16) { // MAGENTA
					color = 0xB350BC;
					brr = 255
				}
				if(i == 17) { // LIGHT BLUE
					color = 0x6B8AC9;
					brr = 255
				}
				if(i == 18) { // YELLOW
					color = 0xB1A627;
					brr = 255
				}
				if(i == 19) { // LIME
					color = 0x41AE38;
					brr = 255
				}
				if(i == 20) { // PINK
					color = 0xD08499;
					brr = 255
				}
				if(i == 21) { // GRAY
					color = 0x404040;
					brr = 255
				}
				if(i == 22) { // LIGHT GRAY
					color = 0x9AA1A1;
					brr = 255
				}
				if(i == 23) { // CYAN
					color = 0x2E6E89;
					brr = 255
				}
				if(i == 24) { // PURPLE
					color = 0x7E3DB5;
					brr = 255
				}
				if(i == 25) { // BROWN
					color = 0x4F321F;
					brr = 255
				}
				var col = (((color >> 16) & 0xff) * brr / 255) << 16
						| (((color >> 8) & 0xff) * brr / 255) << 8
						| (((color) & 0xff) * brr / 255); // adjust the noise (brr) to each rgb in the color. the color is a number between 0 and 16777215
				
				texmap[x + y * 16 + i * 256 * 3] = col; // add to texture map
			}
		}
	}
	for(let s = 0; s < 3; s++)
		for(let yy = 0; yy < 16*3; yy++)
			for(let x = 0; x < 16; x++) {
				var y = yy % 16
				var idx = x*1 + y*16 + s*256 + 26*256*3;
				texmap[idx] = ((x^y)*0x000810);
				if((x-8)**2 + (y-8)**2 > 8**2) texmap[idx] &= 0;
				texmap[idx] |= 0xF000000;
			}
	gameCanvas.requestPointerLock = gameCanvas.requestPointerLock || gameCanvas.mozRequestPointerLock || gameCanvas.webkitRequestPointerLock // functions to lock the pointer

	gameCanvas.onclick = function(e) {
		if(!pointLock) {
			if(gameCanvas.requestPointerLock) gameCanvas.requestPointerLock() // lock the pointer
		}
	}
	
	gameCanvas.onmouseup = function(e){if(e.which == 1) MD_left = false; if(e.which == 3) MD_right = false}
	gameCanvas.onmousedown = function(e){if(e.which == 1) MD_left = true; if(e.which == 3) MD_right = true; clickTimer = Date.now(); HCW = 0; CantClick = 0}
	
	mouseWheel = function(e) {
		var delta = e.deltaY || e.wheelDelta
		var d;
		if(delta < 0) d = true // scroll up
		if(delta > 0) d = false // scroll down
		if(d === true) {
			selectedBlock++;
			if(selectedBlock >= BlockLabel.length) selectedBlock = 1;
			updateCornerStr()
			updates = true
		}
		if(d === false) {
			selectedBlock--;
			if(selectedBlock < 1) selectedBlock = BlockLabel.length - 1
			updateCornerStr()
			updates = true
		}
	}
	if(gameCanvas.onmousewheel === null) gameCanvas.onmousewheel = mouseWheel
	if(gameCanvas.onmousewheel === undefined && gameCanvas.onwheel === null) gameCanvas.onwheel = mouseWheel
	gameCanvas.onmousemove = function(e) {
		var canvasW = parseInt(gameCanvas.style.width.split("px")[0]);
		var canvasH = parseInt(gameCanvas.style.height.split("px")[0])
		MX = Math.floor((w / canvasW) * e.offsetX)
		MY = Math.floor((h / canvasH) * e.offsetY)
		if(!pointLock) return
		var dx = -e.movementX
		var dy = -e.movementY
		if (dx >= 0) { //turn left
			xRot -= dx*camera_move_speed;
			if(xRot < 0) {
				xRot = pi*2 - (Math.abs(xRot) % (pi*2))
			}
		}
		if (dx < 0) { //turn right
			xRot -= dx*camera_move_speed;
			xRot %= pi*2
		}
		
		if (dy >= 0) {
			if (yRot < pi / 2) {
				yRot += dy*camera_move_speed;
				if(!(yRot < pi / 2)) yRot = pi / 2;
			} else {
				yRot = pi / 2;
			}
		}
		if (dy < 0) {
			if (yRot > -pi / 2) {
				yRot += dy*camera_move_speed;
				if(!(yRot > -pi / 2)) yRot = -pi / 2;
			} else {
				yRot = -pi / 2;
			}
		}
		
		
		updates = true
	}
	
	if ("onpointerlockchange" in document) {
		document.addEventListener('pointerlockchange', lockChangeAlert, false);
	} else if ("onmozpointerlockchange" in document) {
		document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
	}

	function lockChangeAlert() {
		if(document.pointerLockElement === gameCanvas ||
		document.mozPointerLockElement === gameCanvas) {
			pointLock = true // locked
		} else {
			pointLock = false // unlocked
		}
	}

	setInterval(clock, 33); // start the clock
}

var pi = Math.PI
var clickTimer; // timer updated the mouse button is clicked
var updates = true;

function clock() { //executed every frame (not in sync with renderer)
	if (camdirX == 1) { //turn left
		xRot -= keyboard_camera_move_speed;
		if(xRot < 0) {
			xRot = pi*2 - (Math.abs(xRot) % (pi*2))
		}
	}
	if (camdirX == 2) { //turn right
		xRot += keyboard_camera_move_speed;
		xRot %= pi*2
	}
	
	if (camdirX == 1) { //turn left
		xRot -= keyboard_camera_move_speed;
		if(xRot < 0) {
			xRot = pi*2 - (Math.abs(xRot) % (pi*2))
		}
	}
	if (camdirX == 2) { //turn right
		xRot += keyboard_camera_move_speed;
		xRot %= pi*2
	}

	if (camdirY == 1) {
		if (yRot < pi / 2) {
			yRot += keyboard_camera_move_speed;
			if(!(yRot < pi / 2)) yRot = pi / 2;
		} else {
			yRot = pi / 2;
		}
	}
	if (camdirY == 2) {
		if (yRot > -pi / 2) {
			yRot -= keyboard_camera_move_speed;
			if(!(yRot > -pi / 2)) yRot = -pi / 2;
		} else {
			yRot = -pi / 2;
		}
	}
	
	function blockUpd(index, block, mode) {
		Socket.send(JSON.stringify({
			type: "block_upd",
			index: index,
			block: block,
			mode: mode
		}))
	}
	
	var updated = -1; // if player is stuck in a wall, don't delete surrounding blocks if one block is placed
	if(MD_left && (pointLock || !gameCanvas.requestPointerLock) && !MD_right) {
		if(var14 >= 0 && var14 <= map.length && CantClick === 0) {
			map[var14] = 0
			blockUpd(var14, null, 0);
			CantClick = 1
		}
		if(Date.now() - clickTimer >= 250 && HCW === 1) {
			CantClick = 0
			clickTimer = Date.now()
		}
		if(Date.now() - clickTimer >= 500 && HCW === 0) {
			CantClick = 0
			HCW = 1;
			clickTimer = Date.now()
		}
	}
	if(MD_right && (pointLock || !gameCanvas.requestPointerLock) && !MD_left) {
		if(var14 >= 0 && var14 <= map.length && CantClick === 0) {
			map[var14 + var15] = selectedBlock
			blockUpd(var14 + var15, selectedBlock, 1);
			updated = var14 + var15
			CantClick = 1
		}
		if(Date.now() - clickTimer >= 250 && HCW === 1) {
			CantClick = 0
			clickTimer = Date.now()
		}
		if(Date.now() - clickTimer >= 500 && HCW === 0) {
			CantClick = 0
			HCW = 1;
			clickTimer = Date.now()
		}
	}
	if(updated >= 0) {
		for (var n37 = 0; n37 < 12; ++n37) { // makes sure blocks placed inside player are removed
			var n38 = ((ox + (n37 >> 0 & 0x1) * 0.6 - 0.3)|0) - 1
			var n39 = ((oy + ((n37 >> 2) - 1) * 0.8 + 0.65)|0) - 1
			var n40 = ((oz + (n37 >> 1 & 0x1) * 0.6 - 0.3)|0) - 1
			var INDEX = (n40 | 0) << 12 | (n39 | 0) << 6 | (n38 | 0)
			if (n38 >= 0 && n39 >= 0 && n40 >= 0 && n38 < 64 && n39 < 64 && n40 < 64 && INDEX === updated) {
				map[INDEX] = 0;
			}
		}
	}
	
	//gravity and hit detecion
	var yCos = Math.cos(yRot);
	var ySin = Math.sin(yRot);
	var xCos = Math.cos(xRot);
	var xSin = Math.sin(xRot);
	  
	var n24 = (W - S) * move_speed;
	var n25 = (D - A) * move_speed;
	var n26 = n9 * 0.5;
	var n27 = n10 * 0.99;
	var n28 = n11 * 0.5;
	n9 = n26 + (xSin * n24 + xCos * n25);
	n11 = n28 + (xCos * n24 - xSin * n25);
	n10 = n27 + 0.016;
	var n29 = 0;

	MovePlayer: while ((n29 < 3)) { //Each loop is an axis (X, Y, Z)
		var n30 = ox + n9 * (((n29 + 0) % 3 / 2 | 0));
		var n31 = oy + n10 * (((n29 + 1) % 3 / 2 | 0));
		var n32 = oz + n11 * (((n29 + 2) % 3 / 2 | 0));
		for (var n33 = 0; n33 < 12; ++n33) {
			var n34 = ((n30 + (n33 >> 0 & 1) * 0.6 - 0.3)|0) - 1
			var n35 = ((n31 + ((n33 >> 2) - 1) * 0.8 + 0.65)|0) - 1
			var n36 = ((n32 + (n33 >> 1 & 1) * 0.6 - 0.3)|0) - 1
			if (n34 < 0 || n35 < 0 || n36 < 0 || n34 >= 64 || n35 >= 64 || n36 >= 64 || map[n36 << 12 | n35 << 6 | n34] > 0 || (Shift == 1 && n29 === 1)) { // Is there a collision?
				if (n29 === 1) {
					if (Jump > 0 && n10 > 0) { // if player is not in air, make player jump
						n10 = -0.23;
					} else {
						n10 = 0;
					}
				}
				++n29;
				continue MovePlayer; //Immediately stop and go back to top of the loop (if n29 < 3)
			}
		}
		ox = n30;
		oy = n31;
		oz = n32;
		++n29;
	}
}

window.requestAnimationFrame = window.requestAnimationFrame || window.msRequestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.oRequestAnimationFrame || function(c) {setTimeout(c, 30)}

var FrameCount = 0;
function RAF() { // Clock for rendering...
	window.requestAnimationFrame(function(){
		renderMinecraft()
		FrameCount++
		RAF()
	})
}
setInterval(function(){ // set up FPS display
	FPSlabel.innerText = "FPS: " + FrameCount
	FrameCount = 0;
}, 1000)
RAF()

var FNT = [0,0,1,1,1,0,0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,1,1,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,1,1,0,0,1,1,0,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1,1,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,1,0,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,0,1,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,1,1,1,1,0,1,1,0,0,1,1,0,0,0,1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,1,1,1,0,1,1,1,1,1,0,0,0,1,1,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,1,0,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,1,1,0,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,0,1,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,0,0,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,0,0,0,0,1,1,0,1,0,0,0,0,1,1,0,0,1,1,0,0,1,0,1,0,0,0,0,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,1,0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,1,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,1,1,1,0,0,1,1,1,1,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] // NES font (at least from games owned by Nintendo)
var FNT_LEN = FNT.length/64; // how many characters?

//Characters: ABCDEFGHIJKLMNOPQRSTUVWXYZ,! ?.©0123456789<>????-????¦+-/~

//Camera controls
var camdirX = 0; // Left/Right
var camdirY = 0; // Up/Down

var MX, MY // Mouse positions
var move_speed_default = move_speed

var key_P = false; // the keys P and L
var key_L = false;

var debug_key = false;

window.onkeydown = function(e) {
	textar.focus();
	var code = e.keyCode ? e.keyCode : e.which;
	if(!ChatBar) {
		switch(code) {
			case 32: Jump=1; break
			case 16: move_speed=0.01; Shift = 1; break
			case 87: W=1; break
			case 83: S=1; break
			case 65: A=1; break
			case 68: D=1; break
			case 37: camdirX=1; break
			case 39: camdirX=2; break
			case 38: camdirY=1; break
			case 40: camdirY=2; break
			case 88: move_speed=0.2; break // X to sprint
			case 80: if(!key_P) {gameCanvas.onmousedown({which: 3}); key_P = true}; break // P to place block
			case 76: if(!key_L) {gameCanvas.onmousedown({which: 1}); key_L = true}; break // L to break block
			case 190: mouseWheel({deltaY: -1}); break;// . (>) Select next block
			case 188: mouseWheel({deltaY: 1}); break // , (<) Select previous block
			case 84: ChatBar = true; break;
			case 71: debug_key = true
		}
	} else if(ChatBarBuffer.length < MaxChatLen || code == 8 || code == 13 || code == 38 || code == 37 || code == 39 || code == 220) { // add letters to chat bar
		var previous = ChatBarBuffer.length
		if(code >= 65 && code <= 90 && !e.ctrlKey) chatInsertChar(code-65) // a-z
		if(code >= 48 && code <= 57 && !e.shiftKey) chatInsertChar(code-48 + 32) // 0-9
		if(code == 32) chatInsertChar(28) // space
		if(code == 190 && !e.shiftKey) chatInsertChar(30) // .
		if(code == 49 && e.shiftKey) chatInsertChar(27) // !
		if(code == 191 && e.shiftKey) chatInsertChar(29) // ?
		if(code == 188 && !e.shiftKey) chatInsertChar(26) // ,
		if(code == 188 && e.shiftKey) chatInsertChar(42) // <
		if(code == 190 && e.shiftKey) chatInsertChar(43) // >
		if(code == 189) chatInsertChar(55) // -
		if(code == 191 && !e.shiftKey) chatInsertChar(56) // /
		if(code == 192 && e.shiftKey) chatInsertChar(57) // ~
		if(previous != ChatBarBuffer.length) {
			incCursor()
		}
		
		if(code === 13) { // enter
			processCommand(ChatBarBuffer)
			PreviousChatBuffer = ChatBarBuffer.slice(0)
			ChatBarBuffer = [];
			ChatOffset = 0;
			ChatBar = false;
			CursorPosition = 0
		}
		if(code == 38) {
			ChatBarBuffer = PreviousChatBuffer.slice(0)
			CursorPosition = ChatBarBuffer.length
		} // up arrow
		if(code == 8) {
			deleteChatChar()
		} // backspace
		if(code == 37) { // < arrrow
			if(CursorPosition > 0) decCursor()
		}
		if(code == 39) { // > arrow
			if(CursorPosition < ChatBarBuffer.length) incCursor()
		}
		if(code == 220) { // \ key
			autoCompleteCommand()
		}
	}
};

window.onkeyup = function(e) {
	var code = e.keyCode ? e.keyCode : e.which;
	switch(code) {
		case 32: Jump=0; break
		case 16: move_speed=move_speed_default; Shift = 0; break
		case 87: W=0; break
		case 83: S=0; break
		case 65: A=0; break
		case 68: D=0; break
		case 37:
		case 39: camdirX=0; break
		case 38:
		case 40: camdirY=0; break
		case 88: move_speed=move_speed_default; break
		case 80: gameCanvas.onmouseup({which: 3}); key_P = false; break
		case 76: gameCanvas.onmouseup({which: 1}); key_L = false; break
		case 71: debug_key = false
	}
};

textar.oninput = function(e) {
	var tval = textar.value;
	if(e.inputType == "insertFromPaste" && ChatBar) { // paste?
		chatWriteText(tval.toUpperCase());
	}
	textar.value = "";
}

var ChatFontLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ,! ?.©0123456789<>...........-/~"

function sendChat(name, str) {
	Socket.send(JSON.stringify({
		type: "send_chat",
		message: str,
		name: name
	}))
	console.log("[You] " + name + ": " + str)
}

function processCommand(bufferdata) {
	var string = "";
	for(var i = 0; i < bufferdata.length; i++){
		string += ChatFontLetters.charAt(bufferdata[i])
	}
	if(string == "") return;
	if(string.charAt(0) != "/") {
		sendChat(name, string.toLowerCase());
	}
	if(string.charAt(0) === "/") {
		string = string.substr(1);
		
		string = string.split(" ")
		
		if(string[0] === "NICK") {
			name = string[1]
		}
		if(string[0] === "CLEARALL") {
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 64; y++){
					for(var z = 0; z < 64; z++){
						var i = z << 12 | y << 6 | x;
						map[i] = 0
					}
				}
			}
		}
		if(string[0] === "SETBLOCK") {
			var n1 = parseInt(string[1])
			var n2 = parseInt(string[2])
			var n3 = parseInt(string[3])
			var n4 = parseInt(string[4])
			setblock(n1, n2, n3, n4)
		}
		if(string[0] === "SPHERE") {
			oy = 3;
			ox = 2;
			oz = 2;
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 64; y++){
					for(var z = 0; z < 64; z++){
						setblock(x,y,z,0)
					}
				}
			}
			for(var x = -32; x < 32; x++){
				for(var y = -32; y < 32; y++){
					for(var z = -32; z < 32; z++){
						var c = x*x + y*y + z*z;
						if(c <= 32*32) setblock(x+32,y+32,z+32, 3)
					}
				}
			}
		}
		if(string[0] === "INVPYRAMID") {
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 64; y++){
					for(var z = 0; z < 64; z++){
						setblock(x,y,z,0)
					}
				}
			}
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 32; y++){
					for(var z = 0; z < 64; z++){
						setblock(x,y,z,3)
					}
				}
			}
			var sd = 1;
			for(var y = 31; y > 0; y--){
				for(var x = sd; x < 64 - sd; x++){
					for(var z = sd; z < 64 - sd; z++){
						setblock(x,y,z,0)
					}
				}
				sd++
			}
		}
		if(string[0] === "CONVERTALL") {
			var nbr = parseInt(string[1])
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 64; y++){
					for(var z = 0; z < 64; z++){
						var i = (63-z) << 12 | (63-y) << 6 | (63-x)
						if(map[i] !== 0) setblock(x,y,z,nbr)
					}
				}
			}
		}
		if(string[0] === "SPAWNPYRAMID") {
			var rnd1 = 3 // ranges
			var rnd2 = 19
			var cl = (rnd2 - rnd1) // find range
			var rnd = (Math.floor(Math.random()*cl)) // get random number between the ranges
			if(rnd%2 === 0) rnd++ // if even number, make it odd
			var yPos = (63-oy) | 0
			var xPos = (63-ox) | 0 // positions of player
			var zPos = (63-oz) | 0
			var height = Math.ceil(rnd/2) // height of pyramid
			var adj = 0 // difference of each level of pyramid
			for(var y = 0; y < height; y++){
				for(var x = adj; x < rnd - adj; x++){
					for(var z = adj; z < rnd - adj; z++){
						setblock(x + xPos+3,y+yPos+1,z+zPos+3,3) // add the block
					}
				}
				adj++
			}
		}
		if(string[0] === "HUGEPYRAMID") {
			oy = 3
			for(var x = 0; x < 64; x++){
				for(var y = 0; y < 64; y++){
					for(var z = 0; z < 64; z++){
						setblock(x,y,z,0)
					}
				}
			}
			var sd = 0;
			for(var y = 0; y < 32; y++){
				for(var x = sd; x < 63 - sd; x++){
					for(var z = sd; z < 63 - sd; z++){
						setblock(x,y,z,3)
					}
				}
				sd++
			}
		}
		if(string[0] === "TELEPORT") {
			var x = string[1]
			var y = string[2]
			var z = string[3]
			var x_upd = 0;
			var y_upd = 0;
			var z_upd = 0;
			if(x.charAt(0) === "~") {
				x = x.substr(1);
				if(x != "") {
					x = ox - parseFloat(x)
				} else {
					x = ox;
				}
				x_upd = 1;
			}
			if(y.charAt(0) === "~") {
				y = y.substr(1);
				if(y != "") {
					y = oy - parseFloat(y)
				} else {
					y = oy;
				}
				y_upd = 1;
			}
			if(z.charAt(0) === "~") {
				z = z.substr(1);
				if(z != "") {
					z = oz - parseFloat(z)
				} else {
					z = oz;
				}
				z_upd = 1;
			}
			if(!x_upd) {
				x = 63.5-parseFloat(x)
			}
			if(!y_upd) {
				y = 63.5-parseFloat(y)
			}
			if(!z_upd) {
				z = 63.5-parseFloat(z)
			}
			ox = x
			oy = y
			oz = z
		}
		if(string[0] === "NIGHT") {
			Night = true;
		}
		if(string[0] === "DAY") {
			Night = false;
		}
		if(string[0] === "RESET") {
			for (x = 0; x < 64; x++) { // default map (grass and dirt flat-land)
				for (y = 0; y < 64; y++) {
					for ( var z = 0; z < 64; z++) {
						i = z << 12 | y << 6 | x; // convert XYZ into index
						var block = 0
						if(y === 45) block = 1
						if(y > 45) block = 2
						map[i] = block
					}
				}
			}
			ox = 32
			oy = 22
			oz = 32
			
			ox = (63.5 - ox)
			oy = (63.5 - oy)
			oz = (63.5 - oz)
		}
		if(string[0] === "MAPDEMO") {
			for (x = 0; x < 64; x++) {
				for (y = 0; y < 64; y++) {
					for ( var z = 0; z < 64; z++) {
						i = z << 12 | y << 6 | x;
						var block = 0
						
						//default map:
						if(y == 34 || y == 29) {
							block = Math.trunc(Math.random() * 8) + 1
						}
						if(((x == 0 || x == 63 || z == 0 || z == 63) && (y <= 34 && y >= 29))) {
							block = 3
						}
						if(y == 34) block = 4
						if(z == 32 && x >= 12 && x <= 34 && y <= 34 && y >= 29) block = 5
						if((x % 6 === 0 && z % 6 === 0) && (y <= 34 && y >= 29)) {
							block = 7
						}
						
						map[i] = block
					}
				}
			}
			ox = 32.5
			oy = 31.5
			oz = 42
			
			ox = (63.5 - ox)
			oy = (63.5 - oy)
			oz = (63.5 - oz)
		}
		if(string[0] === "FILL") {
			if(string.length == 8) {
				var n1 = parseInt(string[1]) // x1
				var n2 = parseInt(string[2]) // y1
				var n3 = parseInt(string[3]) // z1
				var n4 = parseInt(string[4]) // x2
				var n5 = parseInt(string[5]) // y2
				var n6 = parseInt(string[6]) // z2
				var n7 = parseInt(string[7]) // block ID
				
				var lenX = Math.abs(n1 - n4)
				var XPOS = n1;
				var lenY = Math.abs(n2 - n5)
				var YPOS = n2;
				var lenZ = Math.abs(n3 - n6)
				var ZPOS = n3;
				var XDone = 0;
				var YDone = 0;
				var ZDone = 0;
				var startX = XPOS;
				var startY = YPOS;
				var startZ = ZPOS;
				for(var x = 0; x <= lenX; x++){
					for(var y = 0; y <= lenY; y++){
						for(var z = 0; z <= lenZ; z++){
							setblock(XPOS, YPOS, ZPOS, n7)
							if(n3 > n6) ZPOS--
							if(n3 < n6) ZPOS++
							ZDone++
							if(ZDone > lenZ) {
								ZDone = 0;
								ZPOS = startZ
							}
						}
						if(n2 > n5) YPOS--
						if(n2 < n5) YPOS++
						YDone++
						if(YDone > lenY) {
							YDone = 0;
							YPOS = startY
						}
					}
					if(n1 > n4) XPOS--
					if(n1 < n4) XPOS++
					XDone++
					if(XDone > lenX) {
						XDone = 0;
						XPOS = startX
					}
				}
			}
		}
	}
}

function incCursor() {
	CursorPosition++;
	var relativeCurPos = CursorPosition - ChatOffset;
	if(relativeCurPos > ChatWidth) {
		ChatOffset++;
	}
}
function decCursor() {
	CursorPosition--;
	var relativeCurPos = CursorPosition - ChatOffset;
	if(relativeCurPos < 0) {
		ChatOffset--;
	}
}

function chatInsertChar(code){
	var ar = [];
	if(ChatBarBuffer.length > 0) {
		if(CursorPosition == 0) ar.push(code)
		for(var i = 0; i < ChatBarBuffer.length; i++){
			ar.push(ChatBarBuffer[i])
			if(i === CursorPosition - 1) ar.push(code)
		}
	} else {
		ar = [code]
	}
	ChatBarBuffer = ar;
}

function deleteChatChar() {
	var ar = [];
	var CharRemoved = false;
	for(var i = 0; i < ChatBarBuffer.length; i++){
		if(i !== CursorPosition - 1) {
			ar.push(ChatBarBuffer[i])
		} else {
			CharRemoved = true
		}
	}
	if(CharRemoved) {
		decCursor()
		if(ChatOffset > 0) {
			ChatOffset--;
		}
	}
	ChatBarBuffer = ar;
}

function chatWriteText(txt) {
	for(var i = 0; i < txt.length; i++){
		var letter = 0
		for(var g = 0; g < ChatFontLetters.length; g++){
			if(ChatFontLetters.charAt(g) === txt.charAt(i)) {
				letter = g;
				break;
			}
		}
		if(ChatBarBuffer.length < MaxChatLen) {
			chatInsertChar(letter)
			incCursor()
		} else {
			break
		}
	}
}

function autoCompleteCommand() {
	var string = "";
	for(var i = 0; i < ChatBarBuffer.length; i++){
		string += ChatFontLetters.charAt(ChatBarBuffer[i])
	}
	if(string.charAt(0) === "/") {
		string = string.substr(1)
		string = string.split(" ")
		if(string[0] === "FILL") {
			var px = 63-(var14%64)
			var py = 63-(var14%(64*64)>>6)
			var pz = 63-(var14%(64*64*64)>>12)
			var tmp = string.length - 1;
			if(tmp === 1 && string[1] === "") chatWriteText(px.toString())
			if(tmp === 2 && string[2] === "") chatWriteText(py.toString())
			if(tmp === 3 && string[3] === "") chatWriteText(pz.toString())
			if(tmp === 4 && string[4] === "") chatWriteText(px.toString())
			if(tmp === 5 && string[5] === "") chatWriteText(py.toString())
			if(tmp === 6 && string[6] === "") chatWriteText(pz.toString())
		}
	}
}

var ox = 32 // player positions
var oy = 22
var oz = 32

ox = (63.5 - ox) // invert coordinates to process correctly
oy = (63.5 - oy)
oz = (63.5 - oz)

ox += 1 // 1 is added for fix an issue with coordinates being zero
oy += 1
oz += 1

var xRot = 0 //camera rotations
var yRot = 0
var var14 = -1; // what block is mouse pointing at?
var var15 = 0; // where would the block be if placed?
var var66 = -1; // var14 changes to this at the end of each render (to make sure selection box is accurate)

var selectedBlock = 1;

var W = 0;
var A = 0;
var S = 0;
var D = 0;
var Jump = 0;
var Shift = 0;
var ChatBar = false;
var ChatBarBuffer = [];
var MaxChatLen = 2048; // max characters in chat bar
var ChatWidth = Math.floor(w / 8); // characters that can fit in window
var ChatOffset = 0;
var PreviousChatBuffer = [];
var CursorPosition = 0;

var LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ "
var LET_ = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,28]
var BlockLabel = ["AIR","GRASS","DIRT","STONE","BRICK","WOOD","LEAVES","WATER","GLASS","GCRYSTAL","WHITE","BLACK","RED","GREEN","BLUE","ORANGE","MAGENTA","LIGHT BLUE","YELLOW","LIME","PINK","GRAY","LIGHT GRAY","CYAN","PURPLE","BROWN","FRACTAL"]
var BlockTypeCount = BlockLabel.length
var str = []; // font numbers for top left corner text
function updStr(s){ // update text on top left corner
	var d = [];
	for(var i = 0; i < s.length; i++){
		for(var k = 0; k < LET.length; k++){
			if(LET.charAt(k) === s.charAt(i)) {
				d.push(LET_[k])
			}
		}
	}
	str = d
}
function updateCornerStr() {
	updStr(BlockLabel[selectedBlock])
}
updateCornerStr() // update top left corner text to selected block

function setblock(x,y,z,type) {
	/*
		The default grass terrain ground level is Y: 18.
		The block right below the player is X: 32, Y: 18, Z: 32
		X starts from zero at forward right, ends at 63 at forward left
		Z starts from zero at forward right, ends at 63 at backward right
		Y starts from zero at bottom, ends at 63 at top
	*/
	map[(63-z) << 12 | (63-y) << 6 | (63-x)] = type % BlockTypeCount; // inverting xyz because the coordinate system is inverted
}

var n9 = 0; // move on x axis
var n10 = 0; // fall on y axis
var n11 = 0; // move on z axis

var debugg = false

var FOV = 1;
var rDistance = 111;

function renderMinecraft() {
	//sine and cosine numbers range from -1 to 1 (depending on the input)
	var yCos = Math.cos(yRot);
	var ySin = Math.sin(yRot);
	var xCos = Math.cos(xRot);
	var xSin = Math.sin(xRot);
	
	var hw = Math.ceil(w/2) // half of width/height
	var hh = Math.ceil(h/2)
	var updated_selection_box = false; // if selection box is out of reach, it's location is set to -1
	var ChatBarMinusHeight = 10*ChatBar // If math is done on ChatBar (boolean), 'true' acts as 1 and 'false' acts as 0. 'true' will make it 10, 'false' will make it 0. The height of the rendering view will be subtracted by this if the chatbar is visible.
	
	var NEG__ = false;
	for ( var x = 0; x < w; x++) { // all x pixels
		var xScale = (x - w / 2) / h;
		// translate x coordinate to -0.5 to 0.5
		for ( var y = 0; y < h-ChatBarMinusHeight; y++) { // all y pixels
			var yScale = (y - h / 2) / h;
			// translate y coordinate to -0.5 to 0.5
			
			var CE = (x === hw && y === hh) // Is the pixel in the middle of the crosshair?
			var DE = (x === MX && y === MY && debug_key)

			var zDepthScale = (FOV * yCos + yScale * ySin)
			// 0 if looking straight down or up, 1 if looking forward.
			if(debug_key && CE) console.log(zDepthScale)
			
			var _yd = (yScale * yCos - FOV * ySin)
			var _xd = (xScale * xCos + zDepthScale * xSin)
			var _zd = (zDepthScale * xCos - xScale * xSin)

			var col = 0; // Color of pixel
			var colUpdated = false; // did color get updated?
			var br = 255; // Brightness
			var ddist = 255; // Distance fading

			var closest = rDistance; // Distance to render everything
			var var36 = closest; //max distance for selection box
			for ( var d = 0; d < 3; d++) { // One loop for each visible face
				if(x == 0 && y == 0 && debugg) console.log("@@@")
				var dimLength = _xd;
				if (d == 1)
					dimLength = _yd;
				if (d == 2)
					dimLength = _zd;

				var ll = Math.abs(dimLength)
				var xd = _xd / ll;
				var yd = _yd / ll;
				var zd = _zd / ll;

				//blocks are glitchy when the camera is behind XYZ 0.5 because of decimal precision errors
				var initial = ox - (ox | 0);
				if (d == 1)
					initial = oy - (oy | 0);
				if (d == 2)
					initial = oz - (oz | 0);
					
				NEG__ = initial < 0
					
				initial = Math.abs(initial)
					
				if (dimLength > 0 && !NEG__)
					initial = 1 - initial; // invert the initial number
					
				if(dimLength < 0 && NEG__) {
					initial = 1 - initial;
				}

				var dist = initial / ll; // total distance ray has travelled?

				var xp = (ox + xd * initial)
				var yp = (oy + yd * initial)
				var zp = (oz + zd * initial)

				if (dimLength < 0) {
					if (d === 0)
						xp--;
					if (d === 1)
						yp--;
					if (d === 2)
						zp--;
				}
				
				while (dist < closest) { // if the blocks are within distance
					var ux = (xp - 1) // adjusted XYZ positions
					var uy = (yp - 1)
					var uz = (zp - 1)
					if(uz < 64 && uy < 64 && ux < 64 && uz >= 0 && uy >= 0 && ux >= 0) { //render only blocks inside the map
						var ptr = uz << 12 | uy << 6 | ux // index of the block
						var tex = map[ptr]; // block from the map
						if ((tex > 0 || (ptr === var14))) { // if the block is not air or if the block is selected
							var u = ((ux + uz) * 16) & 15; // x position of the texture
							var v = ((uy * 16) & 15) + 16; // y position of the texture. any number greater than 16 is a different side of the block
							if (d == 1) { // if top/botttom face
								u = (ux * 16) & 15;
								v = ((uz * 16) & 15);
								if (yd < 0)
									v += 32;
							}
							
							var cc = 16777215
							if(ptr != var14 || u > 0 && v % 16 > 0 && u < 15 && v % 16 < 15) { // if block is selection box
								cc = texmap[u + v * 16 + tex * 256 * 3];
							}
							
							if(dist < var36 && CE && tex > 0) { // Calculate selection box location
								updated_selection_box = true
								var66 = ptr;
								var36 = dist
								
								var NEG = 1;
								if(dimLength > 0) {
								   NEG = -1;
								}
								var15 = NEG << 6 * d;
							}
							if (cc > 0) {
								col = cc;
								colUpdated = true
								ddist = 255 - ((dist << 3) | 0) // No "if true" statement, because it somehow slows the engine down.
								if(!Night) ddist = ((dist * 25.6) | 0) - 600
								br = (255 - ((d + 2) % 3) * 50)
								closest = dist; // make this the final loop
							}
						}
					} else {
						closest = dist;
						if(dist < var36 && CE) {
							updated_selection_box = true
							var _x = ux | 0
							var _y = uy | 0
							var _z = uz | 0
							if(_x > 63) _x = 63
							if(_y > 63) _y = 63
							if(_z > 63) _z = 63
							if(_x < 0) _x = 0
							if(_y < 0) _y = 0
							if(_z < 0) _z = 0
							
							var66 = _z << 12 | _y << 6 | _x
							var36 = dist
							
							var NEG = 1;
							if(dimLength > 0) {
							   NEG = -1;
							}
							var15 = 0
						}
					}
					//move the ray forward to the next block's wall
					if(x == 0 && y == 0 && debugg) console.log([xp, yp, zp, dist, ll])
					xp += xd;
					yp += yd;
					zp += zd;
					dist += 1/ll;
				}
			}
			
			if(ddist < 0) ddist = 0 // if fade distance is negative, the color will get distorted.
			
			var TMP = 0; // the skybox pixel color as 24-bit integer
			var skyboxR = 0; // skybox pixel colors as RGB integer
			var skyboxG = 0;
			var skyboxB = 0;
			
			if(x == 0 && y == 0 && debugg) console.log("-------------------------------------------")
			
			if(!colUpdated && !Night) { // render skybox (same rendering engine, with modified code)
				
				var zDepthScale = (1 * yCos + yScale * ySin)
				var _yd = (yScale * yCos - 1 * ySin)
				var _xd = (xScale * xCos + zDepthScale * xSin)
				var _zd = (zDepthScale * xCos - xScale * xSin)
			
				closest = 1
				for ( var d = 0; d < 3; d++) { // One loop for each visible face
					var dimLength = _xd; // how far the camera is from a particular face?
					if (d == 1)
						dimLength = _yd;
					if (d == 2)
						dimLength = _zd;

					var ll = 1 / Math.abs(dimLength)
					var xd = (_xd) * ll;
					var yd = (_yd) * ll;
					var zd = (_zd) * ll;
					var dist = ll / 2;
					var xp = (0.5 + xd / 2)
					var yp = (0.5 + yd / 2)
					var zp = (0.5 + zd / 2)
					
					if (dist <= closest) {
						var tex = 7
						var u = ((xp + zp) * 16) & 15;
						var v = ((yp * 16) & 15);
						if (d == 1) {
							u = xp * 16 & 15;
							v = zp * 16 & 15;
						}
						TMP = texmap[u + v * 16 + tex * 256 * 3];
						closest = dist;
						xp += xd;
						yp += yd;
						zp += zd;
						dist += ll;
					}
				}
			}
			skyboxR = ((TMP >> 16) & 0xff)
			skyboxG = ((TMP >> 8) & 0xff)
			skyboxB = ((TMP) & 0xff)
			if(!Night) {
				var r = (((col >> 16) & 0xff) * br / (255)) + skyboxR
				var g = (((col >> 8) & 0xff) * br / (255)) + skyboxG
				var b = (((col) & 0xff) * br / (255)) + skyboxB
			}
			if(Night) {
				var r = ((col >> 16) & 0xff) * br * ddist / (255 * 255);
				var g = ((col >> 8) & 0xff) * br * ddist / (255 * 255);
				var b = ((col) & 0xff) * br * ddist / (255 * 255);
			}

			if(((x >= Math.floor(w/2) - 1 && x < Math.floor(w/2) + 1) || (y >= Math.floor(h/2) - 1 && y < Math.floor(h/2) + 1)) && (((x < Math.floor(w/2) + 5) && (x >= Math.floor(w/2) - 5)) && ((y < Math.floor(h/2) + 5) && (y >= Math.floor(h/2) - 5)))) { //crosshair
				r = 255-r //INVERT RGB
				g = 255-g
				b = 255-b
			}
			pixels.data[(x + y * w) * 4 + 0] = r;
			pixels.data[(x + y * w) * 4 + 1] = g;
			pixels.data[(x + y * w) * 4 + 2] = b;
		}
	}
	//icon dimensions
	var ic_width = 16;
	var ic_height = 16;
	for(var x = 0; x < ic_width; x++){ // render block icon (this is like the rendering function, only with most things removed, and has hardcoded variables)
		var ___xd = (x - ic_width / 2) / ic_height;
		for(var y = 0; y < ic_height; y++){
			var col = 0;
			var colupd = false;
			var __yd = (y - ic_height / 2) / ic_height;
			var ___zd = 0.7648421872844885 + __yd * -0.644217687237691;
			var _yd = (__yd * 0.7648421872844885 + 0.644217687237691)
			var _xd = ___xd * 0.6967067093471654 + ___zd * 0.7173560908995228;
			var _zd = ___zd * 0.6967067093471654 - ___xd * 0.7173560908995228;
			var closest = 2;
			var br = 0;
			for ( var d = 0; d < 3; d++) {
				var dimLength = _xd;
				if (d == 1)
					dimLength = _yd;
				if (d == 2)
					dimLength = _zd;
				var ll = 1 / (dimLength < 0 ? -dimLength : dimLength);
				var xd = (_xd) * ll;
				var yd = (_yd) * ll;
				var zd = (_zd) * ll;
				var initial = 63.5
				if (dimLength > 0)
					initial = -62.5 // perform 1 - initial
				var dist = ll * initial;
				var xp = xd * initial - 0.5
				var yp = yd * initial - 0.5
				var zp = zd * initial - 0.5
				while (dist <= closest) {
					if(zp < 1 && yp < 1 && xp < 1 && zp >= 0 && yp >= 0 && xp >= 0) {
						if (selectedBlock > 0) {
							var u = ((xp + zp) * 16) & 15;
							var v = ((yp * 16) & 15) + 16;
							if (d == 1) {
								u = (xp * 16) & 15;
								v = ((zp * 16) & 15);
							}
							cc = texmap[u + v * 16 + selectedBlock * 256 * 3];
							if (cc > 0) {
								col = cc;
								colupd = true;
								closest = dist;
								br = 255 * (255 - ((d + 2) % 3) * 50) / 255;
							}
						}
					}
					xp += xd;
					yp += yd;
					zp += zd;
					dist += ll;
				}
			}
			if(colupd) {
				pixels.data[(x + (y+8) * w) * 4 + 0] = ((col >> 16) & 0xff)*br/255;
				pixels.data[(x + (y+8) * w) * 4 + 1] = ((col >> 8) & 0xff)*br/255;
				pixels.data[(x + (y+8) * w) * 4 + 2] = ((col) & 0xff)*br/255;
			}
		}
	}
	
	var14 = var66; // make selection box location official
	if(!updated_selection_box) {
		var14 = -1
		var15 = -1
	}
	
	for(var zz = 0; zz < str.length; zz++){ //draw the font
		var f = str[zz]
		var y = 0
		var x = zz*8
	
		f = Math.trunc(f)
		x = Math.trunc(x)
		y = Math.trunc(y)
		if(f > FNT_LEN) f = FNT_LEN
		var d = f << 6
		for(var _y = 0; _y < 8; _y++){
			for(var _x = 0; _x < 8; _x++){
				if(FNT[d] === 1) {
					var __x = x + _x
					var __y = y + _y
					pixels.data[(__x + __y*w) * 4 + 0] = 255 - pixels.data[(__x + __y*w) * 4 + 0];
					pixels.data[(__x + __y*w) * 4 + 1] = 255 - pixels.data[(__x + __y*w) * 4 + 1];
					pixels.data[(__x + __y*w) * 4 + 2] = 255 - pixels.data[(__x + __y*w) * 4 + 2];
				}
				d++
			}
		}
	}
	
	if(ChatBar) {
		var y = h-10;
		for(var f = 0; f < 10; f++){
			for(var x = 0; x < w; x++){
				pixels.data[(x + (f+y)*w) * 4 + 0] = 24
				pixels.data[(x + (f+y)*w) * 4 + 1] = 24
				pixels.data[(x + (f+y)*w) * 4 + 2] = 24
			}
		}
		
		var cstart = 0;
		var cend = Math.min(ChatBarBuffer.length, ChatWidth);
		
		cstart += ChatOffset;
		cend += ChatOffset;
		/*if(cend > ChatWidth) cend = ChatWidth - 1;
		if(cstart < 0) cstart = 0;*/
		
		for(var zz = cstart; zz < cend; zz++){ //draw the font
			var f = 29;
			if(zz >= 0 && zz < ChatBarBuffer.length) {
				f = ChatBarBuffer[zz]
			}
			var y = h-9
			var x = (zz - ChatOffset) << 3 // zz * 8
			
			if(f > FNT_LEN) f = FNT_LEN
			var d = f << 6 // f * 64
			for(var _y = 0; _y < 8; _y++){
				for(var _x = 0; _x < 8; _x++){
					if(FNT[d] === 1) {
						var __x = x + _x
						var __y = y + _y
						pixels.data[(__x + __y*w) * 4 + 0] = 255
						pixels.data[(__x + __y*w) * 4 + 1] = 255
						pixels.data[(__x + __y*w) * 4 + 2] = 255
					}
					d++
				}
			}
		}
		
		//text cursor
		var ChatLen = ChatBarBuffer.length;
		for(var x = 0; x < 1; x++){
			for(var y = 0; y < 10; y++){
				var _x = x + 8*(CursorPosition - ChatOffset);
				var _y = y + h-10;
				if (_x < w && _y < h) {
					pixels.data[(_x + _y*w) * 4 + 0] = 255-pixels.data[(_x + _y*w) * 4 + 0]
					pixels.data[(_x + _y*w) * 4 + 1] = 255-pixels.data[(_x + _y*w) * 4 + 1]
					pixels.data[(_x + _y*w) * 4 + 2] = 255-pixels.data[(_x + _y*w) * 4 + 2]
				}
			}
		}
	}
	
	ctx.putImageData(pixels, 0, 0);
}

Math.trunc = Math.trunc || function(x) { //Math.trunc is not supported in Internet Explorer
	if (isNaN(x)) {
		return NaN;
	}
	if (x > 0) {
		return Math.floor(x);
	}
	return Math.ceil(x);
};

function canvasSize() {
	clientW = window.innerWidth;
	clientH = window.innerHeight;
	var wh = w, ht = h;
	var screen_width = clientW
	var screen_height = clientH
	
	var mn = Math.min(screen_width / w, screen_height / h)
		
	wh = (mn * w)
	ht = (mn * h)
	gameCanvas.style.width = (Math.trunc(wh)) + "px"
	gameCanvas.style.height = (Math.trunc(ht)) + "px"
	if(automaticGameSize) {
		w = Math.trunc(wh)
		h = Math.trunc(ht)
		gameCanvas.width = w;
		gameCanvas.height = h;
		pixels = ctx.createImageData(w, h);

		for (i = 0; i < w * h; i++) { // fill alpha channel with 255's (make it not transparent)
			pixels.data[i * 4 + 3] = 255;
		}
		updates = true
	}
}
canvasSize();
gameCanvas.width = w;
gameCanvas.height = h;
onresize = canvasSize;