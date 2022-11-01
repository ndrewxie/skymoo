var playerID;
var reconnectID = undefined;

var config;
var msgpack;
var mapStructures;
var unifiedItems;

var smoothTime;

var countdownTimer = undefined;
var myColor;
var kills = 0;
var hitting = undefined;
var buildMult = 1.0;

window.projectedX = 0;
window.projectedY = 0;

window.visiblePlayers = [];
window.occludeSwitchTime = undefined;
window.frameFullOcclude = false;
window.oldFrameOcclude =  false;
var occludeCutoffCounter = 0;
window.players = [];
window.structures = [];
window.bullets = [];
window.playerNames = [];
window.playerAllegiances = [];
window.playerColors = []
var structureCounts = [];
window.hitTimes = [];
var hitObjects = [];
window.clans = [];
var lastPing = 0;
var lastFrame = window.performance.now();
var ping = 0;
var fps = 0;

window.VIEW_X = undefined;
window.VIEW_Y = undefined;
window.HVIEW_X = undefined;
window.HVIEW_Y = undefined;

var CENTERX;
var CENTERY;
var PLAYER_RAD;
var BORDER_STROKE_STYLE;
var BORDER_STROKE_WIDTH;
var PLAYER_COLOR;

var SCALE;
var PLAYER_RAD;

var gCanvas;
var ctx;
var minimapCanvas;
var minictx;
var HUDData;

var hitAngleCounter = 0;
var hit = false;

window.images = [];
for (let j = 0; j < window.config.unifiedItems.length; j++) {
    let currItem = window.config.unifiedItems[j];
    if (typeof currItem.imageFile !== 'undefined') {
        window.images[j] = new Image();
        window.images[j].src = currItem.imageFile;
    }
}
var imageDimensions = [];    

const RADS_PER_MS = 0.012;
const HIT_NOTIF_LIFETIME = 400;
const DAMAGE_NOTIF_LIFETIME = 2000;
const DAMAGE_NOTIF_DISPLACEMENT = 6.0 * config.PLAYER_RADIUS;

var minimaprenderCounter = 0;

var recieved = msgpack.preDecode(new Uint8Array([]));

function drawApple() {
    ctx.beginPath();
    ctx.strokeStyle = BORDER_STROKE_STYLE;
    ctx.fillStyle = '#FF0000';
    ctx.arc(0, -1.2 * PLAYER_RAD, PLAYER_RAD * 0.65, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
}

function drawItem(myCtx, halfWidth, halfHeight, x, y, type, dir, boxItem = undefined, boxQty = undefined) {
    let hType = unifiedItems[type];
    if (hType !== undefined) {
        let pRadius = undefined;
        if (hType.renderRadius !== undefined) {
            pRadius = hType.renderRadius * SCALE;
        }
        else {
            pRadius = hType.radius * SCALE;
        }
        if (x - pRadius > halfWidth) {
            return;
        }
        if (x + pRadius < -halfWidth) {
            return;
        }
        if (y - pRadius > halfHeight) {
            return;
        }
        if (y + pRadius < -halfHeight) {
            return;
        }
		myCtx.translate(x, -y);
		myCtx.rotate(dir);
		if (hType.imageFile !== undefined) {
			myCtx.drawImage(window.images[type], -pRadius, -pRadius, 2 * pRadius, 2 * pRadius);
		}
		else {
			myCtx.beginPath();
			myCtx.strokeStyle = BORDER_STROKE_STYLE;
			myCtx.fillStyle = hType.color;
			myCtx.arc(0, 0, pRadius, 0, 2 * Math.PI, false);
			myCtx.fill();
			myCtx.stroke();
		}
		
		if (typeof boxItem != 'undefined') {
			let height = window.images[boxItem].height;
			let width = window.images[boxItem].width;
			if (height == width) {
				myCtx.drawImage(window.images[boxItem], -pRadius, -pRadius, 2 * pRadius, 2 * pRadius);
			}
			else if (height > width) {
				let ratio = width / height;
				myCtx.drawImage(window.images[boxItem], -0.5 * (2 * pRadius * ratio), -pRadius, 2 * pRadius * ratio, 2 * pRadius);
			}
			else {
				let ratio = height / width;
				myCtx.drawImage(window.images[boxItem], -pRadius, -0.5 * (2 * pRadius * ratio), 2 * pRadius, 2 * pRadius * ratio);
			}
		}
		myCtx.rotate(-dir);
		if ((typeof boxQty != 'undefined') && (boxQty > 0)) {
			myCtx.textBaseline = 'middle';
			myCtx.textAlign = 'center';
			myCtx.font = "20px Arial";
			myCtx.fillStyle = "#FFFFFF";
			myCtx.fillText('x' + boxQty, 0, 0);
		}
		myCtx.translate(-x, y);
    }
}

function drawPlayer(playerX, playerY, playerDir, playerHolding, playerHealth, playerName, playerHitting, theid, currentTime) {
    let rotationAngle = 0;
    ctx.translate(playerX, -playerY);
    //ctx.fillStyle = PLAYER_COLOR;
    //ctx.fillText(playerName, 0, -PLAYER_RAD * 1.4);
    if (playerHitting !== undefined) {
        if ((currentTime - playerHitting) * RADS_PER_MS > ((Math.PI/2) + config.HIT_ANGLE)) {
            playerHitting = undefined;
            rotationAngle = playerDir;
        }
        else {
            rotationAngle = playerDir - (currentTime - playerHitting) * RADS_PER_MS;
        }
    }
    else {
        rotationAngle = playerDir;
    }
    ctx.rotate(rotationAngle);
    let holdingData = config.unifiedItems[playerHolding];
    if (holdingData !== undefined) {
        if ((holdingData.imageFile !== undefined) && ((holdingData.action == config.getActionByName("melee")) || (holdingData.action == config.getActionByName("shield")) || (holdingData.action == config.getActionByName("gun")) || (holdingData.action == config.getActionByName("repairer")))) {
            let lengthX = undefined;
            let lengthY = undefined;
            if (holdingData.vertical !== true) {
                ctx.drawImage(window.images[playerHolding], -(holdingData.offsetX * SCALE), -(PLAYER_RAD + holdingData.offsetY * SCALE), imageDimensions[playerHolding][0], imageDimensions[playerHolding][1]);
            }
            else {
                let lengthX = imageDimensions[playerHolding][0];
                let lengthY = imageDimensions[playerHolding][1];
                ctx.drawImage(window.images[playerHolding], -(lengthX/2), -(PLAYER_RAD + lengthY - 4), lengthX, lengthY);
            }
        }
        else {
            if (unifiedItems[playerHolding] !== undefined) {
				let holdOffset = 0;
				if (unifiedItems[playerHolding].holdOffset != undefined) {
				    holdOffset = unifiedItems[playerHolding].holdOffset;
				}
				drawItem(ctx, CENTERX, CENTERY, 0, PLAYER_RAD + (unifiedItems[playerHolding].radius - holdOffset) * SCALE, playerHolding, 0);
            }
        }
    }
    ctx.setTransform(1, 0, 0, 1, CENTERX, CENTERY);
    drawHealthBar(playerX, playerY, PLAYER_RAD, playerHealth, config.MAX_HEALTH, theid);
}

function drawPlayerBody(playerX, playerY, playerName, color) {
	ctx.strokeText(playerName, playerX, -playerY - PLAYER_RAD * 1.4);
    ctx.fillText(playerName, playerX, -playerY - PLAYER_RAD * 1.4);
    ctx.beginPath();
    if (color == 0) {
        ctx.arc(playerX, -playerY, PLAYER_RAD, 0, 2 * Math.PI, false);
        ctx.stroke();
        ctx.fill();
    }
    else {
        ctx.fillStyle = config.colors[color];
        ctx.arc(playerX, -playerY, PLAYER_RAD, 0, 2 * Math.PI, false);
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = PLAYER_COLOR;
    }
    ctx.stroke();
}

function drawHealthBar(realX, realY, radius, health, maxhealth, id) {
    ctx.save();
    ctx.translate(realX, -realY);
	
	ctx.beginPath();
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = radius * 0.65;
    ctx.moveTo(-radius * 0.9 + 1, radius * 1.6);
    ctx.lineTo(radius * 0.9 - 1, radius * 1.6);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.lineWidth = radius * 0.3;
    if (id == playerID) {
        ctx.strokeStyle = '#00ff00';
    }
    else if (window.playerAllegiances[playerID] == undefined) {
        ctx.strokeStyle = '#ff0000';
    }
    else if (window.playerAllegiances[playerID] == window.playerAllegiances[id]) {
        ctx.strokeStyle = "#00ff00";
    }
    else {
        ctx.strokeStyle = "#ff0000";
    }
    ctx.moveTo(-radius * 0.9 + 1, radius * 1.6);
    ctx.lineTo((2 * (health / maxhealth) - 1) * (radius * 0.9 - 1), radius * 1.6);
    ctx.stroke();
    ctx.restore();
}

function beginMinimapUpdate(shouldPing) {
    minictx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    if (shouldPing == true) {
        minictx.fillStyle = 'rgba(235, 59, 59, 0.6)';
    }
    else {
        minictx.fillStyle = 'rgba(102, 186, 125, 0.3)';
    }
    minictx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minictx.fillStyle = '#00FF00';
    minictx.beginPath();
    minictx.arc(window.projectedX * (minimapCanvas.width / config.MAP_X), minimapCanvas.height - window.projectedY * (minimapCanvas.height / config.MAP_Y), 4, 0, 2 * Math.PI);
    //minictx.stroke();
    minictx.fill();
}

function addSimpleCorners(lp1, lp2) {
    if ((Math.sign(lp2[1]) != Math.sign(lp1[1])) &&
        (Math.sign(lp2[0]) == Math.sign(lp1[0]))
    ) {
        ctx.lineTo(CENTERX * Math.sign(lp2[0]), lp2[1]);
        ctx.lineTo(CENTERX * Math.sign(lp1[0]), lp1[1]);
        return true;
    }
    else if ((Math.sign(lp2[0]) != Math.sign(lp1[0])) &&
            (Math.sign(lp2[1]) == Math.sign(lp1[1]))
    ) {
        ctx.lineTo(lp2[0], CENTERY * Math.sign(lp2[1]));
        ctx.lineTo(lp1[0], CENTERY * Math.sign(lp1[1]));
        return true;
    }
    else if ((Math.sign(lp2[0]) == Math.sign(lp1[0])) &&
            (Math.sign(lp2[1]) == Math.sign(lp1[1]))
    ) {
        if (Math.abs(lp1[1]) > Math.abs(lp2[1])) {
            ctx.lineTo(lp2[0], lp1[1]);
        }
        else {
            ctx.lineTo(lp1[0], lp2[1]);
        }
        return true;
    }
    return false;
}

window.showGameUI = function() {
	document.getElementById('menuHolder').style.display = "none";
    document.getElementById('lowerBanner').style.display = "none";
	document.getElementById('GameCanvas').style.visibility = "visible";
	document.getElementById('minimap').style.display = "initial";
	document.getElementById('HUDData').style.display = "initial";
	document.getElementById('chatDisplay').style.display = "initial";
	document.getElementById('actionFloat').style.display = "initial";
    if ((window.screen.height <= 500) || (window.screen.width <= 500)) {
        document.getElementById('leaderboard').style.display = "none";
    }
	document.getElementById('selectBar').style.display = "flex";
	document.getElementById('disconnected').style.display = "none";
}


window.hideGameUI = function() {
	document.getElementById('menuHolder').style.display = "flex";
    document.getElementById('lowerBanner').style.display = "flex";
	document.getElementById('GameCanvas').style.visibility = "hidden";
	document.getElementById('minimap').style.display = "none";
	document.getElementById('chatDisplay').style.display = "none";
	document.getElementById('selectBar').style.display = "none";
	document.getElementById('actionFloat').style.display = "none";
	document.getElementById('HUDData').style.display = "none";
	document.getElementById('teamList').style.display = "none";
	document.getElementById('storageManagementHolder').style.display = "none";

    window.randomizeTip();
}

window.updateStructureCanvas = true;
let gameStructureCanvas = document.createElement("canvas");
let cachedCtx = gameStructureCanvas.getContext("2d");
let cachedHalfWidth = 0;
let cachedHalfHeight = 0;
let maxCachedHalfWidth = 0;
let maxCachedHalfHeight = 0;

function redrawStructuresCanvas() {
	window.updateStructureCanvas = false;
	
	let myPlayer = window.players[window.playerID];
	cachedHalfWidth = (window.VIEW_X + 3 * Math.abs(myPlayer.deltas[0])) * SCALE * 0.5;
	cachedHalfHeight = (window.VIEW_Y + 3 * Math.abs(myPlayer.deltas[1])) * SCALE * 0.5;
	
	if ((cachedHalfWidth > maxCachedHalfWidth) || (cachedHalfHeight > maxCachedHalfHeight)) {
		maxCachedHalfWidth = Math.max(maxCachedHalfWidth, cachedHalfWidth);
		maxCachedHalfHeight = Math.max(maxCachedHalfHeight, cachedHalfHeight);
		gameStructureCanvas.width = 2 * maxCachedHalfWidth;
		gameStructureCanvas.height = 2 * maxCachedHalfHeight;
	}
	else {
		cachedCtx.clearRect(0, 0, 2 * maxCachedHalfWidth, 2 * maxCachedHalfHeight);
	}
	
	cachedCtx.save();
	cachedCtx.translate(cachedHalfWidth, cachedHalfHeight);
	for (let j = 0; j < mapStructures.length; j++) {
        drawItem(cachedCtx, cachedHalfWidth, cachedHalfHeight, (mapStructures[j][1] - myPlayer.oldProjectedLoc[0]) * SCALE, (mapStructures[j][2] - myPlayer.oldProjectedLoc[1]) * SCALE, mapStructures[j][0], mapStructures[j][3]);
    }
	
	for (let j = 0; j < window.structures.length; j++) {
        if (window.structures[j] !== undefined) {
			drawItem(cachedCtx, cachedHalfWidth, cachedHalfHeight, 
						(window.structures[j].infoX - myPlayer.oldProjectedLoc[0]) * SCALE, 
						(window.structures[j].infoY - myPlayer.oldProjectedLoc[1]) * SCALE, 
						window.structures[j].infoType, window.structures[j].infoDir, 
						window.structures[j].boxItem, window.structures[j].boxQty
					);
		}
	}
	cachedCtx.restore();
}
window.cacheStructure = function(inputStructure) {
	if (window.updateStructureCanvas) {
		redrawStructuresCanvas();
	}
	else {
		let myPlayer = window.players[window.playerID];
		cachedCtx.save();
		cachedCtx.translate(cachedHalfWidth, cachedHalfHeight);
		drawItem(cachedCtx, cachedHalfWidth, cachedHalfHeight, 
					(inputStructure.infoX - myPlayer.oldProjectedLoc[0]) * SCALE, 
					(inputStructure.infoY - myPlayer.oldProjectedLoc[1]) * SCALE, 
					inputStructure.infoType, inputStructure.infoDir, 
					inputStructure.boxItem, inputStructure.boxQty
				);
		cachedCtx.restore();
	}
}

function renderLoop(theTime) {
	window.requestAnimationFrame(renderLoop);
	if (window.isPaused) {
		return;
	}
	
	if ((typeof window.playerID == 'undefined') || (typeof window.players[window.playerID] == 'undefined')) {
		return;
	}
	
    let currentT = theTime; // window.performance.now()
    fps = 1000 / (currentT - lastFrame);
    lastFrame = currentT;
    let newT = currentT - lastUpdate;

	let selfProjectedLoc = window.players[window.playerID].getProjectedLoc(currentT);
    window.projectedX = selfProjectedLoc[0];
    window.projectedY = selfProjectedLoc[1];

    minimaprenderCounter += 1;
    if ((window.playerAllegiances[playerID] === undefined) && (minimaprenderCounter >= 15)) {
        minimaprenderCounter = 0;
        beginMinimapUpdate(false);
    }

    ctx.clearRect(0, 0, gCanvas.width, gCanvas.height);
	
	ctx.save();
    if (window.projectedX + window.HVIEW_X + 2 * PLAYER_RAD >= config.CAVE_X) {
        let caveStartX = (config.CAVE_X - window.projectedX) * SCALE;
		
		let a = caveStartX + CENTERX;
		let b = CENTERY - Math.min(CENTERY, (config.MAP_Y - window.projectedY) * SCALE);
		let c = Math.min(CENTERX - caveStartX, (config.MAP_X - window.projectedX) * SCALE - caveStartX);
		let d = Math.min(2 * CENTERY, window.projectedY * SCALE + CENTERY);
				
		ctx.fillRect(a, b, c, d);
		if (b >= 0) {
			ctx.fillStyle = "#000000";
			ctx.fillRect(a, 0, Math.abs(CENTERX - a) + CENTERX, b);
		}
		if (2 * CENTERY + b + d >= 0) {
			ctx.fillStyle = "#000000";
			ctx.fillRect(a, b + d, Math.abs(CENTERX - a) + CENTERX, 2 * CENTERY + b + d);
		}
		if (2 * CENTERX + a + c >= 0) {
			ctx.fillStyle = "#000000";
			ctx.fillRect(a + c, 0, 2 * CENTERX + a + c, 2 * CENTERY);
		}
	}
	ctx.restore();

    ctx.save();
    ctx.translate(CENTERX, CENTERY);

	ctx.lineWidth = BORDER_STROKE_WIDTH;
    for (let j = Math.max(0, config.GRID_SPACING * Math.floor((window.projectedX - window.HVIEW_X) / config.GRID_SPACING)); j <= Math.min(config.MAP_X, config.GRID_SPACING * Math.ceil((window.projectedX + window.HVIEW_X) / config.GRID_SPACING)); j += config.GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo((j - window.projectedX) * SCALE, Math.min(CENTERY, window.projectedY * SCALE));
        ctx.lineTo((j - window.projectedX) * SCALE, -Math.min(CENTERY, (config.MAP_Y - window.projectedY) * SCALE));
        ctx.stroke();
    }
    for (let j = Math.max(0, config.GRID_SPACING * Math.floor((window.projectedY - window.HVIEW_Y) / config.GRID_SPACING)); j <= Math.min(config.MAP_Y, config.GRID_SPACING * Math.ceil((window.projectedY + window.HVIEW_Y) / config.GRID_SPACING)); j += config.GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo(Math.min((config.MAP_X - window.projectedX) * SCALE, CENTERX), (window.projectedY - j) * SCALE);
        ctx.lineTo(-Math.min(window.projectedX * SCALE, CENTERX), (window.projectedY - j) * SCALE);
        ctx.stroke();
    }

	/*
    for (let j = 0; j < mapStructures.length; j++) {
        drawItem(ctx, CENTERX, CENTERY, (mapStructures[j][1] - window.projectedX) * SCALE, (mapStructures[j][2] - window.projectedY) * SCALE, mapStructures[j][0], mapStructures[j][3]);
    }
	*/
	
	if (window.updateStructureCanvas) {
		redrawStructuresCanvas();
	}
	let cachedOrigin = window.players[window.playerID].oldProjectedLoc;
	let xDisplacement = window.projectedX - cachedOrigin[0];
	let yDisplacement = window.projectedY - cachedOrigin[1];
	ctx.drawImage(
		gameStructureCanvas, 
		cachedHalfWidth - window.HVIEW_X * SCALE + SCALE * xDisplacement, 
		cachedHalfHeight - window.HVIEW_Y * SCALE - SCALE * yDisplacement,
		window.VIEW_X * SCALE, window.VIEW_Y * SCALE,
		-window.HVIEW_X * SCALE, -window.HVIEW_Y * SCALE, window.VIEW_X * SCALE, window.VIEW_Y * SCALE
	);

    for (let j = 0; j < window.structures.length; j++) {
        if (window.structures[j] !== undefined) {
            if (hitObjects[j] !== undefined) {
                let theRadius = config.unifiedItems[window.structures[j].infoType].radius * SCALE * 1.1;
                if (currentT - hitObjects[j] <= HIT_NOTIF_LIFETIME) {
                    ctx.fillStyle = '#d40000';
                    ctx.beginPath();
                    ctx.arc((window.structures[j].infoX - window.projectedX) * SCALE, (window.projectedY - window.structures[j].infoY) * SCALE, 
							Math.abs(theRadius - theRadius * Math.pow((currentT - hitObjects[j]) / HIT_NOTIF_LIFETIME, 3)), 0, 2 * Math.PI, false);
                    ctx.stroke();
                    ctx.fill();
                }
                else {
                    hitObjects[j] = undefined;
                }
            }
			else if (typeof window.structures[j].infoCraftTime != 'undefined') {
				let theRadius = config.unifiedItems[window.structures[j].infoType].radius * SCALE;
                if (currentT - window.structures[j].infoCraftStart <= window.structures[j].infoCraftTime) {
                    ctx.fillStyle = '#4166f5';
                    ctx.beginPath();
                    ctx.arc((window.structures[j].infoX - window.projectedX) * SCALE, (window.projectedY - window.structures[j].infoY) * SCALE, 
							Math.abs(theRadius - theRadius * ((currentT - window.structures[j].infoCraftStart) / window.structures[j].infoCraftTime)), 0, 2 * Math.PI, false);
                    ctx.stroke();
                    ctx.fill();
                }
                else {
                    window.structures[j].infoCraftTime = undefined;
					window.structures[j].infoCraftStart = undefined;
                }
			}
        }
    }
	
	ctx.save();
	ctx.lineWidth = BORDER_STROKE_WIDTH / 2;
    for (let j = 0; j < window.bullets.length; j++) {
        if (window.bullets[j] !== undefined) {
            let bulletTicks = (currentT - window.bullets[j][0]) / config.TICK_INTERVAL;
            let theBullet = window.bullets[j];
            let realX = (theBullet[2] + theBullet[4] * bulletTicks - window.projectedX) * SCALE;
            let realY = (theBullet[3] + theBullet[5] * bulletTicks - window.projectedY) * SCALE;
            drawItem(ctx, CENTERX, CENTERY, realX, realY, theBullet[6], 0);
			
			let strokeX = realX - theBullet[4] * Math.min(2, bulletTicks) * SCALE;
			let strokeY = realY - theBullet[5] * Math.min(2, bulletTicks) * SCALE;
			
			let grd = ctx.createLinearGradient(realX, -realY, strokeX, -strokeY);
			grd.addColorStop(0, "rgba(255, 255, 255, 1)");
			grd.addColorStop(1, "rgba(255, 255, 255, 0)");
			ctx.strokeStyle = grd;
			ctx.beginPath();
			ctx.moveTo(realX, -realY);
			ctx.lineTo(strokeX, -strokeY);
			ctx.stroke();
        }
    }
	ctx.restore();
	
    for (let j = 0; j < window.visiblePlayers.length; j++) {
        if ((window.players[window.visiblePlayers[j]] !== undefined) && (window.visiblePlayers[j] != playerID)) {
            let thePlayer = window.players[window.visiblePlayers[j]];
			let theProjectedLoc = thePlayer.getProjectedLoc(currentT);
			if ((Math.abs(window.projectedX - theProjectedLoc[0]) <= window.HVIEW_X) && (Math.abs(window.projectedY - theProjectedLoc[1]) <= window.HVIEW_Y)) {
                drawPlayer(
					(theProjectedLoc[0] - window.projectedX) * SCALE, 
					(theProjectedLoc[1] - window.projectedY) * SCALE, 
					thePlayer.infodir, thePlayer.infoholding, thePlayer.infohealth, 
					window.playerNames[thePlayer.infoID], window.hitTimes[thePlayer.infoID], thePlayer.infoID, currentT
				);
            }
        }
    }
	
    ctx.fillStyle = PLAYER_COLOR;
    ctx.strokeStyle = BORDER_STROKE_STYLE;
    ctx.lineWidth = BORDER_STROKE_WIDTH;
    for (let j = 0; j < window.visiblePlayers.length; j++) {
        if ((window.players[window.visiblePlayers[j]] !== undefined) && (window.visiblePlayers[j] != playerID)) {
            let thePlayer = window.players[window.visiblePlayers[j]];
			let theProjectedLoc = thePlayer.getProjectedLoc(currentT);
            if ((Math.abs(window.projectedX - theProjectedLoc[0]) <= window.HVIEW_X) && (Math.abs(window.projectedY - theProjectedLoc[1]) <= window.HVIEW_Y)) {
                let thePlayer = window.players[window.visiblePlayers[j]];
                drawPlayerBody(
					(theProjectedLoc[0] - window.projectedX) * SCALE, 
					(theProjectedLoc[1] - window.projectedY) * SCALE, 
					window.playerNames[thePlayer.infoID], window.playerColors[thePlayer.infoID]
				);
            }
        }
    }

	ctx.save();
	let CIPCache = [0, 0, 0, 0];
	let ECCache1 = [0, 0];
	let ECCache2 = [0, 0];
    ctx.fillStyle = '#000000';
    for (let j = 0; j < mapStructures.length; j++) {
        let x = (mapStructures[j][1] - window.projectedX) * SCALE;
        let y = (mapStructures[j][2] - window.projectedY) * SCALE;
        if ((Math.abs(x) <= CENTERX) && (Math.abs(y) <= CENTERX)) {
            let hType = config.unifiedItems[mapStructures[j][0]];
            if (hType.viewBlocker == true) {
                var actualX = x;
                var actualY = -y;
                var fullOcclude = false;

                if (x*x + y*y < Math.pow(hType.radius * SCALE, 2)) {
                    let theta = Math.atan2(actualY, actualX);
                    actualX = hType.radius * SCALE * Math.cos(theta);
                    actualY = hType.radius * SCALE * Math.sin(theta);
                    fullOcclude = true;
                    window.frameFullOcclude = true;
                }
                if ((fullOcclude == false) || (
                    ((window.occludeSwitchTime == undefined) ||
                    (currentT - window.occludeSwitchTime <= 500))
                )) {
                    window.inPlaceCIP(x - actualX, -y - actualY, actualX, actualY, hType.radius * SCALE, CIPCache);
                    window.inPlaceEC(CIPCache[0], CIPCache[1], CENTERX, CENTERY, ECCache1);
                    window.inPlaceEC(CIPCache[2], CIPCache[3], CENTERX, CENTERY, ECCache2);
                    ctx.beginPath();
                    ctx.moveTo(CIPCache[0], CIPCache[1]);
                    
                    ctx.lineTo(CIPCache[2], CIPCache[3]);
                    
                    ctx.lineTo(ECCache2[0], ECCache2[1]);
                    let ranSimple = addSimpleCorners(ECCache1, ECCache2);
                    if (ranSimple == false) {
                        let midCorner = [Math.sign(actualX) * CENTERX, Math.sign(actualY) * CENTERY];
                        addSimpleCorners(midCorner, ECCache2);
                        ctx.lineTo(midCorner[0], midCorner[1]);
                        addSimpleCorners(ECCache1, midCorner);
                    }
                    ctx.lineTo(ECCache1[0], ECCache1[1]);
                    ctx.closePath();
                    ctx.fill();
					//ctx.stroke();
                }
                else {
                    ctx.beginPath();
                    ctx.rect(-CENTERX, -CENTERY, CENTERX * 2, CENTERY * 2);
                    ctx.fill();
                    drawItem(ctx, CENTERX, CENTERY, (mapStructures[j][1] - window.projectedX) * SCALE, (mapStructures[j][2] - window.projectedY) * SCALE, mapStructures[j][0], mapStructures[j][3]);
                    break;
                }
            }
        }
    }
    ctx.restore();

    if (window.damageTexts.length > 0) {
        for (let j = 0; j < window.damageTexts.length; j++) {
            if (typeof window.damageTexts[j] != 'undefined') {
                let timeDelta = Date.now() - window.damageTexts[j].infoStart;
                if (timeDelta <= DAMAGE_NOTIF_LIFETIME) {
                    let spaceDelta = Math.pow(timeDelta / DAMAGE_NOTIF_LIFETIME, 0.5) * DAMAGE_NOTIF_DISPLACEMENT;
                    if (
                        (Math.abs(window.projectedX - window.damageTexts[j].infoX) <= window.HVIEW_X) &&
                        (Math.abs(window.projectedY - window.damageTexts[j].infoY + spaceDelta) <= window.HVIEW_Y)
                    ) {
						ctx.save();
						let largeFont = false;
                        if (window.damageTexts[j].infoType == "bad") {
                            ctx.fillStyle = "#FF0000";
                        }
						else if (window.damageTexts[j].infoType == "focusbad") {
                            ctx.fillStyle = "#FF0000";
							largeFont = true;
                        }
                        else if (window.damageTexts[j].infoType == "neutral") {
                            ctx.fillStyle = "#FFFFFF";
                        }
                        else if (window.damageTexts[j].infoType == "good") {
                            ctx.fillStyle = "#00FF00";
                        }
						else if (window.damageTexts[j].infoType == "critical") {
							ctx.fillStyle = "#FFD700";
							largeFont = true;
						}
						if (largeFont) {
							let [first, ...rest] = ctx.font.split('px');
							ctx.font = '' + parseInt(first) * 1.5 + 'px' + rest.join('px');
						}
						ctx.fillText('' + window.damageTexts[j].infoDmg, (window.damageTexts[j].infoX - window.projectedX) * SCALE, -(window.damageTexts[j].infoY - window.projectedY + spaceDelta) * SCALE);
						ctx.restore();
					}
                }
                else {
                    window.damageTexts[j] = undefined;
                }
            }
        }
    }

	let myPlayer = window.players[window.playerID];
    drawPlayer(0, 0, window.direction, myPlayer.infoholding, myPlayer.infohealth, window.playerNames[window.playerID], window.hitTimes[window.playerID], window.playerID, currentT);
	ctx.fillStyle = PLAYER_COLOR;
    ctx.strokeStyle = BORDER_STROKE_STYLE;
    ctx.lineWidth = BORDER_STROKE_WIDTH;
	drawPlayerBody(0, 0, window.playerNames[playerID], myColor);
	
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (window.touchRotateCoords !== undefined) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(211, 211, 211, 0.3)';
        ctx.fillStyle = 'rgba(211, 211, 211, 0.3)';
        ctx.arc(window.touchRotateCoords[0], window.touchRotateCoords[1], 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
    }
    if (window.touchMoveCoords !== undefined) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(211, 211, 211, 0.3)';
        ctx.fillStyle = 'rgba(211, 211, 211, 0.3)';
        ctx.arc(window.touchMoveCoords[0], window.touchMoveCoords[1], 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
    }
    ctx.restore();
}

window.addEventListener('load', function() {
    config = window.config;
    msgpack = window.msgpack;
    mapStructures = window.mapData.gameStructures;
    unifiedItems = config.unifiedItems;

    smoothTime = config.TICK_INTERVAL * 3;

    window.VIEW_X = config.VIEW_X;
    window.VIEW_Y = config.VIEW_Y;
    window.HVIEW_X = window.VIEW_X / 2;
    window.HVIEW_Y = window.VIEW_Y / 2;

    gCanvas = document.getElementById('GameCanvas');
    minimapCanvas = document.getElementById('minimap');
    ctx = gCanvas.getContext('2d');
    minictx = minimapCanvas.getContext('2d');
    HUDData = document.getElementById('HUDData');

    window.ws = new WebSocket('wss://mooink.repl.co');
    window.ws.binaryType = 'arraybuffer';
    window.ws.addEventListener('error', function(e) {
        alert("ERROR - PLEASE COPY+PASTE AND REPORT TO SKY: " + e);
    });
    window.ws.addEventListener('open', function() {
        document.getElementById('joinGame').addEventListener('click', function() {
			if ((typeof window.primarySelection != 'undefined') && (typeof window.secondarySelection != 'undefined') && (typeof window.trapBoostSelection != 'undefined')) {
				window.rotationLocked = false;
				let theName = document.getElementById('pName').value;
				let a = msgpack.addString([msgpack.JOIN], theName);
				msgpack.addNumb(a, window.primarySelection);
				msgpack.addNumb(a, window.secondarySelection);
				msgpack.addNumb(a, window.trapBoostSelection);
				for (let j = 0; j < window.statPoints.length; j++) {
					msgpack.addNumb(a, window.statPoints[j]);
				}
				msgpack.addString(a, window.colorSelection);
				window.ws.send(new Uint8Array(a));
				buildMult = 1 + (window.statPoints[6] - config.STATS_INITIAL) * config.BUILDCOUNT_GROWTH;
				window.ws.addEventListener('message', window.waitJoin);
				window.showGameUI();
			}
            else {
                alert("Please select a primary and secondary item");
            }
        });
    });

    function closeHandler() {
		console.log("COSED");
        //alert("CLOSED - IF THIS IS UNEXPECTED, PLEASE COPY+PASTE AND REPORT TO SKY: " + e.code + ", " + e.reason + ", " + e.wasClean);
        if (reconnectID !== undefined) {
            let newWs = new WebSocket('wss://mooink.repl.co');
            newWs.binaryType = 'arraybuffer';
            newWs.addEventListener('open', function() {
                setTimeout(function() {
                    newWs.send(new Uint8Array(window.msgpack.addString([window.msgpack.RECONNECT], reconnectID)));
                    window.ws = newWs;
                    window.ws.addEventListener('message', window.mainHandler);
                    window.ws.addEventListener('close', closeHandler);
                    window.showGameUI();
                }, 250);
            });
        }

        window.hideGameUI();
		document.getElementById('disconnected').style.display = "initial";
    }

    window.ws.addEventListener('close', closeHandler);

    function calcImageDimensions() {
        for (let j = 0; j < unifiedItems.length; j++) {
            let currItem = unifiedItems[j];
            if ((window.images[j] !== undefined) && ((currItem.wtype == 1) || (currItem.wtype == 2))) {
                if (currItem.vertical !== true) {
                    let lengthX = (currItem.range + currItem.offsetX) * SCALE;
                    let lengthY = (window.images[j].height / window.images[j].width) * lengthX;
                    imageDimensions[j] = [lengthX, lengthY];
                }
                else {
                    let lengthY = (currItem.range) * SCALE;
                    let lengthX = (window.images[j].width / window.images[j].height) * lengthY;
                    imageDimensions[j] = [lengthX, lengthY];
                }
            }
        }
    }

    window.configCanvas = function() {
        if (window.innerWidth < window.innerHeight) {
            alert("Please rotate your device horizontally");
        }
        if (document.getElementById('lowres').checked == true) {
            gCanvas.width = window.innerWidth / config.LOWRES_MULT;
            gCanvas.height = Math.min(window.innerHeight, window.innerWidth / 2) / config.LOWRES_MULT;
            SCALE = gCanvas.width / window.VIEW_X;
            CENTERX = gCanvas.width / 2;
            CENTERY = gCanvas.height / 2;
            window.REFX = CENTERX * config.LOWRES_MULT;
            window.REFY = CENTERY * config.LOWRES_MULT;
        }
        else {
            gCanvas.width = window.innerWidth;
            gCanvas.height = Math.min(window.innerHeight, window.innerWidth / 2);
            SCALE = gCanvas.width / window.VIEW_X; 
            CENTERX = gCanvas.width / 2;
            CENTERY = gCanvas.height / 2;
            window.REFX = CENTERX;
            window.REFY = CENTERY;
        }
        
        gCanvas.style.height = Math.min(window.innerHeight, window.innerWidth / 2);
        gCanvas.style.width = window.innerWidth;

        minimapCanvas.width = 0.1 * window.innerWidth;
        minimapCanvas.height = 0.1 * window.innerWidth;
        minimapCanvas.style.width = minimapCanvas.width;
        minimapCanvas.style.height = minimapCanvas.height;

        if (document.getElementById('lowres').checked == true) {
            ctx.font = '' + Math.round(25 / config.LOWRES_MULT) + 'px Arial';
			BORDER_STROKE_WIDTH = 5 / config.LOWRES_MULT;
        }
        else {
            ctx.font = '25px Arial';
			BORDER_STROKE_WIDTH = 5;
        }
        ctx.textAlign = 'center';
        ctx.lineCap = 'round';

        ctx.fillStyle = '#292a2e';
        ctx.strokeStyle = 'rgba(64, 65, 71, 0.22)';
        ctx.lineWidth = 4;

        calcImageDimensions();

        BORDER_STROKE_STYLE = '#2e2e2e';
        PLAYER_COLOR = '#4e83d9';
        PLAYER_RAD = SCALE * config.PLAYER_RADIUS;

        AUTOHIT_DTHETA = (2 / 3) * Math.PI;
        AUTOHIT_ANIMSPEED_MULT = 0.08;
    }
    window.configCanvas();
    window.onresize = window.configCanvas;

    window.drawLeaderboardBacker = function(myID) {
        window.localStorage.setItem('testing123', '' + myID);
        window.addEventListener('storage', function() {
            let inputData = window.localStorage.getItem('testing123');
            if (typeof inputData !== 'undefined') {
                let ID = parseInt(inputData);
                window.localStorage.removeItem('testing123');
                if ((!isNaN(ID)) && (ID !== playerID)) {
                    //window.ws.send(new Uint8Array([msgpack.PING, 0, 0, 0]));
                }
            }
        });
    }

    window.incrementStruc = function(type) {
        if (typeof structureCounts[type] !== 'undefined') {
            structureCounts[type] += 1;
        }
        else {
            structureCounts[type] = 1;
        }
        window.updateStrucDiv();
    }

    window.decrementStruc = function(type) {
        if (typeof structureCounts[type] !== 'undefined') {
            structureCounts[type] -= 1;
        }
        else {
            structureCounts[type] = 0;
        }
        window.updateStrucDiv();
    }

    window.updateStrucDiv = function() {
		let holding = window.players[window.playerID].infoholding;
		
        let toAppend = "";
        if (countdownTimer !== undefined) {
            let winperf = Math.floor((config.TOTEM_TIMER - (window.performance.now() - countdownTimer)) / 1000);
            let secs = winperf % 60;
            toAppend += "Place totem within " + Math.floor((winperf - secs) / 60) + " min, " + secs + " sec\n";
        }
		if ((typeof window.actionBarSlots[window.holdingSelectorIndex].count != 'undefined') && (window.actionBarSlots[window.holdingSelectorIndex].count > 0)) {
			toAppend += window.getHoldSlotName(window.actionBarSlots[window.holdingSelectorIndex]) + ": " + window.actionBarSlots[window.holdingSelectorIndex].count + " left\n";
		}
        else if (structureCounts[holding] !== undefined) {
			toAppend += window.getHoldSlotName(window.actionBarSlots[window.holdingSelectorIndex]) + ": " + structureCounts[holding] + " / " + Math.floor(unifiedItems[holding].build_limit * buildMult) + "\n";
        }
        else {
			if (typeof holding !== 'undefined') {
				if (unifiedItems[holding].build_limit !== undefined) {
					toAppend += window.getHoldSlotName(window.actionBarSlots[window.holdingSelectorIndex]) + ": 0 / " + Math.floor(unifiedItems[holding].build_limit * buildMult) + "\n";
				}
				else {
					toAppend += "Holding: " + window.getHoldSlotName(window.actionBarSlots[window.holdingSelectorIndex]) + "\n";
				}
			}
        }
        toAppend += "Ping: " + Math.round(ping) + "\n";
        toAppend += "FPS: " + Math.round(fps) + "\n";
        toAppend += "Kills: " + kills;
        HUDData.innerText = toAppend;
    }

    window.checkPing = function() {
        lastPing = window.performance.now();
        window.ws.send(new Uint8Array([msgpack.PING]));
    }

    gCanvas.oncontextmenu = function(e) {
        e.preventDefault(); 
        e.stopPropagation(); 
    };
    document.body.oncontextmenu = function(e) {
        e.preventDefault(); 
        e.stopPropagation(); 
    };

    window.requestAnimationFrame(renderLoop);
    setInterval(window.checkPing, 4000);
});